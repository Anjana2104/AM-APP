/**
 * RequestManagement.tsx
 * 
 * Requests — Client request management with Insights, Beeline integration,
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
  Popover,
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
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  UploadOutlined,
  DownloadOutlined,
  FilterOutlined,
  SettingOutlined,
  ClearOutlined,
  MoreOutlined,
  BarChartOutlined,
  AppstoreOutlined,
  TableOutlined,
  UnorderedListOutlined,
  CloseOutlined,
  ColumnHeightOutlined,
  CloudServerOutlined,
  FileExcelOutlined,
  EyeOutlined,
  LinkOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import dayjs from 'dayjs';
import { RequestInsightsChart, BeelineResourcePanel } from './RequestInsightsChart';
import { EnhancedInsights } from './EnhancedInsights';
import RequestDetailPanel from '../components/RequestDetailPanel';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';
import * as requestApi from '../api/requestApi';
import * as resourceApi from '../api/resourceApi';
import type { ResourcePayload } from '../api/resourceApi';
import '../style.css';

// Types and interfaces
interface ClientRequest {
  id?: number;
  sno: string;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
  isActive?: boolean;
}

// Utility Functions
const formatDateToDDMMYYYY = (dateString: string | undefined): string => {
  if (!dateString) return '';
  const parsed = dayjs(dateString);
  if (parsed.isValid()) return parsed.format('DD/MM/YYYY');
  return dateString;
};

const formatDateReadable = (dateString: string | undefined): string => {
  if (!dateString) return '';
  // Handle DD/MM/YYYY stored format
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateString);
  if (ddmmyyyy) {
    const parsed = dayjs(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`);
    if (parsed.isValid()) return parsed.format('DD MMMM YYYY');
  }
  const parsed = dayjs(dateString);
  if (parsed.isValid()) return parsed.format('DD MMMM YYYY');
  return dateString;
};

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
export default function RequestManagement({ initialBeelineFilter, onFilterApplied }: { initialBeelineFilter?: string; onFilterApplied?: () => void } = {}) {
  const { getConfigByLink } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const canEdit = hasPermission('clientmgmt_requests', 'edit');
  const canDelete = hasPermission('clientmgmt_requests', 'delete');

  // Derive processing/overall status + request type options dynamically from config context
  const typeItems = getConfigByLink('request_type_field')?.items ?? [];
  const processingStatusItems = getConfigByLink('request_processing_status_field')?.items ?? [];
  const overallStatusItems = getConfigByLink('request_overall_status_field')?.items ?? [];

  const REQUEST_TYPE_OPTIONS = typeItems.map(i => ({ label: i.label, value: i.value }));
  const REQUEST_TYPE_LABEL: Record<string, string> = Object.fromEntries(typeItems.map(i => [i.value, i.label]));
  const REQUEST_TYPE_COLOR: Record<string, string> = Object.fromEntries(typeItems.map(i => [i.value, i.color ?? 'default']));

  const PROCESSING_STATUS_OPTIONS = processingStatusItems.map(i => ({ label: i.label, value: i.value }));
  const OVERALL_STATUS_OPTIONS = overallStatusItems.map(i => ({ label: i.label, value: i.value }));

  // Build display maps from config
  const PROCESSING_STATUS_DISPLAY_MAP: Record<string, string> = Object.fromEntries(processingStatusItems.map(i => [i.value, i.label]));
  const OVERALL_STATUS_DISPLAY_MAP: Record<string, string> = Object.fromEntries(overallStatusItems.map(i => [i.value, i.label]));
  const [requests, setRequests] = useState<ClientRequest[]>([]);
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

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value && value !== false) continue;
        if (key === 'sno' && !req.sno.toString().includes(value)) return false;
        if (key === 'beelineId' && !req.beelineId.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'description' && !req.description.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'raisedBy' && !req.raisedBy.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'accountAnchor' && !req.accountAnchor.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'requestType' && req.requestType !== value) return false;
        if (key === 'overallStatus' && req.overallStatus !== value) return false;
        if (key === 'processingStatus' && req.processingStatus !== value) return false;
        if (key === 'isActive' && value !== 'all') {
          const active = req.isActive !== false;
          if (value === 'active' && !active) return false;
          if (value === 'inactive' && active) return false;
        }
      }
      return true;
    });
  }, [requests, filters]);

  // Handlers
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (!jsonData || jsonData.length === 0) {
          message.warning('No data found in the Excel file');
          return;
        }

        const uploaded: ClientRequest[] = jsonData.map((row: any) => {
          let processingStatus = PROCESSING_STATUS_OPTIONS[0]?.value || '';
          const processingValue = row['Processing Status'] || '';
          for (const [code, display] of Object.entries(PROCESSING_STATUS_DISPLAY_MAP)) {
            if (display === processingValue) { processingStatus = code; break; }
          }

          let overallStatus = OVERALL_STATUS_OPTIONS[0]?.value || 'not_started';
          const overallValue = row['Overall Status'] || '';
          for (const [code, display] of Object.entries(OVERALL_STATUS_DISPLAY_MAP)) {
            if (display === overallValue) { overallStatus = code; break; }
          }

          let requestType = '';
          const typeValue = (row['Request Type'] || '').toString().trim();
          const matchedType = typeItems.find(t => t.label.toLowerCase() === typeValue.toLowerCase() || t.value === typeValue.toLowerCase().replace(/\s+/g, '_'));
          if (matchedType) requestType = matchedType.value;
          else if (typeValue) requestType = typeValue;

          return {
            sno: '',
            beelineId: String(row['Beeline ID'] || '').trim(),
            description: row['Description'] || '',
            raisedBy: row['Raised by'] || '',
            processingStatus,
            overallStatus,
            accountAnchor: row['Account Anchor'] || row['Account Anchor Assigned'] || '',
            dateRaised: formatDateToDDMMYYYY(row['Date Raised']),
            requestType,
            updatedOn: formatDateToDDMMYYYY(new Date().toISOString()),
          };
        }).filter(r => r.beelineId);

        if (!uploaded.length) { message.warning('No valid rows with Beeline ID found'); return; }

        let uploadSummary = { newCount: 0, updCount: 0 };
        let mergedRows: ClientRequest[] = [];

        setRequests(prev => {
          const existingMap = new Map(prev.map(r => [r.beelineId.toLowerCase(), r]));
          let newCount = 0, updCount = 0;
          uploaded.forEach(u => {
            const key = u.beelineId.toLowerCase();
            if (existingMap.has(key)) { existingMap.set(key, { ...existingMap.get(key)!, ...u, id: existingMap.get(key)!.id }); updCount++; }
            else { existingMap.set(key, u); newCount++; }
          });
          uploadSummary = { newCount, updCount };
          mergedRows = Array.from(existingMap.values()).map((r, i) => ({ ...r, sno: String(i + 1) }));
          return mergedRows;
        });

        // Save to DB outside the updater (avoids Strict Mode double-invoke)
        setTimeout(() => {
          requestApi.bulkSave(mergedRows.map(r => ({
            beelineId: r.beelineId, sno: Number(r.sno), description: r.description,
            raisedBy: r.raisedBy, processingStatus: r.processingStatus,
            overallStatus: r.overallStatus, accountAnchor: r.accountAnchor,
            dateRaised: r.dateRaised, requestType: r.requestType || '',
            updatedOn: r.updatedOn || '',
          }))).then(result => {
            if (result.ok) {
              setFromServer(true);
              // Re-fetch from server to get proper DB IDs for all records (esp. newly inserted)
              requestApi.getRequests().then(({ requests: fresh }) => {
                if (fresh.length > 0) {
                  setRequests(fresh.map((r: any, i: number) => ({
                    id: r.id, sno: String(r.sno || i + 1),
                    beelineId: String(r.beeline_id || r.beelineId || ''),
                    description: String(r.description || ''),
                    raisedBy: String(r.raised_by || r.raisedBy || ''),
                    processingStatus: String(r.processing_status || r.processingStatus || ''),
                    overallStatus: String(r.overall_status || r.overallStatus || ''),
                    accountAnchor: String(r.account_anchor || r.accountAnchor || ''),
                    dateRaised: String(r.date_raised || r.dateRaised || ''),
                    requestType: String(r.request_type || r.requestType || ''),
                    updatedOn: String(r.updated_on || r.updatedOn || ''),
                    isActive: r.is_active === undefined ? true : r.is_active !== 0,
                  })));
                }
              });
            }
          });
          message.success(`Upload complete: ${uploadSummary.newCount} new, ${uploadSummary.updCount} updated`);
        }, 0);
      } catch (error) {
        console.error('Upload error:', error);
        message.error('Failed to upload file');
      }
    };
    reader.onerror = () => message.error('Failed to read file');
    reader.readAsArrayBuffer(file);
    return false;
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
        'Account Anchor': 'Team A',
        'Date Raised': '01/01/2024',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'ClientM_Template.xlsx');
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
        setRequests(prev => prev.filter(r => r.sno !== request.sno));
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
    setRequests(prev => prev.map(r => r.id === request.id ? { ...r, isActive: newActive } : r));
    // If this request is currently open in the view panel, refresh it
    if (viewDetailRecord && viewDetailRecord.id === request.id) {
      setViewDetailRecord(prev => prev ? { ...prev, isActive: newActive } : prev);
    }
  };

  const handleSaveEdit = (values: any) => {
    if (editingRequest) {
      const updated = { ...editingRequest, ...values, updatedOn: formatDateToDDMMYYYY(new Date().toISOString()) };
      if (editingRequest.id) {
        requestApi.updateRequest(editingRequest.id, {
          description: updated.description, raisedBy: updated.raisedBy,
          processingStatus: updated.processingStatus, overallStatus: updated.overallStatus,
          accountAnchor: updated.accountAnchor, dateRaised: updated.dateRaised,
          requestType: updated.requestType || '', updatedOn: updated.updatedOn,
          changedBy: currentUser?.username || 'system',
        } as any);
      }
      setRequests(prev => prev.map(r => r.sno === editingRequest.sno ? updated : r));
    } else {
      const sno = (requests.length + 1).toString();
      const newReq: ClientRequest = {
        sno,
        ...values,
        dateRaised: formatDateToDDMMYYYY(values.dateRaised),
        updatedOn: formatDateToDDMMYYYY(new Date().toISOString()),
      };
      requestApi.createRequest({
        beelineId: newReq.beelineId, sno: Number(newReq.sno),
        description: newReq.description, raisedBy: newReq.raisedBy,
        processingStatus: newReq.processingStatus, overallStatus: newReq.overallStatus,
        accountAnchor: newReq.accountAnchor, dateRaised: newReq.dateRaised,
        requestType: newReq.requestType || '', updatedOn: newReq.updatedOn || '',
      }).then(result => {
        if (result.id) setRequests(prev => prev.map(r => r.sno === sno ? { ...r, id: result.id } : r));
      });
      setRequests(prev => [...prev, newReq]);
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
        setRequests(requests.filter(r => !selectedRowKeys.includes(r.sno)));
        setSelectedRowKeys([]);
      },
    });
  };

  const handleClearAll = async () => {
    await requestApi.clearAll(currentUser?.username);
    setRequests([]);
    setFromServer(false);
    message.success('All request data cleared');
  };

  const handleExportExcel = () => {
    if (!typeFilteredRequests.length) { message.warning('No data to export'); return; }
    const headers = ['S.No', 'Beeline ID', 'Type', 'Description', 'Raised By', 'Processing Status', 'Overall Status', 'Account Anchor', 'Date Raised'];
    const aoa: any[][] = [headers];
    typeFilteredRequests.forEach(r => {
      aoa.push([r.sno, r.beelineId, r.requestType || '', r.description || '', r.raisedBy, r.processingStatus || '', r.overallStatus || '', r.accountAnchor || '', r.dateRaised || '']);
    });
    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 16 }, { wch: 40 }, { wch: 20 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 14 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
    ws['!sheetViews'] = [{ showGridLines: false }];
    const numCols = headers.length, numRows = aoa.length;
    const hFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
    const hFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const eFill = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
    const wFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
    const tG = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
    const mN = { style: 'medium' as const, color: { rgb: '001529' } };
    for (let R = 0; R < numRows; R++) {
      for (let C = 0; C < numCols; C++) {
        const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
        ws[addr].s = {
          fill: R === 0 ? hFill : R % 2 === 0 ? eFill : wFill,
          font: R === 0 ? hFont : { sz: 10 },
          alignment: { vertical: 'center' as const, horizontal: 'left' as 'left', wrapText: false },
          border: { top: R === 0 ? mN : tG, bottom: R === numRows - 1 ? mN : tG, left: C === 0 ? mN : tG, right: C === numCols - 1 ? mN : tG },
        };
      }
    }
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Client Requests');
    XLSXStyle.writeFile(wb, `Client_Requests_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 26 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
    ws['!sheetViews'] = [{ showGridLines: false }];
    const numCols = headers.length, numRows = aoa.length;
    const hFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
    const hFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const eFill = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
    const wFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
    const tG = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
    const mN = { style: 'medium' as const, color: { rgb: '001529' } };
    for (let R = 0; R < numRows; R++) {
      for (let C = 0; C < numCols; C++) {
        const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
        ws[addr].s = {
          fill: R === 0 ? hFill : R % 2 === 0 ? eFill : wFill,
          font: R === 0 ? hFont : { sz: 10 },
          alignment: { vertical: 'center' as const, horizontal: 'left' as 'left', wrapText: false },
          border: { top: R === 0 ? mN : tG, bottom: R === numRows - 1 ? mN : tG, left: C === 0 ? mN : tG, right: C === numCols - 1 ? mN : tG },
        };
      }
    }
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Beeline Resource Mapping');
    XLSXStyle.writeFile(wb, `Beeline_Resource_Mapping_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Beeline-Resource mapping downloaded');
  };

  const handleNavigateToRequests = (filterCriteria: Record<string, any>) => {
    setFilters(filterCriteria);
    setShowFilterPanel(true);
    setActiveTab('overview');
  };

  const columns = [
    {
      title: 'S.No',
      key: 'sno',
      width: 80,
      fixed: 'left' as const,
      render: (_: unknown, __: ClientRequest, index: number) => index + 1,
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
      title: 'Account Anchor',
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

  // ── Resources state (for beeline linking) ────────────────────────────────
  const [allResources, setAllResources] = useState<ResourcePayload[]>([]);
  const [linkResourcesModal, setLinkResourcesModal] = useState<{ open: boolean; request: ClientRequest | null }>({ open: false, request: null });
  const [linkResourcesChecked, setLinkResourcesChecked] = useState<Set<number>>(new Set());
  const [savingLinks, setSavingLinks] = useState(false);
  const [loadingLinkResources, setLoadingLinkResources] = useState(false);

  // Compute linked count per beelineId from allResources
  const linkedCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    allResources.forEach(r => {
      if (r.beelineId) map[r.beelineId] = (map[r.beelineId] || 0) + 1;
    });
    return map;
  }, [allResources]);

  const mapResource = (r: any): ResourcePayload => ({
    id: r.id,
    sno: r.sno,
    raId: r.ra_id || r.raId || '',
    empName: r.emp_name || r.empName || '',
    emailId: r.email_id || r.emailId || '',
    piwRole: r.piw_role || r.piwRole || '',
    roleOrDomain: r.role_or_domain || r.roleOrDomain || '',
    previousWorkex: r.previous_workex || r.previousWorkex || '',
    doj: r.doj || '',
    totalWorkex: r.total_workex || r.totalWorkex || '',
    engagement: r.engagement || '',
    skills: r.skills || '',
    allocationStatus: r.allocation_status || r.allocationStatus || '',
    beelineId: r.beeline_id || r.beelineId || '',
  });

  const openLinkResourcesModal = async (request: ClientRequest) => {
    setLinkResourcesModal({ open: true, request });
    setLoadingLinkResources(true);
    setLinkResourcesChecked(new Set()); // clear while loading
    // Refresh resources so beeline IDs are current
    const { resources: rawRes } = await resourceApi.getResources();
    const mapped = rawRes.map(mapResource);
    setAllResources(mapped);
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
    // Refresh resources
    const { resources: rawRes } = await resourceApi.getResources();
    setAllResources(rawRes.map(mapResource));
    setSavingLinks(false);
    message.success('Resource links updated');
    setLinkResourcesModal({ open: false, request: null });
  };
  // ── End Resources state ───────────────────────────────────────────────────

  // Load from DB on mount
  useEffect(() => {
    setLoading(true);
    requestApi.getRequests().then(({ requests: apiRows, fromServer: online }) => {
      if (online && apiRows.length > 0) {
        const mapped: ClientRequest[] = apiRows.map((r: any, i: number) => ({
          id: r.id,
          sno: String(r.sno || i + 1),
          beelineId: String(r.beeline_id || r.beelineId || ''),
          description: String(r.description || ''),
          raisedBy: String(r.raised_by || r.raisedBy || ''),
          processingStatus: String(r.processing_status || r.processingStatus || ''),
          overallStatus: String(r.overall_status || r.overallStatus || ''),
          accountAnchor: String(r.account_anchor || r.accountAnchor || ''),
          dateRaised: String(r.date_raised || r.dateRaised || ''),
          requestType: String(r.request_type || r.requestType || ''),
          updatedOn: String(r.updated_on || r.updatedOn || ''),
          isActive: r.is_active === undefined ? (r.isActive === undefined ? true : r.isActive) : r.is_active !== 0,
        }));
        setRequests(mapped);
        setFromServer(true);
      }
    }).finally(() => setLoading(false));
    // Load all resources for beeline linking
    resourceApi.getResources().then(({ resources }) => setAllResources(resources.map(mapResource)));
  }, []);

  // Apply initial beeline filter when provided from navigation
  useEffect(() => {
    if (initialBeelineFilter) {
      setFilters(f => ({ ...f, beelineId: initialBeelineFilter }));
      setShowFilterPanel(true);
      onFilterApplied?.();
    }
  }, [initialBeelineFilter]); // eslint-disable-line react-hooks/exhaustive-deps
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

  const closeFilterOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilterPanel(false);
  };

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
                          <Dropdown trigger={['click']} menu={{ items: [
                            ...(canEdit ? [{ key: 'add', label: <span style={{ fontSize: '11px' }}>Add New Request</span>, icon: <PlusOutlined style={{ fontSize: '11px' }} />, onClick: handleAddNew }] : []),
                            { type: 'divider' as const },
                            { key: 'dlTemplate', label: <span style={{ fontSize: '11px' }}>Download Template</span>, icon: <DownloadOutlined style={{ fontSize: '11px' }} />, onClick: downloadTemplate },
                            ...(canEdit ? [{
                              key: 'ulRequest',
                              label: <span style={{ fontSize: '11px' }}>Upload Requests</span>,
                              icon: <UploadOutlined style={{ fontSize: '11px' }} />,
                              onClick: () => {
                                const inp = document.createElement('input');
                                inp.type = 'file'; inp.accept = '.xlsx,.xls';
                                inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleUpload(f); };
                                inp.click();
                              },
                            }] : []),
                            ...(canDelete && requests.length > 0 ? [
                              { type: 'divider' as const },
                              {
                                key: 'deleteAll',
                                label: <span style={{ fontSize: '11px' }}>Delete All Requests</span>,
                                icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                                danger: true,
                                onClick: () => Modal.confirm({
                                  title: 'Delete all requests?',
                                  content: 'This will permanently delete all request data from the database.',
                                  okText: 'Yes, delete all',
                                  cancelText: 'Cancel',
                                  okButtonProps: { danger: true, size: 'small' },
                                  onOk: handleClearAll,
                                }),
                              },
                            ] : []),
                          ]}}>
                            <Button icon={<MoreOutlined />} size="small" style={{ borderRadius: '6px' }} />
                          </Dropdown>
                        </Space>
                      </Space>

                      {selectedRowKeys.length > 0 && (
                        <div style={{ background: '#f0f2f5', padding: '12px 16px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text>{selectedRowKeys.length} record(s) selected</Text>
                          <Space>
                            <Popover
                              content={
                                <div style={{ minWidth: '180px' }}>
                                  {OVERALL_STATUS_OPTIONS.map(status => (
                                    <div
                                      key={status.value}
                                      onClick={() => {
                                        setRequests(requests.map(r =>
                                          selectedRowKeys.includes(r.sno)
                                            ? { ...r, overallStatus: status.value, updatedOn: formatDateToDDMMYYYY(new Date().toISOString()) }
                                            : r
                                        ));
                                        setSelectedRowKeys([]);
                                      }}
                                      style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        transition: 'background 0.2s',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      {status.label}
                                    </div>
                                  ))}
                                </div>
                              }
                              trigger={['click']}
                              placement="top"
                            >
                              <Button size="small" style={{ fontSize: '11px', color: '#262626' }}>Update Status</Button>
                            </Popover>
                            <Popover
                              content={
                                <div style={{ minWidth: '200px' }}>
                                  {PROCESSING_STATUS_OPTIONS.map(status => (
                                    <div
                                      key={status.value}
                                      onClick={() => {
                                        setRequests(requests.map(r =>
                                          selectedRowKeys.includes(r.sno)
                                            ? { ...r, processingStatus: status.value, updatedOn: formatDateToDDMMYYYY(new Date().toISOString()) }
                                            : r
                                        ));
                                        setSelectedRowKeys([]);
                                      }}
                                      style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        fontSize: '11px',
                                        borderRadius: '4px',
                                        transition: 'background 0.2s',
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                      {status.label}
                                    </div>
                                  ))}
                                </div>
                              }
                              trigger={['click']}
                              placement="top"
                            >
                              <Button size="small" style={{ fontSize: '11px', color: '#262626' }}>Update Processing Status</Button>
                            </Popover>
                            <Button size="small" style={{ fontSize: '11px', color: '#262626' }} onClick={handleBulkDelete} icon={<DeleteOutlined />}>Delete</Button>
                            <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSelectedRowKeys([])} />
                          </Space>
                        </div>
                      )}

                      {viewMode === 'table' ? (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          {showFilterPanel && (
                            <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <Text strong style={{ fontSize: '12px' }}>Filters</Text>
                                <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({})}>Clear all</Button>
                              </div>
                              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline ID</div>
                                  <Input size="small" placeholder="Search..." value={filters.beelineId || ''} onChange={e => setFilters({ ...filters, beelineId: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Account Anchor</div>
                                  <Input size="small" placeholder="Search..." value={filters.accountAnchor || ''} onChange={e => setFilters({ ...filters, accountAnchor: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Overall Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.overallStatus || undefined} onChange={val => setFilters({ ...filters, overallStatus: val })} options={OVERALL_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Processing Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.processingStatus || undefined} onChange={val => setFilters({ ...filters, processingStatus: val })} options={PROCESSING_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                                 <div>
                                   <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Request Type</div>
                                   <Select size="small" placeholder="All" allowClear value={filters.requestType || undefined} onChange={val => setFilters({ ...filters, requestType: val })} options={REQUEST_TYPE_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                 </div>
                                 <div>
                                   <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline Status</div>
                                   <Select size="small" placeholder="All" allowClear value={filters.isActive || undefined} onChange={val => setFilters({ ...filters, isActive: val })} options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} style={{ width: '100%', fontSize: '11px' }} />
                                 </div>
                              </Space>
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="compact-table">
                              <Table<ClientRequest>
                                dataSource={typeFilteredRequests}
                                columns={displayColumns}
                                pagination={{ pageSize: 15, showSizeChanger: false }}
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
                            <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <Text strong style={{ fontSize: '12px' }}>Filters</Text>
                                <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({})}>Clear all</Button>
                              </div>
                              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline ID</div>
                                  <Input size="small" placeholder="Search..." value={filters.beelineId || ''} onChange={e => setFilters({ ...filters, beelineId: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Account Anchor</div>
                                  <Input size="small" placeholder="Search..." value={filters.accountAnchor || ''} onChange={e => setFilters({ ...filters, accountAnchor: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Overall Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.overallStatus || undefined} onChange={val => setFilters({ ...filters, overallStatus: val })} options={OVERALL_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Processing Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.processingStatus || undefined} onChange={val => setFilters({ ...filters, processingStatus: val })} options={PROCESSING_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                                 <div>
                                   <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Request Type</div>
                                   <Select size="small" placeholder="All" allowClear value={filters.requestType || undefined} onChange={val => setFilters({ ...filters, requestType: val })} options={REQUEST_TYPE_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                 </div>
                                  <div>
                                    <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline Status</div>
                                    <Select size="small" placeholder="All" allowClear value={filters.isActive || undefined} onChange={val => setFilters({ ...filters, isActive: val })} options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} style={{ width: '100%', fontSize: '11px' }} />
                                  </div>
                              </Space>
                            </div>
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
                                          items: [
                                            canEdit ? {
                                              key: "edit",
                                              label: <span style={{ fontSize: '11px' }}>Edit</span>,
                                              icon: <EditOutlined style={{ fontSize: '11px' }} />,
                                              onClick: () => handleEdit(request),
                                            } : null,
                                            {
                                              key: "linkResources",
                                              label: <span style={{ fontSize: '11px' }}>Link Resources</span>,
                                              icon: <LinkOutlined style={{ fontSize: '11px' }} />,
                                              onClick: () => openLinkResourcesModal(request),
                                            },
                                            canEdit ? {
                                              key: "toggleActive",
                                              label: <span style={{ fontSize: '11px' }}>{request.isActive === false ? 'Mark Active' : 'Mark Inactive'}</span>,
                                              icon: request.isActive === false
                                                ? <CheckCircleOutlined style={{ fontSize: '11px', color: '#52c41a' }} />
                                                : <StopOutlined style={{ fontSize: '11px', color: '#fa8c16' }} />,
                                              onClick: () => handleToggleActive(request),
                                            } : null,
                                            canDelete ? {
                                              key: "delete",
                                              label: <span style={{ fontSize: '11px' }}>Delete</span>,
                                              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                                              danger: true,
                                              onClick: () => handleDelete(request),
                                            } : null,
                                          ].filter(Boolean) as any[],
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
                                    Updated: {formatDateReadable(request.updatedOn) || '-'}
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
                          setRequests(prev => prev.map(r => r.id === id ? { ...r, isActive } : r));
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
              { key: 'accountAnchor', label: 'Account Anchor' },
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
              <Input disabled={!!editingRequest} style={editingRequest ? { color: '#595959', background: '#f5f5f5' } : {}} />
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
            <Form.Item name="accountAnchor" label="Account Anchor">
              <Input />
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
        onCancel={() => setLinkResourcesModal({ open: false, request: null })}
        onOk={handleSaveLinks}
        okText="Save Links"
        confirmLoading={savingLinks}
        width={480}
        destroyOnClose
      >
        {linkResourcesModal.request && (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
              Select resources to link to <strong>{linkResourcesModal.request.beelineId}</strong>.
              Resources already linked to another Beeline ID will be re-linked to this one.
            </div>
            <Spin spinning={loadingLinkResources} tip="Loading resources…" size="small">
              <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, minHeight: 60 }}>
                {!loadingLinkResources && allResources.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '12px' }}>No resources available</div>
                ) : allResources.map((r: ResourcePayload) => {
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
            <div style={{ fontSize: '11px', color: '#595959', fontWeight: 500 }}>
              {linkResourcesChecked.size} resource(s) selected
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
}










