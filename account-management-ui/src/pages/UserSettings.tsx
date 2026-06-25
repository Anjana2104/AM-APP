/**
 * src/pages/UserSettings.tsx
 * User Settings page — column visibility preferences + notification snooze
 */

import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  Tabs, Card, Checkbox, Button, Space, Typography, Tag, Select,
  DatePicker, Table, Popconfirm, message, Divider, Row, Col,
  Tooltip, Badge, Alert, Empty,
} from 'antd';
import {
  ColumnHeightOutlined, BellOutlined, DeleteOutlined, PlusOutlined,
  SaveOutlined, UndoOutlined, ClockCircleOutlined, CheckCircleOutlined,
  DollarOutlined, FileTextOutlined, TeamOutlined, InboxOutlined, ApartmentOutlined,
} from '@ant-design/icons';
import {
  useUserPreferences,
  MODULE_COLUMN_CONFIGS,
  getDefaultColumnVisibility,
} from '../context/UserPreferencesContext';
import { getRelevantTriggers } from '../api/notificationTriggerApi';
import type { NotificationTrigger } from '../api/notificationTriggerApi';
import type { SnoozeRule } from '../api/userPreferencesApi';
import { useAuth } from '../context/AuthContext';
import dayjs from 'dayjs';

const { Text } = Typography;

const SMALL = { fontSize: 11 } as const;
const XSMALL = { fontSize: 10 } as const;

// ── Module metadata — maps module key → page IDs that gate visibility ────────

const MODULES: { key: string; label: string; icon: ReactNode; pageIds: string[] }[] = [
  { key: 'sow',       label: 'SOW Details',       icon: <DollarOutlined style={{ color: '#389e0d' }} />,     pageIds: ['executive_summary', 'executive_revenue'] },
  { key: 'invoice',   label: 'Invoicing Details',  icon: <FileTextOutlined style={{ color: '#1890ff' }} />,   pageIds: ['executive_invoicing'] },
  { key: 'resources', label: 'Resource Hub',        icon: <TeamOutlined style={{ color: '#722ed1' }} />,      pageIds: ['resources_info'] },
  { key: 'requests',  label: 'Requests',            icon: <InboxOutlined style={{ color: '#fa8c16' }} />,     pageIds: ['clientmgmt_requests'] },
  { key: 'process',   label: 'Internal Process',    icon: <ApartmentOutlined style={{ color: '#13c2c2' }} />, pageIds: ['clientmgmt_connects'] },
];

// ── Column Visibility Tab ──────────────────────────────────────────────────────

function ColumnVisibilitySettings() {
  const { getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const { hasPermission } = useAuth();
  const [pending, setPending] = useState<Record<string, Record<string, boolean>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  // Only show modules the user can view at least one of their pages
  const accessibleModules = MODULES.filter(m =>
    m.pageIds.some(pid => hasPermission(pid, 'view'))
  );

  useEffect(() => {
    const init: Record<string, Record<string, boolean>> = {};
    accessibleModules.forEach(m => { init[m.key] = { ...getColumnVisibility(m.key) }; });
    setPending(init);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (module: string, colKey: string, checked: boolean) => {
    setPending(prev => ({ ...prev, [module]: { ...prev[module], [colKey]: checked } }));
    setDirty(prev => new Set([...prev, module]));
  };

  const selectAll = (module: string, val: boolean) => {
    const newVis: Record<string, boolean> = {};
    MODULE_COLUMN_CONFIGS[module].forEach(c => { newVis[c.key] = val; });
    setPending(prev => ({ ...prev, [module]: newVis }));
    setDirty(prev => new Set([...prev, module]));
  };

  const resetModule = (module: string) => {
    setPending(prev => ({ ...prev, [module]: { ...getDefaultColumnVisibility(module) } }));
    setDirty(prev => new Set([...prev, module]));
  };

  const saveModule = (module: string) => {
    saveColumnVisibility(module, pending[module] || getDefaultColumnVisibility(module));
    setDirty(prev => { const next = new Set(prev); next.delete(module); return next; });
    message.success('Saved');
  };

  const saveAll = () => {
    dirty.forEach(m => saveColumnVisibility(m, pending[m] || getDefaultColumnVisibility(m)));
    setDirty(new Set());
    message.success('All column preferences saved');
  };

  if (accessibleModules.length === 0) {
    return (
      <Empty
        description={<Text type="secondary" style={SMALL}>No accessible modules — column visibility is managed by your role.</Text>}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      />
    );
  }

  return (
    <div style={{ height: '100%' }}>
      {dirty.size > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <Button type="primary" size="small" icon={<SaveOutlined />} onClick={saveAll} style={{ fontSize: 11 }}>
            Save All
          </Button>
        </div>
      )}
      <Row gutter={[12, 12]}>
        {accessibleModules.map(mod => {
          const cols = MODULE_COLUMN_CONFIGS[mod.key] || [];
          const vis = pending[mod.key] || getDefaultColumnVisibility(mod.key);
          const visibleCount = Object.values(vis).filter(Boolean).length;
          const isDirty = dirty.has(mod.key);

          return (
            <Col key={mod.key} xs={24} sm={12} xl={8}>
              <Card
                size="small"
                style={{
                  borderRadius: 8,
                  border: isDirty ? '1.5px solid #1677ff' : '1px solid #f0f0f0',
                  height: 320,
                  display: 'flex',
                  flexDirection: 'column',
                }}
                styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '8px 12px' } }}
                title={
                  <Space size={5}>
                    {mod.icon}
                    <Text strong style={{ fontSize: 11 }}>{mod.label}</Text>
                    <Badge
                      count={`${visibleCount}/${cols.length}`}
                      style={{ backgroundColor: visibleCount > 0 ? '#52c41a' : '#d9d9d9', fontSize: 9 }}
                    />
                    {isDirty && <Tag color="blue" style={XSMALL}>Unsaved</Tag>}
                  </Space>
                }
                extra={
                  <Space size={2}>
                    <Tooltip title="Reset to defaults" overlayInnerStyle={XSMALL}>
                      <Button size="small" type="text" icon={<UndoOutlined style={{ fontSize: 11 }} />} onClick={() => resetModule(mod.key)} />
                    </Tooltip>
                    <Button
                      size="small"
                      type={isDirty ? 'primary' : 'default'}
                      icon={<SaveOutlined style={{ fontSize: 11 }} />}
                      onClick={() => saveModule(mod.key)}
                      style={{ fontSize: 11, opacity: isDirty ? 1 : 0.5 }}
                    >
                      Save
                    </Button>
                  </Space>
                }
              >
                <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexShrink: 0 }}>
                  <Button size="small" style={{ fontSize: 10, padding: '0 8px', height: 20 }} onClick={() => selectAll(mod.key, true)}>All</Button>
                  <Button size="small" style={{ fontSize: 10, padding: '0 8px', height: 20 }} onClick={() => selectAll(mod.key, false)}>None</Button>
                </div>
                <Divider style={{ margin: '4px 0 6px' }} />
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {cols.map(col => (
                    <label
                      key={col.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}
                    >
                      <Checkbox
                        checked={vis[col.key] ?? col.defaultVisible}
                        onChange={e => toggle(mod.key, col.key, e.target.checked)}
                        style={{ fontSize: 11 }}
                      />
                      <Text style={SMALL}>{col.label}</Text>
                    </label>
                  ))}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

// â”€â”€ Notification Snooze Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const QUICK_SNOOZE_OPTIONS = [
  { label: '1 hour',  hours: 1 },
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '1 day',   hours: 24 },
  { label: '3 days',  hours: 72 },
  { label: '1 week',  hours: 168 },
];

function generateSnoozeId() {
  return `snz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function NotificationSnoozeSettings() {
  const { notificationSnooze, saveNotificationSnooze } = useUserPreferences();
  const { currentUser } = useAuth();
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(true);
  const [selectedTrigger, setSelectedTrigger] = useState<string>('__all__');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customUntil, setCustomUntil] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id) return;
    setLoadingTriggers(true);
    getRelevantTriggers(currentUser.id)
      .then(t => { setTriggers(t); setLoadingTriggers(false); })
      .catch(() => setLoadingTriggers(false));
  }, [currentUser?.id]);

  const activeSnooze = notificationSnooze.filter(r => new Date(r.until) > new Date());

  const addSnooze = () => {
    const until = selectedDuration ? addHours(selectedDuration) : customUntil;
    if (!until) { message.warning('Select a duration first'); return; }
    let triggerId: number | null = null;
    let triggerName = 'All Notifications';
    if (selectedTrigger !== '__all__') {
      triggerId = parseInt(selectedTrigger, 10);
      const found = triggers.find(t => t.id === triggerId);
      triggerName = found ? found.name : String(triggerId);
    }
    const newRule: SnoozeRule = { id: generateSnoozeId(), label: triggerName, triggerId, triggerName, until };
    saveNotificationSnooze([...activeSnooze, newRule]);
    message.success(`Snoozed until ${new Date(until).toLocaleString()}`);
    setSelectedDuration(null); setCustomUntil(null); setSelectedTrigger('__all__');
  };

  const removeSnooze = (id: string) => { saveNotificationSnooze(activeSnooze.filter(r => r.id !== id)); message.info('Snooze removed'); };
  const clearAll = () => { saveNotificationSnooze([]); message.success('All cleared'); };

  const columns = [
    {
      title: <Text style={XSMALL}>Trigger</Text>,
      dataIndex: 'triggerName',
      key: 'triggerName',
      render: (v: string, r: SnoozeRule) => (
        <Space size={4}>
          <BellOutlined style={{ color: r.triggerId === null ? '#ff4d4f' : '#1677ff', fontSize: 11 }} />
          <Text style={SMALL}>{r.triggerId === null ? 'All Notifications' : v}</Text>
          {r.triggerId === null && <Tag color="red" style={XSMALL}>ALL</Tag>}
        </Space>
      ),
    },
    {
      title: <Text style={XSMALL}>Snoozed Until</Text>,
      dataIndex: 'until',
      key: 'until',
      render: (v: string) => {
        const d = new Date(v);
        const expired = d <= new Date();
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: expired ? '#d9d9d9' : '#fa8c16', fontSize: 11 }} />
            <Text style={{ ...SMALL, color: expired ? '#d9d9d9' : undefined }}>{d.toLocaleString()}</Text>
            {expired && <Tag color="default" style={XSMALL}>Expired</Tag>}
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 48,
      render: (_: unknown, r: SnoozeRule) => (
        <Popconfirm title={<Text style={SMALL}>Remove this snooze?</Text>} onConfirm={() => removeSnooze(r.id)} okText="Remove" cancelText="Cancel">
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Row gutter={[12, 12]}>
      {/* Add snooze rule */}
      <Col xs={24} lg={10}>
        <Card
          size="small"
          title={<Space size={5}><PlusOutlined style={{ color: '#1677ff', fontSize: 11 }} /><Text strong style={SMALL}>Add Snooze Rule</Text></Space>}
          style={{ borderRadius: 8, height: 320, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px' } }}
        >
          <div>
            <Text type="secondary" style={XSMALL}>Trigger</Text>
            <Select
              size="small"
              value={selectedTrigger}
              onChange={setSelectedTrigger}
              style={{ width: '100%', marginTop: 4 }}
              loading={loadingTriggers}
              styles={{ option: { fontSize: 11 } }}
              options={[
                { value: '__all__', label: '🔕 All Notifications' },
                ...triggers.map(t => ({ value: String(t.id), label: t.name })),
              ]}
            />
          </div>
          <div>
            <Text type="secondary" style={XSMALL}>Quick duration</Text>
            <Select
              size="small"
              value={selectedDuration}
              onChange={v => { setSelectedDuration(v); setCustomUntil(null); }}
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Select…"
              allowClear
              styles={{ option: { fontSize: 11 } }}
              options={QUICK_SNOOZE_OPTIONS.map(o => ({ value: o.hours, label: o.label }))}
            />
          </div>
          <div>
            <Text type="secondary" style={XSMALL}>Or pick date/time</Text>
            <DatePicker
              size="small"
              showTime
              style={{ width: '100%', marginTop: 4 }}
              disabledDate={d => d && d.isBefore(dayjs())}
              onChange={v => { setCustomUntil(v ? v.toISOString() : null); setSelectedDuration(null); }}
              value={customUntil ? dayjs(customUntil) : null}
            />
          </div>
          <Button
            type="primary"
            size="small"
            icon={<BellOutlined />}
            onClick={addSnooze}
            style={{ fontSize: 11, marginTop: 'auto', opacity: (!selectedDuration && !customUntil) ? 0.5 : 1 }}
          >
            Apply Snooze
          </Button>
        </Card>
      </Col>

      {/* Active snooze rules */}
      <Col xs={24} lg={14}>
        <Card
          size="small"
          title={
            <Space size={5}>
              <BellOutlined style={{ color: '#fa8c16', fontSize: 11 }} />
              <Text strong style={SMALL}>Active Rules</Text>
              {activeSnooze.length > 0 && <Tag color="orange" style={XSMALL}>{activeSnooze.length}</Tag>}
            </Space>
          }
          extra={
            activeSnooze.length > 0 && (
              <Popconfirm title={<Text style={SMALL}>Clear all snooze rules?</Text>} onConfirm={clearAll} okText="Clear" cancelText="Cancel">
                <Button size="small" danger style={{ fontSize: 10 }}>Clear All</Button>
              </Popconfirm>
            )
          }
          style={{ borderRadius: 8, height: 320, display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, overflow: 'auto', padding: '8px 12px' } }}
        >
          {activeSnooze.length === 0 ? (
            <Alert
              type="success"
              icon={<CheckCircleOutlined />}
              showIcon
              message={<Text style={SMALL}>No active snooze rules — all notifications delivered.</Text>}
              style={{ borderRadius: 6 }}
            />
          ) : (
            <Table
              dataSource={activeSnooze}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={false}
              style={{ fontSize: 11 }}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}

// ── Main UserSettings page ────────────────────────────────────────────────

export function UserSettings() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#f5f7fa', padding: '16px 20px' }}>
      <Tabs
        defaultActiveKey="columns"
        size="small"
        tabBarStyle={{ fontSize: 11, marginBottom: 12 }}
        items={[
          {
            key: 'columns',
            label: <span style={{ fontSize: 11 }}><ColumnHeightOutlined /> Column Visibility</span>,
            children: <ColumnVisibilitySettings />,
          },
          {
            key: 'snooze',
            label: <span style={{ fontSize: 11 }}><BellOutlined /> Notification Snooze</span>,
            children: <NotificationSnoozeSettings />,
          },
        ]}
      />
    </div>
  );
}
