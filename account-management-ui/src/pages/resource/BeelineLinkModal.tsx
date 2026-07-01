import React from 'react';
import { Modal, Select, Space, Tag } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import type { ResourceRow } from '../../types/resource';
import type { SelectOption } from './resourceTypes';

export interface BeelineLinkModalProps {
  open: boolean;
  resource: ResourceRow | null;
  selectedBeelineId: string;
  saving: boolean;
  options: SelectOption[];
  onChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

export const BeelineLinkModal: React.FC<BeelineLinkModalProps> = ({
  open,
  resource,
  selectedBeelineId,
  saving,
  options,
  onChange,
  onCancel,
  onSave,
}) => (
  <Modal
    title={
      <span style={{ fontSize: '13px' }}>
        <LinkOutlined style={{ marginRight: 6, color: '#1890ff' }} />
        Link Resource to Beeline Request
      </span>
    }
    open={open}
    onCancel={onCancel}
    onOk={onSave}
    okText="Save"
    confirmLoading={saving}
    width={420}
    destroyOnClose
  >
    {resource && (
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        <div style={{ background: '#fafafa', borderRadius: 6, padding: '8px 12px', border: '1px solid #f0f0f0' }}>
          <div style={{ fontSize: '12px', fontWeight: 600 }}>{resource.empName}</div>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{resource.raId}</div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#595959', marginBottom: 6 }}>Select Beeline ID to link (clear to unlink)</div>
          <Select
            showSearch
            allowClear
            size="small"
            placeholder="Select Beeline ID"
            style={{ width: '100%' }}
            value={selectedBeelineId || undefined}
            onChange={(value) => onChange(value || '')}
            options={options}
            filterOption={(input, option) => (option?.value as string || '').toLowerCase().includes(input.toLowerCase())}
            notFoundContent={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>No requests found</span>}
          />
        </div>
        {resource.beelineId && (
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
            Currently linked: <Tag color="blue" style={{ fontSize: '10px' }}>{resource.beelineId}</Tag>
          </div>
        )}
      </Space>
    )}
  </Modal>
);
