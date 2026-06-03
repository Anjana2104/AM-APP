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
    const now = new Date().toISOString();
    db.run(
      `UPDATE ra_process SET start_date=?, signed_sow=?, piw=?, active=?,
       salesforce_id=?, proms_id=?, budget=?, open_air_code=?, comments=?,
       account_anchor=?, updated_at=? WHERE id=?`,
      [r.startDate || '', r.signedSow || '', r.piw || '', r.active || '',
       r.salesforceId || '', r.promsId || '', r.budget || '',
       r.openAirCode || '', r.comments || '', r.accountAnchor || '', now, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/process - clear ALL
router.delete('/', async (req, res) => {
  try {
    const db = await getDb();
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
    db.run('DELETE FROM ra_process WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
