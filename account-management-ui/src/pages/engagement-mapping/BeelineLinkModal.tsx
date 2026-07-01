import { LinkOutlined } from '@ant-design/icons';
import { Modal, Select, Space, Tag } from 'antd';
import type { Dispatch, SetStateAction } from 'react';
import type { ResourceRow } from '../ResourceHub';
import type { SelectOption } from './types';

export interface BeelineLinkModalProps {
  open: boolean;
  resource: ResourceRow | null;
  onCancel: () => void;
  onSave: () => void;
  confirmLoading: boolean;
  selectedBeelineId: string;
  setSelectedBeelineId: Dispatch<SetStateAction<string>>;
  beelineRequestOptions: SelectOption[];
}

export function BeelineLinkModal({ open, resource, onCancel, onSave, confirmLoading, selectedBeelineId, setSelectedBeelineId, beelineRequestOptions }: BeelineLinkModalProps) {
  return (
    <Modal
      title={<Space><LinkOutlined style={{ color: '#1890ff' }} /><span>Link to Beeline Request</span></Space>}
      open={open}
      onCancel={onCancel}
      onOk={onSave}
      okText="Save Link"
      confirmLoading={confirmLoading}
      width={420}
    >
      {resource && (
        <div style={{ paddingTop: 8 }}>
          <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>{resource.empName}</div>
            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{resource.raId}</div>
          </div>
          <div style={{ marginBottom: 6, fontSize: '12px', color: '#595959' }}>Select Beeline ID to link:</div>
          <Select
            showSearch
            allowClear
            style={{ width: '100%' }}
            placeholder="Search Beeline ID…"
            value={selectedBeelineId || undefined}
            onChange={(value) => setSelectedBeelineId(value || '')}
            options={beelineRequestOptions}
            filterOption={(input, option) => (option?.value as string || '').toLowerCase().includes(input.toLowerCase())}
            size="middle"
          />
          {resource.beelineId && (
            <div style={{ marginTop: 8, fontSize: '11px', color: '#8c8c8c' }}>
              Currently linked: <Tag color="blue" style={{ fontSize: '10px' }}>{resource.beelineId}</Tag>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
