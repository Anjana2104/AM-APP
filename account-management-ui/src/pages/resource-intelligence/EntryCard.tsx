import React from 'react';
import { Card, Avatar, Tag, Typography, Button, Modal, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { EditOutlined, DeleteOutlined, EllipsisOutlined, CalendarOutlined } from '@ant-design/icons';
import type { InsightEntry } from '../../api/resourceInsightsApi';
import { SECTION_META, type SectionKey, STATUS_COLOR, PRIORITY_COLOR, fmtDate, fmtRelative } from './resourceIntelligenceTypes';

const { Text } = Typography;

export interface EntryCardProps {
  entry: InsightEntry;
  onEdit: (entry: InsightEntry) => void;
  onDelete: (id: number) => void;
  canEdit?: boolean;
}

export function EntryCard({ entry, onEdit, onDelete, canEdit = true }: EntryCardProps) {
  const meta = SECTION_META[entry.section as SectionKey] || SECTION_META.interaction;
  const menuItems: MenuProps['items'] = [
    { key: 'edit', label: 'Edit', icon: <EditOutlined /> },
    { key: 'delete', label: <span style={{ color: '#ff4d4f' }}>Delete</span>, icon: <DeleteOutlined style={{ color: '#ff4d4f' }} /> },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'edit') onEdit(entry);
    if (key === 'delete') {
      Modal.confirm({
        title: 'Delete this entry?',
        content: entry.title || 'This action cannot be undone.',
        okText: 'Delete',
        okButtonProps: { danger: true },
        onOk: () => onDelete(entry.id),
      });
    }
  };

  return (
    <Card
      size="small"
      hoverable
      style={{ marginBottom: 6, borderRadius: 7, border: '1px solid #f0f0f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      bodyStyle={{ padding: '8px 10px' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        {/* Section icon */}
        <Avatar
          shape="square"
          size={26}
          style={{ background: `${meta.color}18`, color: meta.color, flexShrink: 0, borderRadius: 6, fontSize: 12, minWidth: 26 }}
          icon={meta.icon}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Line 1: title */}
          <Text strong style={{ fontSize: 12, display: 'block', lineHeight: '18px' }}>
            {entry.title || '(No title)'}
          </Text>

          {/* Line 2: tags + author + time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
            {entry.tag && (
              <Tag bordered={false} color={meta.color} style={{ fontSize: 10, padding: '0 5px', margin: 0, lineHeight: '16px' }}>
                {entry.tag}
              </Tag>
            )}
            {entry.status && entry.section !== 'interaction' && (
              <Tag bordered={false} color={STATUS_COLOR[entry.status] || 'default'} style={{ fontSize: 10, padding: '0 5px', margin: 0, lineHeight: '16px' }}>
                {entry.status}
              </Tag>
            )}
            {(entry.section === 'escalation' || entry.section === 'plan') && entry.priority && (
              <Tag bordered={false} color={PRIORITY_COLOR[entry.priority] || 'default'} style={{ fontSize: 10, padding: '0 5px', margin: 0, lineHeight: '16px' }}>
                {entry.priority}
              </Tag>
            )}
            <Text type="secondary" style={{ fontSize: 10 }}>
              {entry.author || 'Unknown'} · {fmtRelative(entry.created_at)}
            </Text>
            {(entry.section === 'escalation' || entry.section === 'plan') && entry.target_date && (
              <Text type="secondary" style={{ fontSize: 10 }}>
                · <CalendarOutlined style={{ marginRight: 2 }} />{fmtDate(entry.target_date)}
              </Text>
            )}
          </div>

          {/* Body */}
          {entry.body && (
            <Text style={{ fontSize: 11, color: '#595959', display: 'block', marginTop: 4, lineHeight: '16px' }}>
              {entry.body}
            </Text>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ color: '#bfbfbf', flexShrink: 0, padding: '0 2px', height: 20 }} />
          </Dropdown>
        )}
      </div>
    </Card>
  );
}
