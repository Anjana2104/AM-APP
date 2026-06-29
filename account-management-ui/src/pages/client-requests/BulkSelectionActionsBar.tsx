import React from 'react';
import { Button, Popover, Space, Typography } from 'antd';
import { CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import BulkStatusPopoverContent from './BulkStatusPopoverContent';

const { Text } = Typography;

type Option = { label: string; value: string };

interface BulkSelectionActionsBarProps {
  selectedCount: number;
  overallStatusOptions: Option[];
  processingStatusOptions: Option[];
  onSelectOverallStatus: (value: string) => void;
  onSelectProcessingStatus: (value: string) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

export default function BulkSelectionActionsBar({
  selectedCount,
  overallStatusOptions,
  processingStatusOptions,
  onSelectOverallStatus,
  onSelectProcessingStatus,
  onDelete,
  onClearSelection,
}: BulkSelectionActionsBarProps) {
  return (
    <div style={{ background: '#f0f2f5', padding: '12px 16px', borderRadius: '8px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text>{selectedCount} record(s) selected</Text>
      <Space>
        <Popover
          content={<BulkStatusPopoverContent options={overallStatusOptions} onSelect={onSelectOverallStatus} />}
          trigger={['click']}
          placement="top"
        >
          <Button size="small" style={{ fontSize: '11px', color: '#262626' }}>Update Status</Button>
        </Popover>
        <Popover
          content={<BulkStatusPopoverContent minWidth="200px" options={processingStatusOptions} onSelect={onSelectProcessingStatus} />}
          trigger={['click']}
          placement="top"
        >
          <Button size="small" style={{ fontSize: '11px', color: '#262626' }}>Update Processing Status</Button>
        </Popover>
        <Button size="small" style={{ fontSize: '11px', color: '#262626' }} onClick={onDelete} icon={<DeleteOutlined />}>Delete</Button>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClearSelection} />
      </Space>
    </div>
  );
}
