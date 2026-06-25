/**
 * server/utils/evaluateRules.js
 *
 * Scheduled Rule Evaluation Engine
 * Called by the server-side scheduler (setInterval) in index.js.
 *
 * Rule types:
 *   date_overdue    â€” fires when today >= record.date_field - lead_time_days
 *   field_threshold â€” fires when record.threshold_field {op} threshold_value
 *   field_equals    â€” fires when record.threshold_field {op} filter_value (text)
 *
 * Schedule types:
 *   daily   â€” once per calendar day
 *   monthly â€” on the Nth day of each month (schedule_day)
 *   weekly  â€” every Monday
 *
 * Deduplication via notification_rule_log: one entry per (rule, record, date).
 * Manual runs (force=true) bypass both schedule and dedup so admins can test.
 */
'use strict';

// â”€â”€ Source table / field metadata (mirrors UI constants) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SOURCE_FIELDS = {
  resources: [
    { value: 'engagement_end_date',   label: 'Engagement End Date',   type: 'date'   },
    { value: 'engagement_start_date', label: 'Engagement Start Date', type: 'date'   },
    { value: 'doj',                   label: 'Date of Joining',       type: 'date'   },
    { value: 'allocation_percentage', label: 'Allocation %',          type: 'number' },
    { value: 'allocation_status',     label: 'Allocation Status',     type: 'text'   },
    { value: 'role_or_domain',        label: 'Role / Domain',         type: 'text'   },
    { value: 'account_anchor',        label: 'Account Anchor',        type: 'text'   },
  ],
  client_requests: [
    { value: 'date_raised',        label: 'Date Raised',       type: 'date' },
    { value: 'processing_status',  label: 'Processing Status', type: 'text' },
    { value: 'overall_status',     label: 'Overall Status',    type: 'text' },
    { value: 'account_anchor',     label: 'Account Anchor',    type: 'text' },
  ],
  ra_process: [
    { value: 'start_date',     label: 'Start Date',     type: 'date' },
    { value: 'active',         label: 'Active Status',  type: 'text' },
    { value: 'account_anchor', label: 'Account Anchor', type: 'text' },
  ],
  finance_projects: [
    { value: 'status', label: 'Status', type: 'text' },
  ],
};
module.exports.SOURCE_FIELDS = SOURCE_FIELDS;

// Tables that have a soft-delete flag (is_active=0 means deleted)
const SOFT_DELETE_TABLES = new Set(['resources', 'client_requests']);

// â”€â”€ Schedule check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function shouldRunToday(rule, today) {
  if (!rule.last_run_at) return true; // never run â€” run immediately

  const lastRun  = new Date(rule.last_run_at);
  const todayStr = today.toISOString().slice(0, 10);

  if (rule.schedule_type === 'daily') {
    return lastRun.toISOString().slice(0, 10) !== todayStr;
  }

  if (rule.schedule_type === 'monthly') {
    const day = rule.schedule_day || 15;
    if (today.getDate() !== day) return false;
    return !(
      lastRun.getFullYear() === today.getFullYear() &&
      lastRun.getMonth()    === today.getMonth()    &&
      lastRun.getDate()     === day
    );
  }

  if (rule.schedule_type === 'weekly') {
    if (today.getDay() !== 1) return false; // only Mondays
    const daysDiff = Math.floor((today - lastRun) / 86400000);
    return daysDiff >= 7;
  }

  return false;
}

// â”€â”€ Condition matching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ─── Condition matching ─────────────────────────────────────────────────────────────────────

// Parse dates stored in various formats: ISO (YYYY-MM-DD), dd/mm/yyyy, mm/dd/yyyy
function parseFlexDate(val) {
  if (!val) return null;
  let d = new Date(val);
  if (!isNaN(d.getTime())) return d;
  // dd/mm/yyyy → try day-first when first segment > 12 (unambiguously the day)
  const parts = String(val).split('/');
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (parseInt(a) > 12) {
      // Definitely dd/mm/yyyy
      d = new Date(`${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`);
    } else {
      // Ambiguous — default to dd/mm/yyyy (common in non-US locales)
      d = new Date(`${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`);
      if (isNaN(d.getTime())) d = new Date(`${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`);
    }
  }
  return isNaN(d?.getTime()) ? null : d;
}

function applyOperator(val, operator, target) {
  const numVal = parseFloat(val);
  const numTgt = parseFloat(target);
  const strVal = String(val ?? '').trim().toLowerCase();
  const strTgt = String(target ?? '').trim().toLowerCase();
  switch (operator) {
    case '<':        return !isNaN(numVal) && !isNaN(numTgt) && numVal < numTgt;
    case '>':        return !isNaN(numVal) && !isNaN(numTgt) && numVal > numTgt;
    case '<=':       return !isNaN(numVal) && !isNaN(numTgt) && numVal <= numTgt;
    case '>=':       return !isNaN(numVal) && !isNaN(numTgt) && numVal >= numTgt;
    case '=':
    case 'eq':       return strVal === strTgt;           // case-insensitive text equals
    case 'neq':      return strVal !== strTgt;           // case-insensitive not-equals
    case 'contains': return strVal.includes(strTgt);
    default:         return false;
  }
}

// Build the base SQL query for a source table (excludes soft-deleted rows)
function baseQuery(sourceTable) {
  if (SOFT_DELETE_TABLES.has(sourceTable)) {
    return `SELECT * FROM ${sourceTable} WHERE (is_active = 1 OR is_active IS NULL)`;
  }
  return `SELECT * FROM ${sourceTable}`;
}

function getMatchingRecords(db, rule) {
  // Resolve optional numeric threshold from app_values config key
  let numericThreshold = rule.threshold_value != null ? parseFloat(rule.threshold_value) : NaN;
  if (rule.config_value_key) {
    const cfgRow = db.get('SELECT value FROM app_values WHERE key=?', [rule.config_value_key]);
    if (cfgRow) numericThreshold = parseFloat(cfgRow.value);
  }

  let records = [];

  if (rule.condition_type === 'date_overdue') {
    const field = rule.date_field;
    if (!field) return { records: [], debug: 'date_field not set' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const leadDays = parseInt(rule.lead_time_days) || 0;

    const base = baseQuery(rule.source_table);
    const hasWhere = base.toUpperCase().includes('WHERE');
    const allRows = db.all(
      `${base} ${hasWhere ? 'AND' : 'WHERE'} ${field} != '' AND ${field} IS NOT NULL`
    );
    records = allRows.filter(r => {
      const d = parseFlexDate(r[field]);
      if (!d) return false;
      d.setHours(0, 0, 0, 0);
      // Fire when: date + leadDays <= today
      // Lead=0 → date <= today (all past/today dates)
      // Lead=7 → date <= today-7 (only if overdue by at least 7 days)
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - leadDays);
      if (!(d <= cutoff)) return false;
      // Apply optional AND filter
      if (rule.filter_field && rule.filter_operator) {
        if (!applyOperator(r[rule.filter_field], rule.filter_operator, rule.filter_value)) return false;
      }
      return true;
    });
    const debug = `date_overdue on ${field} (lead=${leadDays}d): scanned ${allRows.length} rows, matched ${records.length}`;
    return { records, debug };

  } else if (rule.condition_type === 'field_threshold') {
    const field = rule.threshold_field;
    if (!field || !rule.threshold_operator) {
      return { records: [], debug: 'threshold_field or threshold_operator not set' };
    }

    const base2 = baseQuery(rule.source_table);
    const hasWhere2 = base2.toUpperCase().includes('WHERE');
    const allRows = db.all(
      `${base2} ${hasWhere2 ? 'AND' : 'WHERE'} ${field} IS NOT NULL AND ${field} != ''`
    );
    records = allRows.filter(r => {
      if (!applyOperator(r[field], rule.threshold_operator, numericThreshold)) return false;
      // Apply optional AND filter
      if (rule.filter_field && rule.filter_operator) {
        if (!applyOperator(r[rule.filter_field], rule.filter_operator, rule.filter_value)) return false;
      }
      return true;
    });
    const debug = `field_threshold: ${field} ${rule.threshold_operator} ${numericThreshold}: scanned ${allRows.length}, matched ${records.length}`;
    return { records, debug };

  } else if (rule.condition_type === 'field_equals') {
    const field = rule.threshold_field;
    const operator = rule.threshold_operator;
    const value = rule.filter_value;  // field_equals uses filter_value as the target

    if (!field || !operator) {
      return { records: [], debug: `field_equals: missing field or operator (field="${field}", op="${operator}")` };
    }

    const allRows = db.all(baseQuery(rule.source_table));
    records = allRows.filter(r => applyOperator(r[field], operator, value));
    const debug = `field_equals: ${field} ${operator} "${value}" (case-insensitive): scanned ${allRows.length}, matched ${records.length}`;
    return { records, debug };
  }

  return { records: [], debug: `unknown condition_type: ${rule.condition_type}` };
}

// â”€â”€ Recipient resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function resolveTargets(db, rule, record) {
  if (rule.notify_target_type === 'broadcast') {
    return db.all('SELECT id FROM users WHERE active = 1').map(u => u.id);
  }
  if (rule.notify_target_type === 'group') {
    const gid = parseInt(rule.notify_target_value);
    if (isNaN(gid)) return [];
    return db.all('SELECT user_id FROM user_group_members WHERE group_id = ?', [gid])
             .map(u => u.user_id);
  }
  if (rule.notify_target_type === 'field_value') {
    const fieldVal = record[rule.notify_target_value];
    if (!fieldVal) return [];
    const u = db.get(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(display_name) = LOWER(?)',
      [String(fieldVal), String(fieldVal)]
    );
    return u ? [u.id] : [];
  }
  return [];
}

// â”€â”€ Message builder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildMessage(rule, record) {
  let msg = rule.message_template ||
    `Scheduled rule "${rule.name}" matched record {record_name} â€” please review.`;

  const recordName =
    record.emp_name || record.sow || record.beeline_id || record.project || `#${record.id}`;

  msg = msg.replace(/{record_name}/g, recordName);
  msg = msg.replace(/{record_id}/g, String(record.id));

  Object.keys(record).forEach(key => {
    msg = msg.replace(
      new RegExp(`\\{${key}\\}`, 'g'),
      record[key] != null ? String(record[key]) : ''
    );
  });

  return msg;
}

// ── Main evaluation entry point ──────────────────────────────────────────────
// force=true  → bypass schedule check AND deduplication (use for manual /run)
// force=false → normal scheduled evaluation (default)
// ruleId      → if provided, evaluate only that single rule

async function evaluateRules(db, force = false, ruleId = null) {
  // Fetch all active rules then filter — avoids sql.js parameterized-query edge cases
  const allRules = db.all('SELECT * FROM notification_rules WHERE is_active = 1');
  const rules = ruleId != null ? allRules.filter(r => Number(r.id) === Number(ruleId)) : allRules;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  let totalFired = 0;
  const diagnostics = [];

  for (const rule of rules) {
    const ruleInfo = { id: rule.id, name: rule.name };

    if (!force && !shouldRunToday(rule, today)) {
      diagnostics.push({ ...ruleInfo, skipped: 'schedule â€” already ran today' });
      continue;
    }

    let records, matchDebug;
    try {
      const result = getMatchingRecords(db, rule);
      records   = result.records;
      matchDebug = result.debug;
    } catch (err) {
      const errMsg = `Error evaluating rule: ${err.message}`;
      console.error(`[RuleEngine] Rule ${rule.id} "${rule.name}": ${errMsg}`);
      diagnostics.push({ ...ruleInfo, error: errMsg });
      continue;
    }

    if (records.length === 0) {
      diagnostics.push({ ...ruleInfo, matchDebug, fired: 0, note: 'No matching records' });
      // Still update last_run_at so it doesn't keep re-running every scheduler tick
      if (!force) {
        db.run('UPDATE notification_rules SET last_run_at = ? WHERE id = ?',
          [today.toISOString(), rule.id]);
      }
      continue;
    }

    let ruleFired = 0;
    for (const record of records) {
      // Skip deduplication on forced manual runs
      if (!force) {
        const alreadyFired = db.get(
          'SELECT id FROM notification_rule_log WHERE rule_id = ? AND record_id = ? AND fired_date = ?',
          [rule.id, record.id, todayStr]
        );
        if (alreadyFired) continue;
      }

      const msgText = buildMessage(rule, record);
      const targets = resolveTargets(db, rule, record);

      for (const userId of targets) {
        db.run(
          `INSERT INTO notifications
             (type, title, message, target_user_id, source_user, is_read, read_by, created_at)
           VALUES (?, ?, ?, ?, ?, 0, '[]', ?)`,
          [rule.notification_type, rule.name, msgText, userId, 'Scheduled Rules', today.toISOString()]
        );
      }

      // Only log dedup entry for scheduled runs (not forced)
      if (!force && targets.length > 0) {
        try {
          db.run(
            `INSERT OR IGNORE INTO notification_rule_log
               (rule_id, record_id, fired_date, fired_at)
             VALUES (?, ?, ?, ?)`,
            [rule.id, record.id, todayStr, today.toISOString()]
          );
        } catch (_) { /* ignore concurrent insert */ }
      }

      if (targets.length > 0) {
        ruleFired++;
        totalFired++;
      }
    }

    diagnostics.push({
      ...ruleInfo,
      matchDebug,
      recordsMatched: records.length,
      fired: ruleFired,
      targets_type: rule.notify_target_type,
    });

    // Update last_run_at only for scheduled runs (not force, so re-run stays available)
    if (!force) {
      db.run('UPDATE notification_rules SET last_run_at = ? WHERE id = ?',
        [today.toISOString(), rule.id]);
    }
  }

  return { totalFired, diagnostics };
}

module.exports = { evaluateRules };
