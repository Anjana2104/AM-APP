import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form, Modal, Spin, message } from 'antd';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import * as resourceApi from '../../api/resourceApi';
import * as requestApi from '../../api/requestApi';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { useUserPreferences } from '../../context/UserPreferencesContext';
import { clearModuleArtifact } from '../../utils/moduleCleanupApi';
import { buildStyledWorksheetFromAoa, getCurrentDateStamp } from '../../utils/styledExcelExport';
import { writeJsonSheetFile } from '../../utils/xlsxExport';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setResources as setResourcesAction, setResourcesFromServer } from '../../store/resourcesSlice';
import { setActiveRequestOptions as setActiveRequestOptionsAction } from '../../store/requestsSlice';
import SharedResourceFilterPanel from '../../components/SharedResourceFilterPanel';
import { ResourceCardView } from './ResourceCardView';
import { RESOURCE_COLUMN_KEYS } from './resourceConstants';
import { mapResourceApiRowToResourceRow } from './resourceRowMappers';
import { ResourceTable } from './ResourceTable';
import type {
  BeelineLinkModalState,
  BulkUploadResult,
  FilterState,
  ResourceHubProps,
  ResourceViewMode,
  SelectOption,
} from './resourceTypes';
import { getMissingRequiredHeaders, processResourceUploadWorksheet, toBulkSavePayload } from './resourceUploadUtils';
import type { ResourceRow } from '../../types/resource';

const DEFAULT_FILTERS: FilterState = {
  sno: '',
  raId: '',
  empName: '',
  emailId: '',
  piwRole: [],
  roleOrDomain: [],
  totalWorkex: '',
  skills: [],
  engagement: '',
  workexRange: [0, 70],
  allocationStatus: '',
  activeState: '',
  beelineId: '',
  allocationPct: '',
};

const REQUIRED_UPLOAD_HEADERS = ['RA ID'];
const EXP_BUCKETS = [
  { label: '0–3 Yrs', min: 0, max: 3 },
  { label: '3–5 Yrs', min: 3, max: 5 },
  { label: '5–8 Yrs', min: 5, max: 8 },
  { label: '8–10 Yrs', min: 8, max: 10 },
  { label: '10+ Yrs', min: 10, max: Infinity },
] as const;

export function useResourceHubState({
  onResourcesChange,
  initialRoleFilter,
  initialRaIdFilter,
  initialFilterType,
  initialFilterValue,
  onFilterApplied,
  onNavigateToRequest,
  onNavigateToInsights,
  onNavigateToProcess,
}: ResourceHubProps) {
  const { hasPermission, currentUser } = useAuth();
  const { getConfigByLink } = useConfig();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const dispatch = useAppDispatch();
  const resources = useAppSelector((state) => state.resources.items);
  const resourcesLoaded = useAppSelector((state) => state.resources.loaded);
  const fromServer = useAppSelector((state) => state.resources.fromServer);
  const activeRequestOptions = useAppSelector((state) => state.requests.activeRequestOptions);
  const canEdit = hasPermission('resources_info', 'edit');
  const canDelete = hasPermission('resources_info', 'delete');
  const currentUsername = currentUser?.username || 'system';

  const [loading, setLoading] = useState(true);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [viewMode, setViewMode] = useState<ResourceViewMode>('card');
  const [editDrawer, setEditDrawer] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(
    new Set<string>(RESOURCE_COLUMN_KEYS as unknown as string[]),
  );
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [beelineLinkModal, setBeelineLinkModal] = useState<BeelineLinkModalState>({ open: false, resource: null });
  const [selectedBeelineId, setSelectedBeelineId] = useState('');
  const [savingBeeline, setSavingBeeline] = useState(false);
  const [bulkUploadResult, setBulkUploadResult] = useState<BulkUploadResult | null>(null);
  const [activeTab, setActiveTab] = useState('resources');
  const [form] = Form.useForm();

  const resourcesRef = useRef(resources);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  const applyResources = useCallback((nextResources: ResourceRow[]) => {
    resourcesRef.current = nextResources;
    dispatch(setResourcesAction(nextResources));
    onResourcesChange?.(nextResources);
  }, [dispatch, onResourcesChange]);

  const setResources = useCallback((valueOrUpdater: ResourceRow[] | ((prev: ResourceRow[]) => ResourceRow[])) => {
    const currentResources = resourcesRef.current;
    const nextResources = typeof valueOrUpdater === 'function'
      ? valueOrUpdater(currentResources)
      : valueOrUpdater;
    applyResources(nextResources);
  }, [applyResources]);

  useEffect(() => {
    if (resourcesLoaded) {
      setLoading(false);
      return;
    }

    setLoading(true);
    resourceApi.getResources()
      .then(({ resources: apiRows, fromServer: online }) => {
        dispatch(setResourcesFromServer(online));
        if (online) {
          applyResources(apiRows.map((row, index) => mapResourceApiRowToResourceRow(row, index)));
        }
      })
      .finally(() => setLoading(false));
  }, [applyResources, dispatch, resourcesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const visibility = getColumnVisibility('resources');
    if (Object.keys(visibility).length === 0) return;
    const savedKeys = Object.entries(visibility).filter(([, value]) => value).map(([key]) => key);
    setVisibleColumnsState(new Set(['sno', 'action', ...savedKeys]));
  }, [getColumnVisibility, preferencesLoaded]);

  const setVisibleColumns = useCallback((nextVisibleColumns: Set<string>) => {
    setVisibleColumnsState(nextVisibleColumns);
    const visibility: Record<string, boolean> = {};
    ['raId', 'empName', 'emailId', 'piwRole', 'roleOrDomain', 'previousWorkex', 'doj', 'totalWorkex', 'engagement', 'allocationStatus', 'resourceStatus', 'skills']
      .forEach((key) => {
        visibility[key] = nextVisibleColumns.has(key);
      });
    saveColumnVisibility('resources', visibility);
  }, [saveColumnVisibility]);

  const ensureActiveRequestOptions = useCallback(async () => {
    if (activeRequestOptions.length > 0) return;
    const activeRequests = await requestApi.getActiveRequests();
    dispatch(setActiveRequestOptionsAction(activeRequests));
  }, [activeRequestOptions.length, dispatch]);

  const beelineRequestOptions = useMemo<SelectOption[]>(() => (
    activeRequestOptions
      .filter((request) => request.beelineId)
      .map((request) => ({ value: request.beelineId, label: request.beelineId }))
  ), [activeRequestOptions]);

  const openBeelineLink = useCallback((resource: ResourceRow) => {
    setSelectedBeelineId(resource.beelineId || '');
    setBeelineLinkModal({ open: true, resource });
    ensureActiveRequestOptions().catch(() => {
      message.warning('Could not load active request list. You can still enter Beeline ID manually.');
    });
  }, [ensureActiveRequestOptions]);

  const handleSaveBeelineLink = useCallback(async () => {
    const resource = beelineLinkModal.resource;
    if (!resource?.id) return;

    setSavingBeeline(true);
    const ok = await resourceApi.setBeelineLink(resource.id, selectedBeelineId, currentUsername);
    setSavingBeeline(false);

    if (!ok) {
      message.error('Failed to save beeline link');
      return;
    }

    setResources((prev) => prev.map((row) => (
      row.key === resource.key ? { ...row, beelineId: selectedBeelineId } : row
    )));

    if (selectedResource?.key === resource.key) {
      setSelectedResource((prev) => (prev ? { ...prev, beelineId: selectedBeelineId } : prev));
    }

    message.success(selectedBeelineId ? `Linked to ${selectedBeelineId}` : 'Beeline link removed');
    setBeelineLinkModal({ open: false, resource: null });
  }, [beelineLinkModal.resource, currentUsername, selectedBeelineId, selectedResource, setResources]);

  const engagementOptions = useMemo<SelectOption[]>(() => {
    const configValues = Array.isArray(getConfigByLink('engagement_field')?.items)
      ? getConfigByLink('engagement_field')!.items.map((item) => item.value)
      : [];
    const resourceValues = resources.map((resource) => resource?.engagement).filter((value): value is string => !!value);
    return Array.from(new Set([...configValues, ...resourceValues])).sort().map((value) => ({ label: value, value }));
  }, [getConfigByLink, resources]);

  const allocationStatusOptions = useMemo<SelectOption[]>(() => {
    const config = getConfigByLink('allocation_status_field');
    return Array.isArray(config?.items)
      ? config.items.map((item) => ({ label: item.label, value: item.value }))
      : [];
  }, [getConfigByLink]);

  const updateFilters = useCallback((patch: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    if (!initialRoleFilter) return;
    updateFilters({ roleOrDomain: [initialRoleFilter] });
    setViewMode('table');
    setShowFilterPanel(true);
    onFilterApplied?.();
  }, [initialRoleFilter, onFilterApplied, updateFilters]);

  useEffect(() => {
    if (!initialRaIdFilter) return;
    updateFilters({ raId: initialRaIdFilter });
    setViewMode('table');
    setShowFilterPanel(true);
    onFilterApplied?.();
  }, [initialRaIdFilter, onFilterApplied, updateFilters]);

  useEffect(() => {
    if (!initialFilterType || !initialFilterValue) return;

    if (initialFilterType === 'expBucket') {
      const bucket = EXP_BUCKETS.find((value) => value.label === initialFilterValue);
      if (bucket) {
        updateFilters({ workexRange: [bucket.min, bucket.max === Infinity ? 70 : bucket.max] });
      }
    } else if (initialFilterType === 'piwRole' || initialFilterType === 'roleOrDomain' || initialFilterType === 'skills') {
      updateFilters({ [initialFilterType]: [initialFilterValue] } as Partial<FilterState>);
    } else {
      const fieldMap: Record<string, keyof FilterState> = {
        engagement: 'engagement',
        allocationStatus: 'allocationStatus',
        beelineId: 'beelineId',
      };
      const field = fieldMap[initialFilterType];
      if (field) {
        updateFilters({ [field]: initialFilterValue } as Partial<FilterState>);
      }
    }

    setViewMode('table');
    setShowFilterPanel(true);
    onFilterApplied?.();
  }, [initialFilterType, initialFilterValue, onFilterApplied, updateFilters]);

  const isFilterApplied = useMemo(() => (
    filters.empName !== ''
    || filters.raId !== ''
    || filters.piwRole.length > 0
    || filters.roleOrDomain.length > 0
    || filters.skills.length > 0
    || filters.engagement !== ''
    || filters.allocationStatus !== ''
    || filters.activeState !== ''
    || filters.workexRange[0] !== 0
    || filters.workexRange[1] !== 70
    || !!globalSearch
    || !!filters.beelineId
    || !!filters.allocationPct
  ), [filters, globalSearch]);

  useEffect(() => {
    if (!showFilterPanel) return;

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInsideAntPopup = !!(target as Element)?.closest?.('.ant-select-dropdown, .ant-picker-dropdown, .ant-tooltip, .ant-popover, .ant-dropdown');
      if (filterPanelRef.current && !filterPanelRef.current.contains(target) && !isInsideAntPopup) {
        setShowFilterPanel(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const closeFilterOnEnter = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      setShowFilterPanel(false);
    }
  }, []);

  const handleUpload = useCallback((file: File) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = event.target?.result;
        if (!data) {
          message.error('Failed to read file');
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const missingHeaders = getMissingRequiredHeaders(worksheet, REQUIRED_UPLOAD_HEADERS);

        if (missingHeaders.length > 0) {
          Modal.error({
            title: 'Invalid Template',
            content: (
              <div>
                <p style={{ marginBottom: 8 }}>The uploaded file does not match the required template. Missing columns:</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {missingHeaders.map((header) => <li key={header} style={{ color: '#f5222d', fontSize: '13px' }}>{header}</li>)}
                </ul>
                <p style={{ marginTop: 12, color: '#8c8c8c', fontSize: '12px' }}>
                  Please download the template using the <strong>Download Template</strong> button and fill data in the correct format.
                </p>
              </div>
            ),
            okText: 'OK',
          });
          return;
        }

        const uploadResult = processResourceUploadWorksheet(worksheet, resourcesRef.current);
        const { totalRows, uploadedCount, newCount, updCount, skippedRows, mergedRows } = uploadResult;

        setResources(mergedRows);

        const hideLoading = message.loading('Saving to database...', 0);
        let serverOk = false;

        try {
          const result = await resourceApi.bulkSave(toBulkSavePayload(mergedRows), currentUsername);
          hideLoading();
          serverOk = !!result.ok;
          if (!result.ok) {
            message.warning('Loaded locally — server offline, changes not persisted');
          }
        } catch (error) {
          hideLoading();
          console.error('[ResourceHub] Failed to save uploaded resources to server', error);
          message.warning('Loaded locally (server unreachable). Re-upload when server is available.');
        }

        if (skippedRows.length > 0) {
          setBulkUploadResult({ totalRows, uploadedCount, newCount, updCount, skippedRows, serverOk });
        } else if (serverOk) {
          message.success(`Upload complete: ${newCount} new, ${updCount} updated (total ${mergedRows.length} records)`);
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Error parsing file');
      }
    };

    reader.onerror = () => message.error('Failed to read file');
    reader.readAsBinaryString(file);
    return false;
  }, [currentUsername, setResources]);

  const downloadTemplate = useCallback(() => {
    try {
      writeJsonSheetFile(
        XLSX,
        [
          {
            'S.NO': '1',
            'RA ID': 'RA001',
            'Employee Name': 'John Doe',
            'Email': 'john.doe@example.com',
            'PIW Role': 'Developer',
            'Role/Domain': 'Full Stack',
            'Previous Workex': '2 years',
            'DOJ': '2024-01-15',
            'Total Workex': '5 years',
            'Current Engagement': 'Project Alpha',
            'Engagement Start Date': '2024-01-15',
            'Engagement End Date': '2024-12-31',
            'Allocation Status': 'Joined',
            'Allocation %': '100',
            'Skills': 'JavaScript, React, Node.js',
            'Beeline ID': 'BL-001',
          },
          {
            'S.NO': '2',
            'RA ID': 'RA002',
            'Employee Name': '',
            'Email': '',
            'PIW Role': '',
            'Role/Domain': '',
            'Previous Workex': '',
            'DOJ': '',
            'Total Workex': '',
            'Current Engagement': '',
            'Engagement Start Date': '',
            'Engagement End Date': '',
            'Allocation Status': '',
            'Allocation %': '',
            'Skills': 'Azure, DevOps',
            'Beeline ID': '',
          },
        ],
        'Resources',
        'Resource_Template.xlsx',
        { columnWidths: [8, 12, 20, 28, 18, 18, 16, 14, 14, 28, 18, 18, 18, 12, 36, 14] },
      );
      message.success('Template downloaded successfully');
    } catch (error) {
      message.error(`Error: ${error instanceof Error ? error.message : 'Download error'}`);
    }
  }, []);

  const handleAddNew = useCallback(() => {
    form.resetFields();
    setEditingResource(null);
    setEditDrawer(true);
  }, [form]);

  const handleEdit = useCallback((resource: ResourceRow | null) => {
    if (!resource) return;
    if (!canEdit) {
      message.error('You do not have permission to edit resources.');
      return;
    }

    setEditingResource(resource);
    form.setFieldsValue({
      raId: resource.raId || '',
      empName: resource.empName || '',
      emailId: resource.emailId || '',
      piwRole: resource.piwRole || '',
      roleOrDomain: resource.roleOrDomain || '',
      previousWorkex: resource.previousWorkex || '',
      doj: resource.doj || '',
      totalWorkex: resource.totalWorkex || '',
      skills: resource.skills || '',
      engagement: resource.engagement || '',
      engagementStartDate: resource.engagementStartDate || '',
      engagementEndDate: resource.engagementEndDate || '',
      allocationPercentage: resource.allocationPercentage != null ? resource.allocationPercentage : null,
    });
    setEditDrawer(true);
  }, [canEdit, form]);

  const closeEditDrawer = useCallback(() => {
    setEditDrawer(false);
    form.resetFields();
    setEditingResource(null);
  }, [form]);

  const handleSaveEdit = useCallback(async (values: any) => {
    try {
      if (!values || typeof values !== 'object') {
        message.error('Invalid form data');
        return;
      }

      const newEngagement = String(values.engagement || '').trim();
      const isEdit = !!editingResource?.key;

      if (isEdit && editingResource) {
        const existingAllocStatus = String(editingResource.allocationStatus || '').trim();
        let newAllocStatus = existingAllocStatus || 'Joined';
        if (!newEngagement || newEngagement.toLowerCase() === 'bench') {
          newAllocStatus = 'Available';
        } else if (!existingAllocStatus || existingAllocStatus.toLowerCase() === 'available') {
          newAllocStatus = 'Joined';
        }

        const updatedRow: ResourceRow = {
          ...editingResource,
          raId: String(values.raId || ''),
          empName: String(values.empName || ''),
          emailId: String(values.emailId || ''),
          piwRole: String(values.piwRole || ''),
          roleOrDomain: String(values.roleOrDomain || ''),
          previousWorkex: String(values.previousWorkex || ''),
          doj: String(values.doj || ''),
          totalWorkex: String(values.totalWorkex || ''),
          skills: String(values.skills || ''),
          engagement: newEngagement,
          allocationStatus: newAllocStatus,
          allocationPercentage: values.allocationPercentage != null ? Number(values.allocationPercentage) : null,
          engagementStartDate: String(values.engagementStartDate || ''),
          engagementEndDate: String(values.engagementEndDate || ''),
        };

        setResources((prev) => prev.map((row) => (row.key === editingResource.key ? updatedRow : row)));

        if (updatedRow.id) {
          await resourceApi.updateResource(updatedRow.id, {
            raId: updatedRow.raId,
            empName: updatedRow.empName,
            emailId: updatedRow.emailId,
            piwRole: updatedRow.piwRole,
            roleOrDomain: updatedRow.roleOrDomain,
            previousWorkex: updatedRow.previousWorkex,
            doj: updatedRow.doj,
            totalWorkex: updatedRow.totalWorkex,
            engagement: updatedRow.engagement,
            skills: updatedRow.skills,
            allocationPercentage: updatedRow.allocationPercentage,
            engagementStartDate: updatedRow.engagementStartDate,
            engagementEndDate: updatedRow.engagementEndDate,
            changedBy: currentUsername,
          });
        }
      } else {
        const newAllocStatus = newEngagement.toLowerCase() === 'bench' ? 'Available' : 'Joined';
        const newRow: ResourceRow = {
          key: String(Date.now()),
          sno: '',
          isActive: true,
          raId: String(values.raId || ''),
          empName: String(values.empName || ''),
          emailId: String(values.emailId || ''),
          piwRole: String(values.piwRole || ''),
          roleOrDomain: String(values.roleOrDomain || ''),
          previousWorkex: String(values.previousWorkex || ''),
          doj: String(values.doj || ''),
          totalWorkex: String(values.totalWorkex || ''),
          skills: String(values.skills || ''),
          engagement: newEngagement,
          allocationStatus: newAllocStatus,
          allocationPercentage: values.allocationPercentage != null ? Number(values.allocationPercentage) : null,
          engagementStartDate: String(values.engagementStartDate || ''),
          engagementEndDate: String(values.engagementEndDate || ''),
        };

        setResources((prev) => [...prev, { ...newRow, sno: String(prev.length + 1) }]);
        await resourceApi.bulkSave([{
          raId: newRow.raId,
          sno: 0,
          empName: newRow.empName,
          emailId: newRow.emailId,
          piwRole: newRow.piwRole,
          roleOrDomain: newRow.roleOrDomain,
          previousWorkex: newRow.previousWorkex,
          doj: newRow.doj,
          totalWorkex: newRow.totalWorkex,
          engagement: newRow.engagement,
          skills: newRow.skills,
          allocationStatus: newAllocStatus,
          allocationPercentage: newRow.allocationPercentage,
          engagementStartDate: newRow.engagementStartDate,
          engagementEndDate: newRow.engagementEndDate,
        }], currentUsername);
      }

      message.success(isEdit ? 'Resource updated successfully' : 'Resource added successfully');
      closeEditDrawer();
    } catch (error) {
      message.error(`Error: ${error instanceof Error ? error.message : 'Save error'}`);
    }
  }, [closeEditDrawer, currentUsername, editingResource, setResources]);

  const closeDetailDrawer = useCallback(() => {
    setDetailDrawer(false);
    setDetailExpanded(false);
  }, []);

  const handleToggleActive = useCallback((resource: ResourceRow | null, nextActive: boolean) => {
    if (!resource?.key) return;
    if (!canDelete) {
      message.error('You do not have permission to change resource status.');
      return;
    }

    Modal.confirm({
      title: nextActive ? 'Reactivate Resource' : 'Mark Resource Inactive',
      content: `Are you sure you want to ${nextActive ? 'reactivate' : 'mark inactive'} ${resource.empName || 'this resource'}?`,
      okText: 'Yes',
      cancelText: 'No',
      okButtonProps: nextActive ? undefined : { danger: true },
      async onOk() {
        if (!resource.id) return;
        const ok = await resourceApi.updateResource(resource.id, { isActive: nextActive, changedBy: currentUsername });
        if (!ok) {
          message.error('Failed to update resource status');
          return;
        }

        setResources((prev) => prev.map((row) => (
          row.key === resource.key ? { ...row, isActive: nextActive } : row
        )));

        if (selectedResource?.key === resource.key) {
          setSelectedResource((prev) => (prev ? { ...prev, isActive: nextActive } : prev));
        }

        message.success(nextActive ? 'Resource reactivated successfully' : 'Resource marked inactive successfully');
        closeDetailDrawer();
      },
    });
  }, [canDelete, closeDetailDrawer, currentUsername, selectedResource, setResources]);

  const getFilteredResources = useCallback((): ResourceRow[] => resources.filter((resource) => {
    if (!resource) return false;

    if (globalSearch) {
      const query = globalSearch.toLowerCase();
      const activeLabel = resource.isActive === false ? 'inactive' : 'active';
      const haystack = [
        resource.empName,
        resource.raId,
        resource.emailId,
        resource.piwRole,
        resource.roleOrDomain,
        resource.skills,
        resource.engagement,
        resource.allocationStatus,
        resource.beelineId,
        resource.sno,
        activeLabel,
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      if (!haystack.includes(query)) return false;
    }

    if (filters.sno && !String(resource.sno || '').toLowerCase().includes(filters.sno.toLowerCase())) return false;
    if (filters.raId && !String(resource.raId || '').toLowerCase().includes(filters.raId.toLowerCase())) return false;
    if (filters.empName && !String(resource.empName || '').toLowerCase().includes(filters.empName.toLowerCase())) return false;
    if (filters.emailId && !String(resource.emailId || '').toLowerCase().includes(filters.emailId.toLowerCase())) return false;

    if (filters.piwRole.length > 0) {
      const piwRole = String(resource.piwRole || '').toLowerCase();
      if (!filters.piwRole.some((value) => piwRole.includes(value.toLowerCase()))) return false;
    }

    if (filters.roleOrDomain.length > 0) {
      const roleOrDomain = String(resource.roleOrDomain || '').toLowerCase();
      if (!filters.roleOrDomain.some((value) => roleOrDomain.includes(value.toLowerCase()))) return false;
    }

    if (filters.allocationStatus) {
      const allocationStatus = String(resource.allocationStatus || '').toLowerCase();
      if (!allocationStatus.includes(filters.allocationStatus.toLowerCase())) return false;
    }

    if (filters.allocationPct) {
      const pct = resource.allocationPercentage ?? 0;
      if (filters.allocationPct === '100' && pct < 100) return false;
      if (filters.allocationPct === '75' && pct < 75) return false;
      if (filters.allocationPct === '50-74' && (pct < 50 || pct >= 75)) return false;
      if (filters.allocationPct === '<50' && pct >= 50) return false;
      if (filters.allocationPct === '<100' && pct >= 100) return false;
    }

    if (filters.activeState) {
      const resourceStatus = resource.isActive === false ? 'inactive' : 'active';
      if (resourceStatus !== filters.activeState.toLowerCase()) return false;
    }

    const totalWorkex = parseFloat(String(resource.totalWorkex || '0').replace(/[^\d.-]/g, ''));
    if (!Number.isNaN(totalWorkex) && (totalWorkex < filters.workexRange[0] || totalWorkex > filters.workexRange[1])) {
      return false;
    }

    if (filters.skills.length > 0) {
      const skills = String(resource.skills || '').toLowerCase();
      if (!filters.skills.some((value) => skills.includes(value.toLowerCase()))) return false;
    }

    if (filters.engagement) {
      const engagement = String(resource.engagement || '').toLowerCase();
      if (!engagement.includes(filters.engagement.toLowerCase())) return false;
    }

    if (filters.beelineId && (resource.beelineId || '') !== filters.beelineId) return false;
    return true;
  }), [filters, globalSearch, resources]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setGlobalSearch('');
  }, []);

  const handleClearAll = useCallback(async () => {
    if (!canDelete) {
      message.error('You do not have permission to delete resources.');
      return;
    }

    await resourceApi.clearAll();
    setResources([]);
    dispatch(setResourcesFromServer(false));
    message.success('All resource data cleared');
  }, [canDelete, dispatch, setResources]);

  const handleClearAllAudit = useCallback(async () => {
    const ok = await clearModuleArtifact('resources', 'audit', 'ResourceHub');
    message[ok ? 'success' : 'error'](ok ? 'All resource audit history deleted' : 'Failed to delete audit history');
  }, []);

  const handleClearAllComments = useCallback(async () => {
    const ok = await clearModuleArtifact('resources', 'comments', 'ResourceHub');
    message[ok ? 'success' : 'error'](ok ? 'All resource comments deleted' : 'Failed to delete comments');
  }, []);

  const handleExportExcel = useCallback(() => {
    const data = getFilteredResources();
    if (!data.length) {
      message.warning('No data to export');
      return;
    }

    const aoa: any[][] = [[
      'S.NO', 'RA ID', 'Employee Name', 'Email', 'PIW Role', 'Role/Domain', 'Previous Workex', 'DOJ',
      'Total Workex', 'Current Engagement', 'Eng. Start Date', 'Eng. End Date', 'Allocation Status',
      'Alloc %', 'Skills', 'Beeline ID', 'Linked SOW',
    ]];

    data.forEach((resource) => {
      aoa.push([
        resource.sno,
        resource.raId,
        resource.empName,
        resource.emailId,
        resource.piwRole,
        resource.roleOrDomain,
        resource.previousWorkex,
        resource.doj,
        resource.totalWorkex,
        resource.engagement || '',
        resource.engagementStartDate || '',
        resource.engagementEndDate || '',
        resource.allocationStatus || '',
        resource.allocationPercentage != null ? `${resource.allocationPercentage}%` : '',
        resource.skills,
        resource.beelineId || '',
        resource.sowName || '',
      ]);
    });

    const worksheet = buildStyledWorksheetFromAoa(XLSXStyle, aoa, [6, 10, 28, 30, 18, 18, 14, 14, 14, 18, 14, 14, 18, 36, 18, 30]);
    const workbook = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(workbook, worksheet, 'Resources');
    XLSXStyle.writeFile(workbook, `Resources_Export_${getCurrentDateStamp()}.xlsx`);
    message.success('Export downloaded');
  }, [getFilteredResources]);

  const handleExportBeelineMapping = useCallback(() => {
    const linkedResources = resources.filter((resource) => resource.beelineId);
    if (!linkedResources.length) {
      message.warning('No Beeline-Resource links to export');
      return;
    }

    const aoa: any[][] = [[
      'Beeline ID', 'RA ID', 'Employee Name', 'Email', 'PIW Role', 'Role/Domain', 'Engagement', 'Allocation Status', 'Skills',
    ]];

    [...linkedResources].sort((a, b) => (a.beelineId || '').localeCompare(b.beelineId || '')).forEach((resource) => {
      aoa.push([
        resource.beelineId,
        resource.raId,
        resource.empName,
        resource.emailId,
        resource.piwRole,
        resource.roleOrDomain,
        resource.engagement || '',
        resource.allocationStatus || '',
        resource.skills,
      ]);
    });

    const worksheet = buildStyledWorksheetFromAoa(XLSXStyle, aoa, [16, 10, 26, 28, 18, 18, 18, 18, 30]);
    const workbook = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(workbook, worksheet, 'Beeline Resource Mapping');
    XLSXStyle.writeFile(workbook, `Beeline_Resource_Mapping_${getCurrentDateStamp()}.xlsx`);
    message.success('Beeline-Resource mapping downloaded');
  }, [resources]);

  const getUniqueValues = useCallback((key: keyof ResourceRow): string[] => {
    const values = new Set<string>();
    resources.forEach((resource) => {
      if (resource?.[key]) {
        const value = String(resource[key]);
        if (value.trim()) values.add(value);
      }
    });
    return Array.from(values).sort();
  }, [resources]);

  const raIdOptions = useMemo<SelectOption[]>(() => getUniqueValues('raId').map((value) => ({ value, label: value })), [getUniqueValues]);
  const piwRoleOptions = useMemo<SelectOption[]>(() => getUniqueValues('piwRole').map((value) => ({ value, label: value })), [getUniqueValues]);
  const roleOrDomainOptions = useMemo<SelectOption[]>(() => getUniqueValues('roleOrDomain').map((value) => ({ value, label: value })), [getUniqueValues]);
  const skillOptions = useMemo<SelectOption[]>(() => {
    const values = new Set<string>();
    resources.forEach((resource) => {
      if (resource.skills) {
        resource.skills.split(',').forEach((skill) => {
          const trimmed = skill.trim();
          if (trimmed) values.add(trimmed);
        });
      }
    });
    return Array.from(values).sort().map((value) => ({ value, label: value }));
  }, [resources]);
  const resourceStatusOptions = useMemo<SelectOption[]>(() => ([
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ]), []);
  const beelineIdOptions = useMemo<SelectOption[]>(() => (
    Array.from(new Set(resources.map((resource) => resource.beelineId).filter(Boolean))).sort().map((value) => ({ value: value!, label: value! }))
  ), [resources]);

  const filteredResources = useMemo(() => getFilteredResources(), [getFilteredResources]);
  const filteredCount = filteredResources.length;

  const filterPanel = showFilterPanel ? (
    <SharedResourceFilterPanel
      panelRef={filterPanelRef}
      onClearAll={handleClearFilters}
      resourceNameLabel="Employee Name"
      resourceNameValue={filters.empName}
      onResourceNameChange={(value) => updateFilters({ empName: value })}
      onResourceNameKeyDown={closeFilterOnEnter}
      raidValue={filters.raId}
      onRaidChange={(value) => updateFilters({ raId: value })}
      raidOptions={raIdOptions}
      showPiwRole
      piwRoleValue={filters.piwRole}
      onPiwRoleChange={(value) => updateFilters({ piwRole: value })}
      piwRoleOptions={piwRoleOptions}
      roleOrDomainLabel="Role/Domain"
      roleOrDomainValue={filters.roleOrDomain}
      onRoleOrDomainChange={(value) => updateFilters({ roleOrDomain: value })}
      roleOrDomainOptions={roleOrDomainOptions}
      skillsValue={filters.skills}
      onSkillsChange={(value) => updateFilters({ skills: value })}
      skillOptions={skillOptions}
      engagementLabel="Current Engagement"
      engagementValue={filters.engagement}
      onEngagementChange={(value) => updateFilters({ engagement: value })}
      engagementOptions={engagementOptions}
      showAllocationStatus
      allocationStatusValue={filters.allocationStatus}
      onAllocationStatusChange={(value) => updateFilters({ allocationStatus: value })}
      allocationStatusOptions={allocationStatusOptions}
      showAllocationPct
      allocationPctValue={filters.allocationPct}
      onAllocationPctChange={(value) => updateFilters({ allocationPct: value })}
      showResourceStatus
      resourceStatusValue={filters.activeState}
      onResourceStatusChange={(value) => updateFilters({ activeState: value })}
      resourceStatusOptions={resourceStatusOptions}
      beelineValue={filters.beelineId}
      onBeelineChange={(value) => updateFilters({ beelineId: value })}
      beelineOptions={beelineIdOptions}
      showWorkexRange
      workexRange={filters.workexRange}
      onWorkexRangeChange={(value) => updateFilters({ workexRange: value })}
      workexMax={70}
    />
  ) : null;

  const handleSelectResource = useCallback((resource: ResourceRow) => {
    setSelectedResource(resource);
    setDetailDrawer(true);
  }, []);

  const resourceContent = resources.length === 0 ? (
    <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: 60, textAlign: 'center' }}>
      {loading ? <Spin tip="Loading from database..." /> : <span style={{ color: 'rgba(0,0,0,0.45)' }}>No resources yet. Upload a file or add a new employee to get started.</span>}
    </div>
  ) : viewMode === 'table' ? (
    <ResourceTable
      filteredResources={filteredResources}
      visibleColumns={visibleColumns}
      canEdit={canEdit}
      canDelete={canDelete}
      filterPanel={filterPanel}
      onEdit={handleEdit}
      onToggleActive={handleToggleActive}
      onSelectResource={handleSelectResource}
    />
  ) : (
    <ResourceCardView
      filteredResources={filteredResources}
      canEdit={canEdit}
      canDelete={canDelete}
      filterPanel={filterPanel}
      onSelectResource={handleSelectResource}
      onEdit={handleEdit}
      onOpenBeelineLinkModal={openBeelineLink}
      onToggleActive={handleToggleActive}
      onNavigateToRequest={onNavigateToRequest}
    />
  );

  const handleDetailEdit = useCallback((resource: ResourceRow) => {
    handleEdit(resource);
    closeDetailDrawer();
  }, [closeDetailDrawer, handleEdit]);

  const handleNavigateToRequestFromDetail = useCallback((beelineId: string) => {
    onNavigateToRequest?.(beelineId);
    closeDetailDrawer();
  }, [closeDetailDrawer, onNavigateToRequest]);

  const handleNavigateToInsightsFromDetail = useCallback(() => {
    closeDetailDrawer();
    onNavigateToInsights?.();
  }, [closeDetailDrawer, onNavigateToInsights]);

  const handleNavigateToProcessFromDetail = useCallback((sowName: string) => {
    closeDetailDrawer();
    onNavigateToProcess?.(sowName);
  }, [closeDetailDrawer, onNavigateToProcess]);

  return {
    resources,
    fromServer,
    currentUser,
    canEdit,
    canDelete,
    activeTab,
    setActiveTab,
    filteredCount,
    globalSearch,
    setGlobalSearch,
    isFilterApplied,
    viewMode,
    setViewMode,
    showFilterPanel,
    setShowFilterPanel,
    handleClearFilters,
    setColumnDrawer,
    handleExportExcel,
    handleAddNew,
    downloadTemplate,
    handleUpload,
    handleExportBeelineMapping,
    handleClearAll,
    handleClearAllAudit,
    handleClearAllComments,
    resourceContent,
    editDrawer,
    editingResource,
    form,
    engagementOptions,
    closeEditDrawer,
    handleSaveEdit,
    detailDrawer,
    selectedResource,
    detailExpanded,
    setDetailExpanded,
    closeDetailDrawer,
    handleDetailEdit,
    handleToggleActive,
    handleNavigateToRequestFromDetail,
    handleNavigateToInsightsFromDetail,
    handleNavigateToProcessFromDetail,
    columnDrawer,
    visibleColumns,
    setVisibleColumns,
    beelineLinkModal,
    selectedBeelineId,
    savingBeeline,
    beelineRequestOptions,
    setSelectedBeelineId,
    setBeelineLinkModal,
    handleSaveBeelineLink,
    bulkUploadResult,
    setBulkUploadResult,
  };
}

export type UseResourceHubStateResult = ReturnType<typeof useResourceHubState>;
