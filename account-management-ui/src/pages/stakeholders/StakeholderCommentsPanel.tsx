import React, { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Input, List, Modal, Select, Space, Spin, Table, Tabs, Tag, Typography, message } from 'antd';
import { DeleteOutlined, LinkOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import * as stakeholderNetworkApi from '../../api/stakeholderNetworkApi';
import type { Stakeholder } from './stakeholderNetworkUtils';

const { Text } = Typography;

const COMMENT_TAGS = ['Interactions', 'Escalations', 'Current Requirement', 'Future Requirement'] as const;

type CommentTag = (typeof COMMENT_TAGS)[number];

const TAG_COLOR_MAP: Record<CommentTag, string> = {
  Interactions: 'blue',
  Escalations: 'red',
  'Current Requirement': 'gold',
  'Future Requirement': 'purple',
};

interface ResourceOption {
  value: number;
  label: string;
}

interface Props {
  stakeholder: Stakeholder | null;
  stakeholders: Stakeholder[];
  resourceOptions: ResourceOption[];
  canEdit: boolean;
  changedBy: string;
}

function StakeholderCommentsPanel({ stakeholder, stakeholders, resourceOptions, canEdit, changedBy }: Props) {
  const [comments, setComments] = useState<stakeholderNetworkApi.StakeholderCommentRecord[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [auditEntries, setAuditEntries] = useState<stakeholderNetworkApi.StakeholderCommentAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newTag, setNewTag] = useState<CommentTag>('Interactions');
  const [newBody, setNewBody] = useState('');
  const [newLinkedResourceIds, setNewLinkedResourceIds] = useState<number[]>([]);
  const [linkResourcesModal, setLinkResourcesModal] = useState<{
    open: boolean;
    mode: 'new' | 'edit';
    comment: stakeholderNetworkApi.StakeholderCommentRecord | null;
  }>({ open: false, mode: 'new', comment: null });
  const [linkResourcesSearch, setLinkResourcesSearch] = useState('');
  const [linkResourcesChecked, setLinkResourcesChecked] = useState<Set<number>>(new Set());

  const [auditSearch, setAuditSearch] = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter] = useState<string | null>(null);

  const escalationTagSelected = newTag === 'Escalations';

  const auditFieldOptions = useMemo(
    () => Array.from(new Set(auditEntries.map(entry => entry.field))).map(value => ({ value, label: value })),
    [auditEntries]
  );

  const auditByOptions = useMemo(
    () => Array.from(new Set(auditEntries.map(entry => entry.changed_by).filter(Boolean))).map(value => ({ value, label: value })),
    [auditEntries]
  );

  const filteredAudit = useMemo(() => {
    const search = auditSearch.trim().toLowerCase();
    return auditEntries.filter(entry => {
      if (auditFieldFilter && entry.field !== auditFieldFilter) return false;
      if (auditByFilter && entry.changed_by !== auditByFilter) return false;
      if (!search) return true;
      return [entry.field, entry.old_value, entry.new_value, entry.changed_by]
        .some(value => String(value || '').toLowerCase().includes(search));
    });
  }, [auditEntries, auditSearch, auditFieldFilter, auditByFilter]);

  const loadData = async (stakeholderId: string) => {
    setCommentsLoading(true);
    setAuditLoading(true);
    try {
      const [commentRows, auditRows] = await Promise.all([
        stakeholderNetworkApi.getStakeholderComments(stakeholderId),
        stakeholderNetworkApi.getStakeholderCommentAudit(stakeholderId),
      ]);
      setComments(commentRows);
      setAuditEntries(auditRows);
    } catch (error) {
      console.error('[StakeholderCommentsPanel] Failed to load stakeholder comments/audit', { stakeholderId, error });
      message.error('Failed to load stakeholder comments');
      setComments([]);
      setAuditEntries([]);
    } finally {
      setCommentsLoading(false);
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (!stakeholder?.id) {
      setComments([]);
      setAuditEntries([]);
      return;
    }
    loadData(stakeholder.id);
  }, [stakeholder?.id]);

  const handleAddComment = async () => {
    if (!stakeholder?.id) {
      message.warning('Select a stakeholder first');
      return;
    }
    if (!newBody.trim()) {
      message.warning('Enter a comment');
      return;
    }
    setSaving(true);
    try {
      const result = await stakeholderNetworkApi.addStakeholderComment(stakeholder.id, {
        author: changedBy,
        tag: newTag,
        body: newBody.trim(),
        linkedResourceIds: escalationTagSelected ? newLinkedResourceIds : [],
        changedBy,
      });
      if (!result.ok) {
        message.error('Failed to add comment');
        return;
      }
      await loadData(stakeholder.id);
      setNewTag('Interactions');
      setNewBody('');
      setNewLinkedResourceIds([]);
      message.success('Comment added');
    } catch (error: any) {
      console.error('[StakeholderCommentsPanel] Failed to add stakeholder comment', { stakeholderId: stakeholder.id, newTag, error });
      message.error(error?.message || 'Failed to add comment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComment = async (comment: stakeholderNetworkApi.StakeholderCommentRecord) => {
    if (!stakeholder?.id) return;
    setSaving(true);
    try {
      const ok = await stakeholderNetworkApi.deleteStakeholderComment(comment.stakeholderId, comment.id, changedBy);
      if (!ok) {
        message.error('Failed to delete comment');
        return;
      }
      await loadData(stakeholder.id);
      message.success('Comment deleted');
    } catch (error: any) {
      console.error('[StakeholderCommentsPanel] Failed to delete stakeholder comment', { stakeholderId: stakeholder.id, commentId: comment.id, error });
      message.error(error?.message || 'Failed to delete comment');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlinkResource = async (
    comment: stakeholderNetworkApi.StakeholderCommentRecord,
    resourceIdToRemove: number
  ) => {
    if (!stakeholder?.id) return;
    setSaving(true);
    try {
      const nextLinkedResourceIds = comment.linkedResourceIds.filter(id => id !== resourceIdToRemove);
      const result = await stakeholderNetworkApi.updateStakeholderComment(comment.stakeholderId, comment.id, {
        body: comment.body,
        linkedResourceIds: nextLinkedResourceIds,
        changedBy,
      });
      if (!result.ok) {
        message.error('Failed to unlink resource');
        return;
      }
      await loadData(stakeholder.id);
      message.success('Resource unlinked');
    } catch (error: any) {
      console.error('[StakeholderCommentsPanel] Failed to unlink resource from escalation', {
        stakeholderId: stakeholder.id,
        commentId: comment.id,
        resourceIdToRemove,
        error,
      });
      message.error(error?.message || 'Failed to unlink resource');
    } finally {
      setSaving(false);
    }
  };

  const openLinkResourcesModalForNew = () => {
    setLinkResourcesModal({ open: true, mode: 'new', comment: null });
    setLinkResourcesSearch('');
    setLinkResourcesChecked(new Set(newLinkedResourceIds));
  };

  const openLinkResourcesModalForEdit = (comment: stakeholderNetworkApi.StakeholderCommentRecord) => {
    setLinkResourcesModal({ open: true, mode: 'edit', comment });
    setLinkResourcesSearch('');
    setLinkResourcesChecked(new Set(comment.linkedResourceIds || []));
  };

  const handleSaveLinkResources = async () => {
    const selectedIds = Array.from(linkResourcesChecked);
    if (linkResourcesModal.mode === 'new') {
      setNewLinkedResourceIds(selectedIds);
      setLinkResourcesModal({ open: false, mode: 'new', comment: null });
      setLinkResourcesSearch('');
      return;
    }
    const comment = linkResourcesModal.comment;
    if (!stakeholder?.id || !comment) return;
    setSaving(true);
    try {
      const result = await stakeholderNetworkApi.updateStakeholderComment(comment.stakeholderId, comment.id, {
        body: comment.body,
        linkedResourceIds: selectedIds,
        changedBy,
      });
      if (!result.ok) {
        message.error('Failed to update linked resources');
        return;
      }
      await loadData(stakeholder.id);
      setLinkResourcesModal({ open: false, mode: 'new', comment: null });
      setLinkResourcesSearch('');
      message.success('Linked resources updated');
    } catch (error: any) {
      console.error('[StakeholderCommentsPanel] Failed to update linked resources', {
        stakeholderId: stakeholder.id,
        commentId: comment.id,
        error,
      });
      message.error(error?.message || 'Failed to update linked resources');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Tabs
        size="small"
        defaultActiveKey="comments"
        items={[
          {
            key: 'comments',
            label: <span style={{ fontSize: '11px' }}>Comments</span>,
            children: !stakeholder ? (
              <Text type="secondary" style={{ fontSize: '11px' }}>Select a stakeholder to manage comments.</Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 8 }}>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Select
                    size="small"
                    value={newTag}
                    onChange={value => setNewTag(value as CommentTag)}
                    popupMatchSelectWidth={false}
                    style={{ width: '100%', fontSize: '11px' }}
                    options={COMMENT_TAGS.map(value => ({ value, label: <span style={{ fontSize: '11px' }}>{value}</span> }))}
                  />
                  <Input.TextArea
                    size="small"
                    rows={3}
                    value={newBody}
                    onChange={event => setNewBody(event.target.value)}
                    placeholder="Add a comment..."
                    style={{ fontSize: '11px' }}
                  />
                  {escalationTagSelected && (
                    <Space direction="vertical" size={4} style={{ width: '100%' }}>
                      <Button
                        size="small"
                        icon={<LinkOutlined />}
                        onClick={openLinkResourcesModalForNew}
                        style={{ fontSize: '11px' }}
                        disabled={!canEdit}
                      >
                        Link Resources
                      </Button>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                        {newLinkedResourceIds.length} resource{newLinkedResourceIds.length !== 1 ? 's' : ''} selected
                      </div>
                    </Space>
                  )}
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    loading={saving}
                    disabled={!canEdit || !newBody.trim()}
                    onClick={handleAddComment}
                    style={{ fontSize: '11px', color: '#fff', fontWeight: 500 }}
                  >
                    Add Comment
                  </Button>
                </Space>
              </div>

              {commentsLoading ? (
                <div style={{ textAlign: 'center', padding: 12 }}>
                  <Spin size="small" />
                </div>
              ) : (
                <List
                  size="small"
                  locale={{ emptyText: <span style={{ fontSize: '11px' }}>No comments yet</span> }}
                  dataSource={comments}
                  renderItem={comment => (
                    <List.Item
                      actions={canEdit ? [
                        <Button
                          key={`delete_${comment.id}`}
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteComment(comment)}
                          style={{ fontSize: '11px' }}
                        />,
                      ] : []}
                    >
                      <div style={{ width: '100%', background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '7px 10px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4, alignItems: 'center' }}>
                          <Tag color={TAG_COLOR_MAP[comment.tag]} style={{ margin: 0, fontSize: '10px', padding: '0 5px' }}>
                            {comment.tag}
                          </Tag>
                          {comment.tag === 'Escalations' ? (
                            <>
                              <Tag style={{ margin: 0, fontSize: '10px', padding: '0 5px' }}>
                                By: {comment.author || 'Admin'}
                              </Tag>
                              <Tag style={{ margin: 0, fontSize: '10px', padding: '0 5px' }}>
                                Reported by: {comment.stakeholderName || 'Client'}
                              </Tag>
                            </>
                          ) : null}
                          <Text type="secondary" style={{ fontSize: '10px' }}>{comment.author || 'System'}</Text>
                          <Text type="secondary" style={{ fontSize: '10px' }}>
                            {new Date(comment.updatedAt || comment.createdAt).toLocaleString()}
                          </Text>
                        </div>
                        <div style={{ fontSize: '11px', color: '#1f1f1f', marginBottom: comment.linkedResourceLabels.length ? 6 : 0 }}>
                          {comment.body}
                        </div>
                        {(comment.tag === 'Current Requirement' || comment.tag === 'Future Requirement') &&
                          (comment.requirementRequestId || comment.requirementRequestBeeline) && (
                            <div style={{ fontSize: '10px', color: '#595959', marginBottom: comment.linkedResourceLabels.length ? 6 : 0 }}>
                              Created Client Request: {comment.requirementRequestBeeline || '-'} (ID: {comment.requirementRequestId || '-'}) — this request is auto-created from this requirement comment.
                            </div>
                          )}
                        {!!comment.linkedResourceLabels.length && (
                          <Space wrap size={4}>
                            {comment.linkedResourceLabels.map((label, index) => (
                              <Tag
                                key={`${comment.id}_${label}`}
                                icon={<LinkOutlined />}
                                closable={canEdit}
                                onClose={event => {
                                  event.preventDefault();
                                  const resourceId = comment.linkedResourceIds[index];
                                  handleUnlinkResource(comment, resourceId);
                                }}
                                style={{ fontSize: '10px', margin: 0 }}
                              >
                                {label}
                              </Tag>
                            ))}
                          </Space>
                        )}
                        {comment.tag === 'Escalations' && canEdit && (
                          <div style={{ marginTop: 6 }}>
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              onClick={() => openLinkResourcesModalForEdit(comment)}
                              style={{ fontSize: '11px' }}
                            >
                              Edit Resource Links
                            </Button>
                          </div>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              )}
              </div>
            ),
          },
          {
            key: 'audit',
            label: <span style={{ fontSize: '11px' }}>Audit Trail</span>,
            children: !stakeholder ? (
              <Text type="secondary" style={{ fontSize: '11px' }}>Select a stakeholder to view audit trail.</Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Space wrap size={4}>
                <Input
                  size="small"
                  allowClear
                  value={auditSearch}
                  onChange={event => setAuditSearch(event.target.value)}
                  placeholder="Search..."
                  style={{ width: 120, fontSize: '11px' }}
                />
                <Select
                  size="small"
                  allowClear
                  value={auditFieldFilter || undefined}
                  onChange={value => setAuditFieldFilter(value ?? null)}
                  placeholder="Field"
                  style={{ width: 130, fontSize: '11px' }}
                  options={auditFieldOptions}
                />
                <Select
                  size="small"
                  allowClear
                  value={auditByFilter || undefined}
                  onChange={value => setAuditByFilter(value ?? null)}
                  placeholder="By"
                  style={{ width: 110, fontSize: '11px' }}
                  options={auditByOptions}
                />
                {(auditSearch || auditFieldFilter || auditByFilter) && (
                  <Button
                    size="small"
                    type="link"
                    danger
                    style={{ fontSize: '11px', padding: 0 }}
                    onClick={() => {
                      setAuditSearch('');
                      setAuditFieldFilter(null);
                      setAuditByFilter(null);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </Space>

              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: 12 }}>
                  <Spin size="small" />
                </div>
              ) : (
                <Table
                  size="small"
                  rowKey="id"
                  dataSource={filteredAudit}
                  pagination={{ size: 'small', pageSize: 6, showSizeChanger: false }}
                  scroll={{ x: 'max-content' }}
                  columns={[
                    {
                      title: <span style={{ fontSize: '11px' }}>Field</span>,
                      dataIndex: 'field',
                      key: 'field',
                      onHeaderCell: () => ({ style: { fontSize: '11px' } }),
                      render: (value: string) => <span style={{ fontSize: '11px' }}>{value}</span>,
                    },
                    {
                      title: <span style={{ fontSize: '11px' }}>Old Value</span>,
                      dataIndex: 'old_value',
                      key: 'old_value',
                      onHeaderCell: () => ({ style: { fontSize: '11px' } }),
                      render: (value: string) => <span style={{ fontSize: '11px' }}>{value || '—'}</span>,
                    },
                    {
                      title: <span style={{ fontSize: '11px' }}>New Value</span>,
                      dataIndex: 'new_value',
                      key: 'new_value',
                      onHeaderCell: () => ({ style: { fontSize: '11px' } }),
                      render: (value: string) => <span style={{ fontSize: '11px' }}>{value || '—'}</span>,
                    },
                    {
                      title: <span style={{ fontSize: '11px' }}>By</span>,
                      dataIndex: 'changed_by',
                      key: 'changed_by',
                      width: 90,
                      onHeaderCell: () => ({ style: { fontSize: '11px' } }),
                      render: (value: string) => <span style={{ fontSize: '11px' }}>{value || '—'}</span>,
                    },
                    {
                      title: <span style={{ fontSize: '11px' }}>When</span>,
                      dataIndex: 'changed_at',
                      key: 'changed_at',
                      width: 170,
                      onHeaderCell: () => ({ style: { fontSize: '11px' } }),
                      render: (value: string) => <span style={{ fontSize: '11px' }}>{value ? new Date(value).toLocaleString() : '—'}</span>,
                    },
                  ]}
                  locale={{ emptyText: <span style={{ fontSize: '11px' }}>No audit entries found</span> }}
                />
              )}
              </div>
            ),
          },
        ]}
      />
      <Modal
        title={
          <span style={{ fontSize: '13px' }}>
            <LinkOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            {linkResourcesModal.mode === 'new' ? 'Link Resources' : `Edit Linked Resources — ${linkResourcesModal.comment?.stakeholderName || ''}`}
          </span>
        }
        open={linkResourcesModal.open}
        onCancel={() => {
          setLinkResourcesModal({ open: false, mode: 'new', comment: null });
          setLinkResourcesSearch('');
        }}
        width={500}
        destroyOnClose
        footer={[
          <Button
            key="unlink-all"
            size="small"
            danger
            disabled={linkResourcesChecked.size === 0}
            onClick={() => setLinkResourcesChecked(new Set())}
            style={{ borderRadius: 6, fontSize: '11px', float: 'left' }}
          >
            Unlink All
          </Button>,
          <span key="count" style={{ fontSize: '11px', color: '#8c8c8c', float: 'left', lineHeight: '24px', marginLeft: 8 }}>
            {linkResourcesChecked.size} selected
          </span>,
          <Button
            key="cancel"
            size="small"
            style={{ borderRadius: 6 }}
            onClick={() => {
              setLinkResourcesModal({ open: false, mode: 'new', comment: null });
              setLinkResourcesSearch('');
            }}
          >
            Cancel
          </Button>,
          <Button key="ok" size="small" type="primary" loading={saving} style={{ borderRadius: 6 }} onClick={handleSaveLinkResources}>
            Save Links
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <div style={{ fontSize: '11px', color: '#8c8c8c', background: '#f0f5ff', borderRadius: 6, padding: '8px 12px' }}>
            Select resources to link for this escalation.
          </div>
          <Input.Search
            placeholder="Search by name or RAID..."
            size="small"
            allowClear
            value={linkResourcesSearch}
            onChange={event => setLinkResourcesSearch(event.target.value)}
          />
          <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, minHeight: 60 }}>
            {resourceOptions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#8c8c8c', fontSize: '12px' }}>No resources available</div>
            ) : resourceOptions
              .filter(option => {
                if (!linkResourcesSearch.trim()) return true;
                const q = linkResourcesSearch.toLowerCase();
                return option.label.toLowerCase().includes(q);
              })
              .map(option => {
                const isChecked = linkResourcesChecked.has(option.value);
                return (
                  <div
                    key={option.value}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      borderBottom: '1px solid #f5f5f5',
                      cursor: 'pointer',
                      background: isChecked ? '#f0f5ff' : 'transparent',
                    }}
                    onClick={() => {
                      const next = new Set(linkResourcesChecked);
                      if (next.has(option.value)) next.delete(option.value); else next.add(option.value);
                      setLinkResourcesChecked(next);
                    }}
                  >
                    <Checkbox checked={isChecked} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{option.label.split(' - ').slice(1).join(' - ') || option.label}</div>
                      <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{option.label.split(' - ')[0]}</div>
                    </div>
                    {isChecked && (
                      <Tag color="blue" style={{ fontSize: '10px' }}>
                        <LinkOutlined /> Linked
                      </Tag>
                    )}
                  </div>
                );
              })}
          </div>
        </Space>
      </Modal>
    </>
  );
}

export default StakeholderCommentsPanel;
