/**
 * Audit log routes
 * Base path: /api/audit
 *
 * GET /api/audit/:module/:recordId  - list audit entries for a record
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

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
