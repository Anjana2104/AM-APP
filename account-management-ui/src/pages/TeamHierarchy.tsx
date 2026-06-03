import React, { useState, useMemo } from 'react';
import {
  Tabs, Button, Form, Input, Select, Modal, Typography, Space,
  Tooltip, Popconfirm, Empty, Tag, Table, Upload, message,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, UserOutlined,
  ApartmentOutlined, TeamOutlined, UploadOutlined, DownloadOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import '../style.css';

const { Title, Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────
interface Stakeholder {
  id: string;
  name: string;
  title: string;
  department: string;
  reportingTo: string | null; // id of manager
  responsibility: string;
  email: string;
}

const DEPT_COLORS: Record<string, string> = {
  'Engineering':    '#1890ff',
  'Data Science':   '#722ed1',
  'Management':     '#52c41a',
  'DevOps':         '#fa8c16',
  'Product':        '#eb2f96',
  'QA':             '#13c2c2',
  'Operations':     '#f5222d',
  'Finance':        '#2f54eb',
  'Other':          '#8c8c8c',
};

const LEVEL_STYLES = [
  { bg: 'linear-gradient(135deg,#1890ff,#096dd9)', border: '#1890ff' },
  { bg: 'linear-gradient(135deg,#722ed1,#531dab)', border: '#722ed1' },
  { bg: 'linear-gradient(135deg,#13c2c2,#08979c)', border: '#13c2c2' },
  { bg: 'linear-gradient(135deg,#52c41a,#389e0d)', border: '#52c41a' },
  { bg: 'linear-gradient(135deg,#fa8c16,#d46b08)', border: '#fa8c16' },
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('');
}

function getLevelStyle(depth: number) {
  return LEVEL_STYLES[Math.min(depth, LEVEL_STYLES.length - 1)];
}

// ─── Org Node (recursive) ─────────────────────────────────────────────────
interface OrgNodeProps {
  node: Stakeholder;
  all: Stakeholder[];
  depth: number;
}

function OrgNode({ node, all, depth }: OrgNodeProps) {
  const children = all.filter(s => s.reportingTo === node.id);
  const style = getLevelStyle(depth);
  const deptColor = DEPT_COLORS[node.department] || '#8c8c8c';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Card */}
      <Tooltip
        title={
          <div style={{ fontSize: '11px', lineHeight: 1.7 }}>
            <div><b>Role:</b> {node.title}</div>
            <div><b>Dept:</b> {node.department}</div>
            {node.email && <div><b>Email:</b> {node.email}</div>}
            {node.responsibility && <div><b>Responsibility:</b> {node.responsibility}</div>}
          </div>
        }
        overlayInnerStyle={{ fontSize: '11px', maxWidth: 260 }}
      >
        <div style={{
          background: '#fff',
          border: `2px solid ${style.border}`,
          borderRadius: 10,
          padding: '10px 14px',
          minWidth: 150,
          maxWidth: 180,
          textAlign: 'center',
          boxShadow: `0 3px 12px ${style.border}33`,
          cursor: 'default',
          transition: 'box-shadow 0.2s',
          position: 'relative',
        }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: style.bg,
            color: '#fff', fontWeight: 700, fontSize: '13px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 6px',
            boxShadow: `0 2px 6px ${style.border}66`,
          }}>
            {initials(node.name)}
          </div>
          <div style={{ fontWeight: 700, fontSize: '12px', color: '#262626', lineHeight: 1.3, marginBottom: 2 }}>
            {node.name}
          </div>
          <div style={{ fontSize: '10px', color: '#595959', marginBottom: 4 }}>{node.title}</div>
          <div style={{
            display: 'inline-block', fontSize: '9px', fontWeight: 600,
            background: `${deptColor}18`, color: deptColor,
            border: `1px solid ${deptColor}44`, borderRadius: 8,
            padding: '1px 7px',
          }}>{node.department}</div>
        </div>
      </Tooltip>

      {/* Connector line down to children */}
      {children.length > 0 && (
        <>
          <div style={{ width: 2, height: 20, background: style.border, opacity: 0.4 }} />
          {/* Horizontal bar */}
          {children.length > 1 && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start' }}>
              <div style={{
                position: 'absolute', top: 0, left: '50%',
                width: '100%', height: 2,
                background: style.border, opacity: 0.3,
                transform: 'translateX(-50%)',
              }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', position: 'relative' }}>
            {/* Top horizontal line spanning all children */}
            {children.length > 1 && (
              <div style={{
                position: 'absolute', top: 0,
                left: `calc(${100 / (2 * children.length)}%)`,
                right: `calc(${100 / (2 * children.length)}%)`,
                height: 2, background: style.border, opacity: 0.35,
              }} />
            )}
            {children.map(child => (
              <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: children.length > 1 ? 0 : 0 }}>
                {/* Short vertical from horizontal bar to card */}
                <div style={{ width: 2, height: children.length > 1 ? 18 : 0, background: style.border, opacity: 0.4 }} />
                <OrgNode node={child} all={all} depth={depth + 1} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Client Hierarchy (inner component) ───────────────────────────────────
export function ClientHierarchyInner() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // ── Roots (no manager) ─────────────────────────────────────────────────
  const roots = useMemo(() => stakeholders.filter(s => !s.reportingTo), [stakeholders]);

  // ── Save stakeholder ──────────────────────────────────────────────────
  const handleSave = () => {
    form.validateFields().then(values => {
      const id = editingId || `sh_${Date.now()}`;
      setStakeholders(prev => {
        if (editingId) return prev.map(s => s.id === editingId ? { ...s, ...values } : s);
        return [...prev, { id, ...values, reportingTo: values.reportingTo || null }];
      });
      form.resetFields();
      setModalOpen(false);
      setEditingId(null);
    });
  };

  const handleEdit = (record: Stakeholder) => {
    setEditingId(record.id);
    form.setFieldsValue({ ...record, reportingTo: record.reportingTo || undefined });
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setStakeholders(prev => prev
      .filter(s => s.id !== id)
      .map(s => s.reportingTo === id ? { ...s, reportingTo: null } : s)
    );
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  // ── Table columns ─────────────────────────────────────────────────────
  const tableColumns = [
    { title: 'S.No.', width: 55, render: (_: any, __: any, i: number) => i + 1,
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }) },
    { title: 'Name', dataIndex: 'name', key: 'name',
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: '12px' }}>{v}</span> },
    { title: 'Title / Role', dataIndex: 'title', key: 'title',
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (v: string) => <span style={{ fontSize: '12px' }}>{v}</span> },
    { title: 'Department', dataIndex: 'department', key: 'department',
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (v: string) => {
        const c = DEPT_COLORS[v] || '#8c8c8c';
        return <Tag color={c} style={{ fontSize: '11px' }}>{v}</Tag>;
      }},
    { title: 'Reports To', dataIndex: 'reportingTo', key: 'reportingTo',
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (id: string | null) => {
        const mgr = stakeholders.find(s => s.id === id);
        return mgr ? <span style={{ fontSize: '12px', color: '#1890ff' }}>{mgr.name}</span> : <span style={{ fontSize: '11px', color: '#8c8c8c' }}>— (Top level)</span>;
      }},
    { title: 'Email', dataIndex: 'email', key: 'email',
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span> },
    { title: 'Responsibility', dataIndex: 'responsibility', key: 'responsibility',
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span> },
    {
      title: 'Actions', key: 'actions', width: 80,
      onHeaderCell: () => ({ style: { fontSize: '11px', fontWeight: 700 } }),
      render: (_: any, record: Stakeholder) => (
        <Space size={4}>
          <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Popconfirm
            title="Remove this stakeholder?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes" cancelText="No"
            overlayInnerStyle={{ fontSize: '11px' }}
          >
            <Tooltip title="Delete" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ── Download template ─────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const headers = ['Name', 'Title / Role', 'Department', 'Reporting Manager Name', 'Email', 'Responsibility'];
    const sample = [
      { 'Name': 'Jane Doe', 'Title / Role': 'VP Engineering', 'Department': 'Engineering', 'Reporting Manager Name': '', 'Email': 'jane.doe@client.com', 'Responsibility': 'Overall tech strategy' },
      { 'Name': 'John Smith', 'Title / Role': 'Senior Manager', 'Department': 'Data Science', 'Reporting Manager Name': 'Jane Doe', 'Email': 'john.smith@client.com', 'Responsibility': 'AI/ML initiatives' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample, { header: headers });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stakeholders');
    XLSX.writeFile(wb, 'Stakeholder_Template.xlsx');
  };

  // ── Upload handler ────────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { message.error('No sheet found'); return false; }
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!rows.length) { message.warning('Sheet is empty'); return false; }

      // Build name→id map from existing stakeholders to resolve "Reporting Manager Name"
      const nameToId: Record<string, string> = {};
      stakeholders.forEach(s => { nameToId[s.name.trim().toLowerCase()] = s.id; });

      // First pass: create ids for incoming rows
      const incoming: Stakeholder[] = rows.map((r, i) => ({
        id: `sh_${Date.now()}_${i}`,
        name: String(r['Name'] || '').trim(),
        title: String(r['Title / Role'] || '').trim(),
        department: String(r['Department'] || '').trim(),
        reportingTo: null,
        email: String(r['Email'] || '').trim(),
        responsibility: String(r['Responsibility'] || '').trim(),
      })).filter(s => s.name);

      // Build combined name→id map (existing + incoming) for resolution
      const combinedMap: Record<string, string> = { ...nameToId };
      incoming.forEach(s => { combinedMap[s.name.toLowerCase()] = s.id; });

      // Second pass: resolve reporting manager names → ids
      const resolved = incoming.map((s, i) => {
        const mgrName = String(rows[i]['Reporting Manager Name'] || '').trim().toLowerCase();
        return { ...s, reportingTo: mgrName ? (combinedMap[mgrName] || null) : null };
      });

      setStakeholders(prev => [...prev, ...resolved]);
      message.success(`${resolved.length} stakeholder(s) uploaded successfully`);
    } catch (e: any) {
      message.error(e.message || 'Failed to read file');
    }
    return false;
  };

  // ── Stakeholders tab content ───────────────────────────────────────────
  const stakeholdersContent = (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {stakeholders.length} stakeholder{stakeholders.length !== 1 ? 's' : ''} added
        </Text>
        <Space size={6} wrap>
          <Tooltip title="Download Excel Template" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<DownloadOutlined />} size="small" onClick={handleDownloadTemplate} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title="Upload from Excel" overlayInnerStyle={{ fontSize: '11px' }}>
            <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: 6 }} />
            </Upload>
          </Tooltip>
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}
            style={{ borderRadius: 6, fontSize: '11px' }}>
            Add Stakeholder
          </Button>
        </Space>
      </div>

      {stakeholders.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
          <TeamOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No stakeholders yet. Add the first person to build the hierarchy.</Text>
        </div>
      ) : (
        <div className="compact-table">
          <Table
            dataSource={stakeholders}
            columns={tableColumns}
            rowKey="id"
            size="small"
            pagination={{ pageSize: 15, showSizeChanger: false }}
            scroll={{ x: 'max-content' }}
            style={{ background: '#fff', borderRadius: 8 }}
          />
        </div>
      )}
    </div>
  );

  // ── Hierarchy diagram tab ─────────────────────────────────────────────
  const diagramContent = (
    <div>
      {stakeholders.length === 0 ? (
        <Empty
          image={<ApartmentOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
          imageStyle={{ height: 60 }}
          description={<Text type="secondary" style={{ fontSize: '12px' }}>Add stakeholders first to view the org chart</Text>}
        />
      ) : roots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="warning" style={{ fontSize: '12px' }}>No top-level stakeholder found. Assign at least one person with no reporting manager.</Text>
        </div>
      ) : (
        <div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text strong style={{ fontSize: '11px', color: '#595959' }}>Levels:</Text>
            {LEVEL_STYLES.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.bg }} />
                <span style={{ fontSize: '10px', color: '#8c8c8c' }}>Level {i + 1}</span>
              </div>
            ))}
            <span style={{ fontSize: '10px', color: '#8c8c8c', marginLeft: 8 }}>· Hover over a node for details</span>
          </div>

          {/* Org chart canvas */}
          <div style={{
            overflowX: 'auto', overflowY: 'auto',
            background: '#f8f9ff',
            border: '1px solid #e8eaf0',
            borderRadius: 10,
            padding: '32px 40px',
            minHeight: 300,
          }}>
            {roots.length === 1 ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <OrgNode node={roots[0]} all={stakeholders} depth={0} />
              </div>
            ) : (
              /* Multiple roots: show side by side */
              <div style={{ display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap' }}>
                {roots.map(root => (
                  <OrgNode key={root.id} node={root} all={stakeholders} depth={0} />
                ))}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
            {Object.entries(
              stakeholders.reduce<Record<string, number>>((acc, s) => {
                acc[s.department] = (acc[s.department] || 0) + 1;
                return acc;
              }, {})
            ).map(([dept, count]) => (
              <div key={dept} style={{
                background: '#fff', border: `1px solid ${DEPT_COLORS[dept] || '#d9d9d9'}33`,
                borderLeft: `3px solid ${DEPT_COLORS[dept] || '#8c8c8c'}`,
                borderRadius: 6, padding: '5px 12px', fontSize: '11px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontWeight: 700, color: DEPT_COLORS[dept] || '#8c8c8c' }}>{dept}</span>
                <span style={{ color: '#8c8c8c' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Add/Edit Modal ─────────────────────────────────────────────────────
  const modal = (
    <Modal
      title={<span style={{ fontSize: '13px' }}>{editingId ? 'Edit Stakeholder' : 'Add Stakeholder'}</span>}
      open={modalOpen}
      onOk={handleSave}
      onCancel={() => { setModalOpen(false); setEditingId(null); form.resetFields(); }}
      okText="Save"
      width={520}
      okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
    >
      <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
        <Form.Item name="name" label={<span style={{ fontSize: '11px' }}>Full Name</span>} rules={[{ required: true, message: 'Enter name' }]}>
          <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="e.g. John Smith" style={{ fontSize: '12px' }} />
        </Form.Item>
        <Form.Item name="title" label={<span style={{ fontSize: '11px' }}>Title / Role</span>} rules={[{ required: true, message: 'Enter title' }]}>
          <Input placeholder="e.g. Director of Engineering" style={{ fontSize: '12px' }} />
        </Form.Item>
        <Form.Item name="department" label={<span style={{ fontSize: '11px' }}>Department</span>} rules={[{ required: true, message: 'Enter department' }]}>
          <Input placeholder="e.g. Engineering, Data Science, DevOps..." style={{ fontSize: '12px' }} />
        </Form.Item>
        <Form.Item name="reportingTo" label={<span style={{ fontSize: '11px' }}>Reporting Manager</span>}>
          <Select placeholder="— Top level (no manager)" allowClear style={{ fontSize: '12px' }}
            options={stakeholders
              .filter(s => s.id !== editingId)
              .map(s => ({ label: `${s.name} (${s.title})`, value: s.id }))}
          />
        </Form.Item>
        <Form.Item name="email" label={<span style={{ fontSize: '11px' }}>Email</span>}>
          <Input placeholder="e.g. john.smith@client.com" style={{ fontSize: '12px' }} />
        </Form.Item>
        <Form.Item name="responsibility" label={<span style={{ fontSize: '11px' }}>Responsibility / Notes</span>}>
          <Input.TextArea rows={3} placeholder="Key responsibilities or notes..." style={{ fontSize: '12px' }} />
        </Form.Item>
      </Form>
    </Modal>
  );

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '0 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <Tabs
        defaultActiveKey="stakeholders"
        tabBarStyle={{ marginBottom: 16, paddingTop: 4 }}
        items={[
          {
            key: 'stakeholders',
            label: <span style={{ fontSize: '12px' }}>👥 Add Stakeholder</span>,
            children: stakeholdersContent,
          },
          {
            key: 'diagram',
            label: <span style={{ fontSize: '12px' }}>🗂 Hierarchy Diagram</span>,
            children: diagramContent,
          },
        ]}
      />
      {modal}
    </div>
  );
}

// ─── RA Team Hierarchy (reuses same logic) ────────────────────────────────
function RATeamHierarchy() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const roots = useMemo(() => stakeholders.filter(s => !s.reportingTo), [stakeholders]);

  const handleSave = () => {
    form.validateFields().then(values => {
      const id = editingId || `ra_${Date.now()}`;
      setStakeholders(prev => {
        if (editingId) return prev.map(s => s.id === editingId ? { ...s, ...values } : s);
        return [...prev, { id, ...values, reportingTo: values.reportingTo || null }];
      });
      form.resetFields();
      setModalOpen(false);
      setEditingId(null);
    });
  };

  const handleEdit = (record: Stakeholder) => { setEditingId(record.id); form.setFieldsValue({ ...record, reportingTo: record.reportingTo || undefined }); setModalOpen(true); };
  const handleDelete = (id: string) => setStakeholders(prev => prev.filter(s => s.id !== id).map(s => s.reportingTo === id ? { ...s, reportingTo: null } : s));
  const handleAdd = () => { setEditingId(null); form.resetFields(); setModalOpen(true); };

  const hStyle = { fontSize: '11px', fontWeight: 700 as const };
  const tableColumns = [
    { title: 'S.No.', width: 55, render: (_: any, __: any, i: number) => i + 1, onHeaderCell: () => ({ style: hStyle }) },
    { title: 'Name', dataIndex: 'name', key: 'name', onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ fontWeight: 600, fontSize: '12px' }}>{v}</span> },
    { title: 'Title / Role', dataIndex: 'title', key: 'title', onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ fontSize: '12px' }}>{v}</span> },
    { title: 'Department', dataIndex: 'department', key: 'department', onHeaderCell: () => ({ style: hStyle }), render: (v: string) => { const c = DEPT_COLORS[v] || '#8c8c8c'; return <Tag color={c} style={{ fontSize: '11px' }}>{v}</Tag>; } },
    { title: 'Reports To', dataIndex: 'reportingTo', key: 'reportingTo', onHeaderCell: () => ({ style: hStyle }), render: (id: string | null) => { const mgr = stakeholders.find(s => s.id === id); return mgr ? <span style={{ fontSize: '12px', color: '#1890ff' }}>{mgr.name}</span> : <span style={{ fontSize: '11px', color: '#8c8c8c' }}>— (Top level)</span>; } },
    { title: 'Email', dataIndex: 'email', key: 'email', onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span> },
    { title: 'Responsibility', dataIndex: 'responsibility', key: 'responsibility', onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span> },
    { title: 'Actions', key: 'actions', width: 80, onHeaderCell: () => ({ style: hStyle }), render: (_: any, record: Stakeholder) => (
      <Space size={4}>
        <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}><Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} style={{ borderRadius: 6 }} /></Tooltip>
        <Popconfirm title="Remove this member?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No">
          <Tooltip title="Delete"><Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} /></Tooltip>
        </Popconfirm>
      </Space>
    )},
  ];

  const handleDownloadTemplate = () => {
    const sample = [
      { 'Name': 'Priya Sharma', 'Title / Role': 'Account Manager', 'Department': 'Management', 'Reporting Manager Name': '', 'Email': 'priya@ra.com', 'Responsibility': 'Account oversight' },
      { 'Name': 'Rahul Gupta', 'Title / Role': 'Senior Engineer', 'Department': 'Engineering', 'Reporting Manager Name': 'Priya Sharma', 'Email': 'rahul@ra.com', 'Responsibility': 'Delivery' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RA Team');
    XLSX.writeFile(wb, 'RA_Team_Template.xlsx');
  };

  const handleUpload = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { message.error('No sheet found'); return false; }
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      const nameToId: Record<string, string> = {};
      stakeholders.forEach(s => { nameToId[s.name.trim().toLowerCase()] = s.id; });
      const incoming: Stakeholder[] = rows.map((r, i) => ({ id: `ra_${Date.now()}_${i}`, name: String(r['Name'] || '').trim(), title: String(r['Title / Role'] || '').trim(), department: String(r['Department'] || '').trim(), reportingTo: null, email: String(r['Email'] || '').trim(), responsibility: String(r['Responsibility'] || '').trim() })).filter(s => s.name);
      const combinedMap: Record<string, string> = { ...nameToId };
      incoming.forEach(s => { combinedMap[s.name.toLowerCase()] = s.id; });
      const resolved = incoming.map((s, i) => { const mgrName = String(rows[i]['Reporting Manager Name'] || '').trim().toLowerCase(); return { ...s, reportingTo: mgrName ? (combinedMap[mgrName] || null) : null }; });
      setStakeholders(prev => [...prev, ...resolved]);
      message.success(`${resolved.length} member(s) uploaded`);
    } catch (e: any) { message.error(e.message || 'Upload failed'); }
    return false;
  };

  const membersContent = (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>{stakeholders.length} member{stakeholders.length !== 1 ? 's' : ''} added</Text>
        <Space size={6} wrap>
          <Tooltip title="Download Template"><Button icon={<DownloadOutlined />} size="small" onClick={handleDownloadTemplate} style={{ borderRadius: 6 }} /></Tooltip>
          <Tooltip title="Upload from Excel"><Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}><Button icon={<UploadOutlined />} size="small" style={{ borderRadius: 6 }} /></Upload></Tooltip>
          <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd} style={{ borderRadius: 6, fontSize: '11px' }}>Add Member</Button>
        </Space>
      </div>
      {stakeholders.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
          <TeamOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No RA team members yet. Add members to build the hierarchy.</Text>
        </div>
      ) : (
        <div className="compact-table"><Table dataSource={stakeholders} columns={tableColumns} rowKey="id" size="small" pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: 'max-content' }} style={{ background: '#fff', borderRadius: 8 }} /></div>
      )}
    </div>
  );

  const diagramContent = (
    <div>
      {stakeholders.length === 0 ? (
        <Empty image={<ApartmentOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />} imageStyle={{ height: 60 }} description={<Text type="secondary" style={{ fontSize: '12px' }}>Add RA team members first to view the org chart</Text>} />
      ) : roots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Text type="warning" style={{ fontSize: '12px' }}>No top-level member found. Assign at least one person with no reporting manager.</Text></div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text strong style={{ fontSize: '11px', color: '#595959' }}>Levels:</Text>
            {LEVEL_STYLES.map((s, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: s.bg }} /><span style={{ fontSize: '10px', color: '#8c8c8c' }}>Level {i + 1}</span></div>))}
            <span style={{ fontSize: '10px', color: '#8c8c8c', marginLeft: 8 }}>· Hover over a node for details</span>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', background: '#f8f9ff', border: '1px solid #e8eaf0', borderRadius: 10, padding: '32px 40px', minHeight: 300 }}>
            {roots.length === 1 ? <div style={{ display: 'flex', justifyContent: 'center' }}><OrgNode node={roots[0]} all={stakeholders} depth={0} /></div> : <div style={{ display: 'flex', gap: 48, justifyContent: 'center', flexWrap: 'wrap' }}>{roots.map(root => <OrgNode key={root.id} node={root} all={stakeholders} depth={0} />)}</div>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '0 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <Tabs defaultActiveKey="members" tabBarStyle={{ marginBottom: 16, paddingTop: 4 }}
        items={[
          { key: 'members', label: <span style={{ fontSize: '12px' }}>👥 Add Member</span>, children: membersContent },
          { key: 'diagram', label: <span style={{ fontSize: '12px' }}>🗂 Hierarchy Diagram</span>, children: diagramContent },
        ]}
      />
      <Modal title={<span style={{ fontSize: '13px' }}>{editingId ? 'Edit Member' : 'Add RA Member'}</span>} open={modalOpen} onOk={handleSave} onCancel={() => { setModalOpen(false); setEditingId(null); form.resetFields(); }} okText="Save" width={520} okButtonProps={{ size: 'small', style: { borderRadius: 6 } }} cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}>
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="name" label={<span style={{ fontSize: '11px' }}>Full Name</span>} rules={[{ required: true, message: 'Enter name' }]}><Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="e.g. Priya Sharma" style={{ fontSize: '12px' }} /></Form.Item>
          <Form.Item name="title" label={<span style={{ fontSize: '11px' }}>Title / Role</span>} rules={[{ required: true, message: 'Enter title' }]}><Input placeholder="e.g. Account Manager" style={{ fontSize: '12px' }} /></Form.Item>
          <Form.Item name="department" label={<span style={{ fontSize: '11px' }}>Department</span>} rules={[{ required: true, message: 'Enter department' }]}><Input placeholder="e.g. Engineering, Management..." style={{ fontSize: '12px' }} /></Form.Item>
          <Form.Item name="reportingTo" label={<span style={{ fontSize: '11px' }}>Reporting Manager</span>}><Select placeholder="— Top level (no manager)" allowClear style={{ fontSize: '12px' }} options={stakeholders.filter(s => s.id !== editingId).map(s => ({ label: `${s.name} (${s.title})`, value: s.id }))} /></Form.Item>
          <Form.Item name="email" label={<span style={{ fontSize: '11px' }}>Email</span>}><Input placeholder="e.g. priya@ra.com" style={{ fontSize: '12px' }} /></Form.Item>
          <Form.Item name="responsibility" label={<span style={{ fontSize: '11px' }}>Responsibility / Notes</span>}><Input.TextArea rows={2} style={{ fontSize: '12px' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ─── Outer wrapper with Client / Internal RA tabs ─────────────────────────
export function TeamHierarchy() {
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#262626' }}>Team Hierarchy</Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Build and visualise stakeholder org charts for Client and Internal RA teams
        </Text>
      </div>
      <Tabs
        defaultActiveKey="client"
        type="card"
        tabBarStyle={{ marginBottom: 0 }}
        items={[
          {
            key: 'client',
            label: <span style={{ fontSize: '12px' }}>🏢 Client</span>,
            children: <ClientHierarchyInner />,
          },
          {
            key: 'ra',
            label: <span style={{ fontSize: '12px' }}>⚙️ Internal RA</span>,
            children: <RATeamHierarchy />,
          },
        ]}
      />
    </div>
  );
}
