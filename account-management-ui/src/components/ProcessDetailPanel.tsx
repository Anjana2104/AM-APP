/**
 * ProcessDetailPanel.tsx
 * Detail panel for Internal Process records.
 * Mirrors the same look & feel as RequestDetailPanel.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Space, Typography, Tag, Spin, Input, Select, Button, Divider,
  Table, Tooltip, Badge, Tabs, Empty, message,
} from 'antd';
import {
  UserOutlined, LinkOutlined,
  ClockCircleOutlined, MessageOutlined, TeamOutlined,
  PlusOutlined, StopOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import * as processApi from '../api/processApi';
import type { ProcessComment } from '../api/processApi';

const { Text } = Typography;

interface ProcessRow {
  id?: number;
  processId?: string;
  sow: string;
  startDate?: string;
  signedSow?: string;
  piw?: string;
  active?: string;
  salesforceId?: string;
  promsId?: string;
  budget?: string;
  openAirCode?: string;
  eprev?: string;
  comments?: string;
  accountAnchor?: string;
}

interface LinkedResource {
  id: number;
  raId: string;
  empName: string;
  piwRole?: string;
  engagementStartDate?: string;
  engagementEndDate?: string;
}

interface Props {
  row: ProcessRow;
  currentUser?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  linkedResources?: LinkedResource[];
  onEdit?: () => void;
  onToggleActive?: () => void;
  onLinkResources?: () => void;
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

function cleanVal(v: string | null | undefined): string {
  if (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') return '—';
  const s = String(v).trim();
  if (s === 'null' || s === 'undefined') return '—';
  return s;
}

export default function ProcessDetailPanel({
  row, currentUser, canEdit, canDelete, linkedResources = [], onEdit, onToggleActive, onLinkResources,
}: Props) {
  const isActive = row.active === 'Yes';

  // ── Audit state ─────────────────────────────────────────────────────────────
  const [auditLog, setAuditLog]                 = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading]         = useState(false);
  const [auditSearch, setAuditSearch]           = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter]       = useState<string | null>(null);

  // ── Comment state ────────────────────────────────────────────────────────────
  const [comments, setComments]               = useState<ProcessComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentBody, setNewCommentBody]   = useState('');
  const [savingComment, setSavingComment]     = useState(false);

  // Load on mount / record change
  useEffect(() => {
    if (!row.id) return;
    setAuditLoading(true);
    auditApi.getAuditLog('ra_process', row.id).then(entries => {
      setAuditLog(entries);
      setAuditLoading(false);
    });
    setCommentsLoading(true);
    processApi.getComments(row.id).then(list => {
      setComments(list);
      setCommentsLoading(false);
    });
  }, [row.id]);

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
    if (!newCommentBody.trim() || !row.id) return;
    setSavingComment(true);
    const bodyText = newCommentBody.trim();
    setNewCommentBody('');
    const result = await processApi.addComment(row.id, { author: currentUser || 'Unknown', body: bodyText });
    if (result.ok) {
      const updated = await processApi.getComments(row.id);
      setComments(updated);
    } else {
      setNewCommentBody(bodyText);
      message.error(result.error || 'Failed to save comment');
    }
    setSavingComment(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!row.id) return;
    await processApi.deleteComment(row.id, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const infoFields: Array<[string, string | undefined]> = [
    ['Start Date',    row.startDate],
    ['Account Anchor', row.accountAnchor],
    ['Signed SOW',    row.signedSow],
    ['PIW',           row.piw],
    ['Salesforce ID', row.salesforceId],
    ['PROMS ID',      row.promsId],
    ['Budget (INR)',   row.budget],
    ['Eprev',         row.eprev],
    ['OpenAir Code',  row.openAirCode],
  ];

  // ── Header card ─────────────────────────────────────────────────────────────
  const headerCard = (
    <div style={{ background: 'linear-gradient(135deg, #e6f4ff, #f0f5ff)', padding: '12px 14px', borderRadius: 8, border: '1px solid #d6e4ff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        {row.processId && (
          <Tag color="blue" style={{ fontSize: 10, padding: '0 6px', margin: 0, fontWeight: 600 }}>
            {row.processId}
          </Tag>
        )}
        <Tag color={isActive ? 'green' : 'orange'} style={{ fontSize: 10, padding: '0 6px', margin: 0 }}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
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
    </div>
  );

  // ── Info grid ────────────────────────────────────────────────────────────────
  const infoGrid = (
    <div style={{ background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '10px 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {infoFields.filter(([, v]) => v).map(([label, value]) => (
          <div key={label}>
            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{label}</Text>
            <Text style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</Text>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Comments panel ───────────────────────────────────────────────────────────
  const commentsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <Input.TextArea
          size="small" rows={2}
          placeholder="Add a comment…"
          value={newCommentBody}
          onChange={e => setNewCommentBody(e.target.value)}
          style={{ fontSize: 12, marginBottom: 6 }}
          onPressEnter={e => { if (e.shiftKey) return; e.preventDefault(); handleAddComment(); }}
        />
        <Button type="primary" size="small" icon={<PlusOutlined />} loading={savingComment}
          disabled={!newCommentBody.trim()} onClick={handleAddComment} block
          style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>
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
                {canDelete && (
                  <Button type="text" size="small" danger
                    style={{ padding: '0 4px', fontSize: 10, height: 18, lineHeight: '18px' }}
                    onClick={() => handleDeleteComment(c.id)}>×</Button>
                )}
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

  // ── Linked Resources panel ───────────────────────────────────────────────────
  const linkedPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {onLinkResources && (
        <Button size="small" icon={<LinkOutlined />} onClick={onLinkResources}
          style={{ alignSelf: 'flex-start', fontSize: 11, borderRadius: 6 }}>
          Link / Manage Resources
        </Button>
      )}
      {linkedResources.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: 12 }}>No resources linked to this process yet.</Text>}
          style={{ margin: '16px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>{linkedResources.length} resource{linkedResources.length !== 1 ? 's' : ''} linked</Text>
          {linkedResources.map(r => {
            const fmtD = (iso?: string) => {
              if (!iso) return null;
              const d = new Date(iso + 'T00:00:00');
              return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            };
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                <UserOutlined style={{ color: '#1890ff', fontSize: 16, marginTop: 2 }} />
                <div>
                  <Text strong style={{ fontSize: 12 }}>{r.empName}</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{r.raId}{r.piwRole ? ` · ${r.piwRole}` : ''}</Text>
                  {(r.engagementStartDate || r.engagementEndDate) && (
                    <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 2, color: '#1677ff' }}>
                      📅 {fmtD(r.engagementStartDate) || '—'} → {fmtD(r.engagementEndDate) || '—'}
                    </Text>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ── Audit panel ──────────────────────────────────────────────────────────────
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
          size="small" dataSource={filteredAudit} rowKey="id"
          scroll={{ x: 'max-content', y: 280 }}
          pagination={{ pageSize: 6, size: 'small', showSizeChanger: false }}
          columns={[
            { title: 'Field', dataIndex: 'field', minWidth: 130, ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text> },
            { title: 'Old', dataIndex: 'old_value', minWidth: 120, ellipsis: true, render: (v: string) => { const c = cleanVal(v); return <Tooltip title={c}><Text style={{ fontSize: 11, color: '#cf1322' }}>{c.slice(0, 22)}{c.length > 22 ? '…' : ''}</Text></Tooltip>; } },
            { title: 'New', dataIndex: 'new_value', minWidth: 120, ellipsis: true, render: (v: string) => { const c = cleanVal(v); return <Tooltip title={c}><Text style={{ fontSize: 11, color: '#389e0d' }}>{c.slice(0, 22)}{c.length > 22 ? '…' : ''}</Text></Tooltip>; } },
            { title: 'By', dataIndex: 'changed_by', minWidth: 80, ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '—'}</Text> },
            { title: 'When', dataIndex: 'changed_at', minWidth: 120, render: (v: string) => <Text type="secondary" style={{ fontSize: 10 }}>{formatDate(v)}</Text> },
          ]}
        />
      )}
    </div>
  );

  // ── Main layout ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {headerCard}
      {infoGrid}
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
