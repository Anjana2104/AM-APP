import React from 'react';
import { Avatar, Tag, Typography, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ResourceComment } from '../../api/resourceApi';
import { COMMENT_TAG_COLORS, fmtRelative } from './resourceIntelligenceTypes';

const { Text } = Typography;

export function CommentMiniCard({ comment, currentUser, onDelete }: {
  comment: ResourceComment;
  currentUser?: string;
  onDelete?: (id: number) => void;
}) {
  const tagLabel = comment.tag || 'General';
  const tagColor = COMMENT_TAG_COLORS[tagLabel] ?? 'default';
  const isOwn = currentUser && comment.author === currentUser;
  const showStakeholderEscalationMeta =
    comment.source_module === 'stakeholder_escalation' ||
    (tagLabel === 'Escalations' && Boolean(comment.reported_by));

  return (
    <div style={{
      padding: '8px 12px', borderRadius: 8, background: '#f0f7ff',
      border: '1px solid #bae0ff', marginBottom: 6,
      display: 'flex', alignItems: 'flex-start', gap: 8,
    }}>
      <Avatar size={22} style={{ background: '#1890ff', fontSize: 10, flexShrink: 0, marginTop: 1 }}>
        {(comment.author || '?').slice(0, 1).toUpperCase()}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {tagLabel && (
              <Tag bordered={false} color={tagColor} style={{ fontSize: 10, padding: '0 5px' }}>{tagLabel}</Tag>
            )}
            <Text strong style={{ fontSize: 11 }}>
              {showStakeholderEscalationMeta
                ? `By: ${comment.author || 'Admin'}${comment.reported_by ? ` | Reported by: ${comment.reported_by}` : ''}`
                : (comment.author || '—')}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }}>{fmtRelative(comment.created_at)}</Text>
          </div>
          {isOwn && onDelete && (
            <Button
              type="text" size="small" danger
              icon={<DeleteOutlined />}
              style={{ fontSize: 10, padding: '0 2px', height: 16 }}
              onClick={() => onDelete(comment.id)}
            />
          )}
        </div>
        <Text style={{ fontSize: 12, color: '#262626' }}>{comment.body}</Text>
      </div>
    </div>
  );
}
