import React from 'react';
import { Button, Dropdown, Tag, Typography } from 'antd';
import { CheckCircleOutlined, EditOutlined, EyeOutlined, LinkOutlined, MoreOutlined, StopOutlined } from '@ant-design/icons';
import type { ResourceRow } from '../../types/resource';
import { AllocPctTag } from '../../utils/allocUtils';
import { CARD_ALLOCATION_STATUS_COLOR_MAP } from './resourceConstants';

const { Text } = Typography;

export interface ResourceCardViewProps {
  filteredResources: ResourceRow[];
  canEdit: boolean;
  canDelete: boolean;
  filterPanel?: React.ReactNode;
  onSelectResource: (resource: ResourceRow) => void;
  onEdit: (resource: ResourceRow) => void;
  onOpenBeelineLinkModal: (resource: ResourceRow) => void;
  onToggleActive: (resource: ResourceRow, nextActive: boolean) => void;
  onNavigateToRequest?: (beelineId: string) => void;
}

export const ResourceCardView: React.FC<ResourceCardViewProps> = ({
  filteredResources,
  canEdit,
  canDelete,
  filterPanel,
  onSelectResource,
  onEdit,
  onOpenBeelineLinkModal,
  onToggleActive,
  onNavigateToRequest,
}) => (
  <div style={{ display: 'flex', gap: '12px' }}>
    {filterPanel}
    <div style={{ flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {filteredResources.map((resource) => {
          if (!resource) return null;
          const isBench = resource.engagement === 'Bench';
          const isInactive = resource.isActive === false;
          const statusColor = resource.allocationStatus ? (CARD_ALLOCATION_STATUS_COLOR_MAP[resource.allocationStatus] || '#8c8c8c') : '#8c8c8c';

          return (
            <div
              key={resource.key || 'unknown'}
              style={{
                background: isInactive ? '#fff2f0' : '#fff',
                borderRadius: '8px',
                padding: '10px 10px 8px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                border: isInactive ? '1px solid #ffccc7' : '1px solid #f0f0f0',
                borderLeft: isInactive ? '3px solid #ff4d4f' : (isBench ? '3px solid #faad14' : '3px solid #e8eaf0'),
                cursor: 'pointer',
              }}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest('.ant-dropdown-trigger') || target.closest('.ant-dropdown')) return;
                onSelectResource(resource);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, marginBottom: 6 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                    <Text strong style={{ fontSize: '12px', lineHeight: '16px' }}>{String(resource.empName || 'N/A')}</Text>
                    <Text type="secondary" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>{String(resource.raId || '')}</Text>
                  </div>
                </div>
                <Dropdown
                  menu={{
                    items: [
                      { key: 'view', label: <span style={{ fontSize: '11px' }}>View</span>, icon: <EyeOutlined style={{ fontSize: '11px' }} />, onClick: () => onSelectResource(resource) },
                      ...(canEdit ? [{ key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => onEdit(resource) }] : []),
                      { key: 'beelineLink', label: <span style={{ fontSize: '11px' }}>Link to Beeline Request</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: () => onOpenBeelineLinkModal(resource) },
                      ...(canDelete ? [{ type: 'divider' as const }, { key: 'toggleActive', label: <span style={{ fontSize: '11px' }}>{resource.isActive === false ? 'Reactivate' : 'Mark Inactive'}</span>, icon: resource.isActive === false ? <CheckCircleOutlined style={{ fontSize: '11px' }} /> : <StopOutlined style={{ fontSize: '11px' }} />, danger: resource.isActive !== false, onClick: () => onToggleActive(resource, resource.isActive === false) }] : []),
                    ],
                  }}
                  trigger={['click']}
                >
                  <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: 0, height: 18, minWidth: 18, flexShrink: 0 }} />
                </Dropdown>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 5 }}>
                {resource.roleOrDomain && <Tag color="cyan" style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px' }}>{String(resource.roleOrDomain)}</Tag>}
                {resource.allocationStatus && <Tag style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px', background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}>{resource.allocationStatus}</Tag>}
                {resource.allocationPercentage != null && <AllocPctTag pct={resource.allocationPercentage} style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px' }} />}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {resource.totalWorkex && (() => {
                    const raw = String(resource.totalWorkex).replace(/[^\d.-]/g, '');
                    const num = parseFloat(raw);
                    const display = isNaN(num) ? String(resource.totalWorkex) : `${Math.trunc(num * 100) / 100} years`;
                    return <Text type="secondary" style={{ fontSize: '10px' }}>{display} exp</Text>;
                  })()}
                {resource.engagement && resource.engagement !== 'undefined' && (
                  <Text type="secondary" style={{ fontSize: '10px', borderLeft: resource.totalWorkex ? '1px solid #d9d9d9' : 'none', paddingLeft: resource.totalWorkex ? 8 : 0 }}>
                    {String(resource.engagement)}
                  </Text>
                )}
              </div>
              {resource.beelineId && (
                <div style={{ marginTop: 4 }}>
                  <Tag
                    icon={<LinkOutlined />}
                    color="blue"
                    style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px', cursor: 'pointer' }}
                    onClick={(event) => {
                      event.stopPropagation();
                      onNavigateToRequest?.(resource.beelineId!);
                    }}
                  >
                    {resource.beelineId}
                  </Tag>
                </div>
              )}
            </div>
          );
        })}
        {filteredResources.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
            <Text type="secondary">No resources match your filters</Text>
          </div>
        )}
      </div>
    </div>
  </div>
);
