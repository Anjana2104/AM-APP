/**
 * ClientRequests.tsx
 * 
 * Client Requests — Client request management with Insights, Beeline integration,
 * filtering, bulk actions, and export capabilities
 * UI Location: Client Management > Clients > Requests
 * Page ID: clientmgmt_requests
 * Child Components: EnhancedInsights.tsx, RequestInsightsChart.tsx
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Select,
  Drawer,
  Space,
  Upload,
  message,
  Modal,
  Card,
  Row,
  Col,
  Divider,
  Tooltip,
  Dropdown,
  Tabs,
  Tag,
  DatePicker,
  Spin,
  Badge,
  Typography,
  Pagination,
  Checkbox,
  Popconfirm,
  Segmented,
} from 'antd';
const { Text } = Typography;
import {
  DeleteOutlined,
  EditOutlined,
  FilterOutlined,
  SettingOutlined,
  ClearOutlined,
  MoreOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  TableOutlined,
  UnorderedListOutlined,
  ColumnHeightOutlined,
  CloudServerOutlined,
  FileExcelOutlined,
  EyeOutlined,
  LinkOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import { RequestInsightsChart, BeelineResourcePanel } from './RequestInsightsChart';
import { EnhancedInsights } from './EnhancedInsights';
import RequestDetailPanel from '../components/RequestDetailPanel';
import BulkSelectionActionsBar from './client-requests/BulkSelectionActionsBar';
import ClientRequestsFilterPanel from './client-requests/ClientRequestsFilterPanel';
import { buildRequestConfigMappings, formatDateReadable, formatDateTimeUtc, formatDateToDDMMYYYY, mapResourceApiRow } from './client-requests/clientRequestsMappers';
import { buildClientRequestCardMenuItems, buildClientRequestsToolbarMenuItems } from './client-requests/clientRequestsMenus';
import { mergeClientRequestRows, parseClientRequestWorksheet, toRequestBulkSavePayload, type ClientRequestUploadRow } from './client-requests/requestUploadUtils';
import { mapApiRequestRow, toCreateRequestPayload } from './client-requests/requestRowMappers';
import { buildRequestUpdatePayload } from './client-requests/requestUpdateUtils';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';
import * as requestApi from '../api/requestApi';
import * as resourceApi from '../api/resourceApi';
import type { ResourcePayload } from '../api/resourceApi';
import { clearModuleArtifact } from '../utils/moduleCleanupApi';
import { buildStyledWorksheetFromAoa, getCurrentDateStamp } from '../utils/styledExcelExport';
import { writeJsonSheetFile } from '../utils/xlsxExport';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  RequestRow as ReduxRequestRow,
  setActiveRequestOptions as setActiveRequestOptionsAction,
  setRequests as setRequestsAction,
  setRequestsFromServer as setRequestsFromServerAction,
  clearRequests as clearRequestsAction,
} from '../store/requestsSlice';
import { setResources as setResourcesAction, setResourcesFromServer } from '../store/resourcesSlice';
import { mapResourceApiRowToResourceRow } from './resource/resourceRowMappers';
import '../style.css';

// Types and interfaces
type ClientRequest = ReduxRequestRow;

function toSortableTimestamp(value?: string): number {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (ddmmyyyy) {
    const isoDate = `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}T00:00:00Z`;
    const ts = Date.parse(isoDate);
    return Number.isNaN(ts) ? 0 : ts;
  }
  const ts = Date.parse(raw);
  return Number.isNaN(ts) ? 0 : ts;
}

function getRequestRecencyTimestamp(row: ClientRequest): number {
  return Math.max(toSortableTimestamp(row.updatedOn), toSortableTimestamp(row.dateRaised));
}

const OVERALL_STATUS_COLOR_MAP: Record<string, string> = {
  'not_started': '#1890ff', 'in_progress': '#faad14', 'completed': '#52c41a',
  'blocked': '#f5222d', 'cancelled': '#666666',
};
const OVERALL_STATUS_BG_MAP: Record<string, string> = {
  'not_started': '#e6f7ff', 'in_progress': '#fffbe6', 'completed': '#f6ffed',
  'blocked': '#fff1f0', 'cancelled': '#fafafa',
};

const getOverallStatusColor = (status: string): string => OVERALL_STATUS_COLOR_MAP[status] || '#000000';
const getOverallStatusBackgroundColor = (status: string): string => OVERALL_STATUS_BG_MAP[status] || '#f5f5f5';

// Main Component
export default function ClientRequests({ initialBeelineFilter, initialFilters, onFilterApplied }: { initialBeelineFilter?: string; initialFilters?: Record<string, any>; onFilterApplied?: () => void } = {}) {
  const dispatch = useAppDispatch();
  const { getConfigByLink, configs } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const requests = useAppSelector((state) => state.requests.items) as ClientRequest[];
  const requestsLoaded = useAppSelector((state) => state.requests.loaded);
  const reduxResources = useAppSelector((state) => state.resources.items);
  const resourcesLoaded = useAppSelector((state) => state.resources.loaded);
  const canEdit = hasPermission('clientmgmt_requests', 'edit');
  const canDelete = hasPermission('clientmgmt_requests', 'delete');
  const changedBy = currentUser?.username || 'system';

  // Derive processing/overall status + request type options dynamically from config context
  const typeItems = getConfigByLink('request_type_field')?.items ?? [];
  const processingStatusItems = getConfigByLink('request_processing_status_field')?.items ?? [];
  const overallStatusItems = getConfigByLink('request_overall_status_field')?.items ?? [];
  const ownerItems = useMemo(() => {
    const topLinked = configs.find(c =>
      (c.linkedTo ?? []).includes('request_owner_field') || (c.linkedTo ?? []).includes('request_account_anchor_field')
    );
    return topLinked?.items ?? [];
  }, [configs]);

  const {
    REQUEST_TYPE_OPTIONS,
    REQUEST_TYPE_LABEL,
    REQUEST_TYPE_COLOR,
    PROCESSING_STATUS_OPTIONS,
    OVERALL_STATUS_OPTIONS,
    PROCESSING_STATUS_DISPLAY_MAP,
    OVERALL_STATUS_DISPLAY_MAP,
  } = buildRequestConfigMappings(typeItems, processingStatusItems, overallStatusItems);
  const [loading, setLoading] = useState(true);
  const [fromServer, setFromServer] = useState(false);
  const [form] = Form.useForm();
  const [editDrawer, setEditDrawer] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ClientRequest | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [viewDetailRecord, setViewDetailRecord] = useState<ClientRequest | null>(null);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(15);
  const [visibleColumns, setVisibleColumnsState] = useState<Record<string, boolean>>({
    sno: true,
    beelineId: true,
    requestType: true,
    description: true,
    raisedBy: true,
    processingStatus: true,
    overallStatus: true,
    accountAnchor: true,
    dateRaised: true,
  });
  const [activeTab, setActiveTab] = useState<string>('overview');
  const ownerOptions = useMemo(() => {
    return ownerItems.map(i => ({ label: i.label, value: i.value }));
  }, [ownerItems]);
  const beelineOptions = useMemo(() => {
    return Array.from(new Set(requests.map(r => (r.beelineId || '').trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b))
      .map(v => ({ label: v, value: v }));
  }, [requests]);

  const applyRequests = (updater: ClientRequest[] | ((prev: ClientRequest[]) => ClientRequest[])) => {
    const next = typeof updater === 'function'
      ? (updater as (prev: ClientRequest[]) => ClientRequest[])(requests)
      : updater;
    dispatch(setRequestsAction(next));
    return next;
  };

  // Apply saved user preferences once loaded
  useEffect(() => {
    if (!preferencesLoaded) return;
    const vis = getColumnVisibility('requests');
    setVisibleColumnsState(prev => ({ ...prev, ...vis }));
  }, [preferencesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleColumns = (newVis: Record<string, boolean>) => {
    setVisibleColumnsState(newVis);
    saveColumnVisibility('requests', newVis);
  };

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const recencyDiff = getRequestRecencyTimestamp(b) - getRequestRecencyTimestamp(a);
      if (recencyDiff !== 0) return recencyDiff;
      return Number.parseInt(b.sno || '0', 10) - Number.parseInt(a.sno || '0', 10);
    });
  }, [requests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return sortedRequests.filter(req => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value && value !== false) continue;
        if (key === 'sno' && !req.sno.toString().includes(value)) return false;
        if (key === 'beelineId' && req.beelineId !== value) return false;
        if (key === 'description' && !req.description.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'raisedBy' && !req.raisedBy.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'accountAnchor' && !req.accountAnchor.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'requestType' && req.requestType !== value) return false;
        if (key === 'overallStatus' && req.overallStatus !== value) return false;
        if (key === 'processingStatus' && req.processingStatus !== value) return false;
        if (key === 'dateRaisedFrom') {
          const raisedTs = toSortableTimestamp(req.dateRaised);
          const fromTs = Date.parse(`${String(value)}T00:00:00Z`);
          if (!Number.isFinite(raisedTs) || !Number.isFinite(fromTs) || raisedTs < fromTs) return false;
        }
        if (key === 'dateRaisedTo') {
          const raisedTs = toSortableTimestamp(req.dateRaised);
          const toTs = Date.parse(`${String(value)}T23:59:59Z`);
          if (!Number.isFinite(raisedTs) || !Number.isFinite(toTs) || raisedTs > toTs) return false;
        }
        if (key === 'accountAnchorPresent' && value === true && !req.accountAnchor?.trim()) return false;
        if (key === 'accountAnchorMissing' && value === true && !!req.accountAnchor?.trim()) return false;
        if (key === 'isActive' && value !== 'all') {
          const active = req.isActive !== false;
          if (value === 'active' && !active) return false;
          if (value === 'inactive' && active) return false;
        }
      }
      return true;
    });
  }, [sortedRequests, filters]);

  // Handlers
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const uploaded = parseClientRequestWorksheet(worksheet, {
          processingDefault: PROCESSING_STATUS_OPTIONS[0]?.value || '',
          overallDefault: OVERALL_STATUS_OPTIONS[0]?.value || 'not_started',
          processingDisplayMap: PROCESSING_STATUS_DISPLAY_MAP,
          overallDisplayMap: OVERALL_STATUS_DISPLAY_MAP,
          typeItems,
          formatDateToDDMMYYYY,
        }) as ClientRequestUploadRow[];

        if (!uploaded.length) { message.warning('No valid rows with Beeline ID found'); return; }

        let uploadSummary = { newCount: 0, updCount: 0 };
        let mergedRows: ClientRequestUploadRow[] = [];

        applyRequests(prev => {
          const result = mergeClientRequestRows(prev as ClientRequestUploadRow[], uploaded);
          uploadSummary = { newCount: result.newCount, updCount: result.updCount };
          mergedRows = result.mergedRows;
          return mergedRows as ClientRequest[];
        });

        // Save to DB outside the updater (avoids Strict Mode double-invoke)
        setTimeout(() => {
          requestApi.bulkSave(toRequestBulkSavePayload(mergedRows)).then(result => {
            if (result.ok) {
              setFromServer(true);
              dispatch(setRequestsFromServerAction(true));
              // Re-fetch from server to get proper DB IDs for all records (esp. newly inserted)
              requestApi.getRequests().then(({ requests: fresh }) => {
                if (fresh.length > 0) {
                  applyRequests(fresh.map((r: any, i: number) => mapApiRequestRow(r, i) as ClientRequest));
                }
              });
            }
          });
          message.success(`Upload complete: ${uploadSummary.newCount} new, ${uploadSummary.updCount} updated`);
        }, 0);
      } catch (error) {
        console.error('[ClientRequests] Upload parse/save failed', error);
        message.error('Failed to upload file');
      }
    };
    reader.onerror = () => message.error('Failed to read file');
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleUploadRequestsPicker = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.xlsx,.xls';
    inp.onchange = (ev) => {
      const f = (ev.target as HTMLInputElement).files?.[0];
      if (f) handleUpload(f);
    };
    inp.click();
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Beeline ID': 'BL-001',
        'Request Type': 'Resource Demand',
        'Description': 'Sample request description',
        'Raised by': 'John Doe',
        'Processing Status': 'Accepted by Staffing Team',
        'Overall Status': 'Not Started',
        'Owner': 'Team A',
        'Date Raised': '01/01/2024',
      },
    ];
    writeJsonSheetFile(XLSX, template, 'Template', 'ClientM_Template.xlsx');
  };

  const handleAddNew = () => {
    setEditingRequest(null);
    form.resetFields();
    setEditDrawer(true);
  };

  const handleEdit = (request: ClientRequest) => {
    setEditingRequest(request);
    form.setFieldsValue(request);
    setEditDrawer(true);
  };

  const handleDelete = (request: ClientRequest) => {
    Modal.confirm({
      title: 'Delete Request',
      content: `Delete request ${request.beelineId}?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        if (request.id) requestApi.deleteRequest(request.id, currentUser?.username);
        applyRequests(prev => prev.filter(r => r.sno !== request.sno));
      },
    });
  };

  const handleToggleActive = async (request: ClientRequest) => {
    if (!request.id) return;
    const newActive = request.isActive === false ? true : false;
    const result = await requestApi.setActiveStatus(request.id, newActive, currentUser?.username);
    if (!result.ok) {
      Modal.error({
        title: 'Cannot Mark Inactive',
        content: result.error || 'Failed to update status',
        okText: 'OK',
      });
      return;
    }
    applyRequests(prev => prev.map(r => r.id === request.id ? { ...r, isActive: newActive } : r));
    // If this request is currently open in the view panel, refresh it
    if (viewDetailRecord && viewDetailRecord.id === request.id) {
      setViewDetailRecord(prev => prev ? { ...prev, isActive: newActive } : prev);
    }
  };

  const handleSaveEdit = async (values: any) => {
    const normalizedBeeline = String(values.beelineId || '').trim().toLowerCase();
    if (!normalizedBeeline) {
      message.error('Beeline ID is required');
      return;
    }
    const duplicate = requests.find(r => {
      const sameBeeline = String(r.beelineId || '').trim().toLowerCase() === normalizedBeeline;
      if (!sameBeeline) return false;
      if (editingRequest?.id && r.id) return r.id !== editingRequest.id;
      return r.sno !== editingRequest?.sno;
    });
    if (duplicate) {
      message.error(`Beeline ID "${values.beelineId}" already exists`);
      return;
    }

    if (editingRequest) {
      const updated = { ...editingRequest, ...values, updatedOn: new Date().toISOString() };
      if (editingRequest.id) {
        const ok = await requestApi.updateRequest(editingRequest.id, buildRequestUpdatePayload(updated, {}, changedBy) as any);
        if (!ok) {
          message.error('Failed to update request. Beeline ID may already exist.');
          return;
        }
      }
      applyRequests(prev => prev.map(r => (editingRequest.id && r.id === editingRequest.id) ? updated : (r.sno === editingRequest.sno ? updated : r)));
      message.success('Request updated');
    } else {
      const sno = (requests.length + 1).toString();
      const newReq: ClientRequest = {
        sno,
        ...values,
        dateRaised: formatDateToDDMMYYYY(values.dateRaised),
        updatedOn: new Date().toISOString(),
      };
      const result = await requestApi.createRequest(toCreateRequestPayload(newReq));
      if (!result.ok || !result.id) {
        message.error((result as any).error || 'Failed to create request. Beeline ID may already exist.');
        return;
      }
      applyRequests(prev => [...prev, { ...newReq, id: result.id }]);
      message.success('Request created');
    }
    setEditDrawer(false);
    form.resetFields();
  };

  const handleBulkDelete = () => {
    Modal.confirm({
      title: 'Delete Selected',
      content: `Delete ${selectedRowKeys.length} selected requests?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        const toDelete = requests.filter(r => selectedRowKeys.includes(r.sno) && r.id);
        toDelete.forEach(r => requestApi.deleteRequest(r.id!, currentUser?.username));
        applyRequests(requests.filter(r => !selectedRowKeys.includes(r.sno)));
        setSelectedRowKeys([]);
      },
    });
  };

  const handleClearAll = async () => {
    await requestApi.clearAll(currentUser?.username);
    dispatch(clearRequestsAction());
    setFromServer(false);
    dispatch(setRequestsFromServerAction(false));
    message.success('All request data cleared');
  };

  const handleClearAllAudit = async () => {
    const ok = await clearModuleArtifact('requests', 'audit', 'ClientRequests');
    if (ok) {
      message.success('All request audit history deleted');
    } else {
      message.error('Failed to delete audit history');
    }
  };

  const handleClearAllComments = async () => {
    const ok = await clearModuleArtifact('requests', 'comments', 'ClientRequests');
    if (ok) {
      message.success('All request comments deleted');
    } else {
      message.error('Failed to delete comments');
    }
  };

  const handleExportExcel = () => {
    if (!typeFilteredRequests.length) { message.warning('No data to export'); return; }
    const headers = ['S.No', 'Beeline ID', 'Type', 'Description', 'Raised By', 'Processing Status', 'Overall Status', 'Owner', 'Date Raised'];
    const aoa: any[][] = [headers];
    typeFilteredRequests.forEach(r => {
      aoa.push([r.sno, r.beelineId, r.requestType || '', r.description || '', r.raisedBy, r.processingStatus || '', r.overallStatus || '', r.accountAnchor || '', r.dateRaised || '']);
    });
    const ws = buildStyledWorksheetFromAoa(XLSXStyle, aoa, [8, 14, 16, 40, 20, 22, 18, 20, 14]);
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Client Requests');
    XLSXStyle.writeFile(wb, `Client_Requests_Export_${getCurrentDateStamp()}.xlsx`);
    message.success('Export downloaded');
  };

  const handleExportBeelineMapping = () => {
    const linked = allResources.filter(r => r.beelineId);
    if (!linked.length) { message.warning('No Beeline-Resource links to export'); return; }
    const headers = ['Beeline ID', 'RA ID', 'Employee Name', 'Email', 'Role', 'Engagement', 'Allocation Status', 'Skills'];
    const aoa: any[][] = [headers];
    const grouped: Record<string, ResourcePayload[]> = {};
    linked.forEach(r => {
      if (!grouped[r.beelineId!]) grouped[r.beelineId!] = [];
      grouped[r.beelineId!].push(r);
    });
    Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b)).forEach(([bid, resources]) => {
      resources.forEach(r => {
        aoa.push([bid, r.raId, r.empName, r.emailId, r.piwRole || r.roleOrDomain, r.engagement || '', r.allocationStatus || '', r.skills]);
      });
    });
    const ws = buildStyledWorksheetFromAoa(XLSXStyle, aoa, [16, 10, 26, 28, 18, 18, 18, 30]);
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Beeline Resource Mapping');
    XLSXStyle.writeFile(wb, `Beeline_Resource_Mapping_${getCurrentDateStamp()}.xlsx`);
    message.success('Beeline-Resource mapping downloaded');
  };

  const handleNavigateToRequests = (filterCriteria: Record<string, any>) => {
    setFilters(filterCriteria);
    setShowFilterPanel(true);
    setActiveTab('overview');
  };

  const applyBulkStatusUpdate = (field: 'overallStatus' | 'processingStatus', value: string) => {
    const updatedOn = new Date().toISOString();
    const toUpdate = requests.filter(r => selectedRowKeys.includes(r.sno) && r.id);
    toUpdate.forEach(r => requestApi.updateRequest(
      r.id!,
      buildRequestUpdatePayload(
        r,
        {
          overallStatus: field === 'overallStatus' ? value : r.overallStatus,
          processingStatus: field === 'processingStatus' ? value : r.processingStatus,
          updatedOn,
        },
        changedBy,
      ) as any,
    ));
    applyRequests(requests.map(r =>
      selectedRowKeys.includes(r.sno)
        ? { ...r, [field]: value, updatedOn }
        : r
    ));
    setSelectedRowKeys([]);
  };

  const columns = [
    {
      title: 'S.No',
      key: 'sno',
      width: 80,
      fixed: 'left' as const,
      render: (_: unknown, __: ClientRequest, index: number) => ((tablePage - 1) * tablePageSize) + index + 1,
      hidden: !visibleColumns.sno,
    },
    {
      title: 'Beeline ID',
      dataIndex: 'beelineId',
      key: 'beelineId',
      width: 130,
      fixed: 'left' as const,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.beelineId || '').localeCompare(b.beelineId || ''),
      hidden: !visibleColumns.beelineId,
    },
    {
      title: 'Type',
      dataIndex: 'requestType',
      key: 'requestType',
      width: 130,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.requestType || '').localeCompare(b.requestType || ''),
      hidden: !visibleColumns.requestType,
      render: (type: string) => type
        ? <Tag color={REQUEST_TYPE_COLOR[type] || 'default'} style={{ fontSize: '10px' }}>{REQUEST_TYPE_LABEL[type] || type}</Tag>
        : <span style={{ fontSize: '11px', color: '#bfbfbf' }}>—</span>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: 160,
      ellipsis: true,
      hidden: !visibleColumns.description,
      render: (text: string) => (
        <Tooltip title={<span style={{ fontSize: '11px' }}>{text}</span>}>
          <span style={{ maxWidth: '150px', display: 'inline-block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {text ? (text.substring(0, 40) + (text.length > 40 ? '...' : '')) : '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Raised By',
      dataIndex: 'raisedBy',
      key: 'raisedBy',
      width: 120,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.raisedBy || '').localeCompare(b.raisedBy || ''),
      hidden: !visibleColumns.raisedBy,
    },
    {
      title: 'Processing Status',
      dataIndex: 'processingStatus',
      key: 'processingStatus',
      width: 150,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.processingStatus || '').localeCompare(b.processingStatus || ''),
      hidden: !visibleColumns.processingStatus,
      render: (status: string) => PROCESSING_STATUS_DISPLAY_MAP[status] || status,
    },
    {
      title: 'Overall Status',
      dataIndex: 'overallStatus',
      key: 'overallStatus',
      width: 130,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.overallStatus || '').localeCompare(b.overallStatus || ''),
      hidden: !visibleColumns.overallStatus,
      render: (status: string) => (
        <span style={{
          backgroundColor: getOverallStatusBackgroundColor(status),
          color: getOverallStatusColor(status),
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: '500',
          display: 'inline-block',
        }}>
          {OVERALL_STATUS_DISPLAY_MAP[status] || status}
        </span>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'accountAnchor',
      key: 'accountAnchor',
      width: 120,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.accountAnchor || '').localeCompare(b.accountAnchor || ''),
      hidden: !visibleColumns.accountAnchor,
    },
    {
      title: 'Date Raised',
      dataIndex: 'dateRaised',
      key: 'dateRaised',
      width: 120,
      sorter: (a: ClientRequest, b: ClientRequest) => (a.dateRaised || '').localeCompare(b.dateRaised || ''),
      hidden: !visibleColumns.dateRaised,
      render: (v: string) => formatDateReadable(v) || '-',
    },
    {
      title: 'Status',
      key: 'isActive',
      width: 100,
      render: (_: any, record: ClientRequest) => {
        const active = record.isActive !== false;
        return (
          <Tag
            color={active ? 'green' : 'orange'}
            style={{ fontSize: 10, cursor: canEdit ? 'pointer' : 'default' }}
            onClick={canEdit ? () => handleToggleActive(record) : undefined}
          >
            {active ? 'Active' : 'Inactive'}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right' as const,
      render: (_: any, record: ClientRequest) => (
        <Space size="small">
          {canEdit && (
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ fontSize: '12px' }}
          />
          )}
          {canDelete && (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            style={{ fontSize: '12px' }}
          />
          )}
        </Space>
      ),
    },
  ].filter(col => !col.hidden);

  const displayColumns = columns.map(col => {
    if (col.key === 'processingStatus' || col.key === 'overallStatus') {
      return {
        ...col,
        render: col.render,
      };
    }
    return col;
  });

  // Click outside to deselect cards and close filter panel
  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedRowKeys([]);
      setShowFilterPanel(false);
    }
  };

  const [activeTypeTab, setActiveTypeTab] = useState('all');

  const typeFilteredRequests = useMemo(() => {
    if (activeTypeTab === 'all') return filteredRequests;
    return filteredRequests.filter(r => r.requestType === activeTypeTab);
  }, [filteredRequests, activeTypeTab]);

  const isFilterApplied = Object.values(filters).some(v => v);
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // ── Resources state (for beeline linking) — backed by Redux ──────────────
  const [allResources, setAllResources] = useState<ResourcePayload[]>(() => reduxResources as unknown as ResourcePayload[]);
  const [linkResourcesModal, setLinkResourcesModal] = useState<{ open: boolean; request: ClientRequest | null }>({ open: false, request: null });
  const [linkResourcesChecked, setLinkResourcesChecked] = useState<Set<number>>(new Set());
  const [linkResourcesSearch, setLinkResourcesSearch] = useState('');
  const [savingLinks, setSavingLinks] = useState(false);
  const [loadingLinkResources, setLoadingLinkResources] = useState(false);

  // Keep allResources in sync whenever Redux resources update
  useEffect(() => {
    setAllResources(reduxResources as unknown as ResourcePayload[]);
  }, [reduxResources]);

  // Compute linked count per beelineId from allResources
  const linkedCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allResources.forEach(r => {
      if (r.beelineId) map[r.beelineId] = (map[r.beelineId] || 0) + 1;
    });
    return map;
  }, [allResources]);

  const openLinkResourcesModal = async (request: ClientRequest) => {
    setLinkResourcesModal({ open: true, request });
    setLoadingLinkResources(true);
    setLinkResourcesChecked(new Set()); // clear while loading
    setLinkResourcesSearch('');
    // Use Redux cache first; only refresh from server to get latest beeline IDs
    let mapped: ResourcePayload[] = resourcesLoaded
      ? (reduxResources as unknown as ResourcePayload[])
      : allResources;
    if (!resourcesLoaded) {
      const { resources: rawRes, fromServer: online } = await resourceApi.getResources();
      if (online) {
        const reduxMapped = rawRes.map((r: any, i: number) => mapResourceApiRowToResourceRow(r, i));
        dispatch(setResourcesAction(reduxMapped));
        dispatch(setResourcesFromServer(true));
        mapped = rawRes.map(mapResourceApiRow);
        setAllResources(mapped);
      }
    }
    const checked = new Set<number>(
      mapped.filter(r => r.beelineId === request.beelineId && r.id != null).map(r => r.id as number)
    );
    setLinkResourcesChecked(checked);
    setLoadingLinkResources(false);
  };

  const handleSaveLinks = async () => {
    const request = linkResourcesModal.request;
    if (!request) return;
    setSavingLinks(true);
    const prevLinked = new Set<number>(
      allResources.filter(r => r.beelineId === request.beelineId && r.id != null).map(r => r.id as number)
    );
    const toLink = [...linkResourcesChecked].filter(id => !prevLinked.has(id));
    const toUnlink = [...prevLinked].filter(id => !linkResourcesChecked.has(id));
    const ops: Promise<boolean>[] = [
      ...toLink.map(id => resourceApi.setBeelineLink(id, request.beelineId, currentUser?.username || 'system')),
      ...toUnlink.map(id => resourceApi.setBeelineLink(id, '', currentUser?.username || 'system')),
    ];
    await Promise.all(ops);
    // Refresh resources in Redux after link changes
    const { resources: rawRes } = await resourceApi.getResources();
    const reduxMapped = rawRes.map((r: any, i: number) => mapResourceApiRowToResourceRow(r, i));
    dispatch(setResourcesAction(reduxMapped));
    setAllResources(rawRes.map(mapResourceApiRow));
    setSavingLinks(false);
    message.success('Resource links updated');
    setLinkResourcesModal({ open: false, request: null });
  };
  // ── End Resources state ───────────────────────────────────────────────────

  // Load from DB on mount
  useEffect(() => {
    if (requestsLoaded) {
      setLoading(false);
    } else {
    setLoading(true);
    requestApi.getRequests().then(({ requests: apiRows, fromServer: online }) => {
      if (online) {
        const mapped: ClientRequest[] = apiRows.map((r: any, i: number) => mapApiRequestRow(r, i) as ClientRequest);
        dispatch(setRequestsAction(mapped));
        setFromServer(true);
        dispatch(setRequestsFromServerAction(true));
      }
    }).finally(() => setLoading(false));
    }
  }, [dispatch, requestsLoaded]);

  // Apply initial beeline filter when provided from navigation
  useEffect(() => {
    if (initialBeelineFilter) {
      setFilters(f => ({ ...f, beelineId: initialBeelineFilter }));
      setShowFilterPanel(true);
      onFilterApplied?.();
    }
  }, [initialBeelineFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialFilters && Object.keys(initialFilters).length > 0) {
      setFilters(f => ({ ...f, ...initialFilters }));
      setShowFilterPanel(true);
      onFilterApplied?.();
    }
  }, [initialFilters]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        const isInsidePopup = !!target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown');
        if (!isInsidePopup) {
          setShowFilterPanel(false);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            destroyInactiveTabPane
            size="small"
            style={{ padding: '0 16px' }}
            tabBarStyle={{ marginBottom: 0, fontSize: '12px' }}
            items={[
              {
                key: 'overview',
                label: <span style={{ fontSize: '12px' }}>Beeline Requests</span>,
                children: (
                  <div onClick={handleContainerClick} style={{ minHeight: '500px', padding: '16px 0' }}>
                    {/* Type segmented control */}
                    <div style={{ marginBottom: 14 }}>
                      <Segmented
                        value={activeTypeTab}
                        onChange={val => setActiveTypeTab(String(val))}
                        options={[
                          {
                            label: (
                              <span style={{ fontSize: '12px' }}>
                                All{' '}
                                <Badge count={filteredRequests.length} size="small" style={{ backgroundColor: '#1890ff', fontSize: '10px' }} showZero />
                              </span>
                            ),
                            value: 'all',
                          },
                          ...typeItems.map(t => ({
                            label: (
                              <span style={{ fontSize: '12px' }}>
                                <Tag color={t.color ?? 'default'} style={{ fontSize: '10px', marginRight: 4, marginBottom: 0 }}>{t.label}</Tag>
                                <Badge count={filteredRequests.filter(r => r.requestType === t.value).length} size="small" style={{ backgroundColor: '#8c8c8c', fontSize: '10px' }} showZero />
                              </span>
                            ),
                            value: t.value,
                          })),
                        ]}
                        style={{ background: '#f5f5f5' }}
                      />
                    </div>
                    {/* Toolbar row */}
                      <Space style={{ marginBottom: '16px', width: '100%', justifyContent: 'space-between', display: 'flex' }} direction="horizontal">
                        <Space size={6}>
                          <Text type="secondary" style={{ fontSize: '12px' }}>Manage client requests and its processing stage</Text>
                          {fromServer && <Tooltip title="Data from server" overlayInnerStyle={{ fontSize: '11px' }}><CloudServerOutlined style={{ color: '#52c41a', fontSize: '13px' }} /></Tooltip>}
                        </Space>
                        <Space wrap size={8}>
                          {isFilterApplied && (
                            <Button
                              size="small"
                              type="link"
                              style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }}
                              onClick={() => setFilters({})}
                            >
                              ✕ Clear Filters
                            </Button>
                          )}
                          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button
                              icon={<FilterOutlined />}
                              type={showFilterPanel || isFilterApplied ? 'primary' : 'default'}
                              size="small"
                              onClick={() => setShowFilterPanel(!showFilterPanel)}
                              style={{ borderRadius: '6px' }}
                            />
                          </Tooltip>
                          <Tooltip title="Card View" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button
                              icon={<AppstoreOutlined />}
                              type={viewMode === 'card' ? 'primary' : 'default'}
                              size="small"
                              onClick={() => setViewMode('card')}
                              style={{ borderRadius: '6px' }}
                            />
                          </Tooltip>
                          <Tooltip title="Table View" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button
                              icon={<TableOutlined />}
                              type={viewMode === 'table' ? 'primary' : 'default'}
                              size="small"
                              onClick={() => setViewMode('table')}
                              style={{ borderRadius: '6px' }}
                            />
                          </Tooltip>
                          {viewMode === 'table' && (
                            <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
                              <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: '6px' }} />
                            </Tooltip>
                          )}
                          <Tooltip title="Export Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FileExcelOutlined />} size="small" onClick={handleExportExcel} disabled={!typeFilteredRequests.length} style={{ borderRadius: '6px', color: typeFilteredRequests.length ? '#52c41a' : undefined }} />
                          </Tooltip>
                          <Dropdown
                            trigger={['click']}
                            menu={{
                              items: buildClientRequestsToolbarMenuItems({
                                canEdit,
                                canDelete,
                                hasRequests: requests.length > 0,
                                onAddNew: handleAddNew,
                                onDownloadTemplate: downloadTemplate,
                                onUploadRequests: handleUploadRequestsPicker,
                                onDeleteAllRequests: handleClearAll,
                                onDeleteAllAudit: handleClearAllAudit,
                                onDeleteAllComments: handleClearAllComments,
                              }),
                            }}
                          >
                            <Button icon={<MoreOutlined />} size="small" style={{ borderRadius: '6px' }} />
                          </Dropdown>
                        </Space>
                      </Space>

                      {selectedRowKeys.length > 0 && (
                        <BulkSelectionActionsBar
                          selectedCount={selectedRowKeys.length}
                          overallStatusOptions={OVERALL_STATUS_OPTIONS}
                          processingStatusOptions={PROCESSING_STATUS_OPTIONS}
                          onSelectOverallStatus={(value) => applyBulkStatusUpdate('overallStatus', value)}
                          onSelectProcessingStatus={(value) => applyBulkStatusUpdate('processingStatus', value)}
                          onDelete={handleBulkDelete}
                          onClearSelection={() => setSelectedRowKeys([])}
                        />
                      )}

                      {viewMode === 'table' ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          {showFilterPanel && (
                            <ClientRequestsFilterPanel
                              ref={filterPanelRef}
                              filters={filters}
                              setFilters={setFilters}
                              overallStatusOptions={OVERALL_STATUS_OPTIONS}
                              processingStatusOptions={PROCESSING_STATUS_OPTIONS}
                              requestTypeOptions={REQUEST_TYPE_OPTIONS}
                              ownerOptions={ownerOptions}
                              beelineOptions={beelineOptions}
                            />
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="compact-table">
                              <Table<ClientRequest>
                                dataSource={typeFilteredRequests}
                                columns={displayColumns}
                                pagination={{
                                  current: tablePage,
                                  pageSize: tablePageSize,
                                  showSizeChanger: false,
                                  onChange: (page, pageSize) => {
                                    setTablePage(page);
                                    setTablePageSize(pageSize);
                                  },
                                }}
                                scroll={{ x: 'max-content' }}
                                size="small"
                                rowSelection={{
                                  selectedRowKeys,
                                  onChange: (keys) => setSelectedRowKeys(keys as string[]),
                                  type: 'checkbox',
                                }}
                                rowKey="sno"
                                onRow={(record) => ({
                                  onClick: (e) => {
                                    const target = e.target as HTMLElement;
                                    if (target.closest('button, .ant-dropdown, .ant-checkbox-wrapper')) return;
                                    setViewDetailRecord(record);
                                  },
                                  style: { cursor: 'pointer' },
                                })}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          {showFilterPanel && (
                            <ClientRequestsFilterPanel
                              ref={filterPanelRef}
                              filters={filters}
                              setFilters={setFilters}
                              overallStatusOptions={OVERALL_STATUS_OPTIONS}
                              processingStatusOptions={PROCESSING_STATUS_OPTIONS}
                              requestTypeOptions={REQUEST_TYPE_OPTIONS}
                              ownerOptions={ownerOptions}
                              beelineOptions={beelineOptions}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <Row gutter={[16, 16]}>
                          {typeFilteredRequests.map(request => (
                            <Col key={request.sno} xs={24} sm={24} md={12} lg={8}>
                              <Card
                                hoverable
                                onClick={() => {
                                  if (selectedRowKeys.includes(request.sno)) {
                                    setSelectedRowKeys(selectedRowKeys.filter(k => k !== request.sno));
                                  } else {
                                    setSelectedRowKeys([...selectedRowKeys, request.sno]);
                                  }
                                }}
                                style={{
                                  height: '100%',
                                  borderRadius: '8px',
                                  border: selectedRowKeys.includes(request.sno) ? '2px solid #1a1a1a' : request.isActive === false ? '1px solid #ffe7ba' : '1px solid #d9d9d9',
                                  cursor: 'pointer',
                                  backgroundColor: selectedRowKeys.includes(request.sno) ? '#f5f5f5' : request.isActive === false ? '#fff7e6' : '#ffffff',
                                  padding: '12px',
                                  opacity: request.isActive === false ? 0.8 : 1,
                                }}
                              >
                                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                                   <div>
                                     <Tag color={request.isActive === false ? 'orange' : 'green'} style={{ fontSize: 9, padding: '0 5px', marginBottom: 4, display: 'inline-block' }}>
                                       {request.isActive === false ? 'Inactive' : 'Active'}
                                     </Tag>
                                     <div>
                                       <Text strong style={{ fontSize: "13px" }}>{request.beelineId}</Text>
                                       {(linkedCountMap[request.beelineId] || 0) > 0 && (
                                         <Badge count={linkedCountMap[request.beelineId]} size="small" style={{ backgroundColor: '#1890ff', fontSize: '10px', marginLeft: 4 }} />
                                       )}
                                     </div>
                                     <div style={{ fontSize: "12px", color: "#8c8c8c" }}>{request.raisedBy}</div>
                                   </div>
                                    <div style={{ display: "flex", gap: 4, alignItems: "center", justifyContent: "flex-end" }}>
                                      <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} style={{ padding: 0, color: "#1890ff" }} onClick={e => { e.stopPropagation(); setViewDetailRecord(request); }} /></Tooltip>
                                     <Dropdown
                                        menu={{
                                          items: buildClientRequestCardMenuItems({
                                            request,
                                            canEdit,
                                            canDelete,
                                            onEdit: handleEdit,
                                            onLinkResources: openLinkResourcesModal,
                                            onToggleActive: handleToggleActive,
                                            onDelete: handleDelete,
                                          }),
                                        }}
                                       trigger={["click"]}
                                     >
                                        {/* eye moved above */}
                                       <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: 0 }} />
                                     </Dropdown>
                                     <div style={{ fontSize: "11px", color: "#262626", fontWeight: "500", marginTop: 4 }}>{request.accountAnchor}</div>
                                   </div>
                                 </div>
                                <Divider style={{ margin: '8px 0' }} />
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px' }}>
                                  <div style={{ flex: 1 }}>
                                    <Text style={{
                                      backgroundColor: getOverallStatusBackgroundColor(request.overallStatus),
                                      color: getOverallStatusColor(request.overallStatus),
                                      padding: '4px 10px',
                                      fontSize: '12px',
                                      fontWeight: '500',
                                      borderRadius: '4px',
                                      display: 'inline-block'
                                    }}>
                                      {OVERALL_STATUS_DISPLAY_MAP[request.overallStatus]}
                                    </Text>
                                  </div>
                                  <Text style={{ fontSize: '12px', color: '#262626', fontStyle: 'italic', flex: 1, textAlign: 'right' }}>
                                    {PROCESSING_STATUS_DISPLAY_MAP[request.processingStatus]}
                                  </Text>
                                </div>
                                <Text style={{ fontSize: '12px', color: '#262626', display: 'block', marginBottom: '8px' }}>
                                  {request.description ? (request.description.substring(0, 80) + (request.description.length > 80 ? '...' : '')) : '-'}
                                </Text>
                                <div style={{ textAlign: 'right' }}>
                                  <Text style={{ fontSize: '10px', color: '#bfbfbf' }}>
                                    Updated: {formatDateTimeUtc(request.updatedOn) || '-'}
                                  </Text>
                                </div>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                          </div>
                        </div>
                      )}
                      {requests.length === 0 && (
                        <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '60px 24px', textAlign: 'center', marginTop: 8 }}>
                          {loading
                            ? <Spin tip="Loading requests..." />
                            : <Text type="secondary">No requests yet. Use the <strong>⋯</strong> menu to upload a file or add a new request.</Text>
                          }
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'beeline_ids',
                  label: <span style={{ fontSize: '12px' }}><LinkOutlined /> Beeline IDs</span>,
                  children: (
                    <div style={{ padding: '16px 0' }}>
                      <BeelineResourcePanel
                        requests={requests}
                        allResources={allResources}
                        onExportBeelineMapping={handleExportBeelineMapping}
                        onToggleActive={async (id, isActive) => {
                          const result = await requestApi.setActiveStatus(id, isActive, currentUser?.username);
                          if (!result.ok) {
                            Modal.error({ title: 'Cannot Mark Inactive', content: result.error || 'Failed to update status', okText: 'OK' });
                            return;
                          }
                          applyRequests(prev => prev.map(r => r.id === id ? { ...r, isActive } : r));
                        }}
                      />
                    </div>
                  ),
                },
                {
                  key: 'insights',
                  label: <span style={{ fontSize: '12px' }}><BarChartOutlined /> Insights</span>,
                  children: (
                    <div style={{ padding: '16px 0' }}>
                      <EnhancedInsights
                        requests={requests}
                        allResources={allResources}
                        onNavigateToRequests={handleNavigateToRequests}
                        overallStatusDisplayMap={OVERALL_STATUS_DISPLAY_MAP}
                        processingStatusDisplayMap={PROCESSING_STATUS_DISPLAY_MAP}
                        processingStatusOptions={PROCESSING_STATUS_OPTIONS}
                        overallStatusOptions={OVERALL_STATUS_OPTIONS}
                        requestTypeOptions={REQUEST_TYPE_OPTIONS}
                        requestTypeLabel={REQUEST_TYPE_LABEL}
                        requestTypeColor={REQUEST_TYPE_COLOR}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Space>

        <Drawer
          title={
            viewDetailRecord ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <LinkOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#262626' }}>{viewDetailRecord.beelineId}</span>
                </div>
                <Space size={4} style={{ marginRight: 32 }}>
                  <Tooltip title={panelExpanded ? 'Collapse' : 'Expand'}>
                    <Button
                      type="text"
                      size="small"
                      icon={panelExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
                      onClick={() => setPanelExpanded(p => !p)}
                    />
                  </Tooltip>
                  {canEdit && (
                    <Tooltip title="Edit">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined style={{ color: '#1890ff' }} />}
                        onClick={() => { handleEdit(viewDetailRecord); setViewDetailRecord(null); setPanelExpanded(false); }}
                      />
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip title="Delete">
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
                        onClick={() => { handleDelete(viewDetailRecord); setViewDetailRecord(null); setPanelExpanded(false); }}
                      />
                    </Tooltip>
                  )}
                </Space>
              </div>
            ) : 'Request Details'
          }
          placement="right"
          onClose={() => { setViewDetailRecord(null); setPanelExpanded(false); }}
          open={!!viewDetailRecord}
          width={panelExpanded ? 900 : 520}
          styles={{ body: { padding: '0 16px 16px' } }}
        >
          {viewDetailRecord && (
            <RequestDetailPanel
              request={viewDetailRecord}
              expanded={panelExpanded}
              currentUser={currentUser?.username || currentUser?.name || 'Unknown'}
              processingStatusLabel={v => PROCESSING_STATUS_DISPLAY_MAP[v] || v}
              overallStatusLabel={v => OVERALL_STATUS_DISPLAY_MAP[v] || v}
              overallStatusColor={getOverallStatusColor}
              overallStatusBg={getOverallStatusBackgroundColor}
              requestTypeLabel={v => REQUEST_TYPE_LABEL[v] || v}
              requestTypeColor={v => REQUEST_TYPE_COLOR[v] || 'default'}
              canEdit={canEdit}
              canDelete={canDelete}
              onEdit={() => { handleEdit(viewDetailRecord); setViewDetailRecord(null); setPanelExpanded(false); }}
              onDelete={() => { handleDelete(viewDetailRecord); setViewDetailRecord(null); setPanelExpanded(false); }}
              onToggleActive={() => handleToggleActive(viewDetailRecord)}
              onLinkResources={() => { openLinkResourcesModal(viewDetailRecord); }}
            />
          )}
        </Drawer>

        <Drawer
          title="Column Visibility"
          placement="right"
          onClose={() => setColumnDrawer(false)}
          open={columnDrawer}
          width={280}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {[
              { key: 'sno', label: 'S.No.' },
              { key: 'beelineId', label: 'Beeline ID' },
              { key: 'requestType', label: 'Type' },
              { key: 'description', label: 'Description' },
              { key: 'raisedBy', label: 'Raised By' },
              { key: 'processingStatus', label: 'Processing Status' },
              { key: 'overallStatus', label: 'Overall Status' },
              { key: 'accountAnchor', label: 'Owner' },
              { key: 'dateRaised', label: 'Date Raised' },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox
                  checked={visibleColumns[key]}
                  onChange={(e) => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })}
                />
                <label style={{ fontSize: '12px', marginBottom: 0, cursor: 'pointer' }}>{label}</label>
              </div>
            ))}
          </Space>
        </Drawer>

        <Drawer
          title={editingRequest ? 'Edit Request' : 'Add New Request'}
          placement="right"
          onClose={() => setEditDrawer(false)}
          open={editDrawer}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveEdit}
          >
            <Form.Item name="beelineId" label="Beeline ID" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="requestType" label="Request Type">
              <Select options={REQUEST_TYPE_OPTIONS} placeholder="Select request type" allowClear />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="raisedBy" label="Raised By" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="accountAnchor" label="Owner">
              <Select options={ownerOptions} placeholder="Select owner" showSearch optionFilterProp="label" allowClear />
            </Form.Item>
            <Form.Item name="processingStatus" label="Processing Status">
              <Select options={PROCESSING_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="overallStatus" label="Overall Status">
              <Select options={OVERALL_STATUS_OPTIONS} />
            </Form.Item>
            <Form.Item name="dateRaised" label="Date Raised">
              <Input />
            </Form.Item>
            <Button type="primary" htmlType="submit" block>Save</Button>
          </Form>
        </Drawer>
      </div>

      {/* ── Link Resources Modal ────────────────────────────────── */}
      <Modal
        title={
          <span style={{ fontSize: '13px' }}>
            <LinkOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            Link Resources to {linkResourcesModal.request?.beelineId}
          </span>
        }
        open={linkResourcesModal.open}
        onCancel={() => { setLinkResourcesModal({ open: false, request: null }); setLinkResourcesSearch(''); }}
        width={500}
        destroyOnClose
        footer={[
          <Button
            key="unlink-all"
            size="small"
            danger
            disabled={linkResourcesChecked.size === 0}
            onClick={() => setLinkResourcesChecked(new Set())}
            style={{ borderRadius: 6, fontSize: '11px', float: 'left' }}
          >
            Unlink All
          </Button>,
          <span key="count" style={{ fontSize: '11px', color: '#8c8c8c', float: 'left', lineHeight: '24px', marginLeft: 8 }}>
            {linkResourcesChecked.size} selected
          </span>,
          <Button key="cancel" size="small" style={{ borderRadius: 6 }} onClick={() => { setLinkResourcesModal({ open: false, request: null }); setLinkResourcesSearch(''); }}>
            Cancel
          </Button>,
          <Button key="ok" size="small" type="primary" loading={savingLinks} style={{ borderRadius: 6 }} onClick={handleSaveLinks}>
            Save Links
          </Button>,
        ]}
      >
        {linkResourcesModal.request && (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div style={{ fontSize: '11px', color: '#8c8c8c', background: '#f0f5ff', borderRadius: 6, padding: '8px 12px' }}>
              Select resources to link to <strong>{linkResourcesModal.request.beelineId}</strong>.
              Resources already linked to another Beeline ID will be re-linked to this one.
            </div>
            <Input.Search
              placeholder="Search by name or RAID…"
              size="small"
              allowClear
              value={linkResourcesSearch}
              onChange={e => setLinkResourcesSearch(e.target.value)}
            />
            <Spin spinning={loadingLinkResources} tip="Loading resources…" size="small">
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, minHeight: 60 }}>
                {!loadingLinkResources && allResources.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '12px' }}>No resources available</div>
                ) : allResources
                  .filter(r => {
                    if (!linkResourcesSearch.trim()) return true;
                    const q = linkResourcesSearch.toLowerCase();
                    return (r.empName || '').toLowerCase().includes(q) || (r.raId || '').toLowerCase().includes(q) || (r.piwRole || r.roleOrDomain || '').toLowerCase().includes(q);
                  })
                  .map((r: ResourcePayload) => {
                  const rid = (r as any).id as number;
                  if (!rid) return null;
                  const isChecked = linkResourcesChecked.has(rid);
                  const existingBeeline = r.beelineId || '';
                  const linkedElsewhere = existingBeeline && existingBeeline !== linkResourcesModal.request?.beelineId;
                  return (
                    <div key={rid} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer', background: isChecked ? '#f0f5ff' : 'transparent' }}
                      onClick={() => {
                        const next = new Set(linkResourcesChecked);
                        if (next.has(rid)) next.delete(rid); else next.add(rid);
                        setLinkResourcesChecked(next);
                      }}>
                      <Checkbox checked={isChecked} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500 }}>{r.empName}</div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{r.raId} · {r.piwRole || r.roleOrDomain}</div>
                      </div>
                      {linkedElsewhere && (
                        <Tag color="orange" style={{ fontSize: '10px' }}>{existingBeeline}</Tag>
                      )}
                      {isChecked && !linkedElsewhere && (
                        <Tag color="blue" style={{ fontSize: '10px' }}><LinkOutlined /> Linked</Tag>
                      )}
                    </div>
                  );
                })}
              </div>
            </Spin>
          </Space>
        )}
      </Modal>
    </div>
  );
}
