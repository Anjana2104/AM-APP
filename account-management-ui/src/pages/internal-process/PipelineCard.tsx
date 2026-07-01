import React from 'react';
import { Button, Dropdown, Modal, Tag, Tooltip } from 'antd';
import { CheckCircleFilled, CheckOutlined, DeleteOutlined, EditOutlined, EllipsisOutlined, IdcardOutlined, LinkOutlined, RightOutlined, StopOutlined, TeamOutlined } from '@ant-design/icons';
import type { ProcessRow } from './types';
import { deriveStatus, PIPELINE_STAGES, STAGE_COLORS, STATUS_COLORS } from './shared';

interface PipelineCardProps {
  row: ProcessRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onLinkResources: () => void;
  onToggleActive: () => void;
  onAssignAnchor: () => void;
  setDetailRow: (row: ProcessRow | null) => void;
  canEdit?: boolean;
  canDelete?: boolean;
  linkedCount?: number;
}

export function PipelineCard({ row, onView, onEdit, onDelete, onLinkResources, onToggleActive, onAssignAnchor, setDetailRow, canEdit, canDelete, linkedCount }: PipelineCardProps) {
  const status = deriveStatus(row);
  const statusColor = STATUS_COLORS[status];
  const isInactive = row.active !== 'Yes';

  return (
    <div
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button, [class*="ant-dropdown"], .ant-dropdown')) return;
        onView();
      }}
      style={{
        background: isInactive ? '#fff7e6' : '#fff',
        borderRadius: 10,
        border: isInactive ? '1px solid #ffe7ba' : `1px solid ${statusColor}33`,
        borderLeft: isInactive ? '4px solid #fa8c16' : `4px solid ${statusColor}`,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        padding: '14px 16px',
        marginBottom: 12,
        cursor: 'pointer',
        opacity: isInactive ? 0.85 : 1,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={event => (event.currentTarget.style.boxShadow = '0 4px 16px rgba(24,144,255,0.13)')}
      onMouseLeave={event => (event.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#262626' }}>{row.sow || '—'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
            {isInactive
              ? <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>Inactive</Tag>
              : <Tag style={{ fontSize: '10px', margin: 0, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44` }}>{status}</Tag>}
            {row.accountAnchor && <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>{row.accountAnchor}</Tag>}
            {!!linkedCount && <Tag icon={<TeamOutlined />} color="blue" style={{ fontSize: '10px', margin: 0 }}>{linkedCount} resource{linkedCount !== 1 ? 's' : ''}</Tag>}
          </div>
        </div>
        <Dropdown
          menu={{
            items: [
              (canEdit ?? true) ? { key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => { setDetailRow(null); onEdit(); } } : null,
              (canEdit ?? true) ? { key: 'toggleActive', label: <span style={{ fontSize: '11px' }}>{row.active === 'Yes' ? 'Mark Inactive' : 'Mark Active'}</span>, icon: row.active === 'Yes' ? <StopOutlined style={{ fontSize: '11px', color: '#ff4d4f' }} /> : <CheckOutlined style={{ fontSize: '11px', color: '#52c41a' }} />, onClick: () => onToggleActive() } : null,
              { key: 'link', label: <span style={{ fontSize: '11px' }}>Link Resources</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: () => onLinkResources() },
              { key: 'anchor', label: <span style={{ fontSize: '11px' }}>Assign Owner</span>, icon: <IdcardOutlined style={{ fontSize: '11px' }} />, onClick: () => onAssignAnchor() },
              { type: 'divider' as const },
              (canDelete ?? true) ? {
                key: 'delete',
                label: <span style={{ fontSize: '11px' }}>Delete</span>,
                icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                danger: true,
                onClick: () => Modal.confirm({
                  title: 'Delete this record?',
                  content: 'This action cannot be undone.',
                  okText: 'Delete',
                  okButtonProps: { danger: true, size: 'small' },
                  cancelButtonProps: { size: 'small' },
                  onOk: onDelete,
                }),
              } : null,
            ].filter(Boolean) as any[],
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ padding: '0 4px', borderRadius: 6 }} onClick={event => event.stopPropagation()} />
        </Dropdown>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {PIPELINE_STAGES.map((stage, index) => {
          const done = !!stage.field(row)?.trim();
          const color = done ? STAGE_COLORS[index] : '#d9d9d9';
          const value = stage.field(row)?.trim();
          return (
            <React.Fragment key={stage.key}>
              <Tooltip title={done && value ? <span style={{ fontSize: '11px' }}>{value}</span> : null} overlayInnerStyle={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'default' }} onClick={event => event.stopPropagation()}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: done ? color : '#f5f5f5', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', marginBottom: 4, boxShadow: done ? `0 0 0 3px ${color}22` : 'none' }}>
                    {done ? <CheckCircleFilled style={{ color: '#fff', fontSize: '16px' }} /> : <span style={{ color: '#bfbfbf', fontSize: '11px', fontWeight: 700 }}>{index + 1}</span>}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: done ? 700 : 400, color: done ? color : '#bfbfbf', textAlign: 'center', lineHeight: 1.2, maxWidth: 72 }}>{stage.label}</span>
                </div>
              </Tooltip>
              {index < PIPELINE_STAGES.length - 1 && (
                <div style={{ flex: 1, minWidth: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
                  <RightOutlined style={{ color: done ? STAGE_COLORS[index] : '#e8e8e8', fontSize: '11px' }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
