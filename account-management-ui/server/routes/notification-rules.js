/**
 * Notification Rules (Scheduled Rules) CRUD routes
 * Base path: /api/notification-rules
 *
 * Rule-based proactive notifications that fire on a schedule rather than
 * on a field change. Evaluated by evaluateRules.js via a server-side scheduler.
 *
 * GET    /          — list all rules
 * POST   /          — create rule
 * PUT    /:id       — update rule
 * DELETE /:id       — delete rule
 * PUT    /:id/toggle — toggle is_active
 * GET    /field-values  — distinct values for a field in a table (for autocomplete)
 * POST   /run           — manually trigger all rules (force)
 * POST   /run/:id       — manually trigger a single rule (force)
 */
'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { evaluateRules } = require('../utils/evaluateRules');

function now() { return new Date().toISOString(); }

// GET /api/notification-rules — list all rules
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const rules = db.all('SELECT * FROM notification_rules ORDER BY sort_order ASC, id ASC');
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notification-rules — create a rule
router.post('/', async (req, res) => {
  try {
    const db = await getDb();
    const d = req.body;
    const ts = now();
    db.run(
      `INSERT INTO notification_rules
         (name, description, source_table, condition_type,
          date_field, lead_time_days,
          filter_field, filter_operator, filter_value,
          threshold_field, threshold_operator, threshold_value, config_value_key,
          schedule_type, schedule_day,
          notification_type, notify_target_type, notify_target_value,
          message_template, is_active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        d.name, d.description || '', d.source_table, d.condition_type,
        d.date_field || '', parseInt(d.lead_time_days) || 0,
        d.filter_field || '', d.filter_operator || '', d.filter_value || '',
        d.threshold_field || '', d.threshold_operator || '',
        d.threshold_value != null ? parseFloat(d.threshold_value) : null,
        d.config_value_key || '',
        d.schedule_type || 'daily',
        d.schedule_day != null ? parseInt(d.schedule_day) : null,
        d.notification_type || 'alert',
        d.notify_target_type || 'group',
        d.notify_target_value || '',
        d.message_template || '',
        d.is_active !== false ? 1 : 0,
        ts, ts,
      ]
    );
    res.json({ id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-rules/reorder — accepts { ids: [1,3,2,...] }
// Must be registered BEFORE /:id to avoid Express matching "reorder" as an id param
router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  try {
    const db = await getDb();
    const ts = now();
    ids.forEach((id, index) => {
      db.run('UPDATE notification_rules SET sort_order=?, updated_at=? WHERE id=?', [index + 1, ts, id]);
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-rules/:id — update a rule
router.put('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const d = req.body;
    const ts = now();
    db.run(
      `UPDATE notification_rules SET
         name=?, description=?, source_table=?, condition_type=?,
         date_field=?, lead_time_days=?,
         filter_field=?, filter_operator=?, filter_value=?,
         threshold_field=?, threshold_operator=?, threshold_value=?, config_value_key=?,
         schedule_type=?, schedule_day=?,
         notification_type=?, notify_target_type=?, notify_target_value=?,
         message_template=?, is_active=?, updated_at=?
       WHERE id=?`,
      [
        d.name, d.description || '', d.source_table, d.condition_type,
        d.date_field || '', parseInt(d.lead_time_days) || 0,
        d.filter_field || '', d.filter_operator || '', d.filter_value || '',
        d.threshold_field || '', d.threshold_operator || '',
        d.threshold_value != null ? parseFloat(d.threshold_value) : null,
        d.config_value_key || '',
        d.schedule_type || 'daily',
        d.schedule_day != null ? parseInt(d.schedule_day) : null,
        d.notification_type || 'alert',
        d.notify_target_type || 'group',
        d.notify_target_value || '',
        d.message_template || '',
        d.is_active !== false ? 1 : 0,
        ts,
        parseInt(req.params.id),
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notification-rules/:id/duplicate — clone a rule with "Copy of" prefix
router.post('/:id/duplicate', async (req, res) => {
  try {
    const db = await getDb();
    const id = parseInt(req.params.id);
    const orig = db.get('SELECT * FROM notification_rules WHERE id=?', [id]);
    if (!orig) return res.status(404).json({ error: 'Rule not found' });
    const ts = now();
    db.run(
      `INSERT INTO notification_rules
         (name, description, source_table, condition_type,
          date_field, lead_time_days,
          filter_field, filter_operator, filter_value,
          threshold_field, threshold_operator, threshold_value, config_value_key,
          schedule_type, schedule_day,
          notification_type, notify_target_type, notify_target_value,
          message_template, is_active, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `Copy of ${orig.name}`, orig.description, orig.source_table, orig.condition_type,
        orig.date_field, orig.lead_time_days,
        orig.filter_field, orig.filter_operator, orig.filter_value,
        orig.threshold_field, orig.threshold_operator, orig.threshold_value, orig.config_value_key,
        orig.schedule_type, orig.schedule_day,
        orig.notification_type, orig.notify_target_type, orig.notify_target_value,
        orig.message_template, 0, // duplicate starts inactive
        ts, ts,
      ]
    );
    res.json({ id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notification-rules/history — delete notifications by criteria
// Must be defined BEFORE /:id to avoid 'history' being matched as an id param
// Body: { period: 'today'|'7d'|'30d'|'all', source: 'rule_engine'|'change_trigger'|'all' }
router.delete('/history', async (req, res) => {
  try {
    const db = await getDb();
    const period = req.body?.period || req.query.period || 'all';
    const source = req.body?.source || req.query.source || 'all';
    const title  = req.body?.title  || req.query.title  || '';

    const whereParts = [];
    if (period === 'today') {
      whereParts.push(`DATE(created_at) = DATE('now')`);
    } else if (period === '7d') {
      whereParts.push(`created_at >= DATE('now', '-7 days')`);
    } else if (period === '30d') {
      whereParts.push(`created_at >= DATE('now', '-30 days')`);
    }
    if (source === 'rule_engine')    whereParts.push(`source_user = 'Scheduled Rules'`);
    if (source === 'change_trigger') whereParts.push(`source_user = 'Change Triggers'`);
    if (title) whereParts.push(`title LIKE '%${title.replace(/'/g, "''")}%'`);

    const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

    const countRow = db.get(`SELECT COUNT(*) AS n FROM notifications ${where}`);
    let deleted = 0;
    if (countRow) {
      const val = countRow.n ?? countRow['COUNT(*)'] ?? Object.values(countRow)[0];
      deleted = parseInt(String(val), 10) || 0;
    }

    db.run(`DELETE FROM notifications ${where}`);
    res.json({ ok: true, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notification-rules/:id — remove a rule + its log
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const id = parseInt(req.params.id);
    db.run('DELETE FROM notification_rule_log WHERE rule_id=?', [id]);
    db.run('DELETE FROM notification_rules WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-rules/:id/toggle — flip is_active
router.put('/:id/toggle', async (req, res) => {
  try {
    const db = await getDb();
    db.run(
      'UPDATE notification_rules SET is_active = 1 - is_active, updated_at=? WHERE id=?',
      [now(), parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notification-rules/run — manual trigger (bypasses schedule + deduplication)
router.post('/run', async (_req, res) => {
  try {
    const db = await getDb();
    const result = await evaluateRules(db, true); // force=true
    res.json({ ok: true, fired: result.totalFired, diagnostics: result.diagnostics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notification-rules/run/:id — run a single rule by ID (force, bypass dedup)
router.post('/run/:id', async (req, res) => {
  try {
    const db = await getDb();
    const ruleId = parseInt(req.params.id);
    if (isNaN(ruleId)) return res.status(400).json({ error: 'Invalid rule ID' });
    const result = await evaluateRules(db, true, ruleId);
    res.json({ ok: true, fired: result.totalFired, diagnostics: result.diagnostics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notification-rules/field-values?table=X&field=Y — distinct non-empty values
const ALLOWED_TABLES = new Set(['resources', 'client_requests', 'ra_process', 'finance_projects']);
router.get('/field-values', async (req, res) => {
  try {
    const { table, field } = req.query;
    if (!table || !field || !ALLOWED_TABLES.has(table)) {
      return res.status(400).json({ error: 'Invalid table or field' });
    }
    // Whitelist field to alphanumeric + underscore only
    if (!/^[a-z_][a-z0-9_]*$/i.test(field)) {
      return res.status(400).json({ error: 'Invalid field name' });
    }
    const db = await getDb();
    const rows = db.all(
      `SELECT DISTINCT ${field} AS v FROM ${table}
       WHERE ${field} IS NOT NULL AND TRIM(${field}) != ''
       ORDER BY ${field} LIMIT 100`
    );
    res.json(rows.map(r => String(r.v)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notification-rules/history?limit=N — consolidated: one row per trigger per day
// Groups by (title, source_user, day) so one rule firing for N records = one history entry
router.get('/history', async (req, res) => {
  try {
    const db    = await getDb();
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const rows = db.all(`
      SELECT
        MIN(n.id)                                         AS id,
        n.type,
        n.title,
        GROUP_CONCAT(n.message, ' | ')                    AS message,
        COUNT(*)                                          AS notification_count,
        n.source_user,
        COUNT(DISTINCT n.target_user_id)                  AS recipient_count,
        GROUP_CONCAT(u.display_name)                      AS recipients_list,
        MIN(n.created_at)                                 AS created_at,
        SUM(n.is_read)                                    AS read_count
      FROM notifications n
      LEFT JOIN users u ON u.id = n.target_user_id
      GROUP BY n.title, n.source_user, strftime('%Y-%m-%dT%H:%M', n.created_at)
      ORDER BY MIN(n.id) DESC
      LIMIT ${limit}
    `);
    // Deduplicate messages (GROUP_CONCAT DISTINCT not supported in this SQLite build)
    const deduped = rows.map(r => ({
      ...r,
      message: r.message
        ? [...new Set(r.message.split(' | ').map(s => s.trim()).filter(Boolean))].join(' | ')
        : '',
      recipients_list: r.recipients_list
        ? [...new Set(r.recipients_list.split(',').map(s => s.trim()).filter(Boolean))].join(', ')
        : '',
    }));
    res.json(deduped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
