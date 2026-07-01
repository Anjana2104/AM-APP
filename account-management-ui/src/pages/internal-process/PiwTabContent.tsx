import React from 'react';
import { Tabs } from 'antd';
import { IdcardOutlined, UploadOutlined } from '@ant-design/icons';
import PiwCreateTabPanel from './PiwCreateTabPanel';
import PiwUploadSubTabPanel from './PiwUploadSubTabPanel';
import type { ProcessRow } from './types';
import type { ResourceRow } from '../../types/resource';

interface PiwTabContentProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  onUpdateProcessRow?: (key: string, updates: Partial<ProcessRow>) => void;
  onResourcesLinked?: () => void;
}

export function PiwTabContent({ resources, processRows, onUpdateProcessRow, onResourcesLinked }: PiwTabContentProps) {
  return (
    <Tabs
      defaultActiveKey="create"
      size="small"
      tabBarStyle={{ marginBottom: 14 }}
      items={[
        {
          key: 'create',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><IdcardOutlined /> Create</span>,
          children: <PiwCreateTabPanel resources={resources} processRows={processRows} onUpdateProcessRow={onUpdateProcessRow} />,
        },
        {
          key: 'upload',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><UploadOutlined /> Upload</span>,
          children: <PiwUploadSubTabPanel processRows={processRows} resources={resources} onUpdateProcessRow={onUpdateProcessRow} onResourcesLinked={onResourcesLinked} />,
        },
      ]}
    />
  );
}
