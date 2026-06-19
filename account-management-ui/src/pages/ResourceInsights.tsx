/**
 * ResourceInsights.tsx
 * 
 * Resource Intelligence — Analytics and insights for resource utilization,
 * skills distribution, and capacity planning
 * UI Location: Account Operations > Resources > Resource Intelligence
 * Page ID: resources_insights
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Select, Tabs, Button, Modal, Form, Input, Tag, Space, Row, Col,
  Empty, Card, Tooltip, Spin, Typography, Dropdown, message,
  DatePicker, Divider, Alert, Table, Skeleton, Badge,
  Descriptions, Avatar,
} from 'antd';
import {
  MessageOutlined, WarningOutlined, UserOutlined, BulbOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, EllipsisOutlined,
  CalendarOutlined, ThunderboltOutlined, SearchOutlined, FileTextOutlined,
  ClockCircleOutlined, ReloadOutlined, RobotOutlined, CommentOutlined,
  HistoryOutlined, ExpandAltOutlined, ShrinkOutlined, ProjectOutlined,
  DownloadOutlined, AppstoreOutlined, LinkOutlined, FilePdfOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import * as resourceInsightsApi from '../api/resourceInsightsApi';
import type { InsightEntry, CrossSearchInsight } from '../api/resourceInsightsApi';
import * as resourceApi from '../api/resourceApi';
import type { ResourceComment, CrossSearchComment } from '../api/resourceApi';
import * as requestApi from '../api/requestApi';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import * as aiApi from '../api/aiApi';
import type { ResourceRow } from '../types/resource';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import ResourceOverviewCharts from '../components/ResourceOverviewCharts';
import { jsPDF } from 'jspdf';
dayjs.extend(relativeTime);

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// ── Constants ──────────────────────────────────────────────────────────────

const SECTION_META = {
  interaction: {
    label: 'Interactions',
    icon: <MessageOutlined />,
    color: '#1677ff',
    tags: ['Conversation', 'Meeting', 'Call', 'Follow-up', 'Check-in', 'Review'],
  },
  escalation: {
    label: 'Escalations',
    icon: <WarningOutlined />,
    color: '#fa541c',
    tags: ['Client Escalation', 'Internal Escalation', 'Performance Concern', 'Attendance', 'Other'],
  },
  career_preference: {
    label: 'Career',
    icon: <UserOutlined />,
    color: '#722ed1',
    tags: ['Role Preference', 'Location Preference', 'Upskilling Interest', 'Career Goal', 'Notice Period Update', 'Other'],
  },
  plan: {
    label: 'Plans',
    icon: <BulbOutlined />,
    color: '#52c41a',
    tags: ['Deployment Plan', 'Upskilling Plan', 'Retention Plan', 'Transition Plan', 'Bench Strategy', 'Note'],
  },
} as const;

type SectionKey = keyof typeof SECTION_META;

// Tab label → section key map (derived from SECTION_META, no hardcoding)
const LABEL_TO_SECTION: Record<string, SectionKey> = Object.fromEntries(
  (Object.entries(SECTION_META) as [SectionKey, typeof SECTION_META[SectionKey]][])
    .map(([key, meta]) => [meta.label.toLowerCase(), key])
) as Record<string, SectionKey>;

// Pure exact-match: tag must exactly equal a tab label (case-insensitive). Everything else → general.
function resolveCommentSection(tag: string): SectionKey | 'general' {
  if (!tag) return 'general';
  return LABEL_TO_SECTION[tag.toLowerCase()] ?? 'general';
}

const STATUS_COLOR: Record<string, string> = {
  open: 'orange',
  resolved: 'green',
  active: 'blue',
  completed: 'default',
  pending: 'purple',
  closed: 'red',
  achieved: 'cyan',
};

const PRIORITY_COLOR: Record<string, string> = {
  low: 'default',
  medium: 'blue',
  high: 'orange',
  critical: 'red',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  if (!iso) return '—';
  return dayjs(iso).format('DD MMM YYYY');
}

function fmtRelative(iso: string) {
  if (!iso) return '';
  return dayjs(iso).fromNow();
}

// Clean raw DB audit values — strip null strings, parse JSON blobs
function cleanVal(v: string | null | undefined): string {
  if (!v || v === 'null' || v === 'undefined') return '—';
  const s = String(v).trim();
  if (s === 'null' || s === 'undefined' || s === '') return '—';
  try {
    const p = JSON.parse(s);
    if (typeof p === 'string') return p || '—';
    if (typeof p === 'number' || typeof p === 'boolean') return String(p);
    return Object.entries(p as Record<string, unknown>).map(([k, val]) => `${k}: ${val}`).join(', ');
  } catch { return s; }
}

// ── Entry Card ─────────────────────────────────────────────────────────────

interface EntryCardProps {
  entry: InsightEntry;
  onEdit: (entry: InsightEntry) => void;
  onDelete: (id: number) => void;
  canEdit?: boolean;
}

function EntryCard({ entry, onEdit, onDelete, canEdit = true }: EntryCardProps) {
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

// ── Add/Edit Modal ─────────────────────────────────────────────────────────

interface EntryModalProps {
  open: boolean;
  section: SectionKey;
  editing: InsightEntry | null;
  defaultAuthor: string;
  onClose: () => void;
  onSave: (values: Record<string, string>) => Promise<void>;
}

function EntryModal({ open, section, editing, defaultAuthor, onClose, onSave }: EntryModalProps) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const meta = SECTION_META[section];

  useEffect(() => {
    if (open) {
      if (editing) {
        form.setFieldsValue({
          title: editing.title,
          body: editing.body,
          tag: editing.tag,
          status: editing.status,
          priority: editing.priority,
          targetDate: editing.target_date || '',
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ status: 'open', priority: 'medium' });
      }
    }
  }, [open, editing, form]);

  const handleFinish = async (values: Record<string, string>) => {
    setSaving(true);
    await onSave(values);
    setSaving(false);
  };

  const showPriority = section === 'escalation' || section === 'plan';
  const showStatus = section !== 'interaction';
  const showTargetDate = section === 'escalation' || section === 'plan';

  const statusOptions = section === 'career_preference'
    ? ['active', 'achieved', 'pending']
    : ['open', 'resolved', 'closed', 'active', 'completed', 'pending'];

  return (
    <Modal
      title={
        <Space>
          <span style={{ color: meta.color }}>{meta.icon}</span>
          {editing ? `Edit ${meta.label} Entry` : `Add ${meta.label} Entry`}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleFinish} style={{ marginTop: 12 }}>
        <Form.Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: 'Title is required' }]}>
          <Input placeholder="Brief title or subject" />
        </Form.Item>

        <Form.Item name="body" label="Details / Notes" rules={[{ required: true, whitespace: true, message: 'Please enter details or notes' }]}>
          <TextArea rows={3} placeholder="Additional details, context, or notes..." />
        </Form.Item>

        <Row gutter={12}>
          <Col span={showPriority ? 12 : 24}>
            <Form.Item name="tag" label="Tag">
              <Select placeholder="Select tag" allowClear>
                {meta.tags.map(t => <Option key={t} value={t}>{t}</Option>)}
              </Select>
            </Form.Item>
          </Col>
          {showPriority && (
            <Col span={12}>
              <Form.Item name="priority" label="Priority">
                <Select>
                  <Option value="low">Low</Option>
                  <Option value="medium">Medium</Option>
                  <Option value="high">High</Option>
                  <Option value="critical">Critical</Option>
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={12}>
          {showStatus && (
            <Col span={showTargetDate ? 12 : 24}>
              <Form.Item name="status" label="Status">
                <Select>
                  {statusOptions.map(s => <Option key={s} value={s}>{s}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          )}
          {showTargetDate && (
            <Col span={showStatus ? 12 : 24}>
              <Form.Item name="targetDate" label="Target Date">
                <Input type="date" />
              </Form.Item>
            </Col>
          )}
        </Row>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving} style={{ color: '#fff', fontWeight: 600 }}>
            {editing ? 'Save Changes' : 'Add Entry'}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

// ── Comment mini-card (for comments mapped into section tabs) ──────────────

function CommentMiniCard({ comment }: { comment: ResourceComment }) {
  const { getConfigByLink } = useConfig();
  const commentTags = useMemo(() => {
    const linked = getConfigByLink('resource_comment_tag_field');
    if (linked && linked.items.length > 0) return linked.items;
    return [];
  }, [getConfigByLink]);

  const tagLabel = commentTags.find(t => t.value === comment.tag)?.label || comment.tag;
  const tagColor = commentTags.find(t => t.value === comment.tag)?.color || 'default';

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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3, flexWrap: 'wrap' }}>
          {tagLabel && (
            <Tag bordered={false} color={tagColor} style={{ fontSize: 10, padding: '0 5px' }}>{tagLabel}</Tag>
          )}
          <Text strong style={{ fontSize: 11 }}>{comment.author || '—'}</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>{fmtRelative(comment.created_at)}</Text>
        </div>
        <Text style={{ fontSize: 12, color: '#262626' }}>{comment.body}</Text>
      </div>
    </div>
  );
}

// ── Section Tab Content ────────────────────────────────────────────────────

interface SectionTabProps {
  section: SectionKey;
  entries: InsightEntry[];
  linkedComments: ResourceComment[];
  loading: boolean;
  currentUser: string;
  resourceId: number;
  resourceName?: string;
  onRefresh: () => void;
  canEdit?: boolean;
  searchText: string;
}

function SectionTab({ section, entries, linkedComments, loading, currentUser, resourceId, resourceName = '', onRefresh, canEdit = true, searchText }: SectionTabProps) {
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
    const entry = entries.find(e => e.id === id);
    const ok = await resourceInsightsApi.deleteInsight(id);
    if (ok) {
      message.success('Entry deleted');
      // Log deletion to audit trail
      if (entry) {
        await auditApi.addAuditLog({
          module: 'resources',
          record_id: resourceId,
          record_name: resourceName,
          field: `${section.charAt(0).toUpperCase() + section.slice(1).replace('_', ' ')} Entry Deleted`,
          old_value: [entry.title, entry.body, entry.tag].filter(Boolean).join(' | '),
          new_value: '',
          changed_by: currentUser,
        });
      }
      onRefresh();
    } else {
      message.error('Failed to delete');
    }
  }, [entries, onRefresh, resourceId, resourceName, section, currentUser]);

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
              {linkedComments.map(c => <CommentMiniCard key={c.id} comment={c} />)}
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

// ── Main Page ──────────────────────────────────────────────────────────────

interface ResourceInsightsProps {
  resources?: ResourceRow[];
  onNavigate?: (page: string, raId?: string) => void;
  onNavigateWithFilter?: (type: string, value: string) => void;
  onNavigateToRequest?: (beelineId: string) => void;
  onNavigateToProcess?: (sowName: string) => void;
}

export default function ResourceInsights({ resources: propResources = [], onNavigate, onNavigateWithFilter, onNavigateToRequest, onNavigateToProcess }: ResourceInsightsProps) {
  const { currentUser } = useAuth();
  const defaultAuthor = currentUser?.username || '';

  const [resources, setResources] = useState<ResourceRow[]>(propResources);
  const [exportingPdf, setExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    if (!selectedResource) return;
    setExportingPdf(true);
    try {
      // Fetch audit log fresh (may not be loaded yet if modal hasn't been opened)
      const auditEntries = auditLog.length > 0
        ? auditLog
        : await auditApi.getAuditLog('resources', selectedResource.id);

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const margin = 14;
      const colW = pageW - margin * 2;
      let y = margin;

      const addPageIfNeeded = (needed = 8) => {
        if (y + needed > 280) { pdf.addPage(); y = margin; }
      };

      const drawSection = (title: string) => {
        addPageIfNeeded(12);
        pdf.setFillColor(30, 64, 175);
        pdf.roundedRect(margin, y, colW, 7, 1.5, 1.5, 'F');
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title.toUpperCase(), margin + 3, y + 5);
        y += 10;
        pdf.setTextColor(50, 50, 50);
      };

      const drawRow = (label: string, value: string) => {
        addPageIfNeeded(7);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(100, 100, 100);
        pdf.text(label + ':', margin + 2, y);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 30, 30);
        const lines = pdf.splitTextToSize(value || '—', colW - 52);
        pdf.text(lines, margin + 50, y);
        y += Math.max(6, lines.length * 5);
      };

      // ── Header ──────────────────────────────────────────────
      pdf.setFillColor(245, 247, 255);
      pdf.rect(0, 0, pageW, 22, 'F');
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(30, 64, 175);
      pdf.text(selectedResource.empName || '—', margin, 12);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text(`RA ID: ${selectedResource.raId || '—'}   |   Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, margin, 19);
      pdf.setDrawColor(200, 200, 230);
      pdf.line(margin, 22, pageW - margin, 22);
      y = 28;

      // ── Basic Info ──────────────────────────────────────────
      drawSection('Basic Information');
      drawRow('Name', selectedResource.empName || '—');
      drawRow('RA ID', selectedResource.raId || '—');
      drawRow('Email', selectedResource.emailId || '—');
      drawRow('Role', selectedResource.piwRole || selectedResource.roleOrDomain || '—');
      drawRow('Experience', selectedResource.totalWorkex || '—');
      drawRow('Date of Joining', selectedResource.doj ? fmtDate(selectedResource.doj) : '—');
      y += 2;

      // ── Engagement ──────────────────────────────────────────
      drawSection('Current Engagement');
      drawRow('Engagement', (selectedResource.engagement && selectedResource.engagement !== 'undefined') ? selectedResource.engagement : '—');
      drawRow('Start Date', selectedResource.engagementStartDate ? fmtDate(selectedResource.engagementStartDate) : '—');
      drawRow('End Date', selectedResource.engagementEndDate ? fmtDate(selectedResource.engagementEndDate) : '—');
      drawRow('Allocation Status', selectedResource.allocationStatus || '—');
      drawRow('Beeline ID', selectedResource.beelineId || '—');
      drawRow('Linked SOW', selectedResource.sowName || '—');
      y += 2;

      // ── Skills ──────────────────────────────────────────────
      if (selectedResource.skills) {
        drawSection('Skills');
        const skills = selectedResource.skills.split(',').map(s => s.trim()).filter(Boolean);
        addPageIfNeeded(8);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(30, 30, 30);
        const lines = pdf.splitTextToSize(skills.join('  •  '), colW - 4);
        pdf.text(lines, margin + 2, y);
        y += lines.length * 5 + 4;
      }

      // ── Audit Log ────────────────────────────────────────────
      if (auditEntries.length > 0) {
        drawSection('Audit Log');
        auditEntries.forEach(e => {
          addPageIfNeeded(10);
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(50, 50, 50);
          const fieldText = String(e.field || '—');
          pdf.text(fieldText, margin + 2, y);
          y += 5;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7.5);
          // Old value
          pdf.setTextColor(150, 0, 0);
          const oldVal = String(e.old_value || '—');
          const oldLines = pdf.splitTextToSize(`Before: ${oldVal}`, colW - 4);
          pdf.text(oldLines.slice(0, 2), margin + 2, y);
          y += oldLines.slice(0, 2).length * 4;
          // New value
          pdf.setTextColor(0, 120, 0);
          const newVal = String(e.new_value || '—');
          const newLines = pdf.splitTextToSize(`After: ${newVal}`, colW - 4);
          pdf.text(newLines.slice(0, 2), margin + 2, y);
          y += newLines.slice(0, 2).length * 4;
          // Meta
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(140, 140, 140);
          const when = (() => { try { return new Date(e.changed_at).toLocaleString('en-GB'); } catch { return e.changed_at; } })();
          pdf.text(`By ${e.changed_by || '—'}  ·  ${when}`, margin + 2, y);
          y += 5;
          pdf.setDrawColor(230, 230, 230);
          pdf.line(margin, y - 1, pageW - margin, y - 1);
        });
      }

      // ── Recent Log Entries ───────────────────────────────────
      const recent = [...entries].sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()).slice(0, 10);
      if (recent.length > 0) {
        drawSection('Recent Log Entries (last 10)');
        recent.forEach(e => {
          addPageIfNeeded(14);
          const meta = SECTION_META[e.section as keyof typeof SECTION_META];
          pdf.setFontSize(8);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(30, 64, 175);
          pdf.text(`[${meta?.label || e.section}]  ${e.title || ''}`, margin + 2, y);
          y += 5;
          if (e.body) {
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(60, 60, 60);
            const bodyLines = pdf.splitTextToSize(e.body, colW - 4);
            const clipped = bodyLines.slice(0, 3);
            pdf.text(clipped, margin + 2, y);
            y += clipped.length * 4.5;
            if (bodyLines.length > 3) { pdf.setTextColor(130, 130, 130); pdf.text('...', margin + 2, y); y += 4; }
          }
          pdf.setFontSize(7);
          pdf.setFont('helvetica', 'italic');
          pdf.setTextColor(140, 140, 140);
          pdf.text(`${e.author || '—'}  ·  ${fmtDate(e.created_at)}`, margin + 2, y);
          y += 6;
          pdf.setDrawColor(230, 230, 230);
          pdf.line(margin, y - 1, pageW - margin, y - 1);
        });
      }

      const name = (selectedResource.empName || selectedResource.raId || 'resource').replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`${name}_Details.pdf`);
    } catch (e) {
      message.error('PDF export failed');
      console.error(e);
    } finally {
      setExportingPdf(false);
    }
  };

  // Beeline linking state
  const [beelineLinkModal, setBeelineLinkModal] = useState<{ open: boolean; resource: ResourceRow | null }>({ open: false, resource: null });
  const [selectedBeelineId, setSelectedBeelineId] = useState('');
  const [beelineRequestOptions, setBeelineRequestOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [beelineSaving, setBeelineSaving] = useState(false);

  const openBeelineLinkModal = async (resource: ResourceRow) => {
    setSelectedBeelineId(resource.beelineId || '');
    setBeelineLinkModal({ open: true, resource });
    try {
      const activeReqs = await requestApi.getActiveRequests();
      setBeelineRequestOptions(activeReqs.filter(r => r.beelineId).map(r => ({ value: r.beelineId, label: r.beelineId })));
    } catch { /* ignore */ }
  };

  const saveBeelineLink = async () => {
    const resource = beelineLinkModal.resource;
    if (!resource) return;
    setBeelineSaving(true);
    const ok = await resourceApi.setBeelineLink(resource.id, selectedBeelineId, currentUser?.username || 'system');
    setBeelineSaving(false);
    if (ok) {
      setResources(prev => prev.map(r => r.key === resource.key ? { ...r, beelineId: selectedBeelineId } : r));
      message.success('Beeline ID linked successfully');
      setBeelineLinkModal({ open: false, resource: null });
    } else {
      message.error('Failed to save Beeline link');
    }
  };

  // Persist selected resource across in-app navigation using sessionStorage
  const [selectedResourceId, setSelectedResourceId] = useState<number | null>(() => {
    try {
      const saved = sessionStorage.getItem('resource_insights_selected_id');
      return saved ? Number(saved) : null;
    } catch { return null; }
  });
  const [globalSearch, setGlobalSearch] = useState('');

  // Cross-resource search state
  const [crossSearch, setCrossSearch] = useState('');
  const [crossSearchResults, setCrossSearchResults] = useState<{
    insights: CrossSearchInsight[];
    comments: CrossSearchComment[];
  } | null>(null);
  const [crossSearchLoading, setCrossSearchLoading] = useState(false);

  // Debounced cross-resource search
  useEffect(() => {
    if (!crossSearch || crossSearch.trim().length < 2) {
      setCrossSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCrossSearchLoading(true);
      const [insights, comments] = await Promise.all([
        resourceInsightsApi.searchInsightsAcrossResources(crossSearch),
        resourceApi.searchCommentsAcrossResources(crossSearch),
      ]);
      setCrossSearchResults({ insights, comments });
      setCrossSearchLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [crossSearch]);

  const handleSelectResource = (id: number | null) => {
    setSelectedResourceId(id);
    setActiveTab('interaction');
    setGlobalSearch('');
    try {
      sessionStorage.setItem('resource_insights_tab', 'interaction');
      if (id) sessionStorage.setItem('resource_insights_selected_id', String(id));
      else sessionStorage.removeItem('resource_insights_selected_id');
    } catch { /* ignore */ }
  };

  const [entries, setEntries] = useState<InsightEntry[]>([]);
  const [resourceComments, setResourceComments] = useState<ResourceComment[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try { return sessionStorage.getItem('resource_insights_tab') || 'interaction'; } catch { return 'interaction'; }
  });

  // Audit modal state
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter] = useState<string | null>(null);

  // Always fetch fresh from DB on mount to ensure beelineId is populated from DB.
  // propResources is used as a fallback trigger (e.g. after an update in ResourceInformation).
  useEffect(() => {
    resourceApi.getResources().then(({ resources: rows }) => {
      if (rows.length === 0 && propResources.length > 0) {
        // Server offline — use prop data as fallback
        setResources(propResources);
        return;
      }
      const mapped: ResourceRow[] = rows.map((r: any, i: number) => ({
        key: String(r.id || i),
        id: r.id,
        sno: String(r.sno || i + 1),
        raId: String(r.ra_id || r.raId || ''),
        empName: String(r.emp_name || r.empName || ''),
        emailId: String(r.email_id || r.emailId || ''),
        piwRole: String(r.piw_role || r.piwRole || ''),
        roleOrDomain: String(r.role_or_domain || r.roleOrDomain || ''),
        previousWorkex: String(r.previous_workex || r.previousWorkex || ''),
        doj: String(r.doj || ''),
        totalWorkex: String(r.total_workex || r.totalWorkex || ''),
        skills: String(r.skills || ''),
        engagement: String(r.engagement || ''),
        allocationStatus: String(r.allocation_status || r.allocationStatus || ''),
        beelineId: String(r.beeline_id || r.beelineId || ''),
        engagementStartDate: String(r.engagement_start_date || r.engagementStartDate || ''),
        engagementEndDate: String(r.engagement_end_date || r.engagementEndDate || ''),
        sowName: String(r.sow_name || r.sowName || ''),
      }));
      setResources(mapped);
      // If selected resource was deleted, clear it
      if (selectedResourceId && !mapped.find(r => r.id === selectedResourceId)) {
        setSelectedResourceId(null);
        setEntries([]);
        setResourceComments([]);
        try { sessionStorage.removeItem('resource_insights_selected_id'); } catch { /* ignore */ }
      }
    }).catch(() => {
      // Server error — fall back to prop data
      if (propResources.length > 0) setResources(propResources);
    });
  // Re-run when propResources changes (e.g. after a save in ResourceInformation)
  }, [propResources]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedResource = useMemo(
    () => resources.find(r => r.id === selectedResourceId) || null,
    [resources, selectedResourceId]
  );

  const loadData = useCallback(async (resourceId: number) => {
    setLoadingEntries(true);
    const [allEntries, allComments] = await Promise.all([
      resourceInsightsApi.getInsights(resourceId),
      resourceApi.getResourceComments(resourceId),
    ]);
    setEntries(allEntries);
    setResourceComments(allComments);
    setLoadingEntries(false);
  }, []);

  // Refresh when resource changes
  useEffect(() => {
    if (selectedResourceId) loadData(selectedResourceId);
    else { setEntries([]); setResourceComments([]); }
  }, [selectedResourceId, loadData]);

  // Auto-refresh when user navigates back to this page (comments may have been added elsewhere)
  useEffect(() => {
    const onVisible = async () => {
      if (document.visibilityState !== 'visible') return;
      // Re-fetch resources to catch deletions from other tabs
      const { resources: rows } = await resourceApi.getResources().catch(() => ({ resources: [] }));
      const mapped: ResourceRow[] = rows.map((r: any, i: number) => ({
        key: String(r.id || i), id: r.id, sno: String(r.sno || i + 1),
        raId: String(r.ra_id || r.raId || ''), empName: String(r.emp_name || r.empName || ''),
        emailId: String(r.email_id || r.emailId || ''), piwRole: String(r.piw_role || r.piwRole || ''),
        roleOrDomain: String(r.role_or_domain || r.roleOrDomain || ''),
        previousWorkex: String(r.previous_workex || r.previousWorkex || ''),
        doj: String(r.doj || ''), totalWorkex: String(r.total_workex || r.totalWorkex || ''),
        skills: String(r.skills || ''), engagement: String(r.engagement || ''),
        allocationStatus: String(r.allocation_status || r.allocationStatus || ''),
        beelineId: String(r.beeline_id || r.beelineId || ''),
        engagementStartDate: String(r.engagement_start_date || r.engagementStartDate || ''),
        engagementEndDate: String(r.engagement_end_date || r.engagementEndDate || ''),
        sowName: String(r.sow_name || r.sowName || ''),
      }));
      if (rows.length > 0) setResources(mapped);
      if (selectedResourceId) {
        const still = mapped.find(r => r.id === selectedResourceId);
        if (!still) {
          // Resource was deleted — clear selection
          setSelectedResourceId(null);
          setEntries([]);
          setResourceComments([]);
          try { sessionStorage.removeItem('resource_insights_selected_id'); } catch { /* ignore */ }
        } else {
          loadData(selectedResourceId);
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [selectedResourceId, loadData]);

  // Derived counts — combined from insight entries + mapped comments

  const sectionEntries = useMemo(() => {
    const m: Record<string, InsightEntry[]> = {
      interaction: [], escalation: [], career_preference: [], plan: [],
    };
    entries.forEach(e => { if (m[e.section]) m[e.section].push(e); });
    return m;
  }, [entries]);

  // Map resource comments to insight sections using fuzzy keyword matching
  const commentsBySection = useMemo(() => {
    const m: Record<string, ResourceComment[]> = {
      interaction: [], escalation: [], career_preference: [], plan: [], general: [],
    };
    resourceComments.forEach(c => {
      const section = resolveCommentSection(c.tag || '');
      (m[section] = m[section] || []).push(c);
    });
    return m;
  }, [resourceComments]);

  // Combined counts (insight entries + comments per section) for tile display
  const combinedCounts = useMemo(() => ({
    interaction:       (sectionEntries.interaction?.length       || 0) + (commentsBySection.interaction?.length       || 0),
    escalation:        (sectionEntries.escalation?.length        || 0) + (commentsBySection.escalation?.length        || 0),
    career_preference: (sectionEntries.career_preference?.length || 0) + (commentsBySection.career_preference?.length || 0),
    plan:              (sectionEntries.plan?.length              || 0) + (commentsBySection.plan?.length              || 0),
  }), [sectionEntries, commentsBySection]);


  const handleRefresh = useCallback(() => {
    if (selectedResourceId) loadData(selectedResourceId);
  }, [selectedResourceId, loadData]);

  const openAuditModal = useCallback(async () => {
    if (!selectedResourceId) return;
    setAuditModalOpen(true);
    setAuditLoading(true);
    const entries = await auditApi.getAuditLog('resources', selectedResourceId);
    setAuditLog(entries);
    setAuditLoading(false);
  }, [selectedResourceId]);

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

  // Skills as array
  const skillsList = useMemo(() => {
    if (!selectedResource?.skills) return [];
    return selectedResource.skills.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
  }, [selectedResource]);

  // ── Log Summary state (lifted from SectionTab) ───────────────────────────
  const [summaryModal, setSummaryModal] = useState(false);
  const [summaryRange, setSummaryRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const summaryEntries = useMemo(() => {
    const [from, to] = summaryRange;
    if (!from || !to) return [];
    const inRange = (iso: string) => {
      const d = dayjs(iso);
      return d.isAfter(from.startOf('day').subtract(1, 'ms')) && d.isBefore(to.endOf('day').add(1, 'ms'));
    };
    const isSection = activeTab in SECTION_META;
    // Insight entries pool
    const entryPool = isSection ? (sectionEntries[activeTab as SectionKey] || []) : [...entries];
    const filteredInsights = entryPool.filter(e => inRange(e.created_at));
    // Comments pool — adapt to InsightEntry shape for unified display & AI summary
    const commentPool = isSection
      ? (commentsBySection[activeTab as SectionKey] || [])
      : resourceComments;
    const filteredComments: InsightEntry[] = commentPool
      .filter(c => inRange(c.created_at))
      .map(c => ({
        id: -(c.id),           // negative id to avoid collision with insights
        resource_id: c.resource_id,
        section: (isSection ? activeTab : 'interaction') as InsightEntry['section'],
        title: c.tag || 'Comment',
        body: c.body,
        tag: c.tag,
        status: '',
        priority: '',
        target_date: null,
        author: c.author,
        created_at: c.created_at,
        updated_at: c.created_at,
      }));
    return [...filteredInsights, ...filteredComments].sort((a, b) =>
      dayjs(b.created_at).unix() - dayjs(a.created_at).unix()
    );
  }, [sectionEntries, entries, commentsBySection, resourceComments, activeTab, summaryRange]);

  // ── Rule-based local summary (no API key required) ───────────────────────
  const generateLocalSummary = useCallback((entries: InsightEntry[], from?: string, to?: string): string => {
    if (!entries.length) return 'No entries in the selected period.';

    const period = (from && to) ? `${from} – ${to}` : 'the selected period';
    const total = entries.length;

    // Section counts
    const sectionCount: Record<string, number> = {};
    entries.forEach(e => { sectionCount[e.section] = (sectionCount[e.section] || 0) + 1; });

    // Tag frequency
    const tagCount: Record<string, number> = {};
    entries.forEach(e => { if (e.tag) tagCount[e.tag] = (tagCount[e.tag] || 0) + 1; });
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 4);

    // Authors
    const authors = Array.from(new Set(entries.map(e => e.author).filter(Boolean)));

    // Build section breakdown text
    const sectionLabels: Record<string, string> = {
      interaction: 'Interaction', escalation: 'Escalation',
      career_preference: 'Career Preference', plan: 'Plan', general: 'Comment',
    };
    const sectionBreakdown = Object.entries(sectionCount)
      .sort((a, b) => b[1] - a[1])
      .map(([s, n]) => `${n} ${sectionLabels[s] || s}${n > 1 ? 's' : ''}`)
      .join(', ');

    // Escalation highlight
    const escalations = entries.filter(e => e.section === 'escalation');
    const openEscalations = escalations.filter(e => e.status === 'open' || !e.status);

    // Career preferences
    const careerEntries = entries.filter(e => e.section === 'career_preference');

    // Plans
    const planEntries = entries.filter(e => e.section === 'plan');

    // Key tags sentence
    const tagSentence = topTags.length
      ? `Most frequent topics: ${topTags.map(([t, n]) => `${t} (${n})`).join(', ')}.`
      : '';

    // Build narrative
    const lines: string[] = [];
    lines.push(`## Period: ${period}`);
    lines.push('');
    lines.push(`## Overview`);
    lines.push(`- ${total} log entr${total > 1 ? 'ies' : 'y'} recorded: ${sectionBreakdown}.`);
    if (authors.length) lines.push(`- Logged by: ${authors.join(', ')}.`);
    if (tagSentence) lines.push(`- ${tagSentence}`);

    if (escalations.length > 0) {
      lines.push('');
      lines.push('## Escalations');
      lines.push(`- ${escalations.length} escalation${escalations.length > 1 ? 's' : ''} recorded in this period.`);
      if (openEscalations.length > 0)
        lines.push(`- ${openEscalations.length} escalation${openEscalations.length > 1 ? 's' : ''} currently open — follow-up recommended.`);
      else
        lines.push(`- All escalations resolved/closed in this period.`);
      escalations.forEach(e => { if (e.title) lines.push(`  • ${e.title}${e.body ? ': ' + e.body.slice(0, 80) + (e.body.length > 80 ? '…' : '') : ''}`); });
    }

    if (careerEntries.length > 0) {
      lines.push('');
      lines.push('## Career & Preferences');
      lines.push(`- ${careerEntries.length} career preference note${careerEntries.length > 1 ? 's' : ''} logged.`);
      careerEntries.forEach(e => { if (e.title) lines.push(`  • ${e.title}${e.body ? ': ' + e.body.slice(0, 80) + (e.body.length > 80 ? '…' : '') : ''}`); });
    }

    if (planEntries.length > 0) {
      lines.push('');
      lines.push('## Plans & Actions');
      lines.push(`- ${planEntries.length} plan${planEntries.length > 1 ? 's' : ''} recorded.`);
      planEntries.forEach(e => { if (e.title) lines.push(`  • ${e.title}${e.body ? ': ' + e.body.slice(0, 80) + (e.body.length > 80 ? '…' : '') : ''}`); });
    }

    lines.push('');
    lines.push('## Recommendation');
    if (openEscalations.length > 0)
      lines.push(`- Address ${openEscalations.length} open escalation${openEscalations.length > 1 ? 's' : ''} at the earliest.`);
    if (careerEntries.length > 0)
      lines.push(`- Review career preferences and align next engagement accordingly.`);
    if (planEntries.length > 0)
      lines.push(`- Follow up on planned actions to ensure timely execution.`);
    if (!openEscalations.length && !careerEntries.length && !planEntries.length)
      lines.push(`- ${total} interaction${total > 1 ? 's' : ''} logged — continue regular connect cadence.`);

    return lines.join('\n');
  }, []);

  const handleGenerateAiSummary = useCallback(async () => {
    if (!summaryEntries.length) return;
    setAiLoading(true); setAiError(''); setAiSummary('');
    const [from, to] = summaryRange;
    const result = await aiApi.summarizeInteractions(
      summaryEntries.map(e => ({ title: e.title, body: e.body, tag: e.tag, author: e.author, created_at: e.created_at })),
      from?.format('DD MMM YYYY'), to?.format('DD MMM YYYY'),
    );
    if (result.ok && result.summary) {
      setAiSummary(result.summary);
    } else if (result.error?.includes('API key') || result.error?.includes('not configured')) {
      // Fall back to local rule-based summary
      const local = generateLocalSummary(summaryEntries, from?.format('DD MMM YYYY'), to?.format('DD MMM YYYY'));
      setAiSummary(local);
      setAiError('');
    } else {
      setAiError(result.error || 'Failed to generate summary');
    }
    setAiLoading(false);
  }, [summaryEntries, summaryRange, generateLocalSummary]);

  // Unified cross-tab search results (when globalSearch is active)
  const SECTION_KEYS: SectionKey[] = ['interaction', 'escalation', 'career_preference', 'plan'];
  const searchResults = useMemo(() => {
    const q = globalSearch.toLowerCase().trim();
    if (!q) return null;
    const matchEntry = (e: InsightEntry) =>
      (e.title || '').toLowerCase().includes(q) ||
      (e.body || '').toLowerCase().includes(q) ||
      (e.tag || '').toLowerCase().includes(q) ||
      (e.author || '').toLowerCase().includes(q);
    const matchComment = (c: ResourceComment) =>
      (c.body || '').toLowerCase().includes(q) ||
      (c.tag || '').toLowerCase().includes(q) ||
      (c.author || '').toLowerCase().includes(q);
    const groups: Array<{ section: SectionKey; entries: InsightEntry[]; comments: ResourceComment[] }> = [];
    SECTION_KEYS.forEach(sec => {
      const es = (sectionEntries[sec] || []).filter(matchEntry);
      const cs = (commentsBySection[sec] || []).filter(matchComment);
      if (es.length > 0 || cs.length > 0) groups.push({ section: sec, entries: es, comments: cs });
    });
    const generalComments = (commentsBySection.general || []).filter(matchComment);
    const total = groups.reduce((s, g) => s + g.entries.length + g.comments.length, 0) + generalComments.length;
    return { groups, generalComments, total };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSearch, sectionEntries, commentsBySection]);

  const tabItems = [
    {
      key: 'interaction',
      label: (
        <Badge count={combinedCounts.interaction} size="small" style={{ background: SECTION_META.interaction.color }}>
          <Space size={4} style={{ paddingRight: combinedCounts.interaction > 0 ? 6 : 0 }}>
            <MessageOutlined style={{ color: SECTION_META.interaction.color }} />
            <span style={{ fontSize: 12 }}>Interactions</span>
          </Space>
        </Badge>
      ),
      children: (
        <SectionTab
          section="interaction"
          entries={sectionEntries.interaction}
          linkedComments={commentsBySection.interaction || []}
          loading={loadingEntries}
          currentUser={defaultAuthor}
          resourceId={selectedResourceId!}
          resourceName={selectedResource?.empName}
          onRefresh={handleRefresh}
          searchText={globalSearch}
        />
      ),
    },
    {
      key: 'escalation',
      label: (
        <Badge count={combinedCounts.escalation} size="small" style={{ background: SECTION_META.escalation.color }}>
          <Space size={4} style={{ paddingRight: combinedCounts.escalation > 0 ? 6 : 0 }}>
            <WarningOutlined style={{ color: SECTION_META.escalation.color }} />
            <span style={{ fontSize: 12 }}>Escalations</span>
          </Space>
        </Badge>
      ),
      children: (
        <SectionTab
          section="escalation"
          entries={sectionEntries.escalation}
          linkedComments={commentsBySection.escalation || []}
          loading={loadingEntries}
          currentUser={defaultAuthor}
          resourceId={selectedResourceId!}
          resourceName={selectedResource?.empName}
          onRefresh={handleRefresh}
          searchText={globalSearch}
        />
      ),
    },
    {
      key: 'career_preference',
      label: (
        <Badge count={combinedCounts.career_preference} size="small" style={{ background: SECTION_META.career_preference.color }}>
          <Space size={4} style={{ paddingRight: combinedCounts.career_preference > 0 ? 6 : 0 }}>
            <UserOutlined style={{ color: SECTION_META.career_preference.color }} />
            <span style={{ fontSize: 12 }}>Career</span>
          </Space>
        </Badge>
      ),
      children: (
        <SectionTab
          section="career_preference"
          entries={sectionEntries.career_preference}
          linkedComments={commentsBySection.career_preference || []}
          loading={loadingEntries}
          currentUser={defaultAuthor}
          resourceId={selectedResourceId!}
          resourceName={selectedResource?.empName}
          onRefresh={handleRefresh}
          searchText={globalSearch}
        />
      ),
    },
    {
      key: 'plan',
      label: (
        <Badge count={combinedCounts.plan} size="small" style={{ background: SECTION_META.plan.color }}>
          <Space size={4} style={{ paddingRight: combinedCounts.plan > 0 ? 6 : 0 }}>
            <BulbOutlined style={{ color: SECTION_META.plan.color }} />
            <span style={{ fontSize: 12 }}>Plans</span>
          </Space>
        </Badge>
      ),
      children: (
        <SectionTab
          section="plan"
          entries={sectionEntries.plan}
          linkedComments={commentsBySection.plan || []}
          loading={loadingEntries}
          currentUser={defaultAuthor}
          resourceId={selectedResourceId!}
          resourceName={selectedResource?.empName}
          onRefresh={handleRefresh}
          searchText={globalSearch}
        />
      ),
    },
    {
      key: 'general',
      label: (
        <Badge count={commentsBySection.general?.length || 0} size="small" style={{ background: '#8c8c8c' }}>
          <Space size={4} style={{ paddingRight: (commentsBySection.general?.length || 0) > 0 ? 6 : 0 }}>
            <CommentOutlined style={{ color: '#8c8c8c' }} />
            <span style={{ fontSize: 12 }}>General</span>
          </Space>
        </Badge>
      ),
      children: (
        <div style={{ paddingTop: 4 }}>
          {(commentsBySection.general || []).length === 0 ? (
            <Empty description="No general comments" style={{ margin: '32px 0' }} imageStyle={{ height: 40 }} />
          ) : (
            (commentsBySection.general || []).map(c => <CommentMiniCard key={c.id} comment={c} />)
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 20px', background: '#f5f7fa', minHeight: '100vh' }}>

      {/* ── Outer Sub-tabs: Individual Resource / All Resources ── */}
      <Tabs
        defaultActiveKey="individual"
        size="small"
        style={{ background: '#fff', borderRadius: 10, padding: '0 12px', border: '1px solid #e8eaf0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        items={[
          {
            key: 'individual',
            label: <span style={{ fontSize: 12 }}><UserOutlined /> Individual Resource</span>,
            children: (
              <div style={{ paddingBottom: 8 }}>
                <div style={{ marginBottom: 10, color: '#8c8c8c', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ThunderboltOutlined style={{ color: '#1677ff', fontSize: 11 }} />
                  Track interactions, escalations, career preferences and plans per resource
                </div>

      {/* ── Cross-Resource Search (above resource picker) ── */}
      <Card
        size="small"
        style={{ marginBottom: 10, borderRadius: 10, border: '1px solid #e8eaf0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        bodyStyle={{ padding: '10px 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SearchOutlined style={{ color: '#1677ff', fontSize: 13, flexShrink: 0 }} />
          <Text style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', color: '#595959' }}>
            Search all resources:
          </Text>
          <Input
            size="small"
            allowClear
            placeholder="Type anything — searches insights & comments across all resources…"
            value={crossSearch}
            onChange={e => { setCrossSearch(e.target.value); if (!e.target.value) setCrossSearchResults(null); }}
            style={{ flex: 1, fontSize: 11 }}
            suffix={crossSearchLoading ? <Spin size="small" /> : undefined}
          />
          {crossSearchResults && (
            <Badge
              count={crossSearchResults.insights.length + crossSearchResults.comments.length}
              style={{ background: '#1677ff' }}
              showZero
              overflowCount={99}
            />
          )}
        </div>

        {/* Results grouped by resource */}
        {crossSearchResults && (crossSearchResults.insights.length > 0 || crossSearchResults.comments.length > 0) && (
          <div style={{ marginTop: 10, maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
            {(() => {
              const byResource: Record<number, { empName: string; raId: string; allocationStatus?: string; engagement?: string; insights: CrossSearchInsight[]; comments: CrossSearchComment[] }> = {};
              crossSearchResults.insights.forEach(r => {
                if (!byResource[r.resource_id]) byResource[r.resource_id] = { empName: r.emp_name, raId: r.ra_id, allocationStatus: r.allocation_status, engagement: r.engagement, insights: [], comments: [] };
                byResource[r.resource_id].insights.push(r);
              });
              crossSearchResults.comments.forEach(r => {
                if (!byResource[r.resource_id]) byResource[r.resource_id] = { empName: r.emp_name, raId: r.ra_id, allocationStatus: r.allocation_status, engagement: r.engagement, insights: [], comments: [] };
                byResource[r.resource_id].comments.push(r);
              });
              const allocationColors: Record<string, string> = { Joined: 'green', 'On Bench': 'orange', Resigned: 'red', Released: 'volcano', Allocated: 'blue', 'Partially Allocated': 'geekblue' };
              return Object.entries(byResource).map(([rid, grp]) => (
                <div key={rid} style={{ marginBottom: 8, border: '1px solid #f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                  <div
                    style={{ background: '#f5f7fa', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexWrap: 'wrap' }}
                    onClick={() => { handleSelectResource(Number(rid)); setCrossSearch(''); setCrossSearchResults(null); }}
                  >
                    <UserOutlined style={{ color: '#1677ff', fontSize: 11 }} />
                    <Text strong style={{ fontSize: 11 }}>{grp.empName}</Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>· {grp.raId}</Text>
                    {grp.allocationStatus && grp.allocationStatus !== 'No Value' && (
                      <Tag color={allocationColors[grp.allocationStatus] || 'default'} style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                        {grp.allocationStatus}
                      </Tag>
                    )}
                    {grp.engagement && grp.engagement !== 'No Value' && (
                      <Tag color="purple" style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                        {grp.engagement}
                      </Tag>
                    )}
                    <Tag style={{ marginLeft: 'auto', fontSize: 10, lineHeight: '16px' }}>
                      {grp.insights.length + grp.comments.length} match{grp.insights.length + grp.comments.length !== 1 ? 'es' : ''}
                    </Tag>
                  </div>
                  <div style={{ padding: '4px 10px 6px' }}>
                    {grp.insights.map(e => (
                      <div key={`i-${e.id}`} style={{ padding: '3px 0', borderBottom: '1px solid #fafafa', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <Tag color={SECTION_META[e.section as SectionKey]?.color} style={{ fontSize: 10, margin: '2px 0 0', padding: '0 4px', lineHeight: '16px', flexShrink: 0 }}>
                          {SECTION_META[e.section as SectionKey]?.label || e.section}
                        </Tag>
                        <div>
                          <Text strong style={{ fontSize: 11 }}>{e.title}</Text>
                          {e.body && <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>{e.body.slice(0, 100)}{e.body.length > 100 ? '…' : ''}</Text>}
                        </div>
                      </div>
                    ))}
                    {grp.comments.map(c => (
                      <div key={`c-${c.id}`} style={{ padding: '3px 0', borderBottom: '1px solid #fafafa', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <CommentOutlined style={{ color: '#1890ff', fontSize: 10, marginTop: 3, flexShrink: 0 }} />
                        <Tag color="blue" style={{ fontSize: 10, margin: '2px 0 0', padding: '0 4px', lineHeight: '16px', flexShrink: 0 }}>{c.tag}</Tag>
                        <div>
                          <Text style={{ fontSize: 11 }}>{c.body.slice(0, 100)}{c.body.length > 100 ? '…' : ''}</Text>
                          <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>by {c.author}</Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        {crossSearchResults && crossSearchResults.insights.length === 0 && crossSearchResults.comments.length === 0 && (
          <Empty description={<Text style={{ fontSize: 11 }}>No results found</Text>} imageStyle={{ height: 28 }} style={{ marginTop: 8 }} />
        )}
      </Card>

      {/* ── Resource Picker ── */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 10, border: '1px solid #e8eaf0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Avatar size={22} style={{ background: '#1677ff', fontSize: 10, flexShrink: 0 }} icon={<UserOutlined />} />
          <Text style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', color: '#595959' }}>Select resource:</Text>
          <Select
            showSearch
            size="small"
            placeholder={<span style={{ fontSize: 11 }}>Search by RA ID or name…</span>}
            style={{ flex: 1, maxWidth: 400, fontSize: 11 }}
            value={selectedResourceId}
            onChange={(val) => { handleSelectResource(val); }}
            optionFilterProp="label"
            allowClear
            onClear={() => { handleSelectResource(null); setEntries([]); }}
            options={resources.map(r => ({
              value: r.id!,
              label: `${r.raId} — ${r.empName}`,
            }))}
          />
          {selectedResourceId && (
            <Tooltip title="Refresh">
              <Button size="small" icon={<ReloadOutlined />} onClick={handleRefresh} style={{ fontSize: 11 }} />
            </Tooltip>
          )}
          {selectedResourceId && (
            <Tooltip title="Export PDF">
              <Button size="small" icon={<FilePdfOutlined style={{ color: '#cf1322' }} />} loading={exportingPdf} onClick={handleExportPdf} style={{ fontSize: 11 }} />
            </Tooltip>
          )}
        </div>
      </Card>

      {!selectedResourceId ? (
        /* ── Empty state: show skeleton layout so user sees the page structure ── */
        <Row gutter={16}>
          {/* Left: Tabs skeleton */}
          <Col xs={24} lg={17}>
            {/* Tabs skeleton */}
            <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: '0 16px 16px' }}>
              <div style={{ paddingTop: 12, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Input size="small" prefix={<SearchOutlined style={{ color: '#d9d9d9' }} />} placeholder="Search within this resource…" disabled style={{ width: 220, fontSize: 11 }} />
                <Button size="small" icon={<FileTextOutlined />} disabled style={{ fontSize: 11 }}>Log Summary</Button>
              </div>
              {/* Tab bar */}
              <div style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 0, display: 'flex', gap: 16, paddingLeft: 2, marginBottom: 16 }}>
                {['Interactions', 'Escalations', 'Career', 'Plans', 'General'].map((t, i) => (
                  <span key={t} style={{ fontSize: 12, color: i === 0 ? '#1677ff' : '#bfbfbf', padding: '8px 0', borderBottom: i === 0 ? '2px solid #1677ff' : 'none', marginBottom: -1 }}>{t}</span>
                ))}
              </div>
              <div style={{ padding: '16px 0' }}>
                <Empty
                  description={<Text type="secondary" style={{ fontSize: 12 }}>Select a resource above to view their insights</Text>}
                  imageStyle={{ height: 48, opacity: 0.35 }}
                />
              </div>
            </Card>
          </Col>

          {/* Right: Resource info skeleton */}
          <Col xs={24} lg={7}>
            <Card size="small" style={{ borderRadius: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f0f0', flexShrink: 0 }} />
                <div>
                  <Skeleton.Input active size="small" style={{ width: 110, marginBottom: 4, display: 'block' }} />
                  <Skeleton.Input active size="small" style={{ width: 70 }} />
                </div>
              </div>
              <Skeleton active paragraph={{ rows: 4 }} title={false} />
            </Card>
            <Card size="small" style={{ borderRadius: 8, marginBottom: 12 }}>
              <Skeleton active paragraph={{ rows: 2 }} title={{ width: 60 }} />
            </Card>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Button block icon={<ClockCircleOutlined />} disabled>View Audit Log History</Button>
            </Card>
          </Col>
        </Row>
      ) : (
        <Row gutter={16}>

          {/* ── Left: Tabs ── */}
          <Col xs={24} lg={17}>

            {/* Tabs + global search */}
            <Card style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }} bodyStyle={{ padding: '0 16px 16px' }}>
              {/* Global search + Log Summary bar */}
              <div style={{ paddingTop: 12, paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Input
                  size="small"
                  prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 11 }} />}
                  placeholder="Search within this resource…"
                  allowClear
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  style={{ width: 200, fontSize: 11 }}
                />
                <Button
                  size="small"
                  type="dashed"
                  icon={<FileTextOutlined style={{ fontSize: 11 }} />}
                  onClick={() => setSummaryModal(true)}
                  style={{ fontSize: 11 }}
                >
                  Log Summary
                </Button>
                {searchResults && (
                  <Badge count={searchResults.total} style={{ background: '#1677ff' }} showZero />
                )}
              </div>

              {searchResults ? (
                /* ── Unified search results view ── */
                <div style={{ paddingTop: 4, paddingBottom: 8 }}>
                  {searchResults.total === 0 ? (
                    <Empty description="No matching entries or comments" style={{ margin: '32px 0' }} imageStyle={{ height: 40 }} />
                  ) : (
                    <>
                      {searchResults.groups.map(({ section, entries: sEntries, comments: sComments }) => (
                        <div key={section} style={{ marginBottom: 18 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            marginBottom: 8, padding: '4px 0',
                            borderBottom: `2px solid ${SECTION_META[section].color}20`,
                          }}>
                            <span style={{ color: SECTION_META[section].color }}>{SECTION_META[section].icon}</span>
                            <Text strong style={{ fontSize: 13, color: SECTION_META[section].color }}>
                              {SECTION_META[section].label}
                            </Text>
                            <Tag style={{ marginLeft: 4, fontSize: 10 }}>{sEntries.length + sComments.length}</Tag>
                          </div>
                          {sEntries.map(e => (
                            <EntryCard key={e.id} entry={e} onEdit={() => {}} onDelete={async () => {}} canEdit={false} />
                          ))}
                          {sComments.map(c => <CommentMiniCard key={`c-${c.id}`} comment={c} />)}
                        </div>
                      ))}
                      {searchResults.generalComments.length > 0 && (
                        <div style={{ marginBottom: 18 }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            marginBottom: 8, padding: '4px 0',
                            borderBottom: '2px solid #8c8c8c20',
                          }}>
                            <CommentOutlined style={{ color: '#8c8c8c' }} />
                            <Text strong style={{ fontSize: 13, color: '#8c8c8c' }}>General Comments</Text>
                            <Tag style={{ marginLeft: 4, fontSize: 10 }}>{searchResults.generalComments.length}</Tag>
                          </div>
                          {searchResults.generalComments.map(c => <CommentMiniCard key={`gc-${c.id}`} comment={c} />)}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* ── Normal tabbed view ── */
                <Tabs
                  activeKey={activeTab}
                  onChange={(key) => { setActiveTab(key); setSummaryRange([null, null]); setAiSummary(''); setAiError(''); try { sessionStorage.setItem('resource_insights_tab', key); } catch { /* ignore */ } }}
                  items={tabItems}
                  size="small"
                />
              )}
            </Card>
          </Col>

          {/* ── Right Panel: Resource Summary ── */}
          <Col xs={24} lg={7}>
            <Card
              title={
                <Space>
                  <Avatar
                    size={30}
                    style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', fontSize: 12, fontWeight: 700 }}
                  >
                    {(selectedResource?.empName || 'R').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{selectedResource?.empName || '—'}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{selectedResource?.raId}</Text>
                  </div>
                </Space>
              }
              size="small"
              style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <Descriptions size="small" column={1} style={{ fontSize: 11 }}>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Role</Text>}>
                  <Text style={{ fontSize: 11 }}>{selectedResource?.piwRole || selectedResource?.roleOrDomain || '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Email</Text>}>
                  <Text style={{ fontSize: 11, wordBreak: 'break-all' }}>{selectedResource?.emailId || '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Experience</Text>}>
                  <Text style={{ fontSize: 11 }}>{selectedResource?.totalWorkex || '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>DOJ</Text>}>
                  <Text style={{ fontSize: 11 }}>{selectedResource?.doj ? fmtDate(selectedResource.doj) : '—'}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Engagement Card */}
            <Card
              title={<Space size={6}><ProjectOutlined style={{ color: '#1677ff' }} /><span style={{ fontSize: 12 }}>Current Engagement</span></Space>}
              size="small"
              style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <Descriptions size="small" column={1}>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Engagement</Text>}>
                  <Text style={{ fontSize: 11 }}>
                    {selectedResource?.engagement && selectedResource.engagement !== 'undefined'
                      ? selectedResource.engagement
                      : '—'}
                  </Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Start Date</Text>}>
                  <Text style={{ fontSize: 11 }}>{selectedResource?.engagementStartDate ? fmtDate(selectedResource.engagementStartDate) : '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>End Date</Text>}>
                  <Text style={{ fontSize: 11 }}>{selectedResource?.engagementEndDate ? fmtDate(selectedResource.engagementEndDate) : '—'}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Allocation</Text>}>
                  {selectedResource?.allocationStatus ? (
                    <Tag
                      bordered={false}
                      color={
                        selectedResource.allocationStatus.toLowerCase().includes('bench') ? 'orange' :
                        selectedResource.allocationStatus.toLowerCase().includes('resign') ? 'red' :
                        selectedResource.allocationStatus.toLowerCase() === 'joined' ? 'green' :
                        selectedResource.allocationStatus.toLowerCase().includes('partial') ? 'geekblue' : 'blue'
                      }
                      style={{ fontSize: 10 }}
                    >
                      {selectedResource.allocationStatus}
                    </Tag>
                  ) : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>}
                </Descriptions.Item>
                <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Beeline ID</Text>}>
                  {selectedResource?.beelineId ? (
                    <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: 10, cursor: 'pointer' }}
                      onClick={() => onNavigateToRequest?.(selectedResource.beelineId!)}>
                      {selectedResource.beelineId}
                    </Tag>
                  ) : (
                    <Button type="link" size="small" icon={<LinkOutlined />} style={{ fontSize: 10, padding: 0, height: 'auto' }}
                      onClick={() => selectedResource && openBeelineLinkModal(selectedResource)}>
                      Link
                    </Button>
                  )}
                </Descriptions.Item>
                {selectedResource?.sowName && (
                  <Descriptions.Item label={<Text type="secondary" style={{ fontSize: 11 }}>Linked SOW</Text>}>
                    <Tag icon={<LinkOutlined />} color="green" style={{ fontSize: 10, cursor: 'pointer' }}
                      onClick={() => onNavigateToProcess?.(selectedResource.sowName!)}>
                      {selectedResource.sowName}
                    </Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {/* Skills Card */}
            {skillsList.length > 0 && (
              <Card
                title={<Space size={6}><ThunderboltOutlined style={{ color: '#1677ff' }} /><span style={{ fontSize: 12 }}>Skills</span></Space>}
                size="small"
                style={{ borderRadius: 10, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {skillsList.map(s => (
                    <Tag key={s} bordered={false} color="blue" style={{ fontSize: 10 }}>{s}</Tag>
                  ))}
                </div>
              </Card>
            )}

            {/* Audit Log History */}
            <Card size="small" style={{ borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <Button
                block
                type="default"
                icon={<HistoryOutlined style={{ color: '#722ed1' }} />}
                onClick={openAuditModal}
                disabled={!selectedResourceId}
                style={{ fontSize: 12 }}
              >
                View Audit Log History
              </Button>
            </Card>

            {/* Audit Log Modal — same style as ResourceDetailPanel */}
            <Modal
              open={auditModalOpen}
              title={
                <Space size={6}>
                  <HistoryOutlined style={{ color: '#722ed1' }} />
                  <Text style={{ fontSize: 13 }}>Audit Log</Text>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>— {selectedResource?.empName || ''}</Text>
                </Space>
              }
              onCancel={() => { setAuditModalOpen(false); setAuditSearch(''); setAuditFieldFilter(null); setAuditByFilter(null); }}
              footer={<Button size="small" onClick={() => setAuditModalOpen(false)}>Close</Button>}
              width={820}
              destroyOnClose
            >
              <Space wrap size={4} style={{ marginBottom: 10 }}>
                <Input size="small" allowClear placeholder="Search…" value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)} style={{ width: 130, fontSize: 11 }} />
                <Select size="small" allowClear placeholder="Field" value={auditFieldFilter}
                  onChange={v => setAuditFieldFilter(v ?? null)} options={auditFieldOptions}
                  style={{ width: 140, fontSize: 11 }} popupMatchSelectWidth={false} />
                <Select size="small" allowClear placeholder="Changed by" value={auditByFilter}
                  onChange={v => setAuditByFilter(v ?? null)} options={auditByOptions}
                  style={{ width: 130, fontSize: 11 }} popupMatchSelectWidth={false} />
                {(auditSearch || auditFieldFilter || auditByFilter) && (
                  <Button size="small" type="link" danger style={{ fontSize: 11, padding: 0 }}
                    onClick={() => { setAuditSearch(''); setAuditFieldFilter(null); setAuditByFilter(null); }}>
                    Clear
                  </Button>
                )}
                {auditLog.length > 0 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {filteredAudit.length} of {auditLog.length}
                  </Text>
                )}
              </Space>
              {auditLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
              ) : (
                <Table<AuditEntry>
                  size="small"
                  dataSource={filteredAudit}
                  rowKey="id"
                  scroll={{ x: 'max-content', y: 400 }}
                  pagination={{ pageSize: 12, size: 'small', showSizeChanger: false }}
                  locale={{ emptyText: auditLog.length === 0 ? 'No audit history recorded' : 'No entries match filters' }}
                  columns={[
                    {
                      title: 'Field', dataIndex: 'field', minWidth: 150, ellipsis: true,
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
                      render: (v: string) => <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{(() => { try { return new Date(v).toLocaleString(); } catch { return v; } })()}</Text>,
                    },
                  ]}
                />
              )}
            </Modal>

            {/* Log Summary Modal */}
            <Modal
              open={summaryModal}
              title={<Space><FileTextOutlined style={{ color: '#1677ff' }} />{activeTab in SECTION_META ? (SECTION_META[activeTab as SectionKey]?.label) : 'All Sections'} — Log Summary</Space>}
              onCancel={() => { setSummaryModal(false); setAiSummary(''); setAiError(''); }}
              footer={[<Button key="close" onClick={() => { setSummaryModal(false); setAiSummary(''); setAiError(''); }}>Close</Button>]}
              width={600}
            >
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Select Period</Text>
                  <DatePicker.RangePicker
                    style={{ width: '100%' }}
                    value={summaryRange[0] && summaryRange[1] ? [summaryRange[0], summaryRange[1]] : undefined}
                    onChange={(dates) => { setSummaryRange(dates ? [dates[0], dates[1]] : [null, null]); setAiSummary(''); setAiError(''); }}
                    format="DD MMM YYYY"
                    disabledDate={d => d.isAfter(dayjs())}
                  />
                </div>
                {summaryRange[0] && summaryRange[1] && (
                  <>
                    {summaryEntries.length === 0 ? (
                      <Empty description="No entries or comments in this period" imageStyle={{ height: 40 }} />
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 12, fontWeight: 600 }}>
                            {summaryEntries.length} item{summaryEntries.length > 1 ? 's' : ''}
                          </Text>
                          <Space size={6}>
                            <Button
                              size="small"
                              icon={<FileTextOutlined />}
                              onClick={() => {
                                const [from, to] = summaryRange;
                                const local = generateLocalSummary(summaryEntries, from?.format('DD MMM YYYY'), to?.format('DD MMM YYYY'));
                                setAiSummary(local); setAiError('');
                              }}
                              style={{ fontSize: 11 }}
                            >
                              Quick Summary
                            </Button>
                            {aiSummary && (
                              <Tooltip title="Download Summary" overlayInnerStyle={{ fontSize: 11 }}>
                                <Button
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  onClick={() => {
                                    const blob = new Blob([aiSummary], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `summary-${selectedResource?.empName || 'resource'}-${dayjs().format('YYYY-MM-DD')}.txt`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  }}
                                  style={{ fontSize: 11 }}
                                />
                              </Tooltip>
                            )}
                            <Button
                              type="primary" size="small" icon={<RobotOutlined />}
                              loading={aiLoading} onClick={handleGenerateAiSummary}
                              style={{ background: '#1677ff', borderColor: '#1677ff', color: '#fff', fontSize: 11 }}
                            >
                              AI Summary
                            </Button>
                          </Space>
                        </div>
                        {aiError && (
                          <Alert type="warning" message={aiError} closable onClose={() => setAiError('')}
                            style={{ marginBottom: 10, borderRadius: 6, fontSize: 12 }} />
                        )}
                        {aiSummary && (
                          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
                            <Text style={{ fontSize: 12, fontWeight: 600, color: '#52c41a', display: 'block', marginBottom: 6 }}>
                              <FileTextOutlined style={{ marginRight: 6 }} />Log Summary
                            </Text>
                            {aiSummary.split('\n').map((line, i) => {
                              if (line.startsWith('## ')) return <Text key={i} strong style={{ display: 'block', marginTop: 8, marginBottom: 2, color: '#389e0d', fontSize: 12 }}>{line.replace('## ', '')}</Text>;
                              if (line.startsWith('- ')) return <Text key={i} style={{ display: 'block', fontSize: 12, color: '#595959', paddingLeft: 8 }}>• {line.replace('- ', '')}</Text>;
                              if (line.trim()) return <Text key={i} style={{ display: 'block', fontSize: 12, color: '#595959' }}>{line}</Text>;
                              return <br key={i} />;
                            })}
                          </div>
                        )}
                        <Divider style={{ margin: '8px 0' }} />
                        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                          {summaryEntries.map(e => (
                            <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <Text strong style={{ fontSize: 12 }}>{e.title}</Text>
                                {e.tag && <Tag color="#1677ff" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{e.tag}</Tag>}
                              </div>
                              {e.body && <Text style={{ fontSize: 11, color: '#595959', display: 'block' }}>{e.body}</Text>}
                              <Text type="secondary" style={{ fontSize: 10 }}>By {e.author || '—'} · {fmtDate(e.created_at)}</Text>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </Modal>
          </Col>
        </Row>
      )}
              </div>
            ),
          },
          {
            key: 'all_resources',
            label: <span style={{ fontSize: 12 }}><AppstoreOutlined /> All Resources</span>,
            children: (
              <div style={{ padding: '12px 0 8px' }}>
                <ResourceOverviewCharts
                  resources={propResources}
                  onFilterClick={onNavigateWithFilter ? (type, name) => onNavigateWithFilter(type, name) : undefined}
                />
              </div>
            ),
          },
        ]}
      />

      {/* ── Beeline Link Modal ─────────────────────────────────── */}
      <Modal
        title={<Space><LinkOutlined style={{ color: '#1890ff' }} /><span>Link to Beeline Request</span></Space>}
        open={beelineLinkModal.open}
        onCancel={() => setBeelineLinkModal({ open: false, resource: null })}
        onOk={saveBeelineLink}
        okText="Save Link"
        confirmLoading={beelineSaving}
        width={420}
      >
        {beelineLinkModal.resource && (
          <div style={{ paddingTop: 8 }}>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f5f5f5', borderRadius: 6 }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{beelineLinkModal.resource.empName}</div>
              <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{beelineLinkModal.resource.raId}</div>
            </div>
            <div style={{ marginBottom: 6, fontSize: '12px', color: '#595959' }}>Select Beeline ID to link:</div>
            <Select
              showSearch
              allowClear
              style={{ width: '100%' }}
              placeholder="Search Beeline ID…"
              value={selectedBeelineId || undefined}
              onChange={v => setSelectedBeelineId(v || '')}
              options={beelineRequestOptions}
              filterOption={(input, opt) => (opt?.value as string || '').toLowerCase().includes(input.toLowerCase())}
              size="middle"
            />
            {beelineLinkModal.resource.beelineId && (
              <div style={{ marginTop: 8, fontSize: '11px', color: '#8c8c8c' }}>
                Currently linked: <Tag color="blue" style={{ fontSize: '10px' }}>{beelineLinkModal.resource.beelineId}</Tag>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
