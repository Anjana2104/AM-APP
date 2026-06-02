import React, { useState, useMemo } from 'react';
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
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, any>>({});
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
  const handleUpload = (file: any) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        const newRequests: ClientRequest[] = jsonData.map((row: any, idx: number) => {
          const sno = requests.length + idx + 1;
          
          // Convert display name to internal code for processing status
          let processingStatus: ProcessingStatusType = 'accepted_staffing';
          const processingValue = row['Processing Status'] || '';
          for (const [code, display] of Object.entries(PROCESSING_STATUS_DISPLAY_MAP)) {
            if (display === processingValue) {
              processingStatus = code as ProcessingStatusType;
              break;
            }
          }
          
          // Convert display name to internal code for overall status
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
        message.error('Failed to upload file');
      }
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
      render: (text: string) => <span style={{ maxWidth: '300px' }}>{text}</span>,
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
        <Badge
          color={getOverallStatusColor(status)}
          text={OVERALL_STATUS_DISPLAY_MAP[status] || status}
        />
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

  // Click outside to deselect
  const handleContainerClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setSelectedRowKeys([]);
    }
  };

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {requests.length > 0 ? (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '24px' }}>
            <Tabs
              items={[
                {
                  key: 'views',
                  label: 'Requests',
                  children: (
                    <div onClick={handleContainerClick} style={{ minHeight: '500px' }}>
                      <Space style={{ marginBottom: '16px', width: '100%', justifyContent: 'space-between', display: 'flex' }} direction="horizontal">
                        <Text type="secondary">Showing: <strong>{filteredRequests.length}</strong> {filteredRequests.length !== requests.length ? `/ ${requests.length}` : ''}</Text>
                        <Space wrap size={8}>
                          <Tooltip title="Card View">
                            <Button
                              icon={<AppstoreOutlined />}
                              type={viewMode === 'card' ? 'primary' : 'default'}
                              size="small"
                              onClick={() => setViewMode('card')}
                              style={{ borderRadius: '6px' }}
                            />
                          </Tooltip>
                          <Tooltip title="Table View">
                            <Button
                              icon={<TableOutlined />}
                              type={viewMode === 'table' ? 'primary' : 'default'}
                              size="small"
                              onClick={() => setViewMode('table')}
                              style={{ borderRadius: '6px' }}
                            />
                          </Tooltip>
                          <Tooltip title="Upload">
                            <Upload
                              accept=".xlsx,.xls"
                              beforeUpload={handleUpload}
                              showUploadList={false}
                            >
                              <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                            </Upload>
                          </Tooltip>
                          <Tooltip title="Download Template">
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
                            <Button danger size="small" onClick={handleBulkDelete} icon={<DeleteOutlined />}>Delete</Button>
                            <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => setSelectedRowKeys([])} />
                          </Space>
                        </div>
                      )}

                      {viewMode === 'table' ? (
                        <div>
                          <Table<ClientRequest>
                            dataSource={filteredRequests}
                            columns={displayColumns}
                            pagination={{ pageSize: 20, showSizeChanger: true }}
                            scroll={{ x: 'max-content' }}
                            size="small"
                            rowSelection={{
                              selectedRowKeys,
                              onChange: (keys) => setSelectedRowKeys(keys as string[]),
                              type: 'checkbox',
                            }}
                            rowKey="sno"
                          />
                        </div>
                      ) : (
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                                  <div>
                                    <Text strong>{request.beelineId}</Text>
                                    <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{request.raisedBy}</div>
                                  </div>
                                  <div style={{ textAlign: 'right', fontSize: '10px' }}>
                                    <div style={{ color: '#262626', fontWeight: '500', marginBottom: '4px' }}>{request.accountAnchor}</div>
                                    <Dropdown
                                      menu={{
                                        items: [
                                          {
                                            key: 'edit',
                                            label: 'Edit',
                                            icon: <EditOutlined />,
                                            onClick: () => handleEdit(request),
                                          },
                                          {
                                            key: 'delete',
                                            label: 'Delete',
                                            icon: <DeleteOutlined />,
                                            danger: true,
                                            onClick: () => handleDelete(request),
                                          },
                                        ],
                                      }}
                                      trigger={['click']}
                                    >
                                      <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: 0 }} />
                                    </Dropdown>
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
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '8px', padding: '60px 24px', textAlign: 'center' }}>
            <Text type="secondary">No requests yet. Upload a file or add a new request to get started.</Text>
            <div style={{ marginTop: '16px' }}>
              <Upload
                accept=".xlsx,.xls"
                beforeUpload={handleUpload}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />} type="primary">Upload File</Button>
              </Upload>
              <Button onClick={handleAddNew} style={{ marginLeft: '8px' }}>+ Add Request</Button>
            </div>
          </div>
        )}

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
