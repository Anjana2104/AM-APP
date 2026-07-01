'use strict';

/**
 * finance/helpers.js
 *
 * Shared utility functions for Finance routes.
 * Used by projects.js, revenue.js, and bookings.js.
 */

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns a numeric sort key for a month label like "Jan'24" or "Jan 2024".
 */
function monthSortKey(m) {
  const match = m.match(/([A-Za-z]{3})['''`]?(\d{2,4})/);
  if (!match) return 0;
  const yr = match[2].length === 2 ? 2000 + parseInt(match[2], 10) : parseInt(match[2], 10);
  const mo = MONTH_ORDER.indexOf(match[1]);
  return yr * 100 + mo;
}

/**
 * Normalises raw booking input from request body into a clean typed object.
 */
function normalizeBookingInput(raw = {}) {
  return {
    milestone_month: String(raw.milestone_month || '').trim(),
    booking_month:   String(raw.booking_month || '').trim(),
    amount:          Number(raw.amount),
    notes:           raw.notes == null ? '' : String(raw.notes),
    created_by:      raw.created_by == null ? 'system' : String(raw.created_by),
    booking_type:    String(raw.booking_type || '').trim().toLowerCase() === 'anticipated'
                       ? 'anticipated' : 'fixed',
  };
}

/**
 * Validates a normalised booking object. Returns an array of error strings.
 * @param {object} input - normalised booking
 * @param {string} rowLabel - e.g. "Row 1" for batch error messages
 */
function validateBookingInput(input, rowLabel) {
  const issues = [];
  if (!input.milestone_month || !input.booking_month || Number.isNaN(input.amount)) {
    issues.push(`${rowLabel}: milestone_month, booking_month, and numeric amount are required`);
    return issues;
  }
  if (input.amount <= 0) {
    issues.push(`${rowLabel}: amount must be a positive number`);
  }
  return issues;
}

/**
 * Inserts a single booking row using the provided run function.
 * @param {Function} run - db.run or transaction run
 * @param {number} projectId
 * @param {object} booking - normalised booking
 * @param {string} createdAt - ISO timestamp
 */
function insertBooking(run, projectId, booking, createdAt) {
  run(
    `INSERT INTO project_bookings
       (project_id, milestone_month, booking_month, amount, notes, created_by, booking_type, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [projectId, booking.milestone_month, booking.booking_month, booking.amount,
     booking.notes, booking.created_by, booking.booking_type, createdAt]
  );
}

/**
 * Formats a booking record as a readable audit trail string.
 */
function formatBookingAuditValue(booking) {
  const amount = Number(booking.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const notes  = (booking.notes || '').trim();
  return [
    `Milestone: ${booking.milestone_month}`,
    `Booked In: ${booking.booking_month}`,
    `Type: ${booking.booking_type === 'anticipated' ? 'Anticipated' : 'Fixed'}`,
    `Amount: ${amount}`,
    `Notes: ${notes || '-'}`,
  ].join(' | ');
}

/**
 * Inserts a finance audit log entry.
 * @param {Function} run - db.run or transaction run
 * @param {object} opts
 * @param {number|string} opts.recordId
 * @param {string}        opts.recordName
 * @param {string}        opts.field
 * @param {string}        [opts.oldValue]
 * @param {string}        [opts.newValue]
 * @param {string}        [opts.changedBy]
 * @param {string}        [opts.changedAt]
 */
function insertFinanceAudit(run, {
  recordId,
  recordName,
  field,
  oldValue  = '',
  newValue  = '',
  changedBy = 'system',
  changedAt = new Date().toISOString(),
}) {
  run(
    `INSERT INTO audit_log
       (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    ['finance', recordId, recordName || '', field, oldValue, newValue, changedBy, changedAt]
  );
}

/**
 * Builds the display name for a project: "CODE - Name" or just "Name".
 * @param {object|null} project - row from finance_projects
 * @param {number|string} fallbackId
 */
function projectRecordName(project, fallbackId) {
  if (!project) return `Project ${fallbackId}`;
  const prefix = project.code ? `${project.code} - ` : '';
  return `${prefix}${project.project || ''}`.trim() || `Project ${fallbackId}`;
}

/**
 * Writes audit log rows for all changed scalar fields of a finance project.
 * @param {object} db
 * @param {number} projectId
 * @param {object} existing  - old DB row
 * @param {object} incoming  - new values (only defined keys are checked)
 * @param {string} changedBy
 * @param {string} changedAt
 * @returns {object} changedValues map (field → newValue)
 */
function auditProjectFieldChanges(db, projectId, existing, incoming, changedBy, changedAt) {
  const TRACKED = ['project', 'company', 'code', 'space', 'owner'];
  const changedValues = {};
  const run = db.run.bind(db);

  for (const field of TRACKED) {
    if (incoming[field] === undefined) continue;
    const oldVal = existing[field] !== undefined ? String(existing[field]) : '';
    const newVal = String(incoming[field] ?? '');
    if (oldVal !== newVal) {
      insertFinanceAudit(run, {
        recordId: projectId, recordName: existing.project || '',
        field, oldValue: oldVal, newValue: newVal, changedBy, changedAt,
      });
      changedValues[field] = incoming[field];
    }
  }

  // Status
  if (incoming.statusVal !== undefined && (existing.status || '') !== incoming.statusVal) {
    insertFinanceAudit(run, {
      recordId: projectId, recordName: existing.project || '',
      field: 'status', oldValue: existing.status || '', newValue: incoming.statusVal, changedBy, changedAt,
    });
    changedValues.status = incoming.statusVal;
  }

  // Comments (tracked in changedValues but no separate audit entry — covered by full project edit)
  if (incoming.comments !== undefined) {
    const oldComments = existing.comments !== undefined ? String(existing.comments ?? '') : '';
    if (String(incoming.comments ?? '') !== oldComments) {
      changedValues.comments = incoming.comments;
    }
  }

  return changedValues;
}

module.exports = {
  MONTH_ORDER,
  monthSortKey,
  normalizeBookingInput,
  validateBookingInput,
  insertBooking,
  formatBookingAuditValue,
  insertFinanceAudit,
  projectRecordName,
  auditProjectFieldChanges,
};
