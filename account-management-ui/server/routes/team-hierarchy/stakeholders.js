'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const logger = require('../../utils/logger');
const { normalizeTeamType, toApiRow } = require('./helpers');

router.get('/', async (req, res) => {
  const teamType = normalizeTeamType(req.query.teamType);
  if (!teamType) {
    return res.status(400).json({ error: 'Valid teamType is required (client | ra)' });
  }

  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT id, team_type, name, title, department, reporting_to, email, phone, responsibility, sort_order, created_at, updated_at
       FROM team_hierarchy_entries
       WHERE team_type = ?
       ORDER BY sort_order ASC, name ASC`,
      [teamType]
    );

    res.json({ teamType, stakeholders: rows.map(toApiRow) });
  } catch (err) {
    logger.error('Failed to fetch team hierarchy', { err: err.message, teamType });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:teamType/bulk', async (req, res) => {
  const teamType = normalizeTeamType(req.params.teamType);
  const { stakeholders, changedBy = 'system' } = req.body;

  if (!teamType) {
    return res.status(400).json({ error: 'Valid teamType is required (client | ra)' });
  }
  if (!Array.isArray(stakeholders)) {
    return res.status(400).json({ error: 'stakeholders array required' });
  }

  try {
    const db = await getDb();
    const ts = new Date().toISOString();

    db.run('DELETE FROM team_hierarchy_entries WHERE team_type = ?', [teamType]);

    let inserted = 0;
    stakeholders.forEach((s, idx) => {
      const id = String(s.id || '').trim();
      const name = String(s.name || '').trim();
      if (!id || !name) return;

      db.run(
        `INSERT INTO team_hierarchy_entries
         (id, team_type, name, title, department, reporting_to, email, phone, responsibility, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          teamType,
          name,
          String(s.title || '').trim(),
          String(s.department || '').trim(),
          s.reportingTo ? String(s.reportingTo).trim() : null,
          String(s.email || '').trim(),
          String(s.phone || '').trim(),
          String(s.responsibility || '').trim(),
          Number.isFinite(Number(s.sortOrder)) ? Number(s.sortOrder) : idx,
          ts,
          ts,
        ]
      );
      inserted += 1;
    });

    db.run(
      `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['team_hierarchy', 0, teamType, 'bulk_save', '', `Saved ${inserted} stakeholder(s)`, changedBy, ts]
    );

    res.json({ ok: true, inserted });
  } catch (err) {
    logger.error('Failed to save team hierarchy', { err: err.message, teamType });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
