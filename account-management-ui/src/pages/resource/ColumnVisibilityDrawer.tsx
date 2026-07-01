import React from 'react';
import { Checkbox, Drawer, Space } from 'antd';
import { RESOURCE_COLUMN_LABELS } from './resourceConstants';

export interface ColumnVisibilityDrawerProps {
  open: boolean;
  visibleColumns: Set<string>;
  onClose: () => void;
  onToggleColumn: (key: string, checked: boolean) => void;
}

export const ColumnVisibilityDrawer: React.FC<ColumnVisibilityDrawerProps> = ({
  open,
  visibleColumns,
  onClose,
  onToggleColumn,
}) => (
  <Drawer title="Column Visibility" placement="right" onClose={onClose} open={open} width={300}>
    <Space direction="vertical" style={{ width: '100%' }}>
      {Object.entries(RESOURCE_COLUMN_LABELS)
        .filter(([key]) => key !== 'action')
        .map(([key, label]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Checkbox checked={visibleColumns.has(key)} onChange={(event) => onToggleColumn(key, event.target.checked)} />
            <label style={{ marginBottom: 0, cursor: 'pointer' }}>{label}</label>
          </div>
        ))}
    </Space>
  </Drawer>
);
