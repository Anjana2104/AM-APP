import React from 'react';
import { Button, Dropdown, Input, Modal, Space, Tooltip, Typography } from 'antd';
import { AppstoreOutlined, CloudServerOutlined, ColumnHeightOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined, FilterOutlined, LinkOutlined, MoreOutlined, PlusOutlined, TableOutlined, UploadOutlined } from '@ant-design/icons';
import type { ResourceViewMode } from './resourceTypes';

const { Text } = Typography;

export interface ResourceToolbarProps {
  filteredCount: number;
  totalCount: number;
  fromServer: boolean;
  globalSearch: string;
  isFilterApplied: boolean;
  viewMode: ResourceViewMode;
  showFilterPanel: boolean;
  canEdit: boolean;
  canDelete: boolean;
  resourcesLength: number;
  onGlobalSearchChange: (value: string) => void;
  onClearFilters: () => void;
  onToggleFilterPanel: () => void;
  onViewModeChange: (mode: ResourceViewMode) => void;
  onOpenColumnDrawer: () => void;
  onExportExcel: () => void;
  onAddNew: () => void;
  onDownloadTemplate: () => void;
  onUploadClick: () => void;
  onExportBeelineMapping: () => void;
  onDeleteAll: () => void;
  onDeleteAllAudit: () => void;
  onDeleteAllComments: () => void;
}

export const ResourceToolbar: React.FC<ResourceToolbarProps> = ({
  filteredCount,
  totalCount,
  fromServer,
  globalSearch,
  isFilterApplied,
  viewMode,
  showFilterPanel,
  canEdit,
  canDelete,
  resourcesLength,
  onGlobalSearchChange,
  onClearFilters,
  onToggleFilterPanel,
  onViewModeChange,
  onOpenColumnDrawer,
  onExportExcel,
  onAddNew,
  onDownloadTemplate,
  onUploadClick,
  onExportBeelineMapping,
  onDeleteAll,
  onDeleteAllAudit,
  onDeleteAllComments,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '16px' }}>
    <Space>
      <Text type="secondary" style={{ fontSize: '12px' }}>
        Showing: <strong>{filteredCount}</strong>{filteredCount !== totalCount ? ` / ${totalCount}` : ''}
      </Text>
      {fromServer && (
        <Tooltip title="Data loaded from database">
          <CloudServerOutlined style={{ color: '#52c41a', fontSize: 14 }} />
        </Tooltip>
      )}
    </Space>
    <Input.Search
      placeholder="Search name, RA ID, role, skills, Beeline ID…"
      allowClear
      size="small"
      value={globalSearch}
      onChange={(event) => onGlobalSearchChange(event.target.value)}
      onSearch={onGlobalSearchChange}
      style={{ width: 300, borderRadius: 6 }}
      styles={{ input: { fontSize: 12 } }}
    />
    <Space wrap size={8}>
      {isFilterApplied && <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={onClearFilters}>✕ Clear Filters</Button>}
      <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
        <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={onToggleFilterPanel} style={{ borderRadius: '6px' }} />
      </Tooltip>
      <Tooltip title="Card View" overlayInnerStyle={{ fontSize: '11px' }}>
        <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('card')} style={{ borderRadius: '6px' }} />
      </Tooltip>
      <Tooltip title="Table View" overlayInnerStyle={{ fontSize: '11px' }}>
        <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} size="small" onClick={() => onViewModeChange('table')} style={{ borderRadius: '6px' }} />
      </Tooltip>
      {viewMode === 'table' && (
        <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button icon={<ColumnHeightOutlined />} size="small" onClick={onOpenColumnDrawer} style={{ borderRadius: '6px' }} />
        </Tooltip>
      )}
      <Tooltip title="Export Formatted Excel" overlayInnerStyle={{ fontSize: '11px' }}>
        <Button icon={<FileExcelOutlined />} size="small" onClick={onExportExcel} disabled={!resourcesLength} style={{ borderRadius: '6px', color: resourcesLength ? '#52c41a' : undefined }} />
      </Tooltip>
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            ...(canEdit ? [{ key: 'add', label: <span style={{ fontSize: '11px' }}>Add New Resource</span>, icon: <PlusOutlined style={{ fontSize: '11px' }} />, onClick: onAddNew }] : []),
            { type: 'divider' as const },
            { key: 'dlTemplate', label: <span style={{ fontSize: '11px' }}>Download Template</span>, icon: <DownloadOutlined style={{ fontSize: '11px' }} />, onClick: onDownloadTemplate },
            ...(canEdit ? [{ key: 'ulAddOrUpdate', label: <span style={{ fontSize: '11px' }}>Add or Update Resource Details</span>, icon: <UploadOutlined style={{ fontSize: '11px' }} />, onClick: onUploadClick }] : []),
            { key: 'dlBeelineMapping', label: <span style={{ fontSize: '11px' }}>Download Beeline-Resource Mapping</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: onExportBeelineMapping },
            ...(canEdit && canDelete && resourcesLength > 0 ? [{ type: 'divider' as const }] : []),
            ...(canDelete && resourcesLength > 0 ? [{
              key: 'deleteAll',
              label: <span style={{ fontSize: '11px' }}>Delete All Resources</span>,
              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
              danger: true,
              onClick: () => Modal.confirm({
                title: 'Delete all resource data?',
                content: 'This will permanently remove all resources from the database.',
                okText: 'Yes, delete all',
                cancelText: 'Cancel',
                okButtonProps: { danger: true, size: 'small' },
                onOk: onDeleteAll,
              }),
            }] : []),
            ...(canDelete ? [{ type: 'divider' as const }] : []),
            ...(canDelete ? [{
              key: 'deleteAllAudit',
              label: <span style={{ fontSize: '11px' }}>Delete All Audit History</span>,
              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
              danger: true,
              onClick: () => Modal.confirm({
                title: 'Delete all resource audit history?',
                content: 'This will permanently remove all audit log entries for resources.',
                okText: 'Yes, delete all',
                cancelText: 'Cancel',
                okButtonProps: { danger: true, size: 'small' },
                onOk: onDeleteAllAudit,
              }),
            }, {
              key: 'deleteAllComments',
              label: <span style={{ fontSize: '11px' }}>Delete All Comments</span>,
              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
              danger: true,
              onClick: () => Modal.confirm({
                title: 'Delete all resource comments?',
                content: 'This will permanently remove all comments across all resource records.',
                okText: 'Yes, delete all',
                cancelText: 'Cancel',
                okButtonProps: { danger: true, size: 'small' },
                onOk: onDeleteAllComments,
              }),
            }] : []),
          ],
        }}
      >
        <Button icon={<MoreOutlined />} size="small" style={{ borderRadius: '6px' }} />
      </Dropdown>
    </Space>
  </div>
);
