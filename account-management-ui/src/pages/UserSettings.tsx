/**
 * src/pages/UserSettings.tsx
 * User Settings page — column visibility preferences + notification snooze
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Tabs, Card, Checkbox, Button, Space, Typography, Tag, Select,
  DatePicker, Table, Popconfirm, message, Switch, Divider, Row, Col,
  Tooltip, Badge, Alert,
} from 'antd';
import {
  ColumnHeightOutlined, BellOutlined, DeleteOutlined, PlusOutlined,
  SettingOutlined, SaveOutlined, UndoOutlined, ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import {
  useUserPreferences,
  MODULE_COLUMN_CONFIGS,
  getDefaultColumnVisibility,
} from '../context/UserPreferencesContext';
import { getNotificationTriggers } from '../api/notificationTriggerApi';
import type { NotificationTrigger } from '../api/notificationTriggerApi';
import type { SnoozeRule } from '../api/userPreferencesApi';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ── Module metadata ──────────────────────────────────────────────────────────

const MODULES: { key: string; label: string; icon: string }[] = [
  { key: 'sow',      label: 'SOW / Finance',        icon: '💰' },
  { key: 'invoice',  label: 'Invoice',               icon: '🧾' },
  { key: 'resources',label: 'Resource Information',  icon: '👥' },
  { key: 'requests', label: 'Client Requests',       icon: '📋' },
  { key: 'process',  label: 'Internal Process',      icon: '⚙️' },
];

// ── Column Visibility Tab ────────────────────────────────────────────────────

function ColumnVisibilitySettings() {
  const { getColumnVisibility, saveColumnVisibility } = useUserPreferences();

  // Per-module pending state (before saving)
  const [pending, setPending] = useState<Record<string, Record<string, boolean>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());

  // Init pending from saved preferences
  useEffect(() => {
    const init: Record<string, Record<string, boolean>> = {};
    MODULES.forEach(m => { init[m.key] = { ...getColumnVisibility(m.key) }; });
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
    const defaults = getDefaultColumnVisibility(module);
    setPending(prev => ({ ...prev, [module]: { ...defaults } }));
    setDirty(prev => new Set([...prev, module]));
  };

  const saveModule = (module: string) => {
    saveColumnVisibility(module, pending[module] || getDefaultColumnVisibility(module));
    setDirty(prev => { const next = new Set(prev); next.delete(module); return next; });
    message.success('Column preferences saved');
  };

  const saveAll = () => {
    dirty.forEach(module => {
      saveColumnVisibility(module, pending[module] || getDefaultColumnVisibility(module));
    });
    setDirty(new Set());
    message.success('All column preferences saved');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Choose which columns are visible by default in each table. Your selection is saved per-user and persists across sessions.
        </Text>
        {dirty.size > 0 && (
          <Button type="primary" icon={<SaveOutlined />} onClick={saveAll} style={{ color: '#fff', fontWeight: 600 }}>
            Save All Changes
          </Button>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {MODULES.map(mod => {
          const cols = MODULE_COLUMN_CONFIGS[mod.key] || [];
          const vis = pending[mod.key] || getDefaultColumnVisibility(mod.key);
          const visibleCount = Object.values(vis).filter(Boolean).length;
          const isDirty = dirty.has(mod.key);

          return (
            <Col key={mod.key} xs={24} sm={12} xl={8}>
              <Card
                size="small"
                style={{ height: '100%', border: isDirty ? '1.5px solid #1677ff' : '1px solid #f0f0f0' }}
                title={
                  <Space size={6}>
                    <span>{mod.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{mod.label}</span>
                    <Badge
                      count={`${visibleCount}/${cols.length}`}
                      style={{ backgroundColor: visibleCount > 0 ? '#52c41a' : '#d9d9d9', fontSize: 10 }}
                    />
                    {isDirty && <Tag color="blue" style={{ fontSize: 10, margin: 0 }}>Modified</Tag>}
                  </Space>
                }
                extra={
                  <Space size={4}>
                    <Tooltip title="Reset to defaults">
                      <Button size="small" type="text" icon={<UndoOutlined />} onClick={() => resetModule(mod.key)} />
                    </Tooltip>
                    <Button
                      size="small"
                      type="primary"
                      icon={<SaveOutlined />}
                      onClick={() => saveModule(mod.key)}
                      style={{ color: '#fff', fontWeight: 600, opacity: isDirty ? 1 : 0.6 }}
                    >
                      Save
                    </Button>
                  </Space>
                }
              >
                <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
                  <Button size="small" onClick={() => selectAll(mod.key, true)}>All</Button>
                  <Button size="small" onClick={() => selectAll(mod.key, false)}>None</Button>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <Space direction="vertical" style={{ width: '100%' }} size={4}>
                  {cols.map(col => (
                    <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Checkbox
                        checked={vis[col.key] ?? col.defaultVisible}
                        onChange={e => toggle(mod.key, col.key, e.target.checked)}
                      />
                      <Text style={{ fontSize: 13 }}>{col.label}</Text>
                    </div>
                  ))}
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

// ── Notification Snooze Tab ──────────────────────────────────────────────────

const QUICK_SNOOZE_OPTIONS = [
  { label: '1 hour',   hours: 1 },
  { label: '4 hours',  hours: 4 },
  { label: '8 hours',  hours: 8 },
  { label: '1 day',    hours: 24 },
  { label: '3 days',   hours: 72 },
  { label: '1 week',   hours: 168 },
];

function generateSnoozeId() {
  return `snz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function NotificationSnoozeSettings() {
  const { notificationSnooze, saveNotificationSnooze } = useUserPreferences();
  const [triggers, setTriggers] = useState<NotificationTrigger[]>([]);
  const [loadingTriggers, setLoadingTriggers] = useState(true);

  // Add snooze form state
  const [selectedTrigger, setSelectedTrigger] = useState<string>('__all__');
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [customUntil, setCustomUntil] = useState<string | null>(null);

  useEffect(() => {
    setLoadingTriggers(true);
    getNotificationTriggers().then(t => {
      setTriggers(t);
      setLoadingTriggers(false);
    }).catch(() => setLoadingTriggers(false));
  }, []);

  // Remove expired snooze rules automatically
  const activeSnooze = notificationSnooze.filter(r => new Date(r.until) > new Date());

  const addSnooze = () => {
    const until = selectedDuration ? addHours(selectedDuration) : customUntil;
    if (!until) { message.warning('Please select a duration'); return; }

    let triggerId: number | null = null;
    let triggerName = 'All Notifications';
    if (selectedTrigger !== '__all__') {
      triggerId = parseInt(selectedTrigger, 10);
      const found = triggers.find(t => t.id === triggerId);
      triggerName = found ? found.name : String(triggerId);
    }

    const newRule: SnoozeRule = {
      id: generateSnoozeId(),
      label: triggerId === null ? 'All Notifications' : triggerName,
      triggerId,
      triggerName,
      until,
    };

    saveNotificationSnooze([...activeSnooze, newRule]);
    message.success(`Notifications snoozed until ${new Date(until).toLocaleString()}`);
    setSelectedDuration(null);
    setCustomUntil(null);
    setSelectedTrigger('__all__');
  };

  const removeSnooze = (id: string) => {
    saveNotificationSnooze(activeSnooze.filter(r => r.id !== id));
    message.info('Snooze removed');
  };

  const clearAll = () => {
    saveNotificationSnooze([]);
    message.success('All snooze rules cleared');
  };

  const columns = [
    {
      title: 'Trigger',
      dataIndex: 'triggerName',
      key: 'triggerName',
      render: (v: string, r: SnoozeRule) => (
        <Space size={4}>
          <BellOutlined style={{ color: r.triggerId === null ? '#ff4d4f' : '#1677ff' }} />
          <Text style={{ fontSize: 13 }}>{r.triggerId === null ? 'All Notifications' : v}</Text>
          {r.triggerId === null && <Tag color="red" style={{ fontSize: 10, margin: 0 }}>ALL</Tag>}
        </Space>
      ),
    },
    {
      title: 'Snoozed Until',
      dataIndex: 'until',
      key: 'until',
      render: (v: string) => {
        const d = new Date(v);
        const expired = d <= new Date();
        return (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: expired ? '#d9d9d9' : '#fa8c16' }} />
            <Text style={{ fontSize: 13, color: expired ? '#d9d9d9' : undefined }}>
              {d.toLocaleString()}
            </Text>
            {expired && <Tag color="default" style={{ fontSize: 10, margin: 0 }}>Expired</Tag>}
          </Space>
        );
      },
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_: unknown, r: SnoozeRule) => (
        <Popconfirm title="Remove this snooze rule?" onConfirm={() => removeSnooze(r.id)} okText="Remove" cancelText="Cancel">
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 16 }}>
        Temporarily pause notifications for a specific trigger or all triggers.
        Snoozed notifications are still created in the database — they are simply hidden in the notification panel until the snooze expires.
      </Text>

      {/* Add new snooze */}
      <Card
        size="small"
        title={<Space><PlusOutlined style={{ color: '#1677ff' }} /><span>Add Snooze Rule</span></Space>}
        style={{ marginBottom: 16 }}
      >
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Trigger to snooze</div>
            <Select
              value={selectedTrigger}
              onChange={setSelectedTrigger}
              style={{ width: '100%' }}
              loading={loadingTriggers}
              options={[
                { value: '__all__', label: '🔕 All Notifications' },
                ...triggers.map(t => ({ value: String(t.id), label: t.name })),
              ]}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Quick duration</div>
            <Select
              value={selectedDuration}
              onChange={v => { setSelectedDuration(v); setCustomUntil(null); }}
              style={{ width: '100%' }}
              placeholder="Select duration…"
              allowClear
              options={QUICK_SNOOZE_OPTIONS.map(o => ({ value: o.hours, label: o.label }))}
            />
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Or until specific date/time</div>
            <DatePicker
              showTime
              style={{ width: '100%' }}
              disabledDate={d => d && d.isBefore(dayjs())}
              onChange={v => { setCustomUntil(v ? v.toISOString() : null); setSelectedDuration(null); }}
              value={customUntil ? dayjs(customUntil) : null}
            />
          </Col>
        </Row>
        <div style={{ marginTop: 12 }}>
          <Button
            type="primary"
            icon={<BellOutlined />}
            onClick={addSnooze}
            style={{ color: '#fff', fontWeight: 600, opacity: (!selectedDuration && !customUntil) ? 0.6 : 1 }}
          >
            Snooze
          </Button>
        </div>
      </Card>

      {/* Active snooze rules */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong style={{ fontSize: 13 }}>Active Snooze Rules</Text>
        {activeSnooze.length > 0 && (
          <Popconfirm title="Clear all snooze rules?" onConfirm={clearAll} okText="Clear All" cancelText="Cancel">
            <Button size="small" danger>Clear All</Button>
          </Popconfirm>
        )}
      </div>

      {activeSnooze.length === 0 ? (
        <Alert
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          message="No active snooze rules — all notifications are being delivered."
        />
      ) : (
        <Table
          dataSource={activeSnooze}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
        />
      )}
    </div>
  );
}

// ── Main UserSettings page ───────────────────────────────────────────────────

export function UserSettings() {
  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <SettingOutlined style={{ fontSize: 20, color: '#1677ff' }} />
        <Title level={4} style={{ margin: 0 }}>User Settings</Title>
        <Text type="secondary" style={{ fontSize: 12, marginLeft: 4 }}>
          Personal preferences — changes apply only to your account
        </Text>
      </div>

      <Tabs
        defaultActiveKey="columns"
        type="card"
        items={[
          {
            key: 'columns',
            label: (
              <Space size={6}>
                <ColumnHeightOutlined />
                Column Visibility
              </Space>
            ),
            children: <ColumnVisibilitySettings />,
          },
          {
            key: 'snooze',
            label: (
              <Space size={6}>
                <BellOutlined />
                Notification Snooze
              </Space>
            ),
            children: <NotificationSnoozeSettings />,
          },
        ]}
      />
    </div>
  );
}
