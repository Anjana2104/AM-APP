/**
 * Client Requests API routes
 * Base path: /api/requests
 *
 * GET    /api/requests          - list all requests
 * POST   /api/requests/bulk     - upsert by beeline_id (append new, overwrite existing)
 * POST   /api/requests          - create one
 * PUT    /api/requests/:id      - update one
 * DELETE /api/requests/:id      - delete one
 * DELETE /api/requests          - delete ALL requests
 */

'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { evaluateTriggers } = require('../utils/triggerEvaluator');
const logger = require('../utils/logger');

function normalizeBeelineId(value) {
  return String(value || '').trim();
}

function isUniqueConstraintViolation(err) {
  const msg = String(err?.message || '').toLowerCase();
  return msg.includes('unique') || msg.includes('constraint');
}

// GET /api/requests
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT * FROM client_requests
       ORDER BY
         COALESCE(NULLIF(updated_at, ''), NULLIF(created_at, ''), NULLIF(updated_on, ''), NULLIF(date_raised, '')) DESC,
         id DESC`
    );
    res.json({ requests: rows });
  } catch (err) {
    logger.error('Failed to list requests', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/requests/active — only active beeline IDs (for dropdowns/linking)
router.get('/active', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all('SELECT id, beeline_id FROM client_requests WHERE is_active = 1 ORDER BY sno');
    res.json({ requests: rows });
  } catch (err) {
    logger.error('Failed to list active requests', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/requests/:id/active — toggle active status
router.patch('/:id/active', async (req, res) => {
  const { id } = req.params;
  const { isActive, changedBy = 'system' } = req.body;
  try {
    const db = await getDb();
    const existing = db.get('SELECT * FROM client_requests WHERE id=?', [id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    // If marking inactive, block if resources are still linked to this Beeline ID
    if (!isActive) {
      const linked = db.get(
        `SELECT COUNT(*) as cnt FROM resources WHERE beeline_id = ? AND beeline_id IS NOT NULL AND beeline_id != ''`,
        [existing.beeline_id]
      );
      if (linked && linked.cnt > 0) {
        return res.status(422).json({
          error: `Cannot mark inactive — ${linked.cnt} resource${linked.cnt > 1 ? 's are' : ' is'} still linked to Beeline ID "${existing.beeline_id}". Unlink them first.`,
          linkedCount: linked.cnt,
        });
      }
    }

    const newActive = isActive ? 1 : 0;
    const ts = new Date().toISOString();
    const recordLabel = existing.beeline_id || String(existing.id);
    db.run('UPDATE client_requests SET is_active=?, updated_at=? WHERE id=?', [newActive, ts, parseInt(id, 10)]);
    // Write to audit_log
    db.run(
      `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ['client_requests', parseInt(id, 10), recordLabel, 'Status', existing.is_active === 1 ? 'Active' : 'Inactive', isActive ? 'Active' : 'Inactive', changedBy, ts]
    );
    try {
      evaluateTriggers(db, 'client_requests',
        { is_active: String(newActive) },
        existing,
        { ...existing, is_active: newActive },
        changedBy
      );
    } catch (triggerErr) {
      logger.warn('Trigger evaluation failed', { err: triggerErr.message });
    }
    res.json({ ok: true, isActive: newActive === 1 });
  } catch (err) {
    logger.error('Failed to update request active status', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/requests/bulk - upsert by beeline_id
router.post('/bulk', async (req, res) => {
  const { requests } = req.body;
  if (!Array.isArray(requests)) {
    return res.status(400).json({ error: 'requests array required' });
  }
  try {
    const db = await getDb();
    let inserted = 0, updated = 0;

    for (const r of requests) {
      const beelineId = String(r.beelineId || r.beeline_id || '').trim();
      if (!beelineId) continue;

      const existing = db.get('SELECT id FROM client_requests WHERE LOWER(beeline_id) = LOWER(?)', [beelineId]);

      if (existing) {
        const fullExisting = db.get('SELECT * FROM client_requests WHERE id=?', [existing.id]);
        const trackFields = {
          description: r.description || '',
          raised_by: r.raisedBy || r.raised_by || '',
          processing_status: r.processingStatus || r.processing_status || '',
          overall_status: r.overallStatus || r.overall_status || '',
          account_anchor: r.accountAnchor || r.account_anchor || '',
          date_raised: r.dateRaised || r.date_raised || '',
          request_type: r.requestType || r.request_type || '',
        };
        const fieldLabels = {
          description: 'Description', raised_by: 'Raised By',
          processing_status: 'Processing Status', overall_status: 'Overall Status',
          account_anchor: 'Account Anchor', date_raised: 'Date Raised', request_type: 'Request Type',
        };
        const changedValues = {};
        const ts = new Date().toISOString();
        for (const [field, newVal] of Object.entries(trackFields)) {
          const oldVal = fullExisting && fullExisting[field] !== undefined ? String(fullExisting[field] ?? '') : '';
          if (oldVal !== String(newVal ?? '')) {
            changedValues[field] = newVal;
            db.run(
              `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)`,
              ['client_requests', existing.id, beelineId, fieldLabels[field] || field, oldVal, String(newVal ?? ''), 'upload', ts]
            );
          }
        }
        db.run(
          `UPDATE client_requests SET sno=?, description=?, raised_by=?, processing_status=?,
           overall_status=?, account_anchor=?, date_raised=?, request_type=?, updated_on=?, updated_at=?
           WHERE id=?`,
          [r.sno || (fullExisting ? fullExisting.sno : 0), trackFields.description, trackFields.raised_by,
           trackFields.processing_status, trackFields.overall_status, trackFields.account_anchor,
           trackFields.date_raised, trackFields.request_type,
           r.updatedOn || r.updated_on || new Date().toISOString(),
           new Date().toISOString(), existing.id]
        );
        if (Object.keys(changedValues).length > 0) {
          const updatedRec = db.get('SELECT * FROM client_requests WHERE id=?', [existing.id]);
          try {
            evaluateTriggers(db, 'client_requests', changedValues, fullExisting, updatedRec || fullExisting, 'upload');
          } catch (triggerErr) {
            logger.warn('Trigger evaluation failed', { err: triggerErr.message });
          }
        }
        updated++;
      } else {
        const maxRow = db.get('SELECT MAX(sno) as m FROM client_requests');
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        const ts = new Date().toISOString();
        db.run(
          `INSERT INTO client_requests (sno, beeline_id, description, raised_by, processing_status,
           overall_status, account_anchor, date_raised, request_type, updated_on, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, beelineId, r.description || '',
           r.raisedBy || r.raised_by || '',
           r.processingStatus || r.processing_status || '',
           r.overallStatus || r.overall_status || '',
           r.accountAnchor || r.account_anchor || '',
           r.dateRaised || r.date_raised || '',
           r.requestType || r.request_type || '',
           r.updatedOn || r.updated_on || ts,
           ts,
           ts]
        );
        const newId = db.lastId ? db.lastId() : null;
        if (newId) {
          db.run(
            `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)`,
            ['client_requests', newId, beelineId, 'Created', '', 'Request added via upload', 'upload', ts]
          );
        }
        inserted++;
      }
    }

    if (inserted > 0) {
      try {
        evaluateTriggers(db, 'client_requests', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, 'system');
      } catch (triggerErr) {
        logger.warn('Trigger evaluation failed', { err: triggerErr.message });
      }
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    logger.error('Failed to bulk upsert requests', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/requests - create one
router.post('/', async (req, res) => {
  const r = req.body;
  try {
    const db = await getDb();
    const beelineId = normalizeBeelineId(r.beelineId || r.beeline_id);
    if (!beelineId) {
      return res.status(400).json({ ok: false, error: 'Beeline ID is required' });
    }
    const duplicate = db.get(
      'SELECT id FROM client_requests WHERE LOWER(TRIM(beeline_id)) = LOWER(TRIM(?))',
      [beelineId]
    );
    if (duplicate) {
      return res.status(409).json({ ok: false, error: `Beeline ID "${beelineId}" already exists` });
    }
    const maxRow = db.get('SELECT MAX(sno) as m FROM client_requests');
    const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
    const ts = new Date().toISOString();
    db.run(
      `INSERT INTO client_requests (sno, beeline_id, description, raised_by, processing_status,
       overall_status, account_anchor, date_raised, request_type, updated_on, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sno, beelineId, r.description || '', r.raisedBy || '',
       r.processingStatus || '', r.overallStatus || '', r.accountAnchor || '',
       r.dateRaised || '', r.requestType || '', ts, ts, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      return res.status(409).json({ ok: false, error: 'Beeline ID already exists' });
    }
    logger.error('Failed to create request', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/requests/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const r = req.body;
  try {
    const db = await getDb();
    const oldRecord = db.get('SELECT * FROM client_requests WHERE id=?', [id]);
    if (!oldRecord) {
      return res.status(404).json({ ok: false, error: 'Request not found' });
    }
    const nextBeelineId = normalizeBeelineId(r.beelineId || r.beeline_id || oldRecord.beeline_id);
    if (!nextBeelineId) {
      return res.status(400).json({ ok: false, error: 'Beeline ID is required' });
    }
    const duplicate = db.get(
      'SELECT id FROM client_requests WHERE LOWER(TRIM(beeline_id)) = LOWER(TRIM(?)) AND id != ?',
      [nextBeelineId, id]
    );
    if (duplicate) {
      return res.status(409).json({ ok: false, error: `Beeline ID "${nextBeelineId}" already exists` });
    }
    const now = new Date().toISOString();
    const changedBy = r.changedBy || 'system';
    const recordLabel = oldRecord.beeline_id || String(oldRecord.id);
    const trackFields = {
      beeline_id: nextBeelineId,
      description: r.description || '',
      raised_by: r.raisedBy || r.raised_by || '',
      processing_status: r.processingStatus || r.processing_status || '',
      overall_status: r.overallStatus || r.overall_status || '',
      account_anchor: r.accountAnchor || r.account_anchor || '',
      date_raised: r.dateRaised || r.date_raised || '',
      request_type: r.requestType || r.request_type || '',
    };
    const fieldLabels = {
      beeline_id: 'Beeline ID',
      description: 'Description',
      raised_by: 'Raised By',
      processing_status: 'Processing Status',
      overall_status: 'Overall Status',
      account_anchor: 'Account Anchor',
      date_raised: 'Date Raised',
      request_type: 'Request Type',
    };
    db.run(
      `UPDATE client_requests SET beeline_id=?, description=?, raised_by=?, processing_status=?, overall_status=?,
       account_anchor=?, date_raised=?, request_type=?, updated_on=?, updated_at=? WHERE id=?`,
      [...Object.values(trackFields), now, now, id]
    );
    if (String(oldRecord.beeline_id || '') !== nextBeelineId) {
      db.run(
        'UPDATE resources SET beeline_id=?, updated_at=? WHERE LOWER(TRIM(beeline_id)) = LOWER(TRIM(?))',
        [nextBeelineId, now, oldRecord.beeline_id || '']
      );
    }
    const changedValues = {};
    for (const [field, newVal] of Object.entries(trackFields)) {
      const oldVal = oldRecord[field] !== undefined ? String(oldRecord[field] ?? '') : '';
      if (oldVal !== String(newVal ?? '')) {
        changedValues[field] = newVal;
        // Write to audit_log
        db.run(
          `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          ['client_requests', parseInt(id, 10), recordLabel, fieldLabels[field] || field, oldVal, String(newVal ?? ''), changedBy, now]
        );
      }
    }
    const updatedRecord = db.get('SELECT * FROM client_requests WHERE id=?', [id]);
    try {
      evaluateTriggers(db, 'client_requests', changedValues, oldRecord, updatedRecord || oldRecord, changedBy);
    } catch (triggerErr) {
      logger.warn('Trigger evaluation failed', { err: triggerErr.message });
    }
    res.json({ ok: true });
  } catch (err) {
    if (isUniqueConstraintViolation(err)) {
      return res.status(409).json({ ok: false, error: 'Beeline ID already exists' });
    }
    logger.error('Failed to update request', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/requests/:beelineId/linked-resources — resources linked to a beeline ID
router.get('/:beelineId/linked-resources', async (req, res) => {
  const { beelineId } = req.params;
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT id, ra_id, emp_name, beeline_id FROM resources WHERE beeline_id=? ORDER BY sno`,
      [beelineId]
    );
    res.json({ resources: rows });
  } catch (err) {
    logger.error('Failed to fetch linked request resources', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ensure request_comments table exists (lazy init — survives without server restart)
async function ensureCommentTable(db) {
  db.run(`CREATE TABLE IF NOT EXISTS request_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT "",
    tag TEXT NOT NULL DEFAULT "General",
    body TEXT NOT NULL DEFAULT "",
    created_at TEXT NOT NULL
  )`);
}

// GET /api/requests/:id/comments
router.get('/:id/comments', async (req, res) => {
  try {
    const db = await getDb();
    await ensureCommentTable(db);
    const rows = db.all(
      'SELECT * FROM request_comments WHERE request_id=? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ comments: rows });
  } catch (err) {
    logger.error('Failed to fetch request comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/requests/:id/comments
router.post('/:id/comments', async (req, res) => {
  const body = req.body || {};
  // Explicitly coerce to primitives — sql.js rejects plain objects
  const requestId = parseInt(req.params.id, 10);
  const author = String(body.author || 'Unknown').trim();
  const tag = String(body.tag || 'General').trim();
  const commentBody = String(body.body || '').trim();
  if (!commentBody) return res.status(400).json({ error: 'body required' });
  try {
    const db = await getDb();
    // Ensure table exists (idempotent)
    try { db.run(`CREATE TABLE IF NOT EXISTS request_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id INTEGER NOT NULL, author TEXT NOT NULL DEFAULT "", tag TEXT NOT NULL DEFAULT "General", body TEXT NOT NULL DEFAULT "", created_at TEXT NOT NULL)`); } catch (e) { logger.warn('Failed to ensure request comments table', { err: e.message }); }
    db.run(
      'INSERT INTO request_comments (request_id, author, tag, body, created_at) VALUES (?,?,?,?,?)',
      [requestId, author, tag, commentBody, new Date().toISOString()]
    );
    const newId = db.lastId ? db.lastId() : null;
    const inserted = newId ? db.get('SELECT * FROM request_comments WHERE id=?', [newId]) : null;
    res.json({ ok: true, comment: inserted });
  } catch (err) {
    logger.error('Failed to create request comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/requests/:id/comments/:commentId
router.delete('/:id/comments/:commentId', async (req, res) => {
  try {
    const db = await getDb();
    await ensureCommentTable(db);
    db.run('DELETE FROM request_comments WHERE id=? AND request_id=?', [req.params.commentId, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete request comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/requests/all-comments  - delete ALL request comments
router.delete('/all-comments', async (req, res) => {
  try {
    const db = await getDb();
    await ensureCommentTable(db);
    db.run('DELETE FROM request_comments');
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all request comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/requests/all-audit  - delete ALL audit_log entries for requests module
router.delete('/all-audit', async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM audit_log WHERE module='client_requests'");
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all request audit entries', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/requests - clear ALL
router.delete('/', async (req, res) => {
  try {
    const db = await getDb();
    const count = db.get('SELECT COUNT(*) as c FROM client_requests');
    try {
      evaluateTriggers(db, 'client_requests', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    } catch (triggerErr) {
      logger.warn('Trigger evaluation failed', { err: triggerErr.message });
    }
    db.run('DELETE FROM client_requests');
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all requests', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/requests/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const record = db.get('SELECT * FROM client_requests WHERE id=?', [id]);
    if (record) {
      const changedBy = req.query.changedBy || req.body?.changedBy || 'system';
      const label = record.beeline_id || record.description || String(record.id);
      try {
        evaluateTriggers(db, 'client_requests', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
      } catch (triggerErr) {
        logger.warn('Trigger evaluation failed', { err: triggerErr.message });
      }
    }
    db.run('DELETE FROM client_requests WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete request', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
