import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Upload,
  Table,
  Typography,
  Space,
  Button,
  message,
  Drawer,
  Tag,
  Dropdown,
  Modal,
  Form,
  Input,
  Tooltip,
  Slider,
  Checkbox,
  Select,
  Tabs,
  Row,
  Col,
  Statistic,
  Progress,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  TableOutlined,
  MoreOutlined,
  EyeOutlined,
  PlusOutlined,
  ColumnHeightOutlined,
  FilterOutlined,
  BarChartOutlined,
  PieChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const { Title, Text } = Typography;

const CHART_COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#096dd9'];

const EXP_BUCKETS = [
  { label: '0–3 Yrs', min: 0, max: 3 },
  { label: '3–5 Yrs', min: 3, max: 5 },
  { label: '5–8 Yrs', min: 5, max: 8 },
  { label: '8–10 Yrs', min: 8, max: 10 },
  { label: '10+ Yrs', min: 10, max: Infinity },
];

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
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(COLUMN_KEYS)
  );
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isFilterApplied = filters.empName !== '' || filters.raId !== '' || filters.piwRole !== '' || filters.roleOrDomain !== '' || filters.skills !== '' || filters.engagement !== '' || filters.workexRange[0] !== 0 || filters.workexRange[1] !== 100;

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const closeFilterOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilterPanel(false);
  };

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

  // ── Insights computations ──────────────────────────────────────
  const [insightView, setInsightView] = useState<'charts' | 'bars'>('charts');
  const [activeTab, setActiveTab] = useState<string>('resources');

  const handleInsightClick = (type: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket', name: string) => {
    if (type === 'expBucket') {
      const bucket = EXP_BUCKETS.find(b => b.label === name);
      if (bucket) {
        setFilters(prev => ({ ...prev, workexRange: [bucket.min, bucket.max === Infinity ? 100 : bucket.max] }));
      }
    } else {
      setFilters(prev => ({ ...prev, [type]: name }));
    }
    setActiveTab('resources');
  };

  const parseExpYears = (workex: string): number => {
    const n = parseFloat((workex || '0').replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : 0;
  };

  const roleData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const role = r.piwRole || 'Unknown'; map[role] = (map[role] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const expData = useMemo(() => {
    return EXP_BUCKETS.map(bucket => {
      const count = resources.filter(r => {
        const yrs = parseExpYears(r.totalWorkex || '');
        return yrs >= bucket.min && yrs < bucket.max;
      }).length;
      return { name: bucket.label, value: count };
    });
  }, [resources]);

  const skillData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => {
      (r.skills || '').split(',').forEach(s => {
        const skill = s.trim();
        if (skill) map[skill] = (map[skill] || 0) + 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const domainData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const d = r.roleOrDomain || 'Unknown'; map[d] = (map[d] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const engagementData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const e = r.engagement || 'Unassigned'; map[e] = (map[e] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const avgExp = useMemo(() => {
    if (!resources.length) return 0;
    const sum = resources.reduce((acc, r) => acc + parseExpYears(r.totalWorkex || ''), 0);
    return Math.round((sum / resources.length) * 10) / 10;
  }, [resources]);

  const benchCount = useMemo(() => resources.filter(r => r.engagement === 'Bench').length, [resources]);

  const renderMiniPie = (
    data: { name: string; value: number }[],
    title: string,
    clickType: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket'
  ) => (
    <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0' }}>
      <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>Click a segment to filter</Text>
      {data.length === 0 ? (
        <Text type="secondary" style={{ fontSize: '11px' }}>No data</Text>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              dataKey="value"
              paddingAngle={2}
              cursor="pointer"
              onClick={(entry) => handleInsightClick(clickType, entry.name)}
            >
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
            <RechartTooltip
              formatter={(v: number, name: string) => [`${v} (${resources.length ? Math.round(v / resources.length * 100) : 0}%)`, name]}
              contentStyle={{ fontSize: '11px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const renderHBar = (
    data: { name: string; value: number }[],
    title: string,
    clickType: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket',
    max?: number
  ) => {
    const maxVal = max || Math.max(...data.map(d => d.value), 1);
    return (
      <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>{title}</Text>
        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>Click a row to filter</Text>
        {data.length === 0 ? <Text type="secondary" style={{ fontSize: '11px' }}>No data</Text> : (
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            {data.map((item, i) => (
              <div
                key={item.name}
                style={{ cursor: 'pointer', borderRadius: 4, padding: '2px 4px', transition: 'background 0.15s' }}
                onClick={() => handleInsightClick(clickType, item.name)}
                onMouseEnter={e => (e.currentTarget.style.background = '#e6f4ff')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: '11px', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</Text>
                  <Text style={{ fontSize: '11px', color: '#666' }}>{item.value} ({resources.length ? Math.round(item.value / resources.length * 100) : 0}%)</Text>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.value / maxVal) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </Space>
        )}
      </div>
    );
  };

  const insightsContent = (
    <div>
      {resources.length === 0 ? (
        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 60, textAlign: 'center' }}>
          <Text type="secondary">No resource data. Upload or add resources first.</Text>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {[
              { title: 'Total Resources', value: resources.length, color: '#1890ff', bg: '#e6f7ff' },
              { title: 'Avg Experience', value: `${avgExp} yrs`, color: '#52c41a', bg: '#f6ffed' },
              { title: 'On Bench', value: benchCount, color: '#faad14', bg: '#fffbe6', clickType: 'engagement' as const, clickVal: 'Bench' },
              { title: 'Unique Roles', value: roleData.length, color: '#722ed1', bg: '#f9f0ff' },
              { title: 'Unique Skills', value: skillData.length > 0 ? skillData.length + '+' : 0, color: '#13c2c2', bg: '#e6fffb' },
              { title: 'Domains', value: domainData.length, color: '#eb2f96', bg: '#fff0f6' },
            ].map(kpi => (
              <Col key={kpi.title} xs={12} sm={8} md={4}>
                <div
                  style={{ background: kpi.bg, border: `1px solid ${'clickType' in kpi ? kpi.color : kpi.color}22`, borderRadius: 8, padding: '10px 12px', textAlign: 'center', cursor: 'clickType' in kpi ? 'pointer' : 'default' }}
                  onClick={() => { if ('clickType' in kpi && kpi.clickType && kpi.clickVal) handleInsightClick(kpi.clickType, kpi.clickVal); }}
                >
                  <div style={{ fontSize: '20px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: 2 }}>{kpi.title}</div>
                </div>
              </Col>
            ))}
          </Row>

          {/* View toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 6 }}>
            <Tooltip title="Chart View" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<PieChartOutlined />} size="small" type={insightView === 'charts' ? 'primary' : 'default'} onClick={() => setInsightView('charts')} style={{ borderRadius: 6 }} />
            </Tooltip>
            <Tooltip title="Bar View" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<BarChartOutlined />} size="small" type={insightView === 'bars' ? 'primary' : 'default'} onClick={() => setInsightView('bars')} style={{ borderRadius: 6 }} />
            </Tooltip>
          </div>

          {insightView === 'charts' ? (
            <>
              {/* Row 1: Role + Exp donut side by side */}
              <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                <Col xs={24} md={12}>
                  {renderMiniPie(roleData.slice(0, 8), 'Resources by PIW Role', 'piwRole')}
                </Col>
                <Col xs={24} md={12}>
                  {renderMiniPie(expData, 'Resources by Experience Range', 'expBucket')}
                </Col>
              </Row>
              {/* Row 2: Domain + Engagement */}
              <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                <Col xs={24} md={12}>
                  {renderMiniPie(domainData.slice(0, 8), 'Resources by Role/Domain', 'roleOrDomain')}
                </Col>
                <Col xs={24} md={12}>
                  {renderMiniPie(engagementData, 'Resources by Engagement', 'engagement')}
                </Col>
              </Row>
              {/* Row 3: Skills bar chart full width */}
              <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0' }}>
                <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 4 }}>Top Skills (count across resources)</Text>
                <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>Click a bar to filter</Text>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={skillData}
                    layout="vertical"
                    margin={{ left: 10, right: 20, top: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                    <RechartTooltip contentStyle={{ fontSize: '11px' }} formatter={(v) => [v, 'Count — click to filter']} />
                    <Bar
                      dataKey="value"
                      fill="#1890ff"
                      radius={[0, 4, 4, 0]}
                      cursor="pointer"
                      onClick={(data: { name: string }) => handleInsightClick('skills', data.name)}
                    >
                      {skillData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <>
              <Row gutter={[12, 12]}>
                <Col xs={24} md={12}>
                  {renderHBar(roleData, 'By PIW Role', 'piwRole')}
                </Col>
                <Col xs={24} md={12}>
                  {renderHBar(expData, 'By Experience Range', 'expBucket')}
                </Col>
                <Col xs={24} md={12}>
                  {renderHBar(domainData, 'By Role/Domain', 'roleOrDomain')}
                </Col>
                <Col xs={24} md={12}>
                  {renderHBar(engagementData, 'By Engagement', 'engagement')}
                </Col>
                <Col xs={24}>
                  {renderHBar(skillData, 'Top Skills', 'skills')}
                </Col>
              </Row>
            </>
          )}
        </>
      )}
    </div>
  );

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

          <div style={{ background: '#fff', borderRadius: '8px', padding: '0' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              style={{ padding: '0 16px' }}
              tabBarStyle={{ marginBottom: 0, fontSize: '12px' }}
              items={[
                {
                  key: 'resources',
                  label: <span style={{ fontSize: '12px' }}>Resources</span>,
                  children: (
                    <div style={{ padding: '16px 0 16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '16px' }}>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          Showing: <strong>{filteredCount}</strong>{filteredCount !== resources.length ? ` / ${resources.length}` : ''}
                        </Text>
              <Space wrap size={8}>
                {isFilterApplied && (
                  <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={handleClearFilters}>✕ Clear Filters</Button>
                )}
                <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: '6px' }} />
                </Tooltip>
                <Tooltip title="Card View" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('card')} style={{ borderRadius: '6px' }} />
                </Tooltip>
                <Tooltip title="Table View" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('table')} style={{ borderRadius: '6px' }} />
                </Tooltip>
                {viewMode === 'table' && (
                  <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: '6px' }} />
                  </Tooltip>
                )}
                <Tooltip title="Upload Resources from Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
                    <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                  </Upload>
                </Tooltip>
                <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<DownloadOutlined />} onClick={downloadTemplate} size="small" style={{ borderRadius: '6px' }} />
                </Tooltip>
                <Button type="primary" size="small" style={{ borderRadius: '6px', fontSize: '11px' }} onClick={handleAddNew}>+ Add New</Button>
              </Space>
            </div>

            {resources.length === 0 ? (
              <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: 60, textAlign: 'center' }}>
                <Text type="secondary">No resources yet. Upload a file or add a new employee to get started.</Text>
              </div>
            ) : viewMode === 'table' ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {showFilterPanel && (
                  <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <Text strong style={{ fontSize: '12px' }}>Filters</Text>
                      <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={handleClearFilters}>Clear all</Button>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Employee Name</div>
                        <Input size="small" placeholder="Search..." value={filters.empName} onChange={e => setFilters({ ...filters, empName: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                        <Input size="small" placeholder="Search..." value={filters.raId} onChange={e => setFilters({ ...filters, raId: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>PIW Role</div>
                        <Input size="small" placeholder="Search..." value={filters.piwRole} onChange={e => setFilters({ ...filters, piwRole: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Role/Domain</div>
                        <Input size="small" placeholder="Search..." value={filters.roleOrDomain} onChange={e => setFilters({ ...filters, roleOrDomain: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                        <Input size="small" placeholder="Search..." value={filters.skills} onChange={e => setFilters({ ...filters, skills: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Engagement</div>
                        <Input size="small" placeholder="Search..." value={filters.engagement} onChange={e => setFilters({ ...filters, engagement: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                    </Space>
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="compact-table">
                    <Table<ResourceRow>
                      dataSource={filteredResources}
                      columns={displayColumns}
                      pagination={{ pageSize: 15, showSizeChanger: false }}
                      scroll={{ x: 'max-content', y: 420 }}
                      size="small"
                      style={{ background: '#fff', borderRadius: '8px' }}
                      locale={{ emptyText: 'No resources match your filters' }}
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
                      <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={handleClearFilters}>Clear all</Button>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Employee Name</div>
                        <Input size="small" placeholder="Search..." value={filters.empName} onChange={e => setFilters({ ...filters, empName: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                        <Input size="small" placeholder="Search..." value={filters.raId} onChange={e => setFilters({ ...filters, raId: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>PIW Role</div>
                        <Input size="small" placeholder="Search..." value={filters.piwRole} onChange={e => setFilters({ ...filters, piwRole: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Role/Domain</div>
                        <Input size="small" placeholder="Search..." value={filters.roleOrDomain} onChange={e => setFilters({ ...filters, roleOrDomain: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                        <Input size="small" placeholder="Search..." value={filters.skills} onChange={e => setFilters({ ...filters, skills: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Engagement</div>
                        <Input size="small" placeholder="Search..." value={filters.engagement} onChange={e => setFilters({ ...filters, engagement: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                    </Space>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                    {filteredResources.map((resource) => {
                      if (!resource) return null;
                      const skillsArr = String(resource.skills || '').split(',').filter(s => s.trim());
                      const isBench = resource.engagement === 'Bench';
                      return (
                        <div key={resource.key || 'unknown'} style={{
                          background: '#fff',
                          borderRadius: '8px',
                          padding: '10px',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                          border: isBench ? '1px solid #ffe58f' : '1px solid #f0f0f0',
                          borderLeft: isBench ? '4px solid #faad14' : '1px solid #f0f0f0',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                            <Text strong style={{ fontSize: '13px' }}>{String(resource.empName || 'N/A')}</Text>
                            <Dropdown menu={{ items: [
                              { key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => handleEdit(resource) },
                              { key: 'delete', label: <span style={{ fontSize: '11px' }}>Delete</span>, icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true, onClick: () => handleDelete(resource) },
                            ]}} trigger={['click']}>
                              <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: 0 }} />
                            </Dropdown>
                          </div>
                          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '6px' }}>{String(resource.raId || '')}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '4px' }}>
                            {resource.roleOrDomain && <Tag color="cyan" style={{ fontSize: '10px', margin: 0 }}>{String(resource.roleOrDomain)}</Tag>}
                            {isBench ? <Tag color="warning" style={{ fontSize: '10px', margin: 0 }}>Bench</Tag> : resource.engagement && <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>{String(resource.engagement)}</Tag>}
                          </div>
                          <div style={{ fontSize: '11px', color: '#595959', marginBottom: '4px' }}>{String(resource.totalWorkex || '—')} exp</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: '6px' }}>
                            {skillsArr.slice(0, 2).map((skill, idx) => <Tag key={idx} color="blue" style={{ fontSize: '10px', margin: 0 }}>{skill.trim()}</Tag>)}
                            {skillsArr.length > 2 && <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{skillsArr.length - 2} more</Tag>}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
                              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedResource(resource); setDetailDrawer(true); }} />
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                    {filteredResources.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
                        <Text type="secondary">No resources match your filters</Text>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
                    </div>
                  ),
                },
                {
                  key: 'insights',
                  label: <span style={{ fontSize: '12px' }}><BarChartOutlined /> Insights</span>,
                  children: (
                    <div style={{ padding: '16px 0' }}>
                      {insightsContent}
                    </div>
                  ),
                },
              ]}
            />
          </div>
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

    </div>
  );
};

export default ResourceMgmt;
