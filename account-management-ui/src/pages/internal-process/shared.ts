import * as XLSX from 'xlsx';
import type { ProcessRow } from './types';
import { writeJsonSheetFile } from '../../utils/xlsxExport';

export const RATE_BANDS = [
  { maxYears: 3, c_inr: 14769, s_inr: 16000, c_usd: 192, s_usd: 208 },
  { maxYears: 5, c_inr: 18462, s_inr: 21538, c_usd: 240, s_usd: 280 },
  { maxYears: 8, c_inr: 22769, s_inr: 24615, c_usd: 296, s_usd: 320 },
  { maxYears: 10, c_inr: 27692, s_inr: 30769, c_usd: 360, s_usd: 400 },
  { maxYears: Infinity, c_inr: 30769, s_inr: 36923, c_usd: 400, s_usd: 480 },
];

export const STATUS_COLORS: Record<string, string> = {
  Completed: '#52c41a',
  'In Progress': '#1890ff',
  'Not Started': '#8c8c8c',
};

export const ACTIVE_OPTIONS = ['Yes', 'No'];
export const SIGNED_SOW_OPTIONS = ['Yes', 'No'];
export const TEMPLATE_COLS = ['S.No.', 'Start Date', 'SOW', 'Signed SOW', 'PIW', 'Active', 'Salesforce ID', 'PROMS ID', 'Budget', 'Open Air Code', 'Comments'];
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const COL_KEYS: { key: keyof ProcessRow; label: string }[] = [
  { key: 'sno', label: 'S.No.' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'sow', label: 'SOW' },
  { key: 'signedSow', label: 'Signed SOW' },
  { key: 'piw', label: 'PIW' },
  { key: 'active', label: 'Active' },
  { key: 'salesforceId', label: 'Salesforce ID' },
  { key: 'promsId', label: 'PROMS ID' },
  { key: 'budget', label: 'Budget (INR)' },
  { key: 'eprev', label: 'Eprev' },
  { key: 'openAirCode', label: 'Open Air Code' },
  { key: 'comments', label: 'Comments' },
  { key: 'accountAnchor', label: 'Owner' },
];

export const PIPELINE_STAGES = [
  { key: 'sow', label: 'SOW', desc: 'Statement of Work received', field: (row: ProcessRow) => row.sow },
  { key: 'signed', label: 'Signed SOW', desc: 'SOW signed by RA', field: (row: ProcessRow) => (row.signedSow === 'Yes' ? 'Yes' : '') },
  { key: 'piw', label: 'PIW', desc: 'Person in Waiting created', field: (row: ProcessRow) => row.piw },
  { key: 'sf', label: 'SF Opportunity', desc: 'Salesforce ID created', field: (row: ProcessRow) => row.salesforceId },
  { key: 'proms', label: 'PROMS / Budget', desc: 'PROMS ID + Budget set', field: (row: ProcessRow) => row.promsId || row.budget },
  { key: 'openair', label: 'Open Air Code', desc: 'Final OA code assigned', field: (row: ProcessRow) => row.openAirCode },
  { key: 'eprev', label: 'Eprev', desc: 'E-Preview completed', field: (row: ProcessRow) => (row.eprev === 'Yes' ? 'Yes' : '') },
];

export const STAGE_COLORS = ['#1890ff', '#13c2c2', '#722ed1', '#fa8c16', '#eb2f96', '#a0d911', '#52c41a'];

export function parseWorkexToYears(totalWorkex: string): number {
  const yr = totalWorkex?.match(/(\d[\d.]*)\s*[Yy]r|(\d[\d.]*)\s*[Yy]ear/);
  const mo = totalWorkex?.match(/(\d[\d.]*)\s*[Mm]o|(\d[\d.]*)\s*[Mm]onth/);
  const years = yr ? parseFloat(yr[1] ?? yr[2]) : 0;
  const months = mo ? parseFloat(mo[1] ?? mo[2]) : 0;
  return years + months / 12;
}

export function lookupDailyRate(totalWorkex: string, skillType: string = 'Commodity', currency: string = 'INR'): number {
  const years = parseWorkexToYears(totalWorkex);
  const band = RATE_BANDS.find(item => years < item.maxYears) ?? RATE_BANDS[RATE_BANDS.length - 1];
  const specialized = skillType === 'Specialized';
  return currency === 'USD' ? (specialized ? band.s_usd : band.c_usd) : (specialized ? band.s_inr : band.c_inr);
}

export function deriveStatus(row: ProcessRow): 'Not Started' | 'In Progress' | 'Completed' {
  if (row.openAirCode?.trim() || row.eprev?.trim() === 'Yes') return 'Completed';
  if (row.signedSow?.trim() === 'Yes' || row.piw?.trim() || row.salesforceId?.trim() || row.promsId?.trim() || row.budget?.trim()) return 'In Progress';
  return 'Not Started';
}

export function formatExcelDate(value: any): string {
  if (!value && value !== 0) return '';
  if (value instanceof Date) {
    const day = value.getUTCDate().toString().padStart(2, '0');
    const month = MONTH_NAMES[value.getUTCMonth()];
    const year = value.getUTCFullYear().toString().slice(2);
    return `${day}-${month}-${year}`;
  }
  return String(value).trim();
}

export function todayDateStr(): string {
  const now = new Date();
  const day = now.getDate().toString().padStart(2, '0');
  const month = MONTH_NAMES[now.getMonth()];
  const year = now.getFullYear().toString().slice(2);
  return `${day}-${month}-${year}`;
}

export function dateSortKey(dateStr: string): number {
  if (!dateStr?.trim()) return 0;
  const match = dateStr.match(/(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = MONTH_NAMES.indexOf(match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase());
    const year = match[3].length === 2 ? 2000 + parseInt(match[3], 10) : parseInt(match[3], 10);
    if (month === -1) return 0;
    return year * 10000 + (month + 1) * 100 + day;
  }
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) return parsed.getFullYear() * 10000 + (parsed.getMonth() + 1) * 100 + parsed.getDate();
  return 0;
}

export function recencySortKey(row: Pick<ProcessRow, 'updatedAt' | 'createdAt'>): number {
  const parsed = Date.parse(row.updatedAt || row.createdAt || '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadTemplate() {
  const sample = [
    { 'S.No.': 1, 'Start Date': '03-Jan-26', SOW: 'T1-UCB_US_Tech-Resource_Allocation-2026-CR1', 'Signed SOW': 'No', PIW: '', Active: 'Yes', 'Salesforce ID': '', 'PROMS ID': '', Budget: '', 'Open Air Code': '', Comments: '' },
    { 'S.No.': 2, 'Start Date': '04-Jan-26', SOW: 'T2-RWD Resource Allocation - 2026 CR1', 'Signed SOW': 'Yes', PIW: 'PIW - RWD Resource Allocation - 2026 CR1', Active: 'Yes', 'Salesforce ID': '006Pg00000v6cBRIAY', 'PROMS ID': '30605955.1', Budget: '36,96,000.00', 'Open Air Code': 'ZSUS0341 - Next Gen Operations Support 2026', Comments: '' },
  ];
  writeJsonSheetFile(XLSX, sample, 'Process', 'RA_Process_Template.xlsx', { header: TEMPLATE_COLS });
}

export function toInputDate(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = new Date(dateStr);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return '';
}
