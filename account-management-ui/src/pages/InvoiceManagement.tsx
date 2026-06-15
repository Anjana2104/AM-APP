/**
 * InvoiceManagement.tsx
 * 
 * Invoicing Details — Track and manage invoices with Excel upload/download,
 * monthly invoice tracking, and status management
 * UI Location: Account Operations > Finance > Invoicing Details
 * Page ID: executive_invoicing
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Tabs, Typography, Space, Upload, Table, Button, message, Input, Tooltip,
  Drawer, Checkbox, Select, Card, Row, Col, Progress, Empty,
  Segmented, InputNumber, Spin, Popconfirm, Modal, Form, Tag, Alert,
} from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import {
  UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined,
  FileExcelOutlined, BarChartOutlined, CloudServerOutlined, SaveOutlined, DeleteOutlined,
  EditOutlined, CalendarOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined,
  WarningOutlined, EllipsisOutlined, DollarOutlined, PictureOutlined, FileTextOutlined,
  EyeOutlined, ClockCircleOutlined, MessageOutlined, FullscreenOutlined, FullscreenExitOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import * as invoiceApi from '../api/invoiceApi';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';

const { Text } = Typography;

type ExcelRow = Record<string, any>;

type InvRow = {
  key: string;
  id?: number;
  sno: number;
  project: string;
  company: string;
  code: string;
  status: 'Active' | 'Inactive';
  comments: string;
  revenue: number[];
};

const inr = (n: number) =>
  n ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}` : '—';

const usd = (n: number) =>
  n ? `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

function parseINR(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/₹|,/g, '').trim();
  const num = Number(cleaned);
  return isFinite(num) ? num : 0;
}

const deriveCode = (name: string) => name.split(' - ')[0].trim() || name;

// Fiscal year helpers — FY26 = Oct'25–Sep'26, Q1=Oct/Nov/Dec, Q2=Jan/Feb/Mar, Q3=Apr/May/Jun, Q4=Jul/Aug/Sep
const MONTH_ORDER = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function getMonthFY(label: string): { fy: number; pos: number } | null {
  const m = label.trim().match(/^([A-Za-z]{3})[''`](\d{2})$/);
  if (!m) return null;
  const pos = MONTH_ORDER.indexOf(m[1]);
  if (pos === -1) return null;
  const yr = 2000 + parseInt(m[2]);
  return { fy: pos < 3 ? yr + 1 : yr, pos }; // Oct/Nov/Dec belong to the next FY
}

function fyMonthLabel(fyNum: number, pos: number): string {
  const mName = MONTH_ORDER[pos];
  const yr = pos < 3 ? fyNum - 1 : fyNum;
  return `${mName}'${String(yr % 100).padStart(2, '0')}`;
}

function downloadTemplate() {
  const headers = [
    'OA Project Code', 'Company',
    "Oct'25", "Nov'25", "Dec'25",
    "Jan'26", "Feb'26", "Mar'26", "Apr'26", "May'26", "Jun'26",
    "Jul'26", "Aug'26", "Sep'26",
    "Oct'26", "Nov'26", "Dec'26",
    "Jan'27", "Feb'27", "Mar'27", "Apr'27", "May'27", "Jun'27",
    "Jul'27", "Aug'27", "Sep'27",
  ];
  const rows = Array.from({ length: 5 }).map((_, i) => {
    const row: any = {};
    headers.forEach(h => (row[h] = ''));
    return row;
  });
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'FY26-FY27 Invoices');
  XLSX.writeFile(workbook, 'FY26_FY27_Invoice_Template.xlsx');
}

// Comment date formatting helpers
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatCommentDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${ordinal(date.getDate())} ${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

interface InvoiceListProps {
  onDataChange?: (data: InvRow[]) => void;
  onMonthsChange?: (months: string[]) => void;
}

function InvoiceList({ onDataChange, onMonthsChange }: InvoiceListProps) {
  const { configs } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const canEdit = hasPermission('executive_invoicing', 'edit');
  const canDelete = hasPermission('executive_invoicing', 'delete');

  const companyOptions = configs.find(c => c.linkedTo?.includes('invoice_company_field'))?.items.map(i => ({ value: i.label, label: i.label })) ?? [];

  const [rows, setRows] = useState<InvRow[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromServer, setFromServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(
    new Set(['sno', 'project', 'company', 'code', 'total', 'comments'])
  );

  // Apply saved user preferences once loaded
  useEffect(() => {
    if (!preferencesLoaded) return;
    const vis = getColumnVisibility('invoice');
    const keys = Object.entries(vis).filter(([,v]) => v).map(([k]) => k);
    setVisibleColumnsState(new Set(['sno', 'total', ...keys]));
  }, [preferencesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleColumns = (newSet: Set<string>) => {
    setVisibleColumnsState(newSet);
    const vis: Record<string, boolean> = {};
    ['project','company','code','comments'].forEach(k => { vis[k] = newSet.has(k); });
    saveColumnVisibility('invoice', vis);
  };
  const [filters, setFilters] = useState<{
    project: string; company: string; fy: string | null; status: string | null;
  }>({ project: '', company: '', fy: null, status: null });

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<InvRow | null>(null);
  const [editForm] = Form.useForm();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();

  const [generateFY, setGenerateFY] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string[] | null>(null);
  const [uploadErrorType, setUploadErrorType] = useState<'template' | 'duplicate' | 'server'>('duplicate');

  // Detail drawer state
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedDetailRow, setSelectedDetailRow] = useState<InvRow | null>(null);
  const [detailDrawerExpanded, setDetailDrawerExpanded] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    invoiceApi.getInvoiceProjects().then(({ projects, months, fromServer: online }) => {
      if (online && projects.length) {
        const mapped: InvRow[] = projects.map((p, i) => ({
          key: p.project || String(i),
          id: p.id,
          sno: i + 1,
          project: p.project,
          company: p.company || '',
          code: p.code || deriveCode(p.project),
          status: (p.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
          comments: (p as any).comments || '',
          revenue: months.map(m => p.revenue[m] || 0),
        }));
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  const reloadFromServer = async () => {
    try {
      const { projects, months, fromServer: online } = await invoiceApi.getInvoiceProjects();
      if (online && projects.length) {
        const mapped: InvRow[] = projects.map((p, i) => ({
          key: p.project || String(i),
          id: p.id,
          sno: i + 1,
          project: p.project,
          company: p.company || '',
          code: p.code || deriveCode(p.project),
          status: (p.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
          comments: (p as any).comments || '',
          revenue: months.map(m => p.revenue[m] || 0),
        }));
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
      }
    } catch { /* ignore */ }
  };

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isFilterApplied = !!(filters.project || filters.company || filters.fy || filters.status);

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        const isInsidePopup = !!target.closest('.ant-select-dropdown');
        if (!isInsidePopup) setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const availableFYs = useMemo(() => {
    const fyMap = new Map<number, number>();
    monthHeaders.forEach((m, i) => {
      const info = getMonthFY(m);
      if (info && !fyMap.has(info.fy)) fyMap.set(info.fy, i);
    });
    return Array.from(fyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([fy, startIdx]) => ({ label: `FY${fy}`, value: startIdx }));
  }, [monthHeaders]);

  const handleFieldChange = (key: string, field: 'project' | 'company' | 'comments', value: string) => {
    setDirty(true);
    setRows(prev => {
      const updated = prev.map(r => {
        if (r.key !== key) return r;
        const newRow = { ...r, [field]: value };
        if (field === 'project') {
          newRow.key = value;
          newRow.code = deriveCode(value);
        }
        return newRow;
      });
      return updated;
    });
  };

  const getFYMonths = (fyYear: number): string[] => {
    const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    return MONTHS.map((m, i) => {
      const yr = i < 3 ? (fyYear - 1) % 100 : fyYear % 100;
      return `${m}'${String(yr).padStart(2, '0')}`;
    });
  };

  const candidateFYs = useMemo(() => {
    const existing = new Set(monthHeaders);
    const fySet = new Set<number>();
    monthHeaders.forEach(m => {
      const info = getMonthFY(m);
      if (info) fySet.add(info.fy);
    });
    const maxFY = fySet.size ? Math.max(...fySet) : (new Date().getFullYear() + 1);
    const result: string[] = [];
    for (let fy = 2026; fy <= maxFY + 5; fy++) {
      const fyMonths = getFYMonths(fy);
      if (fyMonths.some(m => !existing.has(m))) result.push(`FY${fy}`);
    }
    return result;
  }, [monthHeaders]);

  const handleGenerateFY = () => {
    if (!generateFY) return;
    const fyYear = parseInt(generateFY.replace('FY', ''));
    const fyMonths = getFYMonths(fyYear);
    const existing = new Set(monthHeaders);
    const newMonths = fyMonths.filter(m => !existing.has(m));
    if (!newMonths.length) { message.info(`All months for ${generateFY} already exist`); return; }

    const allMonths = [...monthHeaders];
    newMonths.forEach(nm => {
      const fyAll = fyMonths;
      const nmIdx = fyAll.indexOf(nm);
      let insertAt = allMonths.length;
      for (let i = allMonths.length - 1; i >= 0; i--) {
        const existingFyIdx = fyAll.indexOf(allMonths[i]);
        if (existingFyIdx !== -1 && existingFyIdx < nmIdx) { insertAt = i + 1; break; }
        const prevFyIdx = getFYMonths(fyYear - 1).indexOf(allMonths[i]);
        if (prevFyIdx !== -1) { insertAt = i + 1; break; }
      }
      allMonths.splice(insertAt, 0, nm);
    });

    const updatedRows = rows.map(r => {
      const oldRevMap = Object.fromEntries(monthHeaders.map((m, i) => [m, r.revenue[i] || 0]));
      return { ...r, revenue: allMonths.map(m => oldRevMap[m] ?? 0) };
    });

    setRows(updatedRows);
    setMonthHeaders(allMonths);
    onDataChange?.(updatedRows);
    onMonthsChange?.(allMonths);
    setDirty(true);
    setGenerateFY(null);
    message.success(`Added ${newMonths.length} month(s) for ${generateFY}: ${newMonths.join(', ')}`);
  };

  const findDuplicateCodes = (targetRows: InvRow[]): string[] => {
    const codeMap = new Map<string, string[]>();
    targetRows.forEach(r => {
      const code = deriveCode(r.project);
      if (!codeMap.has(code)) codeMap.set(code, []);
      codeMap.get(code)!.push(r.project);
    });
    const conflicts: string[] = [];
    codeMap.forEach((projects, code) => {
      if (projects.length > 1) {
        conflicts.push(`Code "${code}" is shared by: ${projects.join(', ')}`);
      }
    });
    return conflicts;
  };

  const showDuplicateCodeError = (conflicts: string[]) => {
    Modal.error({
      title: (
        <Space>
          <WarningOutlined style={{ color: '#ff4d4f' }} />
          <span>Duplicate Project Codes Detected</span>
        </Space>
      ),
      width: 520,
      content: (
        <div style={{ marginTop: 8 }}>
          <p style={{ fontSize: '12px', color: '#595959', marginBottom: 8 }}>
            The following project name(s) produce the same derived code. Each project must have a unique code.
            Please rename the projects so their codes are distinct:
          </p>
          <ul style={{ paddingLeft: 20, margin: 0 }}>
            {conflicts.map((c, i) => (
              <li key={i} style={{ fontSize: '12px', color: '#ff4d4f', marginBottom: 4 }}>{c}</li>
            ))}
          </ul>
          <p style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 10 }}>
            💡 The code is derived from the part before " - " in the project name (e.g. "Project Name - Details" → code "Project Name").
          </p>
        </div>
      ),
      okText: 'OK',
      okButtonProps: { size: 'small' },
    });
  };

  const openEdit = (r: InvRow) => {
    setEditingRow(r);
    editForm.setFieldsValue({ project: r.project, company: r.company, status: r.status, comments: r.comments || '' });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    const values = await editForm.validateFields();
    if (!editingRow) return;
    const newProject = values.project.trim();
    const newCode = deriveCode(newProject);

    const otherRows = rows.filter(r => r.key !== editingRow.key);
    const conflicts = otherRows
      .filter(r => deriveCode(r.project) === newCode)
      .map(r => `"${r.project}" already uses code "${newCode}"`);
    if (conflicts.length) {
      showDuplicateCodeError(conflicts);
      return;
    }

    setEditModalOpen(false);

    if (editingRow.id) {
      const ok = await invoiceApi.updateInvoiceProject(editingRow.id, {
        project: newProject, code: newCode, company: values.company?.trim() || '', status: values.status, comments: values.comments || '',
        changedBy: currentUser?.username,
      } as any);
      if (ok) {
        message.success('Row updated');
        await reloadFromServer();
        return;
      }
    }

    const updated = rows.map(r =>
      r.key === editingRow.key
        ? { ...r, project: newProject, code: newCode, key: newProject, company: values.company?.trim() || '', status: values.status as 'Active' | 'Inactive', comments: values.comments || '' }
        : r
    );
    setRows(updated);
    onDataChange?.(updated);
    setDirty(true);
    message.success('Row updated (save to sync with database)');
  };

  const handleToggleActive = async (r: InvRow) => {
    const newStatus: 'Active' | 'Inactive' = r.status === 'Active' ? 'Inactive' : 'Active';

    if (r.id) {
      setRows(prev => prev.map(x => x.key === r.key ? { ...x, status: newStatus } : x));
      const ok = await invoiceApi.updateInvoiceProject(r.id, { status: newStatus, changedBy: currentUser?.username } as any);
      if (ok) {
        await reloadFromServer();
        message.success(`Project marked as ${newStatus}`);
      } else {
        setRows(prev => prev.map(x => x.key === r.key ? { ...x, status: r.status } : x));
        setDirty(true);
        message.warning(`Server offline — change will be saved when you click Save Changes`);
      }
    } else {
      setRows(prev => prev.map(x => x.key === r.key ? { ...x, status: newStatus } : x));
      setDirty(true);
      message.success(`Project marked as ${newStatus} (save to sync with database)`);
    }
  };

  const handleAddProject = async () => {
    const values = await addForm.validateFields();
    const newProject = values.project.trim();
    const code = deriveCode(newProject);

    if (rows.some(r => r.project.toLowerCase() === newProject.toLowerCase())) {
      message.warning('A project with this name already exists');
      return;
    }
    const codeConflicts = rows
      .filter(r => deriveCode(r.project) === code)
      .map(r => `"${r.project}" already uses code "${code}"`);
    if (codeConflicts.length) {
      showDuplicateCodeError(codeConflicts);
      return;
    }
    const newRow: InvRow = {
      key: newProject,
      sno: rows.length + 1,
      project: newProject,
      company: values.company?.trim() || '',
      code,
      status: 'Active',
      comments: values.comments?.trim() || '',
      revenue: monthHeaders.map(() => 0),
    };
    const updated = [...rows, newRow];
    setRows(updated);
    onDataChange?.(updated);
    setAddModalOpen(false);
    addForm.resetFields();
    const result = await invoiceApi.createInvoiceProject({
      project: newRow.project,
      company: newRow.company,
      code: newRow.code,
      status: 'Active',
      comments: newRow.comments,
      revenue: Object.fromEntries(monthHeaders.map((m, i) => [m, 0])),
      monthHeaders,
    }, currentUser?.username);
    if (result.ok && result.id) {
      setRows(prev => prev.map(r => r.key === newRow.key ? { ...r, id: result.id } : r));
      message.success('Project added and saved to database');
    } else {
      setDirty(true);
      message.success('Project added (save to sync with database)');
    }
  };

  const handleDeleteRow = (r: InvRow) => {
    const filtered = rows.filter(x => x.key !== r.key);
    const updated = filtered.map((x, i) => ({ ...x, sno: i + 1 }));
    setRows(updated);
    onDataChange?.(updated);
    setDirty(true);
    if (r.id) invoiceApi.deleteInvoiceProject(r.id, currentUser?.username);
    message.success('Row deleted');
  };

  /** Auto-save comments on blur if the row has a DB id */
  const handleCommentBlur = async (key: string) => {
    const row = rows.find(r => r.key === key);
    if (!row?.id) return;
    await invoiceApi.updateInvoiceProject(row.id, { comments: row.comments || '', changedBy: currentUser?.username } as any);
  };

  /** Load audit log for a given invoice record id */
  const loadAuditLog = async (id: number) => {
    setAuditLoading(true);
    const entries = await auditApi.getAuditLog('invoice', id);
    setAuditLog(entries);
    setAuditLoading(false);
  };

  /** Open detail side panel */
  const openDetailDrawer = (r: InvRow) => {
    setSelectedDetailRow(r);
    setNewComment('');
    setAuditLog([]);
    setAuditSearch('');
    setAuditFieldFilter(null);
    setAuditByFilter(null);
    setDetailDrawer(true);
    if (r.id) loadAuditLog(r.id);
  };

  /** Append a new prefixed comment and save */
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDetailRow) return;
    const username = currentUser?.username || 'Unknown';
    const dateStr = formatCommentDate(new Date());
    const entry = `${username} : ${dateStr} : ${newComment.trim()}`;
    const existing = selectedDetailRow.comments || '';
    const updated = existing ? `${existing}\n${entry}` : entry;

    setRows(prev => prev.map(r => r.key === selectedDetailRow.key ? { ...r, comments: updated } : r));
    setSelectedDetailRow(prev => prev ? { ...prev, comments: updated } : prev);
    setNewComment('');

    if (selectedDetailRow.id) {
      await invoiceApi.updateInvoiceProject(selectedDetailRow.id, { comments: updated, changedBy: username } as any);
      await loadAuditLog(selectedDetailRow.id);
    }
    message.success('Comment added');
  };

  const handleUpload = async (file: File) => {
    setUploadError(null);
    setUploadErrorType('duplicate');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { message.error('No sheet found'); return false; }
      const json = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: '' });
      if (!json.length) { message.error('Sheet is empty'); return false; }
      const headers = Object.keys(json[0]);

      // Detect upload format:
      // - "Open Air code" (old Glasteena export) — "CODE - Project Name" combined
      // - "OA Project Code" (new template) — same combined format
      // Both are treated identically: split on first " - " to get code + project name
      const codeColKey = headers.find(h => {
        const t = h.trim().toLowerCase();
        return t === 'open air code' || t === 'oa project code' || t === 'open air codes';
      });
      const hasCodeCol = !!codeColKey;

      if (!hasCodeCol) {
        setUploadError([
          'Missing required column: "OA Project Code" (or legacy "Open Air code")',
          'Please download the correct template and re-upload the file.',
        ]);
        setUploadErrorType('template');
        return false;
      }

      let uploaded: InvRow[];

      // Both old and new template: "CODE - Project Name" combined column
      const companyKey = headers.find(h => h.trim().toLowerCase() === 'company');
      const fixedColKeys = new Set([codeColKey, companyKey].filter(Boolean) as string[]);
      // rawMonthCols: original (possibly space-padded) keys from the Excel row object
      // monthCols: trimmed display/storage names, __EMPTY and blank skipped
      const rawMonthCols = headers.filter(h =>
        !fixedColKeys.has(h) && !h.startsWith('__EMPTY') && h.trim() !== ''
      );
      const monthCols = rawMonthCols.map(h => h.trim());
      uploaded = json
        .filter(r => String(r[codeColKey!] || '').trim())
        .map((r, i) => {
          const raw = String(r[codeColKey!] || '').trim();
          const code = raw.split(' - ')[0].trim() || raw;
          return {
            key: raw,
            sno: i + 1,
            project: raw,   // store full "ZSUS0294 - Big Data POD..." value
            company: companyKey ? String(r[companyKey] || '').trim() : '',
            code,
            status: 'Active' as const,
            revenue: rawMonthCols.map(m => parseINR(r[m])), // use original (untrimmed) key to access row data
          };
        });

      // Duplicate-code validation
      const errors: string[] = [];
      const codeToProjects = new Map<string, string[]>();
      uploaded.forEach(u => {
        const existing = codeToProjects.get(u.code) || [];
        existing.push(u.project);
        codeToProjects.set(u.code, existing);
      });
      codeToProjects.forEach((projects, code) => {
        if (projects.length > 1) {
          errors.push(`Code "${code}" is shared by multiple rows in the file: ${projects.map(p => `"${p}"`).join(', ')}`);
        }
      });
      uploaded.forEach(u => {
        const conflict = rows.find(
          r => r.code === u.code && r.project.toLowerCase() !== u.project.toLowerCase()
        );
        if (conflict) {
          errors.push(`Code "${u.code}" from uploaded project "${u.project}" conflicts with existing project "${conflict.project}" in the database`);
        }
      });

      if (errors.length > 0) {
        setUploadError(errors);
        return false;
      }

      // uploadedMonthCols is already computed as `monthCols` above — reuse it
      const uploadedMonthCols = monthCols;

      const allMonths = [...new Set([...monthHeaders, ...uploadedMonthCols])];
      const existingMap = new Map(rows.map(r => [r.project.toLowerCase(), r]));

      uploaded.forEach(u => {
        const key = u.project.toLowerCase();
        if (existingMap.has(key)) {
          const ex = existingMap.get(key)!;
          const mergedRevenue = allMonths.map(m => {
            const uploadedIdx = uploadedMonthCols.indexOf(m);
            const existingIdx = monthHeaders.indexOf(m);
            if (uploadedIdx !== -1) return u.revenue[uploadedIdx] ?? 0;
            if (existingIdx !== -1) return ex.revenue[existingIdx] ?? 0;
            return 0;
          });
          existingMap.set(key, { ...ex, company: u.company, revenue: mergedRevenue });
        } else {
          const mergedRevenue = allMonths.map(m => {
            const uploadedIdx = uploadedMonthCols.indexOf(m);
            return uploadedIdx !== -1 ? (u.revenue[uploadedIdx] ?? 0) : 0;
          });
          existingMap.set(key, { ...u, revenue: mergedRevenue });
        }
      });

      const merged: InvRow[] = Array.from(existingMap.values()).map(r => ({
        ...r,
        status: r.status || 'Active',
        revenue: allMonths.map((m, i) => {
          const oldIdx = monthHeaders.indexOf(m);
          return r.revenue[i] !== undefined ? r.revenue[i] : (oldIdx !== -1 ? (r.revenue[oldIdx] ?? 0) : 0);
        }),
      }));

      setRows(merged);
      setMonthHeaders(allMonths);
      onDataChange?.(merged);
      onMonthsChange?.(allMonths);
      setDirty(true);

      const newCount = uploaded.filter(u => !rows.some(r => r.project.toLowerCase() === u.project.toLowerCase())).length;
      const updCount = uploaded.length - newCount;
      message.success(`Upload complete: ${newCount} new project(s) added, ${updCount} updated — click Save Changes to persist`);

    } catch (e: any) {
      message.error(e.message || 'Failed to read Excel');
    }
    return false;
  };

  const filteredMonthHeaders = useMemo(() => {
    if (!filters.fy) return monthHeaders;
    const start = parseInt(filters.fy);
    return monthHeaders.slice(start, start + 12);
  }, [monthHeaders, filters.fy]);

  const fmtRev = (n: number) => {
    if (currency === 'USD') return `$ ${(n * exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const columns: ColumnsType<InvRow> = useMemo(() => {
    const hs = { fontWeight: 600, fontSize: '11px' };
    const cs = { fontSize: '11px', textAlign: 'left' as const };

    const handleRevChange = (key: string, idx: number, value: string) => {
      setDirty(true);
      setRows(prev => {
        const updated = prev.map(r =>
          r.key === key ? { ...r, revenue: r.revenue.map((v, i) => i === idx ? parseINR(value) : v) } : r
        );
        onDataChange?.(updated);
        return updated;
      });
    };

    const base: ColumnType<InvRow>[] = [
      { title: 'S.No.', key: 'sno', width: 42, fixed: 'left' as const, render: (_: unknown, __: InvRow, index: number) => index + 1, onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }) },
      {
        title: 'OA Project Code', dataIndex: 'project', key: 'project', width: 280, fixed: 'left' as const,
        sorter: (a: InvRow, b: InvRow) => (a.project || '').localeCompare(b.project || ''),
        render: (v: string, r: InvRow) => (
          <Tooltip title={v} overlayInnerStyle={{ fontSize: '11px' }}>
            <Input
              value={v}
              readOnly={!canEdit}
              onChange={canEdit ? e => handleFieldChange(r.key, 'project', e.target.value) : undefined}
              style={{ border: 'none', background: 'transparent', fontSize: '11px', fontWeight: 500 }}
            />
          </Tooltip>
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Company', dataIndex: 'company', key: 'company', width: 110,
        sorter: (a: InvRow, b: InvRow) => (a.company || '').localeCompare(b.company || ''),
        render: (v: string, r: InvRow) => companyOptions.length > 0 ? (
          <Select
            value={v || undefined}
            onChange={val => handleFieldChange(r.key, 'company', val ?? '')}
            options={companyOptions}
            showSearch allowClear size="small"
            placeholder="Select…"
            style={{ width: '100%', fontSize: '11px' }}
            variant="borderless"
            popupMatchSelectWidth={false}
            disabled={!canEdit}
          />
        ) : (
          <Input value={v} onChange={e => handleFieldChange(r.key, 'company', e.target.value)} readOnly={!canEdit} style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Code', dataIndex: 'code', key: 'code', width: 90, fixed: 'left' as const,
        render: (_: string, r: InvRow) => (
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#595959' }}>{deriveCode(r.project)}</span>
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Status', dataIndex: 'status', key: 'status', width: 70,
        sorter: (a: InvRow, b: InvRow) => (a.status || '').localeCompare(b.status || ''),
        render: (status: string) => (
          <Tag color={status === 'Active' ? 'success' : 'default'} style={{ fontSize: '10px', padding: '0 4px' }}>
            {status || 'Active'}
          </Tag>
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Comments', dataIndex: 'comments', key: 'comments', width: 180,
        render: (v: string, r: InvRow) => (
          <Tooltip title={v || 'Open record to add comment'} overlayInnerStyle={{ fontSize: '11px', whiteSpace: 'pre-wrap', maxWidth: 320 }}>
            <Input
              value={v}
              readOnly
              placeholder="Open to add comment"
              onClick={() => openDetailDrawer(r)}
              style={{ border: 'none', background: 'transparent', fontSize: '11px', cursor: 'pointer' }}
            />
          </Tooltip>
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: '', key: 'actions', width: 88, fixed: 'right' as const,
        render: (_: any, r: InvRow) => (
          <Space size={2}>
            <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button type="text" size="small" icon={<EyeOutlined style={{ color: '#1890ff' }} />} onClick={() => openDetailDrawer(r)} />
            </Tooltip>
            {canEdit && (
            <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} style={{ color: '#595959' }} />
            </Tooltip>
            )}
            {canEdit && (
            <Tooltip title={r.status === 'Active' ? 'Mark Inactive' : 'Mark Active'} overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                type="text" size="small"
                icon={r.status === 'Active' ? <StopOutlined style={{ color: '#ff7875' }} /> : <CheckCircleOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleToggleActive(r)}
              />
            </Tooltip>
            )}
            {canDelete && (
            <Popconfirm
              title="Delete this row?"
              description="This will permanently remove this project from the database."
              onConfirm={() => handleDeleteRow(r)}
              okText="Delete" cancelText="Cancel"
              okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}
            >
              <Tooltip title="Delete" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
            )}
          </Space>
        ),
        onHeaderCell: () => ({ style: hs }),
      },
    ];

    const monthCols: ColumnType<InvRow>[] = filteredMonthHeaders.map((m, di) => {
      const ai = filters.fy ? parseInt(filters.fy) + di : di;
      return {
        title: m, key: m, align: 'left' as const, width: 95,
        render: (_: any, r: InvRow) => (
          currency === 'USD'
            ? <span style={{ fontSize: '11px', color: '#595959' }}>{fmtRev(r.revenue[ai] || 0)}</span>
            : <InputNumber
                value={r.revenue[ai] || 0}
                readOnly={!canEdit}
                onChange={canEdit ? v => handleRevChange(r.key, ai, String(v ?? 0)) : undefined}
                formatter={v => `₹ ${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                parser={v => Number(String(v ?? '').replace(/₹\s?|,/g, '')) as 0}
                controls={false}
                bordered={false}
                style={{ width: '100%', textAlign: 'left', fontSize: '11px' }}
              />
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      };
    });

    const totalCol: ColumnType<InvRow> = {
      title: `Total (${currency})`, key: 'total', align: 'left' as const, width: 110,
      render: (_, r) => {
        const start = filters.fy ? parseInt(filters.fy) : 0;
        const end = filters.fy ? start + 12 : r.revenue.length;
        const total = r.revenue.slice(start, end).reduce((a, b) => a + b, 0);
        const display = currency === 'USD'
          ? `$ ${(total * exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
          : `₹ ${total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
        return (
          <div style={{ padding: '4px 8px', backgroundColor: '#FFA940', color: '#fff', borderRadius: '4px', fontWeight: 600, textAlign: 'left', fontSize: '11px' }}>
            {display}
          </div>
        );
      },
      onHeaderCell: () => ({ style: { fontWeight: 600, fontSize: '11px', backgroundColor: '#FFA940', color: '#fff' } }),
      onCell: () => ({ style: cs }),
    };

    return [...base, ...monthCols, totalCol].filter(col => {
      if (!col.key) return true;
      if (col.key === 'total') return true;
      if (col.key === 'actions') return true;
      if (col.key === 'status') return true;
      if (col.key === 'comments') return true;
      if (monthCols.find(c => c.key === col.key)) return true;
      return visibleColumns.has(col.key as string);
    });
  }, [filteredMonthHeaders, rows, filters, visibleColumns, currency, exchangeRate, handleCommentBlur, openDetailDrawer, canEdit, canDelete]);

  const displayRows = useMemo(() => rows.filter(r => {
    if (filters.project && !r.project.toLowerCase().includes(filters.project.toLowerCase())) return false;
    if (filters.company && !r.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.status === 'active' && r.status !== 'Active') return false;
    if (filters.status === 'inactive' && r.status !== 'Inactive') return false;
    return true;
  }), [rows, filters]);

  const handleSave = async () => {
    if (!dirty || !rows.length) return;

    const conflicts = findDuplicateCodes(rows);
    if (conflicts.length) {
      showDuplicateCodeError(conflicts);
      return;
    }

    setSaving(true);
    try {
      const apiProjects = rows.map(r => ({
        id: r.id,
        project: r.project,
        company: r.company || '',
        code: deriveCode(r.project),
        status: r.status || 'Active',
        comments: r.comments || '',
        revenue: Object.fromEntries(monthHeaders.map((m, i) => [m, r.revenue[i] || 0])),
      }));
      const saveResult = await invoiceApi.bulkSaveInvoices(apiProjects, monthHeaders, currentUser?.username);
      if (saveResult.ok) {
        setDirty(false);
        setFromServer(true);
        message.success('All changes saved to database');
        await reloadFromServer();
      } else if (saveResult.error) {
        message.error(saveResult.error);
      } else {
        message.warning('Server unavailable — changes not saved to database');
      }
    } catch (e: any) {
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    await invoiceApi.clearAllInvoices(currentUser?.username);
    setRows([]);
    setMonthHeaders([]);
    setDirty(false);
    setFromServer(false);
    onDataChange?.([]);
    onMonthsChange?.([]);
    message.success('All invoice data cleared');
  };

  const handleExport = () => {
    if (!rows.length) { message.warning('No data to export'); return; }

    const fixedHeaders = ['S.No.', 'OA Project Code', 'Company', 'Status'];
    const allHeaders = [...fixedHeaders, ...monthHeaders, 'Total'];

    const aoa: any[][] = [allHeaders];
    displayRows.forEach((r, i) => {
      const total = r.revenue.reduce((a, b) => a + b, 0);
      const rowData: any[] = [i + 1, r.project, r.company, r.status,
        ...monthHeaders.map((_, mi) => r.revenue[mi] || 0), total];
      aoa.push(rowData);
    });

    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);

    ws['!cols'] = allHeaders.map((_, i) => {
      if (i === 0) return { wch: 6 };
      if (i === 1) return { wch: 36 };
      if (i <= 3) return { wch: 18 };
      return { wch: 14 };
    });

    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
    ws['!sheetViews'] = [{ showGridLines: false }];

    const numCols = allHeaders.length;
    const numRows = aoa.length;

    const headerFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
    const headerFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const totalColFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFA940' } };
    const totalColFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const evenFill  = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
    const whiteFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
    const thinGray  = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
    const medNavy   = { style: 'medium' as const, color: { rgb: '001529' } };

    for (let R = 0; R < numRows; R++) {
      for (let C = 0; C < numCols; C++) {
        const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 'z', v: '' };

        const isHeader   = R === 0;
        const isTotalCol = C === numCols - 1;
        const isNumeric  = C >= fixedHeaders.length;
        const isEven     = R % 2 === 0;

        ws[addr].s = {
          fill: isHeader ? headerFill : isTotalCol ? totalColFill : isEven ? evenFill : whiteFill,
          font: isHeader ? headerFont : isTotalCol ? totalColFont : { sz: 10 },
          alignment: {
            vertical: 'center' as const,
            horizontal: (isNumeric ? 'right' : 'left') as 'right' | 'left',
            wrapText: false,
          },
          border: {
            top:    R === 0           ? medNavy : thinGray,
            bottom: R === numRows - 1 ? medNavy : thinGray,
            left:   C === 0           ? medNavy : thinGray,
            right:  C === numCols - 1 ? medNavy : thinGray,
          },
          ...(isNumeric && !isHeader ? { numFmt: '#,##0' } : {}),
        };
      }
    }

    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Invoice Data');
    XLSXStyle.writeFile(wb, `Invoice_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Export downloaded');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Text type="secondary" style={{ fontSize: '11px', color: '#8c8c8c' }}>Invoiced amounts across projects and fiscal years</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Showing: <strong>{displayRows.length}</strong>{displayRows.length !== rows.length ? ` / ${rows.length}` : ''}
          </Text>
          {fromServer && !dirty && (
            <Tooltip title="Data loaded from database">
              <CloudServerOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            </Tooltip>
          )}
          {dirty && (
            <Text type="warning" style={{ fontSize: '11px' }}>● Unsaved changes</Text>
          )}
        </Space>
        <Space size={8}>
          {availableFYs.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>FY:</Text>
              <Select
                size="small"
                allowClear
                placeholder="All FYs"
                value={filters.fy ?? undefined}
                options={availableFYs.map(f => ({ label: f.label, value: f.value.toString() }))}
                onChange={v => setFilters(f => ({ ...f, fy: v ?? null }))}
                style={{ minWidth: 90, fontSize: '11px' }}
              />
            </Space>
          )}
          <Tooltip title={currency === 'INR' ? 'Switch to USD' : 'Switch to INR'} overlayInnerStyle={{ fontSize: '11px' }}>
            <Button
              size="small"
              icon={<DollarOutlined />}
              type={currency === 'USD' ? 'primary' : 'default'}
              onClick={() => setCurrency(c => c === 'INR' ? 'USD' : 'INR')}
              style={{ fontSize: '11px' }}
            >
              {currency}
            </Button>
          </Tooltip>
          {currency === 'USD' && (
            <Tooltip title="Exchange rate (INR → USD)" overlayInnerStyle={{ fontSize: '11px' }}>
              <InputNumber
                size="small"
                value={exchangeRate}
                onChange={v => setExchangeRate(v ?? 0.013)}
                step={0.001}
                min={0.0001}
                precision={4}
                style={{ width: 80, fontSize: '11px' }}
                prefix="×"
              />
            </Tooltip>
          )}
          {dirty && canEdit && (
            <Tooltip title="Save all changes to database" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<SaveOutlined />} size="small" type="primary" loading={saving} onClick={handleSave} style={{ fontSize: '11px' }}>
                Save Changes
              </Button>
            </Tooltip>
          )}
          {isFilterApplied && (
            <Button size="small" type="link" style={{ fontSize: '11px', color: '#ff4d4f' }} onClick={() => setFilters({ project: '', company: '', fy: null, status: null })}>✕ Clear</Button>
          )}
          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} />
          </Tooltip>
          <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} />
          </Tooltip>
          {canEdit && (
          <Tooltip title="Upload Excel" overlayInnerStyle={{ fontSize: '11px' }}>
            <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />} size="small" />
            </Upload>
          </Tooltip>
          )}
          <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate} />
          </Tooltip>
          <Tooltip title="Export Data (formatted Excel)" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<FileExcelOutlined />} size="small" onClick={handleExport} disabled={!rows.length} />
          </Tooltip>
          {(canEdit || canDelete) && (
          <Tooltip title="More Actions" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<EllipsisOutlined />} size="small" onClick={() => setMoreActionsOpen(true)} />
          </Tooltip>
          )}
        </Space>
      </div>

      {uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => { setUploadError(null); setUploadErrorType('duplicate'); }}
          message={
            <span style={{ fontSize: '12px', fontWeight: 600 }}>
              {uploadErrorType === 'template'
                ? 'Upload blocked — incorrect file template'
                : uploadErrorType === 'server'
                ? 'Upload failed — server error'
                : 'Upload blocked — duplicate project codes detected'}
            </span>
          }
          description={
            <div>
              <ul style={{ margin: '4px 0 4px 0', paddingLeft: 16 }}>
                {uploadError.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}
              </ul>
              {uploadErrorType === 'template' && (
                <Button
                  type="link"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={downloadTemplate}
                  style={{ fontSize: '11px', padding: '0 0', marginTop: 4 }}
                >
                  Download correct template
                </Button>
              )}
            </div>
          }
          style={{ marginBottom: 8 }}
        />
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        {showFilterPanel && (
          <div ref={filterPanelRef} style={{ width: 220, flexShrink: 0, background: '#fafafa', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong style={{ fontSize: '12px' }}>Filters</Text>
              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({ project: '', company: '', fy: null, status: null })}>Clear all</Button>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              <div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Status</div>
                <Select size="small" placeholder="All statuses..." allowClear
                  showSearch
                  value={filters.status || undefined}
                  onChange={v => setFilters({ ...filters, status: v || null })}
                  style={{ width: '100%', fontSize: '11px' }}
                  options={[{ label: 'Active', value: 'active' }, { label: 'Inactive', value: 'inactive' }]} />
              </div>
              {[
                { label: 'Project', key: 'project', opts: [...new Set(rows.map(r => r.project).filter(Boolean))].map(v => ({ label: v, value: v })) },
                { label: 'Company', key: 'company', opts: [...new Set(rows.map(r => r.company).filter(Boolean))].map(v => ({ label: v, value: v })) },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>{label}</div>
                  <Select size="small" placeholder={`Select ${label}...`} allowClear
                    showSearch
                    filterOption={(input, option) =>
                      (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    value={(filters as any)[key] || undefined}
                    onChange={v => setFilters({ ...filters, [key]: v || '' })}
                    style={{ width: '100%', fontSize: '11px' }}
                    options={opts} />
                </div>
              ))}
            </Space>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 60, textAlign: 'center', border: '1px dashed #d9d9d9' }}>
              {loading
                ? <Spin tip="Loading from database..." />
                : <Text type="secondary">No data. Upload an Excel file to get started.</Text>
              }
            </div>
          ) : (
            <Table size="small" dataSource={displayRows} columns={columns}
              pagination={{ pageSize: 12, showSizeChanger: false }}
              scroll={{ x: 'max-content' }}
              style={{ background: '#fff', borderRadius: 8 }}
              summary={() => {
                if (!displayRows.length) return null;
                const start = filters.fy ? parseInt(filters.fy) : 0;
                // All filtered rows across all pages
                const allFiltered = rows.filter(r => {
                  if (filters.project && !r.project.toLowerCase().includes(filters.project.toLowerCase())) return false;
                  if (filters.company && !r.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
                  if (filters.status === 'active' && r.status !== 'Active') return false;
                  if (filters.status === 'inactive' && r.status !== 'Inactive') return false;
                  return true;
                });
                const monthTotals = filteredMonthHeaders.map((_, di) => {
                  const ai = filters.fy ? start + di : di;
                  return allFiltered.reduce((t, r) => t + (r.revenue[ai] || 0), 0);
                });
                const grandTotal = monthTotals.reduce((a, b) => a + b, 0);
                const fmtT = (v: number) => currency === 'USD'
                  ? `$ ${(v * exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                  : `₹ ${v.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                let cellIdx = 0;
                let skippedSno = false;
                let labelEmitted = false;
                return (
                  <Table.Summary fixed="bottom">
                    <Table.Summary.Row style={{ background: '#f0f5ff' }}>
                      {columns.map(col => {
                        const key = col.key as string;
                        const isMonth = filteredMonthHeaders.includes(key);
                        const isTotal = key === 'total';
                        const isActions = key === 'actions';
                        const isSno = key === 'sno';
                        const isProject = key === 'project';
                        const idx = cellIdx++;
                        if (isSno) { skippedSno = true; return null; }
                        if (isProject && skippedSno && !labelEmitted) {
                          labelEmitted = true;
                          return (
                            <Table.Summary.Cell key={key} index={idx - 1} colSpan={2}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#003a8c' }}>All Projects Total</span>
                            </Table.Summary.Cell>
                          );
                        }
                        if (isMonth) {
                          const di = filteredMonthHeaders.indexOf(key);
                          const t = monthTotals[di] || 0;
                          return (
                            <Table.Summary.Cell key={key} index={idx} align="left">
                              <span style={{ fontSize: '10px', fontWeight: 700, color: t ? '#003a8c' : '#bfbfbf', whiteSpace: 'nowrap' }}>
                                {t ? fmtT(t) : '—'}
                              </span>
                            </Table.Summary.Cell>
                          );
                        }
                        if (isTotal) {
                          return (
                            <Table.Summary.Cell key={key} index={idx} align="left">
                              <div style={{ background: '#FFA940', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {fmtT(grandTotal)}
                              </div>
                            </Table.Summary.Cell>
                          );
                        }
                        if (isActions) return <Table.Summary.Cell key={key} index={idx} />;
                        return <Table.Summary.Cell key={key} index={idx} />;
                      })}
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          )}
        </div>
      </div>

      <Drawer title="Column Visibility" placement="right" onClose={() => setColumnDrawer(false)} open={columnDrawer} width={280}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {['sno', 'project', 'company', 'code'].map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox checked={visibleColumns.has(key)} onChange={e => {
                const s = new Set(visibleColumns);
                e.target.checked ? s.add(key) : s.delete(key);
                setVisibleColumns(s);
              }} />
              <span style={{ textTransform: 'capitalize' }}>{key}</span>
            </div>
          ))}
        </Space>
      </Drawer>

      {/* Detail Side Panel */}
      <Drawer
        title={
          <Space>
            <EyeOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: '13px' }}>{selectedDetailRow?.project || 'Record Details'}</span>
          </Space>
        }
        placement="right"
        width={detailDrawerExpanded ? '90vw' : 520}
        open={detailDrawer}
        onClose={() => { setDetailDrawer(false); setSelectedDetailRow(null); setAuditLog([]); setNewComment(''); setDetailDrawerExpanded(false); setAuditSearch(''); setAuditFieldFilter(null); setAuditByFilter(null); }}
        extra={
          <Space size={4}>
            {selectedDetailRow && canEdit && (
              <Tooltip title="Edit record" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined style={{ fontSize: '14px', color: '#1890ff' }} />}
                  onClick={() => { openEdit(selectedDetailRow); setDetailDrawer(false); setDetailDrawerExpanded(false); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6 }}
                />
              </Tooltip>
            )}
            <Tooltip title={detailDrawerExpanded ? 'Collapse' : 'Expand'} overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                type="text"
                size="small"
                icon={detailDrawerExpanded
                  ? <FullscreenExitOutlined style={{ fontSize: '14px', color: '#595959' }} />
                  : <FullscreenOutlined style={{ fontSize: '14px', color: '#595959' }} />}
                onClick={() => setDetailDrawerExpanded(e => !e)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6 }}
              />
            </Tooltip>
          </Space>
        }
      >
        {selectedDetailRow && (() => {
          const auditFieldOptions = Array.from(new Set(auditLog.map(a => a.field))).map(f => ({ value: f, label: f }));
          const auditByOptions = Array.from(new Set(auditLog.map(a => a.changed_by).filter(Boolean))).map(b => ({ value: b, label: b }));
          const q = auditSearch.toLowerCase().trim();
          const filteredAudit = auditLog.filter(a => {
            if (auditFieldFilter && a.field !== auditFieldFilter) return false;
            if (auditByFilter && a.changed_by !== auditByFilter) return false;
            if (q && !['field','old_value','new_value','changed_by'].some(k => String((a as any)[k] || '').toLowerCase().includes(q))) return false;
            return true;
          });
          return (
            <div style={{ display: detailDrawerExpanded ? 'grid' : 'flex', gridTemplateColumns: detailDrawerExpanded ? '1fr 1fr' : undefined, flexDirection: detailDrawerExpanded ? undefined : 'column', gap: 16 }}>
              {/* Left column: details + comments */}
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                  <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>Invoice Project Details</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Project</Text>
                      <div style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-word' }}>{selectedDetailRow.project || '—'}</div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Company</Text>
                      <div style={{ fontSize: '13px' }}>{selectedDetailRow.company || '—'}</div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Code</Text>
                      <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#595959' }}>{selectedDetailRow.code || '—'}</div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Status</Text>
                      <div style={{ marginTop: 2 }}>
                        <Tag color={selectedDetailRow.status === 'Active' ? 'success' : 'default'} style={{ fontSize: '11px' }}>
                          {selectedDetailRow.status}
                        </Tag>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                  <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>
                    <MessageOutlined style={{ marginRight: 6, color: '#1890ff' }} />Comments
                  </Text>
                  {selectedDetailRow.comments ? (
                    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 6, padding: '10px 12px', marginBottom: 12, fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: detailDrawerExpanded ? 300 : 180, overflowY: 'auto', lineHeight: 1.6 }}>
                      {selectedDetailRow.comments}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 12 }}>No comments yet.</Text>
                  )}
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <Input.TextArea rows={2} value={newComment} onChange={e => setNewComment(e.target.value)}
                        placeholder={`Type a comment… (saved as: ${currentUser?.username || 'you'} : ${formatCommentDate(new Date())} : your text)`}
                        style={{ fontSize: '11px', flex: 1 }}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                      />
                      <Button size="small" onClick={handleAddComment} disabled={!newComment.trim()}
                        style={{ whiteSpace: 'nowrap', background: newComment.trim() ? '#d9d9d9' : '#f0f0f0', color: newComment.trim() ? '#262626' : '#bfbfbf', border: '1px solid #d9d9d9', cursor: newComment.trim() ? 'pointer' : 'not-allowed' }}>
                        Add
                      </Button>
                    </div>
                  )}
                </div>
              </Space>

              {/* Right column (or bottom when collapsed): Audit Trail */}
              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, minHeight: 120 }}>
                <div style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8 }}>
                    <ClockCircleOutlined style={{ marginRight: 6, color: '#722ed1' }} />Audit Trail
                    {filteredAudit.length !== auditLog.length && (
                      <Text type="secondary" style={{ fontSize: '11px', marginLeft: 8 }}>({filteredAudit.length} of {auditLog.length})</Text>
                    )}
                  </Text>
                  <Space wrap size={6}>
                    <Input
                      size="small"
                      allowClear
                      placeholder="Search…"
                      value={auditSearch}
                      onChange={e => setAuditSearch(e.target.value)}
                      style={{ width: 140, fontSize: '11px' }}
                    />
                    <Select
                      size="small"
                      allowClear
                      placeholder="Field"
                      value={auditFieldFilter}
                      onChange={v => setAuditFieldFilter(v ?? null)}
                      options={auditFieldOptions}
                      style={{ width: 120, fontSize: '11px' }}
                      popupMatchSelectWidth={false}
                    />
                    <Select
                      size="small"
                      allowClear
                      placeholder="Changed by"
                      value={auditByFilter}
                      onChange={v => setAuditByFilter(v ?? null)}
                      options={auditByOptions}
                      style={{ width: 120, fontSize: '11px' }}
                      popupMatchSelectWidth={false}
                    />
                    {(auditSearch || auditFieldFilter || auditByFilter) && (
                      <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 2px', color: '#ff4d4f' }}
                        onClick={() => { setAuditSearch(''); setAuditFieldFilter(null); setAuditByFilter(null); }}>
                        ✕ Clear
                      </Button>
                    )}
                  </Space>
                </div>
                {auditLoading ? (
                  <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
                ) : filteredAudit.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: '12px' }}>{auditLog.length === 0 ? 'No changes recorded yet.' : 'No results match the current filters.'}</Text>
                ) : (
                  <Table
                    size="small"
                    dataSource={filteredAudit}
                    rowKey="id"
                    pagination={{ pageSize: detailDrawerExpanded ? 10 : 5, size: 'small', showSizeChanger: false }}
                    columns={[
                      { title: 'Field', dataIndex: 'field', key: 'field', width: 80,
                        render: (v: string) => <Text style={{ fontSize: '11px', textTransform: 'capitalize' }}>{v}</Text> },
                      { title: 'From', dataIndex: 'old_value', key: 'old_value', ellipsis: true, width: 90,
                        render: (v: string) => <Tooltip title={v}><Text style={{ fontSize: '11px' }}>{v || '—'}</Text></Tooltip> },
                      { title: 'To', dataIndex: 'new_value', key: 'new_value', ellipsis: true, width: 90,
                        render: (v: string) => <Tooltip title={v}><Text style={{ fontSize: '11px', color: '#1890ff' }}>{v || '—'}</Text></Tooltip> },
                      { title: 'By', dataIndex: 'changed_by', key: 'changed_by', width: 70,
                        render: (v: string) => <Text style={{ fontSize: '11px' }}>{v || '—'}</Text> },
                      { title: 'When', dataIndex: 'changed_at', key: 'changed_at', width: 110,
                        render: (v: string) => <Text style={{ fontSize: '11px' }}>{v ? new Date(v).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}</Text> },
                    ]}
                  />
                )}
              </div>
            </div>
          );
        })()}
      </Drawer>

      {/* Edit Row Modal */}
      <Modal
        title={<Space><EditOutlined style={{ color: '#1890ff' }} /><span style={{ fontSize: '13px' }}>Edit Project</span></Space>}
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingRow(null); }}
        onOk={handleEditSave}
        okText="Save"
        width={480}
        okButtonProps={{ size: 'small' }}
        cancelButtonProps={{ size: 'small' }}
      >
        {editingRow && (
          <Form form={editForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
            <Form.Item label={<span style={{ fontSize: '11px' }}>Code (derived, non-editable)</span>}>
              <Input
                value={deriveCode(editForm.getFieldValue('project') || editingRow.project)}
                disabled
                style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f5f5f5' }}
              />
            </Form.Item>
            <Form.Item name="project" label={<span style={{ fontSize: '11px' }}>Project Name</span>} rules={[{ required: true, message: 'Project name is required' }]}>
              <Input style={{ fontSize: '12px' }} />
            </Form.Item>
            <Form.Item name="company" label={<span style={{ fontSize: '11px' }}>Company</span>}>
              {companyOptions.length > 0 ? (
                <Select showSearch allowClear size="small" options={companyOptions} placeholder="Select company…" style={{ fontSize: '12px' }} notFoundContent="No options — add in Configuration" />
              ) : (
                <Input style={{ fontSize: '12px' }} />
              )}
            </Form.Item>
            <Form.Item name="status" label={<span style={{ fontSize: '11px' }}>Status</span>} initialValue="Active">
              <Select size="small" options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item name="comments" label={<span style={{ fontSize: '11px' }}>Comments</span>}>
              <Input.TextArea rows={2} placeholder="Add notes..." style={{ fontSize: '11px' }} />
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Add New Project Modal */}
      <Modal
        title={<Space><PlusOutlined style={{ color: '#52c41a' }} /><span style={{ fontSize: '13px' }}>Add New Project</span></Space>}
        open={addModalOpen}
        onCancel={() => { setAddModalOpen(false); addForm.resetFields(); }}
        onOk={handleAddProject}
        okText="Add Project"
        width={480}
        okButtonProps={{ size: 'small' }}
        cancelButtonProps={{ size: 'small' }}
      >
        <Form form={addForm} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item name="project" label={<span style={{ fontSize: '11px' }}>Project Name</span>} rules={[{ required: true, message: 'Project name is required' }]}>
            <Input style={{ fontSize: '12px' }} placeholder="e.g. Account Management Platform" />
          </Form.Item>
          <Form.Item name="company" label={<span style={{ fontSize: '11px' }}>Company</span>}>
            <Select
              showSearch allowClear
              placeholder={companyOptions.length ? 'Select or type…' : 'Type company name'}
              options={companyOptions}
              style={{ fontSize: '12px' }}
              size="small"
              notFoundContent={companyOptions.length ? 'No options — add in Configuration' : null}
            />
          </Form.Item>
          <Form.Item label={<span style={{ fontSize: '11px' }}>Code (auto-derived from project name)</span>}>
            <Input
              value={deriveCode(addForm.getFieldValue('project') || '')}
              disabled
              style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f5f5f5' }}
            />
          </Form.Item>
          <Form.Item name="comments" label={<span style={{ fontSize: '11px' }}>Comments</span>}>
            <Input.TextArea rows={2} placeholder="Add notes..." style={{ fontSize: '11px' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* More Actions Modal */}
      <Modal
        title={<Space><EllipsisOutlined /><span style={{ fontSize: '13px' }}>More Actions</span></Space>}
        open={moreActionsOpen}
        onCancel={() => setMoreActionsOpen(false)}
        footer={null}
        width={420}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          {canEdit && (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4 }}>
              <PlusOutlined style={{ color: '#52c41a', marginRight: 6 }} />Add New Project
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Add an empty project row. Invoice amount columns will be pre-filled with 0 for all existing months.
            </div>
            <Button size="small" type="primary" icon={<PlusOutlined />}
              style={{ fontSize: '11px' }}
              onClick={() => { setMoreActionsOpen(false); setAddModalOpen(true); }}>
              Add Project
            </Button>
          </div>
          )}

          {canEdit && (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4 }}>
              <CalendarOutlined style={{ color: '#1890ff', marginRight: 6 }} />Generate Empty Month Columns
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Add all 12 empty month columns for a fiscal year (Oct–Sep). Only missing months are added.
            </div>
            <Space size={8}>
              <Select
                placeholder="Select FY…"
                size="small"
                style={{ width: 160, fontSize: '11px' }}
                value={generateFY}
                onChange={setGenerateFY}
                options={candidateFYs.map(fy => ({ value: fy, label: fy }))}
                allowClear
              />
              <Button
                size="small"
                icon={<CalendarOutlined />}
                disabled={!generateFY}
                style={{
                  fontSize: '11px',
                  backgroundColor: generateFY ? '#d9d9d9' : '#f0f0f0',
                  color: generateFY ? '#262626' : '#8c8c8c',
                  borderColor: '#d9d9d9',
                  cursor: generateFY ? 'pointer' : 'not-allowed',
                }}
                onClick={() => { if (generateFY) { handleGenerateFY(); setMoreActionsOpen(false); } }}
              >
                Generate
              </Button>
            </Space>
          </div>
          )}

          {canDelete && (
          <div style={{ border: '1px solid #fff1f0', borderRadius: 8, padding: '12px 16px', background: '#fff1f0' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4, color: '#cf1322' }}>
              <DeleteOutlined style={{ marginRight: 6 }} />Delete All Data
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Permanently removes all projects and invoice amounts from the database. This cannot be undone.
            </div>
            <Popconfirm
              title="Delete all invoice data?"
              description="This will permanently remove ALL projects and invoice amounts from the database."
              onConfirm={() => { handleClearAll(); setMoreActionsOpen(false); }}
              okText="Yes, delete all"
              cancelText="Cancel"
              okButtonProps={{ danger: true, size: 'small' }}
              cancelButtonProps={{ size: 'small' }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={rows.length === 0}
                style={{ fontSize: '11px' }}>
                Delete All Data
              </Button>
            </Popconfirm>
          </div>
          )}
        </Space>
      </Modal>
    </div>
  );
}

interface InvoiceInsightsProps {
  data: InvRow[];
  monthHeaders: string[];
}

function InvoiceInsights({ data, monthHeaders }: InvoiceInsightsProps) {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);
  const [exporting, setExporting] = useState(false);
  const insightsRef = useRef<HTMLDivElement>(null);

  const availableFYs = useMemo(() => {
    const fySet = new Set<number>();
    monthHeaders.forEach(m => {
      const info = getMonthFY(m);
      if (info) fySet.add(info.fy);
    });
    const sorted = Array.from(fySet).sort();
    return sorted.length ? sorted.map(fy => `FY${fy}`) : ['FY2026'];
  }, [monthHeaders]);

  const [fiscalYear, setFiscalYear] = useState<string>(availableFYs[0]);

  const fmt = (n: number) =>
    currency === 'USD' ? usd(n * exchangeRate) : inr(n);

  const qData = useMemo(() => {
    const fyNum = parseInt(fiscalYear.replace('FY', ''));
    const quarters = [0, 1, 2, 3].map(q => {
      const positions = [q * 3, q * 3 + 1, q * 3 + 2];
      const mLabels = positions.map(pos => fyMonthLabel(fyNum, pos));
      const total = data.reduce((t, r) =>
        t + mLabels.reduce((s, lbl) => {
          const idx = monthHeaders.indexOf(lbl);
          return s + (idx !== -1 ? (r.revenue[idx] || 0) : 0);
        }, 0), 0);
      return { total, label: `Q${q + 1}`, months: `${mLabels[0]}–${mLabels[2]}` };
    });
    const grand = quarters.reduce((a, b) => a + b.total, 0);
    return {
      quarters: quarters.map(q => ({ ...q, pct: grand ? Math.round((q.total / grand) * 100) : 0 })),
      grand,
    };
  }, [data, monthHeaders, fiscalYear]);

  const monthlyData = useMemo(() => {
    const fyNum = parseInt(fiscalYear.replace('FY', ''));
    const months: { label: string; total: number; pct: number }[] = [];
    for (let pos = 0; pos < 12; pos++) {
      const lbl = fyMonthLabel(fyNum, pos);
      const idx = monthHeaders.indexOf(lbl);
      const total = idx !== -1 ? data.reduce((t, r) => t + (r.revenue[idx] || 0), 0) : 0;
      months.push({ label: lbl, total, pct: 0 });
    }
    const max = Math.max(...months.map(m => m.total), 1);
    return months.map(m => ({ ...m, pct: Math.round((m.total / max) * 100) }));
  }, [data, monthHeaders, fiscalYear]);

  const yoyData = useMemo(() => {
    if (availableFYs.length < 2) return null;
    const calc = (fyLabel: string) => {
      const fyNum = parseInt(fyLabel.replace('FY', ''));
      return data.reduce((t, r) =>
        t + MONTH_ORDER.reduce((s, _, pos) => {
          const idx = monthHeaders.indexOf(fyMonthLabel(fyNum, pos));
          return s + (idx !== -1 ? (r.revenue[idx] || 0) : 0);
        }, 0), 0);
    };
    const fy1 = calc(availableFYs[0]), fy2 = calc(availableFYs[1]);
    return { fy1, fy2, pct: fy1 ? Math.round(((fy2 - fy1) / fy1) * 100) : 0, labels: [availableFYs[0], availableFYs[1]] };
  }, [data, availableFYs, monthHeaders]);

  const qColors = ['#1890FF', '#52C41A', '#FFA940', '#FF7875'];
  const qPctColor = (p: number) => p >= 30 ? '#52C41A' : p >= 20 ? '#FFA940' : '#FF7875';

  const handleExportPNG = async () => {
    if (!insightsRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(insightsRef.current, {
        backgroundColor: '#f5f7fa',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `Invoice_Insights_${fiscalYear}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      message.error('Failed to export PNG');
    } finally {
      setExporting(false);
    }
  };

  if (!data || !data.length) return <Empty description="Upload data to view insights" style={{ marginTop: 48 }} />;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div ref={insightsRef} style={{ padding: '4px 0 8px' }}>
        {/* Filter bar: USD left, spacer, FY + download right */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {/* Currency – leftmost */}
          <Space size={6}>
            <Tooltip title={currency === 'INR' ? 'Switch to USD' : 'Switch to INR'} overlayInnerStyle={{ fontSize: '11px' }}>
              <Button size="small" icon={<DollarOutlined />}
                type={currency === 'USD' ? 'primary' : 'default'}
                onClick={() => setCurrency(c => c === 'INR' ? 'USD' : 'INR')}
                style={{ fontSize: '11px' }}>
                {currency}
              </Button>
            </Tooltip>
            {currency === 'USD' && (
              <Tooltip title="Exchange rate (INR → USD)" overlayInnerStyle={{ fontSize: '11px' }}>
                <InputNumber size="small" value={exchangeRate}
                  onChange={v => setExchangeRate(v || 0.013)}
                  step={0.001} precision={4} min={0.0001}
                  style={{ width: 80, fontSize: '11px' }} prefix="×" />
              </Tooltip>
            )}
          </Space>

          {/* Spacer pushes filters + download to right */}
          <div style={{ flex: 1 }} />

          {/* FY filter – right side */}
          {availableFYs.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>FY:</Text>
              <Select size="small" value={fiscalYear}
                onChange={v => setFiscalYear(v as string)}
                options={availableFYs.map(fy => ({ label: fy, value: fy }))}
                style={{ minWidth: 90, fontSize: '11px' }} />
            </Space>
          )}

          {/* Download icon – aligned with filter row */}
          <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button size="small" type="text"
              icon={<DownloadOutlined style={{ fontSize: 15, color: '#8c8c8c' }} />}
              loading={exporting} onClick={handleExportPNG}
              style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }} />
          </Tooltip>
        </div>

        {/* Summary bar */}
        <div style={{ background: 'linear-gradient(135deg, #001529 0%, #002A4D 100%)', borderRadius: 8, padding: '16px 20px', color: '#fff', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Annual Invoice Amount ({currency})</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#FFA940', marginTop: 4 }}>{fmt(qData.grand)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Total Projects</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: 4 }}>{data.length}</div>
            </div>
          </div>
        </div>

        {/* Quarterly KPI cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {qData.quarters.map((q, i) => (
            <Col key={q.label} xs={24} sm={12} md={6}>
              <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }} hoverable>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 2 }}>{q.label}</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>{q.months}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: qPctColor(q.pct), marginBottom: 4 }}>{fmt(q.total)}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: 6 }}>{q.pct}% of annual</div>
                <Progress percent={q.pct} strokeColor={qColors[i]} format={() => ''} size="small" />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Monthly breakdown bar chart */}
        <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>Monthly Breakdown – {fiscalYear}</h3>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140, width: '100%' }}>
            {monthlyData.map((m, i) => {
              const qIdx = Math.floor(i / 3);
              const barColor = qColors[qIdx];
              return (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Tooltip title={fmt(m.total)} overlayInnerStyle={{ fontSize: '11px' }}>
                    <div style={{ width: '60%', height: 100, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${Math.max(m.pct, 3)}%`,
                        background: barColor,
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease',
                        cursor: 'default',
                      }} />
                    </div>
                  </Tooltip>
                  <div style={{ fontSize: '9px', color: '#8c8c8c', whiteSpace: 'nowrap', transform: 'rotate(-40deg)', transformOrigin: 'top center', marginTop: 6, lineHeight: 1 }}>
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 30, flexWrap: 'wrap' }}>
            {['Q1 (Oct–Dec)', 'Q2 (Jan–Mar)', 'Q3 (Apr–Jun)', 'Q4 (Jul–Sep)'].map((q, i) => (
              <span key={q} style={{ fontSize: '11px', color: '#595959', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: qColors[i] }} />
                {q}
              </span>
            ))}
          </div>
        </Card>

        {yoyData && (
          <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 16 }}>Year-over-Year Comparison</h3>
            <Row gutter={[16, 16]}>
              {[
                { label: yoyData.labels[0], value: yoyData.fy1, color: '#1890FF' },
                { label: yoyData.labels[1], value: yoyData.fy2, color: '#52C41A' },
              ].map(({ label, value, color }) => (
                <Col key={label} xs={24} sm={12}>
                  <div style={{ padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#8c8c8c', marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color, marginBottom: 2 }}>{fmt(value)}</div>
                    <div style={{ fontSize: '11px', color: '#bfbfbf' }}>Total Invoice Amount</div>
                  </div>
                </Col>
              ))}
              <Col xs={24}>
                <div style={{ padding: '10px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: yoyData.pct >= 0 ? '#52C41A' : '#FF7875' }}>
                    {yoyData.pct >= 0 ? '+' : ''}{yoyData.pct}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {yoyData.pct >= 0 ? 'Growth' : 'Decline'} from {yoyData.labels[0]} to {yoyData.labels[1]}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </div>
    </div>
  );
}

interface InvoiceManagementProps {
  onNavigate?: (module: string) => void;
}

export function InvoiceManagement({ onNavigate: _onNavigate }: InvoiceManagementProps) {
  const [projectData, setProjectData] = useState<InvRow[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'invoices',
      label: <span style={{ fontSize: '11px' }}><FileTextOutlined /> Project Invoices</span>,
      children: (
        <div style={{ padding: '0 0 16px' }}>
          <InvoiceList onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
        </div>
      ),
    },
    {
      key: 'insights',
      label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Insights</span>,
      children: <InvoiceInsights data={projectData} monthHeaders={monthHeaders} />,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: 8 }}>
            <Tabs items={items} size="small" defaultActiveKey="invoices" style={{ padding: '0 16px' }} />
          </div>
        </Space>
      </div>
    </div>
  );
}
