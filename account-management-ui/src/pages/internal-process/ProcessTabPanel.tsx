import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Drawer, Dropdown, Form, Input, Modal, Select, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CheckOutlined, ClearOutlined, ColumnHeightOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EllipsisOutlined, ExpandAltOutlined, FileExcelOutlined, FilterOutlined, IdcardOutlined, LinkOutlined, MoreOutlined, NodeIndexOutlined, PlusOutlined, ShrinkOutlined, StopOutlined, TableOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import ProcessDetailPanel from '../../components/ProcessDetailPanel';
import * as processApi from '../../api/processApi';
import * as resourceApi from '../../api/resourceApi';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { useUserPreferences } from '../../context/UserPreferencesContext';
import { clearModuleArtifact } from '../../utils/moduleCleanupApi';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setResources as setResourcesAction, setResourcesFromServer } from '../../store/resourcesSlice';
import { writeJsonSheetFile } from '../../utils/xlsxExport';
import { mapResourceApiRowToPayload, mapResourceApiRowToResourceRow } from '../resource/resourceRowMappers';
import { mapProcessApiRow, resequenceRows, toProcessBulkSavePayload, toProcessExportRows } from './processRowMappers';
import { AllocateOwnerModal } from './AllocateOwnerModal';
import { LinkResourcesModal } from './LinkResourcesModal';
import { PipelineCard } from './PipelineCard';
import { ProcessFilterPanel } from './ProcessFilterPanel';
import { ACTIVE_OPTIONS, COL_KEYS, dateSortKey, deriveStatus, downloadFile, downloadTemplate, formatExcelDate, recencySortKey, SIGNED_SOW_OPTIONS, STATUS_COLORS, toInputDate } from './shared';
import type { ProcRes, ProcessRow, ProcessTabPanelProps } from './types';

const { Text } = Typography;

export function ProcessTabPanel({ rows, setRows, setFromServer, resourceRefreshKey = 0, initialSow, initialFilters, resetFiltersSignal = 0 }: ProcessTabPanelProps) {
  const { configs } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const dispatch = useAppDispatch();
  const reduxResources = useAppSelector(state => state.resources.items);
  const resourcesLoaded = useAppSelector(state => state.resources.loaded);
  const canEdit = hasPermission('clientmgmt_connects', 'edit');
  const canDelete = hasPermission('clientmgmt_connects', 'delete');
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({
    ...(initialSow ? { sow: initialSow } : {}),
    ...(initialFilters || {}),
  });
  const [editModal, setEditModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ProcessRow | null>(null);
  const initialDetailRow = initialSow ? (rows.find(row => row.sow === initialSow) || null) : null;
  const [detailRow, setDetailRow] = useState<ProcessRow | null>(initialDetailRow);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showAll] = useState(false);
  const [allocateModal, setAllocateModal] = useState(false);
  const [allocateAnchor, setAllocateAnchor] = useState('');
  const [allocateSelected, setAllocateSelected] = useState<string[]>([]);
  const [allocateSingleRow, setAllocateSingleRow] = useState<ProcessRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(15);
  const [form] = Form.useForm();
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const mapProcRes = (row: any): ProcRes => {
    const normalized = mapResourceApiRowToPayload(row);
    return {
      id: Number(normalized.id ?? row.id ?? 0),
      raId: normalized.raId,
      empName: normalized.empName,
      piwRole: normalized.piwRole,
      processId: normalized.processId ?? null,
      engagementStartDate: normalized.engagementStartDate || '',
      engagementEndDate: normalized.engagementEndDate || '',
    };
  };

  const allProcResources = useMemo<ProcRes[]>(() => reduxResources.map(mapProcRes), [reduxResources]);
  const [linkModal, setLinkModal] = useState<{ open: boolean; row: ProcessRow | null }>({ open: false, row: null });
  const [linkChecked, setLinkChecked] = useState<Set<number>>(new Set());
  const [linkSearch, setLinkSearch] = useState('');
  const [loadingLink, setLoadingLink] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [linkDates, setLinkDates] = useState<Record<number, { startDate: string; endDate: string }>>({});

  const linkedCountMap = useMemo(() => {
    const map: Record<number, number> = {};
    allProcResources.forEach(resource => {
      if (resource.processId) map[resource.processId] = (map[resource.processId] || 0) + 1;
    });
    return map;
  }, [allProcResources]);

  const [visibleColumns, setVisibleColumnsState] = useState<Record<string, boolean>>(Object.fromEntries(COL_KEYS.map(col => [col.key, true])));

  useEffect(() => {
    if (!preferencesLoaded) return;
    const visibility = getColumnVisibility('process');
    setVisibleColumnsState(prev => ({ ...prev, ...visibility }));
  }, [preferencesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleColumns = (newVisibility: Record<string, boolean>) => {
    setVisibleColumnsState(newVisibility);
    saveColumnVisibility('process', newVisibility);
  };

  const isFilterApplied = Object.values(filters).some(Boolean);

  useEffect(() => {
    if (!initialFilters || Object.keys(initialFilters).length === 0) return;
    setFilters(prev => ({ ...prev, ...initialFilters }));
    setShowFilterPanel(true);
  }, [initialFilters]);

  useEffect(() => {
    if (resetFiltersSignal <= 0) return;
    setFilters({});
    setShowFilterPanel(false);
  }, [resetFiltersSignal]);

  useEffect(() => {
    if (!showFilterPanel) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        if (!target.closest('.ant-select-dropdown, .ant-dropdown')) setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterPanel]);

  const loadProcResources = () => {
    if (resourcesLoaded) return;
    resourceApi.getResources().then(({ resources: raw, fromServer: online }) => {
      if (online) {
        const mapped = raw.map((row: any, index: number) => mapResourceApiRowToResourceRow(row, index));
        dispatch(setResourcesAction(mapped));
        dispatch(setResourcesFromServer(true));
      }
    });
  };

  useEffect(() => { loadProcResources(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (resourceRefreshKey > 0) {
      resourceApi.getResources().then(({ resources: raw, fromServer: online }) => {
        if (online) {
          dispatch(setResourcesAction(raw.map((row: any, index: number) => mapResourceApiRowToResourceRow(row, index))));
          dispatch(setResourcesFromServer(true));
        }
      });
    }
  }, [resourceRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLinkModal = async (row: ProcessRow) => {
    if (row.active !== 'Yes') {
      message.warning('Cannot link resources to an inactive process. Activate it first.');
      return;
    }
    setLinkModal({ open: true, row });
    setLoadingLink(true);
    setLinkChecked(new Set());
    setLinkSearch('');
    setLinkDates({});
    const { resources: raw, fromServer: online } = await resourceApi.getResources();
    if (online) {
      dispatch(setResourcesAction(raw.map((resource: any, index: number) => mapResourceApiRowToResourceRow(resource, index))));
      dispatch(setResourcesFromServer(true));
    }
    const mapped = raw.map(mapProcRes);
    const initialChecked = new Set(mapped.filter(resource => resource.processId === row.id && resource.id != null).map(resource => resource.id));
    setLinkChecked(initialChecked);
    const initialDates: Record<number, { startDate: string; endDate: string }> = {};
    mapped.filter(resource => resource.processId === row.id).forEach(resource => {
      initialDates[resource.id] = {
        startDate: toInputDate(resource.engagementStartDate || ''),
        endDate: toInputDate(resource.engagementEndDate || ''),
      };
    });
    setLinkDates(initialDates);
    setLoadingLink(false);
  };

  const handleSaveLinks = async () => {
    if (!linkModal.row?.id) return;
    const processId = linkModal.row.id;
    setSavingLink(true);
    const prevLinked = new Set<number>(allProcResources.filter(resource => resource.processId === processId).map(resource => resource.id));
    const toLink = [...linkChecked].filter(id => !prevLinked.has(id));
    const toUnlink = [...prevLinked].filter(id => !linkChecked.has(id));
    await Promise.all([
      ...toLink.map(id => resourceApi.setProcessLink(id, processId, currentUser?.username || 'system')),
      ...toUnlink.map(id => resourceApi.setProcessLink(id, null, currentUser?.username || 'system')),
    ]);
    await Promise.all(
      [...linkChecked].map(id => {
        const dates = linkDates[id];
        if (dates !== undefined) {
          return resourceApi.updateResource(id, {
            engagementStartDate: dates.startDate,
            engagementEndDate: dates.endDate,
            changedBy: currentUser?.username || 'system',
          });
        }
        return Promise.resolve();
      }),
    );
    const { resources: raw, fromServer: online } = await resourceApi.getResources();
    if (online) {
      dispatch(setResourcesAction(raw.map((resource: any, index: number) => mapResourceApiRowToResourceRow(resource, index))));
    }
    setSavingLink(false);
    message.success('Resource links updated');
    setLinkModal({ open: false, row: null });
    setLinkDates({});
  };

  const handleUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!worksheet) { message.error('No sheet found'); return false; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      if (!json.length) { message.warning('Sheet is empty'); return false; }

      const uploaded: ProcessRow[] = json
        .filter(row => String(row.SOW || '').trim())
        .map((row, index) => ({
          key: `pr_${Date.now()}_${index}`,
          sno: index + 1,
          startDate: formatExcelDate(row['Start Date']),
          sow: String(row.SOW || '').trim(),
          signedSow: String(row['Signed SOW'] || '').trim(),
          piw: String(row.PIW || '').trim(),
          active: String(row.Active || '').trim(),
          salesforceId: String(row['Salesforce ID'] || '').trim(),
          promsId: String(row['PROMS ID'] || '').trim(),
          budget: String(row.Budget || '').trim(),
          openAirCode: String(row['Open Air Code'] || '').trim(),
          eprev: String(row.Eprev || '').trim(),
          comments: String(row.Comments || '').trim(),
        })).map(row => ({ ...row, startDate: row.startDate ? row.startDate : '' }));

      if (!uploaded.length) { message.warning('No valid rows with SOW found'); return false; }

      const existingMap = new Map(rows.map(row => [row.sow.toLowerCase(), row]));
      let newCount = 0;
      let updCount = 0;
      uploaded.forEach(uploadedRow => {
        const key = uploadedRow.sow.toLowerCase();
        if (existingMap.has(key)) {
          existingMap.set(key, { ...existingMap.get(key)!, ...uploadedRow, id: existingMap.get(key)!.id });
          updCount++;
        } else {
          existingMap.set(key, uploadedRow);
          newCount++;
        }
      });
      const mergedRows = resequenceRows(Array.from(existingMap.values()));

      setRows(mergedRows);
      setHasUnsaved(true);

      setIsSaving(true);
      processApi.resetServerCache();
      try {
        const result = await processApi.bulkSave(toProcessBulkSavePayload(mergedRows));
        if (result.ok) {
          setHasUnsaved(false);
          setFromServer?.(true);
          message.success(`Saved to database: ${newCount} new, ${updCount} updated`);
        } else {
          message.warning(`Parsed ${newCount + updCount} rows but database save failed — data shown locally only. Use "Save to Database" to retry.`);
        }
      } catch (saveError: any) {
        message.error(`Data loaded locally but DB save failed: ${saveError.message || 'Unknown error'}. Use "Save to Database" to retry.`);
      } finally {
        setIsSaving(false);
      }
    } catch (error: any) {
      message.error(error.message || 'Upload failed');
    }
    return false;
  };

  const handleManualSave = async () => {
    if (!rows.length) return;
    setIsSaving(true);
    processApi.resetServerCache();
    try {
      const result = await processApi.bulkSave(toProcessBulkSavePayload(rows));
      if (result.ok) {
        setHasUnsaved(false);
        setFromServer?.(true);
        message.success(`Saved to database: ${result.inserted} new, ${result.updated} updated`);
      } else {
        message.error('Database save failed. Please check the server connection.');
      }
    } catch (error: any) {
      message.error(`Save failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const exportRows = () => {
    if (!rows.length) { message.warning('No data to export'); return; }
    const data = toProcessExportRows(rows, deriveStatus);
    writeJsonSheetFile(XLSX, data, 'Process', 'RA_Process_Data.xlsx');
  };

  const openAdd = () => { setEditingRow(null); form.resetFields(); setEditModal(true); };
  const openEdit = (row: ProcessRow) => { setEditingRow(row); form.setFieldsValue({ ...row, newComment: undefined }); setEditModal(true); };
  const openEditFromPanel = (row: ProcessRow) => { setDetailRow(null); setPanelExpanded(false); setEditingRow(row); form.setFieldsValue({ ...row, newComment: undefined }); setEditModal(true); };
  const openView = (row: ProcessRow) => { setDetailRow(row); setPanelExpanded(false); };
  const handleDelete = (row: ProcessRow) => {
    setRows(prev => resequenceRows(prev.filter(item => item.key !== row.key)));
    if (row.id) processApi.deleteProcess(row.id, currentUser?.username);
  };

  const handleToggleActive = async (row: ProcessRow) => {
    if (!row.id) return;
    const newIsActive = row.active !== 'Yes';
    const result = await processApi.setActiveStatus(row.id, newIsActive, currentUser?.username);
    if (!result.ok) { message.error(result.error || 'Failed to update status'); return; }
    const newValue = newIsActive ? 'Yes' : 'No';
    const nowIso = new Date().toISOString();
    setRows(prev => prev.map(item => item.key === row.key ? { ...item, active: newValue, updatedAt: nowIso } : item));
    if (detailRow && detailRow.key === row.key) setDetailRow(prev => prev ? { ...prev, active: newValue, updatedAt: nowIso } : prev);
    message.success(`Marked as ${newIsActive ? 'Active' : 'Inactive'}`);
  };

  const handleSave = () => {
    form.validateFields().then(async values => {
      if (editingRow?.id && editingRow.active === 'Yes' && values.active !== 'Yes') {
        const count = linkedCountMap[editingRow.id] || 0;
        if (count > 0) {
          message.error(`Cannot deactivate — ${count} resource(s) are still linked to this process. Remove resource links first.`);
          return;
        }
      }

      const newSow = (values.sow || '').trim();
      const newPiw = (values.piw || '').trim();

      if (newSow) {
        const duplicate = rows.find(row => row.sow.toLowerCase() === newSow.toLowerCase() && row.key !== editingRow?.key);
        if (duplicate) {
          message.error(`SOW name "${newSow}" already exists. Please use a unique SOW name.`);
          return;
        }
      }
      if (newPiw) {
        const duplicate = rows.find(row => row.piw.toLowerCase() === newPiw.toLowerCase() && row.key !== editingRow?.key);
        if (duplicate) {
          message.error(`PIW name "${newPiw}" already exists (on SOW: ${duplicate.sow}). Please use a unique PIW name.`);
          return;
        }
      }

      const commentText: string = (values.newComment || '').trim();
      const { newComment: _newComment, ...rowValues } = values;
      if (editingRow) {
        const updatedRow = { ...editingRow, ...rowValues, updatedAt: new Date().toISOString() };
        setRows(prev => prev.map(row => row.key === editingRow.key ? updatedRow : row));
        if (detailRow && detailRow.key === editingRow.key) setDetailRow(updatedRow);
        if (editingRow.id) {
          try {
            const normalizedNext = {
              sow: rowValues.sow || '',
              startDate: rowValues.startDate || '',
              signedSow: rowValues.signedSow || '',
              piw: rowValues.piw || '',
              active: rowValues.active || '',
              salesforceId: rowValues.salesforceId || '',
              promsId: rowValues.promsId || '',
              budget: rowValues.budget || '',
              openAirCode: rowValues.openAirCode || '',
              eprev: rowValues.eprev || '',
              comments: rowValues.comments || '',
              accountAnchor: rowValues.accountAnchor || '',
            } as const;
            const changedPayload: Partial<processApi.ProcessPayload> = {};
            (Object.keys(normalizedNext) as Array<keyof typeof normalizedNext>).forEach(key => {
              if (String(editingRow[key] || '') !== String(normalizedNext[key] || '')) {
                (changedPayload as Record<string, string>)[key] = normalizedNext[key];
              }
            });
            await processApi.updateProcess(editingRow.id, {
              ...changedPayload,
              changedBy: currentUser?.username,
            });
            const { rows: latestRows, fromServer: fs } = await processApi.getProcessRows();
            if (fs && latestRows.length > 0) {
              const latestMapped = latestRows.map(mapProcessApiRow);
              const latestRecord = latestMapped.find(row => row.id === editingRow.id);
              if (latestRecord) {
                setRows(prev => prev.map(row => row.id === editingRow.id ? { ...row, ...latestRecord, key: row.key, sno: row.sno } : row));
                if (detailRow && detailRow.id === editingRow.id) {
                  setDetailRow(prev => (prev ? { ...prev, ...latestRecord, key: prev.key, sno: prev.sno } : prev));
                }
              }
            }
          } catch (error: any) {
            setRows(prev => prev.map(row => row.key === editingRow.key ? editingRow : row));
            if (detailRow && detailRow.key === editingRow.key) setDetailRow(editingRow);
            message.error(error.message || 'Save failed');
            return;
          }
          if (commentText) {
            await processApi.addComment(editingRow.id, { author: currentUser?.username || 'Unknown', body: commentText });
          }
        }
      } else {
        const tempKey = `pr_${Date.now()}`;
        const nowIso = new Date().toISOString();
        setRows(prev => [...prev, {
          key: tempKey,
          sno: prev.length + 1,
          startDate: '',
          signedSow: '',
          piw: '',
          active: '',
          salesforceId: '',
          promsId: '',
          budget: '',
          openAirCode: '',
          eprev: '',
          comments: '',
          sow: '',
          ...rowValues,
          createdAt: nowIso,
          updatedAt: nowIso,
        }]);
        processApi.createProcess({
          sow: rowValues.sow || '',
          sno: 0,
          startDate: rowValues.startDate || '',
          signedSow: rowValues.signedSow || '',
          piw: rowValues.piw || '',
          active: rowValues.active || '',
          salesforceId: rowValues.salesforceId || '',
          promsId: rowValues.promsId || '',
          budget: rowValues.budget || '',
          openAirCode: rowValues.openAirCode || '',
          eprev: rowValues.eprev || '',
          comments: rowValues.comments || '',
          accountAnchor: rowValues.accountAnchor || '',
          changedBy: currentUser?.username,
        }).then(result => {
          if (result.ok && result.id) {
            setRows(prev => prev.map(row => row.key === tempKey ? { ...row, id: result.id } : row));
            setFromServer?.(true);
          }
        });
      }
      setEditModal(false);
      setDetailRow(null);
      form.resetFields();
    });
  };

  const displayed = useMemo(() => [...rows]
    .sort((a, b) => recencySortKey(b) - recencySortKey(a))
    .filter(row => {
      if (filters.sow && !row.sow.toLowerCase().includes(filters.sow.toLowerCase())) return false;
      if (filters.piw && !row.piw.toLowerCase().includes(filters.piw.toLowerCase())) return false;
      if (filters.status && deriveStatus(row) !== filters.status) return false;
      if (filters.active && row.active !== filters.active) return false;
      if (filters.accountAnchor === '__UNASSIGNED__' && (row.accountAnchor || '').trim()) return false;
      if (filters.accountAnchor && filters.accountAnchor !== '__UNASSIGNED__' && (row.accountAnchor || '') !== filters.accountAnchor) return false;
      if (filters.accountAnchorPresent === 'Yes' && !(row.accountAnchor || '').trim()) return false;
      if (filters.startDateFrom && dateSortKey(row.startDate || '') < dateSortKey(filters.startDateFrom || '')) return false;
      if (filters.startDateTo && dateSortKey(row.startDate || '') > dateSortKey(filters.startDateTo || '')) return false;
      if (filters.resourceName && row.id) {
        const linked = allProcResources.filter(resource => resource.processId === row.id);
        if (!linked.some(resource => resource.empName.toLowerCase().includes(filters.resourceName!.toLowerCase()))) return false;
      }
      return true;
    }), [rows, filters, allProcResources]);

  const pipelineRows = useMemo(() => displayed, [displayed]);

  const anchorOptions = useMemo(() => {
    const linkedConfigs = configs.filter(config => (config.linkedTo ?? []).includes('ra_process_account_anchor_field'));
    if (linkedConfigs.length > 0) {
      const topLinked = linkedConfigs[0];
      return (topLinked.items || []).map(item => ({ label: item.label, value: item.label }));
    }
    const existing = Array.from(new Set(rows.map(row => row.accountAnchor).filter(Boolean))) as string[];
    return existing.map(anchor => ({ label: anchor, value: anchor }));
  }, [configs, rows]);

  const unassignedRows = useMemo(() => rows.filter(row => !row.accountAnchor), [rows]);

  const handleAllocateSave = () => {
    if (!allocateAnchor) { message.warning('Select an owner'); return; }
    if (allocateSingleRow) {
      const nowIso = new Date().toISOString();
      setRows(prev => prev.map(row => row.key === allocateSingleRow.key ? { ...row, accountAnchor: allocateAnchor, updatedAt: nowIso } : row));
      if (allocateSingleRow.id) processApi.updateProcess(allocateSingleRow.id, { accountAnchor: allocateAnchor, changedBy: currentUser?.username });
      message.success(`Anchor assigned to ${allocateSingleRow.sow || 'record'}`);
    } else {
      if (!allocateSelected.length) { message.warning('Select at least one process entry'); return; }
      const nowIso = new Date().toISOString();
      setRows(prev => prev.map(row => allocateSelected.includes(row.key) ? { ...row, accountAnchor: allocateAnchor, updatedAt: nowIso } : row));
      const toUpdate = rows.filter(row => allocateSelected.includes(row.key) && row.id);
      toUpdate.forEach(row => processApi.updateProcess(row.id!, { accountAnchor: allocateAnchor, changedBy: currentUser?.username }));
      message.success(`${allocateSelected.length} record(s) assigned to ${allocateAnchor}`);
    }
    setAllocateModal(false);
    setAllocateAnchor('');
    setAllocateSelected([]);
    setAllocateSingleRow(null);
  };

  const clearFilters = () => { setFilters({}); };

  const handleClearAll = () => {
    processApi.clearAll(currentUser?.username);
    setRows([]);
    setFromServer?.(false);
    message.success('All process records deleted');
  };

  const handleClearAllAudit = async () => {
    const ok = await clearModuleArtifact('process', 'audit', 'InternalProcess');
    if (ok) message.success('All process audit history deleted');
    else message.error('Failed to delete audit history');
  };

  const handleClearAllComments = async () => {
    const ok = await clearModuleArtifact('process', 'comments', 'InternalProcess');
    if (ok) message.success('All process comments deleted');
    else message.error('Failed to delete comments');
  };

  const hStyle = { fontSize: '11px', fontWeight: 700 as const };
  const cStyle = { fontSize: '11px' };

  const tableCols = [
    { title: 'ID', dataIndex: 'processId', key: 'processId', width: 52, onHeaderCell: () => ({ style: hStyle }), render: (value: string) => value ? <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>{value}</Tag> : null },
    visibleColumns.sno && { title: 'S.No.', key: 'sno', width: 55, onHeaderCell: () => ({ style: hStyle }), render: (_: unknown, __: ProcessRow, index: number) => <span style={cStyle}>{((tablePage - 1) * tablePageSize) + index + 1}</span> },
    visibleColumns.startDate && { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', width: 90, sorter: (a: ProcessRow, b: ProcessRow) => dateSortKey(a.startDate || '') - dateSortKey(b.startDate || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={cStyle}>{value}</span> },
    visibleColumns.sow && { title: 'SOW', dataIndex: 'sow', key: 'sow', width: 240, sorter: (a: ProcessRow, b: ProcessRow) => (a.sow || '').localeCompare(b.sow || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string, row: ProcessRow) => row.sowFile ? <Tooltip title="Click to download SOW document" overlayInnerStyle={{ fontSize: '11px' }}><a style={{ ...cStyle, fontWeight: 600, color: '#1890ff', cursor: 'pointer' }} onClick={() => downloadFile(row.sowFile!)}><DownloadOutlined style={{ marginRight: 4, fontSize: '11px' }} />{value}</a></Tooltip> : <span style={{ ...cStyle, fontWeight: 600 }}>{value}</span> },
    visibleColumns.signedSow && { title: 'Signed SOW', dataIndex: 'signedSow', key: 'signedSow', width: 95, sorter: (a: ProcessRow, b: ProcessRow) => (a.signedSow || '').localeCompare(b.signedSow || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => value ? <Tag color={value === 'Yes' ? 'green' : 'orange'} style={{ fontSize: '10px' }}>{value}</Tag> : null },
    visibleColumns.piw && { title: 'PIW', dataIndex: 'piw', key: 'piw', width: 220, sorter: (a: ProcessRow, b: ProcessRow) => (a.piw || '').localeCompare(b.piw || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={cStyle}>{value}</span> },
    visibleColumns.active && { title: 'Active', dataIndex: 'active', key: 'active', width: 70, sorter: (a: ProcessRow, b: ProcessRow) => (a.active || '').localeCompare(b.active || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => value ? <Tag color={value === 'Yes' ? 'green' : 'default'} style={{ fontSize: '10px' }}>{value}</Tag> : null },
    visibleColumns.salesforceId && { title: 'Salesforce ID', dataIndex: 'salesforceId', key: 'salesforceId', width: 130, sorter: (a: ProcessRow, b: ProcessRow) => (a.salesforceId || '').localeCompare(b.salesforceId || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={{ ...cStyle, color: value ? '#1890ff' : undefined }}>{value}</span> },
    visibleColumns.promsId && { title: 'PROMS ID', dataIndex: 'promsId', key: 'promsId', width: 110, sorter: (a: ProcessRow, b: ProcessRow) => (a.promsId || '').localeCompare(b.promsId || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={cStyle}>{value}</span> },
    visibleColumns.budget && { title: 'Budget', dataIndex: 'budget', key: 'budget', width: 120, sorter: (a: ProcessRow, b: ProcessRow) => (a.budget || '').localeCompare(b.budget || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={{ ...cStyle, fontWeight: value ? 600 : 400 }}>{value}</span> },
    visibleColumns.eprev && { title: 'Eprev', dataIndex: 'eprev', key: 'eprev', width: 75, sorter: (a: ProcessRow, b: ProcessRow) => (a.eprev || '').localeCompare(b.eprev || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => value ? <Tag color={value === 'Yes' ? 'success' : 'default'} style={{ fontSize: '10px' }}>{value}</Tag> : null },
    visibleColumns.openAirCode && { title: 'Open Air Code', dataIndex: 'openAirCode', key: 'openAirCode', width: 240, sorter: (a: ProcessRow, b: ProcessRow) => (a.openAirCode || '').localeCompare(b.openAirCode || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={cStyle}>{value}</span> },
    visibleColumns.comments && { title: 'Comments', dataIndex: 'comments', key: 'comments', width: 140, sorter: (a: ProcessRow, b: ProcessRow) => (a.comments || '').localeCompare(b.comments || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => <span style={cStyle}>{value}</span> },
    visibleColumns.accountAnchor && { title: 'Owner', dataIndex: 'accountAnchor', key: 'accountAnchor', width: 130, sorter: (a: ProcessRow, b: ProcessRow) => (a.accountAnchor || '').localeCompare(b.accountAnchor || ''), onHeaderCell: () => ({ style: hStyle }), render: (value: string) => value ? <Tag color="purple" style={{ fontSize: '10px' }}>{value}</Tag> : <span style={{ ...cStyle, color: '#bfbfbf' }}>Unassigned</span> },
    { title: 'Status', key: 'status', width: 110, sorter: (a: ProcessRow, b: ProcessRow) => deriveStatus(a).localeCompare(deriveStatus(b)), onHeaderCell: () => ({ style: hStyle }), render: (_: any, row: ProcessRow) => { const status = deriveStatus(row); return <Tag style={{ fontSize: '10px', background: `${STATUS_COLORS[status]}18`, color: STATUS_COLORS[status], border: `1px solid ${STATUS_COLORS[status]}44` }}>{status}</Tag>; } },
    {
      title: 'Actions', key: 'actions', width: 60, fixed: 'right' as const, onHeaderCell: () => ({ style: hStyle }),
      render: (_: any, row: ProcessRow) => (
        <Dropdown
          menu={{
            items: [
              canEdit ? { key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => { setDetailRow(null); openEdit(row); } } : null,
              canEdit ? { key: 'toggleActive', label: <span style={{ fontSize: '11px' }}>{row.active === 'Yes' ? 'Mark Inactive' : 'Mark Active'}</span>, icon: row.active === 'Yes' ? <StopOutlined style={{ fontSize: '11px', color: '#ff4d4f' }} /> : <CheckOutlined style={{ fontSize: '11px', color: '#52c41a' }} />, onClick: () => handleToggleActive(row) } : null,
              { key: 'link', label: <span style={{ fontSize: '11px' }}>Link Resources</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: () => openLinkModal(row) },
              { key: 'anchor', label: <span style={{ fontSize: '11px' }}>Assign Owner</span>, icon: <IdcardOutlined style={{ fontSize: '11px' }} />, onClick: () => { setAllocateSingleRow(row); setAllocateAnchor(row.accountAnchor || ''); setAllocateModal(true); } },
              { type: 'divider' as const },
              canDelete ? {
                key: 'delete',
                label: <span style={{ fontSize: '11px' }}>Delete</span>,
                icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                danger: true,
                onClick: () => Modal.confirm({
                  title: 'Delete this record?',
                  content: 'This action cannot be undone.',
                  okText: 'Delete',
                  okButtonProps: { danger: true, size: 'small' },
                  cancelButtonProps: { size: 'small' },
                  onOk: () => handleDelete(row),
                }),
              } : null,
            ].filter(Boolean) as any[],
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ padding: '0 4px' }} onClick={event => event.stopPropagation()} />
        </Dropdown>
      ),
    },
  ].filter(Boolean) as any[];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Showing: <strong>{displayed.length}</strong>{displayed.length !== rows.length ? ` / ${rows.length} total` : ''}
        </Text>
        <Space size={6} wrap style={{ alignItems: 'center' }}>
          {isFilterApplied && (
            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={clearFilters}>
              <ClearOutlined /> Clear Filters
            </Button>
          )}
          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(prev => !prev)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title={viewMode === 'pipeline' ? 'Switch to Table View' : 'Switch to Pipeline View'} overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={viewMode === 'pipeline' ? <TableOutlined /> : <NodeIndexOutlined />} size="small" onClick={() => setViewMode(prev => prev === 'pipeline' ? 'table' : 'pipeline')} style={{ borderRadius: 6 }} />
          </Tooltip>
          {viewMode === 'table' && (
            <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          <Dropdown trigger={['click']} menu={{ items: [
            canEdit ? { key: 'add', label: <span style={{ fontSize: '11px' }}>Add New Record</span>, icon: <PlusOutlined style={{ fontSize: '11px' }} />, onClick: openAdd } : null,
            { type: 'divider' as const },
            { key: 'dlTemplate', label: <span style={{ fontSize: '11px' }}>Download Template</span>, icon: <DownloadOutlined style={{ fontSize: '11px' }} />, onClick: downloadTemplate },
            canEdit ? { key: 'upload', label: <span style={{ fontSize: '11px' }}>Upload from Excel</span>, icon: <UploadOutlined style={{ fontSize: '11px' }} />, onClick: () => { const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls'; input.onchange = event => { const file = (event.target as HTMLInputElement).files?.[0]; if (file) handleUpload(file); }; input.click(); } } : null,
            rows.length > 0 ? { key: 'export', label: <span style={{ fontSize: '11px' }}>Export Data</span>, icon: <FileExcelOutlined style={{ fontSize: '11px', color: '#52c41a' }} />, onClick: exportRows } : null,
            canDelete && rows.length > 0 ? { type: 'divider' as const } : null,
            canDelete && rows.length > 0 ? { key: 'deleteAll', label: <span style={{ fontSize: '11px' }}>Delete All Records</span>, icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true, onClick: () => Modal.confirm({ title: 'Delete all process records?', content: 'This will permanently remove all records from the database.', okText: 'Yes, delete all', cancelText: 'Cancel', okButtonProps: { danger: true, size: 'small' }, onOk: handleClearAll }) } : null,
            canDelete ? { type: 'divider' as const } : null,
            canDelete ? { key: 'deleteAllAudit', label: <span style={{ fontSize: '11px' }}>Delete All Audit History</span>, icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true, onClick: () => Modal.confirm({ title: 'Delete all process audit history?', content: 'This will permanently remove all audit log entries and resource history for Process (including Detailed View timeline).', okText: 'Yes, delete all', cancelText: 'Cancel', okButtonProps: { danger: true, size: 'small' }, onOk: handleClearAllAudit }) } : null,
            canDelete ? { key: 'deleteAllComments', label: <span style={{ fontSize: '11px' }}>Delete All Comments</span>, icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true, onClick: () => Modal.confirm({ title: 'Delete all process comments?', content: 'This will permanently remove all comments across all process records.', okText: 'Yes, delete all', cancelText: 'Cancel', okButtonProps: { danger: true, size: 'small' }, onOk: handleClearAllComments }) } : null,
          ].filter(Boolean) as any[] }}>
            <Button icon={<MoreOutlined />} size="small" style={{ borderRadius: 6 }} />
          </Dropdown>
        </Space>
      </div>

      {hasUnsaved && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#874d00' }}>
          <span style={{ flex: 1 }}>
            ⚠️ <strong>Unsaved data</strong> — {rows.length} rows are loaded locally but not yet saved to the database.
          </span>
          <Button type="primary" size="small" loading={isSaving} style={{ borderRadius: 6, fontSize: '11px' }} onClick={handleManualSave}>
            {isSaving ? 'Saving…' : 'Save to Database'}
          </Button>
        </div>
      )}
      {isSaving && !hasUnsaved && (
        <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: '12px', color: '#0050b3', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spin size="small" /> &nbsp;Saving data to database…
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
          <NodeIndexOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No process records yet. Upload an Excel file or add a new entry.</Text>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          <ProcessFilterPanel show={showFilterPanel} filterPanelRef={filterPanelRef} filters={filters} setFilters={setFilters} clearFilters={clearFilters} anchorOptions={anchorOptions} />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {viewMode === 'table' ? (
              <div className="compact-table">
                <Table dataSource={displayed} columns={tableCols} rowKey="key" size="small" pagination={{ current: tablePage, pageSize: tablePageSize, showSizeChanger: false, onChange: (page, pageSize) => { setTablePage(page); setTablePageSize(pageSize); } }} scroll={{ x: 'max-content', y: 420 }} style={{ background: '#fff', borderRadius: 8 }} locale={{ emptyText: 'No records match your filters' }} onRow={row => ({ onClick: event => { const target = event.target as HTMLElement; if (target.closest('button, .ant-dropdown, [class*=\"ant-dropdown\"], .ant-checkbox-wrapper')) return; openView(row); }, style: { cursor: 'pointer' } })} />
              </div>
            ) : (
              <div>
                {pipelineRows.length === 0 ? (
                  <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '40px 0', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {showAll ? 'No active opportunities (Active = Yes) found.' : 'No active, not-completed opportunities found. Use the "All" toggle to show completed ones too.'}
                    </Text>
                  </div>
                ) : (
                  pipelineRows.map(row => (
                    <PipelineCard key={row.key} row={row} onEdit={() => openEdit(row)} onView={() => openView(row)} onDelete={() => handleDelete(row)} onLinkResources={() => openLinkModal(row)} onToggleActive={() => handleToggleActive(row)} onAssignAnchor={() => { setAllocateSingleRow(row); setAllocateAnchor(row.accountAnchor || ''); setAllocateModal(true); }} setDetailRow={setDetailRow} canEdit={canEdit} canDelete={canDelete} linkedCount={row.id ? linkedCountMap[row.id] || 0 : 0} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Drawer title="Column Visibility" placement="right" onClose={() => setColumnDrawer(false)} open={columnDrawer} width={260}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {COL_KEYS.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox checked={visibleColumns[key]} onChange={event => setVisibleColumns({ ...visibleColumns, [key]: event.target.checked })} />
              <label style={{ fontSize: '12px', marginBottom: 0, cursor: 'pointer' }}>{label}</label>
            </div>
          ))}
        </Space>
      </Drawer>

      <Drawer title={<span style={{ fontSize: '13px', fontWeight: 600 }}>{editingRow ? `Edit — ${editingRow.sow || 'Record'}` : 'Add New Record'}</span>} placement="right" width={600} open={editModal} onClose={() => { setEditModal(false); setDetailRow(null); form.resetFields(); }} styles={{ body: { paddingTop: 8 } }} extra={<Button type="primary" size="small" onClick={handleSave} style={{ borderRadius: 6, fontSize: '12px' }}>Save</Button>}>
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="startDate" label={<span style={{ fontSize: '11px' }}>Start Date</span>}>
              <Input placeholder="e.g. 03-Jan-26" style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="active" label={<span style={{ fontSize: '11px' }}>Active</span>}>
              <Select placeholder="Select" options={ACTIVE_OPTIONS.map(value => ({ label: value, value }))} style={{ fontSize: '12px' }} allowClear />
            </Form.Item>
          </div>
          <Form.Item name="sow" label={<span style={{ fontSize: '11px' }}>SOW</span>} rules={[{ required: true, message: 'Enter SOW' }]}>
            <Input placeholder="e.g. T1-UCB_US_Tech-Resource_Allocation-2026-CR1" style={{ fontSize: '12px' }} />
          </Form.Item>
          <Form.Item name="signedSow" label={<span style={{ fontSize: '11px' }}>Signed SOW</span>}>
            <Select placeholder="Select" options={SIGNED_SOW_OPTIONS.map(value => ({ label: value, value }))} style={{ fontSize: '12px' }} allowClear />
          </Form.Item>
          <Form.Item name="piw" label={<span style={{ fontSize: '11px' }}>PIW</span>}>
            <Input placeholder="e.g. PIW - UCB Resource Allocation - 2026 - CR1" style={{ fontSize: '12px' }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="salesforceId" label={<span style={{ fontSize: '11px' }}>Salesforce ID</span>}>
              <Input style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="promsId" label={<span style={{ fontSize: '11px' }}>PROMS ID</span>}>
              <Input style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="budget" label={<span style={{ fontSize: '11px' }}>Budget (INR)</span>}>
              <Input placeholder="e.g. 45,08,307.00" style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="accountAnchor" label={<span style={{ fontSize: '11px' }}>Owner</span>}>
              <Select showSearch allowClear placeholder="Select owner" style={{ fontSize: '12px' }} options={anchorOptions} notFoundContent={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>No owners configured</span>} />
            </Form.Item>
          </div>
          <Form.Item name="openAirCode" label={<span style={{ fontSize: '11px' }}>Open Air Code</span>}>
            <Input placeholder="e.g. ZSUS0341 - Next Gen Operations Support 2026" style={{ fontSize: '12px' }} />
          </Form.Item>
          <Form.Item name="eprev" label={<span style={{ fontSize: '11px' }}>Eprev</span>} extra={<span style={{ fontSize: '10px', color: '#8c8c8c' }}>Yes = E-Preview completed (marks process as Completed)</span>}>
            <Select placeholder="Select" options={[{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }]} style={{ fontSize: '12px' }} allowClear />
          </Form.Item>
          {editingRow && (
            <Form.Item name="newComment" label={<span style={{ fontSize: '11px' }}>Add Comment (optional)</span>} extra={<span style={{ fontSize: '10px', color: '#8c8c8c' }}>Will be saved to the Comments section of this record.</span>}>
              <Input.TextArea rows={2} placeholder="Leave a note about this change…" style={{ fontSize: '12px' }} />
            </Form.Item>
          )}
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', fontSize: '11px', color: '#389e0d', marginTop: 4 }}>
            Status auto-derived: <b>Not Started</b> → <b>In Progress</b> (Signed SOW = Yes or PIW/SF/PROMS added) → <b>Completed</b> (Eprev = Yes <i>or</i> OA Code added)
          </div>
        </Form>
      </Drawer>

      <Drawer open={!!detailRow} onClose={() => { setDetailRow(null); setPanelExpanded(false); }} placement="right" width={panelExpanded ? 900 : 520} title={detailRow ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: '13px', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detailRow.sow || 'Record Details'}</span><Space size={4} onClick={event => event.stopPropagation()}>{canEdit && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditFromPanel(detailRow)} style={{ borderRadius: 6 }} />}<Button size="small" type="text" icon={panelExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />} onClick={() => setPanelExpanded(prev => !prev)} style={{ borderRadius: 6 }} /><Button size="small" type="text" onClick={() => { setDetailRow(null); setPanelExpanded(false); }} style={{ borderRadius: 6 }}>✕</Button></Space></div> : 'Record Details'} styles={{ body: { padding: '0 16px 16px' } }} closeIcon={null}>
        {detailRow && (
          <ProcessDetailPanel
            row={detailRow}
            currentUser={currentUser?.username || currentUser?.name || 'Unknown'}
            canEdit={canEdit}
            canDelete={canDelete}
            linkedResources={allProcResources.filter(resource => resource.processId === detailRow.id).map(resource => ({ id: resource.id, raId: resource.raId, empName: resource.empName, piwRole: resource.piwRole, engagementStartDate: resource.engagementStartDate, engagementEndDate: resource.engagementEndDate }))}
            onEdit={() => openEditFromPanel(detailRow)}
            onToggleActive={() => handleToggleActive(detailRow)}
            onLinkResources={() => openLinkModal(detailRow)}
          />
        )}
      </Drawer>

      <AllocateOwnerModal open={allocateModal} allocateSingleRow={allocateSingleRow} allocateAnchor={allocateAnchor} setAllocateAnchor={setAllocateAnchor} allocateSelected={allocateSelected} setAllocateSelected={setAllocateSelected} unassignedRows={unassignedRows} anchorOptions={anchorOptions} onOk={handleAllocateSave} onCancel={() => { setAllocateModal(false); setAllocateAnchor(''); setAllocateSelected([]); setAllocateSingleRow(null); }} />

      <LinkResourcesModal open={linkModal.open} row={linkModal.row} rows={rows} allProcResources={allProcResources} linkChecked={linkChecked} setLinkChecked={setLinkChecked} linkSearch={linkSearch} setLinkSearch={setLinkSearch} loadingLink={loadingLink} savingLink={savingLink} linkDates={linkDates} setLinkDates={setLinkDates} onClose={() => setLinkModal({ open: false, row: null })} onSave={handleSaveLinks} />
    </div>
  );
}
