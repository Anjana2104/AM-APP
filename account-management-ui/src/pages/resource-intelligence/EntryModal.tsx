import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Row, Col, Button, Space } from 'antd';
import type { InsightEntry } from '../../api/resourceInsightsApi';
import { SECTION_META, type SectionKey } from './resourceIntelligenceTypes';

const { Option } = Select;
const { TextArea } = Input;

export interface EntryModalProps {
  open: boolean;
  section: SectionKey;
  editing: InsightEntry | null;
  defaultAuthor: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
}

export function EntryModal({ open, section, editing, defaultAuthor, onClose, onSave }: EntryModalProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const meta = SECTION_META[section];

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          title: editing.title,
          body: editing.body,
          tag: editing.tag,
          status: editing.status,
          priority: editing.priority,
          targetDate: editing.target_date || '',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: 'open', priority: 'medium' });
      }
    }
  }, [open, editing, form]);

  const handleFinish = async (values: Record<string, string>) => {
    setSaving(true);
    await onSave(values);
    setSaving(false);
  };

  const showPriority = section === 'escalation' || section === 'plan';
  const showStatus = section !== 'interaction';
  const showTargetDate = section === 'escalation' || section === 'plan';

  const statusOptions = section === 'career_preference'
    ? ['active', 'achieved', 'pending']
    : ['open', 'resolved', 'closed', 'active', 'completed', 'pending'];

  return (
    <Modal
      title={
        <Space>
          <span style={{ color: meta.color }}>{meta.icon}</span>
          {editing ? `Edit ${meta.label} Entry` : `Add ${meta.label} Entry`}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 12 }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: 'Title is required' }]}>
          <Input placeholder="Brief title or subject" />
        </Form.Item>

        <Form.Item name="body" label="Details / Notes" rules={[{ required: true, whitespace: true, message: 'Please enter details or notes' }]}>
          <TextArea rows={3} placeholder="Additional details, context, or notes..." />
        </Form.Item>

        <Row gutter={12}>
          <Col span={showPriority ? 12 : 24}>
            <Form.Item name="tag" label="Tag">
              <Select placeholder="Select tag" allowClear>
                {meta.tags.map(t => <Option key={t} value={t}>{t}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          {showPriority && (
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select>
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="critical">Critical</Option>
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={12}>
          {showStatus && (
            <Col span={showTargetDate ? 12 : 24}>
              <Form.Item name="status" label="Status">
                <Select>
                  {statusOptions.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          )}
          {showTargetDate && (
            <Col span={showStatus ? 12 : 24}>
              <Form.Item name="targetDate" label="Target Date">
                <Input type="date" />
              </Form.Item>
            </Col>
          )}
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving} style={{ color: '#fff', fontWeight: 600 }}>
            {editing ? 'Save Changes' : 'Add Entry'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
