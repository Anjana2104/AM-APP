/**
 * Audit log routes
 * Base path: /api/audit
 *
 * GET /api/audit/process-combined/:processId - all audit for a process (ra_process fields + resource linking + engagement dates)
 * GET /api/audit/process-resources/:processId - all process-link changes for a process (timeline use)
 * GET /api/audit/:module/:recordId  - list audit entries for a record
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

// Human-readable field label map for ra_process DB column names
const PROCESS_FIELD_LABELS = {
  sow: 'SOW Name',
  start_date: 'Start Date',
  signed_sow: 'Signed SOW',
  piw: 'PIW Name',
  active: 'Active',
  salesforce_id: 'Salesforce ID',
  proms_id: 'PROMS ID',
  budget: 'Budget',
  open_air_code: 'Open Air Code',
  eprev: 'Eprev',
  comments: 'Comments',
  account_anchor: 'Account Anchor',
  Record: 'Record',
};

// GET /api/audit/process-combined/:processId
// Returns merged audit log: process field changes + resource linking + resource engagement date changes
router.get('/process-combined/:processId', async (req, res) => {
  const { processId } = req.params;
  const pid = parseInt(processId, 10);
  try {
    const db = await getDb();

    // 1. Process field changes (module='ra_process', record_id=pid)
    const processEntries = db.all(
      `SELECT *, 'process' as source FROM audit_log
       WHERE module='ra_process' AND record_id=?
       ORDER BY changed_at DESC LIMIT 200`,
      [pid]
    ).map(e => ({
      ...e,
      field: PROCESS_FIELD_LABELS[e.field] || e.field,
      source: 'Process',
    }));

    // 2. Resource linking events (module='resources', field='Process Link', old/new=pid)
    const linkEntries = db.all(
      `SELECT * FROM audit_log
       WHERE module='resources' AND field='Process Link'
         AND (old_value=? OR new_value=?)
       ORDER BY changed_at DESC LIMIT 200`,
      [String(pid), String(pid)]
    ).map(e => ({
      ...e,
      field: String(e.new_value) === String(pid) ? 'Resource Linked' : 'Resource Unlinked',
      old_value: '',
      new_value: e.record_name || '',
      source: 'Resource Link',
    }));

    // 3. Engagement date changes for resources currently linked to this process
    const linkedResources = db.all(
      `SELECT id, ra_id, emp_name FROM resources WHERE process_id=?`,
      [pid]
    );
    let dateEntries = [];
    for (const r of linkedResources) {
      const entries = db.all(
        `SELECT * FROM audit_log
         WHERE module='resources' AND record_id=?
           AND field IN ('Engagement Start Date', 'Engagement End Date')
         ORDER BY changed_at DESC LIMIT 50`,
        [r.id]
      );
      dateEntries.push(...entries.map(e => ({
        ...e,
        record_name: `${r.ra_id} - ${r.emp_name}`,
        source: 'Resource Date',
      })));
    }

    // Merge and sort by changed_at DESC
    const all = [...processEntries, ...linkEntries, ...dateEntries]
      .sort((a, b) => String(b.changed_at).localeCompare(String(a.changed_at)));

    res.json({ entries: all });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/process-resources/:processId
// Returns all audit entries where field='Process Link' and old or new value = processId
router.get('/process-resources/:processId', async (req, res) => {
  const { processId } = req.params;
  try {
    const db = await getDb();
    const entries = db.all(
      `SELECT * FROM audit_log
       WHERE module='resources' AND field='Process Link'
         AND (old_value=? OR new_value=?)
       ORDER BY changed_at ASC`,
      [String(processId), String(processId)]
    );
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/audit/:module/:recordId
router.get('/:module/:recordId', async (req, res) => {
  const { module, recordId } = req.params;
  try {
    const db = await getDb();
    const entries = db.all(
      'SELECT * FROM audit_log WHERE module=? AND record_id=? ORDER BY id DESC LIMIT 200',
      [module, parseInt(recordId, 10)]
    );
    res.json({ entries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audit  — write a single audit entry from the frontend
router.post('/', async (req, res) => {
  const { module, record_id, record_name, field, old_value, new_value, changed_by } = req.body;
  if (!module || !record_id || !field) {
    return res.status(400).json({ error: 'module, record_id, and field are required' });
  }
  try {
    const db = await getDb();
    db.run(
      `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [module, record_id, record_name || '', field, old_value || '', new_value || '', changed_by || '']
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
