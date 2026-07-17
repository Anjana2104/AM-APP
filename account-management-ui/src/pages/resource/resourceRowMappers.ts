import type { ResourcePayload } from '../../api/resourceApi';
import type { ResourceRow } from '../../types/resource';
import {
  ensureAllocationEntries,
  parseAllocationEntries,
  primaryAllocationEntry,
  totalAllocationPercentage,
} from '../../utils/resourceAllocationUtils';

function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapResourceApiRowToPayload(row: any): ResourcePayload {
  const parsedEntries = parseAllocationEntries(row.allocation_entries ?? row.allocationEntries);
  const primaryEntry = primaryAllocationEntry(parsedEntries);
  const totalPctFromEntries = parsedEntries.length > 0 ? totalAllocationPercentage(parsedEntries) : null;

  return {
    id: toOptionalNumber(row.id),
    sno: toOptionalNumber(row.sno),
    isActive: Number(row.is_active ?? row.isActive ?? 1) !== 0,
    raId: toText(row.ra_id ?? row.raId),
    empName: toText(row.emp_name ?? row.empName),
    emailId: toText(row.email_id ?? row.emailId),
    piwRole: toText(row.piw_role ?? row.piwRole),
    roleOrDomain: toText(row.role_or_domain ?? row.roleOrDomain),
    previousWorkex: toText(row.previous_workex ?? row.previousWorkex),
    doj: toText(row.doj),
    totalWorkex: toText(row.total_workex ?? row.totalWorkex),
    engagement: toText(row.engagement) || (primaryEntry?.engagementName || ''),
    skills: toText(row.skills),
    allocationStatus: toText(row.allocation_status ?? row.allocationStatus) || (primaryEntry?.allocationStatus || ''),
    allocationPercentage: totalPctFromEntries ?? toOptionalNumberOrNull(row.allocation_percentage ?? row.allocationPercentage),
    allocationEntries: parsedEntries,
    beelineId: toText(row.beeline_id ?? row.beelineId),
    processId: toOptionalNumber(row.process_id ?? row.processId) ?? null,
    engagementStartDate: toText(row.engagement_start_date ?? row.engagementStartDate) || (primaryEntry?.engagementStartDate || ''),
    engagementEndDate: toText(row.engagement_end_date ?? row.engagementEndDate) || (primaryEntry?.engagementEndDate || ''),
    sowName: toText(row.sow_name ?? row.sowName),
  };
}

export function mapResourceApiRowToResourceRow(row: any, index: number): ResourceRow {
  const payload = mapResourceApiRowToPayload(row);
  const normalizedEntries = ensureAllocationEntries(payload);
  const primaryEntry = primaryAllocationEntry(normalizedEntries);
  const totalPct = normalizedEntries.length > 0
    ? totalAllocationPercentage(normalizedEntries)
    : payload.allocationPercentage;
  return {
    key: payload.raId || String(index),
    id: payload.id,
    isActive: payload.isActive,
    sno: String(payload.sno ?? index + 1),
    raId: payload.raId,
    empName: payload.empName,
    emailId: payload.emailId,
    piwRole: payload.piwRole,
    roleOrDomain: payload.roleOrDomain,
    previousWorkex: payload.previousWorkex,
    doj: payload.doj,
    totalWorkex: payload.totalWorkex,
    skills: payload.skills,
    engagement: payload.engagement || (primaryEntry?.engagementName || ''),
    allocationStatus: payload.allocationStatus || (primaryEntry?.allocationStatus || ''),
    allocationPercentage: totalPct ?? null,
    allocationEntries: normalizedEntries,
    beelineId: payload.beelineId,
    processId: payload.processId,
    engagementStartDate: payload.engagementStartDate || (primaryEntry?.engagementStartDate || ''),
    engagementEndDate: payload.engagementEndDate || (primaryEntry?.engagementEndDate || ''),
    sowName: payload.sowName,
  };
}
