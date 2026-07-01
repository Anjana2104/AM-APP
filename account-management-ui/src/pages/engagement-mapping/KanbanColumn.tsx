import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { ResourceRow } from '../ResourceHub';
import { KanbanTile } from './KanbanTile';

export interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  bgColor: string;
  resources: ResourceRow[];
  selectedSNOs: Set<string>;
  onToggleSelect: (sno: string) => void;
  onViewDetails: (resource: ResourceRow) => void;
  headerAction?: ReactNode;
  onEdit?: (resource: ResourceRow) => void;
  canEdit?: boolean;
}

export function KanbanColumn({ id, title, color, bgColor, resources, selectedSNOs, onToggleSelect, onViewDetails, headerAction, onEdit, canEdit }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: isOver ? bgColor : '#f8f9fa',
        border: `2px ${isOver ? 'solid' : 'dashed'} ${isOver ? color : '#e0e0e0'}`,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${color}30`, background: `${color}18`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>{title}</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, color, background: `${color}25`, padding: '0 7px', borderRadius: 10, border: `1px solid ${color}40` }}>
            {resources.length}
          </span>
          {headerAction && <span style={{ marginLeft: 4 }}>{headerAction}</span>}
        </div>
      </div>
      <div ref={setNodeRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', minHeight: 60, scrollbarWidth: 'thin', scrollbarColor: '#e0e0e0 transparent' }}>
        {resources.length === 0
          ? <div style={{ textAlign: 'center', paddingTop: 24, color: '#ccc', fontSize: '11px', pointerEvents: 'none' }}>{isOver ? 'Drop here' : 'No resources'}</div>
          : resources.map((resource) => (
            <KanbanTile
              key={resource.sno}
              resource={resource}
              isSelected={selectedSNOs.has(resource.sno)}
              onToggleSelect={onToggleSelect}
              onViewDetails={onViewDetails}
              columnColor={color}
              onEdit={onEdit}
              canEdit={canEdit}
            />
          ))}
      </div>
    </div>
  );
}
