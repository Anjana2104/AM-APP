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

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { evaluateTriggers } = require('../utils/triggerEvaluator');

// GET /api/requests
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all('SELECT * FROM client_requests ORDER BY sno');
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
        const trackFields = {
          description: r.description || '',
          raised_by: r.raisedBy || r.raised_by || '',
          processing_status: r.processingStatus || r.processing_status || '',
          overall_status: r.overallStatus || r.overall_status || '',
          account_anchor: r.accountAnchor || r.account_anchor || '',
          date_raised: r.dateRaised || r.date_raised || '',
          request_type: r.requestType || r.request_type || '',
        };
        const changedValues = {};
        for (const [field, newVal] of Object.entries(trackFields)) {
          const oldVal = existing[field] !== undefined ? String(existing[field] ?? '') : '';
          if (oldVal !== String(newVal ?? '')) changedValues[field] = newVal;
        }
        db.run(
          `UPDATE client_requests SET sno=?, description=?, raised_by=?, processing_status=?,
           overall_status=?, account_anchor=?, date_raised=?, request_type=?, updated_on=?, updated_at=?
           WHERE id=?`,
          [r.sno || existing.sno, trackFields.description, trackFields.raised_by,
           trackFields.processing_status, trackFields.overall_status, trackFields.account_anchor,
           trackFields.date_raised, trackFields.request_type,
           r.updatedOn || r.updated_on || new Date().toISOString(),
           new Date().toISOString(), existing.id]
        );
        if (Object.keys(changedValues).length > 0) {
          const updatedRec = db.get('SELECT * FROM client_requests WHERE id=?', [existing.id]);
          evaluateTriggers(db, 'client_requests', changedValues, existing, updatedRec || existing, 'system');
        }
        updated++;
      } else {
        const maxRow = db.get('SELECT MAX(sno) as m FROM client_requests');
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run(
          `INSERT INTO client_requests (sno, beeline_id, description, raised_by, processing_status,
           overall_status, account_anchor, date_raised, request_type, updated_on)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, beelineId, r.description || '',
           r.raisedBy || r.raised_by || '',
           r.processingStatus || r.processing_status || '',
           r.overallStatus || r.overall_status || '',
           r.accountAnchor || r.account_anchor || '',
           r.dateRaised || r.date_raised || '',
           r.requestType || r.request_type || '',
           r.updatedOn || r.updated_on || new Date().toISOString()]
        );
        inserted++;
      }
    }

    if (inserted > 0) {
      evaluateTriggers(db, 'client_requests', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, 'system');
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error('Request upsert error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/requests - create one
router.post('/', async (req, res) => {
  const r = req.body;
  try {
    const db = await getDb();
    const maxRow = db.get('SELECT MAX(sno) as m FROM client_requests');
    const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
    db.run(
      `INSERT INTO client_requests (sno, beeline_id, description, raised_by, processing_status,
       overall_status, account_anchor, date_raised, request_type, updated_on)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [sno, r.beelineId || '', r.description || '', r.raisedBy || '',
       r.processingStatus || '', r.overallStatus || '', r.accountAnchor || '',
       r.dateRaised || '', r.requestType || '', new Date().toISOString()]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/requests/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const r = req.body;
  try {
    const db = await getDb();
    const oldRecord = db.get('SELECT * FROM client_requests WHERE id=?', [id]);
    const now = new Date().toISOString();
    const trackFields = {
      description: r.description || '',
      raised_by: r.raisedBy || r.raised_by || '',
      processing_status: r.processingStatus || r.processing_status || '',
      overall_status: r.overallStatus || r.overall_status || '',
      account_anchor: r.accountAnchor || r.account_anchor || '',
      date_raised: r.dateRaised || r.date_raised || '',
      request_type: r.requestType || r.request_type || '',
    };
    db.run(
      `UPDATE client_requests SET description=?, raised_by=?, processing_status=?, overall_status=?,
       account_anchor=?, date_raised=?, request_type=?, updated_on=?, updated_at=? WHERE id=?`,
      [...Object.values(trackFields), now, now, id]
    );
    if (oldRecord) {
      const changedValues = {};
      for (const [field, newVal] of Object.entries(trackFields)) {
        const oldVal = oldRecord[field] !== undefined ? String(oldRecord[field] ?? '') : '';
        if (oldVal !== String(newVal ?? '')) changedValues[field] = newVal;
      }
      const updatedRecord = db.get('SELECT * FROM client_requests WHERE id=?', [id]);
      evaluateTriggers(db, 'client_requests', changedValues, oldRecord, updatedRecord || oldRecord, r.changedBy || 'system');
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/requests - clear ALL
router.delete('/', async (req, res) => {
  try {
    const db = await getDb();
    const count = db.get('SELECT COUNT(*) as c FROM client_requests');
    evaluateTriggers(db, 'client_requests', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    db.run('DELETE FROM client_requests');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      evaluateTriggers(db, 'client_requests', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
    }
    db.run('DELETE FROM client_requests WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
