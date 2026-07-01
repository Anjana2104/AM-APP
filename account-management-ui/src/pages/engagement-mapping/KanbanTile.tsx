import { Typography } from 'antd';
import { EditOutlined, EyeOutlined, LinkOutlined } from '@ant-design/icons';
import { useDraggable } from '@dnd-kit/core';
import type { ResourceRow } from '../ResourceHub';
import { AllocPctBadge } from '../../utils/allocUtils';

export interface KanbanTileProps {
  resource: ResourceRow;
  isSelected: boolean;
  onToggleSelect: (sno: string) => void;
  onViewDetails: (resource: ResourceRow) => void;
  columnColor: string;
  onEdit?: (resource: ResourceRow) => void;
  canEdit?: boolean;
}

export function KanbanTile({ resource, isSelected, onToggleSelect, onViewDetails, columnColor, onEdit, canEdit }: KanbanTileProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: resource.sno, data: { resource } });
  const expNum = resource.totalWorkex ? parseFloat(String(resource.totalWorkex).replace(/[^\d.]/g, '')) : NaN;
  const expDisplay = !isNaN(expNum) ? `${expNum % 1 === 0 ? expNum : expNum.toFixed(1)}y` : (resource.totalWorkex || '');
  const isPipeline = ['Shortlisted', 'Offered', 'Selected'].includes(resource.allocationStatus || '');
  const isInactive = resource.isActive === false;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        if ((e.target as HTMLElement).closest('button')) return;
        onToggleSelect(resource.sno);
      }}
      style={{
        background: isInactive ? '#fff1f0' : (isSelected ? '#e6f4ff' : '#fff'),
        border: `1px solid ${isInactive ? '#ffccc7' : (isSelected ? '#1890ff' : '#ebebeb')}`,
        borderLeft: `3px solid ${isInactive ? '#ff4d4f' : (isSelected ? '#1890ff' : columnColor)}`,
        borderRadius: 6,
        padding: '6px 8px',
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.35 : 1,
        marginBottom: 5,
        boxShadow: isSelected ? '0 0 0 2px #91caff40' : '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'opacity 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
        <Typography.Text strong style={{ fontSize: '11px', lineHeight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 3 }}>
          {resource.empName}
        </Typography.Text>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {isPipeline && canEdit && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(resource);
              }}
              style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: '#1890ff', fontSize: 10, lineHeight: 1 }}
              title="Edit engagement details"
            >
              <EditOutlined />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(resource);
            }}
            style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: '#8c8c8c', fontSize: 10, lineHeight: 1 }}
            title="View details"
          >
            <EyeOutlined />
          </button>
        </div>
      </div>
      <div style={{ fontSize: '9px', color: '#8c8c8c', lineHeight: 1.5, marginBottom: 3 }}>
        {[resource.raId, expDisplay, resource.roleOrDomain || resource.piwRole].filter(Boolean).join('  ·  ')}
      </div>
      {resource.engagement && resource.engagement !== 'Bench' && resource.engagement !== 'No Value' && (
        <div style={{ marginBottom: 2 }}>
          <span style={{ fontSize: '8px', padding: '0 5px', lineHeight: '14px', borderRadius: 3, background: '#f9f0ff', color: '#722ed1', border: '1px solid #d3adf7' }}>
            {resource.engagement}
          </span>
        </div>
      )}
      {(resource.engagementStartDate || resource.engagementEndDate) && (
        <div style={{ fontSize: '8px', color: '#8c8c8c', marginBottom: 2 }}>
          {resource.engagementStartDate && <span>{resource.engagementStartDate}</span>}
          {resource.engagementStartDate && resource.engagementEndDate && <span> → </span>}
          {resource.engagementEndDate && <span>{resource.engagementEndDate}</span>}
        </div>
      )}
      {resource.beelineId && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: '8px', padding: '0 5px', lineHeight: '14px', borderRadius: 3, background: '#e6f4ff', color: '#1677ff', border: '1px solid #91caff', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            <LinkOutlined style={{ fontSize: 8 }} />
            {resource.beelineId}
          </span>
        </div>
      )}
      {resource.allocationPercentage != null && (
        <div style={{ marginTop: 2 }}>
          <AllocPctBadge pct={resource.allocationPercentage} style={{ fontSize: '8px', lineHeight: '14px', borderRadius: 3 }} />
        </div>
      )}
      {isInactive && (
        <div style={{ marginTop: 2 }}>
          <span style={{ fontSize: '8px', padding: '0 5px', lineHeight: '14px', borderRadius: 3, background: '#fff1f0', color: '#cf1322', border: '1px solid #ffccc7' }}>
            Inactive
          </span>
        </div>
      )}
    </div>
  );
}
