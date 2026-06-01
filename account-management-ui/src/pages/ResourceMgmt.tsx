import React, { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  Table,
  Typography,
  Space,
  Button,
  message,
  Drawer,
  Tag,
  Segmented,
  Modal,
  Form,
  Input,
  Tooltip,
  Slider,
  Checkbox,
  Select,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  ColumnHeightOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

export type ResourceRow = {
  key: string;
  sno: string;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string;
  roleOrDomain: string;
  previousWorkex: string;
  doj: string;
  totalWorkex: string;
  skills: string;
  engagement?: string;
  allocationRequests?: Array<{
    id: string;
    clientName: string;
    engagementName: string;
    status: 'shortlisted' | 'offered' | 'selected' | 'rejected' | 'joined';
    createdDate: string;
    notes?: string;
  }>;
};

type ExcelRow = Record<string, string | undefined>;

type FilterState = {
  sno: string;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string;
  roleOrDomain: string;
  totalWorkex: string;
  skills: string;
  engagement: string;
  workexRange: [number, number];
};

const DEFAULT_FILTERS: FilterState = {
  sno: '',
  raId: '',
  empName: '',
  emailId: '',
  piwRole: '',
  roleOrDomain: '',
  totalWorkex: '',
  skills: '',
  engagement: '',
  workexRange: [0, 100],
};

const COLUMN_KEYS = ['sno', 'raId', 'empName', 'emailId', 'piwRole', 'roleOrDomain', 'previousWorkex', 'doj', 'totalWorkex', 'engagement', 'skills', 'action'] as const;

const COLUMN_LABELS: Record<string, string> = {
  sno: 'S.NO',
  raId: 'RA ID',
  empName: 'Employee Name',
  emailId: 'Email Id',
  piwRole: 'PIW Role',
  roleOrDomain: 'Role/Domain',
  previousWorkex: 'Previous Workex',
  doj: 'DOJ',
  totalWorkex: 'Total Workex',
  engagement: 'Current Engagement',
  skills: 'Skills',
};

const ResourceMgmt: React.FC<{ onResourcesChange?: (resources: ResourceRow[]) => void }> = ({ onResourcesChange }) => {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  
  // Notify parent when resources change
  const handleResourcesChange = (newResources: ResourceRow[]) => {
    setResources(newResources);
    onResourcesChange?.(newResources);
  };
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [editDrawer, setEditDrawer] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);
  const [form] = Form.useForm();
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(COLUMN_KEYS)
  );
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const handleUpload = useCallback((file: File) => {
    try {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          if (!data) {
            message.error('Failed to read file');
            return;
          }

          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames?.[0];
          if (!sheetName) {
            message.error('No worksheet found in file');
            return;
          }

          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            message.error('Invalid worksheet');
            return;
          }

          const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
          if (!Array.isArray(jsonData) || jsonData.length === 0) {
            message.error('No data found in file');
            return;
          }

          const newResources: ResourceRow[] = jsonData.map((row, idx) => {
            const newKey = String(resources.length + idx + 1);
            return {
              key: newKey,
              sno: newKey,
              raId: String(row['RA ID'] || row['Ra ID'] || row['ra ID'] || ''),
              empName: String(row['Emp Name'] || row['Employee Name'] || row['emp Name'] || ''),
              emailId: String(row['Email Id'] || row['Email ID'] || row['email Id'] || ''),
              piwRole: String(row['PIW Role'] || row['piw Role'] || row['Role'] || ''),
              roleOrDomain: String(row['Role/Domain'] || row['Domain'] || ''),
              previousWorkex: String(row['Previous Workex'] || row['Prev Workex'] || ''),
              doj: String(row['DOJ'] || row['Date of Joining'] || ''),
              totalWorkex: String(row['Total Workex'] || row['Total Experience'] || ''),
              skills: String(row['Skills'] || ''),
              engagement: String(row['Current Engagement'] || row['Engagement'] || row['engagement'] || ''),
            };
          });

          handleResourcesChange([...resources, ...newResources]);
          message.success(`${newResources.length} resources imported successfully`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Error parsing file';
          message.error(`Error: ${errorMsg}. Please check the format.`);
        }
      };

      reader.onerror = () => {
        message.error('Failed to read file');
      };

      reader.readAsBinaryString(file);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Upload error';
      message.error(`Error: ${errorMsg}`);
    }
    return false;
  }, [resources.length]);

  const downloadTemplate = useCallback(() => {
    try {
      const template = [
        {
          'S.NO': '1',
          'RA ID': 'RA001',
          'Emp Name': 'John Doe',
          'Email Id': 'john.doe@example.com',
          'PIW Role': 'Developer',
          'Role/Domain': 'Full Stack',
          'Previous Workex': '2 years',
          'DOJ': '2024-01-15',
          'Total Workex': '5 years',
          'Current Engagement': 'Full-time',
          'Skills': 'JavaScript, React, Node.js',
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(template);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 12 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 40 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resources');
      XLSX.writeFile(workbook, 'Resource_Template.xlsx');
      message.success('Template downloaded successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Download error';
      message.error(`Error: ${errorMsg}`);
    }
  }, []);

  const handleAddNew = useCallback(() => {
    form.resetFields();
    setEditingResource(null);
    setEditDrawer(true);
  }, [form]);

  const handleEdit = useCallback((resource: ResourceRow | null) => {
    if (!resource) return;

    setEditingResource(resource);
    form.setFieldsValue({
      sno: resource.sno || '',
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
    });
    setEditDrawer(true);
  }, [form]);

  const handleSaveEdit = useCallback(
    async (values: any) => {
      try {
        if (!values || typeof values !== 'object') {
          message.error('Invalid form data');
          return;
        }

        if (editingResource && editingResource.key) {
          handleResourcesChange(
            resources.map((r) =>
              r.key === editingResource.key
                ? {
                    ...r,
                    raId: String(values.raId || ''),
                    empName: String(values.empName || ''),
                    emailId: String(values.emailId || ''),
                    piwRole: String(values.piwRole || ''),
                    roleOrDomain: String(values.roleOrDomain || ''),
                    previousWorkex: String(values.previousWorkex || ''),
                    doj: String(values.doj || ''),
                    totalWorkex: String(values.totalWorkex || ''),
                    skills: String(values.skills || ''),
                    engagement: String(values.engagement || ''),
                  }
                : r
            )
          );
          message.success('Resource updated successfully');
        } else {
          const newKey = String(resources.length + 1);
          const newResource: ResourceRow = {
            key: newKey,
            sno: newKey,
            raId: String(values.raId || ''),
            empName: String(values.empName || ''),
            emailId: String(values.emailId || ''),
            piwRole: String(values.piwRole || ''),
            roleOrDomain: String(values.roleOrDomain || ''),
            previousWorkex: String(values.previousWorkex || ''),
            doj: String(values.doj || ''),
            totalWorkex: String(values.totalWorkex || ''),
            skills: String(values.skills || ''),
            engagement: String(values.engagement || ''),
          };
          handleResourcesChange([...resources, newResource]);
          message.success('Resource added successfully');
        }
        setEditDrawer(false);
        form.resetFields();
        setEditingResource(null);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Save error';
        message.error(`Error: ${errorMsg}`);
      }
    },
    [editingResource, resources.length, form]
  );

  const handleDelete = useCallback((resource: ResourceRow | null) => {
    if (!resource || !resource.key) return;

    Modal.confirm({
      title: 'Delete Resource',
      content: `Are you sure you want to delete ${resource.empName || 'this resource'}?`,
      okText: 'Yes',
      cancelText: 'No',
      okButtonProps: { danger: true },
      onOk() {
        handleResourcesChange(resources.filter((r) => r.key !== resource.key));
        message.success('Resource deleted successfully');
        setDetailDrawer(false);
        setEditDrawer(false);
      },
    });
  }, []);

  const getFilteredResources = useCallback((): ResourceRow[] => {
    return resources.filter((r) => {
      if (!r) return false;

      // Filter by S.NO
      const sno = String(r.sno || '').toLowerCase();
      const filterSno = String(filters.sno || '').toLowerCase();
      if (filterSno && !sno.includes(filterSno)) {
        return false;
      }

      // Filter by RA ID
      const raId = String(r.raId || '').toLowerCase();
      const filterRaId = String(filters.raId || '').toLowerCase();
      if (filterRaId && !raId.includes(filterRaId)) {
        return false;
      }

      // Filter by Employee Name
      const empName = String(r.empName || '').toLowerCase();
      const filterEmpName = String(filters.empName || '').toLowerCase();
      if (filterEmpName && !empName.includes(filterEmpName)) {
        return false;
      }

      // Filter by Email ID
      const emailId = String(r.emailId || '').toLowerCase();
      const filterEmailId = String(filters.emailId || '').toLowerCase();
      if (filterEmailId && !emailId.includes(filterEmailId)) {
        return false;
      }

      // Filter by PIW Role
      if (filters.piwRole) {
        const piwRole = String(r.piwRole || '').toLowerCase();
        const filterPiwRole = String(filters.piwRole || '').toLowerCase();
        if (!piwRole.includes(filterPiwRole)) {
          return false;
        }
      }

      // Filter by Role/Domain
      if (filters.roleOrDomain) {
        const roleOrDomain = String(r.roleOrDomain || '').toLowerCase();
        const filterRoleOrDomain = String(filters.roleOrDomain || '').toLowerCase();
        if (!roleOrDomain.includes(filterRoleOrDomain)) {
          return false;
        }
      }

      // Filter by Total Workex (range)
      const totalWorkex = parseFloat(String(r.totalWorkex || '0').replace(/[^\d.-]/g, ''));
      if (!isNaN(totalWorkex)) {
        if (totalWorkex < filters.workexRange[0] || totalWorkex > filters.workexRange[1]) {
          return false;
        }
      }

      // Filter by Skills
      const skills = String(r.skills || '').toLowerCase();
      const filterSkills = String(filters.skills || '').toLowerCase();
      if (filterSkills && !skills.includes(filterSkills)) {
        return false;
      }

      // Filter by Engagement
      if (filters.engagement) {
        const engagement = String(r.engagement || '').toLowerCase();
        const filterEngagement = String(filters.engagement || '').toLowerCase();
        if (!engagement.includes(filterEngagement)) {
          return false;
        }
      }

      return true;
    });
  }, [resources, filters]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const getUniqueValues = useCallback(
    (key: keyof ResourceRow): string[] => {
      const values = new Set<string>();
      resources.forEach((r) => {
        if (r && r[key]) {
          const val = String(r[key]);
          if (val && val.trim()) {
            values.add(val);
          }
        }
      });
      return Array.from(values).sort();
    },
    [resources]
  );

  const columns: ColumnsType<ResourceRow> = useMemo(
    () => [
      {
        title: 'S.NO',
        dataIndex: 'sno',
        key: 'sno',
        width: 60,
        render: (value) => (
          <Tag color="blue" style={{ fontSize: '12px', fontWeight: 600 }}>
            {String(value || '').substring(0, 6)}
          </Tag>
        ),
        sorter: (a, b) => (Number(a?.sno || 0) - Number(b?.sno || 0)),
      },
      {
        title: 'RA ID',
        dataIndex: 'raId',
        key: 'raId',
        width: 100,
        render: (value) => (
          <div style={{ fontWeight: 600, color: '#001529' }}>
            {String(value || '')}
          </div>
        ),
      },
      {
        title: 'Emp Name',
        dataIndex: 'empName',
        key: 'empName',
        width: 150,
        render: (value) => (
          <div style={{ fontWeight: 600, color: '#001529' }}>
            {String(value || '')}
          </div>
        ),
      },
      {
        title: 'Email Id',
        dataIndex: 'emailId',
        key: 'emailId',
        width: 200,
        ellipsis: true,
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'PIW Role',
        dataIndex: 'piwRole',
        key: 'piwRole',
        width: 120,
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Role/Domain',
        dataIndex: 'roleOrDomain',
        key: 'roleOrDomain',
        width: 150,
        render: (value) => <Tag color="cyan">{String(value || '')}</Tag>,
      },
      {
        title: 'Previous Workex',
        dataIndex: 'previousWorkex',
        key: 'previousWorkex',
        width: 130,
        align: 'center' as const,
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'DOJ',
        dataIndex: 'doj',
        key: 'doj',
        width: 120,
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Total Workex',
        dataIndex: 'totalWorkex',
        key: 'totalWorkex',
        width: 120,
        align: 'right' as const,
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Current Engagement',
        dataIndex: 'engagement',
        key: 'engagement',
        width: 120,
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Skills',
        dataIndex: 'skills',
        key: 'skills',
        width: 200,
        render: (value) => {
          const skillsText = String(value || '');
          return (
            <Tooltip title={skillsText} placement="topLeft">
              <div
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                }}
              >
                {skillsText}
              </div>
            </Tooltip>
          );
        },
      },
      {
        title: 'Action',
        key: 'action',
        width: 100,
        fixed: 'right' as const,
        render: (_, record) => {
          if (!record) return null;
          return (
            <Space size="small">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{ color: '#1890FF' }}
                title="Edit"
              />
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                style={{ color: '#ff4d4f' }}
                title="Delete"
              />
            </Space>
          );
        },
      },
    ],
    [handleEdit, handleDelete]
  );

  const displayColumns = useMemo(
    () => columns.filter((col) => !col.key || visibleColumns.has(col.key as string)),
    [columns, visibleColumns]
  );

  const filteredResources = getFilteredResources();
  const filteredCount = filteredResources.length;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div>
            <Title level={4} style={{ marginBottom: 2 }}>
              Resource Management
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Manage team resources, skills, and project allocations
            </Text>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Space wrap style={{ gap: '6px' }}>
              <Button icon={<PlusOutlined />} type="primary" onClick={handleAddNew} size="small">
                Add New
              </Button>

              <Upload
                accept=".xlsx,.xls"
                beforeUpload={handleUpload}
                showUploadList={false}
              >
                <Tooltip title="Upload Resources from Excel">
                  <Button icon={<UploadOutlined />} type="text" />
                </Tooltip>
              </Upload>

              <Tooltip title="Download Excel Template">
                <Button onClick={downloadTemplate} icon={<DownloadOutlined />} type="text" />
              </Tooltip>

              {resources.length > 0 && (
                <Text type="secondary" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', padding: '4px 8px' }}>
                  Showing: <strong style={{ marginLeft: 4 }}>{filteredCount}</strong>
                  {filteredCount !== resources.length && (
                    <span style={{ marginLeft: 4 }}>/ {resources.length}</span>
                  )}
                </Text>
              )}
            </Space>

            {resources.length > 0 && (
              <Space wrap style={{ gap: '8px' }}>
                {viewMode === 'table' && (
                  <Button
                    icon={<ColumnHeightOutlined />}
                    title="Column Settings"
                    onClick={() => setColumnDrawer(true)}
                  >
                    Columns
                  </Button>
                )}

                <Button
                  icon={<FilterOutlined />}
                  title="Advanced Filters"
                  onClick={() => setFilterDrawer(true)}
                >
                  Filter
                </Button>

                <Segmented
                  value={viewMode}
                  onChange={(value) => setViewMode(value as 'table' | 'card')}
                  options={[
                    { label: 'Table', value: 'table', icon: <UnorderedListOutlined /> },
                    { label: 'Cards', value: 'card', icon: <AppstoreOutlined /> },
                  ]}
                />
              </Space>
            )}
          </div>

          {resources.length === 0 ? (
            <div
              style={{
                background: '#fff',
                borderRadius: '8px',
                padding: 60,
                textAlign: 'center',
              }}
            >
              <Text type="secondary">
                No resources yet. Upload a file or add a new employee to get started.
              </Text>
            </div>
          ) : viewMode === 'table' ? (
            <Table<ResourceRow>
              dataSource={filteredResources}
              columns={displayColumns}
              pagination={{ pageSize: 15 }}
              scroll={{ x: 'max-content' }}
              size="small"
              style={{ background: '#fff', borderRadius: '8px' }}
              locale={{ emptyText: 'No resources match your filters' }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {filteredResources.length > 0 ? (
                filteredResources.map((resource) => {
                  if (!resource) return null;
                  return (
                    <div
                      key={resource.key || 'unknown'}
                      style={{
                        background: '#fff',
                        borderRadius: '8px',
                        padding: 12,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        border: '1px solid #f0f0f0',
                        transition: 'all 0.3s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.12)';
                        e.currentTarget.style.transform = 'translateY(-4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#001529' }}>
                          {String(resource.empName || 'N/A')}
                        </div>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {String(resource.raId || '')}
                        </Text>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>
                          Role / Domain
                        </Text>
                        <Tag color="cyan" style={{ fontSize: '11px' }}>
                          {String(resource.roleOrDomain || '')}
                        </Tag>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>
                          Experience
                        </Text>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1890FF' }}>
                          {String(resource.totalWorkex || '—')}
                        </div>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>
                          Email
                        </Text>
                        <div style={{ fontSize: '11px', color: '#666', wordBreak: 'break-word' }}>
                          {String(resource.emailId || '—')}
                        </div>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>
                          Current Engagement
                        </Text>
                        <Tag color="orange" style={{ fontSize: '11px' }}>
                          {String(resource.engagement || '—')}
                        </Tag>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 2 }}>
                          Skills
                        </Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          {String(resource.skills || '')
                            .split(',')
                            .filter((s) => s.trim())
                            .slice(0, 2)
                            .map((skill, idx) => (
                              <Tag key={idx} color="blue" style={{ fontSize: '10px', margin: 0 }}>
                                {skill.trim()}
                              </Tag>
                            ))}
                          {String(resource.skills || '')
                            .split(',')
                            .filter((s) => s.trim()).length > 2 && (
                            <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>
                              +{String(resource.skills || '').split(',').filter((s) => s.trim()).length - 2} more
                            </Tag>
                          )}
                        </div>
                      </div>

                      <div style={{ marginBottom: 0, display: 'flex', gap: 4 }}>
                        <Button
                          type="primary"
                          size="small"
                          style={{ flex: 1, fontSize: '10px', height: '24px', padding: '0 8px' }}
                          onClick={() => {
                            setSelectedResource(resource);
                            setDetailDrawer(true);
                          }}
                        >
                          View
                        </Button>
                        <Button
                          type="primary"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            handleEdit(resource);
                            setDetailDrawer(false);
                          }}
                          title="Edit"
                        />
                        <Button
                          type="primary"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDelete(resource)}
                          title="Delete"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
                  <Text type="secondary">No resources match your filters</Text>
                </div>
              )}
            </div>
          )}
        </Space>
      </div>

      <Drawer
        title={editingResource ? `Edit - ${editingResource.empName || 'Resource'}` : 'Add New Employee'}
        placement="right"
        onClose={() => {
          setEditDrawer(false);
          form.resetFields();
          setEditingResource(null);
        }}
        open={editDrawer}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveEdit}
          autoComplete="off"
        >
          {editingResource && (
            <Form.Item label="S.NO" name="sno">
              <Input disabled />
            </Form.Item>
          )}

          <Form.Item
            label="RA ID"
            name="raId"
            rules={[{ required: true, message: 'RA ID is required' }]}
          >
            <Input placeholder="e.g., RA001" />
          </Form.Item>

          <Form.Item
            label="Employee Name"
            name="empName"
            rules={[{ required: true, message: 'Employee name is required' }]}
          >
            <Input placeholder="Full name" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="emailId"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Invalid email format' },
            ]}
          >
            <Input placeholder="email@example.com" type="email" />
          </Form.Item>

          <Form.Item
            label="PIW Role"
            name="piwRole"
            rules={[{ required: true, message: 'PIW Role is required' }]}
          >
            <Input placeholder="e.g., Developer, Manager" />
          </Form.Item>

          <Form.Item
            label="Role/Domain"
            name="roleOrDomain"
            rules={[{ required: true, message: 'Role/Domain is required' }]}
          >
            <Input placeholder="e.g., Full Stack, Backend" />
          </Form.Item>

          <Form.Item
            label="Previous Experience"
            name="previousWorkex"
            rules={[{ required: true, message: 'Previous experience is required' }]}
          >
            <Input placeholder="e.g., 2 years" />
          </Form.Item>

          <Form.Item
            label="Date of Joining"
            name="doj"
            rules={[{ required: true, message: 'DOJ is required' }]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            label="Total Experience"
            name="totalWorkex"
            rules={[{ required: true, message: 'Total experience is required' }]}
          >
            <Input placeholder="e.g., 5 years" />
          </Form.Item>

          <Form.Item
            label="Current Engagement"
            name="engagement"
          >
            <Input placeholder="e.g., Full-time, Contract, Part-time" />
          </Form.Item>

          <Form.Item
            label="Skills (comma-separated)"
            name="skills"
            rules={[{ required: true, message: 'Skills are required' }]}
          >
            <Input.TextArea rows={4} placeholder="e.g., Java, Spring Boot, React" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingResource ? 'Update' : 'Add'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={selectedResource ? `${selectedResource.raId} - ${selectedResource.empName}` : 'Resource Details'}
        placement="right"
        onClose={() => setDetailDrawer(false)}
        open={detailDrawer && !!selectedResource}
        width={500}
        extra={
          selectedResource && (
            <Space>
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => {
                  handleEdit(selectedResource);
                  setDetailDrawer(false);
                }}
                title="Edit"
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(selectedResource)}
                title="Delete"
              />
            </Space>
          )
        }
      >
        {selectedResource && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    S.NO
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    {String(selectedResource.sno || '—')}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    RA ID
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890FF' }}>
                    {String(selectedResource.raId || '—')}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Email
                  </Text>
                  <div style={{ fontSize: '14px' }}>
                    {String(selectedResource.emailId || '—')}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    PIW Role
                  </Text>
                  <div style={{ fontSize: '14px' }}>
                    {String(selectedResource.piwRole || '—')}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                Professional Information
              </Text>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Role / Domain
                  </Text>
                  <Tag color="cyan" style={{ marginTop: 4 }}>
                    {String(selectedResource.roleOrDomain || '')}
                  </Tag>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Previous Experience
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    {String(selectedResource.previousWorkex || '—')}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Date of Joining
                  </Text>
                  <div style={{ fontSize: '14px' }}>
                    {String(selectedResource.doj || '—')}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Total Experience
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890FF' }}>
                    {String(selectedResource.totalWorkex || '—')}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                Technical Skills
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {String(selectedResource.skills || '')
                  .split(',')
                  .filter((s) => s.trim())
                  .map((skill, idx) => (
                    <Tag key={idx} color="blue">
                      {skill.trim()}
                    </Tag>
                  ))}
              </div>
            </div>

            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                Current Engagement
              </Text>
              <div style={{ fontSize: '14px' }}>
                {String(selectedResource.engagement || '—')}
              </div>
            </div>
          </Space>
        )}
      </Drawer>

      <Drawer
        title="Column Visibility"
        placement="right"
        onClose={() => setColumnDrawer(false)}
        open={columnDrawer}
        width={300}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {Object.entries(COLUMN_LABELS)
            .filter(([key]) => key !== 'action')
            .map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox
                  checked={visibleColumns.has(key)}
                  onChange={(e) => {
                    const newVisible = new Set(visibleColumns);
                    if (e.target.checked) {
                      newVisible.add(key);
                    } else {
                      newVisible.delete(key);
                    }
                    setVisibleColumns(newVisible);
                  }}
                />
                <label style={{ marginBottom: 0, cursor: 'pointer' }}>
                  {label}
                </label>
              </div>
            ))}
        </Space>
      </Drawer>

      <Drawer
        title="Filters"
        placement="right"
        onClose={() => setFilterDrawer(false)}
        open={filterDrawer}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              S.NO
            </Text>
            <Input
              placeholder="Filter by S.NO..."
              value={filters.sno}
              onChange={(e) => setFilters({ ...filters, sno: e.target.value || '' })}
              allowClear
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              RA ID
            </Text>
            <Input
              placeholder="Filter by RA ID..."
              value={filters.raId}
              onChange={(e) => setFilters({ ...filters, raId: e.target.value || '' })}
              allowClear
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              Employee Name
            </Text>
            <Input
              placeholder="Filter by name..."
              value={filters.empName}
              onChange={(e) => setFilters({ ...filters, empName: e.target.value || '' })}
              allowClear
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              Email ID
            </Text>
            <Input
              placeholder="Filter by email..."
              value={filters.emailId}
              onChange={(e) => setFilters({ ...filters, emailId: e.target.value || '' })}
              allowClear
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              PIW Role
            </Text>
            <Select
              placeholder="Select PIW Role..."
              value={filters.piwRole || undefined}
              onChange={(value) => setFilters({ ...filters, piwRole: value || '' })}
              allowClear
              style={{ width: '100%' }}
              options={getUniqueValues('piwRole').map((role) => ({
                label: role,
                value: role,
              }))}
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              Role/Domain
            </Text>
            <Select
              placeholder="Select Role/Domain..."
              value={filters.roleOrDomain || undefined}
              onChange={(value) => setFilters({ ...filters, roleOrDomain: value || '' })}
              allowClear
              style={{ width: '100%' }}
              options={getUniqueValues('roleOrDomain').map((domain) => ({
                label: domain,
                value: domain,
              }))}
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              Total Experience Range (0-100)
            </Text>
            <Slider
              range
              min={0}
              max={100}
              value={filters.workexRange}
              onChange={(value) => {
                if (Array.isArray(value) && value.length === 2) {
                  setFilters({ ...filters, workexRange: [value[0], value[1]] as [number, number] });
                }
              }}
              marks={{ 0: '0', 50: '50', 100: '100' }}
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: 8, textAlign: 'center' }}>
              {filters.workexRange[0]} - {filters.workexRange[1]} years
            </div>
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              Skills
            </Text>
            <Input
              placeholder="Filter by skill..."
              value={filters.skills}
              onChange={(e) => setFilters({ ...filters, skills: e.target.value || '' })}
              allowClear
            />
          </div>

          <div>
            <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 8 }}>
              Current Engagement
            </Text>
            <Select
              placeholder="Select Engagement..."
              value={filters.engagement || undefined}
              onChange={(value) => setFilters({ ...filters, engagement: value || '' })}
              allowClear
              style={{ width: '100%' }}
              options={getUniqueValues('engagement').map((eng) => ({
                label: eng,
                value: eng,
              }))}
            />
          </div>

          <Button block onClick={handleClearFilters} style={{ marginTop: 12 }}>
            Clear All Filters
          </Button>
        </Space>
      </Drawer>
    </div>
  );
};

export default ResourceMgmt;
