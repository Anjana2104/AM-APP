import { useEffect, useState } from 'react';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import * as authApi from '../../api/authApi';
import * as notifApi from '../../api/notificationApi';
import { setGroups as setGroupsAction, setUsers as setUsersAction } from '../../store/adminDirectorySlice';
import { useAppDispatch, useAppSelector } from '../../store/hooks';

interface CreateNotificationModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUserName: string;
}

export function CreateNotificationModal({
  open,
  onClose,
  onCreated,
  currentUserName,
}: CreateNotificationModalProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const dispatch = useAppDispatch();
  const users = useAppSelector((state) => state.adminDirectory.users);
  const groups = useAppSelector((state) => state.adminDirectory.groups);
  const usersLoaded = useAppSelector((state) => state.adminDirectory.usersLoaded);
  const groupsLoaded = useAppSelector((state) => state.adminDirectory.groupsLoaded);
  const [targetType, setTargetType] = useState<'user' | 'group' | 'broadcast'>('broadcast');

  useEffect(() => {
    if (open) {
      if (!usersLoaded) {
        authApi.getUsers().then((list) => dispatch(setUsersAction(list)));
      }
      if (!groupsLoaded) {
        notifApi.getUserGroups().then((list) => dispatch(setGroupsAction(list)));
      }
    }
  }, [dispatch, groupsLoaded, open, usersLoaded]);

  const handleSubmit = async (values: any) => {
    setSaving(true);
    const payload: any = {
      type: values.type || 'task',
      title: values.title,
      message: values.message || '',
      source_user: currentUserName,
      target_user_id: null,
      target_group_id: null,
    };
    if (targetType === 'user' && values.target_user_id) payload.target_user_id = values.target_user_id;
    if (targetType === 'group' && values.target_group_id) payload.target_group_id = values.target_group_id;
    const result = await notifApi.createNotification(payload);
    setSaving(false);
    if (result.ok) {
      message.success('Notification created');
      form.resetFields();
      onCreated();
      onClose();
    } else {
      message.error(result.error || 'Failed to create');
    }
  };

  return (
    <Modal
      title="Create Notification"
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
        <Form.Item name="type" label="Type" initialValue="task">
          <Select>
            <Select.Option value="task">Task</Select.Option>
            <Select.Option value="info">Info</Select.Option>
            <Select.Option value="alert">Alert</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="Notification title" />
        </Form.Item>
        <Form.Item name="message" label="Message">
          <Input.TextArea rows={3} placeholder="Optional message body" />
        </Form.Item>
        <Form.Item label="Target">
          <Select value={targetType} onChange={v => setTargetType(v as any)}>
            <Select.Option value="broadcast">All Users (Broadcast)</Select.Option>
            <Select.Option value="user">Specific User</Select.Option>
            <Select.Option value="group">User Group</Select.Option>
          </Select>
        </Form.Item>
        {targetType === 'user' && (
          <Form.Item name="target_user_id" label="User" rules={[{ required: true, message: 'Select a user' }]}>
            <Select showSearch placeholder="Select user" optionFilterProp="children">
              {users.map(u => (
                <Select.Option key={u.id} value={u.id}>{u.displayName || u.username}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}
        {targetType === 'group' && (
          <Form.Item name="target_group_id" label="Group" rules={[{ required: true, message: 'Select a group' }]}>
            <Select showSearch placeholder="Select group" optionFilterProp="children">
              {groups.map(g => (
                <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Send</Button>
        </div>
      </Form>
    </Modal>
  );
}
