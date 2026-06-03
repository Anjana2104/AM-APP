import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as processApi from '../api/processApi';
import {
  Tabs, Typography, Empty, Table, Button, Space, Tooltip, Upload, message,
  Drawer, Checkbox, Input, Select, Modal, Form, Tag, Popconfirm, Switch,
} from 'antd';
import {
  NodeIndexOutlined, FileProtectOutlined, IdcardOutlined,
  UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, TableOutlined,
  ClearOutlined, EyeOutlined, CheckCircleFilled, RightOutlined,
  BarChartOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useConfig } from '../context/ConfigContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartTooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import * as XLSX from 'xlsx';
import '../style.css';

const { Title, Text } = Typography;

// --- Types ---
interface ProcessRow {
  key: string;
  id?: number;
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
  comments: string;
  sowFile?: File;
  accountAnchor?: string;
}

// --- Auto-derive status ---
function deriveStatus(r: ProcessRow): 'Not Started' | 'In Progress' | 'Completed' {
  if (r.openAirCode?.trim()) return 'Completed';
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
  { key: 'budget',       label: 'Budget' },
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
];

const STAGE_COLORS = ['#1890ff', '#13c2c2', '#722ed1', '#fa8c16', '#eb2f96', '#52c41a'];

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
function PipelineCard({ r, onEdit, onView, onDelete }: { r: ProcessRow; onEdit: () => void; onView: () => void; onDelete: () => void }) {
  const status = deriveStatus(r);
  const statusColor = STATUS_COLORS[status];

  return (
    <div style={{
      background: '#fff', borderRadius: 10,
      border: `1px solid ${statusColor}33`,
      borderLeft: `4px solid ${statusColor}`,
      boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
      padding: '14px 16px', marginBottom: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#262626' }}>{r.sow || '—'}</div>
          {r.accountAnchor && (
            <div style={{ marginTop: 3 }}>
              <Tag color="purple" style={{ fontSize: '10px' }}>{r.accountAnchor}</Tag>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <Tooltip title="View" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<EyeOutlined />} size="small" onClick={onView} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<EditOutlined />} size="small" onClick={onEdit} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Popconfirm title="Delete this record?" description="This action cannot be undone." onConfirm={onDelete}
            okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
            <Tooltip title="Delete" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
            </Tooltip>
          </Popconfirm>
        </div>
      </div>

      {/* Pipeline steps */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {PIPELINE_STAGES.map((stage, idx) => {
          const done = !!stage.field(r)?.trim();
          const color = done ? STAGE_COLORS[idx] : '#d9d9d9';
          const value = stage.field(r)?.trim();
          return (
            <React.Fragment key={stage.key}>
              <Tooltip
                title={done && value ? <span style={{ fontSize: '11px' }}>{value}</span> : null}
                overlayInnerStyle={{ fontSize: '11px' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80, cursor: 'default' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: done ? color : '#f5f5f5',
                    border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', marginBottom: 4,
                    boxShadow: done ? `0 0 0 3px ${color}22` : 'none',
                  }}>
                    {done
                      ? <CheckCircleFilled style={{ color: '#fff', fontSize: '16px' }} />
                      : <span style={{ color: '#bfbfbf', fontSize: '11px', fontWeight: 700 }}>{idx + 1}</span>
                    }
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: done ? 700 : 400, color: done ? color : '#bfbfbf', textAlign: 'center', lineHeight: 1.2, maxWidth: 72 }}>
                    {stage.label}
                  </span>
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

// --- Process Insights Tab ---
function ProcessInsights({ rows }: { rows: ProcessRow[] }) {
  const monthData = useMemo(() => {
    const map = new Map<string, { total: number; notStarted: number; inProgress: number; completed: number }>();
    rows.forEach(r => {
      const month = parseMonthYear(r.startDate) || 'Unknown';
      const s = deriveStatus(r);
      const e = map.get(month) || { total: 0, notStarted: 0, inProgress: 0, completed: 0 };
      e.total++;
      if (s === 'Not Started') e.notStarted++;
      else if (s === 'In Progress') e.inProgress++;
      else e.completed++;
      map.set(month, e);
    });
    return Array.from(map.entries())
      .map(([month, d]) => ({ month, ...d }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
  }, [rows]);

  const totals = useMemo(() => ({
    total:      rows.length,
    notStarted: rows.filter(r => deriveStatus(r) === 'Not Started').length,
    inProgress: rows.filter(r => deriveStatus(r) === 'In Progress').length,
    completed:  rows.filter(r => deriveStatus(r) === 'Completed').length,
  }), [rows]);

  if (rows.length === 0) {
    return (
      <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: '12px' }}>No data yet — upload or add process records to see insights.</Text>}
        />
      </div>
    );
  }

  const hStyle = { fontSize: '11px', fontWeight: 700 as const };
  const cStyle = { fontSize: '11px' };

  const insightCols = [
    { title: 'Month', dataIndex: 'month', key: 'month', width: 120, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ ...cStyle, fontWeight: 600 }}>{v}</span> },
    { title: 'Total', dataIndex: 'total', key: 'total', width: 70, onHeaderCell: () => ({ style: hStyle }), render: (v: number) => <span style={{ ...cStyle, fontWeight: 700 }}>{v}</span> },
    { title: 'Not Started', dataIndex: 'notStarted', key: 'notStarted', width: 100, onHeaderCell: () => ({ style: hStyle }),
      render: (v: number) => v ? <Tag style={{ fontSize: '10px', background: '#8c8c8c18', color: '#8c8c8c', border: '1px solid #8c8c8c44' }}>{v}</Tag> : <span style={cStyle}>—</span> },
    { title: 'In Progress', dataIndex: 'inProgress', key: 'inProgress', width: 100, onHeaderCell: () => ({ style: hStyle }),
      render: (v: number) => v ? <Tag style={{ fontSize: '10px', background: '#1890ff18', color: '#1890ff', border: '1px solid #1890ff44' }}>{v}</Tag> : <span style={cStyle}>—</span> },
    { title: 'Completed', dataIndex: 'completed', key: 'completed', width: 100, onHeaderCell: () => ({ style: hStyle }),
      render: (v: number) => v ? <Tag style={{ fontSize: '10px', background: '#52c41a18', color: '#52c41a', border: '1px solid #52c41a44' }}>{v}</Tag> : <span style={cStyle}>—</span> },
  ];

  return (
    <div>
      {/* KPI strip */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Opportunities', count: totals.total,      color: '#262626' },
          { label: 'Not Started',         count: totals.notStarted, color: '#8c8c8c' },
          { label: 'In Progress',         count: totals.inProgress, color: '#1890ff' },
          { label: 'Completed',           count: totals.completed,  color: '#52c41a' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${s.color}33`, borderLeft: `3px solid ${s.color}`, borderRadius: 6, padding: '8px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#8c8c8c' }}>{s.label}</span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: s.color }}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Stacked bar chart */}
      <div style={{ background: '#fafafa', borderRadius: 8, padding: '14px 16px', marginBottom: 20, border: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 12 }}>Opportunities by Month (grouped by status)</Text>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={28} />
            <RechartTooltip
              contentStyle={{ fontSize: '11px', borderRadius: 6, border: '1px solid #f0f0f0' }}
              formatter={(val: any, name: string) => [val, name]}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 8 }} />
            <Bar dataKey="notStarted" name="Not Started" stackId="a" fill="#8c8c8c" />
            <Bar dataKey="inProgress"  name="In Progress"  stackId="a" fill="#1890ff" />
            <Bar dataKey="completed"   name="Completed"    stackId="a" fill="#52c41a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly breakdown table */}
      <div className="compact-table">
        <Table
          dataSource={monthData} columns={insightCols} rowKey="month"
          size="small" pagination={false}
          style={{ background: '#fff', borderRadius: 8 }}
        />
      </div>
    </div>
  );
}

// --- ProcessTab ---
interface ProcessTabProps {
  rows: ProcessRow[];
  setRows: React.Dispatch<React.SetStateAction<ProcessRow[]>>;
  fromServer?: boolean;
  setFromServer?: (v: boolean) => void;
}

function ProcessTab({ rows, setRows, fromServer, setFromServer }: ProcessTabProps) {
  const { configs } = useConfig();
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pendingFilters, setPendingFilters] = useState<Record<string, string>>({});
  const [editModal, setEditModal] = useState(false);
  const [editingRow, setEditingRow] = useState<ProcessRow | null>(null);
  const [viewModal, setViewModal] = useState(false);
  const [viewingRow, setViewingRow] = useState<ProcessRow | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [allocateModal, setAllocateModal] = useState(false);
  const [allocateAnchor, setAllocateAnchor] = useState('');
  const [allocateSelected, setAllocateSelected] = useState<string[]>([]);
  const [form] = Form.useForm();
  const filterPanelRef = useRef<HTMLDivElement>(null);

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    Object.fromEntries(COL_KEYS.map(c => [c.key, true]))
  );

  const isFilterApplied = Object.values(filters).some(Boolean);

  // Sync pendingFilters with applied filters when panel opens
  useEffect(() => {
    if (showFilterPanel) setPendingFilters(filters);
  }, [showFilterPanel]);

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

  const applyFilters = () => {
    setFilters(pendingFilters);
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
          comments:     String(r['Comments'] || '').trim(),
        }));

      if (!uploaded.length) { message.warning('No valid rows with SOW found'); return false; }

      let uploadSummary = { newCount: 0, updCount: 0 };
      let mergedRows: ProcessRow[] = [];

      setRows(prev => {
        const existingMap = new Map(prev.map(r => [r.sow.toLowerCase(), r]));
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
        uploadSummary = { newCount, updCount };
        mergedRows = Array.from(existingMap.values()).map((r, i) => ({ ...r, sno: i + 1 }));
        return mergedRows;
      });

      // Save to DB outside the updater (avoids Strict Mode double-invoke)
      setTimeout(() => {
        processApi.bulkSave(mergedRows.map(r => ({
          sow: r.sow, sno: r.sno, startDate: r.startDate, signedSow: r.signedSow,
          piw: r.piw, active: r.active, salesforceId: r.salesforceId,
          promsId: r.promsId, budget: r.budget, openAirCode: r.openAirCode,
          comments: r.comments, accountAnchor: r.accountAnchor || '',
        }))).then(result => { if (result.ok) setFromServer?.(true); });
        message.success(`Upload complete: ${uploadSummary.newCount} new, ${uploadSummary.updCount} updated`);
      }, 0);
    } catch (e: any) { message.error(e.message || 'Upload failed'); }
    return false;
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
  const openEdit = (r: ProcessRow) => { setEditingRow(r); form.setFieldsValue(r); setEditModal(true); };
  const openView = (r: ProcessRow) => { setViewingRow(r); setViewModal(true); };
  const handleDelete = (r: ProcessRow) => {
    setRows(prev => prev.filter(pr => pr.key !== r.key).map((pr, i) => ({ ...pr, sno: i + 1 })));
    if (r.id) processApi.deleteProcess(r.id);
  };
  const handleSave = () => {
    form.validateFields().then(vals => {
      if (editingRow) {
        setRows(prev => prev.map(r => r.key === editingRow.key ? { ...r, ...vals } : r));
        if (editingRow.id) processApi.updateProcess(editingRow.id, {
          startDate: vals.startDate || '', signedSow: vals.signedSow || '',
          piw: vals.piw || '', active: vals.active || '',
          salesforceId: vals.salesforceId || '', promsId: vals.promsId || '',
          budget: vals.budget || '', openAirCode: vals.openAirCode || '',
          comments: vals.comments || '', accountAnchor: vals.accountAnchor || '',
        });
      } else {
        const tempKey = `pr_${Date.now()}`;
        setRows(prev => [...prev, {
          key: tempKey, sno: prev.length + 1,
          startDate: '', signedSow: '', piw: '', active: '', salesforceId: '', promsId: '',
          budget: '', openAirCode: '', comments: '', sow: '', ...vals,
        }]);
        processApi.createProcess({
          sow: vals.sow || '', sno: 0, startDate: vals.startDate || '',
          signedSow: vals.signedSow || '', piw: vals.piw || '', active: vals.active || '',
          salesforceId: vals.salesforceId || '', promsId: vals.promsId || '',
          budget: vals.budget || '', openAirCode: vals.openAirCode || '',
          comments: vals.comments || '', accountAnchor: vals.accountAnchor || '',
        }).then(res => {
          if (res.ok && res.id) {
            setRows(prev => prev.map(r => r.key === tempKey ? { ...r, id: res.id } : r));
            setFromServer?.(true);
          }
        });
      }
      setEditModal(false);
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
    return true;
  }), [rows, filters]);

  // Pipeline view: Active=Yes + (showAll or not Completed)
  const pipelineRows = useMemo(() =>
    displayed.filter(r => r.active === 'Yes' && (showAll || deriveStatus(r) !== 'Completed')),
    [displayed, showAll]);

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
    if (!allocateSelected.length) { message.warning('Select at least one process entry'); return; }
    setRows(prev => prev.map(r => allocateSelected.includes(r.key) ? { ...r, accountAnchor: allocateAnchor } : r));
    message.success(`${allocateSelected.length} record(s) assigned to ${allocateAnchor}`);
    setAllocateModal(false);
    setAllocateAnchor('');
    setAllocateSelected([]);
  };

  const clearFilters = () => { setFilters({}); setPendingFilters({}); };

  const handleClearAll = () => {
    processApi.clearAll();
    setRows([]);
    setFromServer?.(false);
    message.success('All process records deleted');
  };

  // Table columns
  const hStyle = { fontSize: '11px', fontWeight: 700 as const };
  const cStyle = { fontSize: '11px' };

  const tableCols = [
    visibleColumns.sno        && { title: 'S.No.', dataIndex: 'sno', key: 'sno', width: 55, onHeaderCell: () => ({ style: hStyle }), render: (v: number) => <span style={cStyle}>{v}</span> },
    visibleColumns.startDate  && { title: 'Start Date', dataIndex: 'startDate', key: 'startDate', width: 90, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.sow        && { title: 'SOW', dataIndex: 'sow', key: 'sow', width: 240, onHeaderCell: () => ({ style: hStyle }),
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
    visibleColumns.signedSow  && { title: 'Signed SOW', dataIndex: 'signedSow', key: 'signedSow', width: 95, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => v ? <Tag color={v === 'Yes' ? 'green' : 'orange'} style={{ fontSize: '10px' }}>{v}</Tag> : null },
    visibleColumns.piw        && { title: 'PIW', dataIndex: 'piw', key: 'piw', width: 220, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.active     && { title: 'Active', dataIndex: 'active', key: 'active', width: 70, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => v ? <Tag color={v === 'Yes' ? 'green' : 'default'} style={{ fontSize: '10px' }}>{v}</Tag> : null },
    visibleColumns.salesforceId && { title: 'Salesforce ID', dataIndex: 'salesforceId', key: 'salesforceId', width: 130, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ ...cStyle, color: v ? '#1890ff' : undefined }}>{v}</span> },
    visibleColumns.promsId    && { title: 'PROMS ID', dataIndex: 'promsId', key: 'promsId', width: 110, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.budget     && { title: 'Budget', dataIndex: 'budget', key: 'budget', width: 120, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={{ ...cStyle, fontWeight: v ? 600 : 400 }}>{v}</span> },
    visibleColumns.openAirCode && { title: 'Open Air Code', dataIndex: 'openAirCode', key: 'openAirCode', width: 240, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.comments   && { title: 'Comments', dataIndex: 'comments', key: 'comments', width: 140, onHeaderCell: () => ({ style: hStyle }), render: (v: string) => <span style={cStyle}>{v}</span> },
    visibleColumns.accountAnchor && { title: 'Account Anchor', dataIndex: 'accountAnchor', key: 'accountAnchor', width: 130, onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => v
        ? <Tag color="purple" style={{ fontSize: '10px' }}>{v}</Tag>
        : <span style={{ ...cStyle, color: '#bfbfbf' }}>Unassigned</span>
    },
    { title: 'Status', key: 'status', width: 110, onHeaderCell: () => ({ style: hStyle }),
      render: (_: any, r: ProcessRow) => { const s = deriveStatus(r); return <Tag style={{ fontSize: '10px', background: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}44` }}>{s}</Tag>; }
    },
    {
      title: 'Actions', key: 'actions', width: 88, fixed: 'right' as const,
      onHeaderCell: () => ({ style: hStyle }),
      render: (_: any, r: ProcessRow) => (
        <Space size={3}>
          <Tooltip title="View" overlayInnerStyle={{ fontSize: '11px' }}><Button icon={<EyeOutlined />} size="small" onClick={() => openView(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}><Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} style={{ borderRadius: 6 }} /></Tooltip>
          <Popconfirm title="Delete this record?" description="This action cannot be undone." onConfirm={() => handleDelete(r)} okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
            <Tooltip title="Delete" overlayInnerStyle={{ fontSize: '11px' }}><Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ].filter(Boolean) as any[];

  // Filter panel — uses pendingFilters; applied on Enter or Apply button
  const filterPanel = showFilterPanel && (
    <div ref={filterPanelRef} style={{ width: 230, flexShrink: 0, background: '#fafafa', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text strong style={{ fontSize: '12px' }}>Filters</Text>
        <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={clearFilters}>Clear all</Button>
      </div>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>SOW</div>
          <Input size="small" placeholder="Search..." value={pendingFilters.sow || ''}
            onChange={e => setPendingFilters(f => ({ ...f, sow: e.target.value }))}
            onPressEnter={applyFilters}
            style={{ fontSize: '11px' }} allowClear />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>PIW</div>
          <Input size="small" placeholder="Search..." value={pendingFilters.piw || ''}
            onChange={e => setPendingFilters(f => ({ ...f, piw: e.target.value }))}
            onPressEnter={applyFilters}
            style={{ fontSize: '11px' }} allowClear />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Status</div>
          <Select size="small" placeholder="All" allowClear value={pendingFilters.status || undefined}
            onChange={v => { const nf = { ...pendingFilters, status: v || '' }; setPendingFilters(nf); setFilters(nf); }}
            style={{ width: '100%', fontSize: '11px' }}
            options={['Not Started', 'In Progress', 'Completed'].map(s => ({ label: s, value: s }))} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Active</div>
          <Select size="small" placeholder="All" allowClear value={pendingFilters.active || undefined}
            onChange={v => { const nf = { ...pendingFilters, active: v || '' }; setPendingFilters(nf); setFilters(nf); }}
            style={{ width: '100%', fontSize: '11px' }}
            options={ACTIVE_OPTIONS.map(s => ({ label: s, value: s }))} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Account Anchor</div>
          <Select size="small" placeholder="All" allowClear value={pendingFilters.accountAnchor || undefined}
            onChange={v => { const nf = { ...pendingFilters, accountAnchor: v || '' }; setPendingFilters(nf); setFilters(nf); }}
            style={{ width: '100%', fontSize: '11px' }}
            options={anchorOptions} />
        </div>
        <Button type="primary" size="small" block style={{ borderRadius: 6, fontSize: '11px', marginTop: 4 }} onClick={applyFilters}>
          Apply
        </Button>
      </Space>
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          {viewMode === 'pipeline'
            ? <>Showing: <strong>{pipelineRows.length}</strong> active{pipelineRows.length !== rows.length ? ` / ${rows.length} total` : ''}</>
            : <>Showing: <strong>{displayed.length}</strong>{displayed.length !== rows.length ? ` / ${rows.length}` : ''}</>
          }
        </Text>
        <Space size={0} wrap style={{ alignItems: 'center' }}>
          {/* ── Priority Controls (highlighted section) ── */}
          <Space
            size={8}
            style={{
              background: '#f0f5ff',
              border: '1px solid #d6e4ff',
              borderRadius: 8,
              padding: '5px 10px',
              marginRight: 8,
            }}
          >
            {/* Pending Only toggle — only in pipeline view */}
            {viewMode === 'pipeline' && (
              <Tooltip title={!showAll ? 'Showing only pending (not completed) — click to show all' : 'Showing all — click to show only pending'} overlayInnerStyle={{ fontSize: '11px' }}>
                <Space size={5} style={{ cursor: 'pointer' }} onClick={() => setShowAll(p => !p)}>
                  <Switch
                    checked={!showAll}
                    size="small"
                    style={{ background: !showAll ? '#1890ff' : '#bfbfbf' }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: !showAll ? '#1890ff' : '#8c8c8c', whiteSpace: 'nowrap' }}>
                    Pending Only
                  </span>
                </Space>
              </Tooltip>
            )}

            {/* Assign Anchor */}
            <Tooltip title="Assign to Account Anchor" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                icon={<IdcardOutlined />}
                size="small"
                onClick={() => setAllocateModal(true)}
                style={{
                  borderRadius: 6,
                  background: '#fff',
                  borderColor: '#1890ff',
                  color: '#1890ff',
                  fontWeight: 600,
                  fontSize: '11px',
                }}
              >
                Assign Anchor
              </Button>
            </Tooltip>
          </Space>

          {/* ── Standard Controls ── */}
          <Space size={6} wrap>
            {isFilterApplied && (
              <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={clearFilters}>
                <ClearOutlined /> Clear Filters
              </Button>
            )}
            <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(p => !p)} style={{ borderRadius: 6 }} />
            </Tooltip>
            <Tooltip title="Pipeline View" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<NodeIndexOutlined />} type={viewMode === 'pipeline' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('pipeline')} style={{ borderRadius: 6 }} />
            </Tooltip>
            <Tooltip title="Table View" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('table')} style={{ borderRadius: 6 }} />
            </Tooltip>
            {viewMode === 'table' && (
              <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: 6 }} />
              </Tooltip>
            )}
            <Tooltip title="Upload from Excel" overlayInnerStyle={{ fontSize: '11px' }}>
              <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
                <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: 6 }} />
              </Upload>
            </Tooltip>
            <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate} style={{ borderRadius: 6 }} />
            </Tooltip>
            {rows.length > 0 && (
              <Tooltip title="Export Data" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={handleDownload} style={{ borderRadius: 6, color: '#52c41a', borderColor: '#52c41a' }} />
              </Tooltip>
            )}
            {rows.length > 0 && (
              <Popconfirm
                title="Delete all process records?"
                description="This will permanently remove all records from the database."
                onConfirm={handleClearAll}
                okText="Delete All" cancelText="Cancel"
                okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                <Tooltip title="Delete All Records" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
                </Tooltip>
              </Popconfirm>
            )}
            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={openAdd} style={{ borderRadius: 6, fontSize: '11px' }}>Add New</Button>
          </Space>
        </Space>
      </div>

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
              <Checkbox checked={visibleColumns[key]} onChange={e => setVisibleColumns(p => ({ ...p, [key]: e.target.checked }))} />
              <label style={{ fontSize: '12px', marginBottom: 0, cursor: 'pointer' }}>{label}</label>
            </div>
          ))}
        </Space>
      </Drawer>

      {/* Add / Edit Modal */}
      <Modal
        title={<span style={{ fontSize: '13px' }}>{editingRow ? 'Edit Record' : 'Add New Record'}</span>}
        open={editModal} onOk={handleSave} onCancel={() => { setEditModal(false); form.resetFields(); }}
        okText="Save" width={560}
        okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
        cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
            <Form.Item name="startDate" label={<span style={{ fontSize: '11px' }}>Start Date</span>}>
              <Input placeholder="e.g. 03-Jan-26" style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="active" label={<span style={{ fontSize: '11px' }}>Active</span>}>
              <Select placeholder="Select" options={ACTIVE_OPTIONS.map(v => ({ label: v, value: v }))} style={{ fontSize: '12px' }} allowClear />
            </Form.Item>
          </div>
          <Form.Item name="sow" label={<span style={{ fontSize: '11px' }}>SOW</span>} rules={[{ required: true, message: 'Enter SOW' }]}>
            <Input placeholder="e.g. T1-UCB_US_Tech-Resource_Allocation-2026-CR1" style={{ fontSize: '12px' }} disabled={!!editingRow} />
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
            <Form.Item name="budget" label={<span style={{ fontSize: '11px' }}>Budget</span>}>
              <Input placeholder="e.g. 45,08,307.00" style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="comments" label={<span style={{ fontSize: '11px' }}>Comments</span>}>
              <Input style={{ fontSize: '12px' }} />
            </Form.Item>
          </div>
          <Form.Item name="openAirCode" label={<span style={{ fontSize: '11px' }}>Open Air Code</span>}>
            <Input placeholder="e.g. ZSUS0341 - Next Gen Operations Support 2026" style={{ fontSize: '12px' }} />
          </Form.Item>
        </Form>
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '8px 12px', fontSize: '11px', color: '#389e0d', marginTop: 4 }}>
          Status auto-derived: <b>Not Started</b> → <b>In Progress</b> (Signed SOW = Yes or PIW/SF/PROMS added) → <b>Completed</b> (OA Code added)
        </div>
      </Modal>

      {/* View Modal */}
      <Modal title={<span style={{ fontSize: '13px' }}>Record Details</span>} open={viewModal} onCancel={() => setViewModal(false)} footer={null} width={520}>
        {viewingRow && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, fontSize: '12px' }}>
              <span style={{ color: '#8c8c8c', fontWeight: 600 }}>Status</span>
              <span>{(() => { const s = deriveStatus(viewingRow); return <Tag style={{ fontSize: '11px', background: `${STATUS_COLORS[s]}18`, color: STATUS_COLORS[s], border: `1px solid ${STATUS_COLORS[s]}44` }}>{s}</Tag>; })()}</span>
            </div>
            {COL_KEYS.filter(c => c.key !== 'sno').map(({ key, label }) => {
              const val = viewingRow[key as keyof ProcessRow];
              if (!val || val instanceof File) return null;
              return (
                <div key={key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, fontSize: '12px', alignItems: 'flex-start' }}>
                  <span style={{ color: '#8c8c8c', fontWeight: 600 }}>{label}</span>
                  <span style={{ color: '#262626', wordBreak: 'break-word' }}>
                    {(key === 'active' || key === 'signedSow')
                      ? <Tag color={val === 'Yes' ? 'green' : 'orange'} style={{ fontSize: '11px' }}>{val}</Tag>
                      : String(val)}
                  </span>
                </div>
              );
            })}
            {viewingRow.sowFile && (
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8, fontSize: '12px', alignItems: 'center' }}>
                <span style={{ color: '#8c8c8c', fontWeight: 600 }}>SOW Document</span>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadFile(viewingRow.sowFile!)} style={{ borderRadius: 6, width: 'fit-content' }}>
                  {viewingRow.sowFile.name}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
      {/* Allocate to Account Anchor Modal */}
      <Modal
        title={<span style={{ fontSize: '13px' }}>Allocate to Account Anchor</span>}
        open={allocateModal}
        onOk={handleAllocateSave}
        onCancel={() => { setAllocateModal(false); setAllocateAnchor(''); setAllocateSelected([]); }}
        okText="Assign"
        width={560}
        okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
        cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      >
        <div style={{ marginTop: 12 }}>
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

          {rows.some(r => r.accountAnchor) && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>Already assigned:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Array.from(new Set(rows.filter(r => r.accountAnchor).map(r => r.accountAnchor!))).map(anchor => (
                  <Tag key={anchor} color="purple" style={{ fontSize: '11px' }}>
                    {anchor} ({rows.filter(r => r.accountAnchor === anchor).length})
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
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

  const handleDelete = (sowKey: string, processKey: string) => {
    setSowList(prev => prev.filter(s => s.key !== sowKey));
    onDelete(processKey);
    message.success('SOW deleted and removed from Process');
  };

  return (
    <div>
      {/* SP Storage info banner */}
      {spUrl && (
        <div style={{
          background: '#f0f5ff',
          border: '1px solid #d6e4ff',
          borderRadius: 8,
          padding: '10px 14px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '12px',
          color: '#1d3461',
        }}>
          <span style={{ flex: 1 }}>
            📁 SOW documents should also be saved to the configured SharePoint folder.
          </span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap', fontSize: '12px' }}>
            Open SharePoint Folder ↗
          </a>
        </div>
      )}
      <Upload.Dragger multiple={false} beforeUpload={handleSowFile} showUploadList={false}
        style={{ borderRadius: 8, marginBottom: 20 }}>
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

export function InternalProcess() {
  const [processRows, setProcessRows] = useState<ProcessRow[]>([]);
  const [fromServer, setFromServer] = useState(false);

  useEffect(() => {
    processApi.getProcessRows().then(({ rows, fromServer: fs }) => {
      if (fs && rows.length > 0) {
        setProcessRows(rows.map((r: any, i: number) => ({
          key: `pr_db_${r.id || i}`,
          id: r.id,
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
      comments: '',
      sowFile: file,
    }]);
  };

  const handleSowDelete = (processKey: string) => {
    setProcessRows(prev => prev.filter(r => r.key !== processKey).map((r, i) => ({ ...r, sno: i + 1 })));
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <Title level={4} style={{ margin: 0, color: '#262626' }}>RA Process</Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>Standard processes, agreements and onboarding documentation</Text>
      </div>
      <div style={{ background: '#fff', borderRadius: 10, padding: '0 20px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Tabs
          defaultActiveKey="sow"
          tabBarStyle={{ marginBottom: 16, paddingTop: 4 }}
          items={[
            {
              key: 'sow',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><FileProtectOutlined /> SOW</span>,
              children: <SowTab onUpload={handleSowUpload} onDelete={handleSowDelete} />,
            },
            {
              key: 'piw',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><IdcardOutlined /> PIW</span>,
              children: <ComingSoon label="PIW (Person in Waiting)" />,
            },
            {
              key: 'process',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><NodeIndexOutlined /> Internal Process</span>,
              children: <ProcessTab rows={processRows} setRows={setProcessRows} fromServer={fromServer} setFromServer={setFromServer} />,
            },
            {
              key: 'insights',
              label: <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 5 }}><BarChartOutlined /> Insights</span>,
              children: <ProcessInsights rows={processRows} />,
            },
          ]}
        />
      </div>
    </div>
  );
}
