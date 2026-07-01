'use strict';

/**
 * finance/projects.js
 *
 * Finance Project routes
 * Base path: /api/finance  (mounted by finance/index.js)
 *
 * GET    /api/finance/projects              — list all projects with revenue
 * POST   /api/finance/projects              — create a single project
 * POST   /api/finance/projects/bulk         — bulk upsert from Excel upload
 * PUT    /api/finance/projects/:id          — update project fields + revenue
 * PUT    /api/finance/projects/:id/milestone-types — upsert milestone types only
 * DELETE /api/finance/projects/:id          — delete one project
 * DELETE /api/finance/projects              — delete ALL projects
 */

const express = require('express');
const router  = express.Router();
const { getDb } = require('../../db/connection');
const { evaluateTriggers } = require('../../utils/triggerEvaluator');
const logger = require('../../utils/logger');
const {
  insertFinanceAudit,
  auditProjectFieldChanges,
} = require('./helpers');

// ── GET /api/finance/projects ──────────────────────────────────────────────

router.get('/projects', async (req, res) => {
  try {
    const db       = await getDb();
    const projects = db.all('SELECT * FROM finance_projects ORDER BY sno');
    const revenues = db.all('SELECT * FROM finance_revenue');

    const revMap = {};
    revenues.forEach(r => {
      if (!revMap[r.project_id]) revMap[r.project_id] = { amounts: {}, types: {} };
      revMap[r.project_id].amounts[r.month] = r.amount;
      revMap[r.project_id].types[r.month]   = r.milestone_type || 'booked';
    });

    const result = projects.map(p => ({
      ...p,
      revenue:       revMap[p.id]?.amounts || {},
      milestoneTypes: revMap[p.id]?.types  || {},
    }));
    res.json({ projects: result });
  } catch (err) {
    logger.error('[Finance/Projects] Failed to list projects:', err.message);
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// ── POST /api/finance/projects — single create ─────────────────────────────

router.post('/projects', async (req, res) => {
  const { project, company, code, space, owner, status, revenue, monthHeaders, comments, changedBy } = req.body;
  try {
    const db         = await getDb();
    const countRow   = db.get('SELECT COUNT(*) as c FROM finance_projects');
    const sno        = (countRow ? countRow.c : 0) + 1;
    const statusVal  = status === 'Inactive' ? 'Inactive' : 'Active';
    const changed_at = new Date().toISOString();

    db.run(
      `INSERT INTO finance_projects (sno, project, company, code, space, owner, status, active, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sno, project || '', company || '', code || '', space || '',
       owner || '', statusVal, statusVal === 'Active' ? 1 : 0, comments || '']
    );
    const projectId = db.lastId();

    insertFinanceAudit(db.run.bind(db), {
      recordId: projectId, recordName: project || '',
      field: 'created', oldValue: '', newValue: 'Project created',
      changedBy: changedBy || 'system', changedAt: changed_at,
    });

    if (revenue && monthHeaders) {
      monthHeaders.forEach((month, idx) => {
        const amount = Array.isArray(revenue) ? (revenue[idx] || 0) : (revenue[month] || 0);
        if (amount) {
          db.run(
            'INSERT OR REPLACE INTO finance_revenue (project_id, month, amount) VALUES (?, ?, ?)',
            [projectId, month, amount]
          );
        }
      });
    }

    res.json({ ok: true, id: projectId });
  } catch (err) {
    logger.error('[Finance/Projects] Failed to create project:', err.message);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ── POST /api/finance/projects/bulk ───────────────────────────────────────

router.post('/projects/bulk', async (req, res) => {
  const { projects, monthHeaders, changedBy } = req.body;
  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: 'projects array required' });
  }

  try {
    const db          = await getDb();
    let inserted = 0, updated = 0;
    const changed_by  = changedBy || 'system';
    const changed_at  = new Date().toISOString();
    const bulkOldRecs = {};          // projectId → old DB row (before update)
    const changedMap  = {};          // projectId → changedValues

    for (const p of projects) {
      const months    = monthHeaders || [];
      const statusVal = p.status === 'Inactive' ? 'Inactive' : 'Active';
      const activeVal = statusVal === 'Active' ? 1 : 0;

      let projectId = null;
      let isInsert  = false;

      // 1. Match by DB id (handles project renames)
      if (p.id) {
        const existing = db.get('SELECT * FROM finance_projects WHERE id=?', [p.id]);
        if (existing) {
          projectId = existing.id;
          bulkOldRecs[projectId] = existing;
          changedMap[projectId]  = auditProjectFieldChanges(
            db, projectId, existing,
            { ...p, statusVal }, changed_by, changed_at
          );
          db.run(
            `UPDATE finance_projects
             SET project=?, company=?, code=?, space=?, owner=?,
                 status=?, active=?, comments=?, updated_at=?
             WHERE id=?`,
            [p.project || '', p.company || '', p.code || '', p.space || '',
             p.owner || '', statusVal, activeVal, p.comments || '', changed_at, projectId]
          );
          updated++;
        }
      }

      // 2. Fall back to case-insensitive name match for rows without an id
      if (!projectId) {
        const existing = db.get(
          'SELECT * FROM finance_projects WHERE LOWER(project) = LOWER(?)',
          [p.project || '']
        );
        if (existing) {
          projectId = existing.id;
          bulkOldRecs[projectId] = existing;
          changedMap[projectId]  = auditProjectFieldChanges(
            db, projectId, existing,
            { ...p, statusVal }, changed_by, changed_at
          );
          db.run(
            `UPDATE finance_projects
             SET project=?, company=?, code=?, space=?, owner=?,
                 status=?, active=?, comments=?, updated_at=?
             WHERE id=?`,
            [p.project || '', p.company || '', p.code || '', p.space || '',
             p.owner || '', statusVal, activeVal, p.comments || '', changed_at, projectId]
          );
          updated++;
        }
      }

      // 3. Insert new project
      if (!projectId) {
        const maxRow = db.get('SELECT MAX(sno) as m FROM finance_projects');
        const sno    = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run(
          `INSERT INTO finance_projects
             (sno, project, company, code, space, owner, status, active, comments)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [p.sno || sno, p.project || '', p.company || '', p.code || '',
           p.space || '', p.owner || '', statusVal, activeVal, p.comments || '']
        );
        projectId = db.lastId();
        isInsert  = true;
        inserted++;
        insertFinanceAudit(db.run.bind(db), {
          recordId: projectId, recordName: p.project || '',
          field: 'created', oldValue: '', newValue: 'Project created',
          changedBy: changed_by, changedAt: changed_at,
        });
      }

      // Upsert revenue rows; collect revenue change descriptions for triggers
      const revChangeParts = [];
      months.forEach((month, idx) => {
        const amount = Array.isArray(p.revenue)
          ? (p.revenue[idx] || 0)
          : (p.revenue ? (p.revenue[month] || 0) : 0);
        const milestoneType = (p.milestoneTypes && p.milestoneTypes[month]) === 'anticipated'
          ? 'anticipated' : 'booked';

        if (!isInsert) {
          const oldRev     = db.get('SELECT amount, milestone_type FROM finance_revenue WHERE project_id=? AND month=?', [projectId, month]);
          const oldAmt     = oldRev ? (oldRev.amount || 0) : 0;
          const oldMilestone = oldRev ? (oldRev.milestone_type || 'booked') : 'booked';
          if (oldAmt !== amount) {
            insertFinanceAudit(db.run.bind(db), {
              recordId: projectId, recordName: p.project || '',
              field: `revenue:${month}`, oldValue: String(oldAmt), newValue: String(amount),
              changedBy: changed_by, changedAt: changed_at,
            });
            revChangeParts.push(`${month}: ${oldAmt} → ${amount}`);
          }
          if (oldMilestone !== milestoneType) {
            revChangeParts.push(`${month} type: ${oldMilestone} → ${milestoneType}`);
          }
        }

        db.run(
          'INSERT OR REPLACE INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, ?, ?)',
          [projectId, month, amount, milestoneType]
        );
      });

      // Fire per-project triggers for scalar + revenue changes
      if (!isInsert && projectId) {
        const cv = changedMap[projectId] || {};
        if (revChangeParts.length > 0) cv.__revenue__ = revChangeParts.join('; ');
        if (Object.keys(cv).length > 0 && bulkOldRecs[projectId]) {
          const updatedRec = db.get('SELECT * FROM finance_projects WHERE id=?', [projectId]);
          evaluateTriggers(db, 'finance_projects', cv, bulkOldRecs[projectId], updatedRec || bulkOldRecs[projectId], changed_by);
        }
      }
    }

    if (inserted > 0) {
      evaluateTriggers(db, 'finance_projects', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, changed_by);
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    logger.error('[Finance/Projects] Bulk upload failed:', err.message);
    const msg = err.message || '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return res.status(409).json({
        error: 'Duplicate project code detected. Each project must have a unique code. Fix the file and re-upload.',
        detail: msg,
      });
    }
    res.status(500).json({ error: 'Bulk upload failed' });
  }
});

// ── PUT /api/finance/projects/:id ─────────────────────────────────────────
// Partial update — only updates fields present in request body

router.put('/projects/:id', async (req, res) => {
  const { id } = req.params;
  const { project, company, code, space, owner, status, revenue, monthHeaders, comments, milestoneTypes, changedBy } = req.body;
  try {
    const db        = await getDb();
    const oldRecord = db.get('SELECT * FROM finance_projects WHERE id=?', [id]);

    const fields = [];
    const vals   = [];
    if (project  !== undefined) { fields.push('project=?');  vals.push(project || ''); }
    if (company  !== undefined) { fields.push('company=?');  vals.push(company || ''); }
    if (code     !== undefined) { fields.push('code=?');     vals.push(code    || ''); }
    if (space    !== undefined) { fields.push('space=?');    vals.push(space   || ''); }
    if (owner    !== undefined) { fields.push('owner=?');    vals.push(owner   || ''); }
    if (comments !== undefined) { fields.push('comments=?'); vals.push(comments || ''); }
    if (status   !== undefined) {
      const sv = status === 'Inactive' ? 'Inactive' : 'Active';
      fields.push('status=?'); vals.push(sv);
      fields.push('active=?'); vals.push(sv === 'Active' ? 1 : 0);
    }
    fields.push('updated_at=?'); vals.push(new Date().toISOString());
    vals.push(id);

    if (fields.length > 1) {
      db.run(`UPDATE finance_projects SET ${fields.join(',')} WHERE id=?`, vals);
    }

    if (oldRecord) {
      const changed_by  = changedBy || 'system';
      const changed_at  = new Date().toISOString();
      const newStatusVal = status !== undefined ? (status === 'Inactive' ? 'Inactive' : 'Active') : undefined;

      const changedValues = auditProjectFieldChanges(
        db, id, oldRecord,
        { project, company, code, space, owner, comments, statusVal: newStatusVal },
        changed_by, changed_at
      );

      // Revenue changes
      const revChangeParts = [];
      if (revenue !== undefined && monthHeaders) {
        monthHeaders.forEach((month, idx) => {
          const newAmt       = Array.isArray(revenue) ? (revenue[idx] || 0) : (revenue[month] || 0);
          const oldRow       = db.get('SELECT amount, milestone_type FROM finance_revenue WHERE project_id=? AND month=?', [id, month]);
          const oldAmt       = oldRow ? (oldRow.amount || 0) : 0;
          const newMilestone = (milestoneTypes && milestoneTypes[month]) === 'anticipated' ? 'anticipated' : 'booked';
          const oldMilestone = oldRow ? (oldRow.milestone_type || 'booked') : 'booked';

          if (oldAmt !== newAmt) revChangeParts.push(`${month}: ${oldAmt} → ${newAmt}`);
          if (oldMilestone !== newMilestone) revChangeParts.push(`${month} type: ${oldMilestone} → ${newMilestone}`);

          db.run(
            'INSERT OR REPLACE INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, ?, ?)',
            [id, month, newAmt, newMilestone]
          );
        });
      } else if (milestoneTypes && typeof milestoneTypes === 'object') {
        for (const [month, type] of Object.entries(milestoneTypes)) {
          const milestoneType = type === 'anticipated' ? 'anticipated' : 'booked';
          const oldRow        = db.get('SELECT id, amount, milestone_type FROM finance_revenue WHERE project_id=? AND month=?', [id, month]);
          const oldMilestone  = oldRow ? (oldRow.milestone_type || 'booked') : 'booked';
          if (oldMilestone !== milestoneType) revChangeParts.push(`${month} type: ${oldMilestone} → ${milestoneType}`);
          if (oldRow) {
            db.run('UPDATE finance_revenue SET milestone_type=? WHERE project_id=? AND month=?', [milestoneType, id, month]);
          } else {
            db.run('INSERT INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, 0, ?)', [id, month, milestoneType]);
          }
        }
      }

      if (revChangeParts.length > 0) changedValues.__revenue__ = revChangeParts.join('; ');

      const updatedRecord = db.get('SELECT * FROM finance_projects WHERE id=?', [id]);
      evaluateTriggers(db, 'finance_projects', changedValues, oldRecord, updatedRecord || oldRecord, changed_by);
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Finance/Projects] Failed to update project ${id}:`, err.message);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ── PUT /api/finance/projects/:id/milestone-types ─────────────────────────
// Upserts milestone types without changing amounts

router.put('/projects/:id/milestone-types', async (req, res) => {
  const { id }    = req.params;
  const { types } = req.body;
  if (!types || typeof types !== 'object') {
    return res.status(400).json({ error: 'types object required' });
  }
  try {
    const db = await getDb();
    for (const [month, type] of Object.entries(types)) {
      const milestoneType = type === 'anticipated' ? 'anticipated' : 'booked';
      const existing      = db.get('SELECT id, amount FROM finance_revenue WHERE project_id=? AND month=?', [id, month]);
      if (existing) {
        db.run('UPDATE finance_revenue SET milestone_type=? WHERE project_id=? AND month=?', [milestoneType, id, month]);
      } else {
        db.run('INSERT INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, 0, ?)', [id, month, milestoneType]);
      }
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Finance/Projects] Failed to update milestone types for project ${id}:`, err.message);
    res.status(500).json({ error: 'Failed to update milestone types' });
  }
});

// ── DELETE /api/finance/projects/:id ──────────────────────────────────────

router.delete('/projects/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db     = await getDb();
    const record = db.get('SELECT * FROM finance_projects WHERE id=?', [id]);
    if (record) {
      const changedBy = String(req.query.changedBy || req.body?.changedBy || 'system');
      const label     = record.project || String(record.id);
      evaluateTriggers(
        db, 'finance_projects',
        { __record_delete__: `Record "${label}" was deleted` },
        record, null, changedBy
      );
    }
    db.run('DELETE FROM finance_revenue WHERE project_id=?', [id]);
    db.run('DELETE FROM finance_projects WHERE id=?', [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Finance/Projects] Failed to delete project ${id}:`, err.message);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ── DELETE /api/finance/projects — clear ALL projects ─────────────────────

router.delete('/projects', async (req, res) => {
  try {
    const db    = await getDb();
    const count = db.get('SELECT COUNT(*) as c FROM finance_projects');
    evaluateTriggers(
      db, 'finance_projects',
      { __delete_all__: `${count ? count.c : 0} records deleted` },
      null, null, req.body?.changedBy || 'system'
    );
    db.run('DELETE FROM finance_revenue');
    db.run('DELETE FROM finance_projects');
    res.json({ ok: true });
  } catch (err) {
    logger.error('[Finance/Projects] Failed to delete all projects:', err.message);
    res.status(500).json({ error: 'Failed to delete all projects' });
  }
});

module.exports = router;
