import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Typography, Space, Upload, Table, Button, message, Input, InputNumber, Tooltip,
  Drawer, Checkbox, Select, Spin, Popconfirm, Modal, Form, Tag, Dropdown, Alert, Badge, Collapse,
} from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import {
  UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined,
  FileExcelOutlined, CloudServerOutlined, SaveOutlined, DeleteOutlined,
  EditOutlined, CalendarOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined,
  WarningOutlined, EllipsisOutlined, DollarOutlined,
  EyeOutlined, ClockCircleOutlined, MessageOutlined, FullscreenOutlined, FullscreenExitOutlined,
  ExclamationCircleOutlined, SearchOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import * as financeApi from '../../api/financeApi';
import * as invoiceApi from '../../api/invoiceApi';
import * as auditApi from '../../api/auditApi';
import type { AuditEntry } from '../../api/auditApi';
import { validateAndGroupBulkBookings } from './bookingUploadUtils';
import ProjectBookingDrawer from './ProjectBookingDrawer';
import BulkBookingDrawer from './BulkBookingDrawer';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { useUserPreferences } from '../../context/UserPreferencesContext';
import { getLinkedConfigLabelOptions } from '../../utils/configOptions';
import { getCurrentDateStamp } from '../../utils/styledExcelExport';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { setFinanceData, setInvoiceData } from '../../store/financeDataSlice';

const { Text } = Typography;

type ExcelRow = Record<string, any>;

export type Row = {
  key: string;
  id?: number;
  sno: number;
  project: string;
  company: string;
  code: string;
  space: string;
  owner: string;
  /** Driven from DB status field — 'Active' | 'Inactive' */
  status: 'Active' | 'Inactive';
  revenue: number[];
  /** Per-month milestone type; default 'booked'. Anticipated shown in red. */
  milestoneTypes: Record<string, 'booked' | 'anticipated'>;
  comments: string;
};

const BULK_BOOKING_UPLOAD_REQUIRED_HEADERS = ['Project Code', 'Milestone Month', 'Booking Month', 'Amount'] as const;

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

function deriveProjectCode(name: unknown): string {
  const normalizedName = String(name || '').trim();
  if (!normalizedName) return '';
  return normalizedName.split(' - ')[0].trim() || normalizedName;
}

function findMissingHeaders(headers: string[], required: readonly string[]): string[] {
  return required.filter((h) => !headers.includes(h));
}

// ─── Fiscal year helpers ─────────────────────────────────────────────────────
const MONTH_ORDER_FM = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

function getMonthFY(label: string): { fy: number; pos: number } | null {
  const m = label.trim().match(/^([A-Za-z]{3})[''`](\d{2})$/);
  if (!m) return null;
  const pos = MONTH_ORDER_FM.indexOf(m[1]);
  if (pos === -1) return null;
  const yr = 2000 + parseInt(m[2]);
  return { fy: pos < 3 ? yr + 1 : yr, pos };
}

function monthSortKey(label: string): number {
  const info = getMonthFY(label);
  if (!info) return Number.MAX_SAFE_INTEGER;
  return info.fy * 100 + info.pos;
}

/** Returns true if an Excel fill RGB hex looks like a red/pink (= anticipated) cell */
function isAnticipatedColor(rgb?: string): boolean {
  if (!rgb || rgb.length < 6) return false;
  const hex = rgb.length === 8 ? rgb.slice(2) : rgb; // strip alpha channel if present
  if (hex.length < 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  return r > 180 && r > g + 40; // red/pink dominant → anticipated
}

function downloadTemplate() {
  const headers = [
    'S.No.', 'Project', 'Company', 'Space', 'Owners',
    "Oct'25", "Nov'25", "Dec'25",
    "Jan'26", "Feb'26", "Mar'26", "Apr'26", "May'26", "Jun'26",
    "Jul'26", "Aug'26", "Sep'26",
    "Oct'26", "Nov'26", "Dec'26",
    "Jan'27", "Feb'27", "Mar'27", "Apr'27", "May'27", "Jun'27",
    "Jul'27", "Aug'27", "Sep'27",
  ];

  const sampleRows = [
    { 'S.No.': 1, Project: 'PROJ-001 - Sample Booked Project', Company: 'Company A', Space: 'Space A', Owners: 'Owner A', type: 'booked' },
    { 'S.No.': 2, Project: 'PROJ-002 - Sample Anticipated Project', Company: 'Company B', Space: 'Space B', Owners: 'Owner B', type: 'anticipated' },
    { 'S.No.': 3, Project: '', Company: '', Space: '', Owners: '', type: 'blank' },
    { 'S.No.': 4, Project: '', Company: '', Space: '', Owners: '', type: 'blank' },
    { 'S.No.': 5, Project: '', Company: '', Space: '', Owners: '', type: 'blank' },
  ];

  // Build AOA
  const aoa: any[][] = [headers, ...sampleRows.map(r => {
    const row: any[] = [r['S.No.'], r.Project, r.Company, r.Space, r.Owners];
    // Fill sample revenue for non-blank rows
    const monthCols = headers.slice(5);
    monthCols.forEach(m => {
      if (r.type === 'booked') row.push(r['S.No.'] === 1 ? 100000 : 0);
      else if (r.type === 'anticipated') row.push(r['S.No.'] === 2 ? 80000 : 0);
      else row.push('');
    });
    return row;
  })];

  const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);

  // Column widths
  ws['!cols'] = headers.map((_, i) => {
    if (i === 0) return { wch: 6 };
    if (i === 1) return { wch: 40 };
    if (i <= 4) return { wch: 18 };
    return { wch: 12 };
  });

  // Freeze panes: header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };

  const headerFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
  const headerFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
  const bookedFill  = { patternType: 'solid' as const, fgColor: { rgb: 'D9F7BE' } }; // light green
  const anticFill   = { patternType: 'solid' as const, fgColor: { rgb: 'FFCCC7' } }; // light red/pink
  const whiteFill   = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
  const thinGray    = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
  const medNavy     = { style: 'medium' as const, color: { rgb: '001529' } };

  const numRows = aoa.length;
  const numCols = headers.length;

  for (let R = 0; R < numRows; R++) {
    const rowType = R === 0 ? 'header' : sampleRows[R - 1]?.type || 'blank';
    for (let C = 0; C < numCols; C++) {
      const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
      const isMonthCol = C >= 5;
      let fill = whiteFill;
      if (R === 0) fill = headerFill;
      else if (isMonthCol && rowType === 'booked') fill = bookedFill;
      else if (isMonthCol && rowType === 'anticipated') fill = anticFill;

      ws[addr].s = {
        fill,
        font: R === 0 ? headerFont : { sz: 10 },
        alignment: { vertical: 'center' as const, horizontal: (isMonthCol ? 'right' : 'left') as 'right' | 'left' },
        border: {
          top:    R === 0           ? medNavy : thinGray,
          bottom: R === numRows - 1 ? medNavy : thinGray,
          left:   C === 0           ? medNavy : thinGray,
          right:  C === numCols - 1 ? medNavy : thinGray,
        },
      };

      // Add a comment on the first month header cell to explain color convention
      if (R === 0 && C === 5) {
        ws[addr].c = [{
          a: 'Color Legend',
          t: 'Cell color convention (auto-detected on upload):\n\n🟢 GREEN cell (D9F7BE) = Booked revenue (confirmed)\n🔴 RED/PINK cell (FFCCC7) = Anticipated revenue (not yet confirmed)\n\nTo mark a revenue cell as "Anticipated", fill it with any red or pink color before uploading.\nLeave cells white or green for "Booked" (default).',
        }];
      }
    }
  }

  // Add an "Instructions" sheet explaining the color convention
  const instrAoa = [
    ['SOW Revenue Template — Instructions'],
    [''],
    ['Column Guide'],
    ['S.No.',   'Row number (auto-populated — do not edit)'],
    ['Project', 'Full project name in format: CODE - Description (e.g. PROJ-001 - My Project)'],
    ['Company', 'Client company name'],
    ['Space',   'Business space / practice area'],
    ['Owners',  'Project owner name(s)'],
    ['Month columns', 'Revenue amount in INR for that month'],
    [''],
    ['Color Convention (for Revenue Cells)'],
    ['Green (D9F7BE)',     'Booked — confirmed revenue'],
    ['Red / Pink (FFCCC7)', 'Anticipated — expected but not yet confirmed'],
    ['White / No color',   'Booked (default if no color set)'],
    [''],
    ['How to mark a cell as Anticipated:'],
    ['', '1. Select the revenue cell(s) in the data sheet'],
    ['', '2. Apply a red or pink fill color (e.g. FFCCC7 or any red shade)'],
    ['', '3. Upload the file — the system auto-detects the color and marks it as Anticipated'],
    [''],
    ['Note: The "A" and "B" labels visible in the app indicate Anticipated and Booked respectively.'],
  ];
  const wsInstr: any = XLSXStyle.utils.aoa_to_sheet(instrAoa);
  wsInstr['!cols'] = [{ wch: 28 }, { wch: 70 }];
  // Style title
  const titleAddr = 'A1';
  if (wsInstr[titleAddr]) {
    wsInstr[titleAddr].s = { font: { bold: true, sz: 13, color: { rgb: '001529' } } };
  }
  // Style section headers
  ['A3', 'A11', 'A15'].forEach(a => {
    if (wsInstr[a]) wsInstr[a].s = { font: { bold: true, sz: 10 }, fill: { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } } };
  });
  // Color the green/red sample cells in instructions
  if (wsInstr['A12']) wsInstr['A12'].s = { fill: { patternType: 'solid' as const, fgColor: { rgb: 'D9F7BE' } }, font: { sz: 10 } };
  if (wsInstr['A13']) wsInstr['A13'].s = { fill: { patternType: 'solid' as const, fgColor: { rgb: 'FFCCC7' } }, font: { sz: 10 } };

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Revenue Template');
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instructions');
  XLSXStyle.writeFile(wb, 'SOW_Details_Template.xlsx');
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

export interface ProjectListProps {
  onDataChange?: (data: Row[]) => void;
  onMonthsChange?: (months: string[]) => void;
}

export function ProjectList({ onDataChange, onMonthsChange }: ProjectListProps) {
  const dispatch = useAppDispatch();
  const sharedFinanceProjects = useAppSelector((state) => state.financeData.financeProjects);
  const sharedFinanceMonths = useAppSelector((state) => state.financeData.financeMonths);
  const sharedFinanceLoaded = useAppSelector((state) => state.financeData.financeLoaded);
  const sharedFinanceFromServer = useAppSelector((state) => state.financeData.financeFromServer);
  const sharedInvoiceProjects = useAppSelector((state) => state.financeData.invoiceProjects);
  const sharedInvoiceLoaded = useAppSelector((state) => state.financeData.invoiceLoaded);
  const { configs } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const canEdit = hasPermission('executive_revenue', 'edit');
  const canDelete = hasPermission('executive_revenue', 'delete');

  // Config-driven dropdowns for Add Project modal
  const companyOptions = getLinkedConfigLabelOptions(configs, 'finance_company_field', 'ProjectList');
  const spaceOptions = getLinkedConfigLabelOptions(configs, 'finance_space_field', 'ProjectList');
  const ownerOptions = getLinkedConfigLabelOptions(configs, 'finance_owner_field', 'ProjectList');

  const [rows, setRows] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromServer, setFromServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDeletedProjectIds, setPendingDeletedProjectIds] = useState<number[]>([]);
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(
    new Set(['sno', 'project', 'company', 'code', 'space', 'owner', 'total', 'comments'])
  );

  // Apply saved user preferences once loaded
  useEffect(() => {
    if (!preferencesLoaded) return;
    const vis = getColumnVisibility('sow');
    const keys = Object.entries(vis).filter(([,v]) => v).map(([k]) => k);
    setVisibleColumnsState(new Set(['sno', 'total', ...keys]));
  }, [preferencesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleColumns = (newSet: Set<string>) => {
    setVisibleColumnsState(newSet);
    const vis: Record<string, boolean> = {};
    ['project','company','code','space','owner','comments'].forEach(k => { vis[k] = newSet.has(k); });
    saveColumnVisibility('sow', vis);
  };
  const [filters, setFilters] = useState<{
    project: string; company: string; space: string; owner: string; fy: string | null; status: string | null;
  }>({ project: '', company: '', space: '', owner: '', fy: null, status: null });

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [editForm] = Form.useForm();

  // Add new project modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addForm] = Form.useForm();

  // Generate FY state
  const [generateFY, setGenerateFY] = useState<string | null>(null);

  // Currency toggle (shared with Insights logic)
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);

  // More Actions modal
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  // Row selection for bulk operations (managed inside More Actions, not via table checkboxes)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // Bulk booking panel (multi-project)
  const [bulkBookingOpen, setBulkBookingOpen] = useState(false);
  const [bulkAllUploadErrors, setBulkAllUploadErrors] = useState<string[] | null>(null);
  const [bulkAllSaving, setBulkAllSaving] = useState(false);
  const [bulkRefreshToken, setBulkRefreshToken] = useState(0);

  // Project selector state inside Manage Bookings
  const [bkProjectSearch, setBkProjectSearch] = useState('');
  const [bkProjectFyFilter, setBkProjectFyFilter] = useState<string | null>(null);

  // Persistent upload error (cleared only on new upload attempt or page refresh)
  const [uploadError, setUploadError] = useState<string[] | null>(null);
  // Whether the current uploadError is due to wrong template (vs duplicate codes)
  const [uploadErrorIsTemplate, setUploadErrorIsTemplate] = useState(false);

  // Invoice codes for cross-check: SOW projects not yet in invoicing
  const invoiceCodeSet = useMemo(
    () => new Set(
      sharedInvoiceProjects
        .map((project) => {
          const normalizedCode = String(project?.code || '').trim();
          if (normalizedCode) return normalizedCode;
          const derivedCode = deriveProjectCode(project?.project);
          if (!derivedCode) {
            console.error('[ProjectList] Encountered invoice project without code/project while building SOW cross-check.', project);
          }
          return derivedCode;
        })
        .filter(Boolean),
    ),
    [sharedInvoiceProjects],
  );
  const [sowBannerDismissed, setSowBannerDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(`eam_sow_banner_${currentUser?.username}`) === '1'; } catch { return false; }
  });

  // Detail drawer state
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [selectedDetailRow, setSelectedDetailRow] = useState<Row | null>(null);
  const [detailDrawerExpanded, setDetailDrawerExpanded] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFieldFilter, setAuditFieldFilter] = useState<string | null>(null);
  const [auditByFilter, setAuditByFilter] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(12);

  const [bookingPanelRow, setBookingPanelRow] = useState<Row | null>(null);

  const openBookingPanel = (r: Row) => {
    setBookingPanelRow(r);
  };

  function mapFinanceProjectsToRows(projects: financeApi.FinanceProject[], months: string[]): Row[] {
    return projects.map((p, i) => {
      const normalizedProject = String(p?.project || '').trim();
      if (!normalizedProject) {
        console.error('[ProjectList] Finance project row is missing a project name. Falling back to generated label.', p);
      }
      const safeProject = normalizedProject || `Untitled Project ${i + 1}`;
      return ({
      key: safeProject || String(i),
      id: p.id,
      sno: i + 1,
      project: safeProject,
      company: p.company || '',
      code: p.code || deriveProjectCode(safeProject),
      space: p.space || '',
      owner: p.owner || '',
      status: (p.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
      revenue: months.map((m) => p.revenue?.[m] || 0),
      milestoneTypes: (p.milestoneTypes || {}) as Record<string, 'booked' | 'anticipated'>,
      comments: p.comments || '',
    });
    });
  }

  useEffect(() => {
    if (!sharedFinanceLoaded || dirty) return;
    const mapped = mapFinanceProjectsToRows(sharedFinanceProjects, sharedFinanceMonths);
    setRows(mapped);
    setMonthHeaders(sharedFinanceMonths);
    onDataChange?.(mapped);
    onMonthsChange?.(sharedFinanceMonths);
    setFromServer(sharedFinanceFromServer);
    setPendingDeletedProjectIds([]);
  }, [dirty, onDataChange, onMonthsChange, sharedFinanceFromServer, sharedFinanceLoaded, sharedFinanceMonths, sharedFinanceProjects]);

  // Load from API on mount
  useEffect(() => {
    if (sharedFinanceLoaded) {
      setLoading(false);
      return;
    }
    setLoading(true);
    financeApi.getProjects().then(({ projects, months, fromServer: online }) => {
      dispatch(setFinanceData({ projects, months, fromServer: online }));
      if (online && projects.length) {
        const mapped = mapFinanceProjectsToRows(projects, months);
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
      }
    }).finally(() => setLoading(false));
  }, [dispatch, onDataChange, onMonthsChange, sharedFinanceLoaded]);

  // Load invoice codes silently for SOW cross-check
  useEffect(() => {
    if (sharedInvoiceLoaded) return;
    invoiceApi.getInvoiceProjects().then(({ projects, months, fromServer }) => {
      dispatch(setInvoiceData({ projects, months, fromServer }));
    }).catch(() => { /* best-effort */ });
  }, [dispatch, sharedInvoiceLoaded]);

  /** Reload rows from server — call after any bulk save to get DB-assigned IDs */
  const reloadFromServer = async () => {
    try {
      const { projects, months, fromServer: online } = await financeApi.getProjects();
      dispatch(setFinanceData({ projects, months, fromServer: online }));
      if (online && projects.length) {
        const mapped = mapFinanceProjectsToRows(projects, months);
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
        setPendingDeletedProjectIds([]);
      }
    } catch { /* ignore — current state remains */ }
  };

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isFilterApplied = !!(filters.project || filters.company || filters.space || filters.owner || filters.fy || filters.status);

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

  const handleFieldChange = (key: string, field: 'project' | 'code' | 'space' | 'owner' | 'comments', value: string) => {
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

  const deriveCode = deriveProjectCode;

  /** Returns all 12 month labels for a given fiscal year (Oct–Sep) */
  const getFYMonths = (fyYear: number): string[] => {
    const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    return MONTHS.map((m, i) => {
      const yr = i < 3 ? (fyYear - 1) % 100 : fyYear % 100;
      return `${m}'${String(yr).padStart(2, '0')}`;
    });
  };

  /** Candidate FYs for generation: all missing FYs up to (maxExistingFY + 5), always scalable */
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

    // Insert new months in chronological order relative to existing
    const allMonths = [...monthHeaders];
    newMonths.forEach(nm => {
      // find insertion index by matching the FY month order
      const fyAll = fyMonths;
      const nmIdx = fyAll.indexOf(nm);
      // insert after last month that precedes nm in fy order
      let insertAt = allMonths.length;
      for (let i = allMonths.length - 1; i >= 0; i--) {
        const existingFyIdx = fyAll.indexOf(allMonths[i]);
        if (existingFyIdx !== -1 && existingFyIdx < nmIdx) { insertAt = i + 1; break; }
        // also try to position after any months from previous FYs
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

  /**
   * Checks for duplicate codes in the given row set.
   * Returns an array of conflict descriptions, or empty if no conflicts.
   */
  const findDuplicateCodes = (targetRows: Row[]): string[] => {
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

  const openEdit = (r: Row) => {
    setEditingRow(r);
    editForm.setFieldsValue({ project: r.project, company: r.company, space: r.space, owner: r.owner, status: r.status });
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    const values = await editForm.validateFields();
    if (!editingRow) return;
    const newProject = values.project.trim();
    const newCode = deriveCode(newProject);

    // Check if new code conflicts with any other existing row
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
      // Row has a DB id — update directly; then reload to sync state
      const ok = await financeApi.updateProject(editingRow.id, {
        project: newProject, code: newCode, company: values.company?.trim() || '', space: values.space.trim(), owner: values.owner.trim(), status: values.status,
        changedBy: currentUser?.username,
      } as any);
      if (ok) {
        message.success('Row updated');
        await reloadFromServer();
        return;
      }
    }

    // No id or server failed — update local state only, mark dirty for manual save
    const updated = rows.map(r =>
      r.key === editingRow.key
        ? { ...r, project: newProject, code: newCode, key: newProject, company: values.company?.trim() || '', space: values.space.trim(), owner: values.owner.trim(), status: values.status as 'Active' | 'Inactive' }
        : r
    );
    setRows(updated);
    onDataChange?.(updated);
    setDirty(true);
    message.success('Row updated (save to sync with database)');
  };

  const handleToggleActive = async (r: Row) => {
    const newStatus: 'Active' | 'Inactive' = r.status === 'Active' ? 'Inactive' : 'Active';

    if (r.id) {
      // Optimistic UI update — only change status, leave all other fields untouched
      setRows(prev => prev.map(x => x.key === r.key ? { ...x, status: newStatus } : x));

      // Direct server update — only sends status, never touches project/code/space/owner
      const ok = await financeApi.updateProject(r.id, { status: newStatus, changedBy: currentUser?.username } as any);
      if (ok) {
        // Reload from server to confirm DB state (guards against any race conditions)
        await reloadFromServer();
        message.success(`Project marked as ${newStatus}`);
      } else {
        // Revert optimistic update and mark dirty for manual save
        setRows(prev => prev.map(x => x.key === r.key ? { ...x, status: r.status } : x));
        setDirty(true);
        message.warning(`Server offline — change will be saved when you click Save Changes`);
      }
    } else {
      // Row has no DB id yet — update local state + mark dirty
      setRows(prev => prev.map(x => x.key === r.key ? { ...x, status: newStatus } : x));
      setDirty(true);
      message.success(`Project marked as ${newStatus} (save to sync with database)`);
    }
  };

  const handleAddProject = async () => {
    const values = await addForm.validateFields();
    const newProject = values.project.trim();
    const code = deriveCode(newProject);

    // Check name duplicate
    if (rows.some(r => r.project.toLowerCase() === newProject.toLowerCase())) {
      message.warning('A project with this name already exists');
      return;
    }
    // Check code duplicate
    const codeConflicts = rows
      .filter(r => deriveCode(r.project) === code)
      .map(r => `"${r.project}" already uses code "${code}"`);
    if (codeConflicts.length) {
      showDuplicateCodeError(codeConflicts);
      return;
    }
    const newRow: Row = {
      key: newProject,
      sno: rows.length + 1,
      project: newProject,
      company: values.company?.trim() || '',
      code,
      space: values.space?.trim() || '',
      owner: values.owner?.trim() || '',
      status: 'Active',
      revenue: monthHeaders.map(() => 0),
      milestoneTypes: {},
      comments: '',
    };
    const updated = [...rows, newRow];
    setRows(updated);
    onDataChange?.(updated);
    setAddModalOpen(false);
    addForm.resetFields();
    // Save to server immediately; store returned id back into row
    const result = await financeApi.createProject({
      project: newRow.project,
      company: newRow.company,
      code: newRow.code,
      space: newRow.space,
      owner: newRow.owner,
      status: 'Active',
      revenue: Object.fromEntries(monthHeaders.map((m, i) => [m, 0])),
      monthHeaders,
    }, currentUser?.username);
    if (result.ok && result.id) {
      // Store the server-assigned id so future updates/saves use it
      setRows(prev => prev.map(r => r.key === newRow.key ? { ...r, id: result.id } : r));
      message.success('Project added and saved to database');
    } else {
      setDirty(true); // offline — needs manual save
      message.success('Project added (save to sync with database)');
    }
  };

  const handleDeleteRow = (r: Row) => {
    const filtered = rows.filter(x => x.key !== r.key);
    const updated = filtered.map((x, i) => ({ ...x, sno: i + 1 }));
    setRows(updated);
    onDataChange?.(updated);
    setDirty(true);
    if (r.id) {
      setPendingDeletedProjectIds(prev => (prev.includes(r.id!) ? prev : [...prev, r.id!]));
      message.success('Row deleted (click Save Changes to persist)');
      return;
    }
    message.success('Row deleted');
  };

  const handleUpload = async (file: File) => {
    setUploadError(null);
    setUploadErrorIsTemplate(false);
    try {
      const buffer = await file.arrayBuffer();
      // Convert ArrayBuffer → Uint8Array (xlsx-js-style 'array' type expects Uint8Array, not ArrayBuffer)
      const uint8 = new Uint8Array(buffer);
      const wb = XLSXStyle.read(uint8, { type: 'array', cellStyles: true }) as any;
      const ws = wb.Sheets[wb.SheetNames[0]] as any;
      if (!ws) { message.error('No sheet found'); return false; }
      const json = XLSXStyle.utils.sheet_to_json<ExcelRow>(ws, { defval: '' }) as ExcelRow[];
      if (!json.length) { message.error('Sheet is empty'); return false; }
      const headers = Object.keys(json[0]);

      // ── Template validation ────────────────────────────────────────────
      const requiredHeaders = ['Project', 'Company', 'Space', 'Owners'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        setUploadError([
          `Missing required columns: ${missingHeaders.join(', ')}`,
          'Please download the correct template and re-upload the file.',
        ]);
        setUploadErrorIsTemplate(true);
        return false;
      }
      // ── End template validation ────────────────────────────────────────

      const fixedCols = ['S.No.', 'Project', 'Company', 'Code', 'Space', 'Owners'];
      const monthCols = headers.filter(h => !fixedCols.includes(h));

      // json rows that have a Project value (filter blanks/sample rows)
      const dataRows = json.filter(r => String(r.Project || '').trim());

      // Decode sheet range to get start offsets (sheet may not start at A1)
      const sheetRange = XLSXStyle.utils.decode_range(ws['!ref'] || 'A1') as any;
      const colOffset: number = sheetRange.s.c;
      const rowOffset: number = sheetRange.s.r;

      const uploaded: Row[] = dataRows.map((r, i) => {
        const sheetRowIdx = rowOffset + json.indexOf(r) + 1;
        const milestoneTypes: Record<string, 'booked' | 'anticipated'> = {};
        monthCols.forEach(m => {
          const colIdx = colOffset + headers.indexOf(m);
          const addr = XLSXStyle.utils.encode_cell({ r: sheetRowIdx, c: colIdx }) as string;
          const cell = ws[addr] as any;
          const rgb = cell?.s?.fgColor?.rgb as string | undefined;
          milestoneTypes[m] = isAnticipatedColor(rgb) ? 'anticipated' : 'booked';
        });
        return {
          key: String(r.Project || i),
          sno: i + 1,
          project: String(r.Project || ''),
          company: String(r.Company || ''),
          code: deriveCode(String(r.Project || '')),
          space: String(r.Space || ''),
          owner: String(r.Owners || ''),
          status: 'Active' as const,
          revenue: monthCols.map(m => parseINR(r[m])),
          milestoneTypes,
          comments: '',
        };
      });

      // ── Duplicate-code validation (block upload if any conflicts) ──────
      const errors: string[] = [];

      // 1. Duplicates within the uploaded file itself
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

      // 2. Uploaded codes conflict with existing DB rows (different project, same code)
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
        return false; // abort — do NOT touch state or DB
      }
      // ── End validation ────────────────────────────────────────────────

      // Merge: uploaded rows upsert into existing rows by project name (case-insensitive)
      // New month columns are unioned with existing ones
      const allMonths = [...new Set([...monthHeaders, ...monthCols])];

      // Compute merged rows synchronously using closure `rows` (safe — no user interaction since await above)
      const existingMap = new Map(rows.map(r => [r.project.toLowerCase(), r]));

      uploaded.forEach(u => {
        const key = u.project.toLowerCase();
        if (existingMap.has(key)) {
          // Overwrite matching project — preserve id/active from existing, merge revenue
          const ex = existingMap.get(key)!;
          const mergedRevenue = allMonths.map(m => {
            const uploadedIdx = monthCols.indexOf(m);
            const existingIdx = monthHeaders.indexOf(m);
            if (uploadedIdx !== -1) return u.revenue[uploadedIdx] ?? 0;
            if (existingIdx !== -1) return ex.revenue[existingIdx] ?? 0;
            return 0;
          });
          existingMap.set(key, { ...ex, company: u.company, space: u.space, owner: u.owner, revenue: mergedRevenue, milestoneTypes: u.milestoneTypes });
        } else {
          // Append new project — pad revenue to allMonths
          const mergedRevenue = allMonths.map(m => {
            const uploadedIdx = monthCols.indexOf(m);
            return uploadedIdx !== -1 ? (u.revenue[uploadedIdx] ?? 0) : 0;
          });
          existingMap.set(key, { ...u, revenue: mergedRevenue });
        }
      });

      // Re-pad existing projects that lack new month columns
      const merged: Row[] = Array.from(existingMap.values()).map(r => ({
        ...r,
        status: r.status || 'Active',  // preserve existing status (never overwrite with upload)
        revenue: allMonths.map((m, i) => {
          const oldIdx = monthHeaders.indexOf(m);
          return r.revenue[i] !== undefined ? r.revenue[i] : (oldIdx !== -1 ? (r.revenue[oldIdx] ?? 0) : 0);
        }),
      }));

      // Update state — clean, no side effects inside updater
      setRows(merged);
      setMonthHeaders(allMonths);
      onDataChange?.(merged);
      onMonthsChange?.(allMonths);
      setDirty(true);

      const newCount = uploaded.filter(u => !rows.some(r => r.project.toLowerCase() === u.project.toLowerCase())).length;
      const updCount = uploaded.length - newCount;
      // Count anticipated cells for debug feedback
      const anticCount = uploaded.reduce((sum, u) => sum + Object.values(u.milestoneTypes).filter(v => v === 'anticipated').length, 0);
      message.success(`Upload parsed: ${newCount} new, ${updCount} updated. ${anticCount} anticipated cell(s) detected. Click "Save Changes" to persist.`);

    } catch (e: any) {
      message.error(e.message || 'Failed to read Excel');
    }
    return false;
  };

  // ── Bulk upload for ALL selected projects (Project Code column routes rows) ──
  const handleBulkAllProjectsUpload = async (file: File, selectedRows: Row[]) => {
    setBulkAllUploadErrors(null);
    try {
      const uint8 = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(uint8, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setBulkAllUploadErrors(['No sheet found in the uploaded file.']); return false; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!json.length) { setBulkAllUploadErrors(['The uploaded sheet is empty.']); return false; }
      const missing = findMissingHeaders(Object.keys(json[0]), BULK_BOOKING_UPLOAD_REQUIRED_HEADERS);
      if (missing.length) { setBulkAllUploadErrors([`Missing required columns: ${missing.join(', ')}`, 'Please use the Bulk Booking Template.']); return false; }

      // Pre-fetch all existing bookings to know available capacity per project
      const bookingsByProject: Record<string, financeApi.ProjectBooking[]> = {};
      await Promise.all(selectedRows.filter(r => r.id).map(async r => {
        bookingsByProject[r.code || r.key] = await financeApi.getBookings(r.id!);
      }));

      const errors: string[] = [];
      const { groupedByProject, errors: validationErrors, totalEntries } = validateAndGroupBulkBookings(
        json,
        selectedRows.map(r => ({
          id: r.id,
          key: String(r.key),
          code: r.code || String(r.key),
          revenue: r.revenue,
          milestoneTypes: r.milestoneTypes,
        })),
        bookingsByProject,
        monthHeaders,
      );
      errors.push(...validationErrors);

      // Stop and show all errors before writing anything
      if (errors.length) { setBulkAllUploadErrors(errors); return false; }

      if (!totalEntries) { setBulkAllUploadErrors(['No valid rows found to import.']); return false; }

      // Save atomically per project using batch endpoint
      setBulkAllSaving(true);
      const projectCodes = Object.keys(groupedByProject);
      const results = await Promise.all(
        projectCodes.map(code => {
          const grouped = groupedByProject[code];
          return financeApi.addBookingsBatch(grouped.projectId, grouped.entries.map(v => ({
            milestone_month: v.milestone_month, booking_month: v.booking_month,
            amount: v.amount, notes: v.notes, booking_type: v.booking_type,
            created_by: currentUser?.username || 'system',
          })));
        })
      );
      setBulkAllSaving(false);

      const failed = results.filter(r => !r.ok);
      if (failed.length === 0) {
        message.success(`${totalEntries} booking entr${totalEntries === 1 ? 'y' : 'ies'} across ${projectCodes.length} project${projectCodes.length !== 1 ? 's' : ''} imported.`);
        setBulkRefreshToken(t => t + 1);
      } else {
        const failedErrors = failed.map(r => `Server error: ${r.error || 'Unknown error'}`);
        setBulkAllUploadErrors([`${failed.length} project(s) failed to save (atomic rollback applied):`, ...failedErrors]);
        // Still refresh successfully saved projects
        setBulkRefreshToken(t => t + 1);
      }
    } catch (e: any) {
      setBulkAllUploadErrors([`Failed to read file: ${e.message || 'Unknown error'}`, 'Please ensure the file is a valid .xlsx file.']);
    }
    return false;
  };

  const filteredMonthHeaders = useMemo(() => {
    if (!filters.fy) return monthHeaders;
    const start = parseInt(filters.fy);
    return monthHeaders.slice(start, start + 12);
  }, [monthHeaders, filters.fy]);

  // SOW projects not yet present in invoicing (for cross-check banner + column icon)
  const sowNotInInvoice = useMemo(() =>
    invoiceCodeSet.size > 0 ? rows.filter(r => !invoiceCodeSet.has(r.code)) : [],
    [rows, invoiceCodeSet]
  );

  /** Format a revenue value per current currency setting */
  const fmtRev = (n: number) => {
    if (currency === 'USD') return `$ ${(n * exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  /** Toggle booked ↔ anticipated for a specific (project row, month) cell */
  const handleTypeToggle = async (key: string, month: string, rowId?: number) => {
    const row = rows.find(r => r.key === key);
    if (!row) return;
    const current = row.milestoneTypes[month] || 'booked';
    const newType: 'booked' | 'anticipated' = current === 'booked' ? 'anticipated' : 'booked';
    setRows(prev => prev.map(r => r.key === key ? { ...r, milestoneTypes: { ...r.milestoneTypes, [month]: newType } } : r));
    if (rowId) {
      await financeApi.updateMilestoneTypes(rowId, { [month]: newType });
    } else {
      setDirty(true);
    }
  };

  /** Auto-save comments on blur if the row has a DB id */
  const handleCommentBlur = async (key: string) => {
    const row = rows.find(r => r.key === key);
    if (!row?.id) return;
    await financeApi.updateProject(row.id, { comments: row.comments, changedBy: currentUser?.username } as any);
  };

  /** Load audit log for a given record id */
  const loadAuditLog = async (id: number) => {
    setAuditLoading(true);
    const entries = await auditApi.getAuditLog('finance', id);
    setAuditLog(entries);
    setAuditLoading(false);
  };

  /** Open detail side panel for a row */
  const openDetailDrawer = (r: Row) => {
    setSelectedDetailRow(r);
    setNewComment('');
    setAuditLog([]);
    setAuditSearch('');
    setAuditFieldFilter(null);
    setAuditByFilter(null);
    setDetailDrawer(true);
    if (r.id) loadAuditLog(r.id);
  };

  /** Append a new prefixed comment entry and save */
  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedDetailRow) return;
    const username = currentUser?.username || 'Unknown';
    const dateStr = formatCommentDate(new Date());
    const entry = `${username} : ${dateStr} : ${newComment.trim()}`;
    const existing = selectedDetailRow.comments || '';
    const updated = existing ? `${existing}\n${entry}` : entry;

    // Update local state
    setRows(prev => prev.map(r => r.key === selectedDetailRow.key ? { ...r, comments: updated } : r));
    setSelectedDetailRow(prev => prev ? { ...prev, comments: updated } : prev);
    setNewComment('');

    // Save to DB
    if (selectedDetailRow.id) {
      await financeApi.updateProject(selectedDetailRow.id, { comments: updated, changedBy: username } as any);
      await loadAuditLog(selectedDetailRow.id);
    }
    message.success('Comment added');
  };

  const columns: ColumnsType<Row> = useMemo(() => {
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

    const base: ColumnType<Row>[] = [
      { title: 'S.No.', key: 'sno', width: 42, fixed: 'left' as const, render: (_: unknown, __: Row, index: number) => ((tablePage - 1) * tablePageSize) + index + 1, onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }) },
      {
        title: 'Project', dataIndex: 'project', key: 'project', width: 200, fixed: 'left' as const,
        sorter: (a: Row, b: Row) => (a.project || '').localeCompare(b.project || ''),
        render: (v: string, r: Row) => {
          const notInInvoice = invoiceCodeSet.size > 0 && !invoiceCodeSet.has(r.code);
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tooltip title={v} overlayInnerStyle={{ fontSize: '11px' }}>
                <Input
                  value={v}
                  onChange={e => handleFieldChange(r.key, 'project', e.target.value)}
                  style={{ border: 'none', background: 'transparent', fontSize: '11px', fontWeight: 500 }}
                />
              </Tooltip>
              {notInInvoice && (
                <Tooltip title={`Code "${r.code}" has no matching entry in Invoicing. Consider adding it.`} overlayInnerStyle={{ fontSize: '11px' }}>
                  <ExclamationCircleOutlined style={{ color: '#fa8c16', fontSize: 11, flexShrink: 0, cursor: 'help' }} />
                </Tooltip>
              )}
            </div>
          );
        },
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Company', dataIndex: 'company', key: 'company', width: 110,
        sorter: (a: Row, b: Row) => (a.company || '').localeCompare(b.company || ''),
        render: (v: string, r: Row) => companyOptions.length > 0 ? (
          <Select
            value={v || undefined}
            onChange={val => handleFieldChange(r.key, 'company', val ?? '')}
            options={companyOptions}
            showSearch allowClear size="small"
            placeholder="Select…"
            style={{ width: '100%', fontSize: '11px' }}
            variant="borderless"
            popupMatchSelectWidth={false}
          />
        ) : (
          <Input value={v} onChange={e => handleFieldChange(r.key, 'company', e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Code', dataIndex: 'code', key: 'code', width: 90,
        sorter: (a: Row, b: Row) => deriveCode(a.project).localeCompare(deriveCode(b.project)),
        render: (_: string, r: Row) => (
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#595959' }}>{deriveCode(r.project)}</span>
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Space', dataIndex: 'space', key: 'space', width: 100,
        sorter: (a: Row, b: Row) => (a.space || '').localeCompare(b.space || ''),
        render: (v: string, r: Row) => spaceOptions.length > 0 ? (
          <Select
            value={v || undefined}
            onChange={val => handleFieldChange(r.key, 'space', val ?? '')}
            options={spaceOptions}
            showSearch allowClear size="small"
            placeholder="Select…"
            style={{ width: '100%', fontSize: '11px' }}
            variant="borderless"
            popupMatchSelectWidth={false}
          />
        ) : (
          <Input value={v} onChange={e => handleFieldChange(r.key, 'space', e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Owner', dataIndex: 'owner', key: 'owner', width: 100,
        sorter: (a: Row, b: Row) => (a.owner || '').localeCompare(b.owner || ''),
        render: (v: string, r: Row) => ownerOptions.length > 0 ? (
          <Select
            value={v || undefined}
            onChange={val => handleFieldChange(r.key, 'owner', val ?? '')}
            options={ownerOptions}
            showSearch allowClear size="small"
            placeholder="Select…"
            style={{ width: '100%', fontSize: '11px' }}
            variant="borderless"
            popupMatchSelectWidth={false}
          />
        ) : (
          <Input value={v} onChange={e => handleFieldChange(r.key, 'owner', e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Status', dataIndex: 'status', key: 'status', width: 70,
        sorter: (a: Row, b: Row) => (a.status || '').localeCompare(b.status || ''),
        render: (status: string) => (
          <Tag color={status === 'Active' ? 'success' : 'default'} style={{ fontSize: '10px', padding: '0 4px' }}>
            {status || 'Active'}
          </Tag>
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Comments', dataIndex: 'comments', key: 'comments', width: 180,
        render: (v: string, r: Row) => (
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
        title: '', key: 'actions', width: 100, fixed: 'right' as const,
        render: (_: any, r: Row) => (
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
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  {
                    key: 'bookings',
                    icon: <CalendarOutlined style={{ color: '#52c41a' }} />,
                    label: <span style={{ fontSize: '12px' }}>Manage Bookings</span>,
                    onClick: () => openBookingPanel(r),
                  },
                  ...(canDelete ? [{
                    key: 'delete',
                    danger: true,
                    icon: <DeleteOutlined />,
                    label: <span style={{ fontSize: '12px' }}>Delete</span>,
                    onClick: () => handleDeleteRow(r),
                  }] : []),
                ],
              }}
            >
              <Tooltip title="More actions" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button type="text" size="small" icon={<EllipsisOutlined />} style={{ color: '#595959' }} />
              </Tooltip>
            </Dropdown>
          </Space>
        ),
        onHeaderCell: () => ({ style: hs }),
      },
    ];

    const monthCols: ColumnType<Row>[] = filteredMonthHeaders.map((m, di) => {
      const ai = filters.fy ? parseInt(filters.fy) + di : di;
      return {
        title: m, key: m, align: 'left' as const, width: 100,
        render: (_: any, r: Row) => {
          const isAnticipated = (r.milestoneTypes[m] || 'booked') === 'anticipated';
          const value = r.revenue[ai] || 0;
          return (
            <div style={{ position: 'relative', paddingRight: 14 }}>
              {currency === 'USD' ? (
                <span style={{ fontSize: '11px', color: isAnticipated ? '#ff4d4f' : '#595959' }}>{fmtRev(value)}</span>
              ) : (
                <span style={{ color: isAnticipated ? '#ff4d4f' : '#262626' }}>
                  <InputNumber
                    value={value}
                    onChange={canEdit ? (v => handleRevChange(r.key, ai, String(v ?? 0))) : undefined}
                    formatter={v => `₹ ${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                    parser={v => Number(String(v ?? '').replace(/₹\s?|,/g, '')) as 0}
                    controls={false}
                    bordered={false}
                    readOnly={!canEdit}
                    style={{ width: '100%', textAlign: 'left', fontSize: '11px', color: 'inherit', cursor: canEdit ? 'text' : 'default' }}
                  />
                </span>
              )}
              <Tooltip
                title={isAnticipated ? 'Anticipated — click to mark as Booked' : 'Booked — click to mark as Anticipated'}
                overlayInnerStyle={{ fontSize: '10px' }}
              >
                <span
                  onClick={canEdit ? () => handleTypeToggle(r.key, m, r.id) : undefined}
                  style={{
                    position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
                    fontSize: '9px', lineHeight: 1, cursor: canEdit ? 'pointer' : 'default',
                    color: isAnticipated ? '#ff4d4f' : '#bfbfbf',
                    fontWeight: 700, userSelect: 'none',
                  }}
                >
                  {isAnticipated ? 'A' : 'B'}
                </span>
              </Tooltip>
            </div>
          );
        },
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: { ...cs, padding: '2px 4px' } }),
      };
    });

    const totalCol: ColumnType<Row> = {
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
      if (col.key === 'actions') return true;   // always show actions
      if (col.key === 'status') return true;    // always show status
      if (col.key === 'comments') return visibleColumns.has('comments');
      if (monthCols.find(c => c.key === col.key)) return true;
      return visibleColumns.has(col.key as string);
    });
  }, [filteredMonthHeaders, rows, filters, visibleColumns, openEdit, handleDeleteRow, handleToggleActive, handleTypeToggle, handleCommentBlur, openDetailDrawer, openBookingPanel, currency, exchangeRate, fmtRev, invoiceCodeSet, tablePage, tablePageSize]);

  const displayRows = useMemo(() => rows.filter(r => {
    if (filters.project && !r.project.toLowerCase().includes(filters.project.toLowerCase())) return false;
    if (filters.company && !r.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
    if (filters.space && !r.space.toLowerCase().includes(filters.space.toLowerCase())) return false;
    if (filters.owner && !r.owner.toLowerCase().includes(filters.owner.toLowerCase())) return false;
    if (filters.status === 'active' && r.status !== 'Active') return false;
    if (filters.status === 'inactive' && r.status !== 'Inactive') return false;
    return true;
  }), [rows, filters]);

  const handleSave = async () => {
    if (!dirty || (!rows.length && !pendingDeletedProjectIds.length)) return;

    // Check for duplicate codes across ALL rows before saving
    const conflicts = findDuplicateCodes(rows);
    if (conflicts.length) {
      showDuplicateCodeError(conflicts);
      return;
    }

    setSaving(true);
    try {
      if (pendingDeletedProjectIds.length) {
        const deleteResults = await Promise.all(
          pendingDeletedProjectIds.map(id => financeApi.deleteProject(id, currentUser?.username))
        );
        const failedDeleteIds = pendingDeletedProjectIds.filter((_, idx) => !deleteResults[idx]);
        if (failedDeleteIds.length) {
          message.error(`Failed to delete ${failedDeleteIds.length} project(s). Please retry Save Changes.`);
          return;
        }
      }

      if (!rows.length) {
        setDirty(false);
        setPendingDeletedProjectIds([]);
        message.success('All changes saved to database');
        return;
      }

      const apiProjects = rows.map(r => ({
        id: r.id,                           // send id so server matches by id, not name
        project: r.project,
        company: r.company || '',
        code: deriveCode(r.project),
        space: r.space,
        owner: r.owner,
        status: r.status || 'Active',
        revenue: Object.fromEntries(monthHeaders.map((m, i) => [m, r.revenue[i] || 0])),
        milestoneTypes: r.milestoneTypes || {},
        comments: r.comments || '',
      }));
      const saveResult = await financeApi.bulkSave(apiProjects, monthHeaders, currentUser?.username);
      if (saveResult.ok) {
        setDirty(false);
        setPendingDeletedProjectIds([]);
        setFromServer(true);
        message.success('All changes saved to database');
        // Reload from server to get DB-assigned IDs — ensures renames and new rows have correct ids for future saves
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
    await financeApi.clearAll(currentUser?.username);
    setRows([]);
    setMonthHeaders([]);
    setDirty(false);
    setPendingDeletedProjectIds([]);
    setFromServer(false);
    onDataChange?.([]);
    onMonthsChange?.([]);
    message.success('All data cleared');
  };

  const handleExport = () => {
    if (!rows.length) { message.warning('No data to export'); return; }

    const fixedHeaders = ['S.No.', 'Project', 'Company', 'Space', 'Owners', 'Status'];
    const allHeaders = [...fixedHeaders, ...monthHeaders, 'Total'];

    // Build array-of-arrays (AOA) so we control every cell
    const aoa: any[][] = [allHeaders];
    displayRows.forEach((r, i) => {
      const total = r.revenue.reduce((a, b) => a + b, 0);
      const rowData: any[] = [i + 1, r.project, r.company, r.space, r.owner, r.status,
        ...monthHeaders.map((_, mi) => r.revenue[mi] || 0), total];
      aoa.push(rowData);
    });

    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);

    // Column widths
    ws['!cols'] = allHeaders.map((_, i) => {
      if (i === 0) return { wch: 6 };
      if (i === 1) return { wch: 36 };
      if (i <= 5) return { wch: 18 };
      return { wch: 14 };
    });

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };

    // Hide gridlines
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
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Revenue Data');
    XLSXStyle.writeFile(wb, `Revenue_Export_${getCurrentDateStamp()}.xlsx`);
    message.success('Export downloaded');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Text type="secondary" style={{ fontSize: '11px', color: '#8c8c8c' }}>Revenue across projects and fiscal years</Text>
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
          {/* FY selector moved to right */}
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
            <Button size="small" type="link" style={{ fontSize: '11px', color: '#ff4d4f' }} onClick={() => setFilters({ project: '', company: '', space: '', owner: '', fy: null, status: null })}>✕ Clear</Button>
          )}
          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} />
          </Tooltip>
          <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} />
          </Tooltip>
          <Tooltip title="Upload Excel" overlayInnerStyle={{ fontSize: '11px' }}>
            <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false} disabled={!canEdit}>
              <Button icon={<UploadOutlined />} size="small" disabled={!canEdit} />
            </Upload>
          </Tooltip>
          <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate} />
          </Tooltip>
          <Tooltip title="Export Data (formatted Excel)" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<FileExcelOutlined />} size="small" onClick={handleExport} disabled={!rows.length} />
          </Tooltip>
          {/* More Actions — only shown when user has edit or delete rights */}
          {(canEdit || canDelete) && (
          <Tooltip title="More Actions" overlayInnerStyle={{ fontSize: '11px' }}>
            <Badge count={selectedRowKeys.length} size="small" offset={[-4, 4]} style={{ backgroundColor: '#1890ff' }}>
              <Button icon={<EllipsisOutlined />} size="small" onClick={() => setMoreActionsOpen(true)} />
            </Badge>
          </Tooltip>
          )}
        </Space>
      </div>

      {uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => { setUploadError(null); setUploadErrorIsTemplate(false); }}
          message={
            <span style={{ fontSize: '12px', fontWeight: 600 }}>
              {uploadErrorIsTemplate
                ? 'Upload blocked — incorrect file template'
                : 'Upload blocked — duplicate project codes detected'}
            </span>
          }
          description={
            <div>
              <ul style={{ margin: '4px 0 4px 0', paddingLeft: 16 }}>
                {uploadError.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}
              </ul>
              {uploadErrorIsTemplate && (
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

      {sowNotInInvoice.length > 0 && rows.length > 0 && !sowBannerDismissed && (
        <Alert
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          closable
          onClose={() => {
            setSowBannerDismissed(true);
            try { sessionStorage.setItem(`eam_sow_banner_${currentUser?.username}`, '1'); } catch { /* ignore */ }
          }}
          message={
            <span style={{ fontSize: '12px', fontWeight: 600 }}>
              {sowNotInInvoice.length} SOW project{sowNotInInvoice.length > 1 ? 's' : ''} not found in Invoicing
            </span>
          }
          description={
            <div>
              <div style={{ fontSize: '11px', color: '#595959', marginBottom: 4 }}>
                These SOW projects have no matching invoice entry — consider adding them to the Invoicing tab:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {sowNotInInvoice.map(r => (
                  <Tooltip key={r.code} title={r.project} overlayInnerStyle={{ fontSize: '11px' }}>
                    <Tag color="orange" style={{ fontSize: '10px', cursor: 'default' }}>{r.code}</Tag>
                  </Tooltip>
                ))}
              </div>
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
              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({ project: '', company: '', space: '', owner: '', fy: null, status: null })}>Clear all</Button>
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
                { label: 'Space', key: 'space', opts: [...new Set(rows.map(r => r.space).filter(Boolean))].map(v => ({ label: v, value: v })) },
                { label: 'Owner', key: 'owner', opts: [...new Set(rows.map(r => r.owner).filter(Boolean))].map(v => ({ label: v, value: v })) },
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
              pagination={{
                current: tablePage,
                pageSize: tablePageSize,
                showSizeChanger: false,
                onChange: (page, pageSize) => {
                  setTablePage(page);
                  setTablePageSize(pageSize);
                },
              }}
              scroll={{ x: 'max-content' }}
              style={{ background: '#fff', borderRadius: 8 }}
              summary={() => {
                if (!displayRows.length) return null;
                const start = filters.fy ? parseInt(filters.fy) : 0;
                // Use ALL filtered rows (not just current page) for totals
                const allFiltered = rows.filter(r => {
                  if (filters.project && !r.project.toLowerCase().includes(filters.project.toLowerCase())) return false;
                  if (filters.company && !r.company.toLowerCase().includes(filters.company.toLowerCase())) return false;
                  if (filters.space && !r.space.toLowerCase().includes(filters.space.toLowerCase())) return false;
                  if (filters.owner && !r.owner.toLowerCase().includes(filters.owner.toLowerCase())) return false;
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
                // Build one cell per column, in exact column order
                // S.No + Project merged (colSpan 2) for the label
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
                        // Skip S.No cell — it's merged into the Project cell
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
                        // Other base columns — empty
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
          {['sno', 'project', 'company', 'code', 'space', 'owner', 'comments'].map(key => (
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
                  <Text style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 12 }}>Project Details</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
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
                      <Text type="secondary" style={{ fontSize: '11px' }}>Space</Text>
                      <div style={{ fontSize: '13px' }}>{selectedDetailRow.space || '—'}</div>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: '11px' }}>Owner</Text>
                      <div style={{ fontSize: '13px' }}>{selectedDetailRow.owner || '—'}</div>
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
                {/* Header + search/filter controls */}
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
            <Form.Item name="space" label={<span style={{ fontSize: '11px' }}>Space</span>}>
              {spaceOptions.length > 0 ? (
                <Select showSearch allowClear size="small" options={spaceOptions} placeholder="Select space…" style={{ fontSize: '12px' }} notFoundContent="No options — add in Configuration" />
              ) : (
                <Input style={{ fontSize: '12px' }} />
              )}
            </Form.Item>
            <Form.Item name="owner" label={<span style={{ fontSize: '11px' }}>Owner</span>}>
              {ownerOptions.length > 0 ? (
                <Select showSearch allowClear size="small" options={ownerOptions} placeholder="Select owner…" style={{ fontSize: '12px' }} notFoundContent="No options — add in Configuration" />
              ) : (
                <Input style={{ fontSize: '12px' }} />
              )}
            </Form.Item>
            <Form.Item name="status" label={<span style={{ fontSize: '11px' }}>Status</span>} initialValue="Active">
              <Select size="small" options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} style={{ fontSize: '11px' }} />
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
              mode={companyOptions.length ? undefined : undefined}
              notFoundContent={companyOptions.length ? 'No options — add in Configuration' : null}
            />
          </Form.Item>
          <Form.Item name="space" label={<span style={{ fontSize: '11px' }}>Space</span>}>
            <Select
              showSearch allowClear
              placeholder={spaceOptions.length ? 'Select or type…' : 'Type space name'}
              options={spaceOptions}
              style={{ fontSize: '12px' }}
              size="small"
              notFoundContent={spaceOptions.length ? 'No options — add in Configuration' : null}
            />
          </Form.Item>
          <Form.Item name="owner" label={<span style={{ fontSize: '11px' }}>Owner</span>}>
            <Select
              showSearch allowClear
              placeholder={ownerOptions.length ? 'Select account anchor…' : 'Type owner name'}
              options={ownerOptions}
              style={{ fontSize: '12px' }}
              size="small"
              notFoundContent={ownerOptions.length ? 'No options — add in Configuration → link to "Owner / Account Anchor dropdown"' : null}
            />
          </Form.Item>
          <Form.Item label={<span style={{ fontSize: '11px' }}>Code (auto-derived from project name)</span>}>
            <Input
              value={deriveCode(addForm.getFieldValue('project') || '')}
              disabled
              style={{ fontFamily: 'monospace', fontSize: '11px', background: '#f5f5f5' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* More Actions Modal */}
      <Modal
        title={<Space><EllipsisOutlined /><span style={{ fontSize: '13px' }}>More Actions</span></Space>}
        open={moreActionsOpen}
        onCancel={() => { setMoreActionsOpen(false); setBkProjectSearch(''); setBkProjectFyFilter(undefined); setSelectedRowKeys([]); }}
        footer={null}
        width={500}
        styles={{ body: { padding: '12px 16px' } }}
      >
        {(() => {
          // Compute FY list for booking project filter
          const fySet = new Set<number>();
          monthHeaders.forEach(m => { const info = getMonthFY(m); if (info) fySet.add(info.fy); });
          const fyOptions = Array.from(fySet).sort().map(fy => ({ value: `FY${fy}`, label: `FY${fy}` }));
          const fyFilteredRows = bkProjectFyFilter
            ? rows.filter(r => { const fyYear = parseInt(bkProjectFyFilter.replace('FY', '')); return monthHeaders.some(m => { const info = getMonthFY(m); return info && info.fy === fyYear && (r.revenue[monthHeaders.indexOf(m)] || 0) > 0; }); })
            : rows;
          const searchQ = bkProjectSearch.trim().toLowerCase();
          const filteredForSelect = searchQ ? fyFilteredRows.filter(r => [r.project, r.code, r.company].join(' ').toLowerCase().includes(searchQ)) : fyFilteredRows;
          const allKeys = filteredForSelect.map(r => r.key as string);
          const selectedInView = (selectedRowKeys as string[]).filter(k => allKeys.includes(k));
          const allChecked = allKeys.length > 0 && selectedInView.length === allKeys.length;
          const indeterminate = selectedInView.length > 0 && !allChecked;

          const collapseItems = [
            // ── Manage Bookings ──────────────────────────────────────
            ...(canEdit ? [{
              key: 'bookings',
              label: (
                <span style={{ fontSize: '12px', fontWeight: 600 }}>
                  <CalendarOutlined style={{ color: '#52c41a', marginRight: 6 }} />Manage Bookings
                  {selectedRowKeys.length > 0 && <Tag color="green" style={{ fontSize: '10px', marginLeft: 6 }}>{selectedRowKeys.length} selected</Tag>}
                </span>
              ),
              children: (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6, marginBottom: 6 }}>
                    <Select size="small" allowClear placeholder="Filter FY…" value={bkProjectFyFilter}
                      onChange={v => { setBkProjectFyFilter(v); setSelectedRowKeys([]); }}
                      options={fyOptions} style={{ fontSize: '11px' }} />
                    <Input size="small" allowClear placeholder="Search project / code…" value={bkProjectSearch}
                      onChange={e => setBkProjectSearch(e.target.value)}
                      prefix={<SearchOutlined style={{ fontSize: '10px', color: '#bbb' }} />} style={{ fontSize: '11px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 8px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4, marginBottom: 4 }}>
                    <Checkbox indeterminate={indeterminate} checked={allChecked}
                      onChange={e => { if (e.target.checked) setSelectedRowKeys(prev => [...new Set([...(prev as string[]), ...allKeys])]); else setSelectedRowKeys(prev => (prev as string[]).filter(k => !allKeys.includes(k))); }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 500 }}>{allChecked ? 'Deselect all' : `Select all (${filteredForSelect.length})`}</span>
                    </Checkbox>
                    {selectedRowKeys.length > 0 && <Button type="link" size="small" style={{ fontSize: '11px', padding: 0, color: '#595959' }} onClick={() => setSelectedRowKeys([])}>Clear</Button>}
                  </div>
                  <div style={{ maxHeight: 130, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, background: '#fff', marginBottom: 8 }}>
                    {filteredForSelect.length === 0
                      ? <div style={{ padding: '8px 12px', fontSize: '11px', color: '#bbb', textAlign: 'center' }}>No projects match</div>
                      : filteredForSelect.map(r => (
                        <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', cursor: 'pointer', background: selectedRowKeys.includes(r.key) ? '#f6ffed' : 'transparent', borderBottom: '1px solid #f5f5f5' }}
                          onClick={() => setSelectedRowKeys(prev => (prev as string[]).includes(r.key as string) ? (prev as string[]).filter(k => k !== r.key) : [...(prev as string[]), r.key as string])}>
                          <Checkbox checked={selectedRowKeys.includes(r.key)} onChange={() => {}} />
                          {r.code && <Tag style={{ fontSize: '10px', margin: 0, flexShrink: 0 }}>{r.code}</Tag>}
                          <span style={{ fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.project}</span>
                          {r.company && <span style={{ fontSize: '10px', color: '#8c8c8c', flexShrink: 0 }}>{r.company}</span>}
                        </div>
                      ))
                    }
                  </div>
                  <Button size="small" icon={<CalendarOutlined />} style={{ fontSize: '11px' }}
                    disabled={selectedRowKeys.length === 0}
                    type={selectedRowKeys.length > 0 ? 'primary' : 'default'}
                    onClick={() => { if (!selectedRowKeys.length) return; setBulkBookingOpen(true); setMoreActionsOpen(false); }}>
                    Open Booking Panel{selectedRowKeys.length > 0 ? ` (${selectedRowKeys.length})` : ''}
                  </Button>
                </div>
              ),
            }] : []),

            // ── Add New Project ──────────────────────────────────────
            ...(canEdit ? [{
              key: 'add',
              label: <span style={{ fontSize: '12px', fontWeight: 600 }}><PlusOutlined style={{ color: '#52c41a', marginRight: 6 }} />Add New Project</span>,
              children: (
                <div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>Add an empty project row. Revenue columns will be pre-filled with 0 for all existing months.</div>
                  <Button size="small" type="primary" icon={<PlusOutlined />} style={{ fontSize: '11px' }}
                    onClick={() => { setMoreActionsOpen(false); setAddModalOpen(true); }}>Add Project</Button>
                </div>
              ),
            }] : []),

            // ── Generate FY ──────────────────────────────────────────
            ...(canEdit ? [{
              key: 'fy',
              label: <span style={{ fontSize: '12px', fontWeight: 600 }}><CalendarOutlined style={{ color: '#1890ff', marginRight: 6 }} />Generate Month Columns</span>,
              children: (
                <div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>Add all 12 empty month columns for a fiscal year (Oct–Sep). Only missing months are added.</div>
                  <Space size={8}>
                    <Select placeholder="Select FY…" size="small" style={{ width: 150, fontSize: '11px' }} value={generateFY} onChange={setGenerateFY} options={candidateFYs.map(fy => ({ value: fy, label: fy }))} allowClear />
                    <Button size="small" icon={<CalendarOutlined />} disabled={!generateFY} style={{ fontSize: '11px' }}
                      onClick={() => { if (generateFY) { handleGenerateFY(); setMoreActionsOpen(false); } }}>Generate</Button>
                  </Space>
                </div>
              ),
            }] : []),

            // ── Danger Zone ──────────────────────────────────────────
            ...(canDelete ? [{
              key: 'danger',
              label: <span style={{ fontSize: '12px', fontWeight: 600, color: '#cf1322' }}><DeleteOutlined style={{ marginRight: 6 }} />Danger Zone</span>,
              children: (
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  {/* Delete All Bookings */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #ffa39e', borderRadius: 6, background: '#fff1f0' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#cf1322' }}>Delete All Bookings</div>
                      <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Permanently remove all booking records across all projects.</div>
                    </div>
                    <Popconfirm
                      title="Delete all booking records?"
                      description="This will permanently remove ALL bookings. This cannot be undone."
                      onConfirm={async () => { const ok = await financeApi.deleteAllBookings(currentUser?.username); if (ok) { message.success('All booking records deleted.'); setBulkRefreshToken(t => t + 1); } else { message.error('Failed to delete all bookings.'); } setMoreActionsOpen(false); }}
                      okText="Yes, delete all" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ fontSize: '11px' }}>Delete All Bookings</Button>
                    </Popconfirm>
                  </div>
                  {/* Delete All Finance Data */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #ffa39e', borderRadius: 6, background: '#fff1f0' }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#cf1322' }}>Delete All Finance Data</div>
                      <div style={{ fontSize: '10px', color: '#8c8c8c' }}>Permanently removes all projects and revenue from the database.</div>
                    </div>
                    <Popconfirm
                      title="Delete all finance data?"
                      description="This will permanently remove ALL projects and revenue from the database."
                      onConfirm={() => { handleClearAll(); setMoreActionsOpen(false); }}
                      okText="Yes, delete all" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                      <Button size="small" danger icon={<DeleteOutlined />} disabled={rows.length === 0} style={{ fontSize: '11px' }}>Delete All Data</Button>
                    </Popconfirm>
                  </div>
                </Space>
              ),
            }] : []),
          ];

          return (
            <Collapse
              size="small"
              defaultActiveKey={canEdit ? ['bookings'] : ['danger']}
              items={collapseItems}
              style={{ background: 'transparent' }}
            />
          );
        })()}
      </Modal>

      <ProjectBookingDrawer
        open={!!bookingPanelRow}
        row={bookingPanelRow}
        monthHeaders={monthHeaders}
        fmtRev={fmtRev}
        canEdit={canEdit}
        currentUsername={currentUser?.username || 'system'}
        onClose={() => setBookingPanelRow(null)}
      />

      <BulkBookingDrawer
        open={bulkBookingOpen}
        rows={rows}
        selectedRowKeys={selectedRowKeys}
        setSelectedRowKeys={setSelectedRowKeys}
        monthHeaders={monthHeaders}
        fmtRev={fmtRev}
        canEdit={canEdit}
        currentUsername={currentUser?.username || 'system'}
        bulkAllUploadErrors={bulkAllUploadErrors}
        setBulkAllUploadErrors={setBulkAllUploadErrors}
        bulkAllSaving={bulkAllSaving}
        onBulkAllProjectsUpload={handleBulkAllProjectsUpload}
        refreshToken={bulkRefreshToken}
        onClose={() => setBulkBookingOpen(false)}
      />

    </div>
  );
}
