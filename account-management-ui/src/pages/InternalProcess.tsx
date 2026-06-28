/**
 * InternalProcess.tsx
 * 
 * Internal Process — Track internal SOW documents, pipeline management,
 * and process insights with status tracking and attachments
 * UI Location: Client Management > Internal Process
 * Page ID: clientmgmt_connects
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as processApi from '../api/processApi';
import * as templateApi from '../api/templateApi';
import * as piwApi from '../api/piwApi';
import * as sowApi from '../api/sowApi';
import * as resourceApi from '../api/resourceApi';
import ProcessDetailPanel from '../components/ProcessDetailPanel';
import {
  Tabs, Typography, Empty, Table, Button, Space, Tooltip, Upload, message,
  Drawer, Checkbox, Input, Select, Modal, Form, Tag, Popconfirm, Switch, Card,
  Steps, Dropdown, Spin, Divider, Row, Col, Alert, DatePicker,
} from 'antd';
import dayjs from 'dayjs';
import {
  NodeIndexOutlined, FileProtectOutlined, IdcardOutlined,
  UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, TableOutlined,
  ClearOutlined, CheckCircleFilled, RightOutlined,
  BarChartOutlined, InboxOutlined, UserOutlined, EllipsisOutlined,
  ShareAltOutlined, FileExcelOutlined, FileWordOutlined, FilePdfOutlined,
  LinkOutlined, TeamOutlined, MoreOutlined, ExpandAltOutlined, ShrinkOutlined,
  HistoryOutlined, CommentOutlined, InfoCircleOutlined, StopOutlined, CheckOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useConfig } from '../context/ConfigContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import '../style.css';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';
import type { ResourceRow } from '../types/resource';

const { Title, Text } = Typography;

// ─── Rate Lookup — commodity vs specialized (mirrors RateCard.tsx RATES) ────
const RATE_BANDS = [
  { maxYears: 3,        c_inr: 14769, s_inr: 16000, c_usd: 192, s_usd: 208 },
  { maxYears: 5,        c_inr: 18462, s_inr: 21538, c_usd: 240, s_usd: 280 },
  { maxYears: 8,        c_inr: 22769, s_inr: 24615, c_usd: 296, s_usd: 320 },
  { maxYears: 10,       c_inr: 27692, s_inr: 30769, c_usd: 360, s_usd: 400 },
  { maxYears: Infinity, c_inr: 30769, s_inr: 36923, c_usd: 400, s_usd: 480 },
];

function parseWorkexToYears(totalWorkex: string): number {
  const yr = totalWorkex?.match(/(\d[\d.]*)\s*[Yy]r|(\d[\d.]*)\s*[Yy]ear/);
  const mo = totalWorkex?.match(/(\d[\d.]*)\s*[Mm]o|(\d[\d.]*)\s*[Mm]onth/);
  const years  = yr ? parseFloat(yr[1] ?? yr[2]) : 0;
  const months = mo ? parseFloat(mo[1] ?? mo[2]) : 0;
  return years + months / 12;
}

function lookupDailyRate(totalWorkex: string, skillType: string = 'Commodity', currency: string = 'INR'): number {
  const years = parseWorkexToYears(totalWorkex);
  const band = RATE_BANDS.find(b => years < b.maxYears) ?? RATE_BANDS[RATE_BANDS.length - 1];
  const spec = skillType === 'Specialized';
  return currency === 'USD' ? (spec ? band.s_usd : band.c_usd) : (spec ? band.s_inr : band.c_inr);
}

// ─── PIW Resource Row type ──────────────────────────────────────────────────
interface PiwResourceEntry {
  key: string;
  raidId: string;
  empName: string;
  piwRole: string;
  totalWorkex: string;
  skillType: string;            // 'Commodity' | 'Specialized'
  dailyRate: number;
  manualDailyRate: string;      // user override; empty = use auto-looked-up dailyRate
  resourceStartDate: string;
  resourceEndDate: string;
}

// --- Types ---
interface ProcessRow {
  key: string;
  id?: number;
  processId?: string;
  sno: number;
  startDate: string;
  sow: string;
  signedSow: string;
  piw: string;
  active: string;
  salesforceId: string;
  promsId: string;
  budget: string;
  openAirCode: string;
  eprev: string;
  comments: string;
  sowFile?: File;
  accountAnchor?: string;
}

// --- Auto-derive status ---
function deriveStatus(r: ProcessRow): 'Not Started' | 'In Progress' | 'Completed' {
  if (r.openAirCode?.trim() || r.eprev?.trim() === 'Yes') return 'Completed';
  if (r.signedSow?.trim() === 'Yes' || r.piw?.trim() || r.salesforceId?.trim() || r.promsId?.trim() || r.budget?.trim()) return 'In Progress';
  return 'Not Started';
}

const STATUS_COLORS: Record<string, string> = {
  'Completed':   '#52c41a',
  'In Progress': '#1890ff',
  'Not Started': '#8c8c8c',
};

const ACTIVE_OPTIONS = ['Yes', 'No'];
const SIGNED_SOW_OPTIONS = ['Yes', 'No'];

const TEMPLATE_COLS = ['S.No.', 'Start Date', 'SOW', 'Signed SOW', 'PIW', 'Active', 'Salesforce ID', 'PROMS ID', 'Budget', 'Open Air Code', 'Comments'];

const COL_KEYS: { key: keyof ProcessRow; label: string }[] = [
  { key: 'sno',          label: 'S.No.' },
  { key: 'startDate',    label: 'Start Date' },
  { key: 'sow',          label: 'SOW' },
  { key: 'signedSow',    label: 'Signed SOW' },
  { key: 'piw',          label: 'PIW' },
  { key: 'active',       label: 'Active' },
  { key: 'salesforceId', label: 'Salesforce ID' },
  { key: 'promsId',      label: 'PROMS ID' },
  { key: 'budget',       label: 'Budget (INR)' },
  { key: 'eprev',        label: 'Eprev' },
  { key: 'openAirCode',  label: 'Open Air Code' },
  { key: 'comments',     label: 'Comments' },
  { key: 'accountAnchor', label: 'Account Anchor' },
];

// --- Pipeline stages ---
const PIPELINE_STAGES = [
  { key: 'sow',     label: 'SOW',            desc: 'Statement of Work received', field: (r: ProcessRow) => r.sow },
  { key: 'signed',  label: 'Signed SOW',     desc: 'SOW signed by RA',           field: (r: ProcessRow) => r.signedSow === 'Yes' ? 'Yes' : '' },
  { key: 'piw',     label: 'PIW',            desc: 'Person in Waiting created',  field: (r: ProcessRow) => r.piw },
  { key: 'sf',      label: 'SF Opportunity', desc: 'Salesforce ID created',      field: (r: ProcessRow) => r.salesforceId },
  { key: 'proms',   label: 'PROMS / Budget', desc: 'PROMS ID + Budget set',      field: (r: ProcessRow) => r.promsId || r.budget },
  { key: 'openair', label: 'Open Air Code',  desc: 'Final OA code assigned',     field: (r: ProcessRow) => r.openAirCode },
  { key: 'eprev',   label: 'Eprev',          desc: 'E-Preview completed',        field: (r: ProcessRow) => r.eprev === 'Yes' ? 'Yes' : '' },
];

const STAGE_COLORS = ['#1890ff', '#13c2c2', '#722ed1', '#fa8c16', '#eb2f96', '#a0d911', '#52c41a'];

// --- Date helpers ---
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function formatExcelDate(v: any): string {
  if (!v && v !== 0) return '';
  if (v instanceof Date) {
    // Use UTC methods — Excel dates are UTC midnight; local getDate() shifts in IST
    const d = v.getUTCDate().toString().padStart(2, '0');
    const m = MONTH_NAMES[v.getUTCMonth()];
    const y = v.getUTCFullYear().toString().slice(2);
    return `${d}-${m}-${y}`;
  }
  return String(v).trim();
}

function todayDateStr(): string {
  const now = new Date();
  const d = now.getDate().toString().padStart(2, '0');
  const m = MONTH_NAMES[now.getMonth()];
  const y = now.getFullYear().toString().slice(2);
  return `${d}-${m}-${y}`;
}

// --- Parse month-year from startDate for insights ---
function parseMonthYear(dateStr: string): string {
  if (!dateStr?.trim()) return '';
  const m1 = dateStr.match(/\d{1,2}[- ]([A-Za-z]{3})[- ](\d{2,4})/);
  if (m1) {
    const yr = m1[2].length === 2 ? '20' + m1[2] : m1[2];
    return `${m1[1]}-${yr}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
  return dateStr;
}

function monthSortKey(my: string): number {
  const m = my.match(/([A-Za-z]{3})-?(\d{4})/);
  if (!m) return 0;
  return parseInt(m[2]) * 100 + MONTH_NAMES.indexOf(m[1]);
}

// Full date sort key (YYYYMMDD numeric) — handles "DD-Mon-YY" and "DD-Mon-YYYY"
function dateSortKey(dateStr: string): number {
  if (!dateStr?.trim()) return 0;
  // Match DD-Mon-YY or DD-Mon-YYYY
  const m = dateStr.match(/(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})/);
  if (m) {
    const day = parseInt(m[1]);
    const mon = MONTH_NAMES.indexOf(m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase());
    const yr = m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3]);
    if (mon === -1) return 0;
    return yr * 10000 + (mon + 1) * 100 + day;
  }
  // Fallback: try native Date parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return 0;
}

// --- Download file helper ---
function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- Download template ---
function downloadTemplate() {
  const sample = [
    { 'S.No.': 1, 'Start Date': '03-Jan-26', SOW: 'T1-UCB_US_Tech-Resource_Allocation-2026-CR1', 'Signed SOW': 'No', PIW: '', Active: 'Yes', 'Salesforce ID': '', 'PROMS ID': '', Budget: '', 'Open Air Code': '', Comments: '' },
    { 'S.No.': 2, 'Start Date': '04-Jan-26', SOW: 'T2-RWD Resource Allocation - 2026 CR1', 'Signed SOW': 'Yes', PIW: 'PIW - RWD Resource Allocation - 2026 CR1', Active: 'Yes', 'Salesforce ID': '006Pg00000v6cBRIAY', 'PROMS ID': '30605955.1', Budget: '36,96,000.00', 'Open Air Code': 'ZSUS0341 - Next Gen Operations Support 2026', Comments: '' },
  ];
  const ws = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_COLS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Process');
  XLSX.writeFile(wb, 'RA_Process_Template.xlsx');
}

// --- Pipeline Card ---
function PipelineCard({ r, onView, onEdit, onDelete, onLinkResources, onToggleActive, onAssignAnchor, canEdit, canDelete, linkedCount, setDetailRow }: {
  r: ProcessRow; onView: () => void; onEdit: () => void; onDelete: () => void;
  onLinkResources: () => void; onToggleActive: () => void; onAssignAnchor: () => void;
  canEdit?: boolean; canDelete?: boolean; linkedCount?: number;
  setDetailRow: (r: ProcessRow | null) => void;
}) {
  const status = deriveStatus(r);
  const statusColor = STATUS_COLORS[status];
  const isInactive = r.active !== 'Yes';

  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, [class*="ant-dropdown"], .ant-dropdown')) return;
        onView();
      }}
      style={{
        background: isInactive ? '#fff7e6' : '#fff',
        borderRadius: 10,
        border: isInactive ? '1px solid #ffe7ba' : `1px solid ${statusColor}33`,
        borderLeft: isInactive ? '4px solid #fa8c16' : `4px solid ${statusColor}`,
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        padding: '14px 16px', marginBottom: 12,
        cursor: 'pointer',
        opacity: isInactive ? 0.85 : 1,
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(24,144,255,0.13)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.06)')}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#262626' }}>{r.sow || '—'}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4, alignItems: 'center' }}>
            {isInactive
              ? <Tag color="orange" style={{ fontSize: '10px', margin: 0 }}>Inactive</Tag>
              : <Tag style={{ fontSize: '10px', margin: 0, background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}44` }}>{status}</Tag>
            }
            {r.accountAnchor && <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>{r.accountAnchor}</Tag>}
            {!!linkedCount && <Tag icon={<TeamOutlined />} color="blue" style={{ fontSize: '10px', margin: 0 }}>{linkedCount} resource{linkedCount !== 1 ? 's' : ''}</Tag>}
          </div>
        </div>
        <Dropdown
          menu={{
            items: [
              (canEdit ?? true) ? { key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => { setDetailRow(null); onEdit(); } } : null,
              (canEdit ?? true) ? { key: 'toggleActive', label: <span style={{ fontSize: '11px' }}>{r.active === 'Yes' ? 'Mark Inactive' : 'Mark Active'}</span>, icon: r.active === 'Yes' ? <StopOutlined style={{ fontSize: '11px', color: '#ff4d4f' }} /> : <CheckOutlined style={{ fontSize: '11px', color: '#52c41a' }} />, onClick: () => onToggleActive() } : null,
              { key: 'link', label: <span style={{ fontSize: '11px' }}>Link Resources</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: () => onLinkResources() },
              { key: 'anchor', label: <span style={{ fontSize: '11px' }}>Assign Anchor</span>, icon: <IdcardOutlined style={{ fontSize: '11px' }} />, onClick: () => onAssignAnchor() },
              { type: 'divider' as const },
              (canDelete ?? true) ? {
                key: 'delete', label: <span style={{ fontSize: '11px' }}>Delete</span>,
                icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true,
                onClick: () => Modal.confirm({
                  title: 'Delete this record?', content: 'This action cannot be undone.',
                  okText: 'Delete', okButtonProps: { danger: true, size: 'small' },
                  cancelButtonProps: { size: 'small' }, onOk: onDelete,
                }),
              } : null,
            ].filter(Boolean) as any[],
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ padding: '0 4px', borderRadius: 6 }} onClick={e => e.stopPropagation()} />
        </Dropdown>
      </div>

      {/* Pipeline steps */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const done = !!stage.field(r)?.trim();
          const color = done ? STAGE_COLORS[idx] : '#d9d9d9';
          const value = stage.field(r)?.trim();
          return (
            <React.Fragment key={stage.key}>
              <Tooltip title={done && value ? <span style={{ fontSize: '11px' }}>{value}</span> : null} overlayInnerStyle={{ fontSize: '11px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'default' }} onClick={e => e.stopPropagation()}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: done ? color : '#f5f5f5',
                    border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', marginBottom: 4,
                    boxShadow: done ? `0 0 0 3px ${color}22` : 'none',
                  }}>
                    {done ? <CheckCircleFilled style={{ color: '#fff', fontSize: '16px' }} /> : <span style={{ color: '#bfbfbf', fontSize: '11px', fontWeight: 700 }}>{idx + 1}</span>}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: done ? 700 : 400, color: done ? color : '#bfbfbf', textAlign: 'center', lineHeight: 1.2, maxWidth: 72 }}>{stage.label}</span>
                </div>
              </Tooltip>
              {idx < PIPELINE_STAGES.length - 1 && (
                <div style={{ flex: 1, minWidth: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: 20 }}>
                  <RightOutlined style={{ color: done ? STAGE_COLORS[idx] : '#e8e8e8', fontSize: '11px' }} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

// --- Process Detail View Tab ---
function ProcessDetailView({ rows, initialSow }: { rows: ProcessRow[]; initialSow?: string }) {
  const [selectedSow, setSelectedSow] = useState<string | null>(initialSow || null);
  const [linkedResources, setLinkedResources] = useState<ResourceRow[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<{ type: 'added' | 'removed'; name: string; raId: string; date: string; by: string }[]>([]);
  const [processComments, setProcessComments] = useState<{ id: number; author: string; body: string; created_at: string }[]>([]);
  const [auditEntries, setAuditEntries] = useState<{ id: number; field: string; old_value: string; new_value: string; changed_by: string; changed_at: string }[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const selectedRow = useMemo(() => rows.find(r => r.sow === selectedSow) || null, [rows, selectedSow]);

  useEffect(() => {
    if (!selectedRow?.id) { setLinkedResources([]); setTimelineEntries([]); setProcessComments([]); setAuditEntries([]); return; }
    setLoadingRes(true);

    const pid = selectedRow.id!;
    Promise.all([
      resourceApi.getResources(),
      import('../api/auditApi').then(m => m.getProcessResourceHistory(pid)),
      fetch(`http://localhost:3001/api/process/${pid}/comments`).then(r => r.json()).catch(() => ({ comments: [] })),
      fetch(`http://localhost:3001/api/audit/process-combined/${pid}`).then(r => r.json()).catch(() => ({ entries: [] })),
    ]).then(([{ resources: all }, auditRaw, commentsData, auditData]) => {
      // Current linked resources
      const linked = (all as any[])
        .filter(r => r.process_id === pid || r.processId === pid)
        .map((r: any) => ({
          key: String(r.id || r.ra_id || r.raId),
          id: r.id,
          sno: String(r.sno || ''),
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
          engagementStartDate: String(r.engagement_start_date || r.engagementStartDate || ''),
          engagementEndDate: String(r.engagement_end_date || r.engagementEndDate || ''),
        }));
      setLinkedResources(linked);

      // Build timeline from audit log
      const pidStr = String(pid);
      const events = (auditRaw || []).map((e: any) => {
        const parts = String(e.record_name || '').split(' - ');
        const raId = parts[0]?.trim() || '';
        const name = parts.slice(1).join(' - ').trim() || e.record_name || '';
        const type: 'added' | 'removed' = String(e.new_value) === pidStr ? 'added' : 'removed';
        const dt = e.changed_at || '';
        const date = dt.slice(0, 10);
        return { type, name, raId, date, by: e.changed_by || '' };
      });
      events.sort((a, b) => a.date.localeCompare(b.date));
      setTimelineEntries(events);

      // Comments
      setProcessComments(commentsData.comments || []);

      // Combined audit entries (process fields + resource linking + engagement dates)
      setAuditEntries(auditData.entries || []);
    }).finally(() => setLoadingRes(false));
  }, [selectedRow?.id, refreshKey]);

  // Group timeline events by date, keeping only unique resources per segment
  const timelineGroups = useMemo(() => {
    // For each date, track the LAST event per resource (last action = final state for the day)
    // timelineEntries is sorted ASC by changed_at, so iterating in order means last .set() wins
    const dateMap = new Map<string, Map<string, typeof timelineEntries[0]>>();
    timelineEntries.forEach(e => {
      if (!dateMap.has(e.date)) dateMap.set(e.date, new Map());
      const key = e.raId || e.name;
      dateMap.get(e.date)!.set(key, e); // overwrite → last event wins
    });

    const groups: { date: string; added: typeof timelineEntries; removed: typeof timelineEntries }[] = [];
    dateMap.forEach((resourceMap, date) => {
      const added: typeof timelineEntries = [];
      const removed: typeof timelineEntries = [];
      resourceMap.forEach(e => (e.type === 'added' ? added : removed).push(e));
      groups.push({ date, added, removed });
    });
    groups.sort((a, b) => a.date.localeCompare(b.date));
    return groups;
  }, [timelineEntries]);

  // Running count snapshot
  const runningState = useMemo(() => {
    const active = new Set<string>();
    return timelineGroups.map(g => {
      g.added.forEach(e => active.add(e.raId || e.name));
      g.removed.forEach(e => active.delete(e.raId || e.name));
      return active.size;
    });
  }, [timelineGroups]);

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExportPdf = async () => {
    if (!detailRef.current || !selectedRow) return;
    setExportingPdf(true);
    try {
      const canvas = await html2canvas(detailRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f5f5',
        scrollY: -window.scrollY,
        windowWidth: detailRef.current.scrollWidth,
        windowHeight: detailRef.current.scrollHeight,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let yPos = margin;
      let heightLeft = imgH;
      pdf.addImage(imgData, 'PNG', margin, yPos, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        yPos = heightLeft - imgH + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, yPos, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
      pdf.save(`${selectedRow.sow.replace(/[^a-zA-Z0-9]/g, '_')}_DetailView.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportWord = () => {
    if (!selectedRow) return;
    const timelineHtml = timelineGroups.length > 0
      ? timelineGroups.map((g, gi) => `
          <p style="margin:6px 0 2px"><b>${fmtDate(g.date)}</b> &mdash; ${runningState[gi]} resource${runningState[gi] !== 1 ? 's' : ''} active</p>
          ${g.added.length > 0 ? `<p style="color:green;margin:2px 0">+ Added: ${g.added.map(e => `${e.name}${e.raId ? ` (${e.raId})` : ''}`).join(', ')}</p>` : ''}
          ${g.removed.length > 0 ? `<p style="color:red;margin:2px 0">&minus; Removed: ${g.removed.map(e => `${e.name}${e.raId ? ` (${e.raId})` : ''}`).join(', ')}</p>` : ''}
        `).join('')
      : '<p><i>No resource history recorded.</i></p>';

    const currentHtml = linkedResources.length > 0
      ? linkedResources.map(r => `<li>${r.empName} (${r.raId})</li>`).join('')
      : '<li><i>None</i></li>';

    const commentsHtml = processComments.length > 0
      ? `<table><tr><th>Author</th><th>Comment</th><th>Date</th></tr>${processComments.map(c => `<tr><td>${c.author || '—'}</td><td>${c.body}</td><td>${fmtDate(c.created_at)}</td></tr>`).join('')}</table>`
      : '<p><i>No comments found.</i></p>';

    const auditHtml = auditEntries.length > 0
      ? `<table><tr><th>Source</th><th>Field</th><th>Resource / Old Value</th><th>New Value</th><th>Changed By</th><th>Date</th></tr>${auditEntries.map(e => `<tr><td>${(e as any).source || 'Process'}</td><td>${e.field}</td><td>${(e as any).source === 'Resource Link' ? (e.new_value || '—') : ((e as any).source === 'Resource Date' ? ((e as any).record_name || '—') : (e.old_value || '—'))}</td><td>${(e as any).source === 'Resource Link' ? '' : (e.new_value || '—')}</td><td>${e.changed_by || '—'}</td><td>${fmtDate(e.changed_at)}</td></tr>`).join('')}</table>`
      : '<p><i>No audit log entries found.</i></p>';

    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"><title>${selectedRow.sow}</title>
      <style>body{font-family:Calibri,sans-serif;font-size:11pt;} h2{font-size:14pt;} h3{font-size:12pt;} table{border-collapse:collapse;width:100%;margin-bottom:10pt;} td,th{border:1px solid #ccc;padding:4px 8px;font-size:10pt;} th{background:#f0f0f0;font-weight:bold;}</style>
      </head><body>
      <h2>${selectedRow.sow}</h2>
      <p><b>Status:</b> ${deriveStatus(selectedRow)} &nbsp; <b>Active:</b> ${selectedRow.active}</p>
      <h3>SOW Details</h3>
      <table>
        <tr><th>Field</th><th>Value</th></tr>
        <tr><td>Start Date</td><td>${selectedRow.startDate || '—'}</td></tr>
        <tr><td>Signed SOW</td><td>${selectedRow.signedSow || '—'}</td></tr>
        <tr><td>PIW</td><td>${selectedRow.piw || '—'}</td></tr>
        <tr><td>Salesforce ID</td><td>${selectedRow.salesforceId || '—'}</td></tr>
        <tr><td>PROMS ID</td><td>${selectedRow.promsId || '—'}</td></tr>
        <tr><td>Budget (INR)</td><td>${selectedRow.budget || '—'}</td></tr>
        <tr><td>Open Air Code</td><td>${selectedRow.openAirCode || '—'}</td></tr>
        <tr><td>Eprev</td><td>${selectedRow.eprev || '—'}</td></tr>
        <tr><td>Account Anchor</td><td>${selectedRow.accountAnchor || '—'}</td></tr>
        <tr><td>Comments</td><td>${selectedRow.comments || '—'}</td></tr>
      </table>
      <h3>Resource History</h3>
      ${timelineHtml}
      <h3>Currently Linked Resources</h3>
      <ul>${currentHtml}</ul>
      <h3>Comments (${processComments.length})</h3>
      ${commentsHtml}
      <h3>Audit Log (${auditEntries.length})</h3>
      ${auditHtml}
      </body></html>`;

    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRow.sow.replace(/[^a-zA-Z0-9]/g, '_')}_DetailView.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const DetailItem = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
      <Text type="secondary" style={{ fontSize: '11px', minWidth: 120, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: '11px', fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</Text>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: '12px' }}>No process records yet.</Text>}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>Search SOW:</Text>
        <Select
          showSearch allowClear style={{ width: 380 }} size="small"
          placeholder="Type to search SOW name…"
          value={selectedSow || undefined}
          onChange={v => { setSelectedSow(v || null); setRefreshKey(k => k + 1); }}
          options={rows.map(r => ({ value: r.sow, label: r.sow }))}
          filterOption={(input, opt) => String(opt?.label || '').toLowerCase().includes(input.toLowerCase())}
        />
        {selectedRow && (
          <Tooltip title="Refresh history">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => setRefreshKey(k => k + 1)} loading={loadingRes} />
          </Tooltip>
        )}
        {selectedRow && (
          <Tooltip title="Export Word">
            <Button size="small" icon={<FileWordOutlined style={{ color: '#1677ff' }} />} onClick={handleExportWord} />
          </Tooltip>
        )}
        {selectedRow && (
          <Tooltip title="Export PDF">
            <Button size="small" icon={<FilePdfOutlined style={{ color: '#cf1322' }} />} onClick={handleExportPdf} loading={exportingPdf} />
          </Tooltip>
        )}
      </div>

      {!selectedSow && (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '50px 0', textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" style={{ fontSize: '12px' }}>Select a SOW to view its details and resource history.</Text>}
          />
        </div>
      )}

      {selectedRow && (
        <div ref={detailRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <>
          {/* SOW Details Card */}
          <Card size="small"
            title={<Space size={6}><FileProtectOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>{selectedRow.sow}</Text></Space>}
            extra={<Tag color={STATUS_COLORS[deriveStatus(selectedRow)]} style={{ fontSize: '11px' }}>{deriveStatus(selectedRow)}</Tag>}
            style={{ borderRadius: 10 }}
          >
            <Row gutter={[16, 0]}>
              <Col span={12}>
                <DetailItem label="Start Date" value={selectedRow.startDate} />
                <DetailItem label="Active" value={selectedRow.active} />
                <DetailItem label="Signed SOW" value={selectedRow.signedSow} />
                <DetailItem label="PIW" value={selectedRow.piw} />
                <DetailItem label="Account Anchor" value={selectedRow.accountAnchor || ''} />
              </Col>
              <Col span={12}>
                <DetailItem label="Salesforce ID" value={selectedRow.salesforceId} />
                <DetailItem label="PROMS ID" value={selectedRow.promsId} />
                <DetailItem label="Budget (INR)" value={selectedRow.budget} />
                <DetailItem label="Open Air Code" value={selectedRow.openAirCode} />
                <DetailItem label="Eprev" value={selectedRow.eprev || ''} />
              </Col>
            </Row>
            {selectedRow.comments && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>Comments: </Text>
                <Text style={{ fontSize: '11px' }}>{selectedRow.comments}</Text>
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 8 }}>Pipeline Progress</Text>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PIPELINE_STAGES.map((stage, idx) => {
                  const done = !!stage.field(selectedRow);
                  return (
                    <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Tag style={{ fontSize: '10px', margin: 0, background: done ? STAGE_COLORS[idx] + '20' : '#f5f5f5', color: done ? STAGE_COLORS[idx] : '#bfbfbf', border: `1px solid ${done ? STAGE_COLORS[idx] + '60' : '#e8e8e8'}` }}
                        icon={done ? <CheckCircleFilled style={{ fontSize: 9 }} /> : undefined}>
                        {stage.label}
                      </Tag>
                      {idx < PIPELINE_STAGES.length - 1 && <RightOutlined style={{ fontSize: 9, color: '#d9d9d9' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Resource History Timeline */}
          <Card size="small"
            title={<Space size={6}><TeamOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>Resource History</Text><Tag style={{ fontSize: '10px' }}>{linkedResources.length} currently linked</Tag></Space>}
            style={{ borderRadius: 10 }}
          >
            {loadingRes ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>
            ) : timelineGroups.length === 0 ? (
              <div>
                {linkedResources.length > 0 ? (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12, fontSize: '11px' }}
                      message={<Text style={{ fontSize: '11px' }}>No audit history found — these resources were linked before audit tracking began.</Text>}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {linkedResources.map(r => (
                        <Tag key={r.key} style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {r.empName} <Text type="secondary" style={{ fontSize: '10px' }}>({r.raId})</Text>
                        </Tag>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={<Text type="secondary" style={{ fontSize: '11px' }}>No resources have been linked to this SOW yet.</Text>}
                  />
                )}
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* vertical line */}
                <div style={{ position: 'absolute', left: 7, top: 12, bottom: 12, width: 2, background: '#f0f0f0', borderRadius: 1 }} />

                {timelineGroups.map((group, gi) => (
                  <div key={group.date} style={{ position: 'relative', marginBottom: gi < timelineGroups.length - 1 ? 20 : 0 }}>
                    {/* dot */}
                    <div style={{
                      position: 'absolute', left: -13, top: 3, width: 10, height: 10, borderRadius: '50%',
                      background: group.added.length > 0 && group.removed.length > 0 ? '#faad14'
                        : group.added.length > 0 ? '#52c41a' : '#ff4d4f',
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 1px #d9d9d9',
                    }} />

                    {/* date + count bubble */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Text style={{ fontSize: '11px', fontWeight: 600, color: '#595959' }}>{fmtDate(group.date)}</Text>
                      <Tag style={{ fontSize: '10px', background: '#f5f5f5', border: '1px solid #e8e8e8', color: '#595959' }}>
                        {runningState[gi]} resource{runningState[gi] !== 1 ? 's' : ''} active
                      </Tag>
                    </div>

                    {/* Added */}
                    {group.added.length > 0 && (
                      <div style={{ marginBottom: group.removed.length > 0 ? 6 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Tag color="success" style={{ fontSize: '10px', margin: 0 }}>+ {group.added.length} added</Tag>
                          {group.added.map((e, i) => (
                            <span key={i} style={{ fontSize: '11px', color: '#262626' }}>
                              {e.name}
                              {e.raId && <Text type="secondary" style={{ fontSize: '10px' }}> ({e.raId})</Text>}
                              {i < group.added.length - 1 && <span style={{ color: '#d9d9d9', marginRight: 4 }}>,</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Removed */}
                    {group.removed.length > 0 && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Tag color="error" style={{ fontSize: '10px', margin: 0 }}>− {group.removed.length} removed</Tag>
                          {group.removed.map((e, i) => (
                            <span key={i} style={{ fontSize: '11px', color: '#8c8c8c', textDecoration: 'line-through' }}>
                              {e.name}
                              {e.raId && <Text type="secondary" style={{ fontSize: '10px' }}> ({e.raId})</Text>}
                              {i < group.removed.length - 1 && <span style={{ color: '#d9d9d9', marginRight: 4 }}>,</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {group.added[0]?.by && (
                      <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: 3 }}>by {group.added[0]?.by || group.removed[0]?.by}</Text>
                    )}
                  </div>
                ))}

                {/* Current state footer */}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f5f5f5' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 6 }}>Currently linked ({linkedResources.length})</Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {linkedResources.length > 0 ? linkedResources.map(r => (
                      <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '4px 10px' }}>
                        <Text style={{ fontSize: '11px', color: '#389e0d', fontWeight: 500 }}>{r.empName}</Text>
                        <Text type="secondary" style={{ fontSize: '10px' }}>({r.raId})</Text>
                        {(r.engagementStartDate || r.engagementEndDate) && (
                          <Text style={{ fontSize: '10px', color: '#1677ff', marginLeft: 4 }}>
                            📅 {r.engagementStartDate ? fmtDate(r.engagementStartDate) : '—'} → {r.engagementEndDate ? fmtDate(r.engagementEndDate) : '—'}
                          </Text>
                        )}
                      </div>
                    )) : <Text type="secondary" style={{ fontSize: '11px' }}>None</Text>}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Comments */}
          <Card size="small"
            title={<Space size={6}><CommentOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>Comments</Text><Tag style={{ fontSize: '10px' }}>{processComments.length}</Tag></Space>}
            style={{ borderRadius: 10 }}
          >
            {loadingRes ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
            ) : processComments.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary" style={{ fontSize: '11px' }}>No comments for this SOW.</Text>}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {processComments.map(c => (
                  <div key={c.id} style={{ background: '#fafafa', borderRadius: 8, padding: '8px 12px', border: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1677ff' }}>{c.author || 'Unknown'}</Text>
                      <Text type="secondary" style={{ fontSize: '10px' }}>{fmtDate(c.created_at)}</Text>
                    </div>
                    <Text style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{c.body}</Text>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Audit Log */}
          <Card size="small"
            title={<Space size={6}><InfoCircleOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>Audit Log</Text><Tag style={{ fontSize: '10px' }}>{auditEntries.length}</Tag></Space>}
            style={{ borderRadius: 10 }}
          >
            {loadingRes ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
            ) : auditEntries.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary" style={{ fontSize: '11px' }}>No audit log entries for this SOW.</Text>}
              />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={auditEntries.map((e, i) => ({ ...e, key: i }))}
                scroll={{ y: 300 }}
                columns={[
                  { title: 'Source', dataIndex: 'source', key: 'source', width: 110, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => {
                    const colorMap: Record<string, string> = { Process: 'blue', 'Resource Link': 'purple', 'Resource Date': 'cyan' };
                    return <Tag color={colorMap[v] || 'default'} style={{ fontSize: '10px', lineHeight: '16px' }}>{v || 'Process'}</Tag>;
                  }},
                  { title: 'Field', dataIndex: 'field', key: 'field', width: 140, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => <Text style={{ fontSize: '11px', fontWeight: 500 }}>{v}</Text> },
                  { title: 'Resource / Old Value', dataIndex: 'record_name', key: 'rname', width: 160, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string, row: any) => {
                    const fmtVal = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) ? fmtDate(s) : (s || '—');
                    if (row.source === 'Resource Link') return <Text style={{ fontSize: '11px', color: '#722ed1' }}>{row.new_value || '—'}</Text>;
                    if (row.source === 'Resource Date') return <Text style={{ fontSize: '11px', color: '#08979c' }}>{v || '—'}</Text>;
                    return <Text style={{ fontSize: '11px', color: '#cf1322' }}>{fmtVal(row.old_value)}</Text>;
                  }},
                  { title: 'New Value', dataIndex: 'new_value', key: 'new', width: 160, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string, row: any) => {
                    const fmtVal = (s: string) => /^\d{4}-\d{2}-\d{2}/.test(s) ? fmtDate(s) : (s || '—');
                    if (row.source === 'Resource Link') return null;
                    return <Text style={{ fontSize: '11px', color: '#389e0d' }}>{fmtVal(v)}</Text>;
                  }},
                  { title: 'Changed By', dataIndex: 'changed_by', key: 'by', width: 110, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => <Text style={{ fontSize: '11px' }}>{v || '—'}</Text> },
                  { title: 'Date', dataIndex: 'changed_at', key: 'date', width: 120, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => <Text style={{ fontSize: '11px' }}>{fmtDate(v)}</Text> },
                ]}
              />
            )}
          </Card>
        </>
        </div>
      )}
    </div>
  );
}

// --- Process Insights Tab ---
function ProcessInsights({ rows, onNavigate }: { rows: ProcessRow[]; onNavigate?: (filters: Record<string, any>) => void }) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const navigate = (filters: Record<string, any>) => {
    if (onNavigate) onNavigate(filters);
  };

  const analytics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter(r => r.active === 'Yes').length;
    const inactive = rows.filter(r => r.active !== 'Yes').length;
    const notStarted = rows.filter(r => deriveStatus(r) === 'Not Started').length;
    const inProgress = rows.filter(r => deriveStatus(r) === 'In Progress').length;
    const completed = rows.filter(r => deriveStatus(r) === 'Completed').length;
    const withSignedSow = rows.filter(r => r.signedSow === 'Yes').length;
    const withPiw = rows.filter(r => !!r.piw?.trim()).length;
    const withSalesforce = rows.filter(r => !!r.salesforceId?.trim()).length;
    const withProms = rows.filter(r => !!r.promsId?.trim()).length;
    const withBudget = rows.filter(r => !!r.budget?.trim()).length;
    const withEprev = rows.filter(r => r.eprev === 'Yes').length;
    const withOpenAir = rows.filter(r => !!r.openAirCode?.trim()).length;
    const withAnchor = rows.filter(r => !!r.accountAnchor?.trim()).length;

    // By anchor
    const anchorMap: Record<string, number> = {};
    rows.forEach(r => {
      const a = r.accountAnchor || 'Unassigned';
      anchorMap[a] = (anchorMap[a] || 0) + 1;
    });

    // By month
    const monthMap = new Map<string, { notStarted: number; inProgress: number; completed: number; total: number }>();
    rows.forEach(r => {
      const month = parseMonthYear(r.startDate) || 'Unknown';
      const s = deriveStatus(r);
      const e = monthMap.get(month) || { notStarted: 0, inProgress: 0, completed: 0, total: 0 };
      e.total++;
      if (s === 'Not Started') e.notStarted++;
      else if (s === 'In Progress') e.inProgress++;
      else e.completed++;
      monthMap.set(month, e);
    });
    const monthData = Array.from(monthMap.entries())
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));

    // Completion rate
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const activationRate = total > 0 ? Math.round((active / total) * 100) : 0;

    // SOW doc coverage (have signed SOW)
    const signedRate = total > 0 ? Math.round((withSignedSow / total) * 100) : 0;
    const pipelineHealth = total > 0 ? Math.round(((withPiw + withSalesforce + withProms) / (total * 3)) * 100) : 0;

    // Recently added (last 3 months)
    const recentRows = rows.filter(r => {
      if (!r.startDate) return false;
      const key = monthSortKey(parseMonthYear(r.startDate) || '');
      const now = monthSortKey(parseMonthYear(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })) || '');
      return now - key <= 3 && key > 0;
    });

    return {
      total, active, inactive, notStarted, inProgress, completed,
      withSignedSow, withPiw, withSalesforce, withProms, withBudget, withEprev, withOpenAir, withAnchor,
      anchorMap, monthData, completionRate, activationRate, signedRate, pipelineHealth,
      recentCount: recentRows.length,
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: '12px' }}>No data yet — upload or add process records to see insights.</Text>}
        />
      </div>
    );
  }

  const kpi1 = [
    { label: 'Total Processes', value: analytics.total, color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff', filterKey: null },
    { label: 'Active', value: analytics.active, color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', filterKey: 'active' },
    { label: 'Inactive', value: analytics.inactive, color: '#fa8c16', bg: '#fff7e6', border: '#ffe7ba', filterKey: 'inactive' },
    { label: 'Completed', value: analytics.completed, color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', filterKey: 'completed' },
  ];
  const kpi2 = [
    { label: 'In Progress', value: analytics.inProgress, color: '#1890ff', bg: '#f0f5ff', border: '#d6e4ff', filterKey: 'inProgress' },
    { label: 'Not Started', value: analytics.notStarted, color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9', filterKey: 'notStarted' },
    { label: 'With Account Anchor', value: analytics.withAnchor, color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7', filterKey: null },
    { label: 'Completion Rate', value: `${analytics.completionRate}%`, color: analytics.completionRate >= 50 ? '#52c41a' : '#faad14', bg: '#fafafa', border: '#f0f0f0', filterKey: null, noClick: true },
  ];

  const pipelineItems = [
    { label: 'Signed SOW', count: analytics.withSignedSow, total: analytics.total, color: '#1890ff' },
    { label: 'PIW Created', count: analytics.withPiw, total: analytics.total, color: '#722ed1' },
    { label: 'Salesforce ID', count: analytics.withSalesforce, total: analytics.total, color: '#13c2c2' },
    { label: 'PROMS ID', count: analytics.withProms, total: analytics.total, color: '#52c41a' },
    { label: 'Budget Set', count: analytics.withBudget, total: analytics.total, color: '#fa8c16' },
    { label: 'Eprev Done', count: analytics.withEprev, total: analytics.total, color: '#a0d911' },
    { label: 'Open Air Code', count: analytics.withOpenAir, total: analytics.total, color: '#eb2f96' },
  ];

  const anchorRows = Object.entries(analytics.anchorMap)
    .sort(([, a], [, b]) => b - a)
    .map(([anchor, count]) => ({ anchor, count, pct: Math.round((count / analytics.total) * 100) }));

  return (
    <div style={{ padding: '4px 0' }}>
      {/* KPI Row 1 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {kpi1.map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <Card
              size="small" hoverable={!k.filterKey === false || !!k.filterKey}
              style={{ borderRadius: 8, cursor: k.filterKey ? 'pointer' : 'default', background: k.bg, border: `1px solid ${k.border}`, transition: 'all 0.2s' }}
              onClick={() => k.filterKey && navigate({ status: k.filterKey })}
            >
              <div style={{ fontSize: '11px', color: k.color, fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* KPI Row 2 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {kpi2.map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <Card
              size="small" hoverable={!k.noClick}
              style={{ borderRadius: 8, cursor: k.noClick ? 'default' : (k.filterKey ? 'pointer' : 'default'), background: k.bg, border: `1px solid ${k.border}`, transition: 'all 0.2s' }}
              onClick={() => k.filterKey && navigate({ status: k.filterKey })}
            >
              <div style={{ fontSize: '11px', color: k.color, fontWeight: 600, marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: '26px', fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {/* Pipeline Coverage */}
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={<span style={{ fontSize: '12px', fontWeight: 700 }}>📋 Pipeline Coverage</span>}
            style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '10px 14px' }}
          >
            {pipelineItems.map(item => (
              <div key={item.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <Text style={{ fontSize: '11px' }}>{item.label}</Text>
                  <Text style={{ fontSize: '11px', fontWeight: 600, color: item.color }}>{item.count} / {item.total}</Text>
                </div>
                <div style={{ background: '#f5f5f5', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${item.total > 0 ? Math.round((item.count / item.total) * 100) : 0}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </Card>
        </Col>

        {/* By Account Anchor */}
        <Col xs={24} md={12}>
          <Card
            size="small"
            title={<span style={{ fontSize: '12px', fontWeight: 700 }}>👤 By Account Anchor</span>}
            style={{ borderRadius: 8, border: '1px solid #f0f0f0', height: '100%' }}
            bodyStyle={{ padding: '10px 14px', maxHeight: 240, overflowY: 'auto' }}
          >
            {anchorRows.map(({ anchor, count, pct }) => (
              <div key={anchor} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Tag color={anchor === 'Unassigned' ? 'default' : 'purple'} style={{ fontSize: '10px', minWidth: 80, textAlign: 'center' }}>{anchor}</Tag>
                <div style={{ flex: 1, background: '#f5f5f5', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: anchor === 'Unassigned' ? '#d9d9d9' : '#722ed1', borderRadius: 4 }} />
                </div>
                <Text style={{ fontSize: '11px', fontWeight: 600, width: 28, textAlign: 'right' }}>{count}</Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* Monthly trend chart */}
      <Card
        size="small"
        title={<span style={{ fontSize: '12px', fontWeight: 700 }}>📅 Monthly Trend — Opportunities by Status</span>}
        style={{ borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 16 }}
        bodyStyle={{ padding: '10px 14px' }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={analytics.monthData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
            <RechartTooltip contentStyle={{ fontSize: '11px', borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 6 }} />
            <Bar dataKey="notStarted" name="Not Started" stackId="a" fill="#8c8c8c" />
            <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#1890ff" />
            <Bar dataKey="completed" name="Completed" stackId="a" fill="#52c41a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Monthly breakdown table */}
      <Card
        size="small"
        title={<span style={{ fontSize: '12px', fontWeight: 700 }}>📊 Monthly Breakdown</span>}
        style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          size="small"
          dataSource={analytics.monthData}
          rowKey="month"
          pagination={false}
          style={{ borderRadius: 8 }}
          columns={[
            { title: 'Month', dataIndex: 'month', key: 'month', width: 100, render: v => <span style={{ fontSize: '11px', fontWeight: 600 }}>{v}</span> },
            { title: 'Total', dataIndex: 'total', key: 'total', width: 60, render: v => <span style={{ fontSize: '11px', fontWeight: 700 }}>{v}</span> },
            { title: 'Not Started', dataIndex: 'notStarted', key: 'ns', width: 90, render: v => v ? <Tag style={{ fontSize: '10px', background: '#8c8c8c18', color: '#8c8c8c', border: '1px solid #8c8c8c44' }}>{v}</Tag> : <span style={{ fontSize: '11px', color: '#d9d9d9' }}>—</span> },
            { title: 'In Progress', dataIndex: 'inProgress', key: 'ip', width: 90, render: v => v ? <Tag style={{ fontSize: '10px', background: '#1890ff18', color: '#1890ff', border: '1px solid #1890ff44' }}>{v}</Tag> : <span style={{ fontSize: '11px', color: '#d9d9d9' }}>—</span> },
            { title: 'Completed', dataIndex: 'completed', key: 'cp', width: 90, render: v => v ? <Tag style={{ fontSize: '10px', background: '#52c41a18', color: '#52c41a', border: '1px solid #52c41a44' }}>{v}</Tag> : <span style={{ fontSize: '11px', color: '#d9d9d9' }}>—</span> },
            { title: '% Done', key: 'pct', width: 80, render: (_: any, r: any) => {
              const pct = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
              return <Tag color={pct >= 100 ? 'success' : pct >= 50 ? 'processing' : 'default'} style={{ fontSize: '10px' }}>{pct}%</Tag>;
            }},
          ]}
        />
      </Card>
    </div>
  );
}

// --- ProcessTab ---
interface ProcessTabProps {
  rows: ProcessRow[];
  setRows: React.Dispatch<React.SetStateAction<ProcessRow[]>>;
  fromServer?: boolean;
  setFromServer?: (v: boolean) => void;
  resourceRefreshKey?: number;
  initialSow?: string;
}

/** Convert any date string → YYYY-MM-DD for use in <input type="date"> */
function toInputDate(dateStr: string): string {
  if (!dateStr) return '';
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Try native Date parse (handles ISO, "Jan 03 2026", etc.)
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function ProcessTab({ rows, setRows, fromServer, setFromServer, resourceRefreshKey = 0, initialSow }: ProcessTabProps) {
  const { configs } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const canEdit = hasPermission('clientmgmt_connects', 'edit');
  const canDelete = hasPermission('clientmgmt_connects', 'delete');
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>(initialSow ? { sow: initialSow } : {});
  const [editModal, setEditModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ProcessRow | null>(null);
  // Auto-open detail panel for the matched SOW if initialSow provided
  const initialDetailRow = initialSow ? (rows.find(r => r.sow === initialSow) || null) : null;
  const [detailRow, setDetailRow] = useState<ProcessRow | null>(initialDetailRow);
  const [panelExpanded, setPanelExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [allocateModal, setAllocateModal] = useState(false);
  const [allocateAnchor, setAllocateAnchor] = useState('');
  const [allocateSelected, setAllocateSelected] = useState<string[]>([]);
  const [allocateSingleRow, setAllocateSingleRow] = useState<ProcessRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [form] = Form.useForm();
  const filterPanelRef = useRef<HTMLDivElement>(null);

  // ── Linked Resources state ──────────────────────────────────────────────────
  type ProcRes = { id: number; raId: string; empName: string; piwRole: string; processId: number | null; engagementStartDate?: string; engagementEndDate?: string };
  const [allProcResources, setAllProcResources] = useState<ProcRes[]>([]);
  const [linkModal, setLinkModal] = useState<{ open: boolean; row: ProcessRow | null }>({ open: false, row: null });
  const [linkChecked, setLinkChecked] = useState<Set<number>>(new Set());
  const [linkSearch, setLinkSearch] = useState('');
  const [loadingLink, setLoadingLink] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  // Per-resource date overrides in link modal
  const [linkDates, setLinkDates] = useState<Record<number, { startDate: string; endDate: string }>>({});

  const linkedCountMap = useMemo(() => {
    const map: Record<number, number> = {};
    allProcResources.forEach(r => { if (r.processId) map[r.processId] = (map[r.processId] || 0) + 1; });
    return map;
  }, [allProcResources]);

  const mapProcRes = (r: any): ProcRes => ({
    id: r.id,
    raId: r.ra_id || r.raId || '',
    empName: r.emp_name || r.empName || '',
    piwRole: r.piw_role || r.piwRole || '',
    processId: r.process_id != null ? Number(r.process_id) : (r.processId != null ? Number(r.processId) : null),
    engagementStartDate: r.engagement_start_date || r.engagementStartDate || '',
    engagementEndDate: r.engagement_end_date || r.engagementEndDate || '',
  });

  const [visibleColumns, setVisibleColumnsState] = useState<Record<string, boolean>>(
    Object.fromEntries(COL_KEYS.map(c => [c.key, true]))
  );

  // Apply saved user preferences once loaded
  useEffect(() => {
    if (!preferencesLoaded) return;
    const vis = getColumnVisibility('process');
    setVisibleColumnsState(prev => ({ ...prev, ...vis }));
  }, [preferencesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleColumns = (newVis: Record<string, boolean>) => {
    setVisibleColumnsState(newVis);
    saveColumnVisibility('process', newVis);
  };

  const isFilterApplied = Object.values(filters).some(Boolean);

  useEffect(() => {
    if (!showFilterPanel) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        if (!target.closest('.ant-select-dropdown, .ant-dropdown')) setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showFilterPanel]);

  // Load linked resources for count badges
  const loadProcResources = () => {
    resourceApi.getResources().then(({ resources }) => setAllProcResources(resources.map(mapProcRes)));
  };
  useEffect(() => { loadProcResources(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Re-fetch whenever PIW upload triggers a refresh (resourceRefreshKey increments)
  useEffect(() => { if (resourceRefreshKey > 0) loadProcResources(); }, [resourceRefreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open link resources modal
  const openLinkModal = async (row: ProcessRow) => {
    if (row.active !== 'Yes') {
      message.warning('Cannot link resources to an inactive process. Activate it first.');
      return;
    }
    setLinkModal({ open: true, row });
    setLoadingLink(true);
    setLinkChecked(new Set());
    setLinkSearch('');
    setLinkDates({});
    const { resources } = await resourceApi.getResources();
    const mapped = resources.map(mapProcRes);
    setAllProcResources(mapped);
    const initialChecked = new Set(mapped.filter(r => r.processId === row.id && r.id != null).map(r => r.id));
    setLinkChecked(initialChecked);
    // Pre-populate existing dates for already-linked resources (normalized to YYYY-MM-DD for date input)
    const initialDates: Record<number, { startDate: string; endDate: string }> = {};
    mapped.filter(r => r.processId === row.id).forEach(r => {
      initialDates[r.id] = {
        startDate: toInputDate(r.engagementStartDate || ''),
        endDate: toInputDate(r.engagementEndDate || ''),
      };
    });
    setLinkDates(initialDates);
    setLoadingLink(false);
  };

  const handleSaveLinks = async () => {
    if (!linkModal.row?.id) return;
    const processId = linkModal.row.id;
    setSavingLink(true);
    const prevLinked = new Set<number>(allProcResources.filter(r => r.processId === processId).map(r => r.id));
    const toLink   = [...linkChecked].filter(id => !prevLinked.has(id));
    const toUnlink = [...prevLinked].filter(id => !linkChecked.has(id));
    await Promise.all([
      ...toLink.map(id => resourceApi.setProcessLink(id, processId, currentUser?.username || 'system')),
      ...toUnlink.map(id => resourceApi.setProcessLink(id, null, currentUser?.username || 'system')),
    ]);
    // Update engagement dates for all checked resources that have an entry in linkDates
    // (saving even empty values so users can clear dates)
    await Promise.all(
      [...linkChecked].map(id => {
        const dates = linkDates[id];
        if (dates !== undefined) {
          return resourceApi.updateResource(id, {
            engagementStartDate: dates.startDate,
            engagementEndDate: dates.endDate,
            changedBy: currentUser?.username || 'system',
          });
        }
        return Promise.resolve();
      })
    );
    loadProcResources();
    setSavingLink(false);
    message.success('Resource links updated');
    setLinkModal({ open: false, row: null });
    setLinkDates({});
  };

  // Upload — upsert by SOW (append new, overwrite existing by SOW key)
  const handleUpload = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { message.error('No sheet found'); return false; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!json.length) { message.warning('Sheet is empty'); return false; }

      const uploaded: ProcessRow[] = json
        .filter(r => String(r['SOW'] || '').trim())
        .map((r, i) => ({
          key: `pr_${Date.now()}_${i}`,
          sno: i + 1,
          startDate:    formatExcelDate(r['Start Date']),
          sow:          String(r['SOW'] || '').trim(),
          signedSow:    String(r['Signed SOW'] || '').trim(),
          piw:          String(r['PIW'] || '').trim(),
          active:       String(r['Active'] || '').trim(),
          salesforceId: String(r['Salesforce ID'] || '').trim(),
          promsId:      String(r['PROMS ID'] || '').trim(),
          budget:       String(r['Budget'] || '').trim(),
          openAirCode:  String(r['Open Air Code'] || '').trim(),
          eprev:        String(r['Eprev'] || '').trim(),
          comments:     String(r['Comments'] || '').trim(),
        }));

      if (!uploaded.length) { message.warning('No valid rows with SOW found'); return false; }

      // Merge with existing rows (computed OUTSIDE setRows to avoid Strict Mode double-invoke)
      const existingMap = new Map(rows.map(r => [r.sow.toLowerCase(), r]));
      let newCount = 0, updCount = 0;
      uploaded.forEach(u => {
        const key = u.sow.toLowerCase();
        if (existingMap.has(key)) {
          existingMap.set(key, { ...existingMap.get(key)!, ...u, id: existingMap.get(key)!.id });
          updCount++;
        } else {
          existingMap.set(key, u);
          newCount++;
        }
      });
      const mergedRows = Array.from(existingMap.values()).map((r, i) => ({ ...r, sno: i + 1 }));

      // Update UI immediately
      setRows(mergedRows);
      setHasUnsaved(true);

      // Save to DB — reset server cache first so a previously unreachable server is re-checked
      setIsSaving(true);
      processApi.resetServerCache();
      try {
        const result = await processApi.bulkSave(mergedRows.map(r => ({
          sow: r.sow, sno: r.sno, startDate: r.startDate, signedSow: r.signedSow,
          piw: r.piw, active: r.active, salesforceId: r.salesforceId,
          promsId: r.promsId, budget: r.budget, openAirCode: r.openAirCode,
          eprev: r.eprev || '', comments: r.comments, accountAnchor: r.accountAnchor || '',
        })));
        if (result.ok) {
          setHasUnsaved(false);
          setFromServer?.(true);
          message.success(`Saved to database: ${newCount} new, ${updCount} updated`);
        } else {
          message.warning(`Parsed ${newCount + updCount} rows but database save failed — data shown locally only. Use "Save to Database" to retry.`);
        }
      } catch (saveErr: any) {
        message.error(`Data loaded locally but DB save failed: ${saveErr.message || 'Unknown error'}. Use "Save to Database" to retry.`);
      } finally {
        setIsSaving(false);
      }
    } catch (e: any) { message.error(e.message || 'Upload failed'); }
    return false;
  };

  // Manual retry save to DB
  const handleManualSave = async () => {
    if (!rows.length) return;
    setIsSaving(true);
    processApi.resetServerCache();
    try {
      const result = await processApi.bulkSave(rows.map(r => ({
        sow: r.sow, sno: r.sno, startDate: r.startDate, signedSow: r.signedSow,
        piw: r.piw, active: r.active, salesforceId: r.salesforceId,
        promsId: r.promsId, budget: r.budget, openAirCode: r.openAirCode,
        eprev: r.eprev || '', comments: r.comments, accountAnchor: r.accountAnchor || '',
      })));
      if (result.ok) {
        setHasUnsaved(false);
        setFromServer?.(true);
        message.success(`Saved to database: ${result.inserted} new, ${result.updated} updated`);
      } else {
        message.error('Database save failed. Please check the server connection.');
      }
    } catch (e: any) {
      message.error(`Save failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Export data
  const handleDownload = () => {
    if (!rows.length) { message.warning('No data to export'); return; }
    const data = rows.map(r => ({
      'S.No.': r.sno, 'Start Date': r.startDate, SOW: r.sow, 'Signed SOW': r.signedSow,
      PIW: r.piw, Active: r.active, 'Salesforce ID': r.salesforceId,
      'PROMS ID': r.promsId, Budget: r.budget, 'Open Air Code': r.openAirCode,
      Status: deriveStatus(r), Comments: r.comments,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Process');
    XLSX.writeFile(wb, 'RA_Process_Data.xlsx');
  };

  // Add / Edit / Delete
  const openAdd = () => { setEditingRow(null); form.resetFields(); setEditModal(true); };
  // openEdit from table/pipeline ellipsis: close detail panel first (no overlap needed)
  const openEdit = (r: ProcessRow) => { setEditingRow(r); form.setFieldsValue({ ...r, newComment: undefined }); setEditModal(true); };
  // openEditFromPanel: close detail panel first, then open edit drawer
  const openEditFromPanel = (r: ProcessRow) => { setDetailRow(null); setPanelExpanded(false); setEditingRow(r); form.setFieldsValue({ ...r, newComment: undefined }); setEditModal(true); };
  const openView = (r: ProcessRow) => { setDetailRow(r); setPanelExpanded(false); };
  const handleDelete = (r: ProcessRow) => {
    setRows(prev => prev.filter(pr => pr.key !== r.key).map((pr, i) => ({ ...pr, sno: i + 1 })));
    if (r.id) processApi.deleteProcess(r.id, currentUser?.username);
  };

  // Toggle active/inactive
  const handleToggleActive = async (row: ProcessRow) => {
    if (!row.id) return;
    const newIsActive = row.active !== 'Yes';
    const result = await processApi.setActiveStatus(row.id, newIsActive, currentUser?.username);
    if (!result.ok) { message.error(result.error || 'Failed to update status'); return; }
    const newVal = newIsActive ? 'Yes' : 'No';
    setRows(prev => prev.map(r => r.key === row.key ? { ...r, active: newVal } : r));
    if (detailRow && detailRow.key === row.key) setDetailRow(prev => prev ? { ...prev, active: newVal } : prev);
    message.success(`Marked as ${newIsActive ? 'Active' : 'Inactive'}`);
  };
  const handleSave = () => {
    form.validateFields().then(async vals => {
      // Cannot deactivate if resources are linked
      if (editingRow?.id && editingRow.active === 'Yes' && vals.active !== 'Yes') {
        const count = linkedCountMap[editingRow.id] || 0;
        if (count > 0) {
          message.error(`Cannot deactivate — ${count} resource(s) are still linked to this process. Remove resource links first.`);
          return;
        }
      }

      const newSow = (vals.sow || '').trim();
      const newPiw = (vals.piw || '').trim();

      // Case-insensitive SOW uniqueness check (excluding current row)
      if (newSow) {
        const sowDup = rows.find(r => r.sow.toLowerCase() === newSow.toLowerCase() && r.key !== editingRow?.key);
        if (sowDup) {
          message.error(`SOW name "${newSow}" already exists. Please use a unique SOW name.`);
          return;
        }
      }
      // PIW uniqueness check — non-empty, case-insensitive, excluding current row
      if (newPiw) {
        const piwDup = rows.find(r => r.piw.toLowerCase() === newPiw.toLowerCase() && r.key !== editingRow?.key);
        if (piwDup) {
          message.error(`PIW name "${newPiw}" already exists (on SOW: ${piwDup.sow}). Please use a unique PIW name.`);
          return;
        }
      }

      const commentText: string = (vals.newComment || '').trim();
      const { newComment: _nc, ...rowVals } = vals;
      if (editingRow) {
        const updatedRow = { ...editingRow, ...rowVals };
        setRows(prev => prev.map(r => r.key === editingRow.key ? updatedRow : r));
        // If detail panel is open for this record, refresh it in-place
        if (detailRow && detailRow.key === editingRow.key) setDetailRow(updatedRow);
        if (editingRow.id) {
          try {
            await processApi.updateProcess(editingRow.id, {
              sow: rowVals.sow || '', startDate: rowVals.startDate || '', signedSow: rowVals.signedSow || '',
              piw: rowVals.piw || '', active: rowVals.active || '',
              salesforceId: rowVals.salesforceId || '', promsId: rowVals.promsId || '',
              budget: rowVals.budget || '', openAirCode: rowVals.openAirCode || '',
              eprev: rowVals.eprev || '',
              comments: rowVals.comments || '', accountAnchor: rowVals.accountAnchor || '',
              changedBy: currentUser?.username,
            });
          } catch (e: any) {
            // Revert optimistic update on error
            setRows(prev => prev.map(r => r.key === editingRow.key ? editingRow : r));
            if (detailRow && detailRow.key === editingRow.key) setDetailRow(editingRow);
            message.error(e.message || 'Save failed');
            return;
          }
          if (commentText) {
            await processApi.addComment(editingRow.id, { author: currentUser?.username || 'Unknown', body: commentText });
          }
        }
      } else {
        const tempKey = `pr_${Date.now()}`;
        setRows(prev => [...prev, {
          key: tempKey, sno: prev.length + 1,
          startDate: '', signedSow: '', piw: '', active: '', salesforceId: '', promsId: '',
          budget: '', openAirCode: '', eprev: '', comments: '', sow: '', ...rowVals,
        }]);
        processApi.createProcess({
          sow: rowVals.sow || '', sno: 0, startDate: rowVals.startDate || '',
          signedSow: rowVals.signedSow || '', piw: rowVals.piw || '', active: rowVals.active || '',
          salesforceId: rowVals.salesforceId || '', promsId: rowVals.promsId || '',
          budget: rowVals.budget || '', openAirCode: rowVals.openAirCode || '',
          eprev: rowVals.eprev || '',
          comments: rowVals.comments || '', accountAnchor: rowVals.accountAnchor || '',
          changedBy: currentUser?.username,
        }).then(res => {
          if (res.ok && res.id) {
            setRows(prev => prev.map(r => r.key === tempKey ? { ...r, id: res.id } : r));
            setFromServer?.(true);
          }
        });
      }
      setEditModal(false);
      setDetailRow(null);
      form.resetFields();
    });
  };

  // Filter — applied filters drive the display
  const displayed = useMemo(() => rows.filter(r => {
    if (filters.sow && !r.sow.toLowerCase().includes(filters.sow.toLowerCase())) return false;
    if (filters.piw && !r.piw.toLowerCase().includes(filters.piw.toLowerCase())) return false;
    if (filters.status && deriveStatus(r) !== filters.status) return false;
    if (filters.active && r.active !== filters.active) return false;
    if (filters.accountAnchor && (r.accountAnchor || '') !== filters.accountAnchor) return false;
    if (filters.resourceName && r.id) {
      const linked = allProcResources.filter(res => res.processId === r.id);
      if (!linked.some(res => res.empName.toLowerCase().includes(filters.resourceName!.toLowerCase()))) return false;
    }
    return true;
  }), [rows, filters, allProcResources]);

  // Pipeline view: Active=Yes + (showAll or not Completed) — sorted by start date descending
  const pipelineRows = useMemo(
    () => [...displayed].sort((a, b) => dateSortKey(b.startDate || '') - dateSortKey(a.startDate || '')),
    [displayed]
  );

  // Account anchor options: from config linked to ra_process_account_anchor_field, fallback to row-derived
  const anchorOptions = useMemo(() => {
    const linkedConfig = configs.find(c => (c.linkedTo ?? []).includes('ra_process_account_anchor_field'));
    if (linkedConfig && linkedConfig.items.length > 0) {
      return linkedConfig.items.map(item => ({ label: item.label, value: item.label }));
    }
    // Fallback: unique anchors already assigned in rows
    const existing = Array.from(new Set(rows.map(r => r.accountAnchor).filter(Boolean))) as string[];
    return existing.map(a => ({ label: a, value: a }));
  }, [configs, rows]);

  // Allocate handlers
  const unassignedRows = useMemo(() => rows.filter(r => !r.accountAnchor), [rows]);

  const handleAllocateSave = () => {
    if (!allocateAnchor) { message.warning('Select an account anchor'); return; }
    if (allocateSingleRow) {
      // Single-record mode: assign only this row
      setRows(prev => prev.map(r => r.key === allocateSingleRow.key ? { ...r, accountAnchor: allocateAnchor } : r));
      if (allocateSingleRow.id) processApi.updateProcess(allocateSingleRow.id, { accountAnchor: allocateAnchor, changedBy: currentUser?.username });
      message.success(`Anchor assigned to ${allocateSingleRow.sow || 'record'}`);
    } else {
      if (!allocateSelected.length) { message.warning('Select at least one process entry'); return; }
      setRows(prev => prev.map(r => allocateSelected.includes(r.key) ? { ...r, accountAnchor: allocateAnchor } : r));
      const toUpdate = rows.filter(r => allocateSelected.includes(r.key) && r.id);
      toUpdate.forEach(r => processApi.updateProcess(r.id!, { accountAnchor: allocateAnchor, changedBy: currentUser?.username }));
      message.success(`${allocateSelected.length} record(s) assigned to ${allocateAnchor}`);
    }
    setAllocateModal(false);
    setAllocateAnchor('');
    setAllocateSelected([]);
    setAllocateSingleRow(null);
  };

  const clearFilters = () => { setFilters({}); };

  const handleClearAll = () => {
    processApi.clearAll(currentUser?.username);
    setRows([]);
    setFromServer?.(false);
    message.success('All process records deleted');
  };

  const handleClearAllAudit = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/process/all-audit', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      message.success('All process audit history deleted');
    } catch { message.error('Failed to delete audit history'); }
  };

  const handleClearAllComments = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/process/all-comments', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      message.success('All process comments deleted');
    } catch { message.error('Failed to delete comments'); }
  };

  // Table columns
  const hStyle = { fontSize: '11px', fontWeight: 700 as const };
  const cStyle = { fontSize: '11px' };

  const tableCols = [
    { title: 'ID', dataIndex: 'processId', key: 'processId', width: 52, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => v ? <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>{v}</Tag> : null },
    visibleColumns.sno        && { title: 'S.No.', key: 'sno', width: 55, onHeaderCell: () => ({ style: hStyle }), render: (_: unknown, __: ProcessRow, index: number) => <span style={cStyle}>{index + 1}</span> },
    visibleColumns.startDate  && { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', width: 90, defaultSortOrder: 'descend' as const, sorter: (a: ProcessRow, b: ProcessRow) => dateSortKey(a.startDate || '') - dateSortKey(b.startDate || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.sow        && { title: 'SOW', dataIndex: 'sow', key: 'sow', width: 240, sorter: (a: ProcessRow, b: ProcessRow) => (a.sow || '').localeCompare(b.sow || ''), onHeaderCell: () => ({ style: hStyle }),
      render: (v: string, r: ProcessRow) => r.sowFile
        ? (
          <Tooltip title="Click to download SOW document" overlayInnerStyle={{ fontSize: '11px' }}>
            <a style={{ ...cStyle, fontWeight: 600, color: '#1890ff', cursor: 'pointer' }}
              onClick={() => downloadFile(r.sowFile!)}>
              <DownloadOutlined style={{ marginRight: 4, fontSize: '11px' }} />{v}
            </a>
          </Tooltip>
        )
        : <span style={{ ...cStyle, fontWeight: 600 }}>{v}</span>
    },
    visibleColumns.signedSow  && { title: 'Signed SOW', dataIndex: 'signedSow', key: 'signedSow', width: 95, sorter: (a: ProcessRow, b: ProcessRow) => (a.signedSow || '').localeCompare(b.signedSow || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => v ? <Tag color={v === 'Yes' ? 'green' : 'orange'} style={{ fontSize: '10px' }}>{v}</Tag> : null },
    visibleColumns.piw        && { title: 'PIW', dataIndex: 'piw', key: 'piw', width: 220, sorter: (a: ProcessRow, b: ProcessRow) => (a.piw || '').localeCompare(b.piw || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.active     && { title: 'Active', dataIndex: 'active', key: 'active', width: 70, sorter: (a: ProcessRow, b: ProcessRow) => (a.active || '').localeCompare(b.active || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => v ? <Tag color={v === 'Yes' ? 'green' : 'default'} style={{ fontSize: '10px' }}>{v}</Tag> : null },
    visibleColumns.salesforceId && { title: 'Salesforce ID', dataIndex: 'salesforceId', key: 'salesforceId', width: 130, sorter: (a: ProcessRow, b: ProcessRow) => (a.salesforceId || '').localeCompare(b.salesforceId || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ ...cStyle, color: v ? '#1890ff' : undefined }}>{v}</span> },
    visibleColumns.promsId    && { title: 'PROMS ID', dataIndex: 'promsId', key: 'promsId', width: 110, sorter: (a: ProcessRow, b: ProcessRow) => (a.promsId || '').localeCompare(b.promsId || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.budget     && { title: 'Budget', dataIndex: 'budget', key: 'budget', width: 120, sorter: (a: ProcessRow, b: ProcessRow) => (a.budget || '').localeCompare(b.budget || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ ...cStyle, fontWeight: v ? 600 : 400 }}>{v}</span> },
    visibleColumns.eprev      && { title: 'Eprev', dataIndex: 'eprev', key: 'eprev', width: 75, sorter: (a: ProcessRow, b: ProcessRow) => (a.eprev || '').localeCompare(b.eprev || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => v ? <Tag color={v === 'Yes' ? 'success' : 'default'} style={{ fontSize: '10px' }}>{v}</Tag> : null },
    visibleColumns.openAirCode && { title: 'Open Air Code', dataIndex: 'openAirCode', key: 'openAirCode', width: 240, sorter: (a: ProcessRow, b: ProcessRow) => (a.openAirCode || '').localeCompare(b.openAirCode || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.comments   && { title: 'Comments', dataIndex: 'comments', key: 'comments', width: 140, sorter: (a: ProcessRow, b: ProcessRow) => (a.comments || '').localeCompare(b.comments || ''), onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.accountAnchor && { title: 'Account Anchor', dataIndex: 'accountAnchor', key: 'accountAnchor', width: 130, sorter: (a: ProcessRow, b: ProcessRow) => (a.accountAnchor || '').localeCompare(b.accountAnchor || ''), onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => v
        ? <Tag color="purple" style={{ fontSize: '10px' }}>{v}</Tag>
        : <span style={{ ...cStyle, color: '#bfbfbf' }}>Unassigned</span>
    },
    { title: 'Status', key: 'status', width: 110, sorter: (a: ProcessRow, b: ProcessRow) => deriveStatus(a).localeCompare(deriveStatus(b)), onHeaderCell: () => ({ style: hStyle }),
      render: (_: any, r: ProcessRow) => { const s = deriveStatus(r); return <Tag style={{ fontSize: '10px', background: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}44` }}>{s}</Tag>; }
    },
    {
      title: 'Actions', key: 'actions', width: 60, fixed: 'right' as const,
      onHeaderCell: () => ({ style: hStyle }),
      render: (_: any, r: ProcessRow) => (
        <Dropdown
          menu={{
            items: [
              canEdit ? { key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => { setDetailRow(null); openEdit(r); } } : null,
              canEdit ? { key: 'toggleActive', label: <span style={{ fontSize: '11px' }}>{r.active === 'Yes' ? 'Mark Inactive' : 'Mark Active'}</span>, icon: r.active === 'Yes' ? <StopOutlined style={{ fontSize: '11px', color: '#ff4d4f' }} /> : <CheckOutlined style={{ fontSize: '11px', color: '#52c41a' }} />, onClick: () => handleToggleActive(r) } : null,
              { key: 'link', label: <span style={{ fontSize: '11px' }}>Link Resources</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: () => openLinkModal(r) },
              { key: 'anchor', label: <span style={{ fontSize: '11px' }}>Assign Anchor</span>, icon: <IdcardOutlined style={{ fontSize: '11px' }} />, onClick: () => { setAllocateSingleRow(r); setAllocateAnchor(r.accountAnchor || ''); setAllocateModal(true); } },
              { type: 'divider' as const },
              canDelete ? {
                key: 'delete', label: <span style={{ fontSize: '11px' }}>Delete</span>,
                icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true,
                onClick: () => Modal.confirm({
                  title: 'Delete this record?', content: 'This action cannot be undone.',
                  okText: 'Delete', okButtonProps: { danger: true, size: 'small' },
                  cancelButtonProps: { size: 'small' }, onOk: () => handleDelete(r),
                }),
              } : null,
            ].filter(Boolean) as any[],
          }}
          trigger={['click']}
        >
          <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ padding: '0 4px' }} onClick={e => e.stopPropagation()} />
        </Dropdown>
      ),
    },
  ].filter(Boolean) as any[];

  // Filter panel — live filter (no Apply button), same pattern as client request tab
  const filterPanel = showFilterPanel && (
    <div ref={filterPanelRef} style={{ width: 240, flexShrink: 0, background: '#fafafa', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong style={{ fontSize: '12px' }}>Filters</Text>
        <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={clearFilters}>Clear all</Button>
      </div>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>SOW</div>
          <Input size="small" placeholder="Search..." value={filters.sow || ''}
            onChange={e => setFilters(f => ({ ...f, sow: e.target.value }))}
            style={{ fontSize: '11px' }} allowClear />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>PIW</div>
          <Input size="small" placeholder="Search..." value={filters.piw || ''}
            onChange={e => setFilters(f => ({ ...f, piw: e.target.value }))}
            style={{ fontSize: '11px' }} allowClear />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Status</div>
          <Select size="small" placeholder="All" allowClear value={filters.status || undefined}
            onChange={v => setFilters(f => ({ ...f, status: v || '' }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={['Not Started', 'In Progress', 'Completed'].map(s => ({ label: s, value: s }))} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Active</div>
          <Select size="small" placeholder="All" allowClear value={filters.active || undefined}
            onChange={v => setFilters(f => ({ ...f, active: v || '' }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={ACTIVE_OPTIONS.map(s => ({ label: s, value: s }))} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Account Anchor</div>
          <Select size="small" placeholder="All" allowClear value={filters.accountAnchor || undefined}
            onChange={v => setFilters(f => ({ ...f, accountAnchor: v || '' }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={anchorOptions} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Resource Name</div>
          <Input size="small" placeholder="Search linked resource..." value={filters.resourceName || ''}
            onChange={e => setFilters(f => ({ ...f, resourceName: e.target.value }))}
            style={{ fontSize: '11px' }} allowClear />
        </div>
      </Space>
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Showing: <strong>{displayed.length}</strong>{displayed.length !== rows.length ? ` / ${rows.length} total` : ''}
        </Text>
        <Space size={6} wrap style={{ alignItems: 'center' }}>
          {isFilterApplied && (
            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={clearFilters}>
              <ClearOutlined /> Clear Filters
            </Button>
          )}
          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(p => !p)} style={{ borderRadius: 6 }} />
          </Tooltip>
          {/* Single view toggle */}
          <Tooltip title={viewMode === 'pipeline' ? 'Switch to Table View' : 'Switch to Pipeline View'} overlayInnerStyle={{ fontSize: '11px' }}>
            <Button
              icon={viewMode === 'pipeline' ? <TableOutlined /> : <NodeIndexOutlined />}
              size="small" onClick={() => setViewMode(m => m === 'pipeline' ? 'table' : 'pipeline')}
              style={{ borderRadius: 6 }}
            />
          </Tooltip>
          {viewMode === 'table' && (
            <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {/* ⋯ CRUD ellipsis — same pattern as client request tab */}
          <Dropdown trigger={['click']} menu={{ items: [
            canEdit ? { key: 'add', label: <span style={{ fontSize: '11px' }}>Add New Record</span>, icon: <PlusOutlined style={{ fontSize: '11px' }} />, onClick: openAdd } : null,
            { type: 'divider' as const },
            { key: 'dlTemplate', label: <span style={{ fontSize: '11px' }}>Download Template</span>, icon: <DownloadOutlined style={{ fontSize: '11px' }} />, onClick: downloadTemplate },
            canEdit ? {
              key: 'upload',
              label: <span style={{ fontSize: '11px' }}>Upload from Excel</span>,
              icon: <UploadOutlined style={{ fontSize: '11px' }} />,
              onClick: () => {
                const inp = document.createElement('input');
                inp.type = 'file'; inp.accept = '.xlsx,.xls';
                inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleUpload(f); };
                inp.click();
              },
            } : null,
            rows.length > 0 ? { key: 'export', label: <span style={{ fontSize: '11px' }}>Export Data</span>, icon: <FileExcelOutlined style={{ fontSize: '11px', color: '#52c41a' }} />, onClick: handleDownload } : null,
            canDelete && rows.length > 0 ? { type: 'divider' as const } : null,
            canDelete && rows.length > 0 ? {
              key: 'deleteAll',
              label: <span style={{ fontSize: '11px' }}>Delete All Records</span>,
              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
              danger: true,
              onClick: () => Modal.confirm({
                title: 'Delete all process records?',
                content: 'This will permanently remove all records from the database.',
                okText: 'Yes, delete all', cancelText: 'Cancel',
                okButtonProps: { danger: true, size: 'small' },
                onOk: handleClearAll,
              }),
            } : null,
            canDelete ? { type: 'divider' as const } : null,
            canDelete ? {
              key: 'deleteAllAudit',
              label: <span style={{ fontSize: '11px' }}>Delete All Audit History</span>,
              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
              danger: true,
              onClick: () => Modal.confirm({
                title: 'Delete all process audit history?',
                content: 'This will permanently remove all audit log entries and resource history for Process (including Detailed View timeline).',
                okText: 'Yes, delete all', cancelText: 'Cancel',
                okButtonProps: { danger: true, size: 'small' },
                onOk: handleClearAllAudit,
              }),
            } : null,
            canDelete ? {
              key: 'deleteAllComments',
              label: <span style={{ fontSize: '11px' }}>Delete All Comments</span>,
              icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
              danger: true,
              onClick: () => Modal.confirm({
                title: 'Delete all process comments?',
                content: 'This will permanently remove all comments across all process records.',
                okText: 'Yes, delete all', cancelText: 'Cancel',
                okButtonProps: { danger: true, size: 'small' },
                onOk: handleClearAllComments,
              }),
            } : null,
          ].filter(Boolean) as any[] }}>
            <Button icon={<MoreOutlined />} size="small" style={{ borderRadius: 6 }} />
          </Dropdown>
        </Space>
      </div>

      {/* Unsaved data warning banner */}
      {hasUnsaved && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#874d00' }}>
          <span style={{ flex: 1 }}>
            ⚠️ <strong>Unsaved data</strong> — {rows.length} rows are loaded locally but not yet saved to the database.
          </span>
          <Button
            type="primary"
            size="small"
            loading={isSaving}
            style={{ borderRadius: 6, fontSize: '11px' }}
            onClick={handleManualSave}
          >
            {isSaving ? 'Saving…' : 'Save to Database'}
          </Button>
        </div>
      )}
      {isSaving && !hasUnsaved && (
        <div style={{ background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: '12px', color: '#0050b3', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Spin size="small" /> &nbsp;Saving data to database…
        </div>
      )}

      {/* Content */}
      {rows.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
          <NodeIndexOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No process records yet. Upload an Excel file or add a new entry.</Text>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12 }}>
          {filterPanel}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {viewMode === 'table' ? (
              <div className="compact-table">
                <Table dataSource={displayed} columns={tableCols} rowKey="key" size="small"
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  scroll={{ x: 'max-content', y: 420 }}
                  style={{ background: '#fff', borderRadius: 8 }}
                  locale={{ emptyText: 'No records match your filters' }}
                  onRow={r => ({
                    onClick: (e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button, .ant-dropdown, [class*="ant-dropdown"], .ant-checkbox-wrapper')) return;
                      openView(r);
                    },
                    style: { cursor: 'pointer' },
                  })}
                />
              </div>
            ) : (
              <div>
                {pipelineRows.length === 0 ? (
                  <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '40px 0', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {showAll ? 'No active opportunities (Active = Yes) found.' : 'No active, not-completed opportunities found. Use the "All" toggle to show completed ones too.'}
                    </Text>
                  </div>
                ) : (
                  pipelineRows.map(r => (
                    <PipelineCard key={r.key} r={r}
                      onEdit={() => openEdit(r)}
                      onView={() => openView(r)}
                      onDelete={() => handleDelete(r)}
                      onLinkResources={() => openLinkModal(r)}
                      onToggleActive={() => handleToggleActive(r)}
                      onAssignAnchor={() => { setAllocateSingleRow(r); setAllocateAnchor(r.accountAnchor || ''); setAllocateModal(true); }}
                      setDetailRow={setDetailRow}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      linkedCount={r.id ? linkedCountMap[r.id] || 0 : 0}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Column Visibility Drawer */}
      <Drawer title="Column Visibility" placement="right" onClose={() => setColumnDrawer(false)} open={columnDrawer} width={260}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {COL_KEYS.map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox checked={visibleColumns[key]} onChange={e => setVisibleColumns({ ...visibleColumns, [key]: e.target.checked })} />
              <label style={{ fontSize: '12px', marginBottom: 0, cursor: 'pointer' }}>{label}</label>
            </div>
          ))}
        </Space>
      </Drawer>

      {/* Add / Edit Drawer */}
      <Drawer
        title={
          <span style={{ fontSize: '13px', fontWeight: 600 }}>
            {editingRow ? `Edit — ${editingRow.sow || 'Record'}` : 'Add New Record'}
          </span>
        }
        placement="right"
        width={600}
        open={editModal}
        onClose={() => { setEditModal(false); setDetailRow(null); form.resetFields(); }}
        styles={{ body: { paddingTop: 8 } }}
        extra={
          <Button type="primary" size="small" onClick={handleSave} style={{ borderRadius: 6, fontSize: '12px' }}>
            Save
          </Button>
        }
      >
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="startDate" label={<span style={{ fontSize: '11px' }}>Start Date</span>}>
              <Input placeholder="e.g. 03-Jan-26" style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="active" label={<span style={{ fontSize: '11px' }}>Active</span>}>
              <Select placeholder="Select" options={ACTIVE_OPTIONS.map(v => ({ label: v, value: v }))} style={{ fontSize: '12px' }} allowClear />
            </Form.Item>
          </div>
          <Form.Item name="sow" label={<span style={{ fontSize: '11px' }}>SOW</span>} rules={[{ required: true, message: 'Enter SOW' }]}>
            <Input placeholder="e.g. T1-UCB_US_Tech-Resource_Allocation-2026-CR1" style={{ fontSize: '12px' }} />
          </Form.Item>
          <Form.Item name="signedSow" label={<span style={{ fontSize: '11px' }}>Signed SOW</span>}>
            <Select placeholder="Select" options={SIGNED_SOW_OPTIONS.map(v => ({ label: v, value: v }))} style={{ fontSize: '12px' }} allowClear />
          </Form.Item>
          <Form.Item name="piw" label={<span style={{ fontSize: '11px' }}>PIW</span>}>
            <Input placeholder="e.g. PIW - UCB Resource Allocation - 2026 - CR1" style={{ fontSize: '12px' }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="salesforceId" label={<span style={{ fontSize: '11px' }}>Salesforce ID</span>}>
              <Input style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="promsId" label={<span style={{ fontSize: '11px' }}>PROMS ID</span>}>
              <Input style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="budget" label={<span style={{ fontSize: '11px' }}>Budget (INR)</span>}>
              <Input placeholder="e.g. 45,08,307.00" style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="accountAnchor" label={<span style={{ fontSize: '11px' }}>Account Anchor</span>}>
              <Select
                showSearch allowClear placeholder="Select anchor"
                style={{ fontSize: '12px' }}
                options={anchorOptions}
                notFoundContent={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>No anchors configured</span>}
              />
            </Form.Item>
          </div>
          <Form.Item name="openAirCode" label={<span style={{ fontSize: '11px' }}>Open Air Code</span>}>
            <Input placeholder="e.g. ZSUS0341 - Next Gen Operations Support 2026" style={{ fontSize: '12px' }} />
          </Form.Item>
          <Form.Item name="eprev" label={<span style={{ fontSize: '11px' }}>Eprev</span>}
            extra={<span style={{ fontSize: '10px', color: '#8c8c8c' }}>Yes = E-Preview completed (marks process as Completed)</span>}>
            <Select placeholder="Select" options={[{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }]} style={{ fontSize: '12px' }} allowClear />
          </Form.Item>
          {editingRow && (
            <Form.Item
              name="newComment"
              label={<span style={{ fontSize: '11px' }}>Add Comment (optional)</span>}
              extra={<span style={{ fontSize: '10px', color: '#8c8c8c' }}>Will be saved to the Comments section of this record.</span>}
            >
              <Input.TextArea rows={2} placeholder="Leave a note about this change…" style={{ fontSize: '12px' }} />
            </Form.Item>
          )}
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', fontSize: '11px', color: '#389e0d', marginTop: 4 }}>
            Status auto-derived: <b>Not Started</b> → <b>In Progress</b> (Signed SOW = Yes or PIW/SF/PROMS added) → <b>Completed</b> (Eprev = Yes <i>or</i> OA Code added)
          </div>
        </Form>
      </Drawer>

      {/* Detail Drawer */}
      <Drawer
        open={!!detailRow}
        onClose={() => { setDetailRow(null); setPanelExpanded(false); }}
        placement="right"
        width={panelExpanded ? 900 : 520}
        title={
          detailRow ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {detailRow.sow || 'Record Details'}
              </span>
              <Space size={4} onClick={e => e.stopPropagation()}>
                {canEdit && <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditFromPanel(detailRow)} style={{ borderRadius: 6 }} />}
                <Button size="small" type="text" icon={panelExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />} onClick={() => setPanelExpanded(p => !p)} style={{ borderRadius: 6 }} />
                <Button size="small" type="text" onClick={() => { setDetailRow(null); setPanelExpanded(false); }} style={{ borderRadius: 6 }}>✕</Button>
              </Space>
            </div>
          ) : 'Record Details'
        }
        styles={{ body: { padding: '0 16px 16px' } }}
        closeIcon={null}
      >
        {detailRow && (
          <ProcessDetailPanel
            row={detailRow}
            currentUser={currentUser?.username || currentUser?.name || 'Unknown'}
            canEdit={canEdit}
            canDelete={canDelete}
            linkedResources={allProcResources.filter(r => r.processId === detailRow.id).map(r => ({ id: r.id, raId: r.raId, empName: r.empName, piwRole: r.piwRole, engagementStartDate: r.engagementStartDate, engagementEndDate: r.engagementEndDate }))}
            onEdit={() => openEditFromPanel(detailRow)}
            onToggleActive={() => handleToggleActive(detailRow)}
            onLinkResources={() => openLinkModal(detailRow)}
          />
        )}
      </Drawer>

      {/* Allocate to Account Anchor Modal */}
      <Modal
        title={<span style={{ fontSize: '13px' }}>{allocateSingleRow ? `Assign Anchor — ${allocateSingleRow.sow || 'Record'}` : 'Allocate to Account Anchor'}</span>}
        open={allocateModal}
        onOk={handleAllocateSave}
        onCancel={() => { setAllocateModal(false); setAllocateAnchor(''); setAllocateSelected([]); setAllocateSingleRow(null); }}
        okText="Assign"
        width={allocateSingleRow ? 420 : 560}
        okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
        cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      >
        <div style={{ marginTop: 12 }}>
          {allocateSingleRow ? (
            /* Single-record mode: just pick an anchor */
            <div>
              <div style={{ background: '#f0f5ff', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: '12px', color: '#262626' }}>
                <span style={{ color: '#8c8c8c', fontSize: '11px' }}>Process: </span>
                <strong>{allocateSingleRow.sow || '—'}</strong>
                {allocateSingleRow.accountAnchor && (
                  <span style={{ marginLeft: 8, fontSize: '11px', color: '#8c8c8c' }}>
                    (currently: <Tag color="purple" style={{ fontSize: '10px' }}>{allocateSingleRow.accountAnchor}</Tag>)
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 6 }}>Account Anchor</div>
              <Select
                showSearch allowClear
                placeholder="Select or type anchor name"
                value={allocateAnchor || undefined}
                onChange={v => setAllocateAnchor(v || '')}
                style={{ width: '100%' }}
                options={anchorOptions}
                notFoundContent={
                  <div style={{ padding: '8px 12px', fontSize: '11px', color: '#8c8c8c' }}>
                    No anchors configured — add them in Configuration → Account Anchors
                  </div>
                }
              />
            </div>
          ) : (
            /* Bulk mode: anchor + process checklist */
            <>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 6 }}>Account Anchor</div>
                <Select
                  showSearch allowClear
                  placeholder="Select or type anchor name"
                  value={allocateAnchor || undefined}
                  onChange={v => setAllocateAnchor(v || '')}
                  style={{ width: '100%' }}
                  options={anchorOptions}
                  notFoundContent={
                    <div style={{ padding: '8px 12px', fontSize: '11px', color: '#8c8c8c' }}>
                      No anchors configured — add them in Configuration → Account Anchors
                    </div>
                  }
                />
              </div>

              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
                Select process entries to assign — showing {unassignedRows.length} unassigned record(s)
              </div>

              {unassignedRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c', fontSize: '12px' }}>
                  All records are already assigned to an anchor.
                </div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                  {unassignedRows.map(r => (
                    <div key={r.key} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderBottom: '1px solid #fafafa',
                      cursor: 'pointer', background: allocateSelected.includes(r.key) ? '#f0f5ff' : '#fff',
                    }}
                      onClick={() => setAllocateSelected(prev =>
                        prev.includes(r.key) ? prev.filter(k => k !== r.key) : [...prev, r.key]
                      )}>
                      <Checkbox checked={allocateSelected.includes(r.key)} onChange={() => {}} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>{r.sow || '—'}</div>
                        <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 1 }}>
                          {r.startDate && `Started: ${r.startDate} · `}
                          Status: {deriveStatus(r)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* ── Link Resources Modal ───────────────────────────────────────── */}
      <Modal
        title={<span style={{ fontSize: '13px' }}><LinkOutlined style={{ marginRight: 6, color: '#1890ff' }} />Link Resources — {linkModal.row?.sow}</span>}
        open={linkModal.open}
        onCancel={() => setLinkModal({ open: false, row: null })}
        onOk={handleSaveLinks}
        okText="Save Links"
        confirmLoading={savingLink}
        width={560}
        okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
        cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
        footer={[
          <Button
            key="unlink-all"
            size="small"
            danger
            disabled={linkChecked.size === 0}
            onClick={() => setLinkChecked(new Set())}
            style={{ borderRadius: 6, fontSize: '11px', float: 'left' }}
          >
            Unlink All
          </Button>,
          <span key="count" style={{ fontSize: '11px', color: '#8c8c8c', float: 'left', lineHeight: '24px', marginLeft: 8 }}>
            {linkChecked.size} selected
          </span>,
          <Button key="cancel" size="small" style={{ borderRadius: 6 }} onClick={() => setLinkModal({ open: false, row: null })}>
            Cancel
          </Button>,
          <Button key="ok" size="small" type="primary" loading={savingLink} style={{ borderRadius: 6 }} onClick={handleSaveLinks}>
            Save Links
          </Button>,
        ]}
      >
        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 10, background: '#f0f5ff', borderRadius: 6, padding: '8px 12px' }}>
          Select resources to link. One resource can only be linked to one active process at a time.{' '}
          Resources already linked to another process are marked with a warning.
        </div>
        <Input.Search
          placeholder="Search by name or RAID…"
          size="small"
          allowClear
          value={linkSearch}
          onChange={e => setLinkSearch(e.target.value)}
          style={{ marginBottom: 10, fontSize: '12px' }}
        />
        <Spin spinning={loadingLink} tip="Loading resources…" size="small">
          {!loadingLink && allProcResources.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c', fontSize: '12px' }}>
              No resources found. Upload resources in the Resource Hub.
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
              {allProcResources
                .filter(res => {
                  if (!linkSearch.trim()) return true;
                  const q = linkSearch.toLowerCase();
                  return res.empName.toLowerCase().includes(q) || res.raId.toLowerCase().includes(q) || res.piwRole.toLowerCase().includes(q);
                })
                .map(res => {
                  const isChecked = linkChecked.has(res.id);
                  const linkedElsewhere = res.processId != null && linkModal.row?.id != null && res.processId !== linkModal.row.id;
                  const otherSow = linkedElsewhere ? (rows.find(r => r.id === res.processId)?.sow || `Process #${res.processId}`) : null;
                  return (
                    <div key={res.id} style={{ borderBottom: '1px solid #fafafa' }}>
                      <div
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          background: isChecked ? '#f0f5ff' : '#fff',
                        }}
                        onClick={() => {
                          const next = new Set(linkChecked);
                          if (next.has(res.id)) {
                            next.delete(res.id);
                          } else {
                            next.add(res.id);
                            // Pre-fill dates from existing resource data if not already set
                            setLinkDates(prev => {
                              if (prev[res.id] !== undefined) return prev;
                              return {
                                ...prev,
                                [res.id]: {
                                  startDate: toInputDate(res.engagementStartDate || ''),
                                  endDate: toInputDate(res.engagementEndDate || ''),
                                },
                              };
                            });
                          }
                          setLinkChecked(next);
                        }}
                      >
                        <Checkbox checked={isChecked} onChange={() => {}} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>
                            {res.empName}{' '}
                            <span style={{ color: '#8c8c8c', fontFamily: 'monospace', fontSize: '10px' }}>({res.raId})</span>
                          </div>
                          <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 1 }}>
                            {res.piwRole}
                            {linkedElsewhere && (
                              <span style={{ marginLeft: 8, color: '#fa8c16', fontWeight: 500 }}>
                                ⚠ Linked to: {otherSow}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {isChecked && (
                        <div style={{ display: 'flex', gap: 8, padding: '4px 12px 8px 42px', background: '#f8f9ff' }}
                          onClick={e => e.stopPropagation()}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Engagement Start</div>
                            <DatePicker
                              size="small"
                              style={{ width: '100%', fontSize: '11px' }}
                              value={linkDates[res.id]?.startDate ? dayjs(linkDates[res.id].startDate) : null}
                              disabledDate={current => {
                                const end = linkDates[res.id]?.endDate;
                                return end ? current.isAfter(dayjs(end)) : false;
                              }}
                              onChange={date => {
                                const val = date ? date.format('YYYY-MM-DD') : '';
                                setLinkDates(prev => ({ ...prev, [res.id]: { startDate: val, endDate: prev[res.id]?.endDate || '' } }));
                              }}
                              getPopupContainer={trigger => trigger.parentElement || document.body}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Engagement End</div>
                            <DatePicker
                              size="small"
                              style={{ width: '100%', fontSize: '11px' }}
                              value={linkDates[res.id]?.endDate ? dayjs(linkDates[res.id].endDate) : null}
                              disabledDate={current => {
                                const start = linkDates[res.id]?.startDate;
                                return start ? current.isBefore(dayjs(start)) : false;
                              }}
                              onChange={date => {
                                const val = date ? date.format('YYYY-MM-DD') : '';
                                setLinkDates(prev => ({ ...prev, [res.id]: { startDate: prev[res.id]?.startDate || '', endDate: val } }));
                              }}
                              getPopupContainer={trigger => trigger.parentElement || document.body}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
}

const ComingSoon = ({ label }: { label: string }) => (
  <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<Text type="secondary" style={{ fontSize: '12px' }}>{label} — coming soon</Text>}
    />
  </div>
);

// --- SOW Tab ---
function SowTab({ onUpload, onDelete }: { onUpload: (file: File, processKey: string) => void; onDelete: (processKey: string) => void }) {
  const { getAppValue } = useConfig();
  const [sowList, setSowList] = useState<{ key: string; processKey: string; file: File; uploadDate: string }[]>([]);

  const spUrl = getAppValue('SOW_STORAGE_URL') || '';

  const handleSowFile = (file: File) => {
    const processKey = `pr_sow_${Date.now()}`;
    setSowList(prev => [...prev, { key: `sow_${Date.now()}`, processKey, file, uploadDate: todayDateStr() }]);
    onUpload(file, processKey);
    if (spUrl) {
      message.success(
        <span>
          <strong>{file.name}</strong> added to Process.&nbsp;
          Click <em>Save to SP ↗</em> on the row to download it and open the SharePoint folder.
        </span>,
        6,
      );
    } else {
      message.success(`${file.name} uploaded and added to Process`);
    }
    return false;
  };

  const handleDelete = (key: string, processKey: string) => {
    setSowList(prev => prev.filter(s => s.key !== key));
    onDelete(processKey);
    message.success('SOW removed');
  };

  return (
    <div>
      {/* SP banner */}
      {spUrl && (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 SOW documents should also be saved to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>Open SharePoint Folder ↗</a>
        </div>
      )}
      {!spUrl && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure the <strong>SOW_STORAGE_URL</strong> in App Configuration to link to your SharePoint folder for centralized SOW document storage.
        </div>
      )}

      {/* Template download */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>SOW Template</Text>
        <Tooltip title="Download template" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button 
            icon={<DownloadOutlined />}
            size="small"
            type="text"
            onClick={async () => {
              try {
                const result = await templateApi.getTemplates('sow_template');
                if (result.ok && result.data && result.data.length > 0) {
                  const template = result.data[0];
                  const fileName = template.file_name || template.fileName;
                  await templateApi.downloadTemplate(template.id, fileName);
                  message.success('SOW template downloaded');
                } else {
                  message.info('No SOW template uploaded yet. Upload one in Configuration > Templates');
                }
              } catch (e: any) {
                message.error(e.message || 'Download failed');
              }
            }}
           style={{ borderRadius: 4, color: '#1890ff' }}
         />
       </Tooltip>
     </div>

     {/* Upload dragger */}
     <Upload.Dragger multiple={false} beforeUpload={handleSowFile} showUploadList={false} style={{ borderRadius: 8, marginBottom: 20 }}>
       <p className="ant-upload-drag-icon">
         <InboxOutlined style={{ fontSize: 36, color: '#1890ff' }} />
       </p>
       <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px' }}>Click or drag SOW document to upload</p>
       <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
         Supports PDF, Word, Excel, and all file types. Each upload auto-creates a Process entry with today's date as Start Date.
       </p>
     </Upload.Dragger>

      {sowList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '40px 0', textAlign: 'center' }}>
          <FileProtectOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No SOW documents uploaded yet.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded SOW Documents ({sowList.length})
          </Text>
          {sowList.map(({ key, processKey, file, uploadDate }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 8,
              border: '1px solid #f0f0f0', borderLeft: '3px solid #1890ff',
              padding: '10px 14px', marginBottom: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <FileProtectOutlined style={{ color: '#1890ff', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                  Uploaded: {uploadDate} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Tag color="green" style={{ fontSize: '10px', flexShrink: 0 }}>Added to Process</Tag>
              {spUrl && (
                <Tooltip title="Downloads the file locally and opens the SharePoint folder — drag the file into the SP folder to save it there" overlayInnerStyle={{ fontSize: '11px', maxWidth: 260 }}>
                  <Button
                    size="small"
                    style={{ borderRadius: 6, fontSize: '10px', borderColor: '#1890ff', color: '#1890ff' }}
                    onClick={() => {
                      downloadFile(file);
                      window.open(spUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Save to SP ↗
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFile(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
              <Popconfirm
                title="Delete this SOW?"
                description="This will also remove its entry from the Process tab."
                onConfirm={() => handleDelete(key, processKey)}
                okText="Delete" cancelText="Cancel"
                okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                <Tooltip title="Delete SOW" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
                </Tooltip>
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- SOW Upload Sub-tab ---
interface SowUploadSubTabProps {
  processRows: ProcessRow[];
  onRowCreated: (row: ProcessRow) => void;
}

function SowUploadSubTab({ processRows, onRowCreated }: SowUploadSubTabProps) {
  const { getAppValue } = useConfig();
  const { currentUser } = useAuth();
  const spUrl = getAppValue('SOW_STORAGE_URL') || '';
  const [uploading, setUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState<{ key: string; file: File; sowName: string; date: string }[]>([]);

  const handleFile = async (file: File) => {
    const sowName = file.name.replace(/\.[^/.]+$/, '').trim();

    // Uniqueness check
    const exists = processRows.some(r => r.sow.trim().toLowerCase() === sowName.toLowerCase());
    if (exists) {
      message.error(
        <span>
          A process with SOW name <strong>"{sowName}"</strong> already exists.<br />
          Please rename the file to a unique name before uploading.
        </span>,
        6,
      );
      return false;
    }

    setUploading(true);
    try {
      const res = await processApi.createProcess({
        sow: sowName,
        sno: 0,
        startDate: todayDateStr(),
        signedSow: '',
        piw: '',
        active: 'Yes',
        salesforceId: '',
        promsId: '',
        budget: '',
        openAirCode: '',
        eprev: '',
        comments: '',
        accountAnchor: '',
        changedBy: currentUser?.username,
      });

      if (res.ok) {
        const newRow: ProcessRow = {
          key: `pr_sow_${Date.now()}`,
          id: res.id,
          sno: processRows.length + 1,
          processId: res.id ? `P${res.id}` : '',
          startDate: todayDateStr(),
          sow: sowName,
          signedSow: '',
          piw: '',
          active: 'Yes',
          salesforceId: '',
          promsId: '',
          budget: '',
          openAirCode: '',
          eprev: '',
          comments: '',
          sowFile: file,
          accountAnchor: '',
        };
        onRowCreated(newRow);
        setUploadedList(prev => [...prev, { key: `upl_${Date.now()}`, file, sowName, date: todayDateStr() }]);

        if (spUrl) {
          message.success(
            <span>
              Process <strong>"{sowName}"</strong> created.&nbsp;
              Click <em>Open SharePoint ↗</em> to save the file there.
            </span>,
            6,
          );
        } else {
          message.success(`Process "${sowName}" created successfully.`);
        }
      } else {
        message.error('Failed to create process record. Please try again.');
      }
    } catch (e: any) {
      message.error(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <div>
      {/* SharePoint banner */}
      {spUrl ? (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 After uploading here, save the document to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>
            Open SharePoint Folder ↗
          </a>
        </div>
      ) : (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure <strong>SOW_STORAGE_URL</strong> in App Configuration to link to your SharePoint SOW folder.
        </div>
      )}

      <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#389e0d' }}>
        📌 The <strong>file name</strong> (without extension) will become the <strong>SOW Name</strong> in Process Overview. Make sure it is unique before uploading.
      </div>

      {/* Upload dragger */}
      <Upload.Dragger
        multiple={false}
        beforeUpload={handleFile}
        showUploadList={false}
        disabled={uploading}
        style={{ borderRadius: 8, marginBottom: 20 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: '#1890ff' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px' }}>
          {uploading ? 'Creating process record…' : 'Click or drag SOW document to upload'}
        </p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports all file types. File name = SOW Name. Must be unique. Automatically creates a Process Overview entry.
        </p>
      </Upload.Dragger>

      {/* Uploaded list */}
      {uploadedList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '32px 0', textAlign: 'center' }}>
          <FileProtectOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 8, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No SOW documents uploaded in this session.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded this session ({uploadedList.length})
          </Text>
          {uploadedList.map(({ key, file, sowName, date }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 8,
              border: '1px solid #f0f0f0', borderLeft: '3px solid #52c41a',
              padding: '10px 14px', marginBottom: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <FileProtectOutlined style={{ color: '#52c41a', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                  SOW: {sowName} &nbsp;·&nbsp; {date} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Tag color="green" style={{ fontSize: '10px', flexShrink: 0 }}>Process Created</Tag>
              {spUrl && (
                <Tooltip title="Open SharePoint folder to save the file there" overlayInnerStyle={{ fontSize: '11px', maxWidth: 220 }}>
                  <Button
                    size="small"
                    style={{ borderRadius: 6, fontSize: '10px', borderColor: '#1890ff', color: '#1890ff' }}
                    onClick={() => {
                      downloadFile(file);
                      window.open(spUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Save to SP ↗
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Download file" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFile(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- SOW Tab (with Create / Upload sub-tabs) ---
interface SowTabContentProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  onRowCreated: (row: ProcessRow) => void;
  spUrl?: string;
}

function SowTabContent({ resources, processRows, onRowCreated, spUrl = '' }: SowTabContentProps) {
  return (
    <Tabs
      defaultActiveKey="upload"
      size="small"
      tabBarStyle={{ marginBottom: 14 }}
      items={[
        {
          key: 'upload',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><UploadOutlined /> Upload</span>,
          children: <SowUploadSubTab processRows={processRows} onRowCreated={onRowCreated} />,
        },
        {
          key: 'create',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><FileProtectOutlined /> Create</span>,
          children: <SowGenerateTab resources={resources} processRows={processRows} spUrl={spUrl} />,
        },
      ]}
    />
  );
}

// --- SOW Generate Tab ---
interface SowGenTabProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  spUrl?: string;
}

// Extended resource row for SOW with extra editable fields
interface SowResourceEntry extends PiwResourceEntry {
  empId: string;
  skill: string;
  location: string;
  overheadCategory: string;
  manualDailyRate: string; // user override; empty = use auto-looked-up dailyRate
}

function SowGenerateTab({ resources = [], processRows = [], spUrl = '' }: SowGenTabProps) {
  const { getAppValue } = useConfig();

  // Auto SOW number: SOW - Jun 2026 - XXXX
  const autoSowNumber = useMemo(() => {
    const now = new Date();
    const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SOW - ${MONTHS_S[now.getMonth()]} ${now.getFullYear()} - ${rand}`;
  }, []);

  // Today's date formatted as "10 June 2026"
  const todayFormatted = useMemo(() => {
    const now = new Date();
    const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return `${now.getDate()} ${MONTHS_LONG[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  const [sowName,      setSowName]      = useState(autoSowNumber);  // download filename
  const [sowNumber,    setSowNumber]    = useState('');              // Work Order field (optional, empty)
  const [serviceProvider, setServiceProvider] = useState('Rockwell Automation Pvt Ltd');
  const [workProduct,  setWorkProduct]  = useState('');
  const [personnelNote, setPersonnelNote] = useState('');
  const [generating,   setGenerating]   = useState(false);

  const emptyRow = (): SowResourceEntry => ({
    key: `sr${Date.now()}`,
    raidId: '', empId: '', empName: '', piwRole: '', skill: '',
    totalWorkex: '', location: 'Bengaluru', overheadCategory: '',
    skillType: 'Commodity', dailyRate: 0, manualDailyRate: '',
    resourceStartDate: '', resourceEndDate: '',
  });

  const [sowRows, setSowRows] = useState<SowResourceEntry[]>([emptyRow()]);

  const handleRaidChange = (raidId: string, index: number) => {
    const res = resources.find(r => r.raId === raidId);
    setSowRows(prev => {
      const next = [...prev];
      const sk = next[index].skillType || 'Commodity';
      if (res) {
        next[index] = {
          ...next[index], raidId,
          empName: res.empName,
          piwRole: res.piwRole || '',
          totalWorkex: res.totalWorkex || '',
          dailyRate: lookupDailyRate(res.totalWorkex || '', sk),
        };
      } else {
        next[index] = { ...next[index], raidId, empName: '', piwRole: '', totalWorkex: '', dailyRate: 0 };
      }
      return next;
    });
  };

  const handleSkillTypeChange = (skillType: string, index: number) => {
    setSowRows(prev => {
      const next = [...prev]; const row = next[index];
      next[index] = { ...row, skillType, dailyRate: row.totalWorkex ? lookupDailyRate(row.totalWorkex, skillType) : 0 };
      return next;
    });
  };

  const updateField = (index: number, field: keyof SowResourceEntry, value: string | number) =>
    setSowRows(prev => { const next = [...prev]; (next[index] as any)[field] = value; return next; });

  const handleGenerate = async () => {
    const valid = sowRows.filter(r => r.raidId && r.empName);
    if (valid.length === 0) { message.error('Please select at least one resource'); return; }
    const missingDates = valid.filter(r => !r.resourceStartDate || !r.resourceEndDate);
    if (missingDates.length > 0) { message.error(`Set start & end dates for: ${missingDates.map(r => r.empName).join(', ')}`); return; }

    setGenerating(true);
    try {
      const formData: sowApi.SOWFormData = {
        sowNumber:       sowNumber || '',          // Work Order field in template (optional)
        serviceProvider: serviceProvider || 'Rockwell Automation Pvt Ltd',
        workProduct,
        resources: valid.map(r => ({
          raId:             r.raidId,
          empId:            r.empId || '',
          name:             r.empName,
          skill:            r.skill || r.piwRole || '',
          location:         r.location || 'Bengaluru',
          // Send parsed numeric years (e.g. "8.75") for clean display in the Word table
          experience:       (() => { const y = parseWorkexToYears(r.totalWorkex || ''); return y > 0 ? String(Math.round(y * 100) / 100) : ''; })(),
          overheadCategory: r.overheadCategory || '',
          dailyRate:        r.manualDailyRate ? Number(r.manualDailyRate) : r.dailyRate,
          resourceStartDate: r.resourceStartDate || undefined,
          resourceEndDate:   r.resourceEndDate   || undefined,
        })),
      };
      const blob = await sowApi.generateSOW(formData);
      sowApi.downloadSOW(blob, sowName || autoSowNumber);
      message.success('SOW downloaded');
    } catch (e: any) {
      message.error(e.message || 'Failed to generate SOW');
    } finally { setGenerating(false); }
  };

  const handleReset = () => {
    setSowName(autoSowNumber); setSowNumber('');
    setServiceProvider('Rockwell Automation Pvt Ltd');
    setWorkProduct(''); setPersonnelNote('');
    setSowRows([emptyRow()]);
  };

  const fl = (txt: string, optional?: boolean) => (
    <span style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>
      {txt}{optional && <span style={{ fontWeight: 400, color: '#bfbfbf', marginLeft: 4 }}>(optional)</span>}
    </span>
  );
  const fld = (txt: string) => <span style={{ fontSize: '10px', color: '#8c8c8c' }}>{txt}</span>;

  // Resource template download (SOW)
  const downloadSowResourceTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'RAID': 'RA001', 'Employee ID': 'E001', 'Skill Type': 'Commodity', 'Skill': 'Java Developer', 'Location': 'Bengaluru', 'Overhead Category': 'C - Only Laptop Provided', 'Bill Rate (INR) Daily': '', 'Start Date': '2026-07-01', 'End Date': '2026-09-30' },
      { 'RAID': 'RA002', 'Employee ID': 'E002', 'Skill Type': 'Specialized', 'Skill': 'Architect', 'Location': 'Bengaluru', 'Overhead Category': 'B - Laptop + Infra', 'Bill Rate (INR) Daily': '', 'Start Date': '2026-08-01', 'End Date': '2026-10-31' },
    ]);
    ws['!cols'] = [{ wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 30 }, { wch: 22 }, { wch: 14 }, { wch: 14 }];
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, 'SOW Resources');
    XLSX.writeFile(wb2, 'SOW_Resources_Template.xlsx');
  };

  const handleSowResourceUpload = (file: File) => {
    const normalizeExcelDate = (s: any): string => {
      if (!s) return '';
      const str = String(s).trim();
      // already ISO
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const mdy2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (mdy2) return `${2000 + parseInt(mdy2[3])}-${mdy2[1].padStart(2,'0')}-${mdy2[2].padStart(2,'0')}`;
      const mdy4 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mdy4) return `${mdy4[3]}-${mdy4[1].padStart(2,'0')}-${mdy4[2].padStart(2,'0')}`;
      const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
      return str;
    };
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { raw: false });
        const newRows: SowResourceEntry[] = [];
        const errors: string[] = [];
        rows.forEach((row, i) => {
          const raidId = String(row['RAID'] || row['RA ID'] || '').trim();
          if (!raidId) { errors.push(`Row ${i + 2}: Missing RAID`); return; }
          if (newRows.some(r => r.raidId === raidId)) { errors.push(`Row ${i + 2}: Duplicate RAID ${raidId}`); return; }
          const res = resources.find(r => r.raId === raidId);
          if (!res) { errors.push(`Row ${i + 2}: RAID "${raidId}" not found in Resource Hub`); return; }
          const skillType = String(row['Skill Type'] || 'Commodity').toLowerCase().includes('spec') ? 'Specialized' : 'Commodity';
          newRows.push({
            key: `sr_xl_${Date.now()}_${i}`,
            raidId,
            empId:       String(row['Employee ID'] || '').trim(),
            empName:     res.empName,
            piwRole:     res.piwRole || '',
            totalWorkex: res.totalWorkex || '',
            skill:       String(row['Skill'] || res.piwRole || '').trim(),
            location:    String(row['Location'] || 'Bengaluru').trim(),
            overheadCategory: String(row['Overhead Category'] || '').trim(),
            skillType,
            dailyRate:   lookupDailyRate(res.totalWorkex || '', skillType),
            manualDailyRate: String(row['Bill Rate'] || row['Bill Rate (INR) Daily'] || '').trim(),
            resourceStartDate: normalizeExcelDate(row['Start Date'] || row['start_date']),
            resourceEndDate:   normalizeExcelDate(row['End Date']   || row['end_date']),
          });
        });
        if (newRows.length === 0 && errors.length > 0) {
          Modal.error({ title: 'Upload Failed', content: <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e, i) => <li key={i} style={{ fontSize: '12px', color: '#f5222d' }}>{e}</li>)}</ul> });
          return;
        }
        setSowRows(newRows);
        if (errors.length > 0) {
          Modal.warning({ title: `${newRows.length} resource(s) loaded — ${errors.length} skipped`, content: <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((e, i) => <li key={i} style={{ fontSize: '12px' }}>{e}</li>)}</ul> });
        } else {
          message.success(`${newRows.length} resource(s) loaded from Excel`);
        }
      } catch (e: any) { message.error(e.message || 'Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  // Ellipsis menu: SOW template download + open SP
  const ellipsisItems = [
    {
      key: 'dl-tpl',
      label: <span style={{ fontSize: '11px' }}>Download SOW Template</span>,
      icon: <DownloadOutlined />,
      onClick: async () => {
        try {
          const result = await templateApi.getTemplates('sow_template');
          if (result.ok && result.data && result.data.length > 0) {
            const tpl = result.data[0];
            await templateApi.downloadTemplate(tpl.id, tpl.file_name || 'SOW_template.docx');
            message.success('SOW template downloaded');
          } else { message.info('No SOW template uploaded yet. Upload one in Configuration > Templates'); }
        } catch (e: any) { message.error(e.message || 'Download failed'); }
      },
    },
    ...(spUrl ? [{
      key: 'sp',
      label: <span style={{ fontSize: '11px' }}>Open SharePoint Folder ↗</span>,
      icon: <ShareAltOutlined />,
      onClick: () => window.open(spUrl, '_blank', 'noopener,noreferrer'),
    }] : []),
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>Generate SOW Document</Text>
        <Space size={4}>
          <Button type="primary" size="small" style={{ fontSize: '11px' }} icon={<FileWordOutlined />}
            loading={generating} onClick={handleGenerate}>
            Generate &amp; Download
          </Button>
          <Button size="small" style={{ fontSize: '11px' }} onClick={handleReset}>Reset</Button>
          <Dropdown menu={{ items: ellipsisItems }} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<EllipsisOutlined />} style={{ fontSize: '11px' }} />
          </Dropdown>
        </Space>
      </div>

      {/* SOW header fields — proper Ant Design Form */}
      <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 12 }}>
        <Form layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>SOW Name</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={sowName} onChange={e => setSowName(e.target.value)}
                placeholder="Used as the download filename" style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Date</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={todayFormatted} readOnly
                style={{ fontSize: '11px', background: '#f5f5f5', color: '#595959' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Work Order (SOW)</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={sowNumber} onChange={e => setSowNumber(e.target.value)}
                placeholder="Leave blank if not assigned" style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Service Provider</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={serviceProvider} onChange={e => setServiceProvider(e.target.value)}
                style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Work Product / Service</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={workProduct} onChange={e => setWorkProduct(e.target.value)}
                placeholder="Describe the work product or service" style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Service Provider's Personnel to be assigned</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={personnelNote} onChange={e => setPersonnelNote(e.target.value)}
                placeholder="e.g. as per Schedule below" style={{ fontSize: '11px' }} />
            </Form.Item>
          </div>
        </Form>
      </Card>

      {/* Resources */}
      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: '11px', fontWeight: 600, color: '#262626' }}>Resources</Text>
        <Space size={4}>
          {resources.length === 0 && (
            <span style={{ fontSize: '10px', color: '#cf1322' }}>⚠️ No resources in Resource Hub</span>
          )}
          <Button size="small" icon={<DownloadOutlined />} style={{ fontSize: '11px' }}
            onClick={downloadSowResourceTemplate}>
            Resource Template
          </Button>
          <Upload beforeUpload={handleSowResourceUpload} showUploadList={false} accept=".xlsx,.xls">
            <Button size="small" icon={<UploadOutlined />} style={{ fontSize: '11px' }}>Resource Details</Button>
          </Upload>
        </Space>
      </div>

      {sowRows.map((row, index) => {
        const selectedOther = new Set(sowRows.filter((_, i) => i !== index).map(r => r.raidId).filter(Boolean));
        const dateStyle: React.CSSProperties = { width: '100%', padding: '3px 7px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: '11px', color: '#595959', outline: 'none' };

        return (
          <Card key={row.key} bordered={false}
            style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 8, padding: 0 }}
            bodyStyle={{ padding: '10px 12px' }}>

            {/* Row header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fa8c16', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {index + 1}
                </div>
                <Select size="small" showSearch placeholder="Select RAID" value={row.raidId || undefined}
                  onChange={v => handleRaidChange(v, index)} style={{ width: 180, fontSize: '11px' }}
                  filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
                  options={resources.map(r => ({ value: r.raId, label: `${r.raId} · ${r.empName}`, disabled: selectedOther.has(r.raId) }))}
                />
              </div>
              {sowRows.length > 1 && (
                <Button size="small" type="text" danger onClick={() => setSowRows(p => p.filter(r => r.key !== row.key))}
                  style={{ padding: '0 4px', fontSize: '11px' }}>✕</Button>
              )}
            </div>

            {/* Row 1: Name, Employee ID, Skill Type, Skill */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 1fr', gap: 8, marginBottom: 6 }}>
              <div>
                {fld('Name')}
                <Input size="small" value={row.empName} readOnly placeholder="Auto from RAID"
                  style={{ marginTop: 2, fontSize: '11px', background: '#fafafa', color: '#595959' }} />
              </div>
              <div>
                {fld('Employee ID')}
                <Input size="small" value={row.empId} onChange={e => updateField(index, 'empId', e.target.value)}
                  placeholder="Emp ID" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
              <div>
                {fld('Skill Type')}
                <Select size="small" value={row.skillType || 'Commodity'}
                  onChange={v => handleSkillTypeChange(v, index)} style={{ width: '100%', marginTop: 2, fontSize: '11px' }}
                  options={[{ value: 'Commodity', label: 'Commodity' }, { value: 'Specialized', label: 'Specialized' }]} />
              </div>
              <div>
                {fld('Skill')}
                <Input size="small" value={row.skill} onChange={e => updateField(index, 'skill', e.target.value)}
                  placeholder="e.g. Java Developer" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
            </div>

            {/* Row 2: Location, Year of Exp, Overhead Category, Bill Rate */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 140px', gap: 8, marginBottom: 6 }}>
              <div>
                {fld('Location')}
                <Input size="small" value={row.location} onChange={e => updateField(index, 'location', e.target.value)}
                  placeholder="Bengaluru" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
              <div>
                {fld('Year of Experience')}
                <Input size="small" value={row.totalWorkex} readOnly placeholder="Auto from RAID"
                  style={{ marginTop: 2, fontSize: '11px', background: '#fafafa', color: '#595959' }} />
              </div>
              <div>
                {fld('Overhead Category')}
                <Input size="small" value={row.overheadCategory} onChange={e => updateField(index, 'overheadCategory', e.target.value)}
                  placeholder="e.g. C - Only Laptop Provided" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
              <div>
                {fld('Bill Rate (INR) Daily')}
                <Input size="small"
                  value={row.manualDailyRate}
                  onChange={e => updateField(index, 'manualDailyRate', e.target.value.replace(/[^\d]/g, ''))}
                  placeholder={row.dailyRate ? `Auto: ₹${row.dailyRate.toLocaleString()}` : 'Enter rate'}
                  prefix={<span style={{ fontSize: '10px', color: '#389e0d' }}>₹</span>}
                  style={{ marginTop: 2, fontSize: '11px', color: '#389e0d', fontWeight: 500 }} />
              </div>
            </div>

            {/* Row 3: Start Date, End Date */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
              <div>
                {fld('Start Date')}
                <input type="date" value={row.resourceStartDate || ''}
                  onChange={e => updateField(index, 'resourceStartDate', e.target.value)}
                  style={{ ...dateStyle, marginTop: 2 }} />
              </div>
              <div>
                {fld('End Date')}
                <input type="date" value={row.resourceEndDate || ''}
                  onChange={e => updateField(index, 'resourceEndDate', e.target.value)}
                  style={{ ...dateStyle, marginTop: 2 }} />
              </div>
            </div>
          </Card>
        );
      })}

      <Button type="dashed" size="small" block icon={<PlusOutlined />}
        onClick={() => setSowRows(p => [...p, emptyRow()])}
        style={{ marginTop: 2, marginBottom: 4, borderRadius: 6, fontSize: '11px' }}>
        Add Resource
      </Button>
    </div>
  );
}

// --- PIW Tab ---
interface PiwTabProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  onUpdateProcessRow?: (key: string, updates: Partial<ProcessRow>) => void;
}

function PiwTab({ resources = [], processRows = [], onUpdateProcessRow }: PiwTabProps) {
  const { getConfigByLink, getAppValue } = useConfig();
  const spUrl = getAppValue('PIW_STORAGE_URL') || '';

  // Get engagement names from linked config type (same mechanism as other dropdowns)
  const engagementConfig = getConfigByLink('piw_engagement_field');
  const engagementNames = engagementConfig?.items.map(i => i.label) ?? [];

  const [step1Form]     = Form.useForm();
  const [step2Form]     = Form.useForm();
  const [currentStep, setCurrentStep]       = useState(0);
  const [projectDetails, setProjectDetails] = useState<Record<string, any> | null>(null);
  const [generating, setGenerating]         = useState(false);
  const [generatedData, setGeneratedData]   = useState<{ formData: piwApi.PIWFormData; blob: Blob } | null>(null);
  const [addCrmVisible, setAddCrmVisible]   = useState(false);
  const [newCrmValue, setNewCrmValue]       = useState('');

  const [resourceRows, setResourceRows] = useState<PiwResourceEntry[]>([
    { key: 'r0', raidId: '', empName: '', piwRole: '', totalWorkex: '', skillType: 'Commodity', dailyRate: 0, resourceStartDate: '', resourceEndDate: '' },
  ]);
  const [raidErrors, setRaidErrors] = useState<{ notFound: string[]; duplicates: string[]; missing: number[] } | null>(null);

  // SOW options from process overview
  const sowOptions = useMemo(() =>
    [...new Set(processRows.map(r => r.sow).filter(Boolean))],
    [processRows]
  );

  // Auto-populate CRM from selected SOW
  const handleSowChange = (sowName: string) => {
    const match = processRows.find(r => r.sow === sowName);
    if (match?.salesforceId) {
      step1Form.setFieldValue('crmOpportunityId', match.salesforceId);
      setAddCrmVisible(false);
    } else {
      step1Form.setFieldValue('crmOpportunityId', '');
      setAddCrmVisible(true);
    }
  };

  const handleRaidChange = (raidId: string, index: number) => {
    const isDuplicate = resourceRows.some((r, i) => i !== index && r.raidId === raidId);
    if (isDuplicate) {
      const res = resources.find(r => r.raId === raidId);
      message.error({
        content: <span><strong>{res?.empName || raidId}</strong> is already added. Each resource can only appear once per PIW.</span>,
        duration: 4,
      });
      return;
    }
    const res = resources.find(r => r.raId === raidId);
    setResourceRows(prev => {
      const next = [...prev];
      if (res) {
        const skillType = next[index].skillType || 'Commodity';
        const rate = lookupDailyRate(res.totalWorkex, skillType);
        next[index] = { ...next[index], raidId, empName: res.empName, piwRole: res.piwRole, totalWorkex: res.totalWorkex, dailyRate: rate };
      } else {
        next[index] = { ...next[index], raidId, empName: '', piwRole: '', totalWorkex: '', dailyRate: 0 };
      }
      return next;
    });
  };

  const handleSkillTypeChange = (skillType: string, index: number) => {
    setResourceRows(prev => {
      const next = [...prev];
      const row = next[index];
      const rate = row.totalWorkex ? lookupDailyRate(row.totalWorkex, skillType) : 0;
      next[index] = { ...row, skillType, dailyRate: rate };
      return next;
    });
  };

  const updateResourceRow = (index: number, field: keyof PiwResourceEntry, value: string | number) => {
    setResourceRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addResourceRow = () =>
    setResourceRows(prev => [...prev, { key: `r${Date.now()}`, raidId: '', empName: '', piwRole: '', totalWorkex: '', skillType: 'Commodity', dailyRate: 0, manualDailyRate: '', resourceStartDate: '', resourceEndDate: '' }]);

  const removeResourceRow = (key: string) =>
    setResourceRows(prev => prev.filter(r => r.key !== key));

  // Excel upload for resource rows
  // Normalise Excel date values → 'YYYY-MM-DD' string.
  // Strategy: use raw:false so XLSX gives us the pre-formatted display string (e.g. "1/1/26")
  // which is always correct regardless of timezone.
  const normalizeExcelDate = (val: any): string => {
    if (!val) return '';
    const s = String(val).trim();
    // Already ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // M/D/YY or M/D/YYYY (Excel display format in en-US locale)
    const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (mdy2) return `${2000 + parseInt(mdy2[3])}-${mdy2[1].padStart(2,'0')}-${mdy2[2].padStart(2,'0')}`;
    const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy4) return `${mdy4[3]}-${mdy4[1].padStart(2,'0')}-${mdy4[2].padStart(2,'0')}`;
    // DD-MM-YYYY or DD/MM/YYYY (Indian locale)
    const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`;
    return s;
  };

  const handleResourceExcelUpload = (file: File) => {
    setRaidErrors(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { raw: false });
        const newRows: PiwResourceEntry[] = [];
        const notFound: string[] = [];
        const duplicates: string[] = [];
        const missing: number[] = [];

        rows.forEach((row, i) => {
          const raidId = String(row['RAID'] || row['RA ID'] || row['Ra Id'] || '').trim();
          if (!raidId) { missing.push(i + 2); return; }

          if (newRows.some(r => r.raidId === raidId)) { duplicates.push(raidId); return; }

          const res = resources.find(r => r.raId === raidId);
          if (!res) { notFound.push(raidId); return; }

          const skillType = String(row['Skill Type'] || row['skill_type'] || 'Commodity').trim();
          const normalizedSkill = skillType.toLowerCase().includes('spec') ? 'Specialized' : 'Commodity';
          const rateOverride = String(row['Daily Rate (INR)'] || row['Daily Rate'] || '').replace(/[^\d]/g, '');
          const rate = lookupDailyRate(res.totalWorkex, normalizedSkill);

          newRows.push({
            key: `r_xl_${Date.now()}_${i}`,
            raidId,
            empName: res.empName,
            piwRole: res.piwRole,
            totalWorkex: res.totalWorkex,
            skillType: normalizedSkill,
            dailyRate: rate,
            manualDailyRate: rateOverride,
            resourceStartDate: normalizeExcelDate(row['Start Date'] || row['start_date']),
            resourceEndDate:   normalizeExcelDate(row['End Date']   || row['end_date']),
          });
        });

        const hasIssues = notFound.length > 0 || duplicates.length > 0 || missing.length > 0;
        if (hasIssues) setRaidErrors({ notFound, duplicates, missing });

        if (newRows.length === 0) {
          // Nothing loaded — only show errors, don't clear existing rows
          if (!hasIssues) message.error('No valid resource rows found in file');
          return;
        }

        setResourceRows(newRows);
        if (!hasIssues) message.success(`${newRows.length} resource(s) loaded from Excel`);
        else message.warning(`${newRows.length} resource(s) loaded — see errors below`);
      } catch (e: any) { message.error(e.message || 'Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const downloadResourceTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'RAID': 'RA001', 'Skill Type': 'Commodity', 'Daily Rate (INR)': '', 'Start Date': '2026-07-01', 'End Date': '2026-09-30' },
      { 'RAID': 'RA002', 'Skill Type': 'Specialized', 'Daily Rate (INR)': '', 'Start Date': '2026-08-01', 'End Date': '2026-10-31' },
    ]);
    ws['!cols'] = [{ wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }];
    const wb2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb2, ws, 'PIW Resources');
    XLSX.writeFile(wb2, 'PIW_Resources_Template.xlsx');
  };

  const handleStep1Next = async () => {
    try {
      const values = await step1Form.validateFields();
      setProjectDetails(values);
      setCurrentStep(1);
    } catch { /* validation errors shown inline */ }
  };

  const handleGenerate = async () => {
    const valid = resourceRows.filter(r => r.raidId && r.empName);
    if (valid.length === 0) {
      message.error('Please select at least one resource');
      return;
    }
    // Validate every resource has start and end dates
    const missingDates = valid.filter(r => !r.resourceStartDate || !r.resourceEndDate);
    if (missingDates.length > 0) {
      message.error(`Please set start and end dates for: ${missingDates.map(r => r.empName).join(', ')}`);
      return;
    }
    // Validate end > start per resource
    const invalidDates = valid.filter(r => new Date(r.resourceEndDate) <= new Date(r.resourceStartDate));
    if (invalidDates.length > 0) {
      message.error(`End date must be after start date for: ${invalidDates.map(r => r.empName).join(', ')}`);
      return;
    }
    if (!projectDetails) return;

    // Derive overall project dates from resource date ranges
    const allStarts = valid.map(r => r.resourceStartDate).sort();
    const allEnds   = valid.map(r => r.resourceEndDate).sort();
    const overallStart = allStarts[0];
    const overallEnd   = allEnds[allEnds.length - 1];

    setGenerating(true);
    try {
      const formData: piwApi.PIWFormData = {
        clientCompanyName: projectDetails.clientCompanyName || '',
        projectName:       projectDetails.projectName,
        sowNumber:         projectDetails.sowNumber,
        crmOpportunityId:  projectDetails.crmOpportunityId,
        contractType:      projectDetails.contractType,
        currency:          projectDetails.currency || 'INR',
        plannedStartDate:  overallStart,
        plannedEndDate:    overallEnd,
        resources: valid.map(r => ({
          raId: r.raidId, name: r.empName, resourceType: r.piwRole,
          skillType: r.skillType,
          dailyRate: r.manualDailyRate ? Number(r.manualDailyRate) : r.dailyRate,
          resourceStartDate: r.resourceStartDate || undefined,
          resourceEndDate:   r.resourceEndDate   || undefined,
        })),
      };

      const blob = await piwApi.generatePIW(formData);
      setGeneratedData({ formData, blob });
      setCurrentStep(2);
      message.success('PIW generated — review below and download when ready');
    } catch (e: any) {
      message.error(e.message || 'Failed to generate PIW');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedData) return;
    const sow = generatedData.formData.sowNumber || '';
    const piwName = 'PIW - ' + sow.replace(/^SOW\s*[-–—]?\s*/i, '').trim();
    piwApi.downloadPIW(generatedData.blob, piwName);
    message.success('PIW downloaded');
  };

  const handleReset = () => {
    step1Form.resetFields();
    step1Form.setFieldsValue({ projectName: 'TBD', sowNumber: 'TBD', crmOpportunityId: 'TBD' });
    setCurrentStep(0);
    setProjectDetails(null);
    setGeneratedData(null);
    setAddCrmVisible(false);
    setResourceRows([{ key: 'r0', raidId: '', empName: '', piwRole: '', totalWorkex: '', skillType: 'Commodity', dailyRate: 0, manualDailyRate: '', resourceStartDate: '', resourceEndDate: '' }]);
    setRaidErrors(null);
  };

  const inputStyle = { width: '100%', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: '12px' };
  const fl = (txt: string) => <span style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>{txt}</span>;
  const sectionTitle = (txt: string) => (
    <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626', display: 'block', marginBottom: 12 }}>{txt}</Text>
  );

  return (
    <div>
      {/* ── Header: title + More Actions (⋯) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>Fill the form to generate PIW</Text>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              {
                key: 'download-resource-template',
                icon: <DownloadOutlined style={{ fontSize: '11px' }} />,
                label: <span style={{ fontSize: '11px' }}>Download Resource Upload Template</span>,
                onClick: downloadResourceTemplate,
              },
              {
                key: 'download-template',
                icon: <FileExcelOutlined style={{ fontSize: '11px' }} />,
                label: <span style={{ fontSize: '11px' }}>Download PIW Template</span>,
                onClick: async () => {
                  try {
                    const result = await templateApi.getTemplates('piw_template');
                    if (result.ok && result.data && result.data.length > 0) {
                      const tpl = result.data[0];
                      await templateApi.downloadTemplate(tpl.id, tpl.file_name || 'PIW_template.xlsm');
                      message.success('PIW template downloaded');
                    } else {
                      message.info('No PIW template uploaded yet. Upload one in Configuration > Templates');
                    }
                  } catch (e: any) { message.error(e.message || 'Download failed'); }
                },
              },
              ...(spUrl ? [{
                key: 'open-sp',
                icon: <ShareAltOutlined style={{ fontSize: '11px' }} />,
                label: (
                  <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'inherit' }}>
                    Open SharePoint Folder ↗
                  </a>
                ),
              }] : []),
            ],
          }}
        >
          <Button size="small" type="text" icon={<EllipsisOutlined />} style={{ fontSize: '11px', borderRadius: 4 }} />
        </Dropdown>
      </div>

      {/* Steps indicator */}
      <Steps current={currentStep} size="small" style={{ marginBottom: 16 }}>
        <Steps.Step title={<span style={{ fontSize: '11px' }}>Project Details</span>} />
        <Steps.Step title={<span style={{ fontSize: '11px' }}>Resources</span>} />
        <Steps.Step title={<span style={{ fontSize: '11px' }}>Review & Download</span>} />
      </Steps>

      {/* ── STEP 1: Project Details ── */}
      {currentStep === 0 && (
        <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          <Form form={step1Form} layout="vertical" size="small" initialValues={{ contractType: 'T&M', currency: 'INR', projectName: 'TBD', sowNumber: 'TBD', crmOpportunityId: 'TBD' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Form.Item
                label={
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>
                    Project / Engagement Name
                    {!engagementConfig && (
                      <span style={{ color: '#1890ff', fontSize: '10px', marginLeft: 6 }}>
                        (Link a config type in <strong>Configuration</strong> → select type → Link to <em>"PIW — Project / Engagement Name"</em>)
                      </span>
                    )}
                  </span>
                }
                name="projectName"
                rules={[{ required: true, message: 'Required' }]}
              >
                {engagementNames.length > 0 ? (
                  <Select placeholder="Select project" showSearch>
                    {engagementNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}
                  </Select>
                ) : (
                  <Input placeholder="Enter project / engagement name" />
                )}
              </Form.Item>
              <Form.Item label={fl('SOW Name')} name="sowNumber" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select SOW or type TBD" showSearch onChange={handleSowChange} allowClear
                  dropdownRender={menu => (
                    <>
                      {menu}
                      <div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0' }}>
                        <Input
                          size="small"
                          placeholder="Type manually (e.g. TBD)"
                          style={{ fontSize: '11px' }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const v = (e.target as HTMLInputElement).value.trim();
                              if (v) { step1Form.setFieldValue('sowNumber', v); handleSowChange(v); }
                            }
                          }}
                        />
                      </div>
                    </>
                  )}
                >
                  {sowOptions.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item
                label={fl('CRM Opportunity #')}
                name="crmOpportunityId"
                rules={[{ required: false }]}
              >
                <Input placeholder="Auto-populated from SOW · or enter manually" />
              </Form.Item>
              {addCrmVisible && (
                <div style={{ gridColumn: '1 / -1', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: '11px', color: '#873800' }}>
                  ⚠️ No CRM Opportunity linked to this SOW.{' '}
                  <span
                    style={{ color: '#1890ff', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => {
                      const v = step1Form.getFieldValue('crmOpportunityId');
                      const sow = step1Form.getFieldValue('sowNumber');
                      if (v && sow && onUpdateProcessRow) {
                        const row = processRows.find(r => r.sow === sow);
                        if (row) { onUpdateProcessRow(row.key, { salesforceId: v }); message.success('CRM ID saved to Process Overview'); setAddCrmVisible(false); }
                      } else if (!v) {
                        message.warning('Enter a CRM ID above first');
                      }
                    }}
                  >
                    Save to Process Overview
                  </span>
                </div>
              )}
              <Form.Item label={fl('Contract Type')} name="contractType" rules={[{ required: true, message: 'Required' }]}>
                <Select>
                  <Select.Option value="T&M">T&M (Time &amp; Material)</Select.Option>
                  <Select.Option value="Fixed Fee">Fixed Fee</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item label={fl('Currency')} name="currency">
                <Select>
                  <Select.Option value="INR">INR — Indian Rupee</Select.Option>
                  <Select.Option value="USD">USD — US Dollar</Select.Option>
                  <Select.Option value="EUR">EUR — Euro</Select.Option>
                  <Select.Option value="GBP">GBP — British Pound</Select.Option>
                </Select>
              </Form.Item>
            </div>
            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 8 }}>
              📅 Overall project start &amp; end dates will be derived from the earliest and latest resource engagement dates set in the next step.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <Button type="primary" size="small" style={{ fontSize: '11px' }} onClick={handleStep1Next}>Next → Resources</Button>
            </div>
          </Form>
        </Card>
      )}

      {/* ── STEP 2: Resources ── */}
      {currentStep === 1 && (
        <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>Delivery Workstream — Select Resources</Text>
            <Space>
              <Upload beforeUpload={handleResourceExcelUpload} showUploadList={false} accept=".xlsx,.xls">
                <Button size="small" icon={<UploadOutlined />} style={{ fontSize: '11px' }}>Upload Excel</Button>
              </Upload>
            </Space>
          </div>

          <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 6, padding: '6px 12px', marginBottom: 12, fontSize: '11px', color: '#003eb3' }}>
            <strong>{projectDetails?.projectName}</strong>&nbsp;·&nbsp;{projectDetails?.sowNumber}&nbsp;·&nbsp;
            {projectDetails?.contractType}&nbsp;·&nbsp;INR
          </div>
          {resources.length === 0 && (
            <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: '11px', color: '#cf1322' }}>
              ⚠️ No resources found. Please add resources in <strong>Resource Hub</strong> first.
            </div>
          )}

          {/* Persistent RAID errors from Excel upload */}
          {raidErrors && (
            <Alert
              type={raidErrors.notFound.length > 0 ? 'error' : 'warning'}
              showIcon
              closable
              onClose={() => setRaidErrors(null)}
              message={
                raidErrors.notFound.length > 0
                  ? `${raidErrors.notFound.length} RAID ID(s) not found in Resource Hub — rows skipped`
                  : `${raidErrors.duplicates.length + raidErrors.missing.length} row(s) skipped`
              }
              description={
                <div style={{ fontSize: '11px' }}>
                  {raidErrors.notFound.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <strong>Not found in Resource Hub:</strong>{' '}
                      {raidErrors.notFound.map(r => <Tag key={r} color="red" style={{ fontSize: '10px', marginBottom: 2 }}>{r}</Tag>)}
                      <br /><span style={{ color: '#8c8c8c' }}>Ensure the RA ID in Resource Hub matches exactly (check the RA ID column in Resource Hub).</span>
                    </div>
                  )}
                  {raidErrors.duplicates.length > 0 && (
                    <div style={{ marginBottom: 4 }}>
                      <strong>Duplicate RAIDs skipped:</strong>{' '}
                      {raidErrors.duplicates.map(r => <Tag key={r} color="orange" style={{ fontSize: '10px', marginBottom: 2 }}>{r}</Tag>)}
                    </div>
                  )}
                  {raidErrors.missing.length > 0 && (
                    <div>
                      <strong>Rows with missing RAID (skipped):</strong> Row {raidErrors.missing.join(', Row ')}
                    </div>
                  )}
                </div>
              }
              style={{ marginBottom: 12, fontSize: '12px' }}
            />
          )}

          {resourceRows.map((row, index) => {
            const selectedInOtherRows = new Set(
              resourceRows.filter((_, i) => i !== index).map(r => r.raidId).filter(Boolean)
            );
            const dateStyle: React.CSSProperties = { width: '100%', padding: '3px 7px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: '11px', color: '#595959', outline: 'none' };
            return (
              <div key={row.key} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
                {/* Row 1: S.No · RAID · Name · PIW Role · Delete */}
                <div style={{ display: 'grid', gridTemplateColumns: '28px 180px 1fr 150px 24px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1890ff', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {index + 1}
                  </div>
                  <Select
                    size="small" showSearch
                    placeholder="Select RAID"
                    value={row.raidId || undefined}
                    onChange={v => handleRaidChange(v, index)}
                    style={{ width: '100%', fontSize: '11px' }}
                    filterOption={(input, option) => {
                      const label = String(option?.label || '').toLowerCase();
                      return label.includes(input.toLowerCase());
                    }}
                    options={resources.map(r => ({
                      value: r.raId,
                      label: `${r.raId} · ${r.empName}`,
                      disabled: selectedInOtherRows.has(r.raId),
                    }))}
                  />
                  <Input size="small" value={row.empName} readOnly placeholder="Name" style={{ background: '#fafafa', color: '#595959', fontSize: '11px' }} />
                  <Input size="small" value={row.piwRole} readOnly placeholder="PIW Role" style={{ background: '#fafafa', color: '#595959', fontSize: '11px' }} />
                  <Button size="small" type="text" danger onClick={() => removeResourceRow(row.key)} style={{ padding: '0 4px', fontSize: '11px' }}>✕</Button>
                </div>
                {/* Row 2: Skill Type · Daily Rate · Hourly Rate · Start Date · End Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 95px 75px 1fr 1fr', gap: 6, alignItems: 'center' }}>
                  <Select
                    size="small"
                    value={row.skillType || 'Commodity'}
                    onChange={v => handleSkillTypeChange(v, index)}
                    style={{ fontSize: '11px' }}
                    options={[
                      { value: 'Commodity',   label: 'Commodity' },
                      { value: 'Specialized', label: 'Specialized' },
                    ]}
                  />
                  <Input size="small"
                    value={row.manualDailyRate}
                    onChange={e => updateResourceRow(index, 'manualDailyRate', e.target.value.replace(/[^\d]/g, ''))}
                    placeholder={row.dailyRate ? `Auto: ${row.dailyRate.toLocaleString()}` : 'Daily rate'}
                    prefix={<span style={{ fontSize: '10px', color: '#595959' }}>₹</span>}
                    style={{ textAlign: 'right', color: '#595959', fontSize: '11px' }} />
                  <Input size="small"
                    value={(() => { const d = row.manualDailyRate ? Number(row.manualDailyRate) : row.dailyRate; return d ? (d / 8).toFixed(2) : ''; })()}
                    readOnly
                    style={{ background: '#f6ffed', textAlign: 'right', color: '#389e0d', fontWeight: 500, fontSize: '11px' }} />
                  <input type="date" value={row.resourceStartDate || ''} placeholder="Start Date"
                    onChange={e => updateResourceRow(index, 'resourceStartDate', e.target.value)}
                    style={dateStyle} />
                  <input type="date" value={row.resourceEndDate || ''} placeholder="End Date"
                    onChange={e => updateResourceRow(index, 'resourceEndDate', e.target.value)}
                    style={dateStyle} />
                </div>
                {/* Row 2 labels */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 95px 75px 1fr 1fr', gap: 6, marginTop: 2 }}>
                  {['Skill Type', 'Daily Rate', 'Hourly Rate', 'Engagement Start', 'Engagement End'].map(h => (
                    <span key={h} style={{ fontSize: '10px', color: '#bfbfbf' }}>{h}</span>
                  ))}
                </div>
              </div>
            );
          })}

          <Button type="dashed" size="small" block onClick={addResourceRow} icon={<PlusOutlined />}
            style={{ marginTop: 4, marginBottom: 16, borderRadius: 4, fontSize: '11px' }}>
            Add Resource
          </Button>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button size="small" style={{ fontSize: '11px' }} onClick={() => setCurrentStep(0)}>← Back</Button>
            <Space>
              <Button size="small" style={{ fontSize: '11px' }} onClick={handleReset}>Reset</Button>
              <Button type="primary" size="small" style={{ fontSize: '11px' }} loading={generating} onClick={handleGenerate}>Generate PIW</Button>
            </Space>
          </div>
        </Card>
      )}

      {/* ── STEP 3: Preview & Download ── */}
      {currentStep === 2 && generatedData && (
        <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            {sectionTitle('Generated PIW — Review & Download')}
            <Space>
              <Button size="small" style={{ fontSize: '11px' }} onClick={() => setCurrentStep(1)}>← Back to Resources</Button>
              <Button type="primary" size="small" style={{ fontSize: '11px' }} icon={<DownloadOutlined />} onClick={handleDownload}>
                Download PIW (.xlsm)
              </Button>
              <Button size="small" style={{ fontSize: '11px' }} onClick={handleReset}>New PIW</Button>
            </Space>
          </div>

          {/* Front Page Summary */}
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1890ff', display: 'block', marginBottom: 8 }}>📄 Front Page</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {[
                ['Project / Engagement', generatedData.formData.projectName],
                ['SOW Name', generatedData.formData.sowNumber],
                ['CRM Opportunity', generatedData.formData.crmOpportunityId || '—'],
                ['Contract Type', generatedData.formData.contractType],
                ['Currency', generatedData.formData.currency || 'INR'],
                ['Overall Start Date', generatedData.formData.plannedStartDate],
                ['Overall End Date', generatedData.formData.plannedEndDate],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: '11px' }}>
                  <span style={{ color: '#8c8c8c', minWidth: 140 }}>{label}:</span>
                  <span style={{ color: '#262626', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Workstream */}
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1890ff', display: 'block', marginBottom: 8 }}>
              📊 Delivery Workstream ({generatedData.formData.resources.length} resource{generatedData.formData.resources.length !== 1 ? 's' : ''})
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px 70px 95px 95px', gap: 4, marginBottom: 6 }}>
              {['RAID', 'Resource Name', 'PIW Role', 'Daily Rate', 'Hrly Rate', 'Start Date', 'End Date'].map((h, hi) => (
                <span key={h} style={{ fontSize: '10px', fontWeight: 500, color: '#8c8c8c', textAlign: hi === 3 || hi === 4 ? 'center' : 'left' }}>{h}</span>
              ))}
            </div>
            {generatedData.formData.resources.map((r, i) => {
              return (
                <div key={i} style={{ padding: '6px 0', borderTop: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 100px 90px 70px 95px 95px', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#8c8c8c', fontFamily: 'monospace' }}>{r.raId || '—'}</span>
                    <span style={{ fontSize: '11px', color: '#262626', fontWeight: 500 }}>{r.name}</span>
                    <span style={{ fontSize: '11px', color: '#595959' }}>{r.resourceType}</span>
                    <span style={{ fontSize: '11px', color: '#595959', textAlign: 'center' }}>₹{r.dailyRate?.toLocaleString()}</span>
                    <span style={{ fontSize: '11px', color: '#389e0d', textAlign: 'center', fontWeight: 500 }}>
                      {r.dailyRate ? (r.dailyRate / 8).toFixed(2) : '—'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#595959' }}>{r.resourceStartDate || '—'}</span>
                    <span style={{ fontSize: '11px', color: '#595959' }}>{r.resourceEndDate   || '—'}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 2, paddingLeft: 2 }}>
                    {r.skillType ? <span style={{ color: r.skillType === 'Specialized' ? '#722ed1' : '#1890ff' }}>{r.skillType}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// --- PIW Upload Sub-tab ---
interface PiwUploadSubTabProps {
  processRows: ProcessRow[];
  resources?: ResourceRow[];
  onUpdateProcessRow?: (key: string, updates: Partial<ProcessRow>) => void;
  onResourcesLinked?: () => void;
}

function PiwUploadSubTab({ processRows, resources = [], onUpdateProcessRow, onResourcesLinked }: PiwUploadSubTabProps) {
  const { getAppValue } = useConfig();
  const { currentUser } = useAuth();
  const changedBy = currentUser?.username || currentUser?.name || 'system';
  const spUrl = getAppValue('PIW_STORAGE_URL') || '';
  const [selectedSow, setSelectedSow] = useState<string | undefined>(undefined);
  const [existingPiw, setExistingPiw] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unmatchedRaids, setUnmatchedRaids] = useState<{ raidsFound: string[]; unmatched: string[]; resourceCount: number } | null>(null);
  const [uploadedList, setUploadedList] = useState<{ key: string; file: File; piwName: string; sowName: string; date: string; linkedCount: number }[]>([]);

  const sowOptions = processRows.map(r => ({ value: r.key, label: r.sow }));

  const handleSowChange = (v: string | undefined) => {
    setSelectedSow(v);
    if (v) {
      const row = processRows.find(r => r.key === v);
      setExistingPiw(row?.piw?.trim() || undefined);
    } else {
      setExistingPiw(undefined);
    }
  };

  // Extract RAID IDs + Start/End Dates from PIW Excel/xlsm — targets the "Calculation" sheet.
  // Reads only the contiguous Section 1 block: walks rows from headerRow+1 and stops
  // at the first row where the "#" column is empty or non-integer.
  const extractRaidsFromExcel = async (file: File): Promise<{ raids: string[]; dateMap: Record<string, { startDate: string; endDate: string }> }> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const allRaids: string[] = [];
    const dateMap: Record<string, { startDate: string; endDate: string }> = {};

    const calcName = wb.SheetNames.find(n => /calculation/i.test(n));
    const sheetToSearch = calcName ? [calcName] : wb.SheetNames;

    for (const sheetName of sheetToSearch) {
      const ws = wb.Sheets[sheetName];
      const cells = Object.keys(ws).filter(k => !k.startsWith('!'));

      const raidHeaderCell = cells.find(k => String(ws[k].v || '').trim().toUpperCase() === 'RAID');
      const seqHeaderCell = cells.find(k => String(ws[k].v || '').trim() === '#');
      if (!raidHeaderCell) continue;

      const raidCol = raidHeaderCell.replace(/\d+/, '');
      const headerRow = parseInt(raidHeaderCell.replace(/[A-Z]+/, ''), 10);
      const seqCol = seqHeaderCell ? seqHeaderCell.replace(/\d+/, '') : 'A';

      // Find Start Date and End Date columns in the same header row
      const startDateHeaderCell = cells.find(k => {
        const row = parseInt(k.replace(/[A-Z]+/, ''), 10);
        return row === headerRow && /^start\s*date$/i.test(String(ws[k].v || '').trim());
      });
      const endDateHeaderCell = cells.find(k => {
        const row = parseInt(k.replace(/[A-Z]+/, ''), 10);
        return row === headerRow && /^end\s*date$/i.test(String(ws[k].v || '').trim());
      });
      const startCol = startDateHeaderCell ? startDateHeaderCell.replace(/\d+/, '') : null;
      const endCol = endDateHeaderCell ? endDateHeaderCell.replace(/\d+/, '') : null;

      // Helper to parse a cell value into ISO date string (timezone-safe — always uses local date parts)
      const localIso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const parseDate = (cellKey: string): string => {
        const cell = ws[cellKey];
        if (!cell) return '';
        // cellDates:true → cell.v may be a JS Date; use local getters to avoid UTC rollback
        if (cell.v instanceof Date) return localIso(cell.v);
        // Numeric serial (Excel date) — XLSX.SSF gives correct d/m/y
        if (typeof cell.v === 'number') {
          const d = XLSX.SSF.parse_date_code(cell.v);
          if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
        // String date like "2026-01-01" or "01-Jan-2026"
        const s = String(cell.v || '').trim();
        if (!s || s === '—' || s === '-') return '';
        // Parse as local midnight to avoid timezone shift
        const parts = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (parts) return s; // already ISO, no conversion needed
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return localIso(parsed);
        return '';
      };

      // Walk rows sequentially — stop at first row where # column is not a positive integer
      for (let row = headerRow + 1; row <= headerRow + 500; row++) {
        const seqCellKey = `${seqCol}${row}`;
        const seqVal = ws[seqCellKey] ? Number(ws[seqCellKey].v) : NaN;
        if (!Number.isInteger(seqVal) || seqVal <= 0) break; // end of section 1

        const raidCellKey = `${raidCol}${row}`;
        const v = ws[raidCellKey] ? String(ws[raidCellKey].v || '').trim() : '';
        if (v && v !== '—' && v !== '-') {
          allRaids.push(v);
          const startDate = startCol ? parseDate(`${startCol}${row}`) : '';
          const endDate = endCol ? parseDate(`${endCol}${row}`) : '';
          dateMap[v] = { startDate, endDate };
        }
      }

      if (allRaids.length > 0) break;
    }

    return { raids: [...new Set(allRaids)], dateMap };
  };

  const [linkDiag, setLinkDiag] = useState<{ step: string; detail: string } | null>(null);

  const doUpload = async (file: File, piwName: string, row: ProcessRow) => {
    setUploading(true);
    setUploadError(null);
    setUnmatchedRaids(null);
    try {
      // Fetch currently linked resources BEFORE linking new ones (for the result popup)
      const { resources: freshAll } = await resourceApi.getResources();
      const alreadyLinked = freshAll.filter((r: any) => {
        const pid = r.process_id != null ? Number(r.process_id) : null;
        return pid === row.id;
      }).map((r: any) => ({ raId: r.ra_id || '', empName: r.emp_name || '' }));

      // Save PIW name on the process record (update, never create)
      await processApi.updateProcess(row.id!, {
        sow: row.sow, sno: row.sno, startDate: row.startDate, signedSow: row.signedSow,
        piw: piwName, active: row.active, salesforceId: row.salesforceId,
        promsId: row.promsId, budget: row.budget, openAirCode: row.openAirCode,
        eprev: row.eprev, comments: row.comments, accountAnchor: row.accountAnchor,
        changedBy,
      });
      // Explicit audit entry for PIW Upload event (so it appears clearly in audit log)
      try {
        await fetch('http://localhost:3001/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            module: 'ra_process', record_id: row.id, record_name: row.sow,
            field: 'PIW Uploaded', old_value: row.piw || '', new_value: piwName, changed_by: changedBy,
          }),
        });
      } catch (_) {}
      if (onUpdateProcessRow) onUpdateProcessRow(row.key, { piw: piwName });
      setExistingPiw(piwName);

      // Parse Excel for RAIDs and auto-link matched resources
      let linkedCount = 0;
      const unmatched: string[] = [];
      let raidsFound: string[] = [];
      if (file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
        setLinkDiag({ step: 'scanning', detail: `Resource Hub: ${resources.length} resources. Scanning Calculation sheet…` });

        if (resources.length === 0) {
          setUploadError('Resource Hub has 0 resources loaded. Navigate to Resource Hub tab first to load resources, then retry the upload.');
          setLinkDiag(null);
        } else {
          raidsFound = await extractRaidsFromExcel(file);
          const raidDateMap = raidsFound.dateMap ?? {};
          const raids = raidsFound.raids ?? raidsFound as unknown as string[];
          raidsFound = raids; // keep rest of code using raidsFound as string[]
          setLinkDiag({ step: 'matched', detail: `Found ${raids.length} RAID(s) in Excel: [${raids.join(', ') || 'none'}]. Hub has: [${resources.map(r => r.raId).join(', ')}]` });

          if (raids.length === 0) {
            setUnmatchedRaids({ raidsFound: [], unmatched: [], resourceCount: resources.length });
          } else if (row.id) {
            const matched = raids
              .map((raid: string) => resources.find(r => r.raId?.trim().toLowerCase() === raid.toLowerCase()))
              .filter(Boolean) as ResourceRow[];
            const noMatch = raids.filter((raid: string) => !resources.find(r => r.raId?.trim().toLowerCase() === raid.toLowerCase()));
            unmatched.push(...noMatch);

            setLinkDiag({ step: 'linking', detail: `Matched: [${matched.map(r => `${r.raId}(id=${r.id})`).join(', ')}]. Not matched: [${noMatch.join(', ')}]` });

            const failedLinks: string[] = [];
            const dateResults: { raId: string; empName: string; prevStart: string; prevEnd: string; startDate: string; endDate: string; dateError?: string }[] = [];

            for (const res of matched) {
              if (!res.id) { failedLinks.push(`${res.raId}: no DB id`); continue; }
              try {
                const ok = await resourceApi.setProcessLink(res.id, row.id, changedBy);
                if (ok) linkedCount++;
                else failedLinks.push(`${res.raId}: server returned false`);
              } catch (err: any) {
                failedLinks.push(`${res.raId}: ${err.message || 'error'}`);
              }

              // Update engagement dates from PIW Section 1
              const dates = raidDateMap[res.raId?.trim() || ''] || raidDateMap[raids.find((r: string) => r.toLowerCase() === res.raId?.trim().toLowerCase()) || ''];
              const prevStart = res.engagementStartDate || '';
              const prevEnd = res.engagementEndDate || '';
              if (dates && (dates.startDate || dates.endDate)) {
                try {
                  await resourceApi.updateResource(res.id, {
                    engagementStartDate: dates.startDate || '',
                    engagementEndDate: dates.endDate || '',
                    changedBy,
                  });
                  dateResults.push({ raId: res.raId, empName: res.empName, prevStart, prevEnd, startDate: dates.startDate, endDate: dates.endDate });
                } catch (err: any) {
                  dateResults.push({ raId: res.raId, empName: res.empName, prevStart, prevEnd, startDate: dates.startDate, endDate: dates.endDate, dateError: err.message || 'failed' });
                }
              } else {
                dateResults.push({ raId: res.raId, empName: res.empName, prevStart, prevEnd, startDate: '', endDate: '', dateError: 'No dates found in PIW Section 1' });
              }
            }
            setLinkDiag(null);
            if (failedLinks.length > 0) setUploadError(`Failed to link ${failedLinks.length} resource(s): ${failedLinks.join('; ')}`);
            if (unmatched.length > 0) setUnmatchedRaids({ raidsFound: raids, unmatched, resourceCount: resources.length });
            onResourcesLinked?.();

            // Show clear Modal popup with full linking result
            Modal.info({
              title: '🔗 Resource Linking Results',
              width: 520,
              content: (
                <div style={{ fontSize: '12px' }}>
                  <p style={{ marginBottom: 8 }}>
                    <strong>RAIDs found in Calculation sheet (Section 1):</strong>{' '}
                    {raids.length > 0 ? raids.map((r: string) => <Tag key={r} style={{ fontSize: '11px' }}>{r}</Tag>) : <span style={{ color: '#8c8c8c' }}>None</span>}
                  </p>
                  {matched.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#389e0d' }}>✅ Newly linked ({matched.length - failedLinks.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {matched.map(r => (
                          <li key={r.raId} style={{ color: failedLinks.some(f => f.startsWith(r.raId)) ? '#cf1322' : '#389e0d', marginBottom: 4 }}>
                            {r.raId} — {r.empName} &nbsp;
                            {failedLinks.some(f => f.startsWith(r.raId))
                              ? <Tag color="red" style={{ fontSize: '10px' }}>Link Failed</Tag>
                              : <Tag color="green" style={{ fontSize: '10px' }}>Linked ✓</Tag>}
                            {/* Date update result */}
                            {(() => {
                              const dr = dateResults.find(d => d.raId === r.raId);
                              if (!dr) return null;
                              const fmtD = (iso: string) => {
                                if (!iso) return '—';
                                const d = new Date(iso + 'T00:00:00');
                                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                              };
                              if (dr.dateError) return (
                                <div style={{ color: '#cf1322', fontSize: '10px', marginTop: 3 }}>
                                  ⚠️ Dates not updated: {dr.dateError}
                                  {(dr.prevStart || dr.prevEnd) && <span style={{ color: '#8c8c8c' }}> (current: {fmtD(dr.prevStart)} → {fmtD(dr.prevEnd)})</span>}
                                </div>
                              );
                              if (dr.startDate || dr.endDate) return (
                                <div style={{ fontSize: '10px', marginTop: 3, color: '#595959' }}>
                                  {(dr.prevStart || dr.prevEnd) && (
                                    <span style={{ color: '#8c8c8c', textDecoration: 'line-through', marginRight: 6 }}>
                                      {fmtD(dr.prevStart)} → {fmtD(dr.prevEnd)}
                                    </span>
                                  )}
                                  <span style={{ color: '#389e0d' }}>
                                    📅 {fmtD(dr.startDate)} → {fmtD(dr.endDate)}
                                  </span>
                                </div>
                              );
                              return null;
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {noMatch.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#d46b08' }}>⚠️ Not found in Resource Hub ({noMatch.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {noMatch.map((r: string) => <li key={r} style={{ color: '#d46b08' }}>{r} — <span style={{ color: '#8c8c8c' }}>not in Resource Hub</span></li>)}
                      </ul>
                    </div>
                  )}
                  {alreadyLinked.length > 0 && (
                    <div style={{ marginBottom: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                      <strong style={{ color: '#595959' }}>🔗 Already linked to this SOW ({alreadyLinked.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {alreadyLinked.map(r => (
                          <li key={r.raId} style={{ color: '#595959' }}>
                            {r.raId} — {r.empName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {raids.length === 0 && (
                    <p style={{ color: '#cf1322' }}>⚠️ No RAID column found in Calculation sheet Section 1. Ensure the file was generated by this system.</p>
                  )}
                  <p style={{ marginTop: 10, color: '#8c8c8c', marginBottom: 0 }}>
                    Resource Hub has <strong>{resources.length}</strong> resources loaded.
                  </p>
                </div>
              ),
            });
          } // end if raidsFound.length > 0
        } // end else (resources > 0)
      } // end if xlsm/xlsx

      setUploadedList(prev => [...prev, { key: `piw_${Date.now()}`, file, piwName, sowName: row.sow, date: todayDateStr(), linkedCount }]);
      message.success(
        linkedCount > 0
          ? `PIW "${piwName}" linked to SOW "${row.sow}". ${linkedCount} resource(s) auto-linked.`
          : `PIW "${piwName}" linked to SOW "${row.sow}". No resources linked — check errors below.`,
        6,
      );
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    setUnmatchedRaids(null);
    setLinkDiag(null);
    if (!selectedSow) {
      setUploadError('Please select a SOW before uploading.');
      return false;
    }
    const piwName = file.name.replace(/\.[^/.]+$/, '').trim();

    // Uniqueness check — exclude the currently selected SOW row (it's being overwritten)
    const duplicate = processRows.find(
      r => r.piw?.trim().toLowerCase() === piwName.toLowerCase() && r.key !== selectedSow
    );
    if (duplicate) {
      setUploadError(`A PIW named "${piwName}" already exists on SOW "${duplicate.sow}". Please rename the file to a unique name before uploading.`);
      return false;
    }

    const row = processRows.find(r => r.key === selectedSow);
    if (!row) { setUploadError('Selected SOW not found. Please refresh and try again.'); return false; }

    if (existingPiw) {
      Modal.confirm({
        title: 'Overwrite existing PIW?',
        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
        content: (
          <span>
            This SOW already has PIW <strong>"{existingPiw}"</strong> linked.<br />
            Uploading <strong>"{piwName}"</strong> will <strong>replace</strong> it.<br /><br />
            To keep the existing PIW, cancel and unlink it from the process record first.
          </span>
        ),
        okText: 'Overwrite PIW',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => doUpload(file, piwName, row),
      });
    } else {
      doUpload(file, piwName, row);
    }
    return false;
  };

  return (
    <div>
      {/* SharePoint banner */}
      {spUrl ? (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 After uploading here, save the PIW document to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>
            Open SharePoint Folder ↗
          </a>
        </div>
      ) : (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure <strong>PIW_STORAGE_URL</strong> in App Configuration to link to your SharePoint PIW folder.
        </div>
      )}

      <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#389e0d' }}>
        📌 The <strong>file name</strong> (without extension) will become the <strong>PIW Name</strong>. Upload <strong>.xlsm</strong> files (PIW generated by this system) — RAID IDs will be read from the <strong>Calculation</strong> sheet and matching resources will be <strong>auto-linked</strong>.
      </div>

      {/* SOW selector */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 14px', marginBottom: existingPiw ? 8 : 16 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#595959', marginBottom: 8 }}>Select SOW to link this PIW to</div>
        <Select
          showSearch
          placeholder="Search and select a SOW…"
          style={{ width: '100%' }}
          size="small"
          value={selectedSow}
          onChange={handleSowChange}
          options={sowOptions}
          filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
          allowClear
        />
      </div>


      {/* Persistent error alert (actual errors only) */}
      {uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setUploadError(null)}
          message="Upload Error"
          description={uploadError}
          style={{ marginBottom: 14, fontSize: '12px' }}
        />
      )}

      {/* Diagnostic panel — shows scan progress */}
      {linkDiag && (
        <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: '11px', color: '#003eb3' }}>
          <Spin size="small" style={{ marginRight: 8 }} />
          {linkDiag.detail}
        </div>
      )}

      {/* Upload dragger */}
      <Upload.Dragger
        multiple={false}
        beforeUpload={handleFile}
        showUploadList={false}
        accept=".xlsx,.xls,.xlsm"
        disabled={uploading || !selectedSow}
        style={{ borderRadius: 8, marginBottom: 20 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: selectedSow ? '#1890ff' : '#d9d9d9' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px', color: selectedSow ? '#262626' : '#bfbfbf' }}>
          {uploading ? 'Saving PIW record…' : selectedSow ? 'Click or drag PIW document to upload' : 'Select a SOW above first'}
        </p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports .xlsm (recommended), .xlsx, .xls. File name = PIW Name. RAIDs in Calculation sheet auto-link resources.
        </p>
      </Upload.Dragger>

      {/* Uploaded list */}
      {uploadedList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '32px 0', textAlign: 'center' }}>
          <IdcardOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 8, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No PIW documents uploaded in this session.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded this session ({uploadedList.length})
          </Text>
          {uploadedList.map(({ key, file, piwName, sowName, date, linkedCount }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 8,
              border: '1px solid #f0f0f0', borderLeft: '3px solid #1890ff',
              padding: '10px 14px', marginBottom: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <IdcardOutlined style={{ color: '#1890ff', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                  PIW: {piwName} &nbsp;·&nbsp; SOW: {sowName} &nbsp;·&nbsp; {date} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Tag color="blue" style={{ fontSize: '10px', flexShrink: 0 }}>PIW Linked</Tag>
              {linkedCount > 0 && <Tag color="green" style={{ fontSize: '10px', flexShrink: 0 }}>{linkedCount} Resource{linkedCount !== 1 ? 's' : ''} Linked</Tag>}
              {spUrl && (
                <Tooltip title="Open SharePoint folder to save the file there" overlayInnerStyle={{ fontSize: '11px', maxWidth: 220 }}>
                  <Button
                    size="small"
                    style={{ borderRadius: 6, fontSize: '10px', borderColor: '#1890ff', color: '#1890ff' }}
                    onClick={() => {
                      downloadFile(file);
                      window.open(spUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Save to SP ↗
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Download file" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFile(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- PIW Tab Content (with Upload / Create sub-tabs) ---
interface PiwTabContentProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  onUpdateProcessRow?: (key: string, updates: Partial<ProcessRow>) => void;
  onResourcesLinked?: () => void;
}

function PiwTabContent({ resources, processRows, onUpdateProcessRow, onResourcesLinked }: PiwTabContentProps) {
  return (
    <Tabs
      defaultActiveKey="upload"
      size="small"
      tabBarStyle={{ marginBottom: 14 }}
      items={[
        {
          key: 'upload',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><UploadOutlined /> Upload</span>,
          children: <PiwUploadSubTab processRows={processRows} resources={resources} onUpdateProcessRow={onUpdateProcessRow} onResourcesLinked={onResourcesLinked} />,
        },
        {
          key: 'create',
          label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><IdcardOutlined /> Create</span>,
          children: <PiwTab resources={resources} processRows={processRows} onUpdateProcessRow={onUpdateProcessRow} />,
        },
      ]}
    />
  );
}

export function InternalProcess({ resources = [], initialSow }: { resources?: ResourceRow[]; initialSow?: string }) {
  const { getAppValue } = useConfig();
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [fromServer, setFromServer] = useState(false);
  const [resourceRefreshKey, setResourceRefreshKey] = useState(0);
  // Controlled tab state — when initialSow is provided, go to Process → Overview
  const [outerTab, setOuterTab] = useState(initialSow ? 'process' : 'sow');
  const [innerTab, setInnerTab] = useState('overview');

  useEffect(() => {
    processApi.getProcessRows().then(({ rows, fromServer: fs }) => {
      if (fs && rows.length > 0) {
        setProcessRows(rows.map((r: any, i: number) => ({
          key: `pr_db_${r.id || i}`,
          id: r.id,
          processId: r.process_id || '',
          sno: r.sno || i + 1,
          startDate:    r.start_date || '',
          sow:          r.sow || '',
          signedSow:    r.signed_sow || '',
          piw:          r.piw || '',
          active:       r.active || '',
          salesforceId: r.salesforce_id || '',
          promsId:      r.proms_id || '',
          budget:       r.budget || '',
          openAirCode:  r.open_air_code || '',
          eprev:        r.eprev || '',
          comments:     r.comments || '',
          accountAnchor: r.account_anchor || '',
        })));
        setFromServer(true);
      }
    });
  }, []);

  const handleSowUpload = (file: File, processKey: string) => {
    const name = file.name.replace(/\.[^/.]+$/, '');
    setProcessRows(prev => [...prev, {
      key: processKey,
      sno: prev.length + 1,
      startDate: todayDateStr(),
      sow: name,
      signedSow: '',
      piw: '',
      active: 'Yes',
      salesforceId: '',
      promsId: '',
      budget: '',
      openAirCode: '',
      eprev: '',
      comments: '',
      sowFile: file,
    }]);
  };

  const handleSowDelete = (processKey: string) => {
    setProcessRows(prev => prev.filter(r => r.key !== processKey).map((r, i) => ({ ...r, sno: i + 1 })));
  };

  const handleRowCreatedFromUpload = (row: ProcessRow) => {
    setProcessRows(prev => [...prev, row]);
  };

  const handleUpdateProcessRow = (key: string, updates: Partial<ProcessRow>) => {
    setProcessRows(prev => prev.map(r => r.key === key ? { ...r, ...updates } : r));
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderRadius: 10, padding: '0 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Tabs
          activeKey={outerTab}
          onChange={setOuterTab}
          tabBarStyle={{ marginBottom: 16, paddingTop: 4 }}
          items={[
            {
              key: 'sow',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><FileWordOutlined /> SOW</span>,
              children: <SowTabContent resources={resources} processRows={processRows} onRowCreated={handleRowCreatedFromUpload} spUrl={getAppValue('SOW_STORAGE_URL') || ''} />,
            },
            {
              key: 'piw',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><IdcardOutlined /> PIW</span>,
              children: <PiwTabContent resources={resources} processRows={processRows} onUpdateProcessRow={handleUpdateProcessRow} onResourcesLinked={() => setResourceRefreshKey(k => k + 1)} />,
            },
            {
              key: 'process',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><NodeIndexOutlined /> Process</span>,
              children: (
                <Tabs
                  activeKey={innerTab}
                  onChange={setInnerTab}
                  size="small"
                  tabBarStyle={{ marginBottom: 14 }}
                  items={[
                    {
                      key: 'overview',
                      label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><TableOutlined /> Overview</span>,
                      children: <ProcessTab rows={processRows} setRows={setProcessRows} fromServer={fromServer} setFromServer={setFromServer} resourceRefreshKey={resourceRefreshKey} initialSow={initialSow} />,
                    },
                    {
                      key: 'detailview',
                      label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><ExpandAltOutlined /> Detailed View</span>,
                      children: <ProcessDetailView rows={processRows} initialSow={initialSow} />,
                    },
                    {
                      key: 'insights',
                      label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}><BarChartOutlined /> Insights</span>,
                      children: <ProcessInsights rows={processRows} />,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
