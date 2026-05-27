import React, { useMemo, useState } from 'react';
import { Upload, Table, Typography, Space, Button, message, Input, Drawer, Tag, Badge, Segmented } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import { UploadOutlined, DownloadOutlined, EyeOutlined, AppstoreOutlined, UnorderedListOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

export type ResourceRow = {
  key: string;
  sno: string;
  raId: string;
  empName: string;
  email: string;
  ppmRole: string;
  roleOrDomain: string;
  previousWorkExp: string;
  doj: string;
  totalWorkHrs: string;
  skills: string;
};

const ResourceManagement: React.FC = () => {
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);

        const newResources: ResourceRow[] = jsonData.map((row: ExcelRow, idx: number) => ({
          key: String(resources.length + idx + 1),
          sno: row['S.No'] || String(resources.length + idx + 1),
          raId: row['RA ID'] || '',
          empName: row['Emp Name'] || '',
          email: row['Email Id'] || '',
          ppmRole: row['PPM Role'] || '',
          roleOrDomain: row['Role/Domain'] || '',
          previousWorkExp: row['Previous Work exp'] || '',
          doj: row['DOJ'] || '',
          totalWorkHrs: row['Total Works Hrs'] || '',
          skills: row['Skills'] || '',
        }));

        setResources([...resources, ...newResources]);
        message.success(`${newResources.length} resources imported successfully`);
      } catch (error) {
        message.error('Error parsing file. Please check the format.');
      }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const downloadTemplate = () => {
    const template = [
      {
        'S.No': '1',
        'RA ID': 'RA001',
        'Emp Name': 'John Doe',
        'Email Id': 'john.doe@example.com',
        'PPM Role': 'Developer',
        'Role/Domain': 'Full Stack Developer',
        'Previous Work exp': '5 years',
        'DOJ': '2024-01-15',
        'Total Works Hrs': '2000',
        'Skills': 'Java, Spring Boot, React, Node.js',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(template);
    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 12 },
      { wch: 20 },
      { wch: 30 },
      { wch: 15 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 40 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resources');
    XLSX.writeFile(workbook, 'Resource_Template.xlsx');
  };

  type ExcelRow = Record<string, any>;

  const columns: ColumnsType<ResourceRow> = [
    {
      title: 'S.No',
      dataIndex: 'sno',
      width: 60,
      render: (value: string) => (
        <Tag color="blue" style={{ fontSize: '12px', fontWeight: 600 }}>
          {value}
        </Tag>
      ),
    },
    {
      title: 'RA ID',
      dataIndex: 'raId',
      width: 100,
      render: (value: string) => (
        <div style={{ fontWeight: 600, color: '#001529' }}>
          {value}
        </div>
      ),
    },
    {
      title: 'Employee Name',
      dataIndex: 'empName',
      width: 150,
      render: (value: string) => (
        <div style={{ fontWeight: 600, color: '#001529' }}>
          {value}
        </div>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'PPM Role',
      dataIndex: 'ppmRole',
      width: 120,
    },
    {
      title: 'Role/Domain',
      dataIndex: 'roleOrDomain',
      width: 150,
      render: (value: string) => (
        <Tag color="cyan">{value}</Tag>
      ),
    },
    {
      title: 'Work Experience',
      dataIndex: 'previousWorkExp',
      width: 130,
      align: 'center' as const,
    },
    {
      title: 'DOJ',
      dataIndex: 'doj',
      width: 120,
    },
    {
      title: 'Total Work Hrs',
      dataIndex: 'totalWorkHrs',
      width: 120,
      align: 'right' as const,
    },
    {
      title: 'Skills',
      dataIndex: 'skills',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'Action',
      width: 80,
      fixed: 'right' as const,
      render: (_, record: ResourceRow) => (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedResource(record);
            setDetailDrawer(true);
          }}
          style={{ color: '#1890FF' }}
        >
          Details
        </Button>
      ),
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: 24 }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Resource Management
            </Title>
            <Text type="secondary">
              Manage team resources, skills, and project allocations
            </Text>
          </div>

          <Space wrap style={{ gap: '16px', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <Upload
                accept=".xlsx,.xls"
                beforeUpload={handleUpload}
                showUploadList={false}
              >
                <Button icon={<UploadOutlined />}>
                  Upload Resource Details
                </Button>
              </Upload>

              <Button onClick={downloadTemplate} icon={<DownloadOutlined />}>
                Download Template
              </Button>

              <Text type="secondary" style={{ fontSize: '12px', display: 'flex', alignItems: 'center' }}>
                Total Resources: <strong style={{ marginLeft: 4 }}>{resources.length}</strong>
              </Text>
            </div>

            {resources.length > 0 && (
              <Segmented
                value={viewMode}
                onChange={(value) => setViewMode(value as 'table' | 'card')}
                options={[
                  { label: 'Table View', value: 'table', icon: <UnorderedListOutlined /> },
                  { label: 'Card View', value: 'card', icon: <AppstoreOutlined /> },
                ]}
              />
            )}
          </Space>

          {viewMode === 'table' ? (
            <Table<ResourceRow>
              dataSource={resources}
              columns={columns}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 'max-content' }}
              size="middle"
              style={{ background: '#fff', borderRadius: '8px' }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {resources.map((resource) => (
                <div
                  key={resource.key}
                  style={{
                    background: '#fff',
                    borderRadius: '12px',
                    padding: 20,
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
                  <div style={{ marginBottom: 16 }}>
                    <Tag color="blue" style={{ marginBottom: 8, fontSize: '11px' }}>
                      {resource.raId}
                    </Tag>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#001529', marginTop: 4 }}>
                      {resource.empName}
                    </div>
                  </div>

                  <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                        Email
                      </Text>
                      <div style={{ fontSize: '12px', color: '#001529', wordBreak: 'break-word' }}>
                        {resource.email}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                      Role / Domain
                    </Text>
                    <Tag color="cyan" style={{ fontSize: '12px' }}>
                      {resource.roleOrDomain}
                    </Tag>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                      PPM Role
                    </Text>
                    <div style={{ fontSize: '12px', color: '#001529' }}>
                      {resource.ppmRole}
                    </div>
                  </div>

                  <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 6, marginBottom: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <div>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                          Work Experience
                        </Text>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529' }}>
                          {resource.previousWorkExp}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                          DOJ
                        </Text>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529' }}>
                          {resource.doj}
                        </div>
                      </div>
                      <div>
                        <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
                          Total Work Hrs
                        </Text>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1890FF' }}>
                          {resource.totalWorkHrs}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 4 }}>
                      Skills
                    </Text>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {resource.skills.split(',').map((skill, idx) => (
                        <Tag key={idx} color="blue" style={{ fontSize: '11px', margin: 0 }}>
                          {skill.trim()}
                        </Tag>
                      ))}
                    </div>
                  </div>

                  <Button
                    type="primary"
                    block
                    size="small"
                    onClick={() => {
                      setSelectedResource(resource);
                      setDetailDrawer(true);
                    }}
                  >
                    View Details
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Space>
      </div>

      {/* Resource Details Drawer */}
      <Drawer
        title={`${selectedResource?.raId} - ${selectedResource?.empName}`}
        placement="right"
        onClose={() => setDetailDrawer(false)}
        open={detailDrawer}
        width={500}
      >
        {selectedResource && (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    S.No
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    {selectedResource.sno}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    RA ID
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890FF' }}>
                    {selectedResource.raId}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Email
                  </Text>
                  <div style={{ fontSize: '14px' }}>
                    {selectedResource.email}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    PPM Role
                  </Text>
                  <div style={{ fontSize: '14px' }}>
                    {selectedResource.ppmRole}
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
                    {selectedResource.roleOrDomain}
                  </Tag>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Previous Work Experience
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>
                    {selectedResource.previousWorkExp}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Date of Joining
                  </Text>
                  <div style={{ fontSize: '14px' }}>
                    {selectedResource.doj}
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Total Working Hours
                  </Text>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1890FF' }}>
                    {selectedResource.totalWorkHrs}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                Technical Skills
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selectedResource.skills.split(',').map((skill, idx) => (
                  <Tag key={idx} color="blue">
                    {skill.trim()}
                  </Tag>
                ))}
              </div>
            </div>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default ResourceManagement;
