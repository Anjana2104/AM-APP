import React, { useEffect, useMemo, useState } from 'react';
import {
  Space, Typography, Tag, Spin, Input, Select, Button, Divider,
  Table, Tooltip, Badge, Tabs, Empty, message,
} from 'antd';
import {
  UserOutlined, LinkOutlined,
  ClockCircleOutlined, MessageOutlined, TeamOutlined, PlusOutlined,
  StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import * as requestApi from '../api/requestApi';
import type { RequestComment } from '../api/requestApi';
import { useConfig } from '../context/ConfigContext';

const { Text } = Typography;

const DEFAULT_COMMENT_TAGS = [
  { value: 'General',            label: 'General',            color: 'default' },
  { value: 'Follow-up',          label: 'Follow-up',          color: 'orange' },
  { value: 'Action Required',    label: 'Action Required',    color: 'volcano' },
  { value: 'Important',          label: 'Important',          color: 'purple' },
  { value: 'Escalation',         label: 'Escalation',         color: 'red' },
  { value: 'On Hold',            label: 'On Hold',            color: 'gold' },
  { value: 'Rejected by Client', label: 'Rejected by Client', color: 'magenta' },
  { value: 'Closed',             label: 'Closed',             color: 'gray' },
];

interface ClientRequest {
  id?: number;
  sno: string;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
  isActive?: boolean;
}

interface LinkedResource {
  id: number;
  ra_id: string;
  emp_name: string;
  beeline_id: string;
}

interface Props {
  request: ClientRequest;
  expanded?: boolean;
  currentUser?: string;
  processingStatusLabel?: (v: string) => string;
  overallStatusLabel?: (v: string) => string;
  overallStatusColor?: (v: string) => string;
  overallStatusBg?: (v: string) => string;
  requestTypeLabel?: (v: string) => string;
  requestTypeColor?: (v: string) => string;
  canEdit?: boolean;
  canDelete?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleActive?: () => void;
  onLinkResources?: () => void;
  onActiveToggled?: (newActive: boolean) => void;
}

function cleanVal(v: string | null | undefined): string {
  if (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') return '—';
  const s = String(v).trim();
  if (s === 'null' || s === 'undefined') return '—';
  try {
    const parsed = JSON.parse(s);
    if (typeof parsed === 'string') return parsed || '—';
    if (typeof parsed === 'number' || typeof parsed === 'boolean') return String(parsed);
    return Object.entries(parsed as Record<string, unknown>).map(([k, val]) => `${k}: ${val}`).join(', ');
  } catch { return s; }
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).replace(' at ', ', ');
  } catch { return iso; }
}

function formatLastUpdated(value: string | undefined): string {
  if (!value) return '—';
  // Handle DD/MM/YYYY stored format (no time component)
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (ddmmyyyy) {
    const d = new Date(Date.UTC(
      Number(ddmmyyyy[3]),
      Number(ddmmyyyy[2]) - 1,
      Number(ddmmyyyy[1]),
      0,
      0,
      0
    ));
    if (isNaN(d.getTime())) return value;
    const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    return `${datePart}, ${timePart} UTC`;
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const datePart = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  return `${datePart}, ${timePart} UTC`;
}

export default function RequestDetailPanel({
  request, currentUser,
  expanded,
  processingStatusLabel, overallStatusLabel, overallStatusColor, overallStatusBg,
  requestTypeLabel, requestTypeColor,
  canEdit, canDelete, onEdit, onDelete, onToggleActive, onLinkResources,
}: Props) {
  const { getConfigByLink } = useConfig();

  const commentTags = useMemo(() => {
    const linked = getConfigByLink('request_comment_tag_field');
    if (linked && linked.items.length > 0)
      return linked.items.map(i => ({ value: i.value, label: i.label, color: i.color || 'default' }));
    return DEFAULT_COMMENT_TAGS;
  }, [getConfigByLink]);

  const defaultTag = commentTags[0]?.value || 'General';

  // Audit state
  const [auditLog, setAuditLog]               = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading]       = useState(false);
  const [auditSearch, setAuditSearch]         = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter]     = useState<string | null>(null);

  // Comment state
  const [comments, setComments]               = useState<RequestComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentBody, setNewCommentBody]   = useState('');
  const [newCommentTag, setNewCommentTag]     = useState<string>(defaultTag);
  const [savingComment, setSavingComment]     = useState(false);

  // Linked resources state
  const [linkedResources, setLinkedResources] = useState<LinkedResource[]>([]);
  const [linkedLoading, setLinkedLoading]     = useState(false);

  // Keep tag in sync when config changes
  useEffect(() => {
    if (!commentTags.length) return;
    setNewCommentTag(prev =>
      commentTags.some(t => t.value === prev) ? prev : commentTags[0].value
    );
  }, [commentTags]);

  // Load data
  useEffect(() => {
    if (!request.id) return;
    setAuditLoading(true);
    auditApi.getAuditLog('client_requests', request.id).then(entries => {
      setAuditLog(entries);
      setAuditLoading(false);
    });
    setCommentsLoading(true);
    requestApi.getRequestComments(request.id).then(rows => {
      setComments(rows);
      setCommentsLoading(false);
    });
  }, [request.id]);

  useEffect(() => {
    if (!request.beelineId) return;
    setLinkedLoading(true);
    fetch(`/api/requests/${encodeURIComponent(request.beelineId)}/linked-resources`)
      .then(r => r.json())
      .then(data => { setLinkedResources(data.resources || []); setLinkedLoading(false); })
      .catch(() => setLinkedLoading(false));
  }, [request.beelineId]);

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

  const tagColor = (tagValue: string) =>
    commentTags.find(t => t.value === tagValue)?.color || 'default';

  const handleAddComment = async () => {
    if (!newCommentBody.trim()) return;
    if (!request.id) {
      message.warning('Cannot add comment — this record has not been saved to the database yet. Please reload the page.');
      return;
    }
    setSavingComment(true);
    const bodyText = newCommentBody.trim();
    setNewCommentBody('');
    try {
      const result = await requestApi.addRequestComment(request.id, {
        author: currentUser || 'Unknown',
        tag: newCommentTag,
        body: bodyText,
      });
      if (result.ok) {
        const updated = await requestApi.getRequestComments(request.id);
        setComments(updated);
      } else {
        setNewCommentBody(bodyText);
        message.error(`Failed to save comment: ${result.error || 'Unknown error'}. Please restart the backend server.`);
      }
    } catch (e: unknown) {
      setNewCommentBody(bodyText);
      message.error('Error saving comment. Please try again.');
    } finally {
      setSavingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!request.id) return;
    await requestApi.deleteRequestComment(request.id, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const isActive = request.isActive !== false;
  const typeLabel = requestTypeLabel?.(request.requestType || '') || request.requestType || '';
  const typeColor = requestTypeColor?.(request.requestType || '') || 'default';
  const ovLabel = overallStatusLabel?.(request.overallStatus) || request.overallStatus;
  const ovColor = overallStatusColor?.(request.overallStatus) || '#262626';
  const ovBg = overallStatusBg?.(request.overallStatus) || '#f5f5f5';
  const procLabel = processingStatusLabel?.(request.processingStatus) || request.processingStatus;

  const infoFields: Array<[string, string]> = [
    ['Raised By',        request.raisedBy],
    ['Owner',            request.accountAnchor],
    ['Processing Status', procLabel],
    ['Overall Status',   ovLabel],
    ['Date Raised',      formatLastUpdated(request.dateRaised)],
    ['Last Updated',     formatLastUpdated(request.updatedOn)],
  ];

  // ── Header card ────────────────────────────────────────────────────────────
  const headerCard = (
    <div style={{ background: 'linear-gradient(135deg, #e6f4ff, #f0f5ff)', padding: '12px 14px', borderRadius: 8, border: '1px solid #d6e4ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Tag color={isActive ? 'green' : 'orange'} style={{ fontSize: 10, padding: '0 6px', margin: 0 }}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
        {typeLabel && <Tag color={typeColor} style={{ fontSize: 10, margin: 0 }}>{typeLabel}</Tag>}
        <span style={{ flex: 1 }} />
        {canEdit && (
          <Button
            size="small"
            icon={isActive ? <StopOutlined /> : <CheckCircleOutlined />}
            style={{ fontSize: 10, borderRadius: 6 }}
            onClick={onToggleActive}
          >
            {isActive ? 'Mark Inactive' : 'Mark Active'}
          </Button>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          background: ovBg, color: ovColor,
          padding: '0 6px', borderRadius: 4, fontSize: 10, fontWeight: 500,
          border: `1px solid ${ovColor}33`, lineHeight: '20px', display: 'inline-block',
        }}>
          {ovLabel || '—'}
        </span>
        {procLabel && (
          <span style={{ background: '#f0f0f0', color: '#595959', padding: '0 6px', borderRadius: 4, fontSize: 10, lineHeight: '20px', display: 'inline-block' }}>
            {procLabel}
          </span>
        )}
      </div>
    </div>
  );

  // ── Info grid ──────────────────────────────────────────────────────────────
  const infoGrid = (
    <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '10px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {infoFields.map(([label, value]) => (
          <div key={label}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{label}</Text>
            <Text style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</Text>
          </div>
        ))}
      </div>
      {request.description && (
        <div style={{ marginTop: 10, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 4 }}>Description</Text>
          <Text style={{ fontSize: 12, color: '#262626', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{request.description}</Text>
        </div>
      )}
    </div>
  );

  // ── Audit panel ───────────────────────────────────────────────────────────
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
          style={{ width: 110, fontSize: 11 }} popupMatchSelectWidth={false} />
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
          scroll={{ x: 'max-content', y: 280 }}
          pagination={{ pageSize: 6, size: 'small', showSizeChanger: false }}
          columns={[
            {
              title: 'Field', dataIndex: 'field', minWidth: 130, ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text>,
            },
            {
              title: 'Old', dataIndex: 'old_value', minWidth: 120, ellipsis: true,
              render: (v: string) => {
                const c = cleanVal(v);
                return <Tooltip title={c}><Text style={{ fontSize: 11, color: '#cf1322' }}>{c.slice(0, 22)}{c.length > 22 ? '…' : ''}</Text></Tooltip>;
              },
            },
            {
              title: 'New', dataIndex: 'new_value', minWidth: 120, ellipsis: true,
              render: (v: string) => {
                const c = cleanVal(v);
                return <Tooltip title={c}><Text style={{ fontSize: 11, color: '#389e0d' }}>{c.slice(0, 22)}{c.length > 22 ? '…' : ''}</Text></Tooltip>;
              },
            },
            {
              title: 'By', dataIndex: 'changed_by', minWidth: 80, ellipsis: true,
              render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '—'}</Text>,
            },
            {
              title: 'When', dataIndex: 'changed_at', minWidth: 120,
              render: (v: string) => <Text type="secondary" style={{ fontSize: 10 }}>{formatDate(v)}</Text>,
            },
          ]}
        />
      )}
    </div>
  );

  // ── Comments panel ────────────────────────────────────────────────────────
  const commentsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Add comment form */}
      <div>
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

      {commentsLoading ? (
        <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
      ) : comments.length === 0 ? (
        <Text type="secondary" style={{ fontSize: 11 }}>No comments yet.</Text>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...comments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(c => (
            <div key={c.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="text"
                  size="small"
                  danger
                  style={{ padding: '0 4px', fontSize: 10, height: 18, lineHeight: '18px' }}
                  onClick={() => handleDeleteComment(c.id)}
                >
                  ×
                </Button>
              </div>
              <Text style={{ fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.6, display: 'block', marginBottom: 6 }}>{c.body}</Text>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, borderTop: '1px solid #f5f5f5', paddingTop: 4 }}>
                <Text strong style={{ fontSize: 10, color: '#595959' }}>{c.author}</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>{formatDate(c.created_at)}</Text>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Linked Resources panel ────────────────────────────────────────────────
  const linkedPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {onLinkResources && (
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={onLinkResources}
          style={{ alignSelf: 'flex-start', fontSize: 11, borderRadius: 6 }}
        >
          Link / Manage Resources
        </Button>
      )}
      {linkedLoading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><Spin size="small" /></div>
      ) : linkedResources.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: 12 }}>No resources linked to this Beeline ID yet.</Text>}
          style={{ margin: '16px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{linkedResources.length} resource{linkedResources.length !== 1 ? 's' : ''} linked</Text>
          {linkedResources.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
              <UserOutlined style={{ color: '#1890ff', fontSize: 16 }} />
              <div>
                <Text strong style={{ fontSize: 12 }}>{r.emp_name}</Text>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.ra_id}</Text>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Main layout ───────────────────────────────────────────────────────────
  if (expanded) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        {headerCard}
        {infoGrid}
        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
            <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '4px 12px 12px', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <MessageOutlined style={{ fontSize: 12 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Comments</span>
                {comments.length > 0 && <Badge count={comments.length} style={{ background: '#1890ff', fontSize: 9 }} />}
              </div>
              {commentsPanel}
            </div>
            <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '4px 12px 12px', minHeight: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <TeamOutlined style={{ fontSize: 12 }} />
                <span style={{ fontSize: 12, fontWeight: 600 }}>Linked Resources</span>
                {linkedResources.length > 0 && <Badge count={linkedResources.length} style={{ background: '#52c41a', fontSize: 9 }} />}
              </div>
              {linkedPanel}
            </div>
          </div>
          <div style={{ width: 430, maxWidth: '42%', minWidth: 350, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '4px 12px 12px', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <ClockCircleOutlined style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Audit Trail</span>
              {auditLog.length > 0 && <Badge count={auditLog.length} style={{ background: '#722ed1', fontSize: 9 }} />}
            </div>
            {auditPanel}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      {headerCard}

      {/* Info grid */}
      {infoGrid}

      {/* Tabbed sections */}
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
              key: 'linked',
              label: (
                <Space size={4}>
                  <TeamOutlined style={{ fontSize: 12 }} />
                  <span style={{ fontSize: 12 }}>Linked Resources</span>
                  {linkedResources.length > 0 && <Badge count={linkedResources.length} style={{ background: '#52c41a', fontSize: 9 }} />}
                </Space>
              ),
              children: linkedPanel,
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
