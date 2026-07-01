import * as XLSX from 'xlsx';
import { writeJsonSheetFile } from '../../utils/xlsxExport';

export const inr = (n: number) =>
  n ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}` : '—';

export const usd = (n: number) =>
  n ? `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

export function parseINR(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/₹|,/g, '').trim();
  const num = Number(cleaned);
  return isFinite(num) ? num : 0;
}

export const deriveCode = (name: string) => name.split(' - ')[0].trim() || name;

export const MONTH_ORDER = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

export function getMonthFY(label: string): { fy: number; pos: number } | null {
  const m = label.trim().match(/^([A-Za-z]{3})[''`](\d{2})$/);
  if (!m) return null;
  const pos = MONTH_ORDER.indexOf(m[1]);
  if (pos === -1) return null;
  const yr = 2000 + parseInt(m[2]);
  return { fy: pos < 3 ? yr + 1 : yr, pos };
}

export function fyMonthLabel(fyNum: number, pos: number): string {
  const mName = MONTH_ORDER[pos];
  const yr = pos < 3 ? fyNum - 1 : fyNum;
  return `${mName}'${String(yr % 100).padStart(2, '0')}`;
}

export function downloadTemplate() {
  const headers = [
    'OA Project Code', 'Company',
    "Oct'25", "Nov'25", "Dec'25",
    "Jan'26", "Feb'26", "Mar'26", "Apr'26", "May'26", "Jun'26",
    "Jul'26", "Aug'26", "Sep'26",
    "Oct'26", "Nov'26", "Dec'26",
    "Jan'27", "Feb'27", "Mar'27", "Apr'27", "May'27", "Jun'27",
    "Jul'27", "Aug'27", "Sep'27",
  ];
  const rows = Array.from({ length: 5 }).map(() => {
    const row: any = {};
    headers.forEach(h => (row[h] = ''));
    return row;
  });
  writeJsonSheetFile(XLSX, rows, 'FY26-FY27 Invoices', 'FY26_FY27_Invoice_Template.xlsx', { header: headers });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function formatCommentDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${ordinal(date.getDate())} ${months[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}
