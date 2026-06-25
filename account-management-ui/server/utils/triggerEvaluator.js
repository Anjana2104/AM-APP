/**
 * Trigger evaluator utility
 * Checks notification_triggers for a given source table and fires notifications
 * for any configured fields that actually changed.
 *
 * To add a new aggregate/event field:
 *   1. Add it to server/config/triggerSources.js (fields array + FIELD_LABEL_MAP)
 *   2. Pass `changedValues[field] = summaryString` from the route handler
 *   3. Add it to SPECIAL_AGGREGATE_FIELDS below
 */

'use strict';

const { FIELD_LABEL_MAP } = require('../config/triggerSources');
const logger = require('./logger');

// Special field pseudo-values
const WILDCARD_FIELD = '__any__';

// Aggregate/event fields: the changedValues entry IS the human-readable summary string.
// To add a new one: add to this Set + add to triggerSources.js + pass from route.
const SPECIAL_AGGREGATE_FIELDS = new Set([
  '__revenue__',
  '__invoice_amounts__',
  '__bulk_insert__',
  '__delete_all__',
  '__record_delete__',
]);

const SPECIAL_FIELDS = new Set([WILDCARD_FIELD, ...SPECIAL_AGGREGATE_FIELDS]);

// Default templates � only used when message_template is empty (not stored by user)
const DEFAULT_TEMPLATE_SPECIAL = '{trigger_label}: {changes}. By {changed_by}.';
const DEFAULT_TEMPLATE_SCALAR  = 'The {field} of "{record_name}" changed from "{old_value}" to "{new_value}" by {changed_by}.';

function evaluateTriggers(db, sourceTable, changedValues, oldRecord, newRecord, changedBy) {
  try {
    let triggers;
    try {
      triggers = db.all(
        'SELECT * FROM notification_triggers WHERE source_table = ? AND is_active = 1',
        [sourceTable]
      );
    } catch (tableErr) {
      logger.warn('notification_triggers table not found', { err: tableErr.message });
      return;
    }

    if (!triggers || triggers.length === 0) return;

    const ts = new Date().toISOString();

    for (const trigger of triggers) {
      // Support comma-separated multi-field triggers (e.g. "owner,status" or "__any__")
      const triggerFields = String(trigger.trigger_field || '').split(',').map(f => f.trim()).filter(Boolean);
      if (triggerFields.length === 0) continue;

      const hasWildcard   = triggerFields.includes(WILDCARD_FIELD);
      const aggFields     = triggerFields.filter(f => SPECIAL_AGGREGATE_FIELDS.has(f));
      const regularFields = triggerFields.filter(f => !SPECIAL_FIELDS.has(f));

      // Determine which fields actually fired
      const firedAgg = aggFields.filter(af => !!changedValues[af]);
      const firedRegular = regularFields.filter(rf => {
        if (!(rf in changedValues)) return false;
        const oldVal = oldRecord ? String(oldRecord[rf] ?? '') : '';
        return oldVal !== String(changedValues[rf] ?? '');
      });

      let shouldFire = false;
      let isWildcardFired = false;
      let isAggregateFired = false;

      if (hasWildcard) {
        const anyChanged = Object.keys(changedValues).some(f => {
          if (f === '__count__') return false;
          if (SPECIAL_AGGREGATE_FIELDS.has(f)) return !!changedValues[f];
          const oldVal = oldRecord ? String(oldRecord[f] ?? '') : '';
          return oldVal !== String(changedValues[f] ?? '');
        });
        if (anyChanged) { shouldFire = true; isWildcardFired = true; }
      }

      if (!shouldFire && firedAgg.length > 0) { shouldFire = true; isAggregateFired = true; }
      if (!shouldFire && firedRegular.length > 0) { shouldFire = true; }

      if (!shouldFire) continue;

      const isSpecial = isWildcardFired || isAggregateFired;

      // Build changed-fields summary for message substitution
      const changedSummary = buildChangedSummary(
        changedValues, oldRecord, isWildcardFired, isAggregateFired, firedAgg, firedRegular
      );

      // For {old_value}/{new_value}: use the primary (first) regular field
      const primaryField = firedRegular[0] || firedAgg[0] || WILDCARD_FIELD;
      const isPrimarySpecial = SPECIAL_FIELDS.has(primaryField);
      const singleOldVal = isPrimarySpecial ? '' : (oldRecord ? String(oldRecord[primaryField] ?? '') : '');
      const singleNewVal = isPrimarySpecial ? '' : String(changedValues[primaryField] ?? '');

      const recordName = (newRecord || oldRecord)
        ? ((newRecord || oldRecord).project || (newRecord || oldRecord).name || String((newRecord || oldRecord).id || ''))
        : '';
      const triggerLabel = FIELD_LABEL_MAP[primaryField] || trigger.trigger_label || trigger.name || primaryField;

      const storedTemplate = (trigger.message_template || '').trim();
      const templateToUse  = storedTemplate || (isSpecial ? DEFAULT_TEMPLATE_SPECIAL : DEFAULT_TEMPLATE_SCALAR);

      const notifMessage = templateToUse
        .replace(/\{old_value\}/g,    singleOldVal)
        .replace(/\{new_value\}/g,    singleNewVal)
        .replace(/\{changes\}/g,      changedSummary)
        .replace(/\{record_name\}/g,  recordName)
        .replace(/\{changed_by\}/g,   changedBy || 'system')
        .replace(/\{field\}/g,        triggerLabel)
        .replace(/\{trigger_label\}/g, triggerLabel)
        .replace(/\{count\}/g,        String(changedValues['__count__'] || ''));

      let targetUserId  = null;
      let targetGroupId = null;

      if (trigger.notify_target_type === 'field_value') {
        // field_value only works for exactly one scalar regular field
        if (isSpecial || firedRegular.length !== 1) continue;
        const user = db.get(
          'SELECT id FROM users WHERE LOWER(display_name) = LOWER(?) OR LOWER(username) = LOWER(?)',
          [singleNewVal, singleNewVal]
        );
        if (!user) continue;
        targetUserId = user.id;
      } else if (trigger.notify_target_type === 'group') {
        const rawVal = String(trigger.notify_target_value || '').trim();
        targetGroupId = rawVal ? parseInt(rawVal, 10) : null;
        if (!targetGroupId || isNaN(targetGroupId)) continue;
        const group = db.get('SELECT id FROM user_groups WHERE id = ?', [targetGroupId]);
        if (!group) continue;
      }

      db.run(
        `INSERT INTO notifications
           (type, title, message, target_user_id, target_group_id, source_user, is_read, read_by, trigger_id, created_at)
         VALUES (?,?,?,?,?,?,0,'[]',?,?)`,
        [
          trigger.notification_type || 'task',
          trigger.name,
          notifMessage,
          targetUserId,
          targetGroupId,
          'Change Triggers',
          trigger.id,
          ts,
        ]
      );
    }
  } catch (e) {
    logger.error('Trigger evaluation error', { sourceTable, err: e.message });
  }
}

function buildChangedSummary(changedValues, oldRecord, isWildcardFired, isAggregateFired, firedAgg, firedRegular) {
  // Aggregate/event fields: their value IS the human-readable summary
  if (isAggregateFired && firedAgg.length > 0) {
    return firedAgg.map(af => changedValues[af] || 'data updated').join('; ');
  }

  // Wildcard or multiple scalar fields: collect all actual changes
  if (isWildcardFired || firedRegular.length > 1) {
    const parts = [];
    for (const [f, v] of Object.entries(changedValues)) {
      if (f === '__count__') continue;
      if (SPECIAL_AGGREGATE_FIELDS.has(f)) {
        if (v) parts.push(`${FIELD_LABEL_MAP[f] || f}: ${v}`);
        continue;
      }
      const oldVal    = oldRecord ? String(oldRecord[f] ?? '') : '';
      const newValStr = String(v ?? '');
      if (oldVal !== newValStr) {
        parts.push(`${FIELD_LABEL_MAP[f] || f} changed from "${oldVal}" to "${newValStr}"`);
      }
    }
    return parts.join('; ') || 'data updated';
  }

  // Single regular field
  if (firedRegular.length === 1) {
    const f    = firedRegular[0];
    const oldVal = oldRecord ? String(oldRecord[f] ?? '') : '';
    const newVal = String(changedValues[f] ?? '');
    const label  = FIELD_LABEL_MAP[f] || f;
    return `${label} changed from "${oldVal}" to "${newVal}"`;
  }

  return 'data updated';
}

module.exports = { evaluateTriggers };
