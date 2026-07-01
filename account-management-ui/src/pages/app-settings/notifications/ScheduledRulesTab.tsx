import { HTMLAttributes, useCallback, useEffect, useState } from 'react';
import {
  AutoComplete,
  Button,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FieldTimeOutlined,
  HolderOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
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
import { useAuth } from '../../../context/AuthContext';
import { getUserGroups, UserGroup } from '../../../api/notificationApi';
import {
  NotificationRule,
  RunResult,
  createNotificationRule,
  deleteNotificationRule,
  duplicateNotificationRule,
  getFieldValues,
  getNotificationRules,
  reorderNotificationRules,
  runRuleById,
  runRulesNow,
  toggleNotificationRule as toggleRule,
  updateNotificationRule,
} from '../../../api/notificationRulesApi';

const { Text } = Typography;

const SOURCE_TABLES = [
  { value: 'resources', label: 'Resources' },
  { value: 'client_requests', label: 'Client Requests' },
  { value: 'ra_process', label: 'Process / SOW' },
  { value: 'finance_projects', label: 'Finance Projects' },
];

const SOURCE_FIELDS: Record<string, { value: string; label: string; type: string }[]> = {
  resources: [
    { value: 'engagement_end_date', label: 'Engagement End Date', type: 'date' },
    { value: 'engagement_start_date', label: 'Engagement Start Date', type: 'date' },
    { value: 'doj', label: 'Date of Joining', type: 'date' },
    { value: 'allocation_percentage', label: 'Allocation %', type: 'number' },
    { value: 'allocation_status', label: 'Allocation Status', type: 'text' },
    { value: 'role_or_domain', label: 'Role / Domain', type: 'text' },
    { value: 'account_anchor', label: 'Account Anchor', type: 'text' },
  ],
  client_requests: [
    { value: 'date_raised', label: 'Date Raised', type: 'date' },
    { value: 'processing_status', label: 'Processing Status', type: 'text' },
    { value: 'overall_status', label: 'Overall Status', type: 'text' },
    { value: 'account_anchor', label: 'Owner', type: 'text' },
  ],
  ra_process: [
    { value: 'start_date', label: 'Start Date', type: 'date' },
    { value: 'active', label: 'Active Status', type: 'text' },
    { value: 'account_anchor', label: 'Owner', type: 'text' },
  ],
  finance_projects: [
    { value: 'status', label: 'Status', type: 'text' },
  ],
};

const CONDITION_TYPES = [
  { value: 'date_overdue', label: 'Date Overdue / Approaching' },
  { value: 'field_threshold', label: 'Field Below / Above Threshold' },
  { value: 'field_equals', label: 'Field Value Check' },
];

const SCHEDULE_TYPES = [
  { value: 'daily', label: 'Daily (once per day)' },
  { value: 'monthly', label: 'Monthly (on specific day)' },
  { value: 'weekly', label: 'Weekly (every Monday)' },
];

const NUM_OPS = ['<', '>', '<=', '>=', '='];
const TEXT_OPS = [
  { value: 'eq', label: '= equals' },
  { value: 'neq', label: '≠ not equals' },
  { value: 'contains', label: '∋ contains' },
];

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

export function ScheduledRulesTab() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('configuration', 'edit');
  const canDelete = hasPermission('configuration', 'delete');

  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [rowRunningId, setRowRunningId] = useState<number | null>(null);
  const [fieldSuggestions, setFieldSuggestions] = useState<string[]>([]);
  const [form] = Form.useForm();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const srcTable = Form.useWatch('source_table', form);
  const condType = Form.useWatch('condition_type', form);
  const schedType = Form.useWatch('schedule_type', form);
  const targetType = Form.useWatch('notify_target_type', form);
  const equalsField = Form.useWatch('threshold_field', form);

  const tableFields = srcTable ? (SOURCE_FIELDS[srcTable] || []) : [];
  const dateFields = tableFields.filter((f) => f.type === 'date');
  const numFields = tableFields.filter((f) => f.type === 'number');
  const allFields = tableFields;

  useEffect(() => {
    if (condType === 'field_equals' && srcTable && equalsField) {
      getFieldValues(srcTable, equalsField).then((vals) => setFieldSuggestions(vals)).catch(() => setFieldSuggestions([]));
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
    } catch {
      message.error('Failed to load scheduled rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({ schedule_type: 'daily', notification_type: 'alert', notify_target_type: 'group', condition_type: 'date_overdue', lead_time_days: 0 });
    setModalOpen(true);
  };

  const openEdit = (r: NotificationRule) => {
    setEditingRule(r);
    form.setFieldsValue({ ...r, threshold_value: r.threshold_value ?? undefined, schedule_day: r.schedule_day ?? undefined });
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
    } catch {
      message.error('Delete failed');
    }
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
      if (result.fired > 0) message.success(`Rule engine ran — ${result.fired} notification(s) fired`);
      else message.info('Rule engine ran — 0 notifications fired (check diagnostics below)');
      load();
    } catch {
      message.error('Run failed');
    } finally {
      setRunning(false);
    }
  };

  const handleRunRow = async (r: NotificationRule) => {
    setRowRunningId(r.id);
    try {
      const result = await runRuleById(r.id);
      const d = result.diagnostics[0];
      if (result.fired > 0) message.success(`"${r.name}" fired ${result.fired} notification(s)`);
      else {
        const detail = d?.matchDebug || d?.note || d?.skipped || d?.error || 'No matching records';
        message.info(`"${r.name}": 0 fired — ${detail}`);
      }
      load();
    } catch {
      message.error('Run failed');
    } finally {
      setRowRunningId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rules.findIndex((r) => r.id === active.id);
    const newIndex = rules.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(rules, oldIndex, newIndex);
    setRules(reordered);
    await reorderNotificationRules(reordered.map((r) => r.id));
  };

  const handleDuplicate = async (r: NotificationRule) => {
    try {
      await duplicateNotificationRule(r.id);
      message.success(`Duplicated "${r.name}" — edit to activate`);
      load();
    } catch {
      message.error('Duplicate failed');
    }
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
    if (r.condition_type === 'field_equals') return `${r.threshold_field} ${r.threshold_operator} "${r.filter_value}"`;
    return '—';
  };

  const scheduleSummary = (r: NotificationRule) => {
    if (r.schedule_type === 'monthly') return `Monthly (day ${r.schedule_day ?? 15})`;
    if (r.schedule_type === 'weekly') return 'Weekly (Mon)';
    return 'Daily';
  };

  const columns = [
    ...(canEdit ? [{
      title: '',
      key: 'drag',
      width: 28,
      render: () => <HolderOutlined style={{ cursor: 'grab', color: '#bbb', fontSize: 13 }} />,
    }] : []),
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: string) => <Text style={{ fontSize: 11, fontWeight: 600 }}>{v}</Text> },
    { title: 'Source', dataIndex: 'source_table', key: 'src', width: 120, render: (v: string) => <Tag color="blue" style={{ fontSize: 9 }}>{SOURCE_TABLES.find((s) => s.value === v)?.label ?? v}</Tag> },
    { title: 'Condition', key: 'cond', width: 200, render: (_: unknown, r: NotificationRule) => <Text style={{ fontSize: 11 }}>{conditionSummary(r)}</Text> },
    { title: 'Schedule', key: 'sch', width: 120, render: (_: unknown, r: NotificationRule) => <Space size={4}><FieldTimeOutlined style={{ fontSize: 11, color: '#1677ff' }} /><Text style={{ fontSize: 11 }}>{scheduleSummary(r)}</Text></Space> },
    { title: 'Last Run', dataIndex: 'last_run_at', key: 'last', width: 100, render: (v: string | null) => <Text style={{ fontSize: 10, color: '#8c8c8c' }}>{v ? new Date(v).toLocaleDateString() : 'Never'}</Text> },
    { title: 'Active', key: 'active', width: 60, render: (_: unknown, r: NotificationRule) => <Switch size="small" checked={r.is_active === 1} onChange={() => canEdit && handleToggle(r.id)} disabled={!canEdit} /> },
    {
      title: '', key: 'actions', width: 110,
      render: (_: unknown, r: NotificationRule) => (
        <Space size={2}>
          {canEdit && (
            <Tooltip title={r.is_active ? 'Run now' : 'Inactive — enable to run'}>
              <Button type="text" size="small" icon={<PlayCircleOutlined style={{ fontSize: 12, color: r.is_active ? '#1677ff' : '#d9d9d9' }} />} loading={rowRunningId === r.id} disabled={!r.is_active} onClick={() => handleRunRow(r)} />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Duplicate">
              <Button type="text" size="small" icon={<CopyOutlined style={{ fontSize: 12, color: '#8c8c8c' }} />} onClick={() => handleDuplicate(r)} />
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
      ),
    },
  ];

  return (
    <div style={{ padding: '12px 4px 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <Space size={6}>
          <Text style={{ fontSize: 11, color: '#595959' }}>
            Rules are evaluated hourly. Each rule fires at most once per schedule period per record.
          </Text>
        </Space>
        <Space size={6}>
          {canEdit && (
            <Button size="small" icon={<PlayCircleOutlined />} loading={running} onClick={handleRunNow} style={{ fontSize: 11 }}>
              Run Now
            </Button>
          )}
          {canEdit && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate} style={{ fontSize: 11 }}>
              New Rule
            </Button>
          )}
        </Space>
      </div>

      {runResult && (
        <div style={{ marginBottom: 10, borderRadius: 4, background: '#fafafa', border: '1px solid #f0f0f0', padding: '8px 12px' }}>
          <Text strong style={{ fontSize: 11 }}>Last Run: {runResult.fired} notification(s) fired</Text>
          {runResult.diagnostics.map((d, i) => (
            <div key={i} style={{ fontSize: 10, color: '#595959', marginTop: 2 }}>
              <Text style={{ fontSize: 10 }} strong>{d.name}: </Text>
              {d.skipped && <Text style={{ fontSize: 10, color: '#faad14' }}>⚠ {d.skipped}</Text>}
              {d.error && <Text style={{ fontSize: 10, color: '#ff4d4f' }}>✗ {d.error}</Text>}
              {d.note && <Text style={{ fontSize: 10, color: '#1890ff' }}>ℹ {d.note}</Text>}
              {d.matchDebug && <Text style={{ fontSize: 10 }}>{d.matchDebug}</Text>}
              {d.fired > 0 && <Text style={{ fontSize: 10, color: '#52c41a' }}> — {d.fired} fired</Text>}
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && !loading ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text style={{ fontSize: 11 }}>No scheduled rules configured yet. Click "+ New Rule" to create one.</Text>} />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
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
                    return canEdit ? <SortableRuleRow id={id} {...props}>{children}</SortableRuleRow> : <tr {...props}>{children}</tr>;
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
          <Row gutter={10}>
            <Col span={15}>
              <Form.Item name="name" label={<Text style={{ fontSize: 11 }}>Rule Name</Text>} rules={[{ required: true, message: 'Name required' }]} style={{ marginBottom: 8 }}>
                <Input style={{ fontSize: 11 }} placeholder="e.g. Resources with upcoming end dates" />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="source_table" label={<Text style={{ fontSize: 11 }}>Source Table</Text>} rules={[{ required: true, message: 'Select source' }]} style={{ marginBottom: 8 }}>
                <Select style={{ fontSize: 11 }} options={SOURCE_TABLES} onChange={() => { form.resetFields(['date_field', 'threshold_field', 'filter_field', 'filter_value']); setFieldSuggestions([]); }} placeholder="Select table" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="condition_type" label={<Text style={{ fontSize: 11 }}>Condition Type</Text>} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <Radio.Group size="small" style={{ fontSize: 11 }}>
              {CONDITION_TYPES.map((c) => (
                <Radio.Button key={c.value} value={c.value} style={{ fontSize: 11 }}>{c.label}</Radio.Button>
              ))}
            </Radio.Group>
          </Form.Item>

          {condType === 'date_overdue' && (
            <Row gutter={10}>
              <Col span={15}>
                <Form.Item name="date_field" label={<Text style={{ fontSize: 11 }}>Date Field</Text>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={dateFields.map((f) => ({ value: f.value, label: f.label }))} placeholder="Select date field" />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item
                  name="lead_time_days"
                  label={
                    <Tooltip title={<span style={{ fontSize: 11 }}>Minimum days the date must be <strong>overdue</strong> before alerting.<br /><br /><strong>Lead = 0:</strong> fire as soon as date ≤ today (any past date).<br /><strong>Lead = 7:</strong> fire only if date was ≥ 7 days ago (overdue by 7+ days).<br /><br />Use higher values to suppress alerts for recently-missed dates.</span>}>
                      <Text style={{ fontSize: 11 }}>Lead Time (days) <span style={{ color: '#1677ff', fontSize: 10 }}>ⓘ</span></Text>
                    </Tooltip>
                  }
                  style={{ marginBottom: 8 }}
                >
                  <InputNumber min={0} max={365} style={{ width: '100%', fontSize: 11 }} placeholder="0 = alert on/after date" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {condType === 'field_threshold' && (
            <Row gutter={10}>
              <Col span={9}>
                <Form.Item name="threshold_field" label={<Text style={{ fontSize: 11 }}>Field</Text>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={numFields.map((f) => ({ value: f.value, label: f.label }))} placeholder={numFields.length === 0 ? 'No numeric fields for this source' : 'Numeric field'} disabled={numFields.length === 0} />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="threshold_operator" label={<Text style={{ fontSize: 11 }}>Operator</Text>} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={NUM_OPS.map((op) => ({ value: op, label: op }))} />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item name="threshold_value" label={<Tooltip title="Or leave blank and set Config Key to use a value from App Values"><Text style={{ fontSize: 11 }}>Value</Text></Tooltip>} style={{ marginBottom: 8 }}>
                  <InputNumber style={{ width: '100%', fontSize: 11 }} placeholder="e.g. 50" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {condType === 'field_equals' && (
            <Row gutter={10}>
              <Col span={9}>
                <Form.Item name="threshold_field" label={<Text style={{ fontSize: 11 }}>Field</Text>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={allFields.map((f) => ({ value: f.value, label: f.label }))} onChange={() => { form.resetFields(['filter_value']); }} placeholder="Select field" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="threshold_operator" label={<Text style={{ fontSize: 11 }}>Operator</Text>} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={TEXT_OPS.map((op) => ({ value: op.value, label: op.label }))} />
                </Form.Item>
              </Col>
              <Col span={9}>
                <Form.Item name="filter_value" label={<Text style={{ fontSize: 11 }}>Value</Text>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <AutoComplete
                    style={{ fontSize: 11, width: '100%' }}
                    options={fieldSuggestions.map((v) => ({ value: v, label: v }))}
                    placeholder="e.g. Completed"
                    filterOption={(input, opt) => String(opt?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                    allowClear
                  />
                </Form.Item>
              </Col>
            </Row>
          )}

          {(condType === 'date_overdue' || condType === 'field_threshold') && (
            <Row gutter={10}>
              <Col span={8}>
                <Form.Item name="filter_field" label={<Text style={{ fontSize: 11 }}>AND — Filter Field (optional)</Text>} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} allowClear options={allFields.map((f) => ({ value: f.value, label: f.label }))} placeholder="Optional" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="filter_operator" label={<Text style={{ fontSize: 11 }}>Operator</Text>} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} allowClear options={TEXT_OPS.map((op) => ({ value: op.value, label: op.label }))} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="filter_value" label={<Text style={{ fontSize: 11 }}>Value</Text>} style={{ marginBottom: 8 }}>
                  <Input style={{ fontSize: 11 }} placeholder="e.g. Active" />
                </Form.Item>
              </Col>
            </Row>
          )}

          {condType === 'field_threshold' && (
            <Form.Item name="config_value_key" label={<Tooltip title="If set, threshold is read from App Values using this key (overrides Value above)"><Text style={{ fontSize: 11 }}>App Values Key (optional)</Text></Tooltip>} style={{ marginBottom: 8 }}>
              <Input style={{ fontSize: 11 }} placeholder="e.g. bench_allocation_threshold" />
            </Form.Item>
          )}

          <Row gutter={10}>
            <Col span={schedType === 'monthly' ? 14 : 24}>
              <Form.Item name="schedule_type" label={<Text style={{ fontSize: 11 }}>Schedule</Text>} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select size="small" style={{ fontSize: 11 }} options={SCHEDULE_TYPES.map((s) => ({ value: s.value, label: s.label }))} />
              </Form.Item>
            </Col>
            {schedType === 'monthly' && (
              <Col span={10}>
                <Form.Item name="schedule_day" label={<Text style={{ fontSize: 11 }}>Day of Month</Text>} rules={[{ required: true, message: 'Enter day (1–28)' }]} style={{ marginBottom: 8 }}>
                  <InputNumber min={1} max={28} style={{ width: '100%', fontSize: 11 }} placeholder="e.g. 15" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Row gutter={10}>
            <Col span={8}>
              <Form.Item name="notification_type" label={<Text style={{ fontSize: 11 }}>Notification Type</Text>} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select size="small" style={{ fontSize: 11 }} options={[{ value: 'alert', label: '🔴 Alert' }, { value: 'task', label: '✅ Task' }, { value: 'info', label: 'ℹ️ Info' }]} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="notify_target_type" label={<Text style={{ fontSize: 11 }}>Notify</Text>} rules={[{ required: true }]} style={{ marginBottom: 8 }}>
                <Select size="small" style={{ fontSize: 11 }} options={[{ value: 'group', label: 'User Group' }, { value: 'field_value', label: 'Owner (field value)' }, { value: 'broadcast', label: 'Everyone' }]} />
              </Form.Item>
            </Col>
            {targetType === 'group' && (
              <Col span={8}>
                <Form.Item name="notify_target_value" label={<Text style={{ fontSize: 11 }}>Group</Text>} rules={[{ required: true, message: 'Select group' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={groups.map((g) => ({ value: String(g.id), label: g.name }))} placeholder="Select group" />
                </Form.Item>
              </Col>
            )}
            {targetType === 'field_value' && (
              <Col span={8}>
                <Form.Item name="notify_target_value" label={<Tooltip title="Field whose value is the recipient's username (e.g. account_anchor)"><Text style={{ fontSize: 11 }}>Owner Field</Text></Tooltip>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 8 }}>
                  <Select size="small" style={{ fontSize: 11 }} options={allFields.map((f) => ({ value: f.value, label: f.label }))} placeholder="e.g. account_anchor" />
                </Form.Item>
              </Col>
            )}
          </Row>

          <Form.Item name="message_template" label={<Text style={{ fontSize: 11 }}>Message Template</Text>} style={{ marginBottom: 4 }}>
            <Input.TextArea rows={2} style={{ fontSize: 11 }} placeholder="e.g. {record_name} — {engagement_end_date} is approaching. Please review." />
          </Form.Item>
          <div style={{ marginBottom: 10 }}>
            <Text style={{ fontSize: 10, color: '#8c8c8c' }}>Available variables (click to copy):</Text>
            <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {[
                '{record_name}',
                ...(srcTable ? (SOURCE_FIELDS[srcTable] || []).map((f) => `{${f.value}}`) : []),
              ].map((v) => (
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

          <Form.Item
            name="is_active"
            label={<Text style={{ fontSize: 11 }}>Active</Text>}
            valuePropName="checked"
            getValueFromEvent={(v: boolean) => v ? 1 : 0}
            getValueProps={(v) => ({ checked: v === 1 })}
            style={{ marginBottom: 0 }}
          >
            <Switch size="small" defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
