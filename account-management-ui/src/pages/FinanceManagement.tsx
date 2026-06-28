/**
 * FinanceManagement.tsx
 * 
 * SOW Details — Statement of Work management with Excel upload/download,
 * budget tracking, and project milestone planning
 * UI Location: Account Operations > Finance > SOW Details
 * Page ID: executive_revenue
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Tabs, Typography, Space, Upload, Table, Button, message, Input, Tooltip,
  Drawer, Checkbox, Select, Card, Row, Col, Progress, Empty,
  Segmented, InputNumber, Spin, Popconfirm, Modal, Form, Tag, Switch, Dropdown, Alert, Badge, Collapse,
} from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined,
  FileExcelOutlined, BarChartOutlined, CloudServerOutlined, SaveOutlined, DeleteOutlined,
  EditOutlined, CalendarOutlined, PlusOutlined, StopOutlined, CheckCircleOutlined,
  WarningOutlined, EllipsisOutlined, DollarOutlined, PictureOutlined,
  EyeOutlined, ClockCircleOutlined, MessageOutlined, FullscreenOutlined, FullscreenExitOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined, SearchOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import * as financeApi from '../api/financeApi';
import * as invoiceApi from '../api/invoiceApi';
import * as auditApi from '../api/auditApi';
import type { AuditEntry } from '../api/auditApi';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';

const { Text } = Typography;

type ExcelRow = Record<string, any>;

type Row = {
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

// ── Booking bulk-upload template ──────────────────────────────────────────────
function downloadBookingTemplate(
  refData?: Array<{ milestoneMonth: string; totalAmount: number; alreadyBooked: number; available: number; bookingMonths?: string[]; milestoneType?: 'booked' | 'anticipated' }>,
  projectName?: string,
  projectCode?: string,
) {
  const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '389e0d' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const templateRows: any[][] = [['Milestone Month', 'Booking Month', 'Amount', 'Notes']];
  if (refData && refData.length > 0) {
    refData.filter(r => r.available > 0).forEach(r => {
      templateRows.push([r.milestoneMonth, '', r.available, '']);
    });
  } else {
    templateRows.push(["Jan'26", "Jun'26", 50000, 'PO-1234']);
    templateRows.push(["Feb'26", "Jun'26", 30000, '']);
  }
  const ws: any = XLSXStyle.utils.aoa_to_sheet(templateRows);
  ['A1','B1','C1','D1'].forEach(addr => { if (ws[addr]) ws[addr].s = headerStyle; });
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];

  // Instructions sheet
  const instrAoa = [
    ['Column', 'Description', 'Required?', 'Example'],
    ['Milestone Month', "Format: Mon'YY — must match a booked milestone with remaining capacity", 'Yes', "Jan'26"],
    ['Booking Month',   'Month the booking is officially recorded', 'Yes', "Jun'26"],
    ['Amount',          'Numeric amount to book (must not exceed available capacity shown in Reference Data)', 'Yes', '50000'],
    ['Notes',           'Optional; mandatory if amount < full available capacity of that milestone', 'No', 'PO-1234'],
  ];
  const wsInstr: any = XLSXStyle.utils.aoa_to_sheet(instrAoa);
  wsInstr['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 12 }, { wch: 12 }];

  // Reference Data sheet — Project Code + Project Name + milestone details
  const refHeaderStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const availStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'f6ffed' } }, alignment: { horizontal: 'right' } };
  const bookedStyle = { fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };
  const zeroAvailStyle = { font: { bold: true, color: { rgb: 'cf1322' } }, fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };
  const refRows: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Type', 'Total Amount', 'Already Booked', 'Available to Book', 'Booking Month(s)', 'Status']];
  (refData || []).forEach(r => {
    refRows.push([
      projectCode || '—',
      projectName || '—',
      r.milestoneMonth,
      r.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed',
      r.totalAmount,
      r.alreadyBooked,
      r.available,
      (r.bookingMonths || []).join(', ') || '—',
      r.available <= 0 ? 'Fully Booked' : r.alreadyBooked > 0 ? 'Partially Booked' : 'Open',
    ]);
  });
  const wsRef: any = XLSXStyle.utils.aoa_to_sheet(refRows);
  ['A1','B1','C1','D1','E1','F1','G1','H1','I1'].forEach(addr => { if (wsRef[addr]) wsRef[addr].s = refHeaderStyle; });
  refRows.slice(1).forEach((row, i) => {
    const r = i + 2;
    const isZero = row[6] <= 0; // "Available to Book" is now col index 6
    (['E','F'] as const).forEach(col => { const addr = `${col}${r}`; if (wsRef[addr]) wsRef[addr].s = isZero ? bookedStyle : numStyle; });
    const gAddr = `G${r}`; if (wsRef[gAddr]) wsRef[gAddr].s = isZero ? zeroAvailStyle : availStyle;
  });
  wsRef['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Booking Template');
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instructions');
  XLSXStyle.utils.book_append_sheet(wb, wsRef, 'Reference Data');
  XLSXStyle.writeFile(wb, 'Booking_Template.xlsx');
}

// ── Export booking history ───────────────────────────────────────────────────
function exportBookingHistory(
  projectName: string,
  projectCode: string,
  bookings: financeApi.ProjectBooking[],
) {
  const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const aoa: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Booking Month', 'Type', 'Amount', 'Notes', 'Recorded By', 'Recorded At']];
  bookings.forEach(b => {
    aoa.push([
      projectCode || '—',
      projectName || '—',
      b.milestone_month,
      b.booking_month,
      b.booking_type === 'anticipated' ? 'Anticipated' : 'Fixed',
      b.amount,
      b.notes || '',
      b.created_by || '',
      b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
    ]);
  });
  const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
  ['A1','B1','C1','D1','E1','F1','G1','H1','I1'].forEach(addr => { if (ws[addr]) ws[addr].s = hdrStyle; });
  aoa.slice(1).forEach((_, i) => { const addr = `F${i + 2}`; if (ws[addr]) ws[addr].s = numStyle; });
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Booking History');
  XLSXStyle.writeFile(wb, `Bookings_${(projectCode || projectName || 'export').replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

function exportBulkBookingHistory(
  projects: Array<{ name: string; code: string; bookings: financeApi.ProjectBooking[] }>,
) {
  const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const aoa: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Booking Month', 'Type', 'Amount', 'Notes', 'Recorded By', 'Recorded At']];
  projects.forEach(p => {
    p.bookings.forEach(b => {
      aoa.push([
        p.code || '—',
        p.name || '—',
        b.milestone_month,
        b.booking_month,
        b.booking_type === 'anticipated' ? 'Anticipated' : 'Fixed',
        b.amount,
        b.notes || '',
        b.created_by || '',
        b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
      ]);
    });
  });
  const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
  ['A1','B1','C1','D1','E1','F1','G1','H1','I1'].forEach(addr => { if (ws[addr]) ws[addr].s = hdrStyle; });
  aoa.slice(1).forEach((_, i) => { const addr = `F${i + 2}`; if (ws[addr]) ws[addr].s = numStyle; });
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Booking History');
  XLSXStyle.writeFile(wb, `Bulk_Bookings_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
}

// ── Combined template for multiple projects ───────────────────────────────────
function downloadBulkBookingTemplate(
  projects: Array<{
    code: string; project: string;
    milestones: Array<{ milestoneMonth: string; totalAmount: number; alreadyBooked: number; available: number; bookingMonths: string[]; milestoneType?: 'booked' | 'anticipated' }>;
  }>
) {
  const hdrGreen  = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '389e0d' } }, alignment: { horizontal: 'center' } };
  const hdrBlue   = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const projStyle = { font: { bold: true, italic: true }, fill: { fgColor: { rgb: 'e6f4ff' } } };
  const numStyle  = { alignment: { horizontal: 'right' } };
  const availOk   = { font: { bold: true }, fill: { fgColor: { rgb: 'f6ffed' } }, alignment: { horizontal: 'right' } };
  const availZero = { font: { bold: true, color: { rgb: 'cf1322' } }, fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };
  const bookedClr = { fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };

  // ── Booking Template sheet — with Project Code column ──
  const tplAoa: any[][] = [['Project Code', 'Milestone Month', 'Booking Month', 'Amount', 'Notes']];
  projects.forEach(p => {
    p.milestones.filter(m => m.available > 0).forEach(m => {
      tplAoa.push([p.code, m.milestoneMonth, '', m.available, '']);
    });
  });
  const wsTpl: any = XLSXStyle.utils.aoa_to_sheet(tplAoa);
  ['A1','B1','C1','D1','E1'].forEach(addr => { if (wsTpl[addr]) wsTpl[addr].s = hdrGreen; });
  wsTpl['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }];

  // ── Instructions ──
  const instrAoa = [
    ['Column', 'Description', 'Required?'],
    ['Project Code', 'Must match the code in Reference Data exactly', 'Yes'],
    ['Milestone Month', "Format: Mon'YY — must have available capacity", 'Yes'],
    ['Booking Month',  'Month the booking is recorded', 'Yes'],
    ['Amount', 'Cannot exceed available capacity for that milestone', 'Yes'],
    ['Notes', 'Optional; mandatory if amount < available capacity', 'No'],
  ];
  const wsInstr: any = XLSXStyle.utils.aoa_to_sheet(instrAoa);
  wsInstr['!cols'] = [{ wch: 18 }, { wch: 55 }, { wch: 12 }];
  ['A1','B1','C1'].forEach(addr => { if (wsInstr[addr]) wsInstr[addr].s = hdrBlue; });

  // ── Reference Data — all projects grouped ──
  const refAoa: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Type', 'Total Amount', 'Already Booked', 'Available to Book', 'Booking Month(s)', 'Status']];
  const refStyleMap: Array<{ row: number; isZero: boolean; isProjectRow: boolean }> = [];
  let rowIdx = 2;
  projects.forEach(p => {
    p.milestones.forEach(m => {
      refAoa.push([p.code, p.project, m.milestoneMonth, m.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed', m.totalAmount, m.alreadyBooked, m.available, (m.bookingMonths || []).join(', ') || '—', m.available <= 0 ? 'Fully Booked' : m.alreadyBooked > 0 ? 'Partially Booked' : 'Open']);
      refStyleMap.push({ row: rowIdx, isZero: m.available <= 0, isProjectRow: false });
      rowIdx++;
    });
  });
  const wsRef: any = XLSXStyle.utils.aoa_to_sheet(refAoa);
  ['A1','B1','C1','D1','E1','F1','G1','H1','I1'].forEach(addr => { if (wsRef[addr]) wsRef[addr].s = hdrBlue; });
  refStyleMap.forEach(({ row: r, isZero }) => {
    const eAddr = `E${r}`; if (wsRef[eAddr]) wsRef[eAddr].s = isZero ? bookedClr : numStyle;
    const fAddr = `F${r}`; if (wsRef[fAddr]) wsRef[fAddr].s = isZero ? bookedClr : numStyle;
    const gAddr = `G${r}`; if (wsRef[gAddr]) wsRef[gAddr].s = isZero ? availZero : availOk;
    void projStyle; // used for future project-separator rows
  });
  wsRef['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, wsTpl, 'Bulk Booking Template');
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instructions');
  XLSXStyle.utils.book_append_sheet(wb, wsRef, 'Reference Data');
  XLSXStyle.writeFile(wb, `Bulk_Booking_Template_${new Date().toISOString().slice(0,10)}.xlsx`);
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

interface ProjectListProps {
  onDataChange?: (data: Row[]) => void;
  onMonthsChange?: (months: string[]) => void;
}

function ProjectList({ onDataChange, onMonthsChange }: ProjectListProps) {
  const { configs } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const canEdit = hasPermission('executive_revenue', 'edit');
  const canDelete = hasPermission('executive_revenue', 'delete');

  // Config-driven dropdowns for Add Project modal
  const companyOptions = configs.find(c => c.linkedTo?.includes('finance_company_field'))?.items.map(i => ({ value: i.label, label: i.label })) ?? [];
  const spaceOptions   = configs.find(c => c.linkedTo?.includes('finance_space_field'))?.items.map(i => ({ value: i.label, label: i.label })) ?? [];
  const ownerOptions   = configs.find(c => c.linkedTo?.includes('finance_owner_field'))?.items.map(i => ({ value: i.label, label: i.label })) ?? [];

  const [rows, setRows] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromServer, setFromServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [bulkBookingActiveKey, setBulkBookingActiveKey] = useState<string>('');
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
  const [invoiceCodeSet, setInvoiceCodeSet] = useState<Set<string>>(new Set());
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

  // Booking state
  const [bookings, setBookings] = useState<financeApi.ProjectBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bkMilestoneMonths, setBkMilestoneMonths] = useState<string[]>([]);
  const [bkBookingMonth, setBkBookingMonth] = useState<string | undefined>(undefined);
  const [bkAmount, setBkAmount] = useState<number | null>(null);
  const [bkAmountEdited, setBkAmountEdited] = useState(false);
  const [bkNotes, setBkNotes] = useState('');
  const [bkSaving, setBkSaving] = useState(false);
  // Per-milestone breakdown (used when total amount is edited below auto-calc)
  const [bkBreakdown, setBkBreakdown] = useState<Record<string, { amount: number | null; notes: string }>>({});
  const [bkUploadErrors, setBkUploadErrors] = useState<string[] | null>(null);
  // Separate booking panel (side panel, no mask, table stays visible)
  const [bookingPanelRow, setBookingPanelRow] = useState<Row | null>(null);
  const [bkPanelExpanded, setBkPanelExpanded] = useState(false);
  const [bkHistoryFilter, setBkHistoryFilter] = useState('');
  const [bkFilterMilestone, setBkFilterMilestone] = useState<string | undefined>(undefined);
  const [bkFilterBookedIn, setBkFilterBookedIn] = useState<string | undefined>(undefined);

  const openBookingPanel = (r: Row) => {
    setBookingPanelRow(r);
    setBkMilestoneMonths([]);
    setBkBookingMonth(undefined);
    setBkAmount(null);
    setBkAmountEdited(false);
    setBkNotes('');
    setBkBreakdown({});
    if (r.id) {
      setBookingsLoading(true);
      financeApi.getBookings(r.id).then(b => { setBookings(b); setBookingsLoading(false); }).catch(() => setBookingsLoading(false));
    } else {
      setBookings([]);
    }
  };

  // Load from API on mount
  useEffect(() => {
    setLoading(true);
    financeApi.getProjects().then(({ projects, months, fromServer: online }) => {
      if (online && projects.length) {
        const mapped: Row[] = projects.map((p, i) => ({
          key: p.project || String(i),
          id: p.id,
          sno: i + 1,
          project: p.project,
          company: p.company || '',
          code: p.code || deriveCode(p.project),
          space: p.space || '',
          owner: p.owner || '',
          // Use status field from DB; fall back to deriving from legacy active column
          status: (p.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
          revenue: months.map(m => p.revenue[m] || 0),
          milestoneTypes: (p.milestoneTypes || {}) as Record<string, 'booked' | 'anticipated'>,
          comments: p.comments || '',
        }));
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  // Load invoice codes silently for SOW cross-check
  useEffect(() => {
    invoiceApi.getInvoiceProjects().then(({ projects }) => {
      const codes = new Set(projects.map(p => p.code || p.project.split(' - ')[0].trim()));
      setInvoiceCodeSet(codes);
    }).catch(() => { /* best-effort */ });
  }, []);

  /** Reload rows from server — call after any bulk save to get DB-assigned IDs */
  const reloadFromServer = async () => {
    try {
      const { projects, months, fromServer: online } = await financeApi.getProjects();
      if (online && projects.length) {
        const mapped: Row[] = projects.map((p, i) => ({
          key: p.project || String(i),
          id: p.id,
          sno: i + 1,
          project: p.project,
          company: p.company || '',
          code: p.code || deriveCode(p.project),
          space: p.space || '',
          owner: p.owner || '',
          status: (p.status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
          revenue: months.map(m => p.revenue[m] || 0),
          milestoneTypes: (p.milestoneTypes || {}) as Record<string, 'booked' | 'anticipated'>,
          comments: p.comments || '',
        }));
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
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

  const deriveCode = (name: string) => name.split(' - ')[0].trim() || name;

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
    if (r.id) financeApi.deleteProject(r.id, currentUser?.username);
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

  // ── Booking bulk upload ───────────────────────────────────────────────────
  const handleBookingUpload = async (file: File, bkRow: Row, availableForMs: (m: string) => number) => {
    setBkUploadErrors(null);
    try {
      const buffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const wb = XLSX.read(uint8, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setBkUploadErrors(['No sheet found in the uploaded file.']); return false; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!json.length) { setBkUploadErrors(['The uploaded sheet is empty.']); return false; }
      const headers = Object.keys(json[0]);
      const required = ['Milestone Month', 'Booking Month', 'Amount'];
      const missing = required.filter(h => !headers.includes(h));
      if (missing.length) {
        setBkUploadErrors([`Missing required columns: ${missing.join(', ')}`, 'Please download the correct Booking Template and use it.']);
        return false;
      }
      const errors: string[] = [];
      const valid: Array<{ milestone_month: string; booking_month: string; amount: number; notes: string; booking_type: 'fixed' | 'anticipated' }> = [];
      // Track cumulative amount per milestone across all rows in this upload
      const batchAccum: Record<string, number> = {};
      json.forEach((row, idx) => {
        const rowNum = idx + 2;
        const mm = String(row['Milestone Month'] || '').trim();
        const bm = String(row['Booking Month'] || '').trim();
        const amt = parseFloat(String(row['Amount'] || '0'));
        const notes = String(row['Notes'] || '').trim();
        if (!mm || !bm) { errors.push(`Row ${rowNum}: Milestone Month and Booking Month are required.`); return; }
        if (isNaN(amt) || amt <= 0) { errors.push(`Row ${rowNum}: Amount must be a positive number (got "${row['Amount']}").`); return; }
        const avail = availableForMs(mm);
        if (avail <= 0) { errors.push(`Row ${rowNum}: Milestone "${mm}" is fully booked or has no remaining capacity.`); return; }
        const cumulative = (batchAccum[mm] || 0) + amt;
        if (cumulative > avail) {
          errors.push(`Row ${rowNum}: Total for milestone "${mm}" (${cumulative.toLocaleString()}) exceeds available capacity ${avail.toLocaleString()}.`);
          return;
        }
        batchAccum[mm] = cumulative;
        valid.push({ milestone_month: mm, booking_month: bm, amount: amt, notes, booking_type: (bkRow.milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed') });
      });
      if (errors.length) { setBkUploadErrors(errors); return false; }
      if (!valid.length) { setBkUploadErrors(['No valid rows found to import.']); return false; }

      // Atomic batch save — all-or-nothing
      setBkSaving(true);
      const result = await financeApi.addBookingsBatch(bkRow.id!, valid.map(v => ({
        ...v,
        created_by: currentUser?.username || 'system',
      })));
      setBkSaving(false);
      if (result.ok) {
        message.success(`${valid.length} booking entr${valid.length === 1 ? 'y' : 'ies'} imported successfully.`);
        financeApi.getBookings(bkRow.id!).then(setBookings);
      } else {
        setBkUploadErrors([`Server error: ${result.error || 'Failed to save. No data was written.'}`, 'All rows were rolled back. Please fix the issue and retry.']);
      }
    } catch (e: any) {
      setBkUploadErrors([`Failed to read file: ${e.message || 'Unknown error'}`, 'Please ensure the file is a valid .xlsx file.']);
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
      const required = ['Project Code', 'Milestone Month', 'Booking Month', 'Amount'];
      const missing = required.filter(h => !Object.keys(json[0]).includes(h));
      if (missing.length) { setBulkAllUploadErrors([`Missing required columns: ${missing.join(', ')}`, 'Please use the Bulk Booking Template.']); return false; }

      // Pre-fetch all existing bookings to know available capacity per project
      const bookingsByProject: Record<string, financeApi.ProjectBooking[]> = {};
      await Promise.all(selectedRows.filter(r => r.id).map(async r => {
        bookingsByProject[r.code || r.key] = await financeApi.getBookings(r.id!);
      }));

      const errors: string[] = [];
      const byProject: Record<string, Array<{ milestone_month: string; booking_month: string; amount: number; notes: string; booking_type: 'fixed' | 'anticipated'; rowId: string }>> = {};

      json.forEach((row, i) => {
        const rowNum = i + 2;
        const code = String(row['Project Code'] || '').trim();
        const mm   = String(row['Milestone Month'] || '').trim();
        const bm   = String(row['Booking Month'] || '').trim();
        const amt  = parseFloat(String(row['Amount'] || '0'));
        const notes = String(row['Notes'] || '').trim();
        const btype = String(row['Booking Type'] || 'fixed').trim().toLowerCase() === 'anticipated' ? 'anticipated' : 'fixed';

        if (!code || !mm || !bm) { errors.push(`Row ${rowNum}: Project Code, Milestone Month, Booking Month are required.`); return; }
        if (isNaN(amt) || amt <= 0) { errors.push(`Row ${rowNum}: Amount must be a positive number (got "${row['Amount']}").`); return; }

        const projRow = selectedRows.find(r => (r.code || r.key) === code);
        if (!projRow) { errors.push(`Row ${rowNum}: Project code "${code}" not found in selected projects.`); return; }
        if (!projRow.id) { errors.push(`Row ${rowNum}: Project "${code}" has no ID — cannot save.`); return; }

        const existing = bookingsByProject[code] || [];
        const alreadyBooked = existing.filter(b => b.milestone_month === mm && b.booking_type === btype).reduce((s, b) => s + b.amount, 0);
        const total = projRow.revenue[monthHeaders.indexOf(mm)] || 0;
        const available = Math.max(0, total - alreadyBooked);
        const expectedType = (projRow.milestoneTypes[mm] || 'booked') === 'anticipated' ? 'anticipated' : 'fixed';
        if (btype !== expectedType) { errors.push(`Row ${rowNum}: Milestone "${mm}" in "${code}" is of type "${expectedType}", not "${btype}".`); return; }
        if (total <= 0) { errors.push(`Row ${rowNum}: Milestone "${mm}" has no revenue for project "${code}".`); return; }
        if (available <= 0) { errors.push(`Row ${rowNum}: Milestone "${mm}" is fully booked for project "${code}".`); return; }
        if (amt > available) { errors.push(`Row ${rowNum}: Amount ${amt.toLocaleString()} exceeds available ${available.toLocaleString()} for "${mm}" in "${code}".`); return; }

        if (!byProject[code]) byProject[code] = [];
        byProject[code].push({ milestone_month: mm, booking_month: bm, amount: amt, notes, booking_type: btype, rowId: projRow.id });
      });

      // Stop and show all errors before writing anything
      if (errors.length) { setBulkAllUploadErrors(errors); return false; }

      const allEntries = Object.values(byProject).flat();
      if (!allEntries.length) { setBulkAllUploadErrors(['No valid rows found to import.']); return false; }

      // Save atomically per project using batch endpoint
      setBulkAllSaving(true);
      const projectCodes = Object.keys(byProject);
      const results = await Promise.all(
        projectCodes.map(code => {
          const entries = byProject[code];
          const projRow = selectedRows.find(r => (r.code || r.key) === code)!;
          return financeApi.addBookingsBatch(projRow.id!, entries.map(v => ({
            milestone_month: v.milestone_month, booking_month: v.booking_month,
            amount: v.amount, notes: v.notes, booking_type: v.booking_type,
            created_by: currentUser?.username || 'system',
          })));
        })
      );
      setBulkAllSaving(false);

      const failed = results.filter(r => !r.ok);
      if (failed.length === 0) {
        message.success(`${allEntries.length} booking entr${allEntries.length === 1 ? 'y' : 'ies'} across ${projectCodes.length} project${projectCodes.length !== 1 ? 's' : ''} imported.`);
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
      { title: 'S.No.', key: 'sno', width: 42, fixed: 'left' as const, render: (_: unknown, __: Row, index: number) => index + 1, onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }) },
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
  }, [filteredMonthHeaders, rows, filters, visibleColumns, openEdit, handleDeleteRow, handleToggleActive, handleTypeToggle, handleCommentBlur, openDetailDrawer, openBookingPanel, currency, exchangeRate, fmtRev, invoiceCodeSet]);

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
    if (!dirty || !rows.length) return;

    // Check for duplicate codes across ALL rows before saving
    const conflicts = findDuplicateCodes(rows);
    if (conflicts.length) {
      showDuplicateCodeError(conflicts);
      return;
    }

    setSaving(true);
    try {
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
    XLSXStyle.writeFile(wb, `Revenue_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
              pagination={{ pageSize: 12, showSizeChanger: false }}
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
                    onClick={() => { if (!selectedRowKeys.length) return; setBulkBookingActiveKey(String(selectedRowKeys[0])); setBulkBookingOpen(true); setMoreActionsOpen(false); }}>
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
                      onConfirm={async () => { const ok = await financeApi.deleteAllBookings(); if (ok) { message.success('All booking records deleted.'); setBookings([]); } else { message.error('Failed to delete all bookings.'); } setMoreActionsOpen(false); }}
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

      {/* ── Booking Panel — no mask, slides in from right so table stays fully visible ── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <CalendarOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Booking Details</span>
              {bookingPanelRow && (
                <Tag style={{ fontSize: '10px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bookingPanelRow.code || bookingPanelRow.project}
                </Tag>
              )}
            </Space>
            <Tooltip title={bkPanelExpanded ? 'Collapse' : 'Expand'} overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                type="text" size="small"
                icon={bkPanelExpanded ? <FullscreenExitOutlined style={{ fontSize: '13px' }} /> : <FullscreenOutlined style={{ fontSize: '13px' }} />}
                onClick={() => setBkPanelExpanded(e => !e)}
                style={{ marginRight: 32 }}
              />
            </Tooltip>
          </div>
        }
        placement="right"
        width={bkPanelExpanded ? '65vw' : 440}
        open={!!bookingPanelRow}
        onClose={() => { setBookingPanelRow(null); setBookings([]); setBkMilestoneMonths([]); setBkBookingMonth(undefined); setBkAmount(null); setBkAmountEdited(false); setBkNotes(''); setBkBreakdown({}); setBkHistoryFilter(''); setBkFilterMilestone(undefined); setBkFilterBookedIn(undefined); setBkPanelExpanded(false); setBkUploadErrors(null); }}
        mask={false}
        style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.13)' }}
        bodyStyle={{ padding: 14, overflowY: 'auto', background: '#fafafa' }}
        headerStyle={{ borderBottom: '1px solid #f0f0f0', padding: '10px 16px' }}
      >
        {bookingPanelRow && (() => {
          const bkRow = bookingPanelRow;
          // ── Compute already-booked amounts per milestone from ALL bookings ──
          const bookedPerMs: Record<string, number> = {};
          bookings.forEach(b => {
            bookedPerMs[b.milestone_month] = (bookedPerMs[b.milestone_month] || 0) + b.amount;
          });
          // Available remaining = revenue - already booked (floored at 0)
          const availableForMs = (m: string) =>
            Math.max(0, (bkRow.revenue[monthHeaders.indexOf(m)] || 0) - (bookedPerMs[m] || 0));

          // All milestones with revenue (both fixed and anticipated)
          const allBookedMonths = monthHeaders.filter(m =>
            (bkRow.revenue[monthHeaders.indexOf(m)] || 0) > 0
          );
          // Only offer milestones that still have remaining capacity
          const selectableMonths = allBookedMonths.filter(m => availableForMs(m) > 0);
          const fullyBookedMonths = allBookedMonths.filter(m => availableForMs(m) <= 0);

          const allMonthLabels = [...new Set([
            ...monthHeaders,
            ...Array.from({ length: 12 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() + i);
              const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
              return `${mo}'${String(d.getFullYear()).slice(2)}`;
            }),
          ])];

          // calcTotal = sum of AVAILABLE (remaining) amounts for selected milestones
          const calcTotal = bkMilestoneMonths.reduce((sum, m) => sum + availableForMs(m), 0);
          const amountEdited = bkAmountEdited && bkAmount !== null && bkAmount !== calcTotal;
          const exceedsMax = bkAmount !== null && bkMilestoneMonths.length > 0 && bkAmount > calcTotal;

          // ── Per-milestone breakdown validation (only relevant when amount is edited) ──
          const breakdownTotal = amountEdited
            ? bkMilestoneMonths.reduce((s, m) => s + (bkBreakdown[m]?.amount || 0), 0)
            : 0;
          const breakdownMatchesTotal = !amountEdited || Math.abs(breakdownTotal - (bkAmount || 0)) < 0.01;
          const breakdownRowsValid = !amountEdited || bkMilestoneMonths.every(m => {
            const bd = bkBreakdown[m];
            if (!bd || bd.amount === null || bd.amount <= 0) return false;
            if (bd.amount > availableForMs(m)) return false;
            // notes required if this milestone is only partially booked (amount < available)
            if (bd.amount < availableForMs(m) && !bd.notes.trim()) return false;
            return true;
          });

          const isValid =
            bkMilestoneMonths.length > 0 &&
            !!bkBookingMonth &&
            bkAmount !== null && bkAmount > 0 && !exceedsMax &&
            (!amountEdited || (breakdownMatchesTotal && breakdownRowsValid));

          // Parse "Jan'25" → numeric sort key (YYYYMM) for date-descending sort
          const msToSortKey = (s: string) => {
            const MONTHS: Record<string, number> = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
            const m = s.match(/^([A-Za-z]{3})'(\d{2})$/);
            if (!m) return 0;
            return (2000 + parseInt(m[2], 10)) * 100 + (MONTHS[m[1]] || 0);
          };

          // Unique sorted options for milestone/booked-in dropdowns
          const histMilestoneOpts = [...new Set(bookings.map(b => b.milestone_month))]
            .sort((a, b) => msToSortKey(b) - msToSortKey(a));
          const histBookedInOpts = [...new Set(bookings.map(b => b.booking_month))]
            .sort((a, b) => msToSortKey(b) - msToSortKey(a));

          const filteredBookings = (
            bookings.filter(b => {
              if (bkFilterMilestone && b.milestone_month !== bkFilterMilestone) return false;
              if (bkFilterBookedIn && b.booking_month !== bkFilterBookedIn) return false;
              if (bkHistoryFilter.trim()) {
                const q = bkHistoryFilter.toLowerCase();
                return (
                  b.milestone_month.toLowerCase().includes(q) ||
                  b.booking_month.toLowerCase().includes(q) ||
                  (b.notes || '').toLowerCase().includes(q) ||
                  (b.created_by || '').toLowerCase().includes(q)
                );
              }
              return true;
            })
          ).sort((a, b) => {
            const msDiff = msToSortKey(b.milestone_month) - msToSortKey(a.milestone_month);
            if (msDiff !== 0) return msDiff;
            return msToSortKey(b.booking_month) - msToSortKey(a.booking_month);
          });

          const selectedMsType: 'fixed' | 'anticipated' | 'mixed' | null =
            bkMilestoneMonths.length === 0 ? null :
            bkMilestoneMonths.every(m => bkRow.milestoneTypes[m] === 'anticipated') ? 'anticipated' :
            bkMilestoneMonths.every(m => bkRow.milestoneTypes[m] !== 'anticipated') ? 'fixed' :
            'mixed';

          const panelContent = (
            <div style={{ display: bkPanelExpanded ? 'grid' : 'flex', gridTemplateColumns: bkPanelExpanded ? '1fr 1fr' : undefined, flexDirection: bkPanelExpanded ? undefined : 'column', gap: 14, height: '100%' }}>

              {/* LEFT / TOP: Add Booking Entry (compact) */}
              {canEdit && (
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#434343', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <PlusOutlined style={{ color: '#52c41a', fontSize: '10px' }} />Add Booking Entry
                </div>
                {/* 2-column compact grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
                  {/* Milestone months — full width */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>
                      Milestone(s)
                      {fullyBookedMonths.length > 0 && (
                        <Tooltip
                          title={`Fully booked: ${fullyBookedMonths.join(', ')}`}
                          overlayInnerStyle={{ fontSize: '11px' }}
                        >
                          <Tag color="red" style={{ fontSize: '10px', marginLeft: 6, cursor: 'default' }}>
                            {fullyBookedMonths.length} fully booked
                          </Tag>
                        </Tooltip>
                      )}
                    </div>
                    <Select
                      mode="multiple"
                      size="small"
                      placeholder={selectableMonths.length === 0 ? 'All milestones fully booked' : 'Select milestones…'}
                      value={bkMilestoneMonths}
                      onChange={vals => {
                        setBkMilestoneMonths(vals);
                        // Auto-populate breakdown with available amounts
                        const newBreakdown: Record<string, { amount: number | null; notes: string }> = {};
                        vals.forEach((m: string) => {
                          newBreakdown[m] = bkBreakdown[m] ?? { amount: availableForMs(m), notes: '' };
                        });
                        setBkBreakdown(newBreakdown);
                        const total = vals.reduce((s: number, m: string) => s + availableForMs(m), 0);
                        setBkAmount(total || null);
                        setBkAmountEdited(false);
                      }}
                      style={{ width: '100%', fontSize: '11px' }}
                      maxTagCount="responsive"
                      disabled={selectableMonths.length === 0}
                      options={selectableMonths.map(m => ({
                        value: m,
                        label: `${m} — avail. ${fmtRev(availableForMs(m))} / ${fmtRev(bkRow.revenue[monthHeaders.indexOf(m)] || 0)}`,
                      }))}
                      notFoundContent={<span style={{ fontSize: '11px', color: '#bbb' }}>No milestones with remaining capacity</span>}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Type</div>
                    <div style={{ fontSize: '11px', padding: '1px 8px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 4, color: selectedMsType === 'anticipated' ? '#d46b08' : selectedMsType === 'mixed' ? '#722ed1' : selectedMsType === 'fixed' ? '#389e0d' : '#bfbfbf', fontWeight: 500, height: 24, display: 'flex', alignItems: 'center' }}>
                      {selectedMsType === 'anticipated' ? 'Anticipated' : selectedMsType === 'mixed' ? 'Mixed (Fixed & Anticipated)' : selectedMsType === 'fixed' ? 'Fixed' : '—'}
                    </div>
                  </div>
                  {/* Booking month */}
                  <div>
                    <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Booking Month</div>
                    <Select
                      size="small"
                      placeholder="Month…"
                      value={bkBookingMonth}
                      onChange={v => setBkBookingMonth(v)}
                      style={{ width: '100%', fontSize: '11px' }}
                      showSearch
                      options={allMonthLabels.map(m => ({ value: m, label: m }))}
                    />
                  </div>
                  {/* Total amount */}
                  <div>
                    <div style={{ fontSize: '10px', marginBottom: 2, color: exceedsMax ? '#ff4d4f' : amountEdited ? '#fa8c16' : '#8c8c8c' }}>
                      Total Amount{bkMilestoneMonths.length > 0 ? (amountEdited ? ` (max ${fmtRev(calcTotal)})` : ` ✓ auto`) : ''}
                    </div>
                    <InputNumber
                      size="small"
                      placeholder="Amount"
                      value={bkAmount}
                      onChange={v => {
                        setBkAmount(v);
                        const edited = v !== null && v !== calcTotal;
                        setBkAmountEdited(edited);
                        // Reset breakdown when returning to auto value
                        if (!edited) {
                          const resetBd: Record<string, { amount: number | null; notes: string }> = {};
                          bkMilestoneMonths.forEach(m => { resetBd[m] = { amount: availableForMs(m), notes: '' }; });
                          setBkBreakdown(resetBd);
                        }
                      }}
                      style={{ width: '100%', fontSize: '11px' }}
                      min={0}
                      max={calcTotal || undefined}
                      formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      status={exceedsMax ? 'error' : undefined}
                    />
                  </div>
                  {/* Global notes (non-breakdown) — full width */}
                  {!amountEdited && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '10px', marginBottom: 2, color: '#8c8c8c' }}>Notes (optional)</div>
                      <Input
                        size="small"
                        placeholder="e.g. PO reference"
                        value={bkNotes}
                        onChange={e => setBkNotes(e.target.value)}
                        style={{ fontSize: '11px' }}
                      />
                    </div>
                  )}
                </div>

                {/* ── Per-milestone breakdown (shown only when total amount is edited) ── */}
                {amountEdited && bkMilestoneMonths.length > 0 && (
                  <div style={{ marginTop: 10, border: '1px dashed #faad14', borderRadius: 6, padding: '8px 10px', background: '#fffbe6' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#d48806', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Milestone Breakdown — specify how the total is split</span>
                      <span style={{ color: Math.abs(breakdownTotal - (bkAmount || 0)) < 0.01 ? '#52c41a' : '#ff4d4f', fontWeight: 700 }}>
                        Allocated: {fmtRev(breakdownTotal)} / {fmtRev(bkAmount || 0)}
                      </span>
                    </div>
                    {bkMilestoneMonths.map(m => {
                      const bd = bkBreakdown[m] ?? { amount: availableForMs(m), notes: '' };
                      const isPartial = bd.amount !== null && bd.amount < availableForMs(m);
                      const exceedsMsMax = bd.amount !== null && bd.amount > availableForMs(m);
                      return (
                        <div key={m} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: 6 }}>
                          <Tag color="blue" style={{ fontSize: '10px', margin: 0, whiteSpace: 'nowrap' }}>{m}</Tag>
                          <div>
                            <div style={{ fontSize: '9px', color: exceedsMsMax ? '#ff4d4f' : '#8c8c8c', marginBottom: 1 }}>
                              Amount (avail. {fmtRev(availableForMs(m))})
                            </div>
                            <InputNumber
                              size="small"
                              value={bd.amount}
                              min={0}
                              max={availableForMs(m)}
                              onChange={v => {
                                setBkBreakdown(prev => ({ ...prev, [m]: { ...prev[m], amount: v } }));
                              }}
                              formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                              style={{ width: '100%', fontSize: '11px' }}
                              status={exceedsMsMax ? 'error' : undefined}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '9px', color: isPartial && !bd.notes.trim() ? '#ff4d4f' : '#8c8c8c', marginBottom: 1, fontWeight: isPartial ? 600 : 400 }}>
                              {isPartial ? 'Reason * (partial)' : 'Notes (optional)'}
                            </div>
                            <Input
                              size="small"
                              placeholder={isPartial ? 'Why partial?' : 'optional'}
                              value={bd.notes}
                              onChange={e => setBkBreakdown(prev => ({ ...prev, [m]: { ...prev[m], notes: e.target.value } }))}
                              status={isPartial && !bd.notes.trim() ? 'error' : undefined}
                              style={{ fontSize: '11px' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    {!breakdownMatchesTotal && (
                      <div style={{ fontSize: '10px', color: '#ff4d4f', marginTop: 2 }}>
                        ⚠ Breakdown total ({fmtRev(breakdownTotal)}) must equal the amount ({fmtRev(bkAmount || 0)})
                      </div>
                    )}
                  </div>
                )}

                <Button
                  size="small"
                  loading={bkSaving}
                  disabled={!isValid}
                  icon={<PlusOutlined />}
                  style={{ fontSize: '11px', marginTop: 8 }}
                  onClick={async () => {
                    if (!bkRow.id || bkMilestoneMonths.length === 0 || !bkBookingMonth || !bkAmount) return;
                    setBkSaving(true);
                    const entries = bkMilestoneMonths.map(mm => ({
                      milestone_month: mm,
                      booking_month: bkBookingMonth,
                      amount: amountEdited ? (bkBreakdown[mm]?.amount ?? availableForMs(mm)) : availableForMs(mm),
                      notes: amountEdited ? (bkBreakdown[mm]?.notes || bkNotes) : bkNotes,
                      created_by: currentUser?.username || 'system',
                      booking_type: (bkRow.milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed'),
                    }));
                    const result = await financeApi.addBookingsBatch(bkRow.id!, entries);
                    setBkSaving(false);
                    if (result.ok) {
                      message.success('Booking recorded');
                      setBkMilestoneMonths([]);
                      setBkBookingMonth(undefined);
                      setBkAmount(null);
                      setBkAmountEdited(false);
                      setBkNotes('');
                      setBkBreakdown({});
                      financeApi.getBookings(bkRow.id).then(setBookings);
                    } else {
                      message.error(`Failed to save: ${result.error || 'Unknown error'}`);
                    }
                  }}
                >
                  Record Booking
                </Button>
              </div>
              )}

              {/* RIGHT / BOTTOM: Booking History */}
              <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#434343' }}>
                    Booking History
                    {bookings.length > 0 && (
                      <Tag style={{ fontSize: '10px', marginLeft: 6 }}>
                        {filteredBookings.length}{filteredBookings.length !== bookings.length ? `/${bookings.length}` : ''}
                      </Tag>
                    )}
                  </span>
                  <Space size={4}>
                    {(bkFilterMilestone || bkFilterBookedIn || bkHistoryFilter) && (
                      <Button
                        type="link" size="small"
                        style={{ fontSize: '10px', padding: 0, color: '#ff4d4f' }}
                        onClick={() => { setBkFilterMilestone(undefined); setBkFilterBookedIn(undefined); setBkHistoryFilter(''); }}
                      >
                        Clear filters
                      </Button>
                    )}
                    {canEdit && bookings.length > 0 && (
                      <Popconfirm
                        title="Delete all bookings for this project?"
                        description="This cannot be undone."
                        onConfirm={async () => {
                          if (!bkRow.id) return;
                          await financeApi.deleteAllProjectBookings(bkRow.id);
                          financeApi.getBookings(bkRow.id).then(setBookings);
                        }}
                        okText="Delete All"
                        okButtonProps={{ danger: true, size: 'small' }}
                        cancelButtonProps={{ size: 'small' }}
                      >
                        <Button type="link" size="small" danger style={{ fontSize: '10px', padding: 0 }}>
                          Delete All
                        </Button>
                      </Popconfirm>
                    )}
                    {canEdit && (
                      <Tooltip title="Upload bookings (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                        <Upload
                          accept=".xlsx,.xls"
                          showUploadList={false}
                          beforeUpload={f => handleBookingUpload(f as File, bkRow, availableForMs)}
                        >
                          <Button type="text" size="small" icon={<UploadOutlined style={{ fontSize: '12px', color: '#595959' }} />} />
                        </Upload>
                      </Tooltip>
                    )}
                    <Tooltip title="Download booking template" overlayInnerStyle={{ fontSize: '11px' }}>
                      <Button
                        type="text" size="small"
                        icon={<DownloadOutlined style={{ fontSize: '12px', color: '#595959' }} />}
                        onClick={() => downloadBookingTemplate(
                          allBookedMonths.map(m => ({
                            milestoneMonth: m,
                            totalAmount: bkRow.revenue[monthHeaders.indexOf(m)] || 0,
                            alreadyBooked: bookedPerMs[m] || 0,
                            available: availableForMs(m),
                            bookingMonths: [...new Set(bookings.filter(b => b.milestone_month === m).map(b => b.booking_month))],
                            milestoneType: bkRow.milestoneTypes[m] || 'booked',
                          })),
                          bkRow.project,
                          bkRow.code,
                        )}
                      />
                    </Tooltip>
                    {bookings.length > 0 && (
                      <Tooltip title="Export booking history (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                        <Button
                          type="text" size="small"
                          icon={<FileExcelOutlined style={{ fontSize: '12px', color: '#52c41a' }} />}
                          onClick={() => exportBookingHistory(bkRow.project, bkRow.code || '', filteredBookings.length > 0 ? filteredBookings : bookings)}
                        />
                      </Tooltip>
                    )}
                  </Space>
                </div>
                {/* Upload error alert */}
                {bkUploadErrors && (
                  <Alert
                    type="error"
                    showIcon
                    style={{ fontSize: '11px', marginBottom: 6 }}
                    message="Upload failed"
                    description={
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {bkUploadErrors.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}
                      </ul>
                    }
                    closable
                    onClose={() => setBkUploadErrors(null)}
                  />
                )}
                {/* Filter bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 6px', marginBottom: 8, flexShrink: 0 }}>
                  <Select
                    size="small"
                    allowClear
                    placeholder="Milestone…"
                    value={bkFilterMilestone}
                    onChange={v => setBkFilterMilestone(v)}
                    style={{ fontSize: '11px' }}
                    options={histMilestoneOpts.map(m => ({ value: m, label: m }))}
                    popupMatchSelectWidth={false}
                  />
                  <Select
                    size="small"
                    allowClear
                    placeholder="Booked In…"
                    value={bkFilterBookedIn}
                    onChange={v => setBkFilterBookedIn(v)}
                    style={{ fontSize: '11px' }}
                    options={histBookedInOpts.map(m => ({ value: m, label: m }))}
                    popupMatchSelectWidth={false}
                  />
                  <Input
                    size="small"
                    allowClear
                    placeholder="Search…"
                    value={bkHistoryFilter}
                    onChange={e => setBkHistoryFilter(e.target.value)}
                    style={{ fontSize: '11px' }}
                    prefix={<span style={{ color: '#bbb', fontSize: '10px' }}>⌕</span>}
                  />
                </div>
                {bookingsLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
                ) : bookings.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: '12px' }}>No bookings recorded yet.</Text>
                ) : filteredBookings.length === 0 ? (
                  <Text type="secondary" style={{ fontSize: '12px' }}>No results match the current filters.</Text>
                ) : (
                  <Table
                    size="small"
                    dataSource={filteredBookings}
                    rowKey="id"
                    pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, hideOnSinglePage: true }}
                    scroll={{ x: 'max-content' }}
                    columns={[
                      { title: 'Milestone', dataIndex: 'milestone_month', key: 'mm', width: 85,
                        render: (v: string) => <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>{v}</Tag> },
                      { title: 'Booked In', dataIndex: 'booking_month', key: 'bm', width: 85,
                        render: (v: string) => <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>{v}</Tag> },
                      { title: 'Type', dataIndex: 'booking_type', key: 'btype', width: 88,
                        render: (v: string) => (
                          <Tag color={v === 'anticipated' ? 'orange' : 'blue'} style={{ fontSize: '10px', margin: 0 }}>
                            {v === 'anticipated' ? 'Anticipated' : 'Fixed'}
                          </Tag>
                        )},
                      { title: 'Amount', dataIndex: 'amount', key: 'amt', width: 95,
                        render: (v: number) => <Text style={{ fontSize: '11px', fontWeight: 600 }}>{fmtRev(v)}</Text> },
                      { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true,
                        render: (v: string) => <Tooltip title={v} overlayInnerStyle={{ fontSize: '11px' }}><Text style={{ fontSize: '11px', color: '#8c8c8c' }}>{v || '—'}</Text></Tooltip> },
                      { title: 'By', dataIndex: 'created_by', key: 'by', width: 70,
                        render: (v: string) => <Text style={{ fontSize: '10px', color: '#595959' }}>{v}</Text> },
                      ...(canEdit ? [{
                        title: '', key: 'del', width: 30,
                        render: (_: any, rec: financeApi.ProjectBooking) => (
                          <Popconfirm
                            title="Delete this booking?"
                            onConfirm={async () => {
                              if (!bkRow.id) return;
                              await financeApi.deleteBooking(bkRow.id, rec.id);
                              financeApi.getBookings(bkRow.id).then(setBookings);
                            }}
                            okText="Delete" okButtonProps={{ danger: true, size: 'small' }}
                            cancelButtonProps={{ size: 'small' }}
                          >
                            <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: '10px' }} />} />
                          </Popconfirm>
                        ),
                      }] : []),
                    ]}
                  />
                )}
              </div>
            </div>
          );
          return (
            <div style={{ height: '100%' }}>
              {panelContent}
            </div>
          );
        })()}
      </Drawer>

      {/* ── Bulk Booking Drawer — multi-project, tabbed, no mask ── */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Space>
              <CalendarOutlined style={{ color: '#52c41a' }} />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Manage Bookings</span>
              <Tag style={{ fontSize: '10px' }}>{selectedRowKeys.length} project{selectedRowKeys.length !== 1 ? 's' : ''}</Tag>
            </Space>
            <Space size={6} style={{ marginRight: 32 }}>
              {canEdit && (
                <Tooltip title="Upload bookings for all selected projects (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Upload
                    accept=".xlsx,.xls"
                    showUploadList={false}
                    beforeUpload={f => {
                      const selectedRows = rows.filter(r => selectedRowKeys.includes(r.key));
                      return handleBulkAllProjectsUpload(f as File, selectedRows);
                    }}
                  >
                    <Button
                      size="small"
                      loading={bulkAllSaving}
                      icon={<UploadOutlined style={{ fontSize: '12px' }} />}
                      style={{ fontSize: '11px' }}
                    >
                      Upload All
                    </Button>
                  </Upload>
                </Tooltip>
              )}
              <Tooltip title="Download combined template for all selected projects" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button
                  size="small"
                  icon={<DownloadOutlined style={{ fontSize: '12px' }} />}
                  style={{ fontSize: '11px' }}
                  onClick={async () => {
                    // Fetch live bookings for all selected rows to populate reference data
                    const selectedRows = rows.filter(r => selectedRowKeys.includes(r.key));
                    const allBookings = await Promise.all(
                      selectedRows.filter(r => r.id).map(r => financeApi.getBookings(r.id!))
                    );
                    const projData = selectedRows.map((r, i) => {
                      const bks = allBookings[i] || [];
                      const bookedPer: Record<string, number> = {};
                      bks.forEach(b => { bookedPer[b.milestone_month] = (bookedPer[b.milestone_month] || 0) + b.amount; });
                      const bookedMonthsPerMs: Record<string, string[]> = {};
                      bks.forEach(b => { (bookedMonthsPerMs[b.milestone_month] = bookedMonthsPerMs[b.milestone_month] || []).push(b.booking_month); });
                      const milestones = monthHeaders
                        .filter(m => (r.revenue[monthHeaders.indexOf(m)] || 0) > 0)
                        .map(m => ({
                          milestoneMonth: m,
                          totalAmount: r.revenue[monthHeaders.indexOf(m)] || 0,
                          alreadyBooked: bookedPer[m] || 0,
                          available: Math.max(0, (r.revenue[monthHeaders.indexOf(m)] || 0) - (bookedPer[m] || 0)),
                          bookingMonths: [...new Set(bookedMonthsPerMs[m] || [])],
                          milestoneType: r.milestoneTypes[m] || 'booked',
                        }));
                      return { code: r.code || r.key, project: r.project, milestones };
                    });
                    downloadBulkBookingTemplate(projData);
                  }}
                >
                  Template (All)
                </Button>
              </Tooltip>
              <Tooltip title="Export all booking history (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button
                  size="small"
                  icon={<FileExcelOutlined style={{ fontSize: '12px', color: '#52c41a' }} />}
                  style={{ fontSize: '11px' }}
                  onClick={async () => {
                    const selectedRows = rows.filter(r => selectedRowKeys.includes(r.key));
                    const allBookings = await Promise.all(
                      selectedRows.filter(r => r.id).map(r => financeApi.getBookings(r.id!))
                    );
                    const projData = selectedRows.map((r, i) => ({
                      name: r.project,
                      code: r.code || r.key,
                      bookings: allBookings[i] || [],
                    }));
                    exportBulkBookingHistory(projData);
                  }}
                >
                  Export All
                </Button>
              </Tooltip>
              <Button
                type="link" size="small"
                style={{ fontSize: '11px', color: '#595959' }}
                onClick={() => { setSelectedRowKeys([]); setBulkBookingOpen(false); setBulkAllUploadErrors(null); }}
              >
                Clear &amp; close
              </Button>
            </Space>
          </div>
        }
        placement="right"
        width="75vw"
        open={bulkBookingOpen}
        onClose={() => { setBulkBookingOpen(false); setBulkAllUploadErrors(null); }}
        mask={false}
        style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.13)' }}
        bodyStyle={{ padding: 0, overflowY: 'hidden', background: '#f5f5f5' }}
        headerStyle={{ borderBottom: '1px solid #f0f0f0', padding: '10px 16px' }}
      >
        {bulkBookingOpen && (() => {
          const selectedRows = rows.filter(r => selectedRowKeys.includes(r.key));
          if (!selectedRows.length) return null;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {bulkAllUploadErrors && (
                <Alert
                  type="error" showIcon closable
                  onClose={() => setBulkAllUploadErrors(null)}
                  message={<span style={{ fontSize: '11px', fontWeight: 600 }}>Bulk upload failed — {bulkAllUploadErrors.length} error{bulkAllUploadErrors.length !== 1 ? 's' : ''}</span>}
                  description={
                    <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 120, overflowY: 'auto' }}>
                      {bulkAllUploadErrors.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}
                    </ul>
                  }
                  style={{ margin: '8px 12px 0', fontSize: '11px' }}
                />
              )}
              <Tabs
                activeKey={bulkBookingActiveKey || selectedRows[0].key}
                onChange={setBulkBookingActiveKey}
                tabPosition="left"
                size="small"
                style={{ flex: 1, minHeight: 0 }}
                tabBarStyle={{ width: 180, background: '#fafafa', borderRight: '1px solid #f0f0f0', paddingTop: 8 }}
                items={selectedRows.map(r => ({
                  key: r.key,
                  label: (
                    <div style={{ maxWidth: 155, overflow: 'hidden' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.project}
                      </div>
                      <div style={{ fontSize: '10px', color: '#8c8c8c' }}>{r.code || r.company}</div>
                    </div>
                  ),
                  children: (
                    <div style={{ padding: 14, height: 'calc(100vh - 110px)', overflowY: 'auto' }}>
                      <BulkBookingProjectPanel
                        row={r}
                        monthHeaders={monthHeaders}
                        fmtRev={fmtRev}
                        canEdit={canEdit}
                        currentUsername={currentUser?.username || 'system'}
                        refreshToken={bulkRefreshToken}
                      />
                    </div>
                  ),
                }))}
              />
            </div>
          );
        })()}
      </Drawer>
    </div>
  );
}

// ── Self-contained booking panel for one project (used by BulkBookingDrawer) ─
interface BulkBookingProjectPanelProps {
  row: Row;
  monthHeaders: string[];
  fmtRev: (v: number) => string;
  canEdit: boolean;
  currentUsername: string;
  refreshToken?: number;
}
function BulkBookingProjectPanel({ row, monthHeaders, fmtRev, canEdit, currentUsername, refreshToken }: BulkBookingProjectPanelProps) {
  const [bookings, setBookings] = useState<financeApi.ProjectBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bkMilestoneMonths, setBkMilestoneMonths] = useState<string[]>([]);
  const [bkBookingMonth, setBkBookingMonth] = useState<string | undefined>(undefined);
  const [bkAmount, setBkAmount] = useState<number | null>(null);
  const [bkAmountEdited, setBkAmountEdited] = useState(false);
  const [bkNotes, setBkNotes] = useState('');
  const [bkSaving, setBkSaving] = useState(false);
  const [bkBreakdown, setBkBreakdown] = useState<Record<string, { amount: number | null; notes: string }>>({});
  const [bkHistoryFilter, setBkHistoryFilter] = useState('');
  const [bkFilterMilestone, setBkFilterMilestone] = useState<string | undefined>(undefined);
  const [bkFilterBookedIn, setBkFilterBookedIn] = useState<string | undefined>(undefined);
  const [bkUploadErrors, setBkUploadErrors] = useState<string[] | null>(null);

  useEffect(() => {
    if (!row.id) return;
    setBookingsLoading(true);
    financeApi.getBookings(row.id).then(b => { setBookings(b); setBookingsLoading(false); }).catch(() => setBookingsLoading(false));
  }, [row.id, refreshToken]);

  const bookedPerMs: Record<string, number> = {};
  bookings.forEach(b => {
    bookedPerMs[b.milestone_month] = (bookedPerMs[b.milestone_month] || 0) + b.amount;
  });
  const availableForMs = (m: string) => Math.max(0, (row.revenue[monthHeaders.indexOf(m)] || 0) - (bookedPerMs[m] || 0));

  const allBookedMonths = monthHeaders.filter(m => (row.revenue[monthHeaders.indexOf(m)] || 0) > 0);
  const selectableMonths = allBookedMonths.filter(m => availableForMs(m) > 0);
  const fullyBookedMonths = allBookedMonths.filter(m => availableForMs(m) <= 0);
  const selectedMsType: 'fixed' | 'anticipated' | 'mixed' | null =
    bkMilestoneMonths.length === 0 ? null :
    bkMilestoneMonths.every(m => row.milestoneTypes[m] === 'anticipated') ? 'anticipated' :
    bkMilestoneMonths.every(m => row.milestoneTypes[m] !== 'anticipated') ? 'fixed' :
    'mixed';

  const allMonthLabels = [...new Set([
    ...monthHeaders,
    ...Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
      return `${mo}'${String(d.getFullYear()).slice(2)}`;
    }),
  ])];

  const calcTotal = bkMilestoneMonths.reduce((sum, m) => sum + availableForMs(m), 0);
  const amountEdited = bkAmountEdited && bkAmount !== null && bkAmount !== calcTotal;
  const exceedsMax = bkAmount !== null && bkMilestoneMonths.length > 0 && bkAmount > calcTotal;
  const breakdownTotal = amountEdited ? bkMilestoneMonths.reduce((s, m) => s + (bkBreakdown[m]?.amount || 0), 0) : 0;
  const breakdownMatchesTotal = !amountEdited || Math.abs(breakdownTotal - (bkAmount || 0)) < 0.01;
  const breakdownRowsValid = !amountEdited || bkMilestoneMonths.every(m => {
    const bd = bkBreakdown[m];
    if (!bd || bd.amount === null || bd.amount <= 0) return false;
    if (bd.amount > availableForMs(m)) return false;
    if (bd.amount < availableForMs(m) && !bd.notes.trim()) return false;
    return true;
  });
  const isValid = bkMilestoneMonths.length > 0 && !!bkBookingMonth && bkAmount !== null && bkAmount > 0 && !exceedsMax &&
    (!amountEdited || (breakdownMatchesTotal && breakdownRowsValid));

  const msToSortKey = (s: string) => {
    const MONTHS: Record<string, number> = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
    const m = s.match(/^([A-Za-z]{3})'(\d{2})$/);
    if (!m) return 0;
    return (2000 + parseInt(m[2], 10)) * 100 + (MONTHS[m[1]] || 0);
  };

  const histMilestoneOpts = [...new Set(bookings.map(b => b.milestone_month))].sort((a, b) => msToSortKey(b) - msToSortKey(a));
  const histBookedInOpts  = [...new Set(bookings.map(b => b.booking_month))].sort((a, b) => msToSortKey(b) - msToSortKey(a));

  const filteredBookings = bookings.filter(b => {
    if (bkFilterMilestone && b.milestone_month !== bkFilterMilestone) return false;
    if (bkFilterBookedIn  && b.booking_month  !== bkFilterBookedIn)  return false;
    if (bkHistoryFilter.trim()) {
      const q = bkHistoryFilter.toLowerCase();
      return b.milestone_month.toLowerCase().includes(q) || b.booking_month.toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q) || (b.created_by || '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    const d = msToSortKey(b.milestone_month) - msToSortKey(a.milestone_month);
    return d !== 0 ? d : msToSortKey(b.booking_month) - msToSortKey(a.booking_month);
  });

  const handleBulkBookingUpload = async (file: File) => {
    setBkUploadErrors(null);
    try {
      const uint8 = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(uint8, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setBkUploadErrors(['No sheet found in the uploaded file.']); return false; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!json.length) { setBkUploadErrors(['The uploaded sheet is empty.']); return false; }
      const required = ['Milestone Month', 'Booking Month', 'Amount'];
      const missing = required.filter(h => !Object.keys(json[0]).includes(h));
      if (missing.length) { setBkUploadErrors([`Missing required columns: ${missing.join(', ')}. Please use the correct template.`]); return false; }
      const errors: string[] = [];
      const valid: Array<{ milestone_month: string; booking_month: string; amount: number; notes: string; booking_type: 'fixed' | 'anticipated' }> = [];
      json.forEach((r, i) => {
        const mm = String(r['Milestone Month'] || '').trim();
        const bm = String(r['Booking Month'] || '').trim();
        const amt = parseFloat(String(r['Amount'] || '0'));
        const notes = String(r['Notes'] || '').trim();
        if (!mm || !bm) { errors.push(`Row ${i + 2}: Milestone Month and Booking Month are required.`); return; }
        if (isNaN(amt) || amt <= 0) { errors.push(`Row ${i + 2}: Amount must be a positive number (got "${r['Amount']}").`); return; }
        const avail = availableForMs(mm);
        if (avail <= 0) { errors.push(`Row ${i + 2}: Milestone "${mm}" is fully booked or has no remaining capacity.`); return; }
        if (amt > avail) { errors.push(`Row ${i + 2}: Amount ${amt.toLocaleString()} exceeds available ${avail.toLocaleString()} for "${mm}".`); return; }
        valid.push({ milestone_month: mm, booking_month: bm, amount: amt, notes, booking_type: (row.milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed') });
      });
      if (errors.length) { setBkUploadErrors(errors); return false; }
      if (!valid.length) { setBkUploadErrors(['No valid rows found to import.']); return false; }
      setBkSaving(true);
      const result = await financeApi.addBookingsBatch(row.id!, valid.map(v => ({ ...v, created_by: currentUsername })));
      setBkSaving(false);
      if (result.ok) {
        message.success(`${valid.length} booking entr${valid.length === 1 ? 'y' : 'ies'} imported successfully.`);
        financeApi.getBookings(row.id!).then(setBookings);
      } else {
        setBkUploadErrors([`Server error: ${result.error || 'Failed to save.'}`, 'No data was written. Please fix the errors and retry.']);
      }
    } catch (e: any) {
      setBkUploadErrors([`Failed to read file: ${e.message || 'Unknown error'}`, 'Please ensure the file is a valid .xlsx file.']);
    }
    return false;
  };

  const panelContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Add Booking Entry */}
      {canEdit && (
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#434343', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlusOutlined style={{ color: '#52c41a', fontSize: '10px' }} />Add Booking Entry
          {fullyBookedMonths.length > 0 && (
            <Tooltip title={`Fully booked: ${fullyBookedMonths.join(', ')}`} overlayInnerStyle={{ fontSize: '11px' }}>
              <Tag color="red" style={{ fontSize: '10px', cursor: 'default' }}>{fullyBookedMonths.length} fully booked</Tag>
            </Tooltip>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Milestone(s)</div>
            <Select mode="multiple" size="small" placeholder={selectableMonths.length === 0 ? 'All milestones fully booked' : 'Select milestones…'}
              value={bkMilestoneMonths} disabled={selectableMonths.length === 0}
              onChange={vals => {
                setBkMilestoneMonths(vals);
                const nb: Record<string, { amount: number | null; notes: string }> = {};
                vals.forEach((m: string) => { nb[m] = bkBreakdown[m] ?? { amount: availableForMs(m), notes: '' }; });
                setBkBreakdown(nb);
                setBkAmount(vals.reduce((s: number, m: string) => s + availableForMs(m), 0) || null);
                setBkAmountEdited(false);
              }}
              style={{ width: '100%', fontSize: '11px' }} maxTagCount="responsive"
              options={selectableMonths.map(m => ({ value: m, label: `${m} — avail. ${fmtRev(availableForMs(m))} / ${fmtRev(row.revenue[monthHeaders.indexOf(m)] || 0)}` }))}
            />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Type</div>
            <div style={{ fontSize: '11px', padding: '1px 8px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 4, color: selectedMsType === 'anticipated' ? '#d46b08' : selectedMsType === 'mixed' ? '#722ed1' : selectedMsType === 'fixed' ? '#389e0d' : '#bfbfbf', fontWeight: 500, height: 24, display: 'flex', alignItems: 'center' }}>
              {selectedMsType === 'anticipated' ? 'Anticipated' : selectedMsType === 'mixed' ? 'Mixed (Fixed & Anticipated)' : selectedMsType === 'fixed' ? 'Fixed' : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Booking Month</div>
            <Select size="small" placeholder="Month…" value={bkBookingMonth} onChange={v => setBkBookingMonth(v)}
              style={{ width: '100%', fontSize: '11px' }} showSearch
              options={allMonthLabels.map(m => ({ value: m, label: m }))} />
          </div>
          <div>
            <div style={{ fontSize: '10px', marginBottom: 2, color: exceedsMax ? '#ff4d4f' : amountEdited ? '#fa8c16' : '#8c8c8c' }}>
              Total Amount{bkMilestoneMonths.length > 0 ? (amountEdited ? ` (max ${fmtRev(calcTotal)})` : ' ✓ auto') : ''}
            </div>
            <InputNumber size="small" value={bkAmount}
              onChange={v => {
                setBkAmount(v); const edited = v !== null && v !== calcTotal; setBkAmountEdited(edited);
                if (!edited) { const rb: Record<string, { amount: number | null; notes: string }> = {}; bkMilestoneMonths.forEach(m => { rb[m] = { amount: availableForMs(m), notes: '' }; }); setBkBreakdown(rb); }
              }}
              style={{ width: '100%', fontSize: '11px' }} min={0} max={calcTotal || undefined}
              formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} status={exceedsMax ? 'error' : undefined} />
          </div>
          {!amountEdited && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Notes (optional)</div>
              <Input size="small" placeholder="e.g. PO reference" value={bkNotes} onChange={e => setBkNotes(e.target.value)} style={{ fontSize: '11px' }} />
            </div>
          )}
        </div>
        {amountEdited && bkMilestoneMonths.length > 0 && (
          <div style={{ marginTop: 10, border: '1px dashed #faad14', borderRadius: 6, padding: '8px 10px', background: '#fffbe6' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#d48806', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span>Milestone Breakdown</span>
              <span style={{ color: breakdownMatchesTotal ? '#52c41a' : '#ff4d4f', fontWeight: 700 }}>
                Allocated: {fmtRev(breakdownTotal)} / {fmtRev(bkAmount || 0)}
              </span>
            </div>
            {bkMilestoneMonths.map(m => {
              const bd = bkBreakdown[m] ?? { amount: availableForMs(m), notes: '' };
              const isPartial = bd.amount !== null && bd.amount < availableForMs(m);
              const exceeds = bd.amount !== null && bd.amount > availableForMs(m);
              return (
                <div key={m} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: 6 }}>
                  <Tag color="blue" style={{ fontSize: '10px', margin: 0, whiteSpace: 'nowrap' }}>{m}</Tag>
                  <div>
                    <div style={{ fontSize: '9px', color: exceeds ? '#ff4d4f' : '#8c8c8c', marginBottom: 1 }}>Amount (avail. {fmtRev(availableForMs(m))})</div>
                    <InputNumber size="small" value={bd.amount} min={0} max={availableForMs(m)}
                      onChange={v => setBkBreakdown(prev => ({ ...prev, [m]: { ...prev[m], amount: v } }))}
                      formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      style={{ width: '100%', fontSize: '11px' }} status={exceeds ? 'error' : undefined} />
                  </div>
                  <div>
                    <div style={{ fontSize: '9px', color: isPartial && !bd.notes.trim() ? '#ff4d4f' : '#8c8c8c', marginBottom: 1, fontWeight: isPartial ? 600 : 400 }}>
                      {isPartial ? 'Reason * (partial)' : 'Notes (optional)'}
                    </div>
                    <Input size="small" placeholder={isPartial ? 'Why partial?' : 'optional'} value={bd.notes}
                      onChange={e => setBkBreakdown(prev => ({ ...prev, [m]: { ...prev[m], notes: e.target.value } }))}
                      status={isPartial && !bd.notes.trim() ? 'error' : undefined} style={{ fontSize: '11px' }} />
                  </div>
                </div>
              );
            })}
            {!breakdownMatchesTotal && <div style={{ fontSize: '10px', color: '#ff4d4f' }}>⚠ Breakdown total must equal {fmtRev(bkAmount || 0)}</div>}
          </div>
        )}
        <Button size="small" loading={bkSaving} disabled={!isValid} icon={<PlusOutlined />} style={{ fontSize: '11px', marginTop: 8 }}
          onClick={async () => {
            if (!row.id || !bkMilestoneMonths.length || !bkBookingMonth || !bkAmount) return;
            setBkSaving(true);
            const entries = bkMilestoneMonths.map(mm => ({
              milestone_month: mm,
              booking_month: bkBookingMonth!,
              amount: amountEdited ? (bkBreakdown[mm]?.amount ?? availableForMs(mm)) : availableForMs(mm),
              notes: amountEdited ? (bkBreakdown[mm]?.notes || bkNotes) : bkNotes,
              created_by: currentUsername,
              booking_type: (row.milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed') as 'fixed' | 'anticipated',
            }));
            const result = await financeApi.addBookingsBatch(row.id!, entries);
            setBkSaving(false);
            if (result.ok) {
              message.success('Booking recorded');
              setBkMilestoneMonths([]); setBkBookingMonth(undefined); setBkAmount(null); setBkAmountEdited(false); setBkNotes(''); setBkBreakdown({});
              financeApi.getBookings(row.id!).then(setBookings);
            } else { message.error(`Failed to save: ${result.error || 'Unknown error'}`); }
          }}>Record Booking</Button>
      </div>
      )}

      {/* Booking History */}
      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#434343' }}>
            Booking History
          {bookings.length > 0 && <Tag style={{ fontSize: '10px', marginLeft: 6 }}>{filteredBookings.length}{filteredBookings.length !== bookings.length ? `/${bookings.length}` : ''}</Tag>}
          </span>
          <Space size={4}>
            {(bkFilterMilestone || bkFilterBookedIn || bkHistoryFilter) && (
              <Button type="link" size="small" style={{ fontSize: '10px', padding: 0, color: '#ff4d4f' }}
                onClick={() => { setBkFilterMilestone(undefined); setBkFilterBookedIn(undefined); setBkHistoryFilter(''); }}>
                Clear filters
              </Button>
            )}
            {canEdit && (
              <Tooltip title="Upload bookings (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={f => handleBulkBookingUpload(f as File)}>
                  <Button type="text" size="small" icon={<UploadOutlined style={{ fontSize: '12px', color: '#595959' }} />} />
                </Upload>
              </Tooltip>
            )}
            <Tooltip title="Download booking template" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button type="text" size="small" icon={<DownloadOutlined style={{ fontSize: '12px', color: '#595959' }} />}
                onClick={() => downloadBookingTemplate(
                allBookedMonths.map(m => ({ milestoneMonth: m, totalAmount: row.revenue[monthHeaders.indexOf(m)] || 0, alreadyBooked: bookedPerMs[m] || 0, available: availableForMs(m), bookingMonths: [...new Set(bookings.filter(b => b.milestone_month === m).map(b => b.booking_month))], milestoneType: row.milestoneTypes[m] || 'booked' })),
                  row.project,
                  row.code,
                )} />
            </Tooltip>
            {bookings.length > 0 && (
              <Tooltip title="Export booking history (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button type="text" size="small" icon={<FileExcelOutlined style={{ fontSize: '12px', color: '#52c41a' }} />}
                onClick={() => exportBookingHistory(row.project, row.code || '', filteredBookings.length > 0 ? filteredBookings : bookings)} />
              </Tooltip>
            )}
          </Space>
        </div>
        {bkUploadErrors && (
          <Alert type="error" showIcon style={{ fontSize: '11px', marginBottom: 6 }} message="Upload failed"
            description={<ul style={{ margin: 0, paddingLeft: 16 }}>{bkUploadErrors.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}</ul>}
            closable onClose={() => setBkUploadErrors(null)} />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 6px', marginBottom: 8 }}>
          <Select size="small" allowClear placeholder="Milestone…" value={bkFilterMilestone} onChange={v => setBkFilterMilestone(v)}
            style={{ fontSize: '11px' }} options={histMilestoneOpts.map(m => ({ value: m, label: m }))} popupMatchSelectWidth={false} />
          <Select size="small" allowClear placeholder="Booked In…" value={bkFilterBookedIn} onChange={v => setBkFilterBookedIn(v)}
            style={{ fontSize: '11px' }} options={histBookedInOpts.map(m => ({ value: m, label: m }))} popupMatchSelectWidth={false} />
          <Input size="small" allowClear placeholder="Search…" value={bkHistoryFilter} onChange={e => setBkHistoryFilter(e.target.value)}
            style={{ fontSize: '11px' }} prefix={<span style={{ color: '#bbb', fontSize: '10px' }}>⌕</span>} />
        </div>
        {bookingsLoading ? (
          <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
        ) : bookings.length === 0 ? (
          <Text type="secondary" style={{ fontSize: '12px' }}>No bookings recorded yet.</Text>
        ) : filteredBookings.length === 0 ? (
          <Text type="secondary" style={{ fontSize: '12px' }}>No results match the current filters.</Text>
        ) : (
          <Table size="small" dataSource={filteredBookings} rowKey="id"
            pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Milestone', dataIndex: 'milestone_month', key: 'mm', width: 85, render: (v: string) => <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>{v}</Tag> },
              { title: 'Booked In', dataIndex: 'booking_month', key: 'bm', width: 85, render: (v: string) => <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>{v}</Tag> },
              { title: 'Type', dataIndex: 'booking_type', key: 'btype', width: 88, render: (v: string) => <Tag color={v === 'anticipated' ? 'orange' : 'blue'} style={{ fontSize: '10px', margin: 0 }}>{v === 'anticipated' ? 'Anticipated' : 'Fixed'}</Tag> },
              { title: 'Amount', dataIndex: 'amount', key: 'amt', width: 95, render: (v: number) => <Text style={{ fontSize: '11px', fontWeight: 600 }}>{fmtRev(v)}</Text> },
              { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true, render: (v: string) => <Tooltip title={v} overlayInnerStyle={{ fontSize: '11px' }}><Text style={{ fontSize: '11px', color: '#8c8c8c' }}>{v || '—'}</Text></Tooltip> },
              { title: 'By', dataIndex: 'created_by', key: 'by', width: 70, render: (v: string) => <Text style={{ fontSize: '10px', color: '#595959' }}>{v}</Text> },
              ...(canEdit ? [{
                title: '', key: 'del', width: 30,
                render: (_: any, rec: financeApi.ProjectBooking) => (
                  <Popconfirm title="Delete this booking?" onConfirm={async () => { await financeApi.deleteBooking(row.id!, rec.id); financeApi.getBookings(row.id!).then(setBookings); }}
                    okText="Delete" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: '10px' }} />} />
                  </Popconfirm>
                ),
              }] : []),
            ]}
          />
        )}
      </div>
    </div>
  );

  return <>{panelContent}</>;
}

interface InsightsProps {
  data: Row[];
  monthHeaders: string[];
}

function Insights({ data, monthHeaders }: InsightsProps) {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);
  const [exporting, setExporting] = useState(false);
  const [filterCompany, setFilterCompany] = useState<string | null>(null);
  const [revenueType, setRevenueType] = useState<'all' | 'booked' | 'anticipated'>('all');
  const insightsRef = useRef<HTMLDivElement>(null);

  const companyOptions = useMemo(() => {
    const seen = new Set<string>();
    data.forEach(r => { if (r.company?.trim()) seen.add(r.company.trim()); });
    return Array.from(seen).sort().map(c => ({ value: c, label: c }));
  }, [data]);

  const filteredData = useMemo(() =>
    filterCompany ? data.filter(r => r.company?.trim() === filterCompany) : data,
    [data, filterCompany]);

  /** Revenue for a row at a given month index, filtered by milestone type */
  const effectiveRev = (r: Row, idx: number): number => {
    if (revenueType === 'all') return r.revenue[idx] || 0;
    const month = monthHeaders[idx];
    const type = (r.milestoneTypes?.[month] || 'booked') as 'booked' | 'anticipated';
    return type === revenueType ? (r.revenue[idx] || 0) : 0;
  };

  const availableFYs = useMemo(() => {
    const fySet = new Set<number>();
    monthHeaders.forEach(m => {
      const info = getMonthFY(m);
      if (info) fySet.add(info.fy);
    });
    const sorted = Array.from(fySet).sort();
    return sorted.length ? sorted.map(fy => `FY${fy}`) : [];
  }, [monthHeaders]);

  // Keep fiscalYear in sync when availableFYs changes (e.g. on first data load)
  useEffect(() => {
    if (availableFYs.length > 0 && !availableFYs.includes(fiscalYear)) {
      setFiscalYear(availableFYs[0]);
    }
  }, [availableFYs]);

  const [fiscalYear, setFiscalYear] = useState<string>('');

  const fmt = (n: number) =>
    currency === 'USD' ? usd(n * exchangeRate) : inr(n);

  const qData = useMemo(() => {
    const fyNum = fiscalYear ? parseInt(fiscalYear.replace('FY', '')) : 0;
    if (!fyNum) return { quarters: [], grand: 0 };
    const s = monthHeaders.findIndex(m => {
      const info = getMonthFY(m);
      return info?.fy === fyNum && info.pos === 0;
    });
    if (s === -1) return { quarters: [], grand: 0 };
    const calcQ = (indices: number[]) =>
      filteredData.reduce((t, r) => t + indices.reduce((q, i) => q + effectiveRev(r, i), 0), 0);
    const q = [calcQ([s,s+1,s+2]), calcQ([s+3,s+4,s+5]), calcQ([s+6,s+7,s+8]), calcQ([s+9,s+10,s+11])];
    const grand = q.reduce((a, b) => a + b, 0);
    const mLabel = (i: number) => monthHeaders[s + i] || '';
    return {
      quarters: q.map((v, i) => ({
        total: v,
        pct: grand ? Math.round((v / grand) * 100) : 0,
        label: `Q${i + 1}`,
        months: `${mLabel(i * 3)}–${mLabel(i * 3 + 2)}`,
      })),
      grand,
    };
  }, [filteredData, monthHeaders, fiscalYear, revenueType]);

  const yoyData = useMemo(() => {
    if (availableFYs.length < 2) return null;
    const startOf = (fyStr: string) => {
      const fyNum = parseInt(fyStr.replace('FY', ''));
      return monthHeaders.findIndex(m => {
        const info = getMonthFY(m);
        return info?.fy === fyNum && info.pos === 0;
      });
    };
    const calc = (fyStr: string) => {
      const s = startOf(fyStr);
      if (s === -1) return 0;
      return filteredData.reduce((t, r) => {
        let sum = 0;
        for (let i = s; i < s + 12 && i < r.revenue.length; i++) sum += effectiveRev(r, i);
        return t + sum;
      }, 0);
    };
    const fy1 = calc(availableFYs[0]), fy2 = calc(availableFYs[1]);
    return { fy1, fy2, pct: fy1 ? Math.round(((fy2 - fy1) / fy1) * 100) : 0, labels: [availableFYs[0], availableFYs[1]] };
  }, [filteredData, availableFYs, monthHeaders, revenueType]);

  const qColors = ['#1890FF', '#52C41A', '#FFA940', '#FF7875'];
  const qPctColor = (p: number) => p >= 30 ? '#52C41A' : p >= 20 ? '#FFA940' : '#FF7875';

  // Monthly breakdown for the selected FY
  const monthlyData = useMemo(() => {
    const fyNum = fiscalYear ? parseInt(fiscalYear.replace('FY', '')) : 0;
    if (!fyNum) return [];
    const s = monthHeaders.findIndex(m => {
      const info = getMonthFY(m);
      return info?.fy === fyNum && info.pos === 0;
    });
    if (s === -1) return [];
    const months: { label: string; total: number }[] = [];
    for (let i = s; i < s + 12 && i < monthHeaders.length; i++) {
      const total = filteredData.reduce((t, r) => t + effectiveRev(r, i), 0);
      months.push({ label: monthHeaders[i], total });
    }
    const max = Math.max(...months.map(m => m.total), 1);
    return months.map(m => ({ ...m, pct: Math.round((m.total / max) * 100) }));
  }, [filteredData, monthHeaders, fiscalYear, revenueType]);

  const handleExportPNG = async () => {
    if (!insightsRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(insightsRef.current, { backgroundColor: '#f5f7fa', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.download = `Insights_${fiscalYear}_${new Date().toISOString().slice(0, 10)}.png`;
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
        {/* Filter bar: USD left, filters right, download icon aligned to filter row bottom */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {/* Currency — leftmost */}
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

          {/* Filters — right side */}
          {companyOptions.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Company:</Text>
              <Select size="small" allowClear placeholder="All" value={filterCompany}
                onChange={v => setFilterCompany(v ?? null)} options={companyOptions}
                style={{ minWidth: 130, fontSize: '11px' }} />
            </Space>
          )}
          {availableFYs.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>FY:</Text>
              <Select size="small" value={fiscalYear}
                onChange={v => setFiscalYear(v as string)}
                options={availableFYs.map(fy => ({ label: fy, value: fy }))}
                style={{ minWidth: 90, fontSize: '11px' }} />
            </Space>
          )}
          <Space size={4}>
            <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Type:</Text>
            <Segmented size="small" value={revenueType}
              onChange={v => setRevenueType(v as 'all' | 'booked' | 'anticipated')}
              options={[
                { label: 'All', value: 'all' },
                { label: <span style={{ color: '#52c41a', fontWeight: 500 }}>Booked</span>, value: 'booked' },
                { label: <span style={{ color: '#ff4d4f', fontWeight: 500 }}>Anticipated</span>, value: 'anticipated' },
              ]}
              style={{ fontSize: '11px' }} />
          </Space>

          {/* Download icon — aligned with filter row */}
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
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Annual Revenue ({currency})</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#FFA940', marginTop: 4 }}>{fmt(qData.grand)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Total Projects</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: 4 }}>{filteredData.length}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Monthly Breakdown — {fiscalYear}</h3>
            {revenueType !== 'all' && (
              <span style={{ fontSize: '11px', color: revenueType === 'anticipated' ? '#ff4d4f' : '#52c41a' }}>
                {revenueType === 'anticipated' ? '● Anticipated' : '● Booked'} only
              </span>
            )}
          </div>
          {/* No scroll — bars fill full width, labels rotated to fit */}
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
                        opacity: revenueType === 'anticipated' ? 0.85 : 1,
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
            {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
              <span key={q} style={{ fontSize: '11px', color: '#595959', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: qColors[i] }} />
                {q}
              </span>
            ))}
          </div>
        </Card>

        {/* YoY Comparison */}
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
                    <div style={{ fontSize: '11px', color: '#bfbfbf' }}>Total Revenue</div>
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

interface FinanceManagementProps {
  onNavigate?: (module: string) => void;
}

export function FinanceManagement({ onNavigate: _onNavigate }: FinanceManagementProps) {
  const [projectData, setProjectData] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'milestones',
      label: <span style={{ fontSize: '11px' }}><FileExcelOutlined /> Project Milestones</span>,
      children: (
        <div style={{ padding: '0 0 16px' }}>
          <ProjectList onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
        </div>
      ),
    },
    {
      key: 'insights',
      label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Insights</span>,
      children: <Insights data={projectData} monthHeaders={monthHeaders} />,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: 8 }}>
            <Tabs items={items} size="small" defaultActiveKey="milestones" style={{ padding: '0 16px' }} />
          </div>
        </Space>
      </div>
    </div>
  );
}
