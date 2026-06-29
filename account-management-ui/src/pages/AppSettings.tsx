/**
 * src/pages/AppSettings.tsx
 *
 * App Settings — Global configuration manager for dropdown types, app key-value
 * settings, notification triggers and document templates.
 * UI Location: Settings & Configuration > App Settings
 * Page ID: configuration
 */
import { useState, useEffect, useCallback, HTMLAttributes } from 'react';
import {
  Button, Input, Modal, Form, Tag, Space, Typography,
  Divider, Tooltip, Popconfirm, Empty, message, Upload, Select, Checkbox, Tabs,
  Table, Switch, Badge, Segmented, Dropdown, Row, Col, InputNumber, Radio, AutoComplete, Drawer,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined,
  SaveOutlined, CloseOutlined, UploadOutlined, DownloadOutlined,
  LinkOutlined, AppstoreOutlined, TableOutlined, BellOutlined,
  HolderOutlined, FileProtectOutlined, MoreOutlined, ThunderboltOutlined,
  CalendarOutlined, FieldTimeOutlined, PlayCircleOutlined, HistoryOutlined, FilterOutlined, ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import { useConfig, ConfigItem, AVAILABLE_LINK_TARGETS, AppValue } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import {
  NotificationTrigger,
  TriggerSource,
  getNotificationTriggers,
  getTriggerSources,
  createNotificationTrigger,
  updateNotificationTrigger,
  deleteNotificationTrigger,
  toggleNotificationTrigger,
  reorderNotificationTriggers,
} from '../api/notificationTriggerApi';
import { getUserGroups, UserGroup } from '../api/notificationApi';
import {
  NotificationRule,
  RunResult,
  NotificationHistoryRow,
  getNotificationRules,
  createNotificationRule,
  updateNotificationRule,
  deleteNotificationRule,
  toggleNotificationRule as toggleRule,
  runRulesNow,
  runRuleById,
  getFieldValues,
  getNotificationHistory,
  deleteNotificationHistory,
  duplicateNotificationRule,
  reorderNotificationRules,
} from '../api/notificationRulesApi';
import { TemplatesTab } from '../components/TemplatesTab';

const { Text } = Typography;

const TAG_COLORS = [
  'default', 'blue', 'cyan', 'geekblue', 'green', 'gold',
  'lime', 'magenta', 'orange', 'purple', 'red', 'volcano',
];

export function AppSettings() {
  return (
    <div style={{ background: '#f5f7fa', minHeight: '100vh', padding: '16px 20px' }}>
      <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e8e8e8' }}>
        <Tabs
          defaultActiveKey="triggers"
          size="small"
          style={{ padding: '0 16px' }}
          items={[
            {
              key: 'triggers',
              label: <span style={{ fontSize: 12 }}><BellOutlined /> App Notifications</span>,
              children: <AppNotificationsTab />,
            },
            {
              key: 'templates',
              label: <span style={{ fontSize: 12 }}><FileProtectOutlined /> Templates</span>,
              children: <TemplatesTab />,
            },
            {
              key: 'dropdowns',
              label: <span style={{ fontSize: 12 }}><AppstoreOutlined /> Dropdowns &amp; Values</span>,
              children: <DropdownsAndValuesTab />,
            },
          ]}
        />
      </div>
    </div>
  );
}

// ── App Notifications tab wrapper (Change Triggers + Scheduled Rules) ─────

function AppNotificationsTab() {
  const [section, setSection] = useState<string>('triggers');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Segmented
          size="small"
          value={section}
          onChange={v => setSection(v as string)}
          options={[
            { label: <span style={{ fontSize: 11 }}><ThunderboltOutlined /> Change Triggers</span>, value: 'triggers' },
            { label: <span style={{ fontSize: 11 }}><CalendarOutlined /> Scheduled Rules</span>,    value: 'rules'    },
          ]}
        />
        <Segmented
          size="small"
          value={section === 'history' ? 'history' : ''}
          onChange={v => { if (v === 'history') setSection('history'); }}
          options={[
            { label: <span style={{ fontSize: 11 }}><HistoryOutlined /> Run History</span>, value: 'history' },
          ]}
          style={{ opacity: section === 'history' ? 1 : 0.75 }}
        />
      </div>
      <Divider style={{ margin: '8px 0 0' }} />
      {section === 'triggers' ? <NotificationTriggersTab /> : section === 'rules' ? <ScheduledRulesTab /> : <NotificationHistoryTab />}
    </div>
  );
}

// ── Notification History Tab ──────────────────────────────────────────────────

function NotificationHistoryTab() {
  const [rows,        setRows]        = useState<NotificationHistoryRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [tablePage,   setTablePage]   = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);
  const [filterOpen,  setFilterOpen]  = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  // View filters
  const [srcFilter,   setSrcFilter]   = useState<string>('all');
  const [typeFilter,  setTypeFilter]  = useState<string>('all');
  const [periodFilter,setPeriodFilter]= useState<string>('all');
  const [search,      setSearch]      = useState('');
  // Delete criteria (independent)
  const [delPeriod,   setDelPeriod]   = useState<'today'|'7d'|'30d'|'all'>('today');
  const [delSource,   setDelSource]   = useState<'rule_engine'|'change_trigger'|'all'>('all');
  const [delTitle,    setDelTitle]    = useState<string>('');

  const PERIOD_OPTS = [
    { value: 'today', label: 'Today'        },
    { value: '7d',    label: 'Last 7 days'  },
    { value: '30d',   label: 'Last 30 days' },
    { value: 'all',   label: 'All time'     },
  ];
  const SOURCE_OPTS = [
    { value: 'all',            label: 'All Sources'        },
    { value: 'rule_engine',    label: '⏱ Scheduled Rules'  },
    { value: 'change_trigger', label: '⚡ Change Triggers'  },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationHistory(300);
      setRows(data);
    } catch { message.error('Failed to load history'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { deleted } = await deleteNotificationHistory(delPeriod, delSource, delTitle);
      message.success(`Deleted ${deleted} notification(s)`);
      setDeleteOpen(false);
      setDelTitle('');
      load();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : 'Delete failed');
    } finally { setDeleting(false); }
  };

  const clearFilters = () => { setSrcFilter('all'); setTypeFilter('all'); setPeriodFilter('all'); setSearch(''); };

  const cutoffDate = () => {
    if (periodFilter === 'today') { const d = new Date(); d.setHours(0,0,0,0); return d; }
    if (periodFilter === '7d')    { const d = new Date(); d.setDate(d.getDate() - 7);  return d; }
    if (periodFilter === '30d')   { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
    return null;
  };

  const filtered = rows.filter(r => {
    if (srcFilter === 'rule_engine'    && r.source_user !== 'Scheduled Rules') return false;
    if (srcFilter === 'change_trigger' && r.source_user !== 'Change Triggers')  return false;
    if (srcFilter === 'failed'         && r.source_user !== 'System Error' && r.type !== 'error') return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !r.message.toLowerCase().includes(search.toLowerCase())) return false;
    const cut = cutoffDate();
    if (cut && new Date(r.created_at) < cut) return false;
    return true;
  });

  const ruleCount    = rows.filter(r => r.source_user === 'Scheduled Rules').length;
  const triggerCount = rows.filter(r => r.source_user === 'Change Triggers').length;
  const failedCount  = rows.filter(r => r.source_user === 'System Error' || r.type === 'error').length;
  const activeFilters = [srcFilter, typeFilter, periodFilter].filter(f => f !== 'all').length + (search ? 1 : 0);

  // Active filter tags shown under toolbar
  const filterTags = [
    srcFilter !== 'all'    && { key: 'src',    label: [SOURCE_OPTS, [{ value: 'failed', label: '✗ Failures' }]].flat().find(o => o.value === srcFilter)?.label ?? srcFilter, clear: () => setSrcFilter('all') },
    typeFilter !== 'all'   && { key: 'type',   label: typeFilter,                                                                                                              clear: () => setTypeFilter('all') },
    periodFilter !== 'all' && { key: 'period', label: PERIOD_OPTS.find(o => o.value === periodFilter)?.label ?? periodFilter,                                                  clear: () => setPeriodFilter('all') },
    search                 && { key: 'search', label: `"${search}"`,                                                                                                            clear: () => setSearch('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const recipientLabel = (r: NotificationHistoryRow) => {
    const n = r.recipient_count ?? 0;
    if (n === 0) return <Text style={{ fontSize: 10, color: '#8c8c8c' }}>—</Text>;
    if (n >= 5)  return <Tag color="geekblue" style={{ fontSize: 9 }}>Everyone ({n})</Tag>;
    if (n > 1)   return <Tag color="cyan"     style={{ fontSize: 9 }}>Group ({n})</Tag>;
    const name = r.recipients_list?.split(' | ')[0] ?? '1 user';
    return <Text style={{ fontSize: 10 }}>{name}</Text>;
  };

  const typeIcon = (type: string) => {
    if (type === 'alert') return <Badge color="red"    />;
    if (type === 'task')  return <Badge color="green"  />;
    if (type === 'info')  return <Badge color="blue"   />;
    if (type === 'error') return <Badge color="volcano"/>;
    return <Badge color="default" />;
  };

  const columns = [
    { title: <Text style={{ fontSize: 10 }}>S.No</Text>, key: 'sno', width: 50,
      render: (_: unknown, __: NotificationHistoryRow, idx: number) =>
        <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{((tablePage - 1) * tablePageSize) + idx + 1}</Text> },
    { title: '', key: 'type', width: 22,
      render: (_: unknown, r: NotificationHistoryRow) => typeIcon(r.type) },
    { title: <Text style={{ fontSize: 10 }}>Title</Text>, dataIndex: 'title', key: 'title', width: 160,
      render: (v: string, r: NotificationHistoryRow) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{v}</Text>
          {(r.notification_count ?? 1) > 1 && (
            <Tag color="geekblue" style={{ fontSize: 9, marginTop: 2 }}>
              {r.notification_count} notifications
            </Tag>
          )}
        </Space>
      ) },
    { title: <Text style={{ fontSize: 10 }}>Messages</Text>, dataIndex: 'message', key: 'msg',
      render: (v: string) => {
        const parts = v ? v.split(' | ').filter(Boolean) : [];
        if (parts.length <= 1) return <Text style={{ fontSize: 10, color: '#595959' }}>{v || '—'}</Text>;
        return (
          <Tooltip title={
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11 }}>
              {parts.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          } overlayStyle={{ maxWidth: 400 }}>
            <Space direction="vertical" size={1}>
              <Text style={{ fontSize: 10, color: '#595959' }} ellipsis>{parts[0]}</Text>
              <Text style={{ fontSize: 9, color: '#1677ff' }}>+{parts.length - 1} more (hover)</Text>
            </Space>
          </Tooltip>
        );
      } },
    { title: <Text style={{ fontSize: 10 }}>Source</Text>, dataIndex: 'source_user', key: 'src', width: 130,
      render: (v: string) => {
        const isRule = v === 'Scheduled Rules', isErr = v === 'System Error', isTrigger = v === 'Change Triggers';
        return <Tag
          color={isErr ? 'red' : isRule ? 'purple' : isTrigger ? 'blue' : 'default'}
          style={{ fontSize: 9 }}
        >
          {isRule ? '⏱ Scheduled Rules' : isErr ? '✗ System Error' : isTrigger ? '⚡ Change Triggers' : v || '—'}
        </Tag>;
      } },
    { title: <Text style={{ fontSize: 10 }}>Recipients</Text>, key: 'rcpt', width: 120,
      render: (_: unknown, r: NotificationHistoryRow) => recipientLabel(r) },
    { title: <Text style={{ fontSize: 10 }}>Read</Text>, key: 'read', width: 70,
      render: (_: unknown, r: NotificationHistoryRow) => {
        const total = r.recipient_count ?? 0, readN = r.read_count ?? 0;
        if (total === 0) return <Text style={{ fontSize: 10, color: '#8c8c8c' }}>—</Text>;
        return readN >= total
          ? <Tag color="green" style={{ fontSize: 9 }}>All read</Tag>
          : <Tag style={{ fontSize: 9 }}>{readN}/{total}</Tag>;
      } },
    { title: <Text style={{ fontSize: 10 }}>When</Text>, dataIndex: 'created_at', key: 'ts', width: 130,
      render: (v: string) => <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{v ? new Date(v).toLocaleString() : '—'}</Text> },
  ];

  const delLabel = [
    PERIOD_OPTS.find(p => p.value === delPeriod)?.label,
    SOURCE_OPTS.find(s => s.value === delSource)?.label,
    delTitle ? `Title: "${delTitle}"` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ padding: '12px 4px 4px' }}>
      {/* Summary cards */}
      <Row gutter={8} style={{ marginBottom: 10 }}>
        {[
          { label: 'Total Sent',      value: rows.length,  color: '#1677ff', bg: '#f5f5f5', border: 'transparent'  },
          { label: 'Scheduled Rules', value: ruleCount,    color: '#722ed1', bg: '#f5f5f5', border: 'transparent'  },
          { label: 'Change Triggers', value: triggerCount, color: '#1677ff', bg: '#f5f5f5', border: 'transparent'  },
          { label: 'Failures',        value: failedCount,  color: failedCount > 0 ? '#ff4d4f' : '#8c8c8c',
            bg: failedCount > 0 ? '#fff1f0' : '#f5f5f5', border: failedCount > 0 ? '#ffccc7' : 'transparent' },
        ].map(c => (
          <Col span={6} key={c.label}>
            <div style={{ background: c.bg, borderRadius: 4, padding: '6px 10px', textAlign: 'center', border: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
              <Text style={{ fontSize: 10, color: '#595959' }}>{c.label}</Text>
            </div>
          </Col>
        ))}
      </Row>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: filterTags.length ? 6 : 8 }}>
        <Space size={4}>
          <Input
            size="small"
            prefix={<FilterOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />}
            placeholder="Search title or message…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 190, fontSize: 11 }}
          />
          <Button size="small" icon={<FilterOutlined />} onClick={() => setFilterOpen(true)}
            type={activeFilters > 0 ? 'primary' : 'default'} style={{ fontSize: 11 }}>
            {activeFilters > 0 ? `Filters (${activeFilters})` : 'Filters'}
          </Button>
          {activeFilters > 0 && (
            <Button size="small" type="link" onClick={clearFilters}
              style={{ fontSize: 11, padding: '0 4px', color: '#ff4d4f' }}>
              Clear all
            </Button>
          )}
        </Space>
        <Space size={4}>
          <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{filtered.length} / {rows.length}</Text>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteOpen(true)}
            style={{ fontSize: 11 }}>Delete</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading} />
        </Space>
      </div>

      {/* Active filter chips */}
      {filterTags.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {filterTags.map(t => (
            <Tag key={t.key} closable onClose={t.clear}
              style={{ fontSize: 10, borderRadius: 10, cursor: 'default' }}>
              {t.label}
            </Tag>
          ))}
        </div>
      )}

      <Table
        dataSource={filtered}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{
          current: tablePage,
          pageSize: tablePageSize,
          size: 'small',
          showSizeChanger: false,
          onChange: (page, pageSize) => {
            setTablePage(page);
            setTablePageSize(pageSize);
          },
        }}
        style={{ fontSize: 11 }}
        rowClassName={(r: NotificationHistoryRow) =>
          r.type === 'error' || r.source_user === 'System Error' ? 'ant-table-row-danger' : ''
        }
      />

      {/* Filter Drawer — view filters only */}
      <Drawer
        title={<Text style={{ fontSize: 12 }}>Filter History</Text>}
        placement="right"
        width={280}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        extra={
          <Button size="small" style={{ fontSize: 11 }} onClick={clearFilters}>Clear All</Button>
        }
        styles={{ body: { padding: '16px 20px' } }}
        footer={
          <Button type="primary" size="small" block style={{ fontSize: 11 }} onClick={() => setFilterOpen(false)}>
            Apply
          </Button>
        }
      >
        <Form layout="vertical" size="small">
          <Form.Item label={<Text style={{ fontSize: 11 }}>Source</Text>} style={{ marginBottom: 10 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={srcFilter} onChange={setSrcFilter}
              options={[
                { value: 'all',            label: 'All Sources'        },
                { value: 'rule_engine',    label: '⏱ Scheduled Rules'  },
                { value: 'change_trigger', label: '⚡ Change Triggers'  },
                { value: 'failed',         label: '✗ Failures only'    },
              ]}
            />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Type</Text>} style={{ marginBottom: 10 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={typeFilter} onChange={setTypeFilter}
              options={[
                { value: 'all',   label: 'All Types' },
                { value: 'alert', label: '🔴 Alert'  },
                { value: 'task',  label: '✅ Task'   },
                { value: 'info',  label: 'ℹ️ Info'   },
                { value: 'error', label: '✗ Error'   },
              ]}
            />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Period</Text>} style={{ marginBottom: 0 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={periodFilter} onChange={setPeriodFilter}
              options={PERIOD_OPTS}
            />
          </Form.Item>
        </Form>
      </Drawer>

      {/* Delete Modal — separate, clearly labelled */}
      <Modal
        open={deleteOpen}
        title={<Space><DeleteOutlined style={{ color: '#ff4d4f' }} /><Text style={{ fontSize: 13 }}>Delete Notification History</Text></Space>}
        onCancel={() => { setDeleteOpen(false); setDelTitle(''); }}
        width={420}
        footer={[
          <Button key="cancel" size="small" onClick={() => setDeleteOpen(false)} style={{ fontSize: 11 }}>Cancel</Button>,
          <Popconfirm
            key="confirm"
            title={<Text style={{ fontSize: 11 }}>This will permanently delete notifications.</Text>}
            description={<Text style={{ fontSize: 11 }}>{delLabel}</Text>}
            onConfirm={handleDelete}
            okText="Delete"
            okButtonProps={{ danger: true, size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
            cancelText="Cancel"
          >
            <Button danger size="small" loading={deleting} style={{ fontSize: 11 }}>
              Delete
            </Button>
          </Popconfirm>,
        ]}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Form layout="vertical" size="small">
          <Form.Item label={<Text style={{ fontSize: 11 }}>Title (optional — leave blank for all)</Text>} style={{ marginBottom: 10 }}>
            <AutoComplete
              size="small"
              style={{ width: '100%', fontSize: 11 }}
              value={delTitle}
              onChange={setDelTitle}
              options={[...new Set(rows.map(r => r.title))].filter(Boolean).map(t => ({ value: t }))}
              filterOption={(input, opt) => (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              placeholder="Filter by title (partial match)"
              allowClear
            />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Delete notifications from</Text>} style={{ marginBottom: 10 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={delPeriod}
              onChange={v => setDelPeriod(v as typeof delPeriod)} options={PERIOD_OPTS} />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Source to delete</Text>} style={{ marginBottom: 0 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={delSource}
              onChange={v => setDelSource(v as typeof delSource)} options={SOURCE_OPTS} />
          </Form.Item>
          <div style={{ marginTop: 12, padding: '8px 10px', background: '#fff7e6', borderRadius: 4, border: '1px solid #ffd591' }}>
            <Text style={{ fontSize: 10, color: '#d46b08' }}>
              ⚠ This will permanently delete all matching notifications from the database. This action cannot be undone.
            </Text>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

// ── Source table / field definitions (mirrors server/utils/evaluateRules.js) ─

const SOURCE_TABLES = [
  { value: 'resources',       label: 'Resources'         },
  { value: 'client_requests', label: 'Client Requests'   },
  { value: 'ra_process',      label: 'Process / SOW'     },
  { value: 'finance_projects', label: 'Finance Projects' },
];

const SOURCE_FIELDS: Record<string, { value: string; label: string; type: string }[]> = {
  resources: [
    { value: 'engagement_end_date',   label: 'Engagement End Date',   type: 'date'   },
    { value: 'engagement_start_date', label: 'Engagement Start Date', type: 'date'   },
    { value: 'doj',                   label: 'Date of Joining',       type: 'date'   },
    { value: 'allocation_percentage', label: 'Allocation %',          type: 'number' },
    { value: 'allocation_status',     label: 'Allocation Status',     type: 'text'   },
    { value: 'role_or_domain',        label: 'Role / Domain',         type: 'text'   },
    { value: 'account_anchor',        label: 'Account Anchor',        type: 'text'   },
  ],
  client_requests: [
    { value: 'date_raised',       label: 'Date Raised',       type: 'date' },
    { value: 'processing_status', label: 'Processing Status', type: 'text' },
    { value: 'overall_status',    label: 'Overall Status',    type: 'text' },
    { value: 'account_anchor',    label: 'Owner',             type: 'text' },
  ],
  ra_process: [
    { value: 'start_date',     label: 'Start Date',     type: 'date' },
    { value: 'active',         label: 'Active Status',  type: 'text' },
    { value: 'account_anchor', label: 'Owner',          type: 'text' },
  ],
  finance_projects: [
    { value: 'status', label: 'Status', type: 'text' },
  ],
};

const CONDITION_TYPES = [
  { value: 'date_overdue',     label: 'Date Overdue / Approaching'  },
  { value: 'field_threshold',  label: 'Field Below / Above Threshold' },
  { value: 'field_equals',     label: 'Field Value Check'           },
];

const SCHEDULE_TYPES = [
  { value: 'daily',   label: 'Daily (once per day)'        },
  { value: 'monthly', label: 'Monthly (on specific day)'   },
  { value: 'weekly',  label: 'Weekly (every Monday)'       },
];

const NUM_OPS   = ['<', '>', '<=', '>=', '='];
const TEXT_OPS  = [
  { value: 'eq',       label: '= equals'     },
  { value: 'neq',      label: '≠ not equals' },
  { value: 'contains', label: '∋ contains'   },
];

// ── Scheduled Rules Tab ───────────────────────────────────────────────────────

// Drag-handle row wrapper for the scheduled rules table
function SortableRuleRow({ id, children, ...rest }: HTMLAttributes<HTMLTableRowElement> & { id: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...rest}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: isDragging ? '#e6f4ff' : undefined,
        cursor: 'default',
      }}
    >
      {children}
    </tr>
  );
}

function ScheduledRulesTab() {
  const { hasPermission } = useAuth();
  const canEdit   = hasPermission('configuration', 'edit');
  const canDelete = hasPermission('configuration', 'delete');

  const [rules,        setRules]        = useState<NotificationRule[]>([]);
  const [groups,       setGroups]       = useState<UserGroup[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [modalOpen,    setModalOpen]    = useState(false);
  const [editingRule,  setEditingRule]  = useState<NotificationRule | null>(null);
  const [running,      setRunning]      = useState(false);
  const [runResult,    setRunResult]    = useState<RunResult | null>(null);
  const [rowRunningId, setRowRunningId] = useState<number | null>(null);
  const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);
  const [form]                          = Form.useForm();

  // dnd-kit sensors — 5px movement before drag starts
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const srcTable    = Form.useWatch('source_table',       form);
  const condType    = Form.useWatch('condition_type',     form);
  const schedType   = Form.useWatch('schedule_type',      form);
  const targetType  = Form.useWatch('notify_target_type', form);
  const equalsField = Form.useWatch('threshold_field',    form);

  const tableFields = srcTable ? (SOURCE_FIELDS[srcTable] || []) : [];
  const dateFields  = tableFields.filter(f => f.type === 'date');
  const numFields   = tableFields.filter(f => f.type === 'number');
  const allFields   = tableFields;

  // Fetch distinct values when field_equals field changes
  useEffect(() => {
    if (condType === 'field_equals' && srcTable && equalsField) {
      getFieldValues(srcTable, equalsField).then(vals => setFieldSuggestions(vals)).catch(() => setFieldSuggestions([]));
    } else {
      setFieldSuggestions([]);
    }
  }, [condType, srcTable, equalsField]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, g] = await Promise.all([getNotificationRules(), getUserGroups()]);
      setRules(r);
      setGroups(g);
    } catch { message.error('Failed to load scheduled rules'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ schedule_type: 'daily', notification_type: 'alert',
      notify_target_type: 'group', condition_type: 'date_overdue', lead_time_days: 0 });
    setModalOpen(true);
  };

  const openEdit = (r: NotificationRule) => {
    setEditingRule(r);
    form.setFieldsValue({
      ...r,
      threshold_value: r.threshold_value ?? undefined,
      schedule_day: r.schedule_day ?? undefined,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      if (editingRule) {
        await updateNotificationRule(editingRule.id, vals);
        message.success('Rule updated');
      } else {
        await createNotificationRule(vals);
        message.success('Rule created');
      }
      setModalOpen(false);
      load();
    } catch (e: unknown) {
      if (e instanceof Error) message.error(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotificationRule(id);
      message.success('Rule deleted');
      load();
    } catch { message.error('Delete failed'); }
  };

  const handleToggle = async (id: number) => {
    await toggleRule(id);
    load();
  };

  const handleRunNow = async () => {
    setRunning(true);
    setRunResult(null);
    try {
      const result = await runRulesNow();
      setRunResult(result);
      if (result.fired > 0) {
        message.success(`Rule engine ran — ${result.fired} notification(s) fired`);
      } else {
        message.info('Rule engine ran — 0 notifications fired (check diagnostics below)');
      }
      load();
    } catch { message.error('Run failed'); }
    finally { setRunning(false); }
  };

  const handleRunRow = async (r: NotificationRule) => {
    setRowRunningId(r.id);
    try {
      const result = await runRuleById(r.id);
      const d = result.diagnostics[0];
      if (result.fired > 0) {
        message.success(`"${r.name}" fired ${result.fired} notification(s)`);
      } else {
        const detail = d?.matchDebug || d?.note || d?.skipped || d?.error || 'No matching records';
        message.info(`"${r.name}": 0 fired — ${detail}`);
      }
      load();
    } catch { message.error('Run failed'); }
    finally { setRowRunningId(null); }
  };
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rules.findIndex(r => r.id === active.id);
    const newIndex = rules.findIndex(r => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(rules, oldIndex, newIndex);
    setRules(reordered);
    await reorderNotificationRules(reordered.map(r => r.id));
  };

  const handleDuplicate = async (r: NotificationRule) => {    try {
      await duplicateNotificationRule(r.id);
      message.success(`Duplicated "${r.name}" — edit to activate`);
      load();
    } catch { message.error('Duplicate failed'); }
  };
  const conditionSummary = (r: NotificationRule) => {
    if (r.condition_type === 'date_overdue') {
      const lead = r.lead_time_days > 0 ? ` (warn ${r.lead_time_days}d early)` : '';
      const filter = r.filter_field ? ` + ${r.filter_field} ${r.filter_operator} "${r.filter_value}"` : '';
      return `${r.date_field} overdue${lead}${filter}`;
    }
    if (r.condition_type === 'field_threshold') {
      const cfgNote = r.config_value_key ? ` (from config: ${r.config_value_key})` : '';
      const filter = r.filter_field ? ` + ${r.filter_field} ${r.filter_operator} "${r.filter_value}"` : '';
      return `${r.threshold_field} ${r.threshold_operator} ${r.threshold_value ?? '?'}${cfgNote}${filter}`;
    }
    if (r.condition_type === 'field_equals') {
      return `${r.threshold_field} ${r.threshold_operator} "${r.filter_value}"`;
    }
    return '—';
  };

  const scheduleSummary = (r: NotificationRule) => {
    if (r.schedule_type === 'monthly') return `Monthly (day ${r.schedule_day ?? 15})`;
    if (r.schedule_type === 'weekly')  return 'Weekly (Mon)';
    return 'Daily';
  };

  const columns = [
    ...(canEdit ? [{
      title: '',
      key: 'drag',
      width: 28,
      render: () => (
        <HolderOutlined style={{ cursor: 'grab', color: '#bbb', fontSize: 13 }} />
      ),
    }] : []),
    { title: 'Name', dataIndex: 'name', key: 'name',
      render: (v: string) => <Text style={{ fontSize: 11, fontWeight: 600 }}>{v}</Text> },
    { title: 'Source', dataIndex: 'source_table', key: 'src', width: 120,
      render: (v: string) => <Tag color="blue" style={{ fontSize: 9 }}>{SOURCE_TABLES.find(s => s.value === v)?.label ?? v}</Tag> },
    { title: 'Condition', key: 'cond', width: 200,
      render: (_: unknown, r: NotificationRule) => <Text style={{ fontSize: 11 }}>{conditionSummary(r)}</Text> },
    { title: 'Schedule', key: 'sch', width: 120,
      render: (_: unknown, r: NotificationRule) => (
        <Space size={4}><FieldTimeOutlined style={{ fontSize: 11, color: '#1677ff' }} /><Text style={{ fontSize: 11 }}>{scheduleSummary(r)}</Text></Space>
      ) },
    { title: 'Last Run', dataIndex: 'last_run_at', key: 'last', width: 100,
      render: (v: string | null) => <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{v ? new Date(v).toLocaleDateString() : 'Never'}</Text> },
    { title: 'Active', key: 'active', width: 60,
      render: (_: unknown, r: NotificationRule) => (
        <Switch size="small" checked={r.is_active === 1}
          onChange={() => canEdit && handleToggle(r.id)} disabled={!canEdit} />
      ) },
    { title: '', key: 'actions', width: 110,
      render: (_: unknown, r: NotificationRule) => (
        <Space size={2}>
          {canEdit && (
            <Tooltip title={r.is_active ? 'Run now' : 'Inactive — enable to run'}>
              <Button type="text" size="small"
                icon={<PlayCircleOutlined style={{ fontSize: 12, color: r.is_active ? '#1677ff' : '#d9d9d9' }} />}
                loading={rowRunningId === r.id}
                disabled={!r.is_active}
                onClick={() => handleRunRow(r)} />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Duplicate">
              <Button type="text" size="small" icon={<CopyOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />}
                onClick={() => handleDuplicate(r)} />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 12 }} />} onClick={() => openEdit(r)} />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <Popconfirm title="Delete this rule?" onConfirm={() => handleDelete(r.id)} okText="Delete" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ) },
  ];

  return (
    <div style={{ padding: '12px 4px 4px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Space size={6}>
          <Text style={{ fontSize: 11, color: '#595959' }}>
            Rules are evaluated hourly. Each rule fires at most once per schedule period per record.
          </Text>
        </Space>
        <Space size={6}>
          {canEdit && (
            <Button size="small" icon={<PlayCircleOutlined />} loading={running}
              onClick={handleRunNow} style={{ fontSize: 11 }}>
              Run Now
            </Button>
          )}
          {canEdit && (
            <Button type="primary" size="small" icon={<PlusOutlined />}
              onClick={openCreate} style={{ fontSize: 11 }}>
              New Rule
            </Button>
          )}
        </Space>
      </div>

      {/* Diagnostics from last Run Now */}
      {runResult && (
        <div style={{ marginBottom: 10, borderRadius: 4, background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px' }}>
          <Text strong style={{ fontSize: 11 }}>Last Run: {runResult.fired} notification(s) fired</Text>
          {runResult.diagnostics.map((d, i) => (
            <div key={i} style={{ fontSize: 10, color: '#595959', marginTop: 2 }}>
              <Text style={{ fontSize: 10 }} strong>{d.name}: </Text>
              {d.skipped   && <Text style={{ fontSize: 10, color: '#faad14' }}>⚠ {d.skipped}</Text>}
              {d.error     && <Text style={{ fontSize: 10, color: '#ff4d4f' }}>✗ {d.error}</Text>}
              {d.note      && <Text style={{ fontSize: 10, color: '#1890ff' }}>ℹ {d.note}</Text>}
              {d.matchDebug && <Text style={{ fontSize: 10 }}>{d.matchDebug}</Text>}
              {d.fired > 0 && <Text style={{ fontSize: 10, color: '#52c41a' }}> — {d.fired} fired</Text>}
            </div>
          ))}
        </div>
      )}

      {/* Rules table */}
      {rules.length === 0 && !loading ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text style={{ fontSize: 11 }}>No scheduled rules configured yet. Click "+ New Rule" to create one.</Text>}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rules.map(r => r.id)} strategy={verticalListSortingStrategy}>
            <Table
              dataSource={rules}
              columns={columns}
              rowKey="id"
              size="small"
              loading={loading}
              pagination={false}
              style={{ fontSize: 11 }}
              components={{
                body: {
                  row: ({ children, ...props }: any) => {
                    const id = props['data-row-key'] ? Number(props['data-row-key']) : 0;
                    return canEdit
                      ? <SortableRuleRow id={id} {...props}>{children}</SortableRuleRow>
                      : <tr {...props}>{children}</tr>;
                  },
                },
              }}
            />
          </SortableContext>
        </DndContext>
      )}

      <Modal
        open={modalOpen}
        title={<Text style={{ fontSize: 13 }}>{editingRule ? 'Edit Scheduled Rule' : 'New Scheduled Rule'}</Text>}
        onCancel={() => setModalOpen(false)}
        width={620}
        footer={[
          <Button key="cancel" size="small" onClick={() => setModalOpen(false)} style={{ fontSize: 11 }}>Cancel</Button>,
          <Button key="save" type="primary" size="small" onClick={handleSave} style={{ fontSize: 11 }}>Save Rule</Button>,
        ]}
        styles={{ body: { padding: '12px 16px', maxHeight: 'calc(100vh - 180px)', overflowY: 'auto' } }}
      >
        <Form form={form} layout="vertical" size="small" style={{ fontSize: 11 }}>
          {/* Row 1: Name + Source */}
          <Row gutter={10}>
            <Col span={15}>
              <Form.Item name="name" label={<Text style={{ fontSize: 11 }}>Rule Name</Text>}
                rules={[{ required: true, message: 'Name required' }]} style={{ marginBottom: 8 }}>
                <Input style={{ fontSize: 11 }} placeholder="e.g. Resources with upcoming end dates" />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="source_table" label={<Text style={{ fontSize: 11 }}>Source Table</Text>}
                rules={[{ required: true, message: 'Select source' }]} style={{ marginBottom: 8 }}>
                <Select style={{ fontSize: 11 }} options={SOURCE_TABLES}
                  onChange={() => { form.resetFields(['date_field','threshold_field','filter_field','filter_value']); setFieldSuggestions([]); }}
                  placeholder="Select table" />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 2: Condition type */}
          <Form.Item name="condition_type" label={<Text style={{ fontSize: 11 }}>Condition Type</Text>}
            rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <Radio.Group size="small" style={{ fontSize: 11 }}>
              {CONDITION_TYPES.map(c => (
                <Radio.Button key={c.value} value={c.value} style={{ fontSize: 11 }}>{c.label}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          {/* Date Overdue condition fields */}
          {condType === 'date_overdue' && (
            <Row gutter={10}>
              <Col span={15}>
                <Form.Item name="date_field" label={<Text style={{ fontSize: 11 }}>Date Field</Text>}
                  rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={dateFields.map(f => ({ value: f.value, label: f.label }))}
                    placeholder="Select date field" />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item name="lead_time_days"
                  label={
                    <Tooltip title={
                      <span style={{ fontSize: 11 }}>
                        Minimum days the date must be <strong>overdue</strong> before alerting.<br /><br />
                        <strong>Lead = 0:</strong> fire as soon as date ≤ today (any past date).<br />
                        <strong>Lead = 7:</strong> fire only if date was ≥ 7 days ago (overdue by 7+ days).<br /><br />
                        Use higher values to suppress alerts for recently-missed dates.
                      </span>
                    }>
                      <Text style={{ fontSize: 11 }}>Lead Time (days) <span style={{ color: '#1677ff', fontSize: 10 }}>ⓘ</span></Text>
                    </Tooltip>
                  }
                  style={{ marginBottom: 8 }}>
                  <InputNumber min={0} max={365} style={{ width: '100%', fontSize: 11 }} placeholder="0 = alert on/after date" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Field Threshold condition fields */}
          {condType === 'field_threshold' && (
            <Row gutter={10}>
              <Col span={9}>
                <Form.Item name="threshold_field" label={<Text style={{ fontSize: 11 }}>Field</Text>}
                  rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={numFields.map(f => ({ value: f.value, label: f.label }))}
                    placeholder={numFields.length === 0 ? 'No numeric fields for this source' : 'Numeric field'}
                    disabled={numFields.length === 0} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="threshold_operator" label={<Text style={{ fontSize: 11 }}>Operator</Text>}
                  rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={NUM_OPS.map(op => ({ value: op, label: op }))} />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item name="threshold_value"
                  label={<Tooltip title="Or leave blank and set Config Key to use a value from App Values"><Text style={{ fontSize: 11 }}>Value</Text></Tooltip>}
                  style={{ marginBottom: 8 }}>
                  <InputNumber style={{ width: '100%', fontSize: 11 }} placeholder="e.g. 50" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Field Equals condition fields */}
          {condType === 'field_equals' && (
            <Row gutter={10}>
              <Col span={9}>
                <Form.Item name="threshold_field" label={<Text style={{ fontSize: 11 }}>Field</Text>}
                  rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={allFields.map(f => ({ value: f.value, label: f.label }))}
                    onChange={() => { form.resetFields(['filter_value']); }}
                    placeholder="Select field" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="threshold_operator" label={<Text style={{ fontSize: 11 }}>Operator</Text>}
                  rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={TEXT_OPS.map(op => ({ value: op.value, label: op.label }))} />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item name="filter_value" label={<Text style={{ fontSize: 11 }}>Value</Text>}
                  rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <AutoComplete
                    style={{ fontSize: 11, width: '100%' }}
                    options={fieldSuggestions.map(v => ({ value: v, label: v }))}
                    placeholder="e.g. Completed"
                    filterOption={(input, opt) =>
                      String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    allowClear
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Secondary AND filter (for date_overdue + field_threshold) */}
          {(condType === 'date_overdue' || condType === 'field_threshold') && (
            <Row gutter={10}>
              <Col span={8}>
                <Form.Item name="filter_field" label={<Text style={{ fontSize: 11 }}>AND — Filter Field (optional)</Text>}
                  style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} allowClear
                    options={allFields.map(f => ({ value: f.value, label: f.label }))}
                    placeholder="Optional" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="filter_operator" label={<Text style={{ fontSize: 11 }}>Operator</Text>}
                  style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} allowClear
                    options={TEXT_OPS.map(op => ({ value: op.value, label: op.label }))} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="filter_value" label={<Text style={{ fontSize: 11 }}>Value</Text>}
                  style={{ marginBottom: 8 }}>
                  <Input style={{ fontSize: 11 }} placeholder="e.g. Active" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {/* Config value key (threshold override) */}
          {condType === 'field_threshold' && (
            <Form.Item name="config_value_key"
              label={<Tooltip title="If set, threshold is read from App Values using this key (overrides Value above)"><Text style={{ fontSize: 11 }}>App Values Key (optional)</Text></Tooltip>}
              style={{ marginBottom: 8 }}>
              <Input style={{ fontSize: 11 }} placeholder="e.g. bench_allocation_threshold" />
            </Form.Item>
          )}

          {/* Schedule row */}
          <Row gutter={10}>
            <Col span={schedType === 'monthly' ? 14 : 24}>
              <Form.Item name="schedule_type" label={<Text style={{ fontSize: 11 }}>Schedule</Text>}
                rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select size="small" style={{ fontSize: 11 }}
                  options={SCHEDULE_TYPES.map(s => ({ value: s.value, label: s.label }))} />
              </Form.Item>
            </Col>
            {schedType === 'monthly' && (
              <Col span={10}>
                <Form.Item name="schedule_day"
                  label={<Text style={{ fontSize: 11 }}>Day of Month</Text>}
                  rules={[{ required: true, message: 'Enter day (1–28)' }]}
                  style={{ marginBottom: 8 }}>
                  <InputNumber min={1} max={28} style={{ width: '100%', fontSize: 11 }} placeholder="e.g. 15" />
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* Notification + Recipients row */}
          <Row gutter={10}>
            <Col span={8}>
              <Form.Item name="notification_type" label={<Text style={{ fontSize: 11 }}>Notification Type</Text>}
                rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select size="small" style={{ fontSize: 11 }}
                  options={[
                    { value: 'alert', label: '🔴 Alert' },
                    { value: 'task',  label: '✅ Task'  },
                    { value: 'info',  label: 'ℹ️ Info'  },
                  ]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notify_target_type" label={<Text style={{ fontSize: 11 }}>Notify</Text>}
                rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select size="small" style={{ fontSize: 11 }}
                  options={[
                    { value: 'group',       label: 'User Group'          },
                    { value: 'field_value', label: 'Owner (field value)' },
                    { value: 'broadcast',   label: 'Everyone'            },
                  ]} />
              </Form.Item>
            </Col>
            {targetType === 'group' && (
              <Col span={8}>
                <Form.Item name="notify_target_value" label={<Text style={{ fontSize: 11 }}>Group</Text>}
                  rules={[{ required: true, message: 'Select group' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={groups.map(g => ({ value: String(g.id), label: g.name }))}
                    placeholder="Select group" />
                </Form.Item>
              </Col>
            )}
            {targetType === 'field_value' && (
              <Col span={8}>
                <Form.Item name="notify_target_value"
                  label={<Tooltip title="Field whose value is the recipient's username (e.g. account_anchor)"><Text style={{ fontSize: 11 }}>Owner Field</Text></Tooltip>}
                  rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }}
                    options={allFields.map(f => ({ value: f.value, label: f.label }))}
                    placeholder="e.g. account_anchor" />
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* Message template */}
          <Form.Item name="message_template" label={<Text style={{ fontSize: 11 }}>Message Template</Text>}
            style={{ marginBottom: 4 }}>
            <Input.TextArea rows={2} style={{ fontSize: 11 }}
              placeholder="e.g. {record_name} — {engagement_end_date} is approaching. Please review." />
          </Form.Item>
          {/* Copyable variable hints — click to copy to clipboard */}
          <div style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 10, color: '#8c8c8c' }}>Available variables (click to copy):</Text>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
                '{record_name}',
                ...(srcTable ? (SOURCE_FIELDS[srcTable] || []).map(f => `{${f.value}}`) : []),
              ].map(v => (
                <Tag
                  key={v}
                  style={{ fontSize: 10, cursor: 'pointer', userSelect: 'none' }}
                  color="blue"
                  onClick={() => {
                    navigator.clipboard.writeText(v).then(() => message.success(`Copied ${v}`, 1));
                  }}
                >
                  {v}
                </Tag>
              ))}
            </div>
          </div>

          {/* Active toggle */}
          <Form.Item name="is_active" label={<Text style={{ fontSize: 11 }}>Active</Text>} valuePropName="checked"
            getValueFromEvent={(v: boolean) => v ? 1 : 0}
            getValueProps={(v) => ({ checked: v === 1 })}
            style={{ marginBottom: 0 }}>
            <Switch size="small" defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ── Dropdowns & Values (merged tab) ──────────────────────────────────

function DropdownsAndValuesTab() {
  const [section, setSection] = useState<string>('dropdowns');
  return (
    <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented
          size="small"
          value={section}
          onChange={v => setSection(v as string)}
          options={[
            { label: <span style={{ fontSize: 11 }}><AppstoreOutlined /> Dropdown Types</span>, value: 'dropdowns' },
            { label: <span style={{ fontSize: 11 }}><TableOutlined /> App Values</span>,       value: 'values' },
          ]}
        />
      </div>
      <Divider style={{ margin: '8px 0 0' }} />
      {section === 'dropdowns' ? <DropdownsTab /> : <ValuesTab />}
    </div>
  );
}

// ── Dropdowns Tab ─────────────────────────────────────────────────────

function DropdownsTab() {
  const { configs, addConfigType, renameConfigType, deleteConfigType, bulkImportConfigs, addItem, removeItem, editItem, updateLinks, clearAllConfigs } = useConfig();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('configuration', 'edit');
  const canDelete = hasPermission('configuration', 'delete');

  const [selectedId, setSelectedId] = useState<string | null>(configs[0]?.id ?? null);
  const [newTypeModal, setNewTypeModal] = useState(false);
  const [newTypeForm] = Form.useForm();
  const [linksModal, setLinksModal] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [addItemInput, setAddItemInput] = useState('');
  const [addItemColor, setAddItemColor] = useState('default');

  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('default');

  const selectedConfig = configs.find(c => c.id === selectedId) ?? null;

  const handleAddItem = () => {
    const label = addItemInput.trim();
    if (!label || !selectedId) return;
    if (selectedConfig?.items.some(i => i.label.toLowerCase() === label.toLowerCase())) {
      message.warning('An item with this label already exists');
      return;
    }
    addItem(selectedId, label, addItemColor);
    setAddItemInput('');
    setAddItemColor('default');
    message.success('Value added');
  };

  const handleEditSave = () => {
    if (!editingItem || !selectedId) return;
    editItem(selectedId, editingItem.value, editLabel.trim(), editColor);
    setEditingItem(null);
    message.success('Value updated');
  };

  const handleCreateType = (values: { name: string; description: string }) => {
    addConfigType(values.name.trim(), values.description?.trim() ?? '');
    newTypeForm.resetFields();
    setNewTypeModal(false);
    message.success(`Configuration "${values.name}" created`);
  };

  const handleRenameSave = (id: string) => {
    const name = renameValue.trim();
    if (!name) { message.warning('Name cannot be empty'); return; }
    renameConfigType(id, name);
    setRenamingId(null);
    message.success('Renamed successfully');
  };

  const handleDownloadTemplate = () => {
    // Sheet 1: template rows (Linked To uses semicolon-separated IDs)
    const template = [
      { 'Configuration Type': 'Request Priority', 'Value': 'High', 'Color': 'red', 'Linked To': '' },
      { 'Configuration Type': 'Request Priority', 'Value': 'Medium', 'Color': 'gold', 'Linked To': '' },
      { 'Configuration Type': 'Request Priority', 'Value': 'Low', 'Color': 'green', 'Linked To': '' },
      { 'Configuration Type': 'Skill Category', 'Value': 'Frontend', 'Color': 'blue', 'Linked To': 'resource_skill_field' },
      { 'Configuration Type': 'Skill Category', 'Value': 'Backend', 'Color': 'cyan', 'Linked To': 'resource_skill_field' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 40 }];

    // Sheet 2: available link target IDs
    const linkTargets = AVAILABLE_LINK_TARGETS.map(t => ({
      'Link Target ID': t.id,
      'Label': t.label,
      'Module': t.module,
    }));
    const ws2 = XLSX.utils.json_to_sheet(linkTargets);
    ws2['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Config Template');
    XLSX.utils.book_append_sheet(wb, ws2, 'Available Link Targets');
    XLSX.writeFile(wb, 'Configuration_Upload_Template.xlsx');
  };

  const handleBulkUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { message.warning('No data found in the file'); return; }

        // Robust header matching (trim + case-insensitive)
        const getField = (row: Record<string, string>, ...keys: string[]) => {
          for (const k of Object.keys(row)) {
            if (keys.some(key => k.trim().toLowerCase() === key.toLowerCase())) return (row[k] || '').toString().trim();
          }
          return '';
        };

        // Group rows by config type name, also capture linked_to per type
        const typeMap: Record<string, { values: string[]; linkedTo: string[] }> = {};
        rows.forEach(row => {
          const typeName = getField(row, 'Configuration Type', 'Config Type', 'configuration_type', 'Type', 'Name');
          const value = getField(row, 'Value', 'value', 'Label', 'label', 'Item');
          const linkedToRaw = getField(row, 'Linked To', 'linked_to', 'LinkedTo', 'Links');
          if (typeName) {
            if (!typeMap[typeName]) typeMap[typeName] = { values: [], linkedTo: [] };
            if (value) typeMap[typeName].values.push(value);
            // Parse semicolon-separated link IDs; only add valid ones
            if (linkedToRaw) {
              linkedToRaw.split(';').map(s => s.trim()).filter(Boolean).forEach(id => {
                if (AVAILABLE_LINK_TARGETS.some(t => t.id === id) && !typeMap[typeName].linkedTo.includes(id)) {
                  typeMap[typeName].linkedTo.push(id);
                }
              });
            }
          }
        });

        if (Object.keys(typeMap).length === 0) {
          message.warning('No valid data found. Ensure columns are "Configuration Type" and "Value".');
          return;
        }

        const entries = Object.entries(typeMap).map(([name, { values }]) => ({ name, values }));
        const { created, added } = bulkImportConfigs(entries);

        // Apply linked_to for entries that specify it
        Object.entries(typeMap).forEach(([name, { linkedTo }]) => {
          if (linkedTo.length > 0) {
            setTimeout(() => {
              const found = configs.find(c => c.name.toLowerCase() === name.toLowerCase());
              if (found) updateLinks(found.id, linkedTo);
            }, 300);
          }
        });

        if (created > 0 || added > 0) {
          message.success(`Imported: ${created} new type(s), ${added} value(s) added`);
          // Select the first imported type if nothing selected or newly created
          const firstEntry = entries[0];
          if (firstEntry) {
            setTimeout(() => {
              const found = configs.find(c => c.name.toLowerCase() === firstEntry.name.toLowerCase());
              if (found) setSelectedId(found.id);
            }, 200);
          }
        } else {
          message.info('No new items to import (all values already exist)');
        }
      } catch {
        message.error('Failed to read file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleLinksSave = (checkedValues: string[]) => {
    if (!selectedId) return;
    updateLinks(selectedId, checkedValues);
    setLinksModal(false);
    message.success('Links updated');
  };

  const handleExportConfigs = () => {
    const rows: Record<string, string>[] = [];
    configs.forEach(cfg => {
      const linkedToLabels = (cfg.linkedTo ?? [])
        .map(id => AVAILABLE_LINK_TARGETS.find(t => t.id === id)?.label ?? id)
        .join('; ');
      const linkedToIds = (cfg.linkedTo ?? []).join(';');
      cfg.items.forEach(item => {
        rows.push({
          'Configuration Type': cfg.name,
          'Value': item.label,
          'Color': item.color || 'default',
          'Linked To': linkedToIds,
          'Linked To (Labels)': linkedToLabels,
        });
      });
      if (cfg.items.length === 0) {
        rows.push({
          'Configuration Type': cfg.name,
          'Value': '',
          'Color': '',
          'Linked To': linkedToIds,
          'Linked To (Labels)': linkedToLabels,
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 50 }, { wch: 60 }];

    // Sheet 2: available link target reference
    const linkTargets = AVAILABLE_LINK_TARGETS.map(t => ({
      'Link Target ID': t.id,
      'Label': t.label,
      'Module': t.module,
    }));
    const ws2 = XLSX.utils.json_to_sheet(linkTargets);
    ws2['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Configurations');
    XLSX.utils.book_append_sheet(wb, ws2, 'Available Link Targets');
    XLSX.writeFile(wb, 'Configurations_Export.xlsx');
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>

          {/* ─── Left panel: config type list ─────────────────── */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <div style={{ background: '#fafafa', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 11 }}>Dropdown Types</Text>
                  <Space size={4}>
                    {canEdit && (
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setNewTypeModal(true)} style={{ fontSize: 11 }}>New</Button>
                    )}
                    <Dropdown
                      trigger={['click']}
                      menu={{
                        items: [
                          ...(canEdit ? [{
                            key: 'upload',
                            label: (
                              <Upload accept=".xlsx,.xls" beforeUpload={handleBulkUpload} showUploadList={false}>
                                <Space size={6}><UploadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Upload from Excel</Text></Space>
                              </Upload>
                            ),
                          }] : []),
                          {
                            key: 'template',
                            label: <Space size={6}><DownloadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Download template</Text></Space>,
                            onClick: handleDownloadTemplate,
                          },
                          {
                            key: 'export',
                            label: <Space size={6}><DownloadOutlined style={{ fontSize: 11, color: '#52c41a' }} /><Text style={{ fontSize: 11, color: '#52c41a' }}>Export all to Excel</Text></Space>,
                            onClick: handleExportConfigs,
                          },
                          ...(canDelete ? [{
                            key: 'deleteAll',
                            danger: true,
                            label: <Text style={{ fontSize: 11 }}>Delete all</Text>,
                            onClick: () => {
                              Modal.confirm({
                                title: 'Delete all non-built-in configurations?',
                                content: 'This will permanently remove all custom configuration types and their values.',
                                okText: 'Delete All',
                                okButtonProps: { danger: true },
                                onOk: () => { clearAllConfigs(); message.success('All configurations deleted'); },
                              });
                            },
                          }] : []),
                        ],
                      }}
                    >
                      <Button size="small" icon={<MoreOutlined />} />
                    </Dropdown>
                  </Space>
                </div>
              </div>

              <div style={{ padding: '8px' }}>
                {configs.map(cfg => (
                  <div
                    key={cfg.id}
                    onClick={() => { if (renamingId !== cfg.id) setSelectedId(cfg.id); }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selectedId === cfg.id ? '#e6f4ff' : 'transparent',
                      border: selectedId === cfg.id ? '1px solid #91caff' : '1px solid transparent',
                      marginBottom: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renamingId === cfg.id ? (
                          <Space size={4} onClick={e => e.stopPropagation()}>
                            <Input
                              size="small"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onPressEnter={() => handleRenameSave(cfg.id)}
                              style={{ fontSize: '11px', width: '140px' }}
                              autoFocus
                            />
                            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => handleRenameSave(cfg.id)} style={{ padding: '0 6px' }} />
                            <Button size="small" icon={<CloseOutlined />} onClick={() => setRenamingId(null)} style={{ padding: '0 6px' }} />
                          </Space>
                        ) : (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cfg.name}
                          </div>
                        )}
                      </div>

                      {renamingId !== cfg.id && (
                        <Space size={2} onClick={e => e.stopPropagation()}>
                          {canEdit && (
                          <Tooltip title="Rename">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={e => { e.stopPropagation(); setRenamingId(cfg.id); setRenameValue(cfg.name); }}
                              style={{ color: '#595959', opacity: 0.7 }}
                            />
                          </Tooltip>
                          )}
                          {canDelete && (
                          <Popconfirm
                              title="Delete this configuration?"
                              description="This will permanently remove this configuration type."
                              onConfirm={e => { e?.stopPropagation(); deleteConfigType(cfg.id); if (selectedId === cfg.id) setSelectedId(configs[0]?.id ?? null); }}
                              onCancel={e => e?.stopPropagation()}
                              okText="Delete"
                              okButtonProps={{ danger: true }}
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ opacity: 0.6 }} />
                            </Popconfirm>
                          )}
                        </Space>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right panel: selected config detail ──────────── */}
          <div style={{ flex: 1 }}>
            {!selectedConfig ? (
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '60px', textAlign: 'center' }}>
                <Empty description="Select a configuration type to manage its values" />
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>

                {/* Config header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <Text strong style={{ fontSize: 12 }}>{selectedConfig.name}</Text>
                      {selectedConfig.description && (
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                          {selectedConfig.description}
                        </Text>
                      )}
                      {/* Linked fields display */}
                      <div style={{ marginTop: 8 }}>
                        <Space wrap size={4}>
                          <LinkOutlined style={{ fontSize: '11px', color: '#8c8c8c' }} />
                          <Text type="secondary" style={{ fontSize: '11px' }}>Linked to:</Text>
                          {(selectedConfig.linkedTo ?? []).length === 0 ? (
                            <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>None</Text>
                          ) : (
                            (selectedConfig.linkedTo ?? []).map(linkId => {
                              const target = AVAILABLE_LINK_TARGETS.find(t => t.id === linkId);
                              return target ? (
                                <Tag key={linkId} color="geekblue" style={{ fontSize: '11px' }}>
                                  {target.module} → {target.label}
                                </Tag>
                              ) : null;
                            })
                          )}
                          {canEdit && (
                          <Button
                            size="small"
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => setLinksModal(true)}
                            style={{ fontSize: '11px', padding: '0 4px', height: 'auto' }}
                          >
                            Manage link
                          </Button>
                          )}
                        </Space>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items list */}
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong style={{ fontSize: '13px' }}>
                      Values <span style={{ fontWeight: 400, color: '#8c8c8c', fontSize: '12px' }}>({selectedConfig.items.length} total)</span>
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Changes apply instantly across the app
                    </Text>
                  </div>

                  {selectedConfig.items.length === 0 ? (
                    <Empty description="No values yet. Add the first one below." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <div style={{ marginBottom: '16px' }}>
                      {selectedConfig.items.map((item, idx) => (
                        <div
                          key={item.value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #f0f0f0',
                            marginBottom: '6px',
                            background: editingItem?.value === item.value ? '#f0f7ff' : '#fafafa',
                            transition: 'background 0.15s',
                          }}
                        >
                          <div style={{ width: '28px', color: '#bfbfbf', fontSize: '11px', flexShrink: 0 }}>
                            {idx + 1}.
                          </div>

                          {editingItem?.value === item.value ? (
                            <Space style={{ flex: 1 }} size={8}>
                              <Input
                                size="small"
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onPressEnter={handleEditSave}
                                style={{ width: '280px', fontSize: '12px' }}
                                autoFocus
                              />
                              <Select
                                size="small"
                                value={editColor}
                                onChange={setEditColor}
                                style={{ width: '120px' }}
                                options={TAG_COLORS.map(c => ({
                                  value: c,
                                  label: <Tag color={c} style={{ fontSize: '10px', margin: 0 }}>{c}</Tag>,
                                }))}
                              />
                              <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleEditSave} style={{ borderRadius: '6px' }} />
                              <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingItem(null)} style={{ borderRadius: '6px' }} />
                            </Space>
                          ) : (
                            <>
                              <div style={{ flex: 1 }}>
                                <Tag color={item.color || 'default'} style={{ fontSize: '12px', padding: '2px 10px' }}>
                                  {item.label}
                                </Tag>
                              </div>
                              <Space size={4}>
                                {canEdit && (
                                <Tooltip title="Edit">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => { setEditingItem(item); setEditLabel(item.label); setEditColor(item.color || 'default'); }}
                                    style={{ color: '#595959' }}
                                  />
                                </Tooltip>
                                )}
                                {canDelete && (
                                <Popconfirm
                                  title="Remove this value?"
                                  description="Existing records using this value will keep it, but it won't appear in dropdowns."
                                  onConfirm={() => { removeItem(selectedConfig.id, item.value); message.success('Value removed'); }}
                                  okText="Remove"
                                  okButtonProps={{ danger: true }}
                                >
                                  <Tooltip title="Delete">
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                  </Tooltip>
                                </Popconfirm>
                                )}
                              </Space>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Divider style={{ margin: '16px 0' }} />

                  {/* Add new value */}
                  {canEdit && (
                  <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '14px 16px', border: '1px dashed #d9d9d9' }}>
                    <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
                      <PlusOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                      Add New Value
                    </Text>
                    <Space size={8} wrap>
                      <Input
                        placeholder="Enter value label..."
                        value={addItemInput}
                        onChange={e => setAddItemInput(e.target.value)}
                        onPressEnter={handleAddItem}
                        style={{ width: '280px', fontSize: '12px' }}
                        size="small"
                      />
                      <Select
                        size="small"
                        value={addItemColor}
                        onChange={setAddItemColor}
                        style={{ width: '130px' }}
                        placeholder="Color"
                        options={TAG_COLORS.map(c => ({
                          value: c,
                          label: <Tag color={c} style={{ fontSize: '10px', margin: 0 }}>{c}</Tag>,
                        }))}
                      />
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={handleAddItem}
                        disabled={!addItemInput.trim()}
                        style={{ borderRadius: '6px' }}
                      >
                        Add
                      </Button>
                    </Space>
                    {addItemInput.trim() && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          Preview: <Tag color={addItemColor} style={{ fontSize: '11px' }}>{addItemInput}</Tag>
                        </Text>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* ─── New Config Type Modal ────────────────────────────── */}
      <Modal
        title={<Text style={{ fontSize: 13 }}>Create New Dropdown Type</Text>}
        open={newTypeModal}
        onCancel={() => { setNewTypeModal(false); newTypeForm.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={newTypeForm} layout="vertical" onFinish={handleCreateType} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Configuration Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. Request Priority, Skill Category..." />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={2} placeholder="Describe where this configuration is used..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setNewTypeModal(false); newTypeForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create Configuration</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Manage Links Modal ───────────────────────────────── */}
      {selectedConfig && (
        <LinksModal
          open={linksModal}
          configName={selectedConfig.name}
          currentLinks={selectedConfig.linkedTo ?? []}
          onSave={handleLinksSave}
          onCancel={() => setLinksModal(false)}
        />
      )}
    </div>
  );
}

interface LinksModalProps {
  open: boolean;
  configName: string;
  currentLinks: string[];
  onSave: (links: string[]) => void;
  onCancel: () => void;
}

function LinksModal({ open, configName, currentLinks, onSave, onCancel }: LinksModalProps) {
  const [checked, setChecked] = useState<string[]>(currentLinks);

  useEffect(() => { setChecked(currentLinks); }, [currentLinks, open]);

  // Build section → module → targets hierarchy
  const hierarchy: Record<string, Record<string, typeof AVAILABLE_LINK_TARGETS>> = {};
  AVAILABLE_LINK_TARGETS.forEach(t => {
    if (!hierarchy[t.section]) hierarchy[t.section] = {};
    if (!hierarchy[t.section][t.module]) hierarchy[t.section][t.module] = [];
    hierarchy[t.section][t.module].push(t);
  });

  const SECTION_ORDER = ['Finance Management', 'Resources', 'Request Management', 'Internal Process'];

  return (
    <Modal
      title={<Space><LinkOutlined style={{ color: '#1890ff' }} /> Manage Link — {configName}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave(checked)}
      okText="Save Links"
      width={560}
    >
      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
        Select the app fields that should use values from this configuration. When linked, the dropdown for that field will be populated from this config automatically.
      </Text>
      {SECTION_ORDER.filter(s => hierarchy[s]).map(section => (
        <div key={section} style={{ marginBottom: 16 }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e8e8e8' }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#1890ff', flexShrink: 0 }} />
            <Text strong style={{ fontSize: '12px', color: '#262626' }}>{section}</Text>
          </div>
          {Object.entries(hierarchy[section]).map(([module, targets]) => (
            <div key={module} style={{ marginBottom: 8, marginLeft: 12 }}>
              {/* Module sub-header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#8c8c8c', flexShrink: 0 }} />
                <Text style={{ fontSize: '11px', color: '#595959', fontWeight: 600 }}>{module}</Text>
              </div>
              {/* Target checkboxes */}
              {targets.map(t => (
                <div key={t.id} style={{
                  padding: '6px 10px 6px 20px',
                  borderRadius: 6,
                  border: `1px solid ${checked.includes(t.id) ? '#91caff' : '#f0f0f0'}`,
                  marginBottom: 4,
                  background: checked.includes(t.id) ? '#e6f4ff' : '#fafafa',
                  transition: 'all 0.15s',
                }}>
                  <Checkbox
                    checked={checked.includes(t.id)}
                    onChange={e => {
                      if (e.target.checked) setChecked(prev => [...prev, t.id]);
                      else setChecked(prev => prev.filter(x => x !== t.id));
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{t.label}</span>
                    {t.description && (
                      <span style={{ fontSize: '10px', color: '#8c8c8c', marginLeft: 6 }}>— {t.description}</span>
                    )}
                  </Checkbox>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}

// ── Values Tab ────────────────────────────────────────────────────────

function ValuesTab() {
  const { appValues, addAppValue, setAppValue, removeAppValue, clearAllValues } = useConfig();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addVal, setAddVal] = useState('');
  const [addDesc, setAddDesc] = useState('');

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleAdd = () => {
    const k = addKey.trim().toUpperCase().replace(/\s+/g, '_');
    if (!k) { message.warning('Key is required'); return; }
    if (!addVal.trim()) { message.warning('Value is required'); return; }
    addAppValue(k, addVal.trim(), addDesc.trim());
    setAddKey(''); setAddVal(''); setAddDesc('');
    setAddModalOpen(false);
    message.success('Value added');
  };

  const handleEditSave = () => {
    if (!editingKey) return;
    setAppValue(editingKey, editVal.trim(), editDesc.trim());
    setEditingKey(null);
    message.success('Value updated');
  };

  const handleDownloadValuesTemplate = () => {
    const template = [
      { Key: 'SOW_STORAGE_URL', Value: 'https://sharepoint.com/...', Description: 'SharePoint URL for SOW documents' },
      { Key: 'REPORT_EMAIL', Value: 'reports@company.com', Description: 'Email address for report notifications' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Values Template');
    XLSX.writeFile(wb, 'AppValues_Upload_Template.xlsx');
  };

  const handleUploadValues = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { message.warning('No data found in the file'); return; }

        const getField = (row: Record<string, string>, ...keys: string[]) => {
          for (const k of Object.keys(row)) {
            if (keys.some(key => k.trim().toLowerCase() === key.toLowerCase())) return (row[k] || '').toString().trim();
          }
          return '';
        };

        let count = 0;
        rows.forEach(row => {
          const k = getField(row, 'Key', 'key').toUpperCase().replace(/\s+/g, '_');
          const v = getField(row, 'Value', 'value');
          const d = getField(row, 'Description', 'description');
          if (k && v) { addAppValue(k, v, d); count++; }
        });

        if (count > 0) message.success(`${count} value(s) imported`);
        else message.warning('No valid rows found. Ensure columns are "Key" and "Value".');
      } catch {
        message.error('Failed to read file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleExportValues = () => {
    const rows = appValues.map(v => ({ Key: v.key, Value: v.value, Description: v.description || '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'App Values');
    XLSX.writeFile(wb, 'AppValues_Export.xlsx');
  };

  return (
    <div style={{ padding: '12px 0' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>{appValues.length} value{appValues.length !== 1 ? 's' : ''} configured</Text>
        <Space size={4}>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)} style={{ fontSize: 11 }}>New</Button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'upload',
                  label: (
                    <Upload accept=".xlsx,.xls" beforeUpload={handleUploadValues} showUploadList={false}>
                      <Space size={6}><UploadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Upload from Excel</Text></Space>
                    </Upload>
                  ),
                },
                {
                  key: 'template',
                  label: <Space size={6}><DownloadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Download template</Text></Space>,
                  onClick: handleDownloadValuesTemplate,
                },
                {
                  key: 'export',
                  label: <Space size={6}><DownloadOutlined style={{ fontSize: 11, color: '#52c41a' }} /><Text style={{ fontSize: 11, color: '#52c41a' }}>Export all to Excel</Text></Space>,
                  onClick: handleExportValues,
                },
                {
                  key: 'deleteAll',
                  danger: true,
                  label: <Text style={{ fontSize: 11 }}>Delete all</Text>,
                  onClick: () => {
                    Modal.confirm({
                      title: 'Delete all application values?',
                      content: 'This will permanently remove all key-value settings.',
                      okText: 'Delete All',
                      okButtonProps: { danger: true },
                      onOk: () => { clearAllValues(); message.success('All values deleted'); },
                    });
                  },
                },
              ],
            }}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {/* Values list */}
      {appValues.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No values yet. Click New to add one." style={{ margin: '24px 0' }} />
      ) : (
        <div style={{ marginBottom: 8 }}>
          {appValues.map((item: AppValue) => (
            <div key={item.key} style={{
              background: editingKey === item.key ? '#f0f7ff' : '#fafafa',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 8,
              transition: 'background 0.15s',
            }}>
              {editingKey === item.key ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ flex: '0 0 160px' }}>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Key</div>
                      <Input value={item.key} disabled size="small" style={{ fontFamily: 'monospace', fontSize: '11px' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Value</div>
                      <Input
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        size="small"
                        style={{ fontSize: '12px' }}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Description (optional)</div>
                    <Input
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      size="small"
                      style={{ fontSize: '12px' }}
                      placeholder="What is this value used for?"
                    />
                  </div>
                  <Space size={6}>
                    <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleEditSave} style={{ borderRadius: 6 }}>Save</Button>
                    <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingKey(null)} style={{ borderRadius: 6 }}>Cancel</Button>
                  </Space>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>{item.key}</Tag>
                    </div>
                    <div style={{ fontSize: '12px', color: '#262626', wordBreak: 'break-all', marginBottom: item.description ? 4 : 0 }}>
                      {item.value.startsWith('http') ? (
                        <a href={item.value} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', fontSize: '12px' }}>
                          {item.value}
                        </a>
                      ) : item.value}
                    </div>
                    {item.description && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>{item.description}</Text>
                    )}
                  </div>
                  <Space size={4}>
                    <Tooltip title="Edit">
                      <Button type="text" size="small" icon={<EditOutlined />}
                        onClick={() => { setEditingKey(item.key); setEditVal(item.value); setEditDesc(item.description || ''); }}
                        style={{ color: '#595959' }} />
                    </Tooltip>
                    <Popconfirm
                      title="Remove this value?"
                      description="Any features that reference this key will lose their configured value."
                      onConfirm={() => { removeAppValue(item.key); message.success('Value removed'); }}
                      okText="Remove" okButtonProps={{ danger: true }}
                    >
                      <Tooltip title="Delete">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add New Value Modal */}
      <Modal
        open={addModalOpen}
        title={<Text style={{ fontSize: 13 }}>Add New App Value</Text>}
        onCancel={() => { setAddModalOpen(false); setAddKey(''); setAddVal(''); setAddDesc(''); }}
        onOk={handleAdd}
        okText="Add"
        okButtonProps={{ disabled: !addKey.trim() || !addVal.trim() }}
        width={440}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div>
            <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Key <span style={{ color: '#f5222d' }}>*</span></Text>
            <Input
              placeholder="e.g. MY_SETTING"
              value={addKey}
              onChange={e => setAddKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              size="small"
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Value <span style={{ color: '#f5222d' }}>*</span></Text>
            <Input
              placeholder="e.g. https://... or any setting value"
              value={addVal}
              onChange={e => setAddVal(e.target.value)}
              onPressEnter={handleAdd}
              size="small"
              style={{ fontSize: 11 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Description <span style={{ color: '#8c8c8c' }}>(optional)</span></Text>
            <Input
              placeholder="What is this value used for?"
              value={addDesc}
              onChange={e => setAddDesc(e.target.value)}
              size="small"
              style={{ fontSize: 11 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Notification Triggers Tab ──────────────────────────────────────────

// Drag-handle row wrapper for the triggers table
function SortableTriggerRow({ id, children, ...rest }: HTMLAttributes<HTMLTableRowElement> & { id: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...rest}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: isDragging ? '#e6f4ff' : undefined,
        cursor: 'default',
      }}
    >
      {children}
    </tr>
  );
}

// Special field pseudo-values — kept in sync with server/config/triggerSources.js
// This set is only used for UI decisions (hide field_value target type, auto-fill template)
const SPECIAL_FIELD_VALUES = new Set(['__any__', '__revenue__', '__invoice_amounts__', '__bulk_insert__', '__delete_all__', '__record_delete__']);

const NOTIFY_TARGET_TYPES = [
  { label: 'New value is the user (field_value)', value: 'field_value' },
  { label: 'Notify a User Group', value: 'group' },
  { label: 'Broadcast (all users)', value: 'broadcast' },
];

const NOTIFICATION_TYPES = [
  { label: 'Task', value: 'task' },
  { label: 'Info', value: 'info' },
  { label: 'Alert', value: 'alert' },
];

function NotificationTriggersTab() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('configuration', 'edit');
  const canDelete = hasPermission('configuration', 'delete');

  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [triggerSources, setTriggerSources] = useState<TriggerSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<NotificationTrigger | null>(null);
  const [form] = Form.useForm();

  const selectedSource = Form.useWatch('source_table', form);
  const selectedFieldRaw = Form.useWatch('trigger_field', form);
  const selectedFields: string[] = Array.isArray(selectedFieldRaw)
    ? selectedFieldRaw
    : (selectedFieldRaw ? [selectedFieldRaw] : []);
  const isSpecialField = selectedFields.some(f => SPECIAL_FIELD_VALUES.has(f));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, grps, sources] = await Promise.all([
        getNotificationTriggers(),
        getUserGroups(),
        getTriggerSources(),
      ]);
      setTriggers(data);
      setGroups(grps);
      setTriggerSources(sources);
    } catch (_) {
      message.error('Failed to load triggers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // dnd-kit sensors — require 5px of movement before drag starts (avoids accidental drags)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = triggers.findIndex(t => t.id === active.id);
    const newIndex = triggers.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(triggers, oldIndex, newIndex);
    setTriggers(reordered); // optimistic update
    await reorderNotificationTriggers(reordered.map(t => t.id));
  };

  const openCreate = () => {
    setEditingTrigger(null);
    form.resetFields();
    form.setFieldsValue({
      source_table: triggerSources[0]?.value || '',
      trigger_field: [],
      notify_target_type: 'field_value',
      notification_type: 'task',
      is_active: true,
      message_template: 'The {field} of "{record_name}" was changed from "{old_value}" to "{new_value}" by {changed_by}.',
    });    setModalOpen(true);
  };

  const openEdit = (t: NotificationTrigger) => {
    setEditingTrigger(t);
    form.setFieldsValue({
      name: t.name,
      source_table: t.source_table,
      trigger_field: t.trigger_field ? t.trigger_field.split(',').map(f => f.trim()).filter(Boolean) : [],
      message_template: t.message_template,
      notify_target_type: t.notify_target_type,
      notify_target_value: t.notify_target_value,
      notification_type: t.notification_type,
      is_active: !!t.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const fields: string[] = Array.isArray(vals.trigger_field) ? vals.trigger_field : [vals.trigger_field];
      const triggerLabel = fields
        .map(f => sourceFields.find(sf => sf.value === f)?.label || f)
        .join(', ');
      const payload = {
        name: vals.name,
        source_table: vals.source_table,
        trigger_field: fields.join(','),
        trigger_label: triggerLabel,
        message_template: vals.message_template || '',
        notify_target_type: vals.notify_target_type,
        notify_target_value: vals.notify_target_value || '',
        notification_type: vals.notification_type || 'task',
        is_active: vals.is_active ? 1 : 0,
      };

      if (editingTrigger) {
        const res = await updateNotificationTrigger(editingTrigger.id, payload);
        if (res.ok) { message.success('Trigger updated'); setModalOpen(false); load(); }
        else message.error(res.error || 'Update failed');
      } else {
        const res = await createNotificationTrigger(payload as any);
        if (res.ok) { message.success('Trigger created'); setModalOpen(false); load(); }
        else message.error(res.error || 'Create failed');
      }
    } catch (_) {}
  };

  const handleDelete = async (id: number) => {
    const res = await deleteNotificationTrigger(id);
    if (res.ok) { message.success('Deleted'); load(); }
    else message.error(res.error || 'Delete failed');
  };

  const handleDuplicate = async (t: NotificationTrigger) => {
    const res = await createNotificationTrigger({
      name: `${t.name} (copy)`,
      source_table: t.source_table,
      trigger_field: t.trigger_field,
      trigger_label: t.trigger_label,
      message_template: t.message_template,
      notify_target_type: t.notify_target_type,
      notify_target_value: t.notify_target_value,
      notification_type: t.notification_type,
      is_active: 0,
    } as any);
    if (res.ok) { message.success('Trigger duplicated (inactive)'); load(); }
    else message.error(res.error || 'Duplicate failed');
  };

  const handleToggle = async (id: number) => {
    await toggleNotificationTrigger(id);
    load();
  };

  const sourceFields = triggerSources.find(s => s.value === selectedSource)?.fields || [];
  const groupOptions = groups.map(g => ({ label: g.name, value: String(g.id) }));

  const columns = [
    ...(canEdit ? [{
      title: '',
      key: 'drag',
      width: 28,
      render: () => (
        <HolderOutlined style={{ cursor: 'grab', color: '#bbb', fontSize: 13 }} />
      ),
    }] : []),
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text style={{ fontWeight: 600, fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Source',
      dataIndex: 'source_table',
      key: 'source_table',
      render: (v: string) => {
        const s = triggerSources.find(x => x.value === v);
        return <Tag color="blue" style={{ fontSize: 9 }}>{s?.label || v}</Tag>;
      },
    },
    {
      title: 'Field',
      dataIndex: 'trigger_field',
      key: 'trigger_field',
      render: (v: string, row: NotificationTrigger) => {
        const fields = v ? v.split(',').map(f => f.trim()).filter(Boolean) : [];
        const src = triggerSources.find(s => s.value === row.source_table);
        return (
          <Space size={2} wrap>
            {fields.map(f => {
              if (f === '__any__') return <Tag key={f} color="volcano" style={{ fontSize: 9 }}>★ Any field</Tag>;
              if (SPECIAL_FIELD_VALUES.has(f)) {
                const fi = src?.fields.find(fi => fi.value === f);
                return <Tag key={f} color="geekblue" style={{ fontSize: 9 }}>{fi?.label || f}</Tag>;
              }
              const fi = src?.fields.find(fi => fi.value === f);
              return <Tag key={f} color="cyan" style={{ fontSize: 9 }}>{fi?.label || f}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: 'Notify',
      dataIndex: 'notify_target_type',
      key: 'notify_target_type',
      render: (v: string, row: NotificationTrigger) => {
        if (v === 'field_value') return <Tag color="green" style={{ fontSize: 9 }}>New value → User</Tag>;
        if (v === 'group') {
          const grp = groups.find(g => String(g.id) === String(row.notify_target_value));
          return <Tag color="purple" style={{ fontSize: 9 }}>Group: {grp ? grp.name : row.notify_target_value}</Tag>;
        }
        return <Tag color="orange" style={{ fontSize: 9 }}>Broadcast</Tag>;
      },
    },
    {
      title: 'Type',
      dataIndex: 'notification_type',
      key: 'notification_type',
      render: (v: string) => <Tag style={{ fontSize: 9 }}>{v}</Tag>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: number, row: NotificationTrigger) =>
        canEdit ? (
          <Switch
            size="small"
            checked={!!v}
            onChange={() => handleToggle(row.id)}
          />
        ) : (
          <Badge status={v ? 'success' : 'default'} text={v ? 'On' : 'Off'} />
        ),
    },
    ...(canEdit || canDelete ? [{
      title: '',
      key: 'actions',
      width: 90,
      render: (_: unknown, row: NotificationTrigger) => (
        <Space size={2}>
          {canEdit && (
            <Tooltip title="Duplicate">
              <Button type="text" size="small" icon={<CopyOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />} onClick={() => handleDuplicate(row)} />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<EditOutlined style={{ fontSize: 12 }} />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {canDelete && (
            <Tooltip title="Delete">
              <Popconfirm
                title="Delete this trigger?"
                onConfirm={() => handleDelete(row.id)}
                okText="Delete"
                okButtonProps={{ danger: true, size: 'small' }}
                cancelButtonProps={{ size: 'small' }}
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: 12 }} />} />
              </Popconfirm>
            </Tooltip>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <div style={{ padding: '12px 4px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: '#595959' }}>
          Automatically send notifications on the app based on configured rules
        </Text>
        {canEdit && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ fontSize: 11 }}>
            Add Trigger
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={triggers.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <Table
            dataSource={triggers}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No triggers configured yet" imageStyle={{ height: 40 }} /> }}
            components={{
              body: {
                row: ({ children, ...props }: any) => {
                  const id = props['data-row-key'] ? Number(props['data-row-key']) : 0;
                  return canEdit
                    ? <SortableTriggerRow id={id} {...props}>{children}</SortableTriggerRow>
                    : <tr {...props}>{children}</tr>;
                },
              },
            }}
          />
        </SortableContext>
      </DndContext>

      <Modal
        open={modalOpen}
        title={<Text style={{ fontSize: 13 }}>{editingTrigger ? 'Edit Trigger' : 'New Notification Trigger'}</Text>}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Save"
        width={620}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 10 }}>
          {/* Row 1: Name + Active */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
            <Form.Item name="name" label={<Text style={{ fontSize: 11 }}>Trigger Name</Text>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
              <Input placeholder="e.g. SOW Owner Assignment" />
            </Form.Item>
            <Form.Item name="is_active" label={<Text style={{ fontSize: 11 }}>Active</Text>} valuePropName="checked" style={{ marginBottom: 10 }}>
              <Switch size="small" />
            </Form.Item>
          </div>

          {/* Row 2: Source + Notification Type */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="source_table" label={<Text style={{ fontSize: 11 }}>Source</Text>} rules={[{ required: true }]} style={{ marginBottom: 10 }}>
              <Select
                options={triggerSources.map(s => ({ label: s.label, value: s.value }))}
                onChange={() => form.setFieldValue('trigger_field', undefined)}
              />
            </Form.Item>
            <Form.Item name="notification_type" label={<Text style={{ fontSize: 11 }}>Notification Type</Text>} style={{ marginBottom: 10 }}>
              <Select options={NOTIFICATION_TYPES} />
            </Form.Item>
          </div>

          {/* Trigger fields */}
          <Form.Item
            name="trigger_field"
            label={<Text style={{ fontSize: 11 }}>When these field(s) change</Text>}
            rules={[{ required: true, message: 'Select at least one field' }]}
            style={{ marginBottom: 10 }}
          >
            <Select
              mode="multiple"
              options={sourceFields.map(f => ({ label: f.label, value: f.value }))}
              placeholder="Select one or more fields"
              disabled={sourceFields.length === 0}
              allowClear
              onChange={(vals: string[]) => {
                const hasSpecial = vals.some(v => SPECIAL_FIELD_VALUES.has(v));
                if (hasSpecial || vals.length > 1) {
                  form.setFieldsValue({
                    message_template: 'For record "{record_name}", {changes}. Updated by {changed_by}.',
                    notify_target_type: form.getFieldValue('notify_target_type') === 'field_value'
                      ? 'group'
                      : form.getFieldValue('notify_target_type'),
                  });
                } else {
                  form.setFieldsValue({
                    message_template: 'The {field} of "{record_name}" was changed from "{old_value}" to "{new_value}" by {changed_by}.',
                  });
                }
              }}
            />
          </Form.Item>

          {/* Notify Who + conditional User Group side by side */}
          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.notify_target_type !== curr.notify_target_type}>
            {({ getFieldValue }) => {
              const targetType = getFieldValue('notify_target_type');
              return (
                <div style={{ display: 'grid', gridTemplateColumns: targetType === 'group' ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <Form.Item name="notify_target_type" label={<Text style={{ fontSize: 11 }}>Notify Who?</Text>} rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                    <Select
                      options={NOTIFY_TARGET_TYPES.filter(t => {
                        if (t.value !== 'field_value') return true;
                        return !isSpecialField && selectedFields.length === 1;
                      })}
                    />
                  </Form.Item>
                  {targetType === 'group' && (
                    <Form.Item name="notify_target_value" label={<Text style={{ fontSize: 11 }}>User Group</Text>} rules={[{ required: true, message: 'Select a group' }]} style={{ marginBottom: 10 }}>
                      <Select
                        options={groupOptions}
                        placeholder="Select a group"
                        showSearch
                        filterOption={(input, opt) => (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                      />
                    </Form.Item>
                  )}
                </div>
              );
            }}
          </Form.Item>

          {/* Message Template */}
          <Form.Item
            name="message_template"
            label={<Text style={{ fontSize: 11 }}>Message Template</Text>}
            style={{ marginBottom: 0 }}
            extra={<Text style={{ fontSize: 10, color: '#8c8c8c' }}>{isSpecialField ? 'Variables: {changes}, {record_name}, {changed_by}' : 'Variables: {field}, {old_value}, {new_value}, {record_name}, {changed_by}'}</Text>}
          >
            <Input.TextArea
              rows={2}
              placeholder={isSpecialField
                ? '"{record_name}" was updated by {changed_by}: {changes}'
                : "The {field} of '{record_name}' changed from '{old_value}' to '{new_value}' by {changed_by}."}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}