'use strict';

// Field map: DB column ? JS camelCase key
const FIELD_MAP = {
  emp_name: 'empName', email_id: 'emailId', piw_role: 'piwRole',
  role_or_domain: 'roleOrDomain', previous_workex: 'previousWorkex', doj: 'doj',
  total_workex: 'totalWorkex', engagement: 'engagement', skills: 'skills',
  allocation_status: 'allocationStatus', is_active: 'isActive',
  allocation_percentage: 'allocationPercentage',
  allocation_entries: 'allocationEntries',
  engagement_start_date: 'engagementStartDate',
  engagement_end_date: 'engagementEndDate',
};
const LABEL_MAP = {
  empName: 'Employee Name', emailId: 'Email', piwRole: 'PIW Role',
  roleOrDomain: 'Role/Domain', previousWorkex: 'Previous Workex', doj: 'DOJ',
  totalWorkex: 'Total Workex', engagement: 'Engagement', skills: 'Skills',
  allocationStatus: 'Allocation Status', isActive: 'Resource Status',
  allocationPercentage: 'Allocation %',
  allocationEntries: 'Allocation Entries',
  engagementStartDate: 'Engagement Start Date',
  engagementEndDate: 'Engagement End Date',
};

function normalizeEngagementNameKey(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeAllocationEntries(rawEntries) {
  if (!Array.isArray(rawEntries)) return [];
  const cleaned = rawEntries
    .map((entry) => {
      const parsedAllocation = Number(entry?.allocationPercentage || 0);
      const allocationPercentage = Number.isFinite(parsedAllocation)
        ? Math.max(0, Math.min(200, parsedAllocation))
        : 0;
      return {
        engagementName: String(entry?.engagementName || '').trim(),
        allocationPercentage,
        engagementStartDate: String(entry?.engagementStartDate || '').trim(),
        engagementEndDate: String(entry?.engagementEndDate || '').trim(),
        allocationStatus: String(entry?.allocationStatus || '').trim(),
        beelineId: String(entry?.beelineId || '').trim(),
      };
    })
    .filter((entry) => entry.engagementName || entry.allocationPercentage > 0);

  const merged = [];
  const indexByKey = new Map();
  cleaned.forEach((entry) => {
    const key = normalizeEngagementNameKey(entry.engagementName);
    if (!key) { merged.push(entry); return; }
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, merged.length);
      merged.push(entry);
      return;
    }
    const existing = merged[existingIndex];
    merged[existingIndex] = {
      engagementName: entry.engagementName || existing.engagementName,
      allocationPercentage: entry.allocationPercentage,
      engagementStartDate: entry.engagementStartDate || existing.engagementStartDate,
      engagementEndDate: entry.engagementEndDate || existing.engagementEndDate,
      allocationStatus: entry.allocationStatus || existing.allocationStatus,
      beelineId: entry.beelineId || existing.beelineId,
    };
  });
  return merged;
}

function inferAllocationEntries(resourceLike, existing) {
  const explicit = normalizeAllocationEntries(resourceLike?.allocationEntries);
  if (explicit.length > 0) return explicit;

  const engagementName = String((resourceLike?.engagement ?? existing?.engagement) || '').trim();
  const allocationPercentageSource = resourceLike?.allocationPercentage !== undefined
    ? resourceLike?.allocationPercentage
    : existing?.allocation_percentage;
  const allocationPercentage = allocationPercentageSource == null
    ? null
    : Math.max(0, Math.min(200, Number(allocationPercentageSource)));
  if (!engagementName && (allocationPercentage == null || allocationPercentage <= 0)) return [];
  return [{
    engagementName,
    allocationPercentage: allocationPercentage ?? 0,
    engagementStartDate: String((resourceLike?.engagementStartDate ?? existing?.engagement_start_date) || '').trim(),
    engagementEndDate: String((resourceLike?.engagementEndDate ?? existing?.engagement_end_date) || '').trim(),
    allocationStatus: String((resourceLike?.allocationStatus ?? existing?.allocation_status) || '').trim(),
    beelineId: String((resourceLike?.beelineId ?? existing?.beeline_id) || '').trim(),
  }];
}

function totalAllocationFromEntries(entries, fallbackValue) {
  if (entries.length > 0) {
    const total = entries.reduce((sum, entry) => sum + Number(entry.allocationPercentage || 0), 0);
    return Math.round(total * 100) / 100;
  }
  if (fallbackValue === null) return null;
  if (fallbackValue === undefined) return null;
  const parsed = Number(fallbackValue);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(200, parsed));
}

function resolveAllocationStatus(resourceLike, existingStatus) {
  if (resourceLike?.allocationStatus !== undefined) {
    return String(resourceLike.allocationStatus || '').trim();
  }

  const engagementName = String(resourceLike?.engagement || '').trim().toLowerCase();
  if (!engagementName || engagementName === 'bench') {
    return 'Available';
  }

  const currentStatus = String(existingStatus || '').trim();
  return currentStatus || 'Available';
}

/**
 * Update one resource row and write audit log entries for changed fields.
 * Uses the db connection that's already open.
 * Returns { ok, notFound } â€” never throws.
 */
function updateOneWithAudit(db, id, r, changedBy) {
  const existing = db.get("SELECT * FROM resources WHERE id=?", [parseInt(id, 10)]);
  if (!existing) return { ok: false, notFound: true };
  const allocationEntries = inferAllocationEntries(r, existing);
  const totalAllocation = totalAllocationFromEntries(allocationEntries, r.allocationPercentage !== undefined ? r.allocationPercentage : existing.allocation_percentage);
  const updatedAllocStatus = resolveAllocationStatus(r, existing.allocation_status || '');
  const existingIsActive = Number(existing.is_active) !== 0;
  const isActiveProvided = r.isActive !== undefined;
  const normalizedIsActive = r.isActive === true
    || r.isActive === 1
    || r.isActive === '1'
    || String(r.isActive).toLowerCase() === 'true';
  const updatedIsActive = isActiveProvided ? (normalizedIsActive ? 1 : 0) : (existingIsActive ? 1 : 0);

  db.run(
    `UPDATE resources SET emp_name=?, email_id=?, piw_role=?, role_or_domain=?,
     previous_workex=?, doj=?, total_workex=?, engagement=?, skills=?,
     allocation_status=?, is_active=?, allocation_percentage=?, allocation_entries=?,
     engagement_start_date=?, engagement_end_date=?, updated_at=? WHERE id=?`,
    [r.empName || existing.emp_name, r.emailId || existing.email_id,
     r.piwRole || existing.piw_role, r.roleOrDomain || existing.role_or_domain,
     r.previousWorkex || existing.previous_workex, r.doj || existing.doj,
     r.totalWorkex || existing.total_workex,
     r.engagement !== undefined ? r.engagement : (existing.engagement || ''),
     r.skills !== undefined ? r.skills : (existing.skills || ''),
     updatedAllocStatus,
     updatedIsActive,
     totalAllocation,
     JSON.stringify(allocationEntries),
     r.engagementStartDate !== undefined ? r.engagementStartDate : (existing.engagement_start_date || ''),
     r.engagementEndDate !== undefined ? r.engagementEndDate : (existing.engagement_end_date || ''),
     new Date().toISOString(), parseInt(id, 10)]
  );

  const ts = new Date().toISOString();
  const recordName = `${existing.ra_id} - ${existing.emp_name}`;

  // Compute effective new values for diff
  const effectiveNew = {
    empName: r.empName !== undefined ? (r.empName || '') : (existing.emp_name || ''),
    emailId: r.emailId !== undefined ? (r.emailId || '') : (existing.email_id || ''),
    piwRole: r.piwRole !== undefined ? (r.piwRole || '') : (existing.piw_role || ''),
    roleOrDomain: r.roleOrDomain !== undefined ? (r.roleOrDomain || '') : (existing.role_or_domain || ''),
    previousWorkex: r.previousWorkex !== undefined ? (r.previousWorkex || '') : (existing.previous_workex || ''),
    doj: r.doj !== undefined ? (r.doj || '') : (existing.doj || ''),
    totalWorkex: r.totalWorkex !== undefined ? (r.totalWorkex || '') : (existing.total_workex || ''),
    engagement: r.engagement !== undefined ? (r.engagement || '') : (existing.engagement || ''),
    skills: r.skills !== undefined ? (r.skills || '') : (existing.skills || ''),
    allocationStatus: updatedAllocStatus,
    isActive: updatedIsActive ? '1' : '0',
    allocationPercentage: String(totalAllocation ?? ''),
    allocationEntries: JSON.stringify(allocationEntries),
    engagementStartDate: r.engagementStartDate !== undefined ? (r.engagementStartDate || '') : (existing.engagement_start_date || ''),
    engagementEndDate: r.engagementEndDate !== undefined ? (r.engagementEndDate || '') : (existing.engagement_end_date || ''),
  };

  for (const [dbCol, jsKey] of Object.entries(FIELD_MAP)) {
    const oldVal = String(existing[dbCol] || '');
    const newVal = String(effectiveNew[jsKey] || '');
    if (oldVal !== newVal) {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        ['resources', parseInt(id, 10), recordName, LABEL_MAP[jsKey] || jsKey, oldVal, newVal, changedBy, ts]
      );
    }
  }

  return { ok: true };
}

module.exports = {
  FIELD_MAP,
  LABEL_MAP,
  inferAllocationEntries,
  totalAllocationFromEntries,
  resolveAllocationStatus,
  updateOneWithAudit,
};

