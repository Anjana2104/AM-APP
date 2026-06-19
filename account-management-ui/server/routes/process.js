/**
 * Internal Process (RA Process) API routes
 * Base path: /api/process
 *
 * GET    /api/process                        - list all
 * POST   /api/process/bulk                   - upsert by sow
 * POST   /api/process                        - create one
 * PUT    /api/process/:id                    - update one (writes audit_log)
 * PATCH  /api/process/:id/active             - toggle active field
 * GET    /api/process/:id/comments           - fetch comments
 * POST   /api/process/:id/comments           - add comment
 * DELETE /api/process/:id/comments/:cid      - delete comment
 * DELETE /api/process/:id                    - delete one
 * DELETE /api/process                        - delete ALL
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { evaluateTriggers } = require('../utils/triggerEvaluator');

// Ensure all ra_process columns exist (idempotent â€” safe to call on every request)
function ensureProcessColumns(db) {
  // Check existing columns first to avoid ALTER TABLE errors
  const cols = db.all(`PRAGMA table_info(ra_process)`).map(r => r.name);
  if (!cols.includes('eprev')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN eprev TEXT DEFAULT ''`); } catch (e) { console.error('[ensureProcessColumns] eprev:', e.message); }
  }
  if (!cols.includes('process_id')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN process_id TEXT DEFAULT NULL`); } catch (e) { console.error('[ensureProcessColumns] process_id:', e.message); }
  }
  try { db.run(`UPDATE ra_process SET process_id = 'P' || id WHERE process_id IS NULL`); } catch (e) { console.error('[ensureProcessColumns] backfill:', e.message); }
  // Unique partial index for PIW (non-empty)
  try { db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_process_piw_unique ON ra_process(piw) WHERE piw != '' AND piw IS NOT NULL`); } catch (_) {}
}


// Ensure process_comments table exists
function ensureCommentTable(db) {
  try {
    db.run(`CREATE TABLE IF NOT EXISTS process_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      process_id INTEGER NOT NULL,
      author TEXT NOT NULL DEFAULT "",
      body TEXT NOT NULL DEFAULT "",
      created_at TEXT NOT NULL
    )`);
  } catch (_) {}
}

// Write changed fields to audit_log
function writeAuditLog(db, processId, recordName, trackFields, oldRecord, changedBy) {
  const now = new Date().toISOString();
  for (const [field, newVal] of Object.entries(trackFields)) {
    const oldVal = oldRecord && oldRecord[field] !== undefined ? String(oldRecord[field] ?? '') : '';
    if (oldVal !== String(newVal ?? '')) {
      try {
        db.run(
          `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['ra_process', processId, recordName, field, oldVal, String(newVal ?? ''), changedBy || 'system', now]
        );
      } catch (_) {}
    }
  }
}

// GET /api/process/:id/resources â€” resources linked to a process
router.get('/:id/resources', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all(
      `SELECT id, ra_id, emp_name, piw_role, allocation_status, process_id
       FROM resources WHERE process_id=? ORDER BY sno`,
      [parseInt(id, 10)]
    );
    res.json({ resources: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/process/:id/active â€” toggle active field
router.patch('/:id/active', async (req, res) => {
  const { id } = req.params;
  const { isActive, changedBy = 'system' } = req.body;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const existing = db.get('SELECT * FROM ra_process WHERE id=?', [parseInt(id, 10)]);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const newVal = isActive ? 'Yes' : 'No';
    const oldVal = existing.active || '';
    const now = new Date().toISOString();
    db.run('UPDATE ra_process SET active=?, updated_at=? WHERE id=?', [newVal, now, parseInt(id, 10)]);
    try {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        ['ra_process', parseInt(id, 10), existing.sow || String(id), 'active', oldVal, newVal, changedBy, now]
      );
    } catch (_) {}
    res.json({ ok: true, active: newVal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/process/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    ensureCommentTable(db);
    const rows = db.all(
      'SELECT * FROM process_comments WHERE process_id=? ORDER BY created_at ASC',
      [parseInt(req.params.id, 10)]
    );
    res.json({ comments: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/process/:id/comments
router.post('/:id/comments', async (req, res) => {
  const processId = parseInt(req.params.id, 10);
  const author = String(req.body.author || 'Unknown').trim();
  const body = String(req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body required' });
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    ensureCommentTable(db);
    db.run(
      'INSERT INTO process_comments (process_id, author, body, created_at) VALUES (?,?,?,?)',
      [processId, author, body, new Date().toISOString()]
    );
    const newId = db.lastId ? db.lastId() : null;
    const inserted = newId ? db.get('SELECT * FROM process_comments WHERE id=?', [newId]) : null;
    res.json({ ok: true, comment: inserted });
  } catch (err) { res.status(500).json({ error: String(err.message || err) }); }
});

// DELETE /api/process/:id/comments/:cid
router.delete('/:id/comments/:cid', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    ensureCommentTable(db);
    db.run('DELETE FROM process_comments WHERE id=? AND process_id=?', [req.params.cid, req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/process/all-comments  - delete ALL process comments
router.delete('/all-comments', async (req, res) => {
  try {
    const db = await getDb();
    ensureCommentTable(db);
    db.run('DELETE FROM process_comments');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/process/all-audit  - delete ALL audit_log entries for the process module
router.delete('/all-audit', async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM audit_log WHERE module='ra_process'");
    db.run("DELETE FROM audit_log WHERE module='process'");
    // Also clear resource Process Link audit entries
    db.run("DELETE FROM audit_log WHERE module='resources' AND field='Process Link'");
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/process
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all('SELECT * FROM ra_process ORDER BY sno');
    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process/bulk - upsert by sow
router.post('/bulk', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array required' });
  }
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    let inserted = 0, updated = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
      const sow = String(r.sow || '').trim();
      if (!sow) continue;

      const existing = db.get('SELECT id, sno FROM ra_process WHERE LOWER(sow) = LOWER(?)', [sow]);

      if (existing) {
        db.run(
          `UPDATE ra_process SET sno=?, start_date=?, signed_sow=?, piw=?, active=?,
           salesforce_id=?, proms_id=?, budget=?, open_air_code=?, comments=?,
           account_anchor=?, updated_at=? WHERE id=?`,
          [r.sno || existing.sno, r.startDate || '', r.signedSow || '', r.piw || '',
           r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
           r.openAirCode || '', r.comments || '', r.accountAnchor || '', now, existing.id]
        );
        updated++;
      } else {
        const maxRow = db.get('SELECT MAX(sno) as m FROM ra_process');
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run(
          `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
           salesforce_id, proms_id, budget, open_air_code, eprev, comments, account_anchor, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, sow, r.startDate || '', r.signedSow || '', r.piw || '',
           r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
           r.openAirCode || '', r.eprev || '', r.comments || '', r.accountAnchor || '', now, now]
        );
        const _bid = db.lastId ? db.lastId() : null;
        if (_bid) { try { db.run(`UPDATE ra_process SET process_id = ? WHERE id = ?`, [`P${_bid}`, _bid]); } catch(_) {} }
        inserted++;
      }
    }

    if (inserted > 0) {
      evaluateTriggers(db, 'ra_process', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, 'system');
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process - create one
router.post('/', async (req, res) => {
  const r = req.body;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const now = new Date().toISOString();

    // Duplicate SOW check (case-insensitive)
    if (r.sow) {
      const sowConflict = db.get('SELECT id FROM ra_process WHERE LOWER(sow) = LOWER(?)', [r.sow]);
      if (sowConflict) return res.status(409).json({ error: `SOW name "${r.sow}" already exists. Please use a unique SOW name.` });
    }
    // Duplicate PIW check (non-empty, case-insensitive)
    if (r.piw && r.piw.trim()) {
      const piwConflict = db.get('SELECT id, sow FROM ra_process WHERE LOWER(piw) = LOWER(?)', [r.piw.trim()]);
      if (piwConflict) return res.status(409).json({ error: `PIW name "${r.piw}" already exists (on SOW: ${piwConflict.sow}). Please use a unique PIW name.` });
    }
    const maxRow = db.get('SELECT MAX(sno) as m FROM ra_process');
    const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
    db.run(
      `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
       salesforce_id, proms_id, budget, open_air_code, eprev, comments, account_anchor, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.sno || sno, r.sow || '', r.startDate || '', r.signedSow || '', r.piw || '',
       r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
       r.openAirCode || '', r.eprev || '', r.comments || '', r.accountAnchor || '', now, now]
    );
    const newId = db.lastId ? db.lastId() : null;
    // Set human-readable process_id: P1, P2, ...
    if (newId) {
      try { db.run(`UPDATE ra_process SET process_id = ? WHERE id = ?`, [`P${newId}`, newId]); } catch (_) {}
    }
    // Audit: record creation
    if (newId) {
      try {
        db.run(
          `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['ra_process', newId, r.sow || String(newId), 'Record', '', 'Created', r.changedBy || 'system', now]
        );
      } catch (_) {}
    }
    res.json({ ok: true, id: newId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/process/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const r = req.body;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const numId = parseInt(id, 10);

    // Duplicate SOW check (case-insensitive, excluding current record)
    if (r.sow) {
      const sowConflict = db.get('SELECT id FROM ra_process WHERE LOWER(sow) = LOWER(?) AND id != ?', [r.sow, numId]);
      if (sowConflict) return res.status(409).json({ error: `SOW name "${r.sow}" already exists. Please use a unique SOW name.` });
    }
    // Duplicate PIW check (non-empty, case-insensitive, excluding current record)
    if (r.piw && r.piw.trim()) {
      const piwConflict = db.get('SELECT id, sow FROM ra_process WHERE LOWER(piw) = LOWER(?) AND id != ?', [r.piw.trim(), numId]);
      if (piwConflict) return res.status(409).json({ error: `PIW name "${r.piw}" already exists (on SOW: ${piwConflict.sow}). Please use a unique PIW name.` });
    }

    const oldRecord = db.get('SELECT * FROM ra_process WHERE id=?', [numId]);
    const now = new Date().toISOString();
    const trackFields = {
      sow: r.sow || '',
      start_date: r.startDate || '',
      signed_sow: r.signedSow || '',
      piw: r.piw || '',
      active: r.active || '',
      salesforce_id: r.salesforceId || '',
      proms_id: r.promsId || '',
      budget: r.budget || '',
      open_air_code: r.openAirCode || '',
      eprev: r.eprev || '',
      comments: r.comments || '',
      account_anchor: r.accountAnchor || '',
    };
    db.run(
      `UPDATE ra_process SET sow=?, start_date=?, signed_sow=?, piw=?, active=?,
       salesforce_id=?, proms_id=?, budget=?, open_air_code=?, eprev=?, comments=?,
       account_anchor=?, updated_at=? WHERE id=?`,
      [...Object.values(trackFields), now, numId]
    );
    if (oldRecord) {
      const changedValues = {};
      for (const [field, newVal] of Object.entries(trackFields)) {
        const oldVal = oldRecord[field] !== undefined ? String(oldRecord[field] ?? '') : '';
        if (oldVal !== String(newVal ?? '')) changedValues[field] = newVal;
      }
      // Write audit_log for each changed field
      writeAuditLog(db, numId, oldRecord.sow || String(id), trackFields, oldRecord, r.changedBy || 'system');
      const updatedRecord = db.get('SELECT * FROM ra_process WHERE id=?', [numId]);
      evaluateTriggers(db, 'ra_process', changedValues, oldRecord, updatedRecord || oldRecord, r.changedBy || 'system');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/process - clear ALL
router.delete('/', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const count = db.get('SELECT COUNT(*) as c FROM ra_process');
    evaluateTriggers(db, 'ra_process', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    db.run('DELETE FROM ra_process');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/process/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const record = db.get('SELECT * FROM ra_process WHERE id=?', [parseInt(id, 10)]);
    if (record) {
      const changedBy = req.query.changedBy || req.body?.changedBy || 'system';
      const label = record.sow || String(record.id);
      evaluateTriggers(db, 'ra_process', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
    }
    db.run('DELETE FROM ra_process WHERE id=?', [parseInt(id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


// GET /api/process/:id/resources â€” resources linked to a process
router.get('/:id/resources', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all(
      `SELECT id, ra_id, emp_name, piw_role, allocation_status, process_id
       FROM resources WHERE process_id=? ORDER BY sno`,
      [parseInt(id, 10)]
    );
    res.json({ resources: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/process
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all('SELECT * FROM ra_process ORDER BY sno');
    res.json({ rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process/bulk - upsert by sow
router.post('/bulk', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows)) {
    return res.status(400).json({ error: 'rows array required' });
  }
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    let inserted = 0, updated = 0;
    const now = new Date().toISOString();

    for (const r of rows) {
      const sow = String(r.sow || '').trim();
      if (!sow) continue;

      const existing = db.get('SELECT id, sno FROM ra_process WHERE LOWER(sow) = LOWER(?)', [sow]);

      if (existing) {
        db.run(
          `UPDATE ra_process SET sno=?, start_date=?, signed_sow=?, piw=?, active=?,
           salesforce_id=?, proms_id=?, budget=?, open_air_code=?, comments=?,
           account_anchor=?, updated_at=? WHERE id=?`,
          [r.sno || existing.sno, r.startDate || '', r.signedSow || '', r.piw || '',
           r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
           r.openAirCode || '', r.comments || '', r.accountAnchor || '', now, existing.id]
        );
        updated++;
      } else {
        const maxRow = db.get('SELECT MAX(sno) as m FROM ra_process');
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run(
          `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
           salesforce_id, proms_id, budget, open_air_code, eprev, comments, account_anchor, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, sow, r.startDate || '', r.signedSow || '', r.piw || '',
           r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
           r.openAirCode || '', r.eprev || '', r.comments || '', r.accountAnchor || '', now, now]
        );
        const _bid = db.lastId ? db.lastId() : null;
        if (_bid) { try { db.run(`UPDATE ra_process SET process_id = ? WHERE id = ?`, [`P${_bid}`, _bid]); } catch(_) {} }
        inserted++;
      }
    }

    if (inserted > 0) {
      evaluateTriggers(db, 'ra_process', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, 'system');
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process - create one
router.post('/', async (req, res) => {
  const r = req.body;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const now = new Date().toISOString();
    const maxRow = db.get('SELECT MAX(sno) as m FROM ra_process');
    const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
    db.run(
      `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
       salesforce_id, proms_id, budget, open_air_code, eprev, comments, account_anchor, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.sno || sno, r.sow || '', r.startDate || '', r.signedSow || '', r.piw || '',
       r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
       r.openAirCode || '', r.eprev || '', r.comments || '', r.accountAnchor || '', now, now]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/process/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const r = req.body;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const oldRecord = db.get('SELECT * FROM ra_process WHERE id=?', [id]);
    const now = new Date().toISOString();
    const trackFields = {
      start_date: r.startDate || '',
      signed_sow: r.signedSow || '',
      piw: r.piw || '',
      active: r.active || '',
      salesforce_id: r.salesforceId || '',
      proms_id: r.promsId || '',
      budget: r.budget || '',
      open_air_code: r.openAirCode || '',
      comments: r.comments || '',
      account_anchor: r.accountAnchor || '',
    };
    db.run(
      `UPDATE ra_process SET start_date=?, signed_sow=?, piw=?, active=?,
       salesforce_id=?, proms_id=?, budget=?, open_air_code=?, comments=?,
       account_anchor=?, updated_at=? WHERE id=?`,
      [...Object.values(trackFields), now, id]
    );
    if (oldRecord) {
      const changedValues = {};
      for (const [field, newVal] of Object.entries(trackFields)) {
        const oldVal = oldRecord[field] !== undefined ? String(oldRecord[field] ?? '') : '';
        if (oldVal !== String(newVal ?? '')) changedValues[field] = newVal;
      }
      const updatedRecord = db.get('SELECT * FROM ra_process WHERE id=?', [id]);
      evaluateTriggers(db, 'ra_process', changedValues, oldRecord, updatedRecord || oldRecord, r.changedBy || 'system');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/process - clear ALL
router.delete('/', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const count = db.get('SELECT COUNT(*) as c FROM ra_process');
    evaluateTriggers(db, 'ra_process', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    db.run('DELETE FROM ra_process');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/process/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const record = db.get('SELECT * FROM ra_process WHERE id=?', [id]);
    if (record) {
      const changedBy = req.query.changedBy || req.body?.changedBy || 'system';
      const label = record.sow || String(record.id);
      evaluateTriggers(db, 'ra_process', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
    }
    db.run('DELETE FROM ra_process WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
