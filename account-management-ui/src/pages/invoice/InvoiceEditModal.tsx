import React from 'react';
import { Form, Input, Modal, Select, Space } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { EditOutlined } from '@ant-design/icons';
import type { InvRow } from './invoiceTypes';
import { deriveCode } from './invoiceUtils';

export interface InvoiceEditModalProps {
  open: boolean;
  editingRow: InvRow | null;
  form: FormInstance;
  companyOptions: Array<{ label: string; value: string }>;
  onCancel: () => void;
  onSave: () => void;
}

export function InvoiceEditModal({
  open,
  editingRow,
  form,
  companyOptions,
  onCancel,
  onSave,
}: InvoiceEditModalProps) {
  return (
    <Modal
      title={<Space><EditOutlined style={{ color: '#1890ff' }} /><span style={{ fontSize: '13px' }}>Edit Project</span></Space>}
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      okText="Save"
      width={480}
      okButtonProps={{ size: 'small' }}
      cancelButtonProps={{ size: 'small' }}
    >
      {editingRow && (
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item label={<span style={{ fontSize: '11px' }}>Code (derived, non-editable)</span>}>
            <Input
              value={deriveCode(form.getFieldValue('project') || editingRow.project)}
              disabled
              style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f5f5f5' }}
            />
          </Form.Item>
          <Form.Item name="project" label={<span style={{ fontSize: '11px' }}>Project Name</span>} rules={[{ required: true, message: 'Project name is required' }]}>
            <Input style={{ fontSize: '12px' }} />
          </Form.Item>
          <Form.Item name="company" label={<span style={{ fontSize: '11px' }}>Company</span>}>
            {companyOptions.length > 0 ? (
              <Select showSearch allowClear size="small" options={companyOptions} placeholder="Select company…" style={{ fontSize: '12px' }} notFoundContent="No options — add in Configuration" />
            ) : (
              <Input style={{ fontSize: '12px' }} />
            )}
          </Form.Item>
          <Form.Item name="status" label={<span style={{ fontSize: '11px' }}>Status</span>} initialValue="Active">
            <Select size="small" options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} style={{ fontSize: '11px' }} />
          </Form.Item>
          <Form.Item name="comments" label={<span style={{ fontSize: '11px' }}>Comments</span>}>
            <Input.TextArea rows={2} placeholder="Add notes..." style={{ fontSize: '11px' }} />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
