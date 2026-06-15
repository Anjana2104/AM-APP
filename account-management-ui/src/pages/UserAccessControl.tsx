/**
 * UserAccessControl.tsx
 * 
 * User Access Control — Manage user permissions, roles, and access levels
 * for application features and data
 * UI Location: Settings & Configuration > User Access Control
 * Page ID: user_access_control
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, Select, Switch, Tag, Space,
  Popconfirm, message, Typography, Checkbox, Divider, Tooltip, Badge, Avatar, Transfer,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined, SafetyCertificateOutlined,
  LockOutlined, TeamOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import * as authApi from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import * as notifApi from '../api/notificationApi';
import type { UserGroup } from '../api/notificationApi';
import type { UserRecord, RoleRecord, PagePermission } from '../api/authApi';

const { Title, Text } = Typography;

// All pages in the app with display names
const ALL_PAGES: { id: string; label: string; section: string }[] = [
  { id: 'account_summary', label: 'Account Summary', section: 'Account' },
  { id: 'executive_summary', label: 'Finance – Summary', section: 'Finance' },
  { id: 'executive_revenue', label: 'Finance – SOW Details', section: 'Finance' },
  { id: 'executive_invoicing', label: 'Finance – Invoicing Details', section: 'Finance' },
  { id: 'resources_info', label: 'Resources – Information', section: 'Resources' },
  { id: 'resources_utilization', label: 'Resources – Engagement Mapping', section: 'Resources' },
  { id: 'resources_upskilling', label: 'Resources – Upskilling', section: 'Resources' },
  { id: 'resources_insights', label: 'Resources – Resource Insights', section: 'Resources' },
  { id: 'clientmgmt_requests', label: 'Client Requests – Overview', section: 'Client Requests' },
  { id: 'clientmgmt_connects', label: 'Internal Process', section: 'Client Requests' },
  { id: 'information_ratecard', label: 'Knowledge – Rate Card', section: 'Knowledge Base' },
  { id: 'information_teamhierarchy', label: 'Knowledge – Team Hierarchy', section: 'Knowledge Base' },
  { id: 'information_process', label: 'Knowledge – Client Process', section: 'Knowledge Base' },
  { id: 'information_codeguide', label: 'Knowledge – Code Guide', section: 'Knowledge Base' },
  { id: 'configuration', label: 'Configuration', section: 'Settings' },
  { id: 'user_settings', label: 'User Settings', section: 'Settings' },
  { id: 'user_access_control', label: 'User Access Control', section: 'Settings' },
];

const EMPTY_PERMISSIONS = (): Record<string, PagePermission> => {
  const p: Record<string, PagePermission> = {};
  ALL_PAGES.forEach(pg => { p[pg.id] = { view: false, edit: false, delete: false }; });
  return p;
};

const FULL_PERMISSIONS = (): Record<string, PagePermission> => {
  const p: Record<string, PagePermission> = {};
  ALL_PAGES.forEach(pg => { p[pg.id] = { view: true, edit: true, delete: true }; });
  return p;
};

// ── Users Tab ─────────────────────────────────────────────────────────

function UsersTab({ roles, canEdit, canDelete }: { roles: RoleRecord[]; canEdit?: boolean; canDelete?: boolean }) {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    const list = await authApi.getUsers();
    setUsers(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (u: UserRecord) => {
    setEditing(u);
    form.setFieldsValue({ username: u.username, displayName: u.displayName, roleId: u.roleId, active: u.active });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    let result;
    if (editing) {
      const payload: any = { username: values.username, displayName: values.displayName, roleId: values.roleId ?? null, active: values.active };
      if (values.password) payload.password = values.password;
      result = await authApi.updateUser(editing.id, payload);
    } else {
      result = await authApi.createUser({ username: values.username, password: values.password, displayName: values.displayName, roleId: values.roleId ?? null, active: values.active ?? true });
    }
    setSaving(false);
    if (result.ok) {
      message.success(editing ? 'User updated' : 'User created');
      setModalOpen(false);
      load();
    } else {
      message.error(result.error || 'Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    const result = await authApi.deleteUser(id);
    if (result.ok) { message.success('User deleted'); load(); }
    else message.error(result.error || 'Delete failed');
  };

  const roleMap = Object.fromEntries(roles.map(r => [r.id, r.name]));

  const columns = [
    { title: 'Username', dataIndex: 'username', key: 'username', render: (v: string) => <Text strong style={{ fontSize: '13px' }}>{v}</Text> },
    { title: 'Display Name', dataIndex: 'displayName', key: 'displayName', render: (v: string) => <Text style={{ fontSize: '13px' }}>{v || '-'}</Text> },
    {
      title: 'Password', dataIndex: 'passwordPlain', key: 'password',
      render: (v: string) => (
        <Text style={{ fontSize: '12px', fontFamily: 'monospace', background: 'rgba(0,0,0,0.04)', padding: '2px 6px', borderRadius: 4 }}>
          {v || '—'}
        </Text>
      )
    },
    {
      title: 'Role', dataIndex: 'roleId', key: 'role',
      render: (rid: number | null) => rid ? <Tag color="blue" style={{ fontSize: '11px' }}>{roleMap[rid] || 'Unknown'}</Tag> : <Tag color="default" style={{ fontSize: '11px' }}>No Role</Tag>
    },
    {
      title: 'Status', dataIndex: 'active', key: 'active',
      render: (v: boolean) => v
        ? <Badge status="success" text={<Text style={{ fontSize: '12px', color: '#52c41a' }}>Active</Text>} />
        : <Badge status="error" text={<Text style={{ fontSize: '12px', color: '#f5222d' }}>Inactive</Text>} />
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: any, record: UserRecord) => (
        <Space size={4}>
          {(canEdit ?? true) && <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>}
          {(canDelete ?? true) && (
            <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>{users.length} user{users.length !== 1 ? 's' : ''} configured</Text>
        {(canEdit ?? true) && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 6 }}>New User</Button>}
      </div>

      <Table<UserRecord>
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false }}
        style={{ borderRadius: 8 }}
      />

      <Modal
        title={<Space><UserOutlined />{editing ? 'Edit User' : 'Create New User'}</Space>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Required' }]}>
            <Input prefix={<UserOutlined />} placeholder="Enter username" />
          </Form.Item>
          <Form.Item name="displayName" label="Display Name">
            <Input placeholder="Full name (optional)" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? 'New Password (leave blank to keep current)' : 'Password'}
            rules={editing ? [] : [{ required: true, message: 'Required' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder={editing ? 'Leave blank to keep current' : 'Set password'} />
          </Form.Item>
          <Form.Item name="roleId" label="Role">
            <Select placeholder="Select a role" allowClear>
              {roles.map(r => <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="active" label="Status" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>{editing ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ── Roles Tab ─────────────────────────────────────────────────────────

function RolesTab({ onRolesChange, canEdit, canDelete }: { onRolesChange: (roles: RoleRecord[]) => void; canEdit?: boolean; canDelete?: boolean }) {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, PagePermission>>(EMPTY_PERMISSIONS());
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    const list = await authApi.getRoles();
    setRoles(list);
    onRolesChange(list);
    setLoading(false);
  }, [onRolesChange]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setPermissions(EMPTY_PERMISSIONS());
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (r: RoleRecord) => {
    setEditing(r);
    // Merge stored permissions with full page list (in case new pages were added)
    const merged = EMPTY_PERMISSIONS();
    Object.entries(r.permissions).forEach(([k, v]) => { if (merged[k]) merged[k] = v; });
    setPermissions(merged);
    form.setFieldsValue({ name: r.name, description: r.description });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    let result;
    if (editing) {
      result = await authApi.updateRole(editing.id, { name: values.name, description: values.description, permissions });
    } else {
      result = await authApi.createRole({ name: values.name, description: values.description, permissions });
    }
    setSaving(false);
    if (result.ok) {
      message.success(editing ? 'Role updated' : 'Role created');
      setModalOpen(false);
      load();
    } else {
      message.error(result.error || 'Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    const result = await authApi.deleteRole(id);
    if (result.ok) { message.success('Role deleted'); load(); }
    else message.error(result.error || 'Delete failed');
  };

  const togglePerm = (pageId: string, action: keyof PagePermission) => {
    setPermissions(prev => ({
      ...prev,
      [pageId]: { ...prev[pageId], [action]: !prev[pageId][action] },
    }));
  };

  const setAllForPage = (pageId: string, val: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [pageId]: { view: val, edit: val, delete: val },
    }));
  };

  const setAllPermissions = (val: boolean) => setPermissions(val ? FULL_PERMISSIONS() : EMPTY_PERMISSIONS());

  // Group pages by section
  const sections = Array.from(new Set(ALL_PAGES.map(p => p.section)));

  const columns = [
    { title: 'Role Name', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong style={{ fontSize: '13px' }}>{v}</Text> },
    { title: 'Description', dataIndex: 'description', key: 'description', render: (v: string) => <Text style={{ fontSize: '12px', color: '#888' }}>{v || '-'}</Text> },
    {
      title: 'Pages', key: 'pages',
      render: (_: any, r: RoleRecord) => {
        const viewable = ALL_PAGES.filter(p => r.permissions[p.id]?.view).length;
        return <Tag color={viewable === ALL_PAGES.length ? 'green' : viewable > 0 ? 'blue' : 'default'} style={{ fontSize: '11px' }}>{viewable}/{ALL_PAGES.length} pages</Tag>;
      }
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: any, record: RoleRecord) => (
        <Space size={4}>
          {(canEdit ?? true) && <Tooltip title="Edit Permissions"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>}
          {(canDelete ?? true) && (
            <Popconfirm title="Delete this role? Users with this role will have no role assigned." onConfirm={() => handleDelete(record.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>{roles.length} role{roles.length !== 1 ? 's' : ''} configured</Text>
        {(canEdit ?? true) && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 6 }}>New Role</Button>}
      </div>

      <Table<RoleRecord>
        dataSource={roles}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={false}
        style={{ borderRadius: 8 }}
      />

      <Modal
        title={<Space><SafetyCertificateOutlined />{editing ? `Edit Role: ${editing.name}` : 'Create New Role'}</Space>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="name" label="Role Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. Viewer, Editor, Manager" />
            </Form.Item>
            <Form.Item name="description" label="Description">
              <Input placeholder="Brief description of this role" />
            </Form.Item>
          </div>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            Page Permissions
          </Divider>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Button size="small" icon={<CheckCircleOutlined />} onClick={() => setAllPermissions(true)} style={{ fontSize: '11px' }}>Grant All</Button>
            <Button size="small" icon={<CloseCircleOutlined />} onClick={() => setAllPermissions(false)} style={{ fontSize: '11px' }}>Revoke All</Button>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: '0 0 8px' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 90px', gap: 8, padding: '10px 16px 8px', borderBottom: '1px solid #f0f0f0', background: '#fafafa', borderRadius: '8px 8px 0 0', position: 'sticky', top: 0, zIndex: 1 }}>
              <Text style={{ fontSize: '11px', fontWeight: 600, color: '#444' }}>Page</Text>
              <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1890ff', textAlign: 'center' }}>View</Text>
              <Text style={{ fontSize: '11px', fontWeight: 600, color: '#52c41a', textAlign: 'center' }}>Edit</Text>
              <Text style={{ fontSize: '11px', fontWeight: 600, color: '#f5222d', textAlign: 'center' }}>Delete</Text>
              <Text style={{ fontSize: '11px', fontWeight: 600, color: '#666', textAlign: 'center' }}>All</Text>
            </div>

            {sections.map(section => (
              <div key={section}>
                <div style={{ padding: '8px 16px 4px', background: '#f9f9f9', borderBottom: '1px solid #f0f0f0' }}>
                  <Text style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px', color: '#888', textTransform: 'uppercase' }}>{section}</Text>
                </div>
                {ALL_PAGES.filter(p => p.section === section).map(pg => {
                  const perm = permissions[pg.id] || { view: false, edit: false, delete: false };
                  const allSet = perm.view && perm.edit && perm.delete;
                  return (
                    <div key={pg.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 70px 90px', gap: 8, padding: '7px 16px', borderBottom: '1px solid #f9f9f9', alignItems: 'center' }}>
                      <Text style={{ fontSize: '12px' }}>{pg.label}</Text>
                      <div style={{ textAlign: 'center' }}><Checkbox checked={perm.view} onChange={() => togglePerm(pg.id, 'view')} /></div>
                      <div style={{ textAlign: 'center' }}><Checkbox checked={perm.edit} onChange={() => togglePerm(pg.id, 'edit')} /></div>
                      <div style={{ textAlign: 'center' }}><Checkbox checked={perm.delete} onChange={() => togglePerm(pg.id, 'delete')} /></div>
                      <div style={{ textAlign: 'center' }}>
                        <Checkbox checked={allSet} indeterminate={!allSet && (perm.view || perm.edit || perm.delete)} onChange={e => setAllForPage(pg.id, e.target.checked)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Role'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ── Groups Tab ─────────────────────────────────────────────────────────

function GroupsTab({ users, canEdit, canDelete }: { users: UserRecord[]; canEdit?: boolean; canDelete?: boolean }) {
  const { configs } = useConfig();
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserGroup | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedMemberKeys, setSelectedMemberKeys] = useState<string[]>([]);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    const list = await notifApi.getUserGroups();
    setGroups(list);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setSelectedMemberKeys([]);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (g: UserGroup) => {
    setEditing(g);
    setSelectedMemberKeys(g.members.map(m => String(m.id)));
    form.setFieldsValue({ name: g.name, description: g.description, user_type_config_id: g.user_type_config_id });
    setModalOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    let groupId: number;

    if (editing) {
      const res = await notifApi.updateUserGroup(editing.id, {
        name: values.name,
        description: values.description || '',
        user_type_config_id: values.user_type_config_id || '',
      });
      if (!res.ok) { message.error(res.error || 'Update failed'); setSaving(false); return; }
      groupId = editing.id;

      // Sync members: add new, remove removed
      const prevIds = new Set(editing.members.map(m => String(m.id)));
      const nextIds = new Set(selectedMemberKeys);
      for (const id of nextIds) {
        if (!prevIds.has(id)) await notifApi.addGroupMember(groupId, Number(id));
      }
      for (const id of prevIds) {
        if (!nextIds.has(id)) await notifApi.removeGroupMember(groupId, Number(id));
      }
    } else {
      const res = await notifApi.createUserGroup({
        name: values.name,
        description: values.description || '',
        user_type_config_id: values.user_type_config_id || '',
      });
      if (!res.ok || !res.id) { message.error(res.error || 'Create failed'); setSaving(false); return; }
      groupId = res.id;
      for (const id of selectedMemberKeys) {
        await notifApi.addGroupMember(groupId, Number(id));
      }
    }

    setSaving(false);
    message.success(editing ? 'Group updated' : 'Group created');
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id: number) => {
    const res = await notifApi.deleteUserGroup(id);
    if (res.ok) { message.success('Group deleted'); load(); }
    else message.error(res.error || 'Delete failed');
  };

  // Build transfer data source
  const transferData = users.map(u => ({
    key: String(u.id),
    title: u.displayName || u.username,
    description: u.username,
  }));

  const columns = [
    {
      title: 'Name', dataIndex: 'name', key: 'name',
      render: (v: string) => <Text strong style={{ fontSize: '13px' }}>{v}</Text>,
    },
    {
      title: 'User Type', dataIndex: 'user_type_config_id', key: 'user_type',
      render: (typeId: string) => {
        if (!typeId) return <Tag color="default" style={{ fontSize: '11px' }}>—</Tag>;
        const cfg = configs.find(c => c.id === typeId);
        return <Tag color="blue" style={{ fontSize: '11px' }}>{cfg?.name || typeId}</Tag>;
      },
    },
    {
      title: 'Members', key: 'members',
      render: (_: any, g: UserGroup) => {
        const max = 5;
        const shown = g.members.slice(0, max);
        const extra = g.members.length - max;
        return (
          <Avatar.Group maxCount={5} size="small">
            {shown.map(m => (
              <Tooltip key={m.id} title={m.displayName || m.username}>
                <Avatar size="small" style={{ background: '#3b82f6', fontSize: '10px' }}>
                  {(m.displayName || m.username).slice(0, 1).toUpperCase()}
                </Avatar>
              </Tooltip>
            ))}
            {extra > 0 && <Avatar size="small" style={{ background: '#aaa', fontSize: '10px' }}>+{extra}</Avatar>}
            {g.members.length === 0 && <Text type="secondary" style={{ fontSize: '12px' }}>No members</Text>}
          </Avatar.Group>
        );
      },
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: any, record: UserGroup) => (
        <Space size={4}>
          {(canEdit ?? true) && <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>}
          {(canDelete ?? true) && (
            <Popconfirm title="Delete this group?" onConfirm={() => handleDelete(record.id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>{groups.length} group{groups.length !== 1 ? 's' : ''} configured</Text>
        {(canEdit ?? true) && <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ borderRadius: 6 }}>New Group</Button>}
      </div>

      <Table<UserGroup>
        dataSource={groups}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false }}
        style={{ borderRadius: 8 }}
      />

      <Modal
        title={<Space><TeamOutlined />{editing ? 'Edit Group' : 'Create New Group'}</Space>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSave} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Required' }]}>
              <Input placeholder="e.g. Finance Team" />
            </Form.Item>
            <Form.Item name="user_type_config_id" label="User Type (Config)">
              <Select placeholder="Select config type" allowClear>
                {configs.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="description" label="Description">
            <Input placeholder="Brief description" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            Members
          </Divider>

          <Transfer
            dataSource={transferData}
            targetKeys={selectedMemberKeys}
            onChange={(nextKeys) => setSelectedMemberKeys(nextKeys as string[])}
            render={item => item.title}
            listStyle={{ width: 260, height: 240 }}
            showSearch
            filterOption={(input, item) =>
              item.title.toLowerCase().includes(input.toLowerCase()) ||
              item.description.toLowerCase().includes(input.toLowerCase())
            }
            titles={['Available', 'Members']}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <Button onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={saving}>{editing ? 'Save Changes' : 'Create Group'}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ── Main UserAccessControl page ───────────────────────────────────────

export function UserAccessControl() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('user_access_control', 'edit');
  const canDelete = hasPermission('user_access_control', 'delete');

  // Load roles and users on mount
  useEffect(() => {
    authApi.getRoles().then(list => setRoles(list));
    authApi.getUsers().then(list => setUsers(list));
  }, []);

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ marginBottom: 20 }}>
          <Space align="center" style={{ marginBottom: 2 }}>
            <TeamOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>User Access Control</Title>
          </Space>
          <div style={{ marginLeft: 2, marginTop: 2 }}>
            <Text strong style={{ fontSize: '13px', color: '#595959', display: 'block' }}>
              Manage Users &amp; Roles
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Create users, define roles, and control page-level permissions (View / Edit / Delete).
            </Text>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e8e8e8' }}>
          <Tabs
            defaultActiveKey="users"
            size="small"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'users',
                label: <span><UserOutlined /> Users</span>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <UsersTab roles={roles} canEdit={canEdit} canDelete={canDelete} />
                  </div>
                ),
              },
              {
                key: 'groups',
                label: <span><TeamOutlined /> User Groups</span>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <GroupsTab users={users} canEdit={canEdit} canDelete={canDelete} />
                  </div>
                ),
              },
              {
                key: 'roles',
                label: <span><SafetyCertificateOutlined /> Roles &amp; Permissions</span>,
                children: (
                  <div style={{ padding: '16px 0' }}>
                    <RolesTab onRolesChange={setRoles} canEdit={canEdit} canDelete={canDelete} />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
