/**
 * Internal Process (RA Process) API routes
 * Base path: /api/process
 *
 * GET    /api/process          - list all
 * POST   /api/process/bulk     - upsert by sow (append new, overwrite existing)
 * POST   /api/process          - create one
 * PUT    /api/process/:id      - update one
 * DELETE /api/process/:id      - delete one
 * DELETE /api/process          - delete ALL
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { evaluateTriggers } = require('../utils/triggerEvaluator');

// GET /api/process
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
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
           salesforce_id, proms_id, budget, open_air_code, comments, account_anchor, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, sow, r.startDate || '', r.signedSow || '', r.piw || '',
           r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
           r.openAirCode || '', r.comments || '', r.accountAnchor || '', now, now]
        );
        inserted++;
      }
    }

    if (inserted > 0) {
      evaluateTriggers(db, 'ra_process', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, 'system');
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error('Process upsert error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/process - create one
router.post('/', async (req, res) => {
  const r = req.body;
  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const maxRow = db.get('SELECT MAX(sno) as m FROM ra_process');
    const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
    db.run(
      `INSERT INTO ra_process (sno, sow, start_date, signed_sow, piw, active,
       salesforce_id, proms_id, budget, open_air_code, comments, account_anchor, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [r.sno || sno, r.sow || '', r.startDate || '', r.signedSow || '', r.piw || '',
       r.active || '', r.salesforceId || '', r.promsId || '', r.budget || '',
       r.openAirCode || '', r.comments || '', r.accountAnchor || '', now, now]
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
