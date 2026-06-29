import type { ResourcePayload } from '../../api/resourceApi';
import type { ResourceRow } from '../../types/resource';

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
    engagement: toText(row.engagement),
    skills: toText(row.skills),
    allocationStatus: toText(row.allocation_status ?? row.allocationStatus),
    allocationPercentage: toOptionalNumberOrNull(row.allocation_percentage ?? row.allocationPercentage),
    beelineId: toText(row.beeline_id ?? row.beelineId),
    processId: toOptionalNumber(row.process_id ?? row.processId) ?? null,
    engagementStartDate: toText(row.engagement_start_date ?? row.engagementStartDate),
    engagementEndDate: toText(row.engagement_end_date ?? row.engagementEndDate),
    sowName: toText(row.sow_name ?? row.sowName),
  };
}

export function mapResourceApiRowToResourceRow(row: any, index: number): ResourceRow {
  const payload = mapResourceApiRowToPayload(row);
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
    engagement: payload.engagement,
    allocationStatus: payload.allocationStatus,
    allocationPercentage: payload.allocationPercentage,
    beelineId: payload.beelineId,
    engagementStartDate: payload.engagementStartDate,
    engagementEndDate: payload.engagementEndDate,
    sowName: payload.sowName,
  };
}
