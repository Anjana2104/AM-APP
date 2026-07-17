import * as XLSX from 'xlsx';
import type { WorkSheet } from 'xlsx';
import type { ResourceRow } from '../../types/resource';
import { deriveAllocationStatus, ensureAllocationEntries, totalAllocationPercentage } from '../../utils/resourceAllocationUtils';

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

  const totalRows = jsonData.length;
  const skippedRows: UploadSkippedRow[] = [];

  const uploaded: ResourceRow[] = [];

  jsonData.forEach((row, idx) => {
    const rowNum = idx + 2;
    const raId = String(row['RA ID'] || row['Ra ID'] || '').trim();
    const empName = String(row['Employee Name'] || row['Emp Name'] || '').trim();
    const totalWorkexRaw = String(row['Total Workex (Yr)'] || row['Total Workex'] || row['Total Experience'] || '').trim();

    if (!raId) {
      skippedRows.push({ rowNum, reason: 'Missing RA ID', detail: empName ? `Employee: ${empName}` : undefined });
      return;
    }

    if (totalWorkexRaw) {
      const parsed = parseFloat(totalWorkexRaw.replace(/[^\d.-]/g, ''));
      if (!isNaN(parsed) && parsed > 70) {
        skippedRows.push({ rowNum, reason: `Invalid Total Workex (${parsed} years > 70 years max)`, detail: `RA ID: ${raId}, Employee: ${empName}` });
        return;
      }
    }

    const engagementName = String(row['Current Engagement'] || row['Engagement'] || '').trim();
    const explicitStatus = String(row['Allocation Status'] || '').trim();
    const entryAllocationPct = (() => {
      const raw = String(row['Allocation %'] || row['Allocation Percentage'] || '').trim().replace('%', '');
      if (!raw) return null;
      const n = parseFloat(raw);
      return isNaN(n) ? null : Math.min(200, Math.max(0, n));
    })();
    const rowAllocationEntries = (engagementName || entryAllocationPct != null)
      ? [{
          engagementName,
          allocationPercentage: entryAllocationPct ?? 0,
          engagementStartDate: '',
          engagementEndDate: '',
          allocationStatus: explicitStatus,
        }]
      : [];

    const parsedRow: ResourceRow = {
      key: String(raId),
      sno: String(row['S.NO'] || idx + 1),
      raId,
      empName,
      emailId: String(row['Email'] || row['Email Id'] || row['Email ID'] || '').trim(),
      piwRole: String(row['PIW Role'] || row['Role'] || '').trim(),
      roleOrDomain: String(row['Roles/Domains'] || row['Role/Domain'] || row['Domain'] || '').trim(),
      previousWorkex: (() => {
        const raw = String(row['Previous Workex (Yr)'] || row['Previous Workex'] || row['Prev Workex'] || '').trim();
        // strip any trailing "years" text, keep numeric value only
        return raw.replace(/\s*years?\s*/gi, '').trim();
      })(),
      doj: normalizeExcelDate(row['DOJ'] ?? row['Date of Joining']),
      totalWorkex: totalWorkexRaw.replace(/\s*years?\s*/gi, '').trim(),
      skills: String(row['Skills'] || '').trim(),
      engagement: '',
      engagementStartDate: '',
      engagementEndDate: '',
      allocationPercentage: rowAllocationEntries.length > 0 ? totalAllocationPercentage(rowAllocationEntries) : null,
      allocationStatus: explicitStatus, // only set if upload row had explicit Allocation Status column
      allocationEntries: rowAllocationEntries,
    };

    const existingUploadedIndex = uploaded.findIndex((item) => item.raId.toLowerCase() === raId.toLowerCase());
    if (existingUploadedIndex === -1) {
      uploaded.push(parsedRow);
      return;
    }

    const existingUploaded = uploaded[existingUploadedIndex];
    const mergedSkills = Array.from(new Set([
      ...(existingUploaded.skills ? existingUploaded.skills.split(',').map((value) => value.trim()).filter(Boolean) : []),
      ...(parsedRow.skills ? parsedRow.skills.split(',').map((value) => value.trim()).filter(Boolean) : []),
    ])).join(', ');
    const mergedDomains = Array.from(new Set([
      ...(existingUploaded.roleOrDomain ? existingUploaded.roleOrDomain.split(',').map((value) => value.trim()).filter(Boolean) : []),
      ...(parsedRow.roleOrDomain ? parsedRow.roleOrDomain.split(',').map((value) => value.trim()).filter(Boolean) : []),
    ])).join(', ');
    const mergedEntries = ensureAllocationEntries({
      ...existingUploaded,
      allocationEntries: [
        ...(existingUploaded.allocationEntries || []),
        ...(parsedRow.allocationEntries || []),
      ],
    });

    uploaded[existingUploadedIndex] = {
      ...existingUploaded,
      empName: parsedRow.empName || existingUploaded.empName,
      emailId: parsedRow.emailId || existingUploaded.emailId,
      piwRole: parsedRow.piwRole || existingUploaded.piwRole,
      previousWorkex: parsedRow.previousWorkex || existingUploaded.previousWorkex,
      doj: parsedRow.doj || existingUploaded.doj,
      totalWorkex: parsedRow.totalWorkex || existingUploaded.totalWorkex,
      skills: mergedSkills,
      roleOrDomain: mergedDomains,
      engagement: '',
      engagementStartDate: '',
      engagementEndDate: '',
      allocationStatus: parsedRow.allocationStatus || deriveAllocationStatus(mergedEntries, existingUploaded.allocationStatus),
      allocationEntries: mergedEntries,
      allocationPercentage: mergedEntries.length > 0
        ? totalAllocationPercentage(mergedEntries)
        : (parsedRow.allocationPercentage ?? existingUploaded.allocationPercentage ?? null),
    };
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
    if (u.previousWorkex) patch.previousWorkex = u.previousWorkex;
    if (u.doj) patch.doj = u.doj;
    if (u.totalWorkex) patch.totalWorkex = u.totalWorkex;
    if (u.allocationPercentage != null) patch.allocationPercentage = u.allocationPercentage;
    if (u.allocationEntries) {
      const mergedEntries = ensureAllocationEntries({
        ...existing,
        allocationEntries: [
          ...(existing.allocationEntries || []),
          ...u.allocationEntries,
        ],
      });
      patch.allocationEntries = mergedEntries;
      patch.allocationPercentage = totalAllocationPercentage(mergedEntries);
    }

    const mergedForStatus = patch.allocationEntries || existing.allocationEntries || [];
    patch.allocationStatus = u.allocationStatus || deriveAllocationStatus(mergedForStatus, existing.allocationStatus);

    // Append skills (merge with existing)
      if (u.skills) {
        const existingSkills = existing.skills ? existing.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        const toAdd = u.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
        patch.skills = Array.from(new Set([...existingSkills, ...toAdd])).join(', ');
      }

    // Append roles/domains (merge with existing) ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â like skills, supports multiple
    if (u.roleOrDomain) {
      const existingDomains = existing.roleOrDomain
        ? existing.roleOrDomain.split(',').map((d: string) => d.trim()).filter(Boolean)
        : [];
      const toAdd = u.roleOrDomain.split(',').map((d: string) => d.trim()).filter(Boolean);
      patch.roleOrDomain = Array.from(new Set([...existingDomains, ...toAdd])).join(', ');
    }

    existingMap.set(key, { ...existing, ...patch });
    updCount++;
  } else {
    existingMap.set(key, {
      ...u,
      allocationStatus: u.allocationStatus || deriveAllocationStatus(u.allocationEntries || []),
    });
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
    engagement: '',
    skills: r.skills,
    allocationStatus: r.allocationStatus || '',
    engagementStartDate: '',
    engagementEndDate: '',
    allocationPercentage: r.allocationPercentage != null ? r.allocationPercentage : null,
    allocationEntries: r.allocationEntries || [],
  }));
}
