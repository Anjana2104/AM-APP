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
  DatePicker,
  Spin,
  Badge,
  Typography,
  Filter,
  Pagination,
  Checkbox,
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
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { RequestInsights } from './RequestInsights';
import '../style.css';

// Types and interfaces
type ProcessingStatusType = 
  | 'accepted_staffing'
  | 'resource_shortlisted'
  | 'uploaded_profile_beeline'
  | 'resource_assessment_scheduled'
  | 'resource_assessment_completed'
  | 'resource_selected'
  | 'resource_rejected'
  | 'zs_onboarding_initiated'
  | 'onboarded_in_zs'
  | 'zs_offboarding_initiated'
  | 'resource_offboarded';

type OverallStatusType = 
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'cancelled';

interface ClientRequest {
  sno: string;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: ProcessingStatusType;
  overallStatus: OverallStatusType;
  accountAnchor: string;
  dateRaised: string;
  updatedOn?: string;
}

// Constants
const PROCESSING_STATUS_DISPLAY_MAP: Record<ProcessingStatusType, string> = {
  'accepted_staffing': 'Accepted by Staffing Team',
  'resource_shortlisted': 'Resource Shortlisted',
  'uploaded_profile_beeline': 'Uploaded Profile on Beeline',
  'resource_assessment_scheduled': 'Resource Assessment Scheduled',
  'resource_assessment_completed': 'Resource Assessment Completed',
  'resource_selected': 'Resource Selected',
  'resource_rejected': 'Resource Rejected',
  'zs_onboarding_initiated': 'ZS Onboarding Initiated',
  'onboarded_in_zs': 'Onboarded in ZS',
  'zs_offboarding_initiated': 'ZS Offboarding Initiated',
  'resource_offboarded': 'Resource Offboarded',
};

const OVERALL_STATUS_DISPLAY_MAP: Record<OverallStatusType, string> = {
  'not_started': 'Not Started',
  'in_progress': 'In Progress',
  'completed': 'Completed',
  'blocked': 'Blocked',
  'cancelled': 'Cancelled',
};

const PROCESSING_STATUS_OPTIONS = [
  { label: 'Accepted by Staffing Team', value: 'accepted_staffing' },
  { label: 'Resource Shortlisted', value: 'resource_shortlisted' },
  { label: 'Uploaded Profile on Beeline', value: 'uploaded_profile_beeline' },
  { label: 'Resource Assessment Scheduled', value: 'resource_assessment_scheduled' },
  { label: 'Resource Assessment Completed', value: 'resource_assessment_completed' },
  { label: 'Resource Selected', value: 'resource_selected' },
  { label: 'Resource Rejected', value: 'resource_rejected' },
  { label: 'ZS Onboarding Initiated', value: 'zs_onboarding_initiated' },
  { label: 'Onboarded in ZS', value: 'onboarded_in_zs' },
  { label: 'ZS Offboarding Initiated', value: 'zs_offboarding_initiated' },
  { label: 'Resource Offboarded', value: 'resource_offboarded' },
];

const OVERALL_STATUS_OPTIONS = [
  { label: 'Not Started', value: 'not_started' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Blocked', value: 'blocked' },
  { label: 'Cancelled', value: 'cancelled' },
];

// Utility Functions
const formatDateToDDMMYYYY = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  const parsed = dayjs(dateString);
  if (parsed.isValid()) {
    return parsed.format('DD/MM/YYYY');
  }
  
  return dateString;
};

const getOverallStatusColor = (status: OverallStatusType): string => {
  const colors: Record<OverallStatusType, string> = {
    'not_started': '#1890ff',
    'in_progress': '#faad14',
    'completed': '#52c41a',
    'blocked': '#f5222d',
    'cancelled': '#666666',
  };
  return colors[status] || '#000000';
};

const getOverallStatusBackgroundColor = (status: OverallStatusType): string => {
  const colors: Record<OverallStatusType, string> = {
    'not_started': '#e6f7ff',
    'in_progress': '#fffbe6',
    'completed': '#f6ffed',
    'blocked': '#fff1f0',
    'cancelled': '#fafafa',
  };
  return colors[status] || '#f5f5f5';
};

// Main Component
export default function ClientM() {
  const [requests, setRequests] = useState<ClientRequest[]>([]);
  const [form] = Form.useForm();
  const [editDrawer, setEditDrawer] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ClientRequest | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    sno: true,
    beelineId: true,
    description: true,
    raisedBy: true,
    processingStatus: true,
    overallStatus: true,
    accountAnchor: true,
    dateRaised: true,
  });

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      for (const [key, value] of Object.entries(filters)) {
        if (!value) continue;
        
        if (key === 'sno' && !req.sno.toString().includes(value)) return false;
        if (key === 'beelineId' && !req.beelineId.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'description' && !req.description.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'raisedBy' && !req.raisedBy.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'accountAnchor' && !req.accountAnchor.toLowerCase().includes(value.toLowerCase())) return false;
        if (key === 'processingStatus' && req.processingStatus !== value) return false;
        if (key === 'overallStatus' && req.overallStatus !== value) return false;
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

        const newRequests: ClientRequest[] = jsonData.map((row: any, idx: number) => {
          const sno = requests.length + idx + 1;
          
          let processingStatus: ProcessingStatusType = 'accepted_staffing';
          const processingValue = row['Processing Status'] || '';
          for (const [code, display] of Object.entries(PROCESSING_STATUS_DISPLAY_MAP)) {
            if (display === processingValue) {
              processingStatus = code as ProcessingStatusType;
              break;
            }
          }
          
          let overallStatus: OverallStatusType = 'not_started';
          const overallValue = row['Overall Status'] || '';
          for (const [code, display] of Object.entries(OVERALL_STATUS_DISPLAY_MAP)) {
            if (display === overallValue) {
              overallStatus = code as OverallStatusType;
              break;
            }
          }
          
          return {
            sno: sno.toString(),
            beelineId: row['Beeline ID'] || '',
            description: row['Description'] || '',
            raisedBy: row['Raised by'] || '',
            processingStatus,
            overallStatus,
            accountAnchor: row['Account Anchor'] || row['Account Anchor Assigned'] || '',
            dateRaised: formatDateToDDMMYYYY(row['Date Raised']),
            updatedOn: formatDateToDDMMYYYY(new Date().toISOString()),
          };
        });

        setRequests([...requests, ...newRequests]);
        message.success(`${newRequests.length} records uploaded successfully`);
      } catch (error) {
        console.error('Upload error:', error);
        message.error('Failed to upload file');
      }
    };
    
    reader.onerror = () => {
      message.error('Failed to read file');
    };

    reader.readAsArrayBuffer(file);
    return false;
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Beeline ID': 'BL-001',
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
        setRequests(requests.filter(r => r.sno !== request.sno));
      },
    });
  };

  const handleSaveEdit = (values: any) => {
    if (editingRequest) {
      setRequests(requests.map(r =>
        r.sno === editingRequest.sno
          ? { ...r, ...values, updatedOn: formatDateToDDMMYYYY(new Date().toISOString()) }
          : r
      ));
    } else {
      const sno = (requests.length + 1).toString();
      setRequests([
        ...requests,
        {
          sno,
          ...values,
          dateRaised: formatDateToDDMMYYYY(values.dateRaised),
          updatedOn: formatDateToDDMMYYYY(new Date().toISOString()),
        },
      ]);
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
        setRequests(requests.filter(r => !selectedRowKeys.includes(r.sno)));
        setSelectedRowKeys([]);
      },
    });
  };

  // Table columns
  const columns = [
    {
      title: 'S.No',
      dataIndex: 'sno',
      key: 'sno',
      width: 80,
      hidden: !visibleColumns.sno,
    },
    {
      title: 'Beeline ID',
      dataIndex: 'beelineId',
      key: 'beelineId',
      width: 130,
      hidden: !visibleColumns.beelineId,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      hidden: !visibleColumns.description,
      render: (text: string) => (
        <Tooltip title={<span style={{ fontSize: '11px' }}>{text}</span>}>
          <span style={{ maxWidth: '200px', display: 'inline-block', fontSize: '11px' }}>
            {text ? (text.substring(0, 50) + (text.length > 50 ? '...' : '')) : '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: 'Raised By',
      dataIndex: 'raisedBy',
      key: 'raisedBy',
      width: 120,
      hidden: !visibleColumns.raisedBy,
    },
    {
      title: 'Processing Status',
      dataIndex: 'processingStatus',
      key: 'processingStatus',
      width: 150,
      hidden: !visibleColumns.processingStatus,
      render: (status: ProcessingStatusType) => PROCESSING_STATUS_DISPLAY_MAP[status] || status,
    },
    {
      title: 'Overall Status',
      dataIndex: 'overallStatus',
      key: 'overallStatus',
      width: 130,
      hidden: !visibleColumns.overallStatus,
      render: (status: OverallStatusType) => (
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
      hidden: !visibleColumns.accountAnchor,
    },
    {
      title: 'Date Raised',
      dataIndex: 'dateRaised',
      key: 'dateRaised',
      width: 120,
      hidden: !visibleColumns.dateRaised,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_: any, record: ClientRequest) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            style={{ fontSize: '12px' }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            style={{ fontSize: '12px' }}
          />
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

  const isFilterApplied = Object.values(filters).some(v => v);

  const filterPanelRef = useRef<HTMLDivElement>(null);
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
          <div>
            <Typography.Title level={4} style={{ marginBottom: 2 }}>Client Requests</Typography.Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>Manage client requests, staffing status, and processing</Text>
          </div>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '16px' }}>
        {requests.length > 0 ? (
          <Tabs
            destroyInactiveTabPane
            items={[
              {
                key: 'views',
                label: 'Requests',
                  children: (
                    <div onClick={handleContainerClick} style={{ minHeight: '500px' }}>
                      <Space style={{ marginBottom: '16px', width: '100%', justifyContent: 'space-between', display: 'flex' }} direction="horizontal">
                        <Text type="secondary">Showing: <strong>{filteredRequests.length}</strong> {filteredRequests.length !== requests.length ? `/ ${requests.length}` : ''}</Text>
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
                          <Tooltip title="Upload" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Upload
                              accept=".xlsx,.xls"
                              beforeUpload={handleUpload}
                              showUploadList={false}
                            >
                              <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                            </Upload>
                          </Tooltip>
                          <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<DownloadOutlined />} onClick={downloadTemplate} size="small" style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Button type="default" size="small" style={{ borderRadius: '6px', fontSize: '11px' }} onClick={handleAddNew}>+ Add Request</Button>
                        </Space>
                      </Space>

                      {selectedRowKeys.length > 0 && (
                        <div style={{ background: '#f0f2f5', padding: '12px 16px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text>{selectedRowKeys.length} record(s) selected</Text>
                          <Space>
                            <Popover
                              content={
                                <Space direction="vertical" size={4} style={{ width: '150px' }}>
                                  {OVERALL_STATUS_OPTIONS.map(status => (
                                    <Button
                                      key={status.value}
                                      type="text"
                                      size="small"
                                      onClick={() => {
                                        setRequests(requests.map(r =>
                                          selectedRowKeys.includes(r.sno)
                                            ? { ...r, overallStatus: status.value as OverallStatusType, updatedOn: formatDateToDDMMYYYY(new Date().toISOString()) }
                                            : r
                                        ));
                                        setSelectedRowKeys([]);
                                      }}
                                      style={{ width: '100%', textAlign: 'left' }}
                                    >
                                      {status.label}
                                    </Button>
                                  ))}
                                </Space>
                              }
                              trigger={['click']}
                              placement="top"
                            >
                              <Button size="small" style={{ fontSize: '11px', color: '#262626' }}>Update Status</Button>
                            </Popover>
                            <Popover
                              content={
                                <Space direction="vertical" size={4} style={{ width: '180px' }}>
                                  {PROCESSING_STATUS_OPTIONS.map(status => (
                                    <Button
                                      key={status.value}
                                      type="text"
                                      size="small"
                                      onClick={() => {
                                        setRequests(requests.map(r =>
                                          selectedRowKeys.includes(r.sno)
                                            ? { ...r, processingStatus: status.value as ProcessingStatusType, updatedOn: formatDateToDDMMYYYY(new Date().toISOString()) }
                                            : r
                                        ));
                                        setSelectedRowKeys([]);
                                      }}
                                      style={{ width: '100%', textAlign: 'left' }}
                                    >
                                      {status.label}
                                    </Button>
                                  ))}
                                </Space>
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
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Name</div>
                                  <Input size="small" placeholder="Search..." value={filters.raisedBy || ''} onChange={e => setFilters({ ...filters, raisedBy: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Account Anchor</div>
                                  <Input size="small" placeholder="Search..." value={filters.accountAnchor || ''} onChange={e => setFilters({ ...filters, accountAnchor: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Description</div>
                                  <Input size="small" placeholder="Search..." value={filters.description || ''} onChange={e => setFilters({ ...filters, description: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Overall Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.overallStatus || undefined} onChange={val => setFilters({ ...filters, overallStatus: val })} options={OVERALL_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Processing Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.processingStatus || undefined} onChange={val => setFilters({ ...filters, processingStatus: val })} options={PROCESSING_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                              </Space>
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div className="compact-table">
                              <Table<ClientRequest>
                                dataSource={filteredRequests}
                                columns={displayColumns}
                                pagination={{ pageSize: 15, showSizeChanger: false }}
                                scroll={{ x: 'max-content', y: 420 }}
                                size="small"
                                rowSelection={{
                                  selectedRowKeys,
                                  onChange: (keys) => setSelectedRowKeys(keys as string[]),
                                  type: 'checkbox',
                                }}
                                rowKey="sno"
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
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Name</div>
                                  <Input size="small" placeholder="Search..." value={filters.raisedBy || ''} onChange={e => setFilters({ ...filters, raisedBy: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Account Anchor</div>
                                  <Input size="small" placeholder="Search..." value={filters.accountAnchor || ''} onChange={e => setFilters({ ...filters, accountAnchor: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Description</div>
                                  <Input size="small" placeholder="Search..." value={filters.description || ''} onChange={e => setFilters({ ...filters, description: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Overall Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.overallStatus || undefined} onChange={val => setFilters({ ...filters, overallStatus: val })} options={OVERALL_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                                <div>
                                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Processing Status</div>
                                  <Select size="small" placeholder="All" allowClear value={filters.processingStatus || undefined} onChange={val => setFilters({ ...filters, processingStatus: val })} options={PROCESSING_STATUS_OPTIONS} style={{ width: '100%', fontSize: '11px' }} />
                                </div>
                              </Space>
                            </div>
                          )}
                          <div style={{ flex: 1 }}>
                            <Row gutter={[16, 16]}>
                          {filteredRequests.map(request => (
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
                                  border: selectedRowKeys.includes(request.sno) ? '2px solid #1a1a1a' : '1px solid #d9d9d9',
                                  cursor: 'pointer',
                                  backgroundColor: selectedRowKeys.includes(request.sno) ? '#f5f5f5' : '#ffffff',
                                  padding: '12px',
                                }}
                              >
                                 <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
                                   <div>
                                     <Text strong style={{ fontSize: "13px" }}>{request.beelineId}</Text>
                                     <div style={{ fontSize: "12px", color: "#8c8c8c" }}>{request.raisedBy}</div>
                                   </div>
                                   <div style={{ textAlign: "right" }}>
                                     <Dropdown
                                        menu={{
                                          items: [
                                            {
                                              key: "edit",
                                              label: <span style={{ fontSize: '11px' }}>Edit</span>,
                                              icon: <EditOutlined style={{ fontSize: '11px' }} />,
                                              onClick: () => handleEdit(request),
                                            },
                                            {
                                              key: "delete",
                                              label: <span style={{ fontSize: '11px' }}>Delete</span>,
                                              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                                              danger: true,
                                              onClick: () => handleDelete(request),
                                            },
                                          ],
                                        }}
                                       trigger={["click"]}
                                     >
                                       <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: 0 }} />
                                     </Dropdown>
                                     <div style={{ fontSize: "11px", color: "#262626", fontWeight: "500", marginTop: "4px" }}>{request.accountAnchor}</div>
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
                                    Updated: {request.updatedOn || '-'}
                                  </Text>
                                </div>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                          </div>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'insights',
                  label: <span><BarChartOutlined /> Insights</span>,
                  children: <RequestInsights requests={requests} />,
                },
              ]}
            />
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <Space wrap size={8}>
                  <Tooltip title="Upload" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
                      <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                    </Upload>
                  </Tooltip>
                  <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button icon={<DownloadOutlined />} onClick={downloadTemplate} size="small" style={{ borderRadius: '6px' }} />
                  </Tooltip>
                  <Button type="default" size="small" style={{ borderRadius: '6px', fontSize: '11px' }} onClick={handleAddNew}>+ Add Request</Button>
                </Space>
              </div>
              <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: '60px 24px', textAlign: 'center' }}>
                <Text type="secondary">No requests yet. Upload a file or add a new request to get started.</Text>
              </div>
            </>
          )}
          </div>
        </Space>

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
                  onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
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
    </div>
  );
}
