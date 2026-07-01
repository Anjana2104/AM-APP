import React from 'react';
import { Tabs } from 'antd';
import { FileProtectOutlined, UploadOutlined } from '@ant-design/icons';
import type { ResourceRow } from '../../types/resource';
import type { ProcessRow } from './types';
import { SowGenerateTab } from './SowGenerateTab';
import { SowUploadSubTab } from './SowUploadSubTab';

interface SowTabContentProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  onRowCreated: (row: ProcessRow) => void;
  spUrl?: string;
}

export function SowTabContent({ resources, processRows, onRowCreated, spUrl = '' }: SowTabContentProps) {
  return (
    <Tabs
      defaultActiveKey="create"
      size="small"
      tabBarStyle={{ marginBottom: 14 }}
      items={[
        {
          key: 'create',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><FileProtectOutlined /> Create</span>,
          children: <SowGenerateTab resources={resources} processRows={processRows} spUrl={spUrl} />,
        },
        {
          key: 'upload',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><UploadOutlined /> Upload</span>,
          children: <SowUploadSubTab processRows={processRows} onRowCreated={onRowCreated} />,
        },
      ]}
    />
  );
}
