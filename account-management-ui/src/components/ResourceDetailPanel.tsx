import React, { useEffect, useMemo, useState } from 'react';
import {
  Space, Typography, Tag, Spin, Input, Select, Button, Divider,
  Table, Tooltip, Badge, Tabs,
} from 'antd';
import {
  ClockCircleOutlined, MessageOutlined, PlusOutlined, LinkOutlined,
} from '@ant-design/icons';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import * as resourceApi from '../api/resourceApi';
import type { ResourceComment } from '../api/resourceApi';
import type { ResourceRow } from '../types/resource';
import { useConfig } from '../context/ConfigContext';

const { Text, Title } = Typography;

const DEFAULT_COMMENT_TAGS = [
  { value: 'General',               label: 'General',               color: 'default' },
  { value: 'Connect with Resource', label: 'Connect with Resource', color: 'blue' },
  { value: 'Escalation',            label: 'Escalation',            color: 'red' },
  { value: 'Follow-up',             label: 'Follow-up',             color: 'orange' },
  { value: 'Action Required',       label: 'Action Required',       color: 'volcano' },
  { value: 'Important',             label: 'Important',             color: 'purple' },
  { value: 'Rejected by Client',    label: 'Rejected by Client',    color: 'magenta' },
  { value: 'Project Ended',         label: 'Project Ended',         color: 'gray' },
  { value: 'Candidate Declined',    label: 'Candidate Declined',    color: 'orange' },
  { value: 'On Hold',               label: 'On Hold',               color: 'gold' },
];

interface Props {
  resource: ResourceRow;
  currentUser?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
  onNavigateToRequest?: (beelineId: string) => void;
  onNavigateToInsights?: () => void;
}

// Clean raw DB audit values — handle null strings, JSON blobs, etc.
function cleanVal(v: string | null | undefined): string {
  if (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') return '—';
  const s = String(v).trim();
  if (s === 'null' || s === 'undefined') return '—';
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed === 'string') return parsed || '—';
    if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
    // Object/array — flatten to readable string
    return Object.entries(parsed as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${val}`)
      .join(', ');
  } catch {
    return s;
  }
}

export default function ResourceDetailPanel({ resource, currentUser, expanded, onNavigateToRequest, onNavigateToInsights }: Props) {
  const resourceId = resource.id;
  const { getConfigByLink } = useConfig();

  const commentTags = useMemo(() => {
    const linked = getConfigByLink('resource_comment_tag_field');
    if (linked && linked.items.length > 0)
      return linked.items.map(i => ({ value: i.value, label: i.label, color: i.color || 'default' }));
    return DEFAULT_COMMENT_TAGS;
  }, [getConfigByLink]);

  const defaultTag = commentTags[0]?.value || 'General';

  // Audit state
  const [auditLog, setAuditLog]             = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading]     = useState(false);
  const [auditSearch, setAuditSearch]       = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter]   = useState<string | null>(null);

  // Comment state
  const [comments, setComments]             = useState<ResourceComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [newCommentTag, setNewCommentTag]   = useState<string>(defaultTag);
  const [savingComment, setSavingComment]   = useState(false);

  // Keep tag in sync when config changes
  useEffect(() => {
    if (!commentTags.length) return;
    setNewCommentTag(prev =>
      commentTags.some(t => t.value === prev) ? prev : commentTags[0].value
    );
  }, [commentTags]);

  // Load data
  useEffect(() => {
    if (!resourceId) return;
    setAuditLoading(true);
    auditApi.getAuditLog('resources', resourceId).then(entries => {
      setAuditLog(entries);
      setAuditLoading(false);
    });
    setCommentsLoading(true);
    resourceApi.getResourceComments(resourceId).then(rows => {
      setComments(rows);
      setCommentsLoading(false);
    });
  }, [resourceId]);

  const filteredAudit = useMemo(() => {
    const q = auditSearch.toLowerCase().trim();
    return auditLog.filter(a => {
      if (auditFieldFilter && a.field !== auditFieldFilter) return false;
      if (auditByFilter && a.changed_by !== auditByFilter) return false;
      if (q && !['field', 'old_value', 'new_value', 'changed_by'].some(k =>
        String((a as Record<string, unknown>)[k] || '').toLowerCase().includes(q))) return false;
      return true;
    });
  }, [auditLog, auditSearch, auditFieldFilter, auditByFilter]);

  const auditFieldOptions = useMemo(
    () => Array.from(new Set(auditLog.map(a => a.field))).map(f => ({ value: f, label: f })),
    [auditLog]
  );
  const auditByOptions = useMemo(
    () => Array.from(new Set(auditLog.map(a => a.changed_by).filter(Boolean))).map(b => ({ value: b, label: b })),
    [auditLog]
  );

  const handleAddComment = async () => {
    if (!resourceId || !newCommentBody.trim()) return;
    setSavingComment(true);
    const ok = await resourceApi.addResourceComment(resourceId, {
      author: currentUser || 'Unknown',
      tag: newCommentTag,
      body: newCommentBody.trim(),
    });
    if (ok) {
      const updated = await resourceApi.getResourceComments(resourceId);
      setComments(updated);
      setNewCommentBody('');
      setNewCommentTag(commentTags[0]?.value || 'General');
    }
    setSavingComment(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!resourceId) return;
    const comment = comments.find(c => c.id === commentId);
    await resourceApi.deleteResourceComment(resourceId, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    // Log comment deletion to audit trail
    if (comment) {
      await auditApi.addAuditLog({
        module: 'resources',
        record_id: resourceId,
        record_name: resource.empName || '',
        field: `Comment Deleted [${comment.tag || 'General'}]`,
        old_value: comment.body,
        new_value: '',
        changed_by: currentUser || 'Unknown',
      });
      // Refresh audit log so deletion appears immediately
      const updated = await auditApi.getAuditLog('resources', resourceId);
      setAuditLog(updated);
    }
  };

  const tagColor = (tagValue: string) =>
    commentTags.find(t => t.value === tagValue)?.color || 'default';

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const infoFields: Array<[string, string]> = [
    ['RA ID', resource.raId],
    ['Email', resource.emailId],
    ['Role / Domain', resource.roleOrDomain],
    ['Prev Experience', resource.previousWorkex],
    ['Date of Joining', resource.doj],
    ['Total Experience', resource.totalWorkex],
    ['Engagement', resource.engagement || '—'],
    ['Allocation Status', resource.allocationStatus || '—'],
  ];

  const skillsList = resource.skills
    ? String(resource.skills).split(/[,;|]/).map(s => s.trim()).filter(Boolean)
    : [];

  // ── Audit Trail panel (shared between collapsed/expanded) ──────────────────
  const auditPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Space wrap size={4}>
        <Input size="small" allowClear placeholder="Search…" value={auditSearch}
          onChange={e => setAuditSearch(e.target.value)} style={{ width: 110, fontSize: 11 }} />
        <Select size="small" allowClear placeholder="Field" value={auditFieldFilter}
          onChange={v => setAuditFieldFilter(v ?? null)} options={auditFieldOptions}
          style={{ width: 110, fontSize: 11 }} popupMatchSelectWidth={false} />
        <Select size="small" allowClear placeholder="By" value={auditByFilter}
          onChange={v => setAuditByFilter(v ?? null)} options={auditByOptions}
          style={{ width: 100, fontSize: 11 }} popupMatchSelectWidth={false} />
        {(auditSearch || auditFieldFilter || auditByFilter) && (
          <Button size="small" type="link" danger style={{ fontSize: 11, padding: 0 }}
            onClick={() => { setAuditSearch(''); setAuditFieldFilter(null); setAuditByFilter(null); }}>
            Clear
          </Button>
        )}
      </Space>
      {auditLoading ? (
        <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
      ) : filteredAudit.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {auditLog.length === 0 ? 'No changes recorded yet.' : 'No results match filters.'}
        </Text>
      ) : (
        <Table<AuditEntry>
          size="small"
          dataSource={filteredAudit}
          rowKey="id"
          scroll={{ x: 'max-content', y: expanded ? 480 : 240 }}
          pagination={{ pageSize: expanded ? 15 : 6, size: 'small', showSizeChanger: false }}
          columns={[
            {
              title: 'Field', dataIndex: 'field', minWidth: 140, ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</Text>,
            },
            {
              title: 'Old Value', dataIndex: 'old_value', minWidth: 160, ellipsis: true,
              render: (v: string) => {
                const clean = cleanVal(v);
                return (
                  <Tooltip title={clean} overlayStyle={{ maxWidth: 340 }}>
                    <Text style={{ fontSize: 11, color: '#cf1322', cursor: 'default' }}>
                      {clean.slice(0, 30)}{clean.length > 30 ? '…' : ''}
                    </Text>
                  </Tooltip>
                );
              },
            },
            {
              title: 'New Value', dataIndex: 'new_value', minWidth: 160, ellipsis: true,
              render: (v: string) => {
                const clean = cleanVal(v);
                return (
                  <Tooltip title={clean} overlayStyle={{ maxWidth: 340 }}>
                    <Text style={{ fontSize: 11, color: '#389e0d', cursor: 'default' }}>
                      {clean.slice(0, 30)}{clean.length > 30 ? '…' : ''}
                    </Text>
                  </Tooltip>
                );
              },
            },
            {
              title: 'By', dataIndex: 'changed_by', minWidth: 90, ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '—'}</Text>,
            },
            {
              title: 'When', dataIndex: 'changed_at', minWidth: 130, ellipsis: true,
              render: (v: string) => <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{formatDate(v)}</Text>,
            },
          ]}
        />
      )}
    </div>
  );

  // ── Comments panel (shared) ────────────────────────────────────────────────
  const commentsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Add comment form */}
      <div>
        <Select
          size="small"
          value={newCommentTag}
          onChange={v => setNewCommentTag(v)}
          style={{ width: '100%', marginBottom: 6, fontSize: 11 }}
          options={commentTags.map(t => ({ value: t.value, label: t.label }))}
        />
        <Input.TextArea
          size="small"
          rows={2}
          placeholder="Add a comment…"
          value={newCommentBody}
          onChange={e => setNewCommentBody(e.target.value)}
          style={{ fontSize: 12, marginBottom: 6 }}
          onPressEnter={e => { if (e.shiftKey) return; e.preventDefault(); handleAddComment(); }}
        />
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          loading={savingComment}
          disabled={!newCommentBody.trim()}
          onClick={handleAddComment}
          block
          style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}
        >
          Add Comment
        </Button>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* Navigate to Individual Resource tab to view all comments */}
      <div style={{ background: '#f6f8ff', border: '1px solid #d6e4ff', borderRadius: 6, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageOutlined style={{ color: '#1890ff', fontSize: 14 }} />
          <span style={{ fontSize: 11, color: '#595959' }}>
            {commentsLoading ? 'Loading…' : comments.length > 0 ? (
              <><Text strong style={{ fontSize: 11 }}>{comments.length}</Text> comment{comments.length !== 1 ? 's' : ''} added</>
            ) : 'No comments yet'}
          </span>
        </div>
        {onNavigateToInsights && (
          <Button
            type="link"
            size="small"
            style={{ fontSize: 11, padding: 0 }}
            onClick={() => {
              try { sessionStorage.setItem('resource_insights_selected_id', String(resource.id)); } catch { /* ignore */ }
              onNavigateToInsights();
            }}
          >
            View all →
          </Button>
        )}
      </div>
    </div>
  );

  // ── Resource Info column ───────────────────────────────────────────────────
  const infoColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header card */}
      <div style={{ background: 'linear-gradient(135deg, #667eea10, #764ba210)', padding: '12px 14px', borderRadius: 8, border: '1px solid #e8eaf0' }}>
        <Title level={5} style={{ margin: '0 0 2px', fontSize: 14 }}>{resource.empName}</Title>
        <Text type="secondary" style={{ fontSize: 11 }}>{resource.piwRole || '—'}</Text>
        {resource.allocationStatus && (
          <div style={{ marginTop: 6 }}>
            <Tag color={
              resource.allocationStatus === 'Joined' ? 'green' :
              resource.allocationStatus === 'On Bench' || resource.allocationStatus === 'Available' ? 'orange' :
              resource.allocationStatus === 'Resigned' ? 'red' : 'blue'
            } style={{ fontSize: 11 }}>
              {resource.allocationStatus}
            </Tag>
            {resource.engagement && resource.engagement !== 'No Value' && (
              <Tag color="purple" style={{ fontSize: 11 }}>{resource.engagement}</Tag>
            )}
          </div>
        )}
        {resource.beelineId && (
          <div style={{ marginTop: 6 }}>
            <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onNavigateToRequest?.(resource.beelineId!)}>
              {resource.beelineId}
            </Tag>
          </div>
        )}
      </div>

      {/* Info grid */}
      <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '10px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
          {infoFields.map(([label, value]) => (
            <div key={label}>
              <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{label}</Text>
              <Text style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-all' }}>{value || '—'}</Text>
            </div>
          ))}
        </div>
        {skillsList.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>Skills</Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {skillsList.map((sk, i) => (
                <Tag key={i} color="blue" style={{ fontSize: 10, margin: 0 }}>{sk}</Tag>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── EXPANDED layout: Info top + Tabs(Comments | Audit) below ─────────────
  if (expanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        {/* Top: Resource info in a compact horizontal grid */}
        <div style={{ background: 'linear-gradient(135deg, #667eea10, #764ba210)', padding: '12px 16px', borderRadius: 8, border: '1px solid #e8eaf0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <div>
              <Title level={5} style={{ margin: '0 0 2px', fontSize: 14 }}>{resource.empName}</Title>
              <Text type="secondary" style={{ fontSize: 11 }}>{resource.piwRole || '—'}</Text>
            </div>
            <div style={{ marginLeft: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {resource.allocationStatus && (
                <Tag color={
                  resource.allocationStatus === 'Joined' ? 'green' :
                  resource.allocationStatus === 'On Bench' || resource.allocationStatus === 'Available' ? 'orange' :
                  resource.allocationStatus === 'Resigned' ? 'red' : 'blue'
                } style={{ fontSize: 11 }}>
                  {resource.allocationStatus}
                </Tag>
              )}
              {resource.engagement && resource.engagement !== 'No Value' && (
                <Tag color="purple" style={{ fontSize: 11 }}>{resource.engagement}</Tag>
              )}
              {resource.beelineId && (
                <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: 10, cursor: 'pointer' }}
                  onClick={() => onNavigateToRequest?.(resource.beelineId!)}>
                  {resource.beelineId}
                </Tag>
              )}
            </div>
          </div>
          {/* Info fields in a 4-column horizontal grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 16px' }}>
            {infoFields.map(([label, value]) => (
              <div key={label}>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{label}</Text>
                <Text style={{ fontSize: 11, fontWeight: 500, wordBreak: 'break-all' }}>{value || '—'}</Text>
              </div>
            ))}
          </div>
          {skillsList.length > 0 && (
            <div style={{ marginTop: 8, borderTop: '1px solid #e8eaf0', paddingTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 10, marginRight: 4 }}>Skills:</Text>
              {skillsList.map((sk, i) => (
                <Tag key={i} color="blue" style={{ fontSize: 10, margin: 0 }}>{sk}</Tag>
              ))}
            </div>
          )}
        </div>

        {/* Bottom: full-width Tabs for Comments + Audit Trail */}
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '4px 12px 12px', minHeight: 0 }}>
          <Tabs
            size="small"
            defaultActiveKey="comments"
            style={{ fontSize: 12 }}
            items={[
              {
                key: 'comments',
                label: (
                  <Space size={4}>
                    <MessageOutlined style={{ fontSize: 12 }} />
                    <span style={{ fontSize: 12 }}>Comments</span>
                    {comments.length > 0 && <Badge count={comments.length} style={{ background: '#1890ff', fontSize: 9 }} />}
                  </Space>
                ),
                children: commentsPanel,
              },
              {
                key: 'audit',
                label: (
                  <Space size={4}>
                    <ClockCircleOutlined style={{ fontSize: 12 }} />
                    <span style={{ fontSize: 12 }}>Audit Trail</span>
                    {auditLog.length > 0 && <Badge count={auditLog.length} style={{ background: '#722ed1', fontSize: 9 }} />}
                  </Space>
                ),
                children: auditPanel,
              },
            ]}
          />
        </div>
      </div>
    );
  }

  // ── COLLAPSED layout: Info + Tabs(Comments | Audit) ───────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {infoColumn}
      <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '4px 12px 12px' }}>
        <Tabs
          size="small"
          defaultActiveKey="comments"
          style={{ fontSize: 12 }}
          items={[
            {
              key: 'comments',
              label: (
                <Space size={4}>
                  <MessageOutlined style={{ fontSize: 12 }} />
                  <span style={{ fontSize: 12 }}>Comments</span>
                  {comments.length > 0 && <Badge count={comments.length} style={{ background: '#1890ff', fontSize: 9 }} />}
                </Space>
              ),
              children: commentsPanel,
            },
            {
              key: 'audit',
              label: (
                <Space size={4}>
                  <ClockCircleOutlined style={{ fontSize: 12 }} />
                  <span style={{ fontSize: 12 }}>Audit Trail</span>
                  {auditLog.length > 0 && <Badge count={auditLog.length} style={{ background: '#722ed1', fontSize: 9 }} />}
                </Space>
              ),
              children: auditPanel,
            },
          ]}
        />
      </div>
    </div>
  );
}