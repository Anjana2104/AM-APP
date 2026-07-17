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

'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { evaluateTriggers } = require('../utils/triggerEvaluator');
const logger = require('../utils/logger');

// Ensure all ra_process columns exist (idempotent — safe to call on every request)
function ensureProcessColumns(db) {
  // Check existing columns first to avoid ALTER TABLE errors
  const cols = db.all(`PRAGMA table_info(ra_process)`).map(r => r.name);
  if (!cols.includes('eprev')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN eprev TEXT DEFAULT ''`); } catch (e) { logger.warn('Failed to ensure eprev column', { err: e.message }); }
  }
  if (!cols.includes('process_id')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN process_id TEXT DEFAULT NULL`); } catch (e) { logger.warn('Failed to ensure process_id column', { err: e.message }); }
  }
  if (!cols.includes('step_completed_at')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN step_completed_at TEXT DEFAULT '{}'`); } catch (e) { logger.warn('Failed to ensure step_completed_at column', { err: e.message }); }
  }
  if (!cols.includes('created_at')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN created_at TEXT`); } catch (e) { logger.warn('Failed to ensure created_at column', { err: e.message }); }
  }
  if (!cols.includes('updated_at')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN updated_at TEXT`); } catch (e) { logger.warn('Failed to ensure updated_at column', { err: e.message }); }
  }
  if (!cols.includes('finance_project_id')) {
    try { db.run(`ALTER TABLE ra_process ADD COLUMN finance_project_id INTEGER DEFAULT NULL`); } catch (e) { logger.warn('Failed to ensure finance_project_id column', { err: e.message }); }
  }
  try { db.run(`UPDATE ra_process SET process_id = 'P' || id WHERE process_id IS NULL`); } catch (e) { logger.warn('Failed to backfill process identifiers', { err: e.message }); }
  // Unique partial index for PIW (non-empty)
  try { db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_process_piw_unique ON ra_process(piw) WHERE piw != '' AND piw IS NOT NULL`); } catch (e) { logger.warn('Failed to ensure PIW unique index', { err: e.message }); }
}

function parseStepCompletedAt(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(String(raw));
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {}
  return {};
}

function withStepCompletedAt(existingRecord, incomingFields, nowIso, touchedKeys) {
  const current = parseStepCompletedAt(existingRecord?.step_completed_at);
  const shouldTrack = (key) => !touchedKeys || touchedKeys.has(key);
  const ensureTimestamp = (key, done) => {
    if (!shouldTrack(key)) return;
    if (!done || current[key]) return;
    current[key] = nowIso;
  };
  ensureTimestamp('sow', String(incomingFields.sow || '').trim() !== '');
  ensureTimestamp('signed_sow', String(incomingFields.signed_sow || '').trim().toLowerCase() === 'yes');
  ensureTimestamp('piw', String(incomingFields.piw || '').trim() !== '');
  ensureTimestamp('salesforce_id', String(incomingFields.salesforce_id || '').trim() !== '');
  ensureTimestamp('proms_id', String(incomingFields.proms_id || '').trim() !== '');
  ensureTimestamp('budget', String(incomingFields.budget || '').trim() !== '');
  ensureTimestamp('open_air_code', String(incomingFields.open_air_code || '').trim() !== '');
  ensureTimestamp('eprev', String(incomingFields.eprev || '').trim().toLowerCase() === 'yes');
  return JSON.stringify(current);
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
  } catch (e) { logger.warn('Failed to ensure comment table', { err: e.message }); }
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
      } catch (e) { logger.warn('Failed to write process audit log', { err: e.message }); }
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
    logger.error('Failed to fetch process resources', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
    } catch (e) { logger.warn('Failed to write process active audit log', { err: e.message }); }
    res.json({ ok: true, active: newVal });
  } catch (err) {
    logger.error('Failed to update process active status', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
  } catch (err) {
    logger.error('Failed to fetch process comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
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
  } catch (err) {
    logger.error('Failed to create process comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/process/:id/comments/:cid
router.delete('/:id/comments/:cid', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    ensureCommentTable(db);
    db.run('DELETE FROM process_comments WHERE id=? AND process_id=?', [req.params.cid, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete process comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/process/all-comments  - delete ALL process comments
router.delete('/all-comments', async (req, res) => {
  try {
    const db = await getDb();
    ensureCommentTable(db);
    db.run('DELETE FROM process_comments');
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all process comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
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
  } catch (err) {
    logger.error('Failed to delete all process audit entries', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/process/resource-insights
// Flat dataset for Finance → SOW Insights → Resource Insights (project > sow > linked resources)
router.get('/resource-insights', async (_req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all(
      `SELECT
         fp.id AS project_id,
         fp.project AS project_name,
         fp.code AS project_code,
         CASE
           WHEN LOWER(TRIM(COALESCE(fp.status, ''))) IN ('active', 'yes', 'true', '1') THEN 'Active'
           WHEN LOWER(TRIM(COALESCE(fp.status, ''))) IN ('inactive', 'no', 'false', '0') THEN 'Inactive'
           WHEN COALESCE(fp.active, 1) = 1 THEN 'Active'
           ELSE 'Inactive'
         END AS project_status,
         p.id AS sow_id,
         p.sow,
         p.process_id,
         CASE
           WHEN LOWER(TRIM(COALESCE(p.active, ''))) IN ('yes', 'active', 'true', '1') THEN 'Yes'
           ELSE 'No'
         END AS process_active,
         r.id AS resource_id,
         r.ra_id,
         r.emp_name,
         r.piw_role,
         r.engagement_start_date,
         r.engagement_end_date
       FROM finance_projects fp
       JOIN ra_process p ON p.finance_project_id = fp.id
       JOIN resources r ON r.process_id = p.id
       ORDER BY fp.project COLLATE NOCASE, p.sow COLLATE NOCASE, r.emp_name COLLATE NOCASE`
    );
    res.json({ rows });
  } catch (err) {
    logger.error('Failed to fetch process resource insights', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/process/by-sow/:financeProjectId — all processes linked to a SOW details record
router.get('/by-sow/:financeProjectId', async (req, res) => {
  const fpId = parseInt(req.params.financeProjectId, 10);
  if (isNaN(fpId)) return res.status(400).json({ error: 'Invalid financeProjectId' });
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all(
      `SELECT
         p.id,
         p.process_id,
         p.sow,
         p.active,
         p.finance_project_id,
         COUNT(r.id) AS linked_resource_count,
         GROUP_CONCAT(
           CASE
             WHEN TRIM(COALESCE(r.emp_name, '')) != '' AND TRIM(COALESCE(r.ra_id, '')) != ''
               THEN TRIM(r.emp_name) || ' (' || TRIM(r.ra_id) || ')'
             WHEN TRIM(COALESCE(r.emp_name, '')) != ''
               THEN TRIM(r.emp_name)
             ELSE TRIM(COALESCE(r.ra_id, ''))
           END,
           ', '
         ) AS linked_resources
       FROM ra_process p
       LEFT JOIN resources r ON r.process_id = p.id
       WHERE p.finance_project_id = ?
       GROUP BY p.id
       ORDER BY p.sno, p.id`,
      [fpId]
    );
    res.json({ rows });
  } catch (err) {
    logger.error('Failed to fetch processes by SOW', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/process/:id/sow-link — link or unlink an internal process to a SOW details record
// Body: { financeProjectId: number | null, changedBy?: string }
// Constraint: only active processes (active='Yes') can be linked; only active SOW records
router.put('/:id/sow-link', async (req, res) => {
  const processId = parseInt(req.params.id, 10);
  const { financeProjectId, changedBy = 'system' } = req.body;
  if (isNaN(processId)) return res.status(400).json({ error: 'Invalid process id' });

  try {
    const db = await getDb();
    ensureProcessColumns(db);

    const process = db.get('SELECT * FROM ra_process WHERE id=?', [processId]);
    if (!process) return res.status(404).json({ error: 'Process not found' });

    const fpId = financeProjectId != null ? parseInt(String(financeProjectId), 10) : null;

    if (fpId !== null) {
      // Validate the finance project exists and is active
      const fp = db.get('SELECT id, project, status FROM finance_projects WHERE id=?', [fpId]);
      if (!fp) return res.status(404).json({ error: 'SOW details record not found' });
      if (fp.status === 'Inactive') return res.status(400).json({ error: 'Cannot link to an inactive SOW record' });
      // Validate the process is active
      if (process.active !== 'Yes') return res.status(400).json({ error: 'Only active internal processes can be linked' });
    }

    const oldVal = process.finance_project_id != null ? String(process.finance_project_id) : '';
    const newVal = fpId != null ? String(fpId) : '';
    const now = new Date().toISOString();

    // Resolve human-readable names for cleaner audit entries
    const oldFp = process.finance_project_id != null
      ? db.get('SELECT project FROM finance_projects WHERE id=?', [process.finance_project_id])
      : null;
    const newFp = fpId != null
      ? db.get('SELECT project FROM finance_projects WHERE id=?', [fpId])
      : null;
    const oldFpName = oldFp?.project || oldVal || '—';
    const newFpName = newFp?.project || newVal || '—';

    db.run('UPDATE ra_process SET finance_project_id=?, updated_at=? WHERE id=?', [fpId, now, processId]);

    // Log to ra_process audit: which SOW record this process was linked/unlinked from
    try {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        ['ra_process', processId, process.sow || String(processId), 'SOW Link', oldFpName, newFpName, changedBy, now]
      );
    } catch (e) { logger.warn('Failed to write SOW link audit log (ra_process)', { err: e.message }); }

    // Also log to finance_projects audit so it appears in the SOW detail drawer's audit trail
    const affectedFpId = fpId ?? process.finance_project_id;
    if (affectedFpId != null) {
      try {
        const action = fpId != null ? 'Process Linked' : 'Process Unlinked';
        const processLabel = process.sow || `Process #${processId}`;
        db.run(
          `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['finance', affectedFpId, newFp?.project || oldFp?.project || String(affectedFpId), action,
           fpId != null ? '—' : processLabel,
           fpId != null ? processLabel : '—',
           changedBy, now]
        );
      } catch (e) { logger.warn('Failed to write SOW link audit log (finance)', { err: e.message }); }
    }

    res.json({ ok: true, financeProjectId: fpId });
  } catch (err) {
    logger.error('Failed to update SOW link', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/process
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const rows = db.all(
      `SELECT p.*, fp.project AS finance_project_name, fp.code AS finance_project_code
       FROM ra_process p
       LEFT JOIN finance_projects fp ON fp.id = p.finance_project_id
       ORDER BY COALESCE(NULLIF(p.updated_at, ''), NULLIF(p.created_at, '')) DESC, p.id DESC`
    );
    res.json({ rows });
  } catch (err) {
    logger.error('Failed to list processes', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
        const existingFull = db.get('SELECT * FROM ra_process WHERE id=?', [existing.id]) || {};
        const incomingFields = {
          sow,
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
        const stepCompletedAt = withStepCompletedAt(existingFull, incomingFields, now);
        db.run(
          `UPDATE ra_process SET sno=?, start_date=?, signed_sow=?, piw=?, active=?,
           salesforce_id=?, proms_id=?, budget=?, open_air_code=?, eprev=?, comments=?,
           account_anchor=?, step_completed_at=?, updated_at=? WHERE id=?`,
          [r.sno || existing.sno, incomingFields.start_date, incomingFields.signed_sow, incomingFields.piw,
           incomingFields.active, incomingFields.salesforce_id, incomingFields.proms_id, incomingFields.budget,
           incomingFields.open_air_code, incomingFields.eprev, incomingFields.comments, incomingFields.account_anchor,
           stepCompletedAt, now, existing.id]
        );
        updated++;
      } else {
        const maxRow = db.get('SELECT MAX(sno) as m FROM ra_process');
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        const incomingFields = {
          sow,
          signed_sow: r.signedSow || '',
          piw: r.piw || '',
          salesforce_id: r.salesforceId || '',
          proms_id: r.promsId || '',
          budget: r.budget || '',
          open_air_code: r.openAirCode || '',
          eprev: r.eprev || '',
        };
        const stepCompletedAt = withStepCompletedAt({}, incomingFields, now);
        db.run(
          `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
           salesforce_id, proms_id, budget, open_air_code, eprev, comments, account_anchor, step_completed_at, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, sow, r.startDate || '', r.signedSow || '', r.piw || '',
           r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
           r.openAirCode || '', r.eprev || '', r.comments || '', r.accountAnchor || '', stepCompletedAt, now, now]
        );
        const _bid = db.lastId ? db.lastId() : null;
        if (_bid) { try { db.run(`UPDATE ra_process SET process_id = ? WHERE id = ?`, [`P${_bid}`, _bid]); } catch(_) {} }
        inserted++;
      }
    }

    if (inserted > 0) {
      try {
        evaluateTriggers(db, 'ra_process', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, 'system');
      } catch (triggerErr) {
        logger.warn('Trigger evaluation failed', { err: triggerErr.message });
      }
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    logger.error('Failed to bulk upsert processes', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
    const createFields = {
      sow: r.sow || '',
      signed_sow: r.signedSow || '',
      piw: r.piw || '',
      salesforce_id: r.salesforceId || '',
      proms_id: r.promsId || '',
      budget: r.budget || '',
      open_air_code: r.openAirCode || '',
      eprev: r.eprev || '',
    };
    const stepCompletedAt = withStepCompletedAt({}, createFields, now);
    db.run(
      `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
       salesforce_id, proms_id, budget, open_air_code, eprev, comments, account_anchor, step_completed_at, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.sno || sno, r.sow || '', r.startDate || '', r.signedSow || '', r.piw || '',
       r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
       r.openAirCode || '', r.eprev || '', r.comments || '', r.accountAnchor || '', stepCompletedAt, now, now]
    );
    const newId = db.lastId ? db.lastId() : null;
    // Set human-readable process_id: P1, P2, ...
    if (newId) {
      try { db.run(`UPDATE ra_process SET process_id = ? WHERE id = ?`, [`P${newId}`, newId]); } catch (e) { logger.warn('Failed to set process identifier', { err: e.message }); }
    }
    // Audit: record creation
    if (newId) {
      try {
        db.run(
          `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['ra_process', newId, r.sow || String(newId), 'Record', '', 'Created', r.changedBy || 'system', now]
        );
      } catch (e) { logger.warn('Failed to write process creation audit log', { err: e.message }); }
    }
    res.json({ ok: true, id: newId });
  } catch (err) {
    logger.error('Failed to create process', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
    if (!oldRecord) {
      return res.status(404).json({ error: 'Process record not found' });
    }
    const now = new Date().toISOString();
    const has = (key) => Object.prototype.hasOwnProperty.call(r, key);
    const pick = (key, fallback) => (has(key) ? String(r[key] ?? '') : String(fallback ?? ''));
    const touchedKeys = new Set();
    if (has('sow')) touchedKeys.add('sow');
    if (has('startDate')) touchedKeys.add('start_date');
    if (has('signedSow')) touchedKeys.add('signed_sow');
    if (has('piw')) touchedKeys.add('piw');
    if (has('active')) touchedKeys.add('active');
    if (has('salesforceId')) touchedKeys.add('salesforce_id');
    if (has('promsId')) touchedKeys.add('proms_id');
    if (has('budget')) touchedKeys.add('budget');
    if (has('openAirCode')) touchedKeys.add('open_air_code');
    if (has('eprev')) touchedKeys.add('eprev');
    if (has('comments')) touchedKeys.add('comments');
    if (has('accountAnchor')) touchedKeys.add('account_anchor');
    const trackFields = {
      sow: pick('sow', oldRecord.sow),
      start_date: pick('startDate', oldRecord.start_date),
      signed_sow: pick('signedSow', oldRecord.signed_sow),
      piw: pick('piw', oldRecord.piw),
      active: pick('active', oldRecord.active),
      salesforce_id: pick('salesforceId', oldRecord.salesforce_id),
      proms_id: pick('promsId', oldRecord.proms_id),
      budget: pick('budget', oldRecord.budget),
      open_air_code: pick('openAirCode', oldRecord.open_air_code),
      eprev: pick('eprev', oldRecord.eprev),
      comments: pick('comments', oldRecord.comments),
      account_anchor: pick('accountAnchor', oldRecord.account_anchor),
    };
    const stepCompletedAt = withStepCompletedAt(oldRecord || {}, trackFields, now, touchedKeys);
    db.run(
      `UPDATE ra_process SET sow=?, start_date=?, signed_sow=?, piw=?, active=?,
       salesforce_id=?, proms_id=?, budget=?, open_air_code=?, eprev=?, comments=?,
       account_anchor=?, step_completed_at=?, updated_at=? WHERE id=?`,
      [...Object.values(trackFields), stepCompletedAt, now, numId]
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
      try {
        evaluateTriggers(db, 'ra_process', changedValues, oldRecord, updatedRecord || oldRecord, r.changedBy || 'system');
      } catch (triggerErr) {
        logger.warn('Trigger evaluation failed', { err: triggerErr.message });
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to update process', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/process - clear ALL
router.delete('/', async (req, res) => {
  try {
    const db = await getDb();
    ensureProcessColumns(db);
    const count = db.get('SELECT COUNT(*) as c FROM ra_process');
    try {
      evaluateTriggers(db, 'ra_process', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    } catch (triggerErr) {
      logger.warn('Trigger evaluation failed', { err: triggerErr.message });
    }
    db.run('DELETE FROM ra_process');
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all processes', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
      try {
        evaluateTriggers(db, 'ra_process', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
      } catch (triggerErr) {
        logger.warn('Trigger evaluation failed', { err: triggerErr.message });
      }
    }
    db.run('DELETE FROM ra_process WHERE id=?', [parseInt(id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete process', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
