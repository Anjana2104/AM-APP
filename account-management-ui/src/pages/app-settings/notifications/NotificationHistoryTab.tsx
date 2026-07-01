import { useCallback, useEffect, useState } from 'react';
import {
  AutoComplete,
  Badge,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Col,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { DeleteOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  NotificationHistoryRow,
  deleteNotificationHistory,
  getNotificationHistory,
} from '../../../api/notificationRulesApi';

const { Text } = Typography;

export function NotificationHistoryTab() {
  const [rows, setRows] = useState<NotificationHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(50);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [srcFilter, setSrcFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [delPeriod, setDelPeriod] = useState<'today'|'7d'|'30d'|'all'>('today');
  const [delSource, setDelSource] = useState<'rule_engine'|'change_trigger'|'all'>('all');
  const [delTitle, setDelTitle] = useState<string>('');

  const PERIOD_OPTS = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All time' },
  ];
  const SOURCE_OPTS = [
    { value: 'all', label: 'All Sources' },
    { value: 'rule_engine', label: '⏱ Scheduled Rules' },
    { value: 'change_trigger', label: '⚡ Change Triggers' },
  ];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotificationHistory(300);
      setRows(data);
    } catch {
      message.error('Failed to load history');
    } finally {
      setLoading(false);
    }
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
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setSrcFilter('all');
    setTypeFilter('all');
    setPeriodFilter('all');
    setSearch('');
  };

  const cutoffDate = () => {
    if (periodFilter === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
    if (periodFilter === '7d') { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
    if (periodFilter === '30d') { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
    return null;
  };

  const filtered = rows.filter((r) => {
    if (srcFilter === 'rule_engine' && r.source_user !== 'Scheduled Rules') return false;
    if (srcFilter === 'change_trigger' && r.source_user !== 'Change Triggers') return false;
    if (srcFilter === 'failed' && r.source_user !== 'System Error' && r.type !== 'error') return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.message.toLowerCase().includes(search.toLowerCase())) return false;
    const cut = cutoffDate();
    if (cut && new Date(r.created_at) < cut) return false;
    return true;
  });

  const ruleCount = rows.filter((r) => r.source_user === 'Scheduled Rules').length;
  const triggerCount = rows.filter((r) => r.source_user === 'Change Triggers').length;
  const failedCount = rows.filter((r) => r.source_user === 'System Error' || r.type === 'error').length;
  const activeFilters = [srcFilter, typeFilter, periodFilter].filter((f) => f !== 'all').length + (search ? 1 : 0);

  const filterTags = [
    srcFilter !== 'all' && { key: 'src', label: [SOURCE_OPTS, [{ value: 'failed', label: '✗ Failures' }]].flat().find((o) => o.value === srcFilter)?.label ?? srcFilter, clear: () => setSrcFilter('all') },
    typeFilter !== 'all' && { key: 'type', label: typeFilter, clear: () => setTypeFilter('all') },
    periodFilter !== 'all' && { key: 'period', label: PERIOD_OPTS.find((o) => o.value === periodFilter)?.label ?? periodFilter, clear: () => setPeriodFilter('all') },
    search && { key: 'search', label: `"${search}"`, clear: () => setSearch('') },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

  const recipientLabel = (r: NotificationHistoryRow) => {
    const n = r.recipient_count ?? 0;
    if (n === 0) return <Text style={{ fontSize: 10, color: '#8c8c8c' }}>—</Text>;
    if (n >= 5) return <Tag color="geekblue" style={{ fontSize: 9 }}>Everyone ({n})</Tag>;
    if (n > 1) return <Tag color="cyan" style={{ fontSize: 9 }}>Group ({n})</Tag>;
    const name = r.recipients_list?.split(' | ')[0] ?? '1 user';
    return <Text style={{ fontSize: 10 }}>{name}</Text>;
  };

  const typeIcon = (type: string) => {
    if (type === 'alert') return <Badge color="red" />;
    if (type === 'task') return <Badge color="green" />;
    if (type === 'info') return <Badge color="blue" />;
    if (type === 'error') return <Badge color="volcano" />;
    return <Badge color="default" />;
  };

  const columns = [
    { title: <Text style={{ fontSize: 10 }}>S.No</Text>, key: 'sno', width: 50, render: (_: unknown, __: NotificationHistoryRow, idx: number) => <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{((tablePage - 1) * tablePageSize) + idx + 1}</Text> },
    { title: '', key: 'type', width: 22, render: (_: unknown, r: NotificationHistoryRow) => typeIcon(r.type) },
    {
      title: <Text style={{ fontSize: 10 }}>Title</Text>, dataIndex: 'title', key: 'title', width: 160,
      render: (v: string, r: NotificationHistoryRow) => (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 11 }}>{v}</Text>
          {(r.notification_count ?? 1) > 1 && (
            <Tag color="geekblue" style={{ fontSize: 9, marginTop: 2 }}>
              {r.notification_count} notifications
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: <Text style={{ fontSize: 10 }}>Messages</Text>, dataIndex: 'message', key: 'msg',
      render: (v: string) => {
        const parts = v ? v.split(' | ').filter(Boolean) : [];
        if (parts.length <= 1) return <Text style={{ fontSize: 10, color: '#595959' }}>{v || '—'}</Text>;
        return (
          <Tooltip title={<ul style={{ margin: 0, paddingLeft: 14, fontSize: 11 }}>{parts.map((p, i) => <li key={i}>{p}</li>)}</ul>} overlayStyle={{ maxWidth: 400 }}>
            <Space direction="vertical" size={1}>
              <Text style={{ fontSize: 10, color: '#595959' }} ellipsis>{parts[0]}</Text>
              <Text style={{ fontSize: 9, color: '#1677ff' }}>+{parts.length - 1} more (hover)</Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: <Text style={{ fontSize: 10 }}>Source</Text>, dataIndex: 'source_user', key: 'src', width: 130,
      render: (v: string) => {
        const isRule = v === 'Scheduled Rules';
        const isErr = v === 'System Error';
        const isTrigger = v === 'Change Triggers';
        return <Tag color={isErr ? 'red' : isRule ? 'purple' : isTrigger ? 'blue' : 'default'} style={{ fontSize: 9 }}>{isRule ? '⏱ Scheduled Rules' : isErr ? '✗ System Error' : isTrigger ? '⚡ Change Triggers' : v || '—'}</Tag>;
      },
    },
    { title: <Text style={{ fontSize: 10 }}>Recipients</Text>, key: 'rcpt', width: 120, render: (_: unknown, r: NotificationHistoryRow) => recipientLabel(r) },
    {
      title: <Text style={{ fontSize: 10 }}>Read</Text>, key: 'read', width: 70,
      render: (_: unknown, r: NotificationHistoryRow) => {
        const total = r.recipient_count ?? 0; const readN = r.read_count ?? 0;
        if (total === 0) return <Text style={{ fontSize: 10, color: '#8c8c8c' }}>—</Text>;
        return readN >= total ? <Tag color="green" style={{ fontSize: 9 }}>All read</Tag> : <Tag style={{ fontSize: 9 }}>{readN}/{total}</Tag>;
      },
    },
    { title: <Text style={{ fontSize: 10 }}>When</Text>, dataIndex: 'created_at', key: 'ts', width: 130, render: (v: string) => <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{v ? new Date(v).toLocaleString() : '—'}</Text> },
  ];

  const delLabel = [PERIOD_OPTS.find((p) => p.value === delPeriod)?.label, SOURCE_OPTS.find((s) => s.value === delSource)?.label, delTitle ? `Title: "${delTitle}"` : null].filter(Boolean).join(' · ');

  return (
    <div style={{ padding: '12px 4px 4px' }}>
      <Row gutter={8} style={{ marginBottom: 10 }}>
        {[
          { label: 'Total Sent', value: rows.length, color: '#1677ff', bg: '#f5f5f5', border: 'transparent' },
          { label: 'Scheduled Rules', value: ruleCount, color: '#722ed1', bg: '#f5f5f5', border: 'transparent' },
          { label: 'Change Triggers', value: triggerCount, color: '#1677ff', bg: '#f5f5f5', border: 'transparent' },
          { label: 'Failures', value: failedCount, color: failedCount > 0 ? '#ff4d4f' : '#8c8c8c', bg: failedCount > 0 ? '#fff1f0' : '#f5f5f5', border: failedCount > 0 ? '#ffccc7' : 'transparent' },
        ].map((c) => (
          <Col span={6} key={c.label}>
            <div style={{ background: c.bg, borderRadius: 4, padding: '6px 10px', textAlign: 'center', border: `1px solid ${c.border}` }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: c.color }}>{c.value}</div>
              <Text style={{ fontSize: 10, color: '#595959' }}>{c.label}</Text>
            </div>
          </Col>
        ))}
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: filterTags.length ? 6 : 8 }}>
        <Space size={4}>
          <Input
            size="small"
            prefix={<FilterOutlined style={{ fontSize: 10, color: '#bfbfbf' }} />}
            placeholder="Search title or message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 190, fontSize: 11 }}
          />
          <Button size="small" icon={<FilterOutlined />} onClick={() => setFilterOpen(true)} type={activeFilters > 0 ? 'primary' : 'default'} style={{ fontSize: 11 }}>
            {activeFilters > 0 ? `Filters (${activeFilters})` : 'Filters'}
          </Button>
          {activeFilters > 0 && (
            <Button size="small" type="link" onClick={clearFilters} style={{ fontSize: 11, padding: '0 4px', color: '#ff4d4f' }}>
              Clear all
            </Button>
          )}
        </Space>
        <Space size={4}>
          <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{filtered.length} / {rows.length}</Text>
          <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setDeleteOpen(true)} style={{ fontSize: 11 }}>Delete</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading} />
        </Space>
      </div>

      {filterTags.length > 0 && (
        <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {filterTags.map((t) => (
            <Tag key={t.key} closable onClose={t.clear} style={{ fontSize: 10, borderRadius: 10, cursor: 'default' }}>
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
          onChange: (page, pageSize) => { setTablePage(page); setTablePageSize(pageSize); },
        }}
        style={{ fontSize: 11 }}
        rowClassName={(r: NotificationHistoryRow) => r.type === 'error' || r.source_user === 'System Error' ? 'ant-table-row-danger' : ''}
      />

      <Drawer
        title={<Text style={{ fontSize: 12 }}>Filter History</Text>}
        placement="right"
        width={280}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        extra={<Button size="small" style={{ fontSize: 11 }} onClick={clearFilters}>Clear All</Button>}
        styles={{ body: { padding: '16px 20px' } }}
        footer={<Button type="primary" size="small" block style={{ fontSize: 11 }} onClick={() => setFilterOpen(false)}>Apply</Button>}
      >
        <Form layout="vertical" size="small">
          <Form.Item label={<Text style={{ fontSize: 11 }}>Source</Text>} style={{ marginBottom: 10 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={srcFilter} onChange={setSrcFilter}
              options={[
                { value: 'all', label: 'All Sources' },
                { value: 'rule_engine', label: '⏱ Scheduled Rules' },
                { value: 'change_trigger', label: '⚡ Change Triggers' },
                { value: 'failed', label: '✗ Failures only' },
              ]}
            />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Type</Text>} style={{ marginBottom: 10 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={typeFilter} onChange={setTypeFilter}
              options={[
                { value: 'all', label: 'All Types' },
                { value: 'alert', label: '🔴 Alert' },
                { value: 'task', label: '✅ Task' },
                { value: 'info', label: 'ℹ️ Info' },
                { value: 'error', label: '✗ Error' },
              ]}
            />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Period</Text>} style={{ marginBottom: 0 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={periodFilter} onChange={setPeriodFilter} options={PERIOD_OPTS} />
          </Form.Item>
        </Form>
      </Drawer>

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
              options={[...new Set(rows.map((r) => r.title))].filter(Boolean).map((t) => ({ value: t }))}
              filterOption={(input, opt) => (opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
              placeholder="Filter by title (partial match)"
              allowClear
            />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Delete notifications from</Text>} style={{ marginBottom: 10 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={delPeriod} onChange={(v) => setDelPeriod(v as typeof delPeriod)} options={PERIOD_OPTS} />
          </Form.Item>
          <Form.Item label={<Text style={{ fontSize: 11 }}>Source to delete</Text>} style={{ marginBottom: 0 }}>
            <Select size="small" style={{ width: '100%', fontSize: 11 }} value={delSource} onChange={(v) => setDelSource(v as typeof delSource)} options={SOURCE_OPTS} />
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
