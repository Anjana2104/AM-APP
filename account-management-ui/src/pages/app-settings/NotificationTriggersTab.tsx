import { HTMLAttributes, useCallback, useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
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
  HolderOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAuth } from '../../context/AuthContext';
import {
  NotificationTrigger,
  TriggerSource,
  createNotificationTrigger,
  deleteNotificationTrigger,
  getNotificationTriggers,
  getTriggerSources,
  reorderNotificationTriggers,
  toggleNotificationTrigger,
  updateNotificationTrigger,
} from '../../api/notificationTriggerApi';
import { UserGroup, getUserGroups } from '../../api/notificationApi';

const { Text } = Typography;

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

export function NotificationTriggersTab() {
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
  const isSpecialField = selectedFields.some((f) => SPECIAL_FIELD_VALUES.has(f));

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
    } catch {
      message.error('Failed to load triggers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = triggers.findIndex((t) => t.id === active.id);
    const newIndex = triggers.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(triggers, oldIndex, newIndex);
    setTriggers(reordered);
    await reorderNotificationTriggers(reordered.map((t) => t.id));
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
    });
    setModalOpen(true);
  };

  const openEdit = (t: NotificationTrigger) => {
    setEditingTrigger(t);
    form.setFieldsValue({
      name: t.name,
      source_table: t.source_table,
      trigger_field: t.trigger_field ? t.trigger_field.split(',').map((f) => f.trim()).filter(Boolean) : [],
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
      const sourceFields = triggerSources.find((s) => s.value === vals.source_table)?.fields || [];
      const triggerLabel = fields
        .map((f) => sourceFields.find((sf) => sf.value === f)?.label || f)
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
    } catch {
      // validation already handled by form
    }
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

  const sourceFields = triggerSources.find((s) => s.value === selectedSource)?.fields || [];
  const groupOptions = groups.map((g) => ({ label: g.name, value: String(g.id) }));

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
        const s = triggerSources.find((x) => x.value === v);
        return <Tag color="blue" style={{ fontSize: 9 }}>{s?.label || v}</Tag>;
      },
    },
    {
      title: 'Field',
      dataIndex: 'trigger_field',
      key: 'trigger_field',
      render: (v: string, row: NotificationTrigger) => {
        const fields = v ? v.split(',').map((f) => f.trim()).filter(Boolean) : [];
        const src = triggerSources.find((s) => s.value === row.source_table);
        return (
          <Space size={2} wrap>
            {fields.map((f) => {
              if (f === '__any__') return <Tag key={f} color="volcano" style={{ fontSize: 9 }}>★ Any field</Tag>;
              if (SPECIAL_FIELD_VALUES.has(f)) {
                const fi = src?.fields.find((item) => item.value === f);
                return <Tag key={f} color="geekblue" style={{ fontSize: 9 }}>{fi?.label || f}</Tag>;
              }
              const fi = src?.fields.find((item) => item.value === f);
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
          const grp = groups.find((g) => String(g.id) === String(row.notify_target_value));
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
        <SortableContext items={triggers.map((t) => t.id)} strategy={verticalListSortingStrategy}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
            <Form.Item name="name" label={<Text style={{ fontSize: 11 }}>Trigger Name</Text>} rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 10 }}>
              <Input placeholder="e.g. SOW Owner Assignment" />
            </Form.Item>
            <Form.Item name="is_active" label={<Text style={{ fontSize: 11 }}>Active</Text>} valuePropName="checked" style={{ marginBottom: 10 }}>
              <Switch size="small" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Form.Item name="source_table" label={<Text style={{ fontSize: 11 }}>Source</Text>} rules={[{ required: true }]} style={{ marginBottom: 10 }}>
              <Select
                options={triggerSources.map((s) => ({ label: s.label, value: s.value }))}
                onChange={() => form.setFieldValue('trigger_field', undefined)}
              />
            </Form.Item>
            <Form.Item name="notification_type" label={<Text style={{ fontSize: 11 }}>Notification Type</Text>} style={{ marginBottom: 10 }}>
              <Select options={NOTIFICATION_TYPES} />
            </Form.Item>
          </div>

          <Form.Item
            name="trigger_field"
            label={<Text style={{ fontSize: 11 }}>When these field(s) change</Text>}
            rules={[{ required: true, message: 'Select at least one field' }]}
            style={{ marginBottom: 10 }}
          >
            <Select
              mode="multiple"
              options={sourceFields.map((f) => ({ label: f.label, value: f.value }))}
              placeholder="Select one or more fields"
              disabled={sourceFields.length === 0}
              allowClear
              onChange={(vals: string[]) => {
                const hasSpecial = vals.some((v) => SPECIAL_FIELD_VALUES.has(v));
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

          <Form.Item noStyle shouldUpdate={(prev, curr) => prev.notify_target_type !== curr.notify_target_type}>
            {({ getFieldValue }) => {
              const targetType = getFieldValue('notify_target_type');
              return (
                <div style={{ display: 'grid', gridTemplateColumns: targetType === 'group' ? '1fr 1fr' : '1fr', gap: 10 }}>
                  <Form.Item name="notify_target_type" label={<Text style={{ fontSize: 11 }}>Notify Who?</Text>} rules={[{ required: true }]} style={{ marginBottom: 10 }}>
                    <Select
                      options={NOTIFY_TARGET_TYPES.filter((t) => {
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
                : 'The {field} of "{record_name}" changed from "{old_value}" to "{new_value}" by {changed_by}.'}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default NotificationTriggersTab;
