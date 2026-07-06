import * as XLSX from 'xlsx';
import type { WorkSheet } from 'xlsx';
import type { ResourceRow } from '../../types/resource';

type ExcelRow = Record<string, string | undefined>;

export type UploadSkippedRow = {
  rowNum: number;
  reason: string;
  detail?: string;
};

export type ResourceUploadProcessResult = {
  totalRows: number;
  uploadedCount: number;
  newCount: number;
  updCount: number;
  skippedRows: UploadSkippedRow[];
  mergedRows: ResourceRow[];
};

function normalizeExcelDate(raw: unknown): string {
  if (!raw && raw !== 0) return '';
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '';
    const y = raw.getUTCFullYear();
    const m = String(raw.getUTCMonth() + 1).padStart(2, '0');
    const d = String(raw.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(raw).trim();
  if (!s) return '';
  const serial = Number(s);
  if (!isNaN(serial) && serial > 1000 && !/[-/]/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
    const y = d.getUTCFullYear();
    const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }
  const asUtc = new Date(`${s.replace(/\//g, '-')}T00:00:00Z`);
  if (!isNaN(asUtc.getTime())) {
    const y = asUtc.getUTCFullYear();
    const mo = String(asUtc.getUTCMonth() + 1).padStart(2, '0');
    const dy = String(asUtc.getUTCDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }
  return s;
}

export function getMissingRequiredHeaders(worksheet: WorkSheet, requiredHeaders: string[]): string[] {
  const headerRow: string[] = (XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [];
  const uploadedHeaders = headerRow.map((h: string) => String(h || '').trim());
  return requiredHeaders.filter(h => !uploadedHeaders.includes(h));
}

export function processResourceUploadWorksheet(worksheet: WorkSheet, currentResources: ResourceRow[]): ResourceUploadProcessResult {
  const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
  if (!jsonData.length) {
    throw new Error('No data found in file');
  }

  const headerRow: string[] = ((XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[]) || [])
    .map((value) => String(value || '').trim());
  const hasEngagementStartDateColumn = ['Engagement Start Date', 'Eng Start Date'].some((header) => headerRow.includes(header));
  const hasEngagementEndDateColumn = ['Engagement End Date', 'Eng End Date'].some((header) => headerRow.includes(header));

  const totalRows = jsonData.length;
  const skippedRows: UploadSkippedRow[] = [];
  const raIdCountInFile = new Map<string, number[]>();

  jsonData.forEach((row, idx) => {
    const raId = String(row['RA ID'] || row['Ra ID'] || '').trim().toLowerCase();
    if (!raId) return;
    const arr = raIdCountInFile.get(raId) || [];
    arr.push(idx + 2);
    raIdCountInFile.set(raId, arr);
  });

  const uploaded: ResourceRow[] = [];
  const seenRaIds = new Set<string>();

  jsonData.forEach((row, idx) => {
    const rowNum = idx + 2;
    const raId = String(row['RA ID'] || row['Ra ID'] || '').trim();
    const empName = String(row['Employee Name'] || row['Emp Name'] || '').trim();
    const totalWorkexRaw = String(row['Total Workex (Yr)'] || row['Total Workex'] || row['Total Experience'] || '').trim();

    if (!raId) {
      skippedRows.push({ rowNum, reason: 'Missing RA ID', detail: empName ? `Employee: ${empName}` : undefined });
      return;
    }
    if (seenRaIds.has(raId.toLowerCase())) {
      const dupeRows = raIdCountInFile.get(raId.toLowerCase()) || [];
      skippedRows.push({ rowNum, reason: 'Duplicate RA ID in file', detail: `RA ID: ${raId} — also appears at row(s): ${dupeRows.filter(r => r !== rowNum).join(', ')}` });
      return;
    }
    seenRaIds.add(raId.toLowerCase());

    if (totalWorkexRaw) {
      const parsed = parseFloat(totalWorkexRaw.replace(/[^\d.-]/g, ''));
      if (!isNaN(parsed) && parsed > 70) {
        skippedRows.push({ rowNum, reason: `Invalid Total Workex (${parsed} years > 70 years max)`, detail: `RA ID: ${raId}, Employee: ${empName}` });
        return;
      }
    }

    uploaded.push({
      key: String(raId),
      sno: String(row['S.NO'] || idx + 1),
      raId,
      empName,
      emailId: String(row['Email'] || row['Email Id'] || row['Email ID'] || '').trim(),
      piwRole: String(row['PIW Role'] || row['Role'] || '').trim(),
      roleOrDomain: String(row['Role/Domain'] || row['Domain'] || '').trim(),
      previousWorkex: (() => {
        const raw = String(row['Previous Workex (Yr)'] || row['Previous Workex'] || row['Prev Workex'] || '').trim();
        // strip any trailing "years" text, keep numeric value only
        return raw.replace(/\s*years?\s*/gi, '').trim();
      })(),
      doj: normalizeExcelDate(row['DOJ'] ?? row['Date of Joining']),
      totalWorkex: totalWorkexRaw.replace(/\s*years?\s*/gi, '').trim(),
      skills: String(row['Skills'] || '').trim(),
      engagement: String(row['Current Engagement'] || row['Engagement'] || '').trim(),
      engagementStartDate: normalizeExcelDate(row['Engagement Start Date'] ?? row['Eng Start Date']),
      engagementEndDate: normalizeExcelDate(row['Engagement End Date'] ?? row['Eng End Date']),
      allocationPercentage: (() => {
        const raw = String(row['Allocation %'] || row['Allocation Percentage'] || '').trim().replace('%', '');
        if (!raw) return null;
        const n = parseFloat(raw);
        return isNaN(n) ? null : Math.min(200, Math.max(0, n));
      })(),
      allocationStatus: (() => {
        const eng = String(row['Current Engagement'] || row['Engagement'] || '').trim();
        if (eng.toLowerCase() === 'bench') return 'Available';
        const explicitStatus = String(row['Allocation Status'] || '').trim();
        if (explicitStatus) return explicitStatus;
        if (eng) return 'Joined';
        return 'Available';
      })(),
    });
  });

  const existingMap = new Map(currentResources.map(r => [r.raId.toLowerCase(), r]));
  let newCount = 0;
  let updCount = 0;

  uploaded.forEach(u => {
    const key = u.raId.toLowerCase();
    if (existingMap.has(key)) {
      const existing = existingMap.get(key)!;
      const patch: Partial<ResourceRow> = {};
      if (u.empName) patch.empName = u.empName;
      if (u.emailId) patch.emailId = u.emailId;
      if (u.piwRole) patch.piwRole = u.piwRole;
      if (u.roleOrDomain) patch.roleOrDomain = u.roleOrDomain;
      if (u.previousWorkex) patch.previousWorkex = u.previousWorkex;
      if (u.doj) patch.doj = u.doj;
      if (u.totalWorkex) patch.totalWorkex = u.totalWorkex;
      if (u.engagement !== undefined && u.engagement !== '') patch.engagement = u.engagement;
      if (hasEngagementStartDateColumn) patch.engagementStartDate = u.engagementStartDate || '';
      if (hasEngagementEndDateColumn) patch.engagementEndDate = u.engagementEndDate || '';
      if (u.allocationPercentage != null) patch.allocationPercentage = u.allocationPercentage;

      if (u.engagement.toLowerCase() === 'bench') {
        patch.allocationStatus = 'Available';
      } else if (u.allocationStatus && u.allocationStatus !== 'Available') {
        patch.allocationStatus = u.allocationStatus;
      } else if (u.allocationStatus === 'Available' && u.engagement.toLowerCase() === 'bench') {
        patch.allocationStatus = 'Available';
      }

      if (u.skills) {
        const existingSkills = existing.skills ? existing.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        const toAdd = u.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
        patch.skills = Array.from(new Set([...existingSkills, ...toAdd])).join(', ');
      }
      existingMap.set(key, { ...existing, ...patch });
      updCount++;
    } else {
      existingMap.set(key, u);
      newCount++;
    }
  });

  const mergedRows = Array.from(existingMap.values()).map((r, i) => ({ ...r, sno: String(i + 1) }));
  return { totalRows, uploadedCount: uploaded.length, newCount, updCount, skippedRows, mergedRows };
}

export function toBulkSavePayload(rows: ResourceRow[]) {
  return rows.map(r => ({
    raId: r.raId,
    sno: Number(r.sno),
    empName: r.empName,
    emailId: r.emailId,
    piwRole: r.piwRole,
    roleOrDomain: r.roleOrDomain,
    previousWorkex: r.previousWorkex,
    doj: r.doj,
    totalWorkex: r.totalWorkex,
    engagement: r.engagement || '',
    skills: r.skills,
    allocationStatus: r.allocationStatus || '',
    engagementStartDate: r.engagementStartDate || '',
    engagementEndDate: r.engagementEndDate || '',
    allocationPercentage: r.allocationPercentage != null ? r.allocationPercentage : null,
  }));
}
