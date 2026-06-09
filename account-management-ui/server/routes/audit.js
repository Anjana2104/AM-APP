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

module.exports = router;
