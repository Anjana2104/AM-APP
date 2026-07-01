import React from 'react';
import { Form, Input, Modal, Select, Space } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { PlusOutlined } from '@ant-design/icons';
import { deriveCode } from './invoiceUtils';

export interface InvoiceAddModalProps {
  open: boolean;
  form: FormInstance;
  companyOptions: Array<{ label: string; value: string }>;
  onCancel: () => void;
  onSave: () => void;
}

export function InvoiceAddModal({
  open,
  form,
  companyOptions,
  onCancel,
  onSave,
}: InvoiceAddModalProps) {
  return (
    <Modal
      title={<Space><PlusOutlined style={{ color: '#52c41a' }} /><span style={{ fontSize: '13px' }}>Add New Project</span></Space>}
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      okText="Add Project"
      width={480}
      okButtonProps={{ size: 'small' }}
      cancelButtonProps={{ size: 'small' }}
    >
      <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
        <Form.Item name="project" label={<span style={{ fontSize: '11px' }}>Project Name</span>} rules={[{ required: true, message: 'Project name is required' }]}>
          <Input style={{ fontSize: '12px' }} placeholder="e.g. Account Management Platform" />
        </Form.Item>
        <Form.Item name="company" label={<span style={{ fontSize: '11px' }}>Company</span>}>
          <Select
            showSearch
            allowClear
            placeholder={companyOptions.length ? 'Select or type…' : 'Type company name'}
            options={companyOptions}
            style={{ fontSize: '12px' }}
            size="small"
            notFoundContent={companyOptions.length ? 'No options — add in Configuration' : null}
          />
        </Form.Item>
        <Form.Item label={<span style={{ fontSize: '11px' }}>Code (auto-derived from project name)</span>}>
          <Input
            value={deriveCode(form.getFieldValue('project') || '')}
            disabled
            style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f5f5f5' }}
          />
        </Form.Item>
        <Form.Item name="comments" label={<span style={{ fontSize: '11px' }}>Comments</span>}>
          <Input.TextArea rows={2} placeholder="Add notes..." style={{ fontSize: '11px' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
