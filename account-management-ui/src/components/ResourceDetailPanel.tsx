import React, { useEffect, useMemo, useState } from 'react';
import {
  Space, Typography, Tag, Spin, Input, Select, Button, Divider,
  Table, Tooltip, Badge, Tabs,
} from 'antd';
import {
  ClockCircleOutlined, MessageOutlined, PlusOutlined, LinkOutlined, DeleteOutlined, EditOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import * as resourceApi from '../api/resourceApi';
import type { ResourceComment } from '../api/resourceApi';
import * as resourceInsightsApi from '../api/resourceInsightsApi';
import type { InsightEntry } from '../api/resourceInsightsApi';
import type { ResourceRow } from '../types/resource';
import { AllocPctTag } from '../utils/allocUtils';

const { Text, Title } = Typography;

const DEFAULT_COMMENT_TAGS = [
  { value: 'General',      label: 'General',      color: 'default' },
  { value: 'Interactions', label: 'Interactions', color: 'blue' },
  { value: 'Escalations',  label: 'Escalations',  color: 'red' },
  { value: 'Career',       label: 'Career',       color: 'purple' },
  { value: 'Plans',        label: 'Plans',        color: 'green' },
];

interface Props {
  resource: ResourceRow;
  currentUser?: string;
  expanded?: boolean;
  panelOpen?: boolean;  // triggers re-fetch when drawer opens
  onToggleExpand?: () => void;
  onNavigateToRequest?: (beelineId: string) => void;
  onNavigateToInsights?: () => void;
  onNavigateToProcess?: (sowName: string) => void;
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

function ResourceDetailPanel({ resource, currentUser, expanded, panelOpen, onNavigateToRequest, onNavigateToInsights, onNavigateToProcess }: Props) {
  const resourceId = resource.id;
  const commentTags = DEFAULT_COMMENT_TAGS;

  const defaultTag = commentTags[0]?.value || 'General';

  // Audit state
  const [auditLog, setAuditLog]             = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading]     = useState(false);
  const [auditSearch, setAuditSearch]       = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter]   = useState<string | null>(null);

  // Comment state
  const [comments, setComments]             = useState<ResourceComment[]>([]);
  const [insights, setInsights]             = useState<InsightEntry[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newCommentBody, setNewCommentBody] = useState('');
  const [newCommentTag, setNewCommentTag]   = useState<string>(defaultTag);
  const [savingComment, setSavingComment]   = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingBody, setEditingBody]       = useState('');
  const [editingTag, setEditingTag]         = useState('');
  const [savingEdit, setSavingEdit]         = useState(false);

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
    Promise.all([
      resourceApi.getResourceComments(resourceId),
      resourceInsightsApi.getInsights(resourceId),
    ]).then(([cmts, ins]) => {
      setComments(cmts);
      setInsights(ins);
      setCommentsLoading(false);
    });
  }, [resourceId]);

  // Re-fetch comments when user navigates back to this page (comments may have been added in ResourceIntelligence)
  useEffect(() => {
    if (!resourceId) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      Promise.all([
        resourceApi.getResourceComments(resourceId),
        resourceInsightsApi.getInsights(resourceId),
      ]).then(([cmts, ins]) => { setComments(cmts); setInsights(ins); });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [resourceId]);

  // Re-fetch when drawer/panel is opened (panelOpen goes from false → true)
  useEffect(() => {
    if (!resourceId || !panelOpen) return;
    Promise.all([
      resourceApi.getResourceComments(resourceId),
      resourceInsightsApi.getInsights(resourceId),
    ]).then(([cmts, ins]) => { setComments(cmts); setInsights(ins); });
  }, [resourceId, panelOpen]);

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
      const [updated, ins] = await Promise.all([
        resourceApi.getResourceComments(resourceId),
        resourceInsightsApi.getInsights(resourceId),
      ]);
      setComments(updated);
      setInsights(ins);
      setNewCommentBody('');
      setNewCommentTag(commentTags[0]?.value || 'General');
    }
    setSavingComment(false);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!resourceId) return;
    await resourceApi.deleteResourceComment(resourceId, commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const getTagColor = (tagValue: string) => {
    const map: Record<string, string> = { Interactions: 'blue', Escalations: 'red', Career: 'purple', Plans: 'green', General: 'default' };
    return map[tagValue] ?? 'default';
  };

  const startEditComment = (c: ResourceComment) => {
    setEditingCommentId(c.id);
    setEditingBody(c.body);
    setEditingTag(c.tag || 'General');
  };

  const cancelEdit = () => {
    setEditingCommentId(null);
    setEditingBody('');
    setEditingTag('');
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!resourceId || !editingBody.trim()) return;
    setSavingEdit(true);
    const result = await resourceApi.updateResourceComment(resourceId, commentId, { body: editingBody.trim(), tag: editingTag });
    if (result.ok) {
      setComments(prev => prev.map(c => c.id === commentId
        ? { ...c, body: editingBody.trim(), tag: editingTag, updated_at: result.updated_at || new Date().toISOString() }
        : c
      ));
      cancelEdit();
    }
    setSavingEdit(false);
  };

  const formatDate = (iso: string) => {
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const infoFields: Array<[string, string | React.ReactNode]> = [
    ['RA ID', resource.raId],
    ['Email', resource.emailId],
    ['Resource Status', resource.isActive === false ? 'Inactive' : 'Active'],
    ['Role / Domain', resource.roleOrDomain],
    ['Prev Experience', resource.previousWorkex],
    ['Date of Joining', fmtDate(resource.doj)],
    ['Total Experience', resource.totalWorkex],
    ['Engagement', resource.engagement || '—'],
    ['Eng. Start Date', fmtDate(resource.engagementStartDate || '')],
    ['Eng. End Date', fmtDate(resource.engagementEndDate || '')],
    ['Allocation Status', resource.allocationStatus || '—'],
    ['Allocation %', resource.allocationPercentage != null ? <AllocPctTag pct={resource.allocationPercentage} /> : '—'],
    ...(resource.beelineId ? [['Beeline ID', <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: 10, cursor: 'pointer' }} onClick={() => onNavigateToRequest?.(resource.beelineId!)}>{resource.beelineId}</Tag>] as [string, React.ReactNode]] : []),
    ...(resource.sowName ? [['Linked SOW', <Tag icon={<LinkOutlined />} color="green" style={{ fontSize: 10, cursor: 'pointer' }} onClick={() => onNavigateToProcess?.(resource.sowName!)}>{resource.sowName}</Tag>] as [string, React.ReactNode]] : []),
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Space size={6}>
          <MessageOutlined style={{ color: '#1890ff', fontSize: 13 }} />
          <span style={{ fontSize: 11, color: '#595959' }}>
            {commentsLoading ? 'Loading…' : (
              <><strong>{comments.length + insights.length}</strong> comment{comments.length + insights.length !== 1 ? 's' : ''}</>
            )}
          </span>
        </Space>
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
            View in Resources →
          </Button>
        )}
      </div>

      {/* Inline comment list */}
      {commentsLoading ? (
        <div style={{ textAlign: 'center', padding: '12px 0', color: '#bbb', fontSize: 11 }}>Loading comments…</div>
      ) : (comments.length + insights.length) === 0 ? (
        <div style={{ textAlign: 'center', padding: '10px 0', color: '#bbb', fontSize: 11 }}>No comments yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto', paddingRight: 2 }}>
          {/* Merge comments + insights sorted by created_at desc */}
          {[
            ...comments.map(c => ({ type: 'comment' as const, date: c.created_at || '', data: c })),
            ...insights.map(i => ({ type: 'insight' as const, date: i.created_at || '', data: i })),
          ]
            .sort((a, b) => (b.date > a.date ? 1 : -1))
            .map(item => {
              if (item.type === 'insight') {
                const ins = item.data as InsightEntry;
                const sectionLabel: Record<string, string> = {
                  interaction: 'Interactions', escalation: 'Escalations',
                  career_preference: 'Career', plan: 'Plans',
                };
                const sectionColor: Record<string, string> = {
                  interaction: 'blue', escalation: 'red',
                  career_preference: 'purple', plan: 'green',
                };
                return (
                  <div key={`ins-${ins.id}`} style={{ background: '#f6f0ff', border: '1px solid #d9c7ff', borderRadius: 6, padding: '7px 10px', fontSize: 11 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                      <Space size={4}>
                        <Tag color={sectionColor[ins.section] || 'blue'} style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>
                          {sectionLabel[ins.section] || ins.section}
                        </Tag>
                        {ins.tag && ins.tag !== ins.section && (
                          <Tag style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>{ins.tag}</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 10 }}>{ins.author || 'System'}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
                        {ins.created_at ? new Date(ins.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : ''}
                      </Text>
                    </div>
                    {ins.title && <div style={{ fontSize: 11, fontWeight: 500, color: '#4a3580', marginBottom: 2 }}>{ins.title}</div>}
                    <div style={{ fontSize: 11, color: '#333', lineHeight: '1.5', wordBreak: 'break-word' }}>{ins.body}</div>
                  </div>
                );
              }
              const c = item.data as ResourceComment;
              const isOwn = c.author === currentUser;
              const isEditing = editingCommentId === c.id;
              const displayDate = c.updated_at
                ? `Edited ${new Date(c.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`
                : c.created_at ? new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '';
              return (
                <div key={`cmt-${c.id}`} style={{ background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 6, padding: '7px 10px', fontSize: 11 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 3 }}>
                    <Space size={4}>
                      {isEditing
                        ? <Select size="small" value={editingTag} onChange={setEditingTag}
                            options={commentTags.map(t => ({ value: t.value, label: t.label }))}
                            style={{ width: 110, fontSize: 10 }} popupMatchSelectWidth={false} />
                        : <Tag color={getTagColor(c.tag)} style={{ fontSize: 10, margin: 0, padding: '0 5px' }}>{c.tag || 'General'}</Tag>
                      }
                      {(c.source_module === 'stakeholder_escalation' || ((c.tag || '').toLowerCase() === 'escalations' && Boolean(c.reported_by))) ? (
                        <Text type="secondary" style={{ fontSize: 10 }}>
                          By: {c.author || 'Admin'}{c.reported_by ? ` | Reported by: ${c.reported_by}` : ''}
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 10 }}>{c.author || 'System'}</Text>
                      )}
                    </Space>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap', fontStyle: c.updated_at ? 'italic' : 'normal' }}>
                        {displayDate}
                      </Text>
                      {isOwn && !isEditing && (
                        <>
                          <Button type="text" size="small" icon={<EditOutlined />}
                            style={{ fontSize: 10, color: '#1890ff', padding: '0 2px', height: 16 }}
                            onClick={() => startEditComment(c)} />
                          <Button type="text" size="small" icon={<DeleteOutlined />}
                            style={{ fontSize: 10, color: '#ff4d4f', padding: '0 2px', height: 16 }}
                            onClick={() => handleDeleteComment(c.id)} />
                        </>
                      )}
                      {isEditing && (
                        <>
                          <Button type="text" size="small" icon={<CheckOutlined />} loading={savingEdit}
                            style={{ fontSize: 10, color: '#52c41a', padding: '0 2px', height: 16 }}
                            onClick={() => handleSaveEdit(c.id)} />
                          <Button type="text" size="small" icon={<CloseOutlined />}
                            style={{ fontSize: 10, color: '#8c8c8c', padding: '0 2px', height: 16 }}
                            onClick={cancelEdit} />
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing
                    ? <Input.TextArea size="small" rows={2} value={editingBody}
                        onChange={e => setEditingBody(e.target.value)}
                        style={{ fontSize: 11, marginTop: 2 }} autoFocus />
                    : <div style={{ fontSize: 11, color: '#333', lineHeight: '1.5', wordBreak: 'break-word' }}>{c.body}</div>
                  }
                </div>
              );
            })}
        </div>
      )}
    </div>
  );

  // ── Resource Info column ───────────────────────────────────────────────────
  const infoColumn = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header card */}
      <div style={{ background: 'linear-gradient(135deg, #667eea10, #764ba210)', padding: '12px 14px', borderRadius: 8, border: '1px solid #e8eaf0' }}>
        <Title level={5} style={{ margin: '0 0 2px', fontSize: 14 }}>{resource.empName}</Title>
        <Text type="secondary" style={{ fontSize: 11 }}>{resource.piwRole || '—'}</Text>
        <div style={{ marginTop: 6 }}>
          {resource.allocationStatus && (
            <Tag color={
              resource.allocationStatus === 'Joined' ? 'green' :
              resource.allocationStatus === 'On Bench' || resource.allocationStatus === 'Available' ? 'orange' :
              resource.allocationStatus === 'Resigned' ? 'red' : 'blue'
            } style={{ fontSize: 11 }}>
              {resource.allocationStatus}
            </Tag>
          )}
          <Tag color={resource.isActive === false ? 'red' : 'green'} style={{ fontSize: 11 }}>
            {resource.isActive === false ? 'Inactive' : 'Active'}
          </Tag>
          {resource.engagement && resource.engagement !== 'No Value' && (
            <Tag color="purple" style={{ fontSize: 11 }}>{resource.engagement}</Tag>
          )}
        </div>
        {resource.beelineId && (
          <div style={{ marginTop: 6 }}>
            <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onNavigateToRequest?.(resource.beelineId!)}>
              {resource.beelineId}
            </Tag>
          </div>
        )}
        {resource.sowName && (
          <div style={{ marginTop: resource.beelineId ? 4 : 6 }}>
            <Tag icon={<LinkOutlined />} color="green" style={{ fontSize: 10, cursor: 'pointer' }}
              onClick={() => onNavigateToProcess?.(resource.sowName!)}>
              SOW: {resource.sowName}
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
              {typeof value === 'string' || value === undefined || value === null
                ? <Text style={{ fontSize: 12, fontWeight: 500, wordBreak: 'break-all' }}>{(value as string) || '—'}</Text>
                : <div style={{ fontSize: 12, fontWeight: 500 }}>{value}</div>}
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

  // ── EXPANDED layout: Info top + Comments bottom-left + Audit right ────────
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
              <Tag color={resource.isActive === false ? 'red' : 'green'} style={{ fontSize: 11 }}>
                {resource.isActive === false ? 'Inactive' : 'Active'}
              </Tag>
              {resource.engagement && resource.engagement !== 'No Value' && (
                <Tag color="purple" style={{ fontSize: 11 }}>{resource.engagement}</Tag>
              )}
              {resource.beelineId && (
                <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: 10, cursor: 'pointer' }}
                  onClick={() => onNavigateToRequest?.(resource.beelineId!)}>
                  {resource.beelineId}
                </Tag>
              )}
              {resource.sowName && (
                <Tag icon={<LinkOutlined />} color="green" style={{ fontSize: 10, cursor: 'pointer' }}
                  onClick={() => onNavigateToProcess?.(resource.sowName!)}>
                  SOW: {resource.sowName}
                </Tag>
              )}
            </div>
          </div>
          {/* Info fields in a 4-column horizontal grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px 16px' }}>
            {infoFields.map(([label, value]) => (
              <div key={label}>
                <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{label}</Text>
                {typeof value === 'string' || value === undefined || value === null
                  ? <Text style={{ fontSize: 11, fontWeight: 500, wordBreak: 'break-all' }}>{(value as string) || '—'}</Text>
                  : <div style={{ fontSize: 11, fontWeight: 500 }}>{value}</div>}
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

        <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
          <div style={{ flex: 1, minWidth: 0, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', padding: '4px 12px 12px', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MessageOutlined style={{ fontSize: 12 }} />
              <span style={{ fontSize: 12, fontWeight: 600 }}>Comments</span>
              {comments.length > 0 && <Badge count={comments.length} style={{ background: '#1890ff', fontSize: 9 }} />}
            </div>
            {commentsPanel}
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

export default React.memo(ResourceDetailPanel);