import React, { useState, useCallback, useMemo } from 'react';
import { Select, Button, Space, Badge, Tooltip, Empty, Spin, Divider, Typography, message } from 'antd';
import { PlusOutlined, ExpandAltOutlined, ShrinkOutlined, CommentOutlined } from '@ant-design/icons';
import * as resourceInsightsApi from '../../api/resourceInsightsApi';
import type { InsightEntry } from '../../api/resourceInsightsApi';
import type { ResourceComment } from '../../api/resourceApi';
import { SECTION_META, type SectionKey } from './resourceIntelligenceTypes';
import { EntryCard } from './EntryCard';
import { EntryModal } from './EntryModal';
import { CommentMiniCard } from './CommentMiniCard';

const { Text } = Typography;

export interface SectionTabProps {
  section: SectionKey;
  entries: InsightEntry[];
  linkedComments: ResourceComment[];
  loading: boolean;
  currentUser: string;
  resourceId: number;
  resourceName?: string;
  onRefresh: () => void;
  onDeleteComment?: (id: number) => void;
  canEdit?: boolean;
  searchText: string;
}

export function SectionTab({ section, entries, linkedComments, loading, currentUser, resourceId, resourceName = '', onRefresh, onDeleteComment, canEdit = true, searchText }: SectionTabProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<InsightEntry | null>(null);
  const [tabExpanded, setTabExpanded] = useState(false);
  // Escalation-specific filters
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const meta = SECTION_META[section];

  const handleSave = useCallback(async (values: Record<string, string>) => {
    if (editingEntry) {
      const ok = await resourceInsightsApi.updateInsight(editingEntry.id, {
        title: values.title,
        body: values.body,
        tag: values.tag,
        status: section === 'interaction' ? 'open' : values.status,
        priority: values.priority,
        targetDate: values.targetDate || undefined,
        author: editingEntry.author, // preserve original author on edit
      });
      if (ok) { message.success('Entry updated'); onRefresh(); setModalOpen(false); setEditingEntry(null); }
      else message.error('Failed to update');
    } else {
      const result = await resourceInsightsApi.addInsight({
        resourceId, section,
        title: values.title,
        body: values.body,
        tag: values.tag,
        status: section === 'interaction' ? 'open' : (values.status || 'open'),
        priority: values.priority,
        targetDate: values.targetDate || undefined,
        author: currentUser, // always use logged-in user
      });
      if (result.ok) { message.success('Entry added'); onRefresh(); setModalOpen(false); }
      else message.error('Failed to add entry');
    }
  }, [editingEntry, resourceId, section, currentUser, onRefresh]);

  const handleDelete = useCallback(async (id: number) => {
    const ok = await resourceInsightsApi.deleteInsight(id);
    if (ok) {
      message.success('Entry deleted');
      onRefresh();
    } else {
      message.error('Failed to delete');
    }
  }, [onRefresh]);

  const handleEdit = useCallback((entry: InsightEntry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  }, []);

  // Filtered entries for display
  const filteredEntries = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    return entries.filter(e => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (priorityFilter && e.priority !== priorityFilter) return false;
      if (!q) return true;
      return (
        (e.title || '').toLowerCase().includes(q) ||
        (e.body || '').toLowerCase().includes(q) ||
        (e.tag || '').toLowerCase().includes(q) ||
        (e.author || '').toLowerCase().includes(q)
      );
    });
  }, [entries, searchText, statusFilter, priorityFilter]);

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10, alignItems: 'center' }}>
        {canEdit && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="small"
            style={{ background: meta.color, borderColor: meta.color, color: '#fff', fontWeight: 600, fontSize: 11 }}
            onClick={() => { setEditingEntry(null); setModalOpen(true); }}
          >
            Add
          </Button>
        )}
        {section === 'escalation' && (
          <Space.Compact size="small">
            <Select
              allowClear
              placeholder="Status"
              value={statusFilter}
              onChange={v => setStatusFilter(v ?? null)}
              style={{ width: 100, fontSize: 11 }}
              popupClassName="small-select-dropdown"
              options={[
                { value: 'open', label: 'Open' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
              ]}
            />
            <Select
              allowClear
              placeholder="Priority"
              value={priorityFilter}
              onChange={v => setPriorityFilter(v ?? null)}
              style={{ width: 100, fontSize: 11 }}
              popupClassName="small-select-dropdown"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'critical', label: 'Critical' },
              ]}
            />
          </Space.Compact>
        )}
        {(statusFilter || priorityFilter) && (
          <Badge count={`${filteredEntries.length}/${entries.length}`} style={{ background: meta.color, fontSize: 10 }} />
        )}
        {/* Expand/collapse this tab's content */}
        <Tooltip title={tabExpanded ? 'Collapse' : 'Expand'}>
          <Button
            type="text"
            size="small"
            icon={tabExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
            onClick={() => setTabExpanded(v => !v)}
            style={{ marginLeft: 'auto', color: '#8c8c8c', fontSize: 11 }}
          />
        </Tooltip>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
      ) : (
        <div style={{
          overflowY: 'auto',
          maxHeight: tabExpanded ? 680 : 360,
          paddingRight: 2,
          transition: 'max-height 0.25s ease',
        }}>
          {/* Linked resource comments */}
          {linkedComments.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, paddingBottom: 4, borderBottom: '1px solid #f0f0f0' }}>
                <CommentOutlined style={{ color: '#1890ff', fontSize: 11 }} />
                <Text style={{ fontSize: 11, fontWeight: 600, color: '#1890ff' }}>
                  Related Comments ({linkedComments.length})
                </Text>
              </div>
              {linkedComments.map(c => <CommentMiniCard key={c.id} comment={c} currentUser={currentUser} onDelete={onDeleteComment} />)}
              {filteredEntries.length > 0 && <Divider style={{ margin: '8px 0 6px' }} />}
            </div>
          )}

          {filteredEntries.length === 0 ? (
            <Empty
              description={searchText ? 'No entries match your search' : `No ${meta.label.toLowerCase()} entries yet`}
              style={{ margin: linkedComments.length > 0 ? '12px 0' : '24px 0' }}
              imageStyle={{ height: linkedComments.length > 0 ? 28 : 40 }}
            />
          ) : (
            filteredEntries.map(e => (
              <EntryCard key={e.id} entry={e} onEdit={handleEdit} onDelete={handleDelete} canEdit={canEdit} />
            ))
          )}
        </div>
      )}

      <EntryModal
        open={modalOpen}
        section={section}
        editing={editingEntry}
        defaultAuthor={currentUser}
        onClose={() => { setModalOpen(false); setEditingEntry(null); }}
        onSave={handleSave}
      />
    </div>
  );
}
