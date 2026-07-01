import React from 'react';
import { Button, Drawer, Space, Tooltip } from 'antd';
import { CheckCircleOutlined, EditOutlined, ExpandAltOutlined, ShrinkOutlined, StopOutlined } from '@ant-design/icons';
import ResourceDetailPanel from '../../components/ResourceDetailPanel';
import type { ResourceRow } from '../../types/resource';

export interface ResourceDetailDrawerProps {
  open: boolean;
  resource: ResourceRow | null;
  expanded: boolean;
  canEdit: boolean;
  canDelete: boolean;
  currentUsername?: string;
  onClose: () => void;
  onToggleExpand: () => void;
  onEdit: (resource: ResourceRow) => void;
  onToggleActive: (resource: ResourceRow, nextActive: boolean) => void;
  onNavigateToRequest?: (beelineId: string) => void;
  onNavigateToInsights?: () => void;
  onNavigateToProcess?: (sowName: string) => void;
}

export const ResourceDetailDrawer: React.FC<ResourceDetailDrawerProps> = ({
  open,
  resource,
  expanded,
  canEdit,
  canDelete,
  currentUsername,
  onClose,
  onToggleExpand,
  onEdit,
  onToggleActive,
  onNavigateToRequest,
  onNavigateToInsights,
  onNavigateToProcess,
}) => (
  <Drawer
    title={null}
    placement="right"
    onClose={onClose}
    open={open && !!resource}
    width={expanded ? 1100 : 680}
    extra={
      resource && (
        <Space>
          <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
            <Button type="text" icon={expanded ? <ShrinkOutlined /> : <ExpandAltOutlined />} onClick={onToggleExpand} />
          </Tooltip>
          {canEdit && <Button type="text" icon={<EditOutlined />} onClick={() => onEdit(resource)} title="Edit" />}
          {canDelete && (
            <Button
              type="text"
              danger={resource.isActive !== false}
              icon={resource.isActive === false ? <CheckCircleOutlined /> : <StopOutlined />}
              onClick={() => onToggleActive(resource, resource.isActive === false)}
              title={resource.isActive === false ? 'Reactivate' : 'Mark Inactive'}
            />
          )}
        </Space>
      )
    }
  >
    {resource && (
      <ResourceDetailPanel
        resource={resource}
        currentUser={currentUsername}
        expanded={expanded}
        panelOpen={open && !!resource}
        onToggleExpand={onToggleExpand}
        onNavigateToRequest={onNavigateToRequest}
        onNavigateToInsights={onNavigateToInsights}
        onNavigateToProcess={onNavigateToProcess}
      />
    )}
  </Drawer>
);
