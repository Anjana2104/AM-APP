'use strict';

const express = require("express");
const router = express.Router();
const { getDb } = require("../../db/connection");
const logger = require("../../utils/logger");
const { updateOneWithAudit } = require("./helpers");

// GET /api/resources
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(`
      SELECT r.*, rp.sow AS sow_name
      FROM resources r
      LEFT JOIN ra_process rp ON rp.id = r.process_id
      ORDER BY r.sno
    `);
    res.json({ resources: rows });
  } catch (err) {
    logger.error('Failed to list resources', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/resources/bulk - upsert by ra_id
router.post("/bulk", async (req, res) => {
  const { resources, changedBy = 'system' } = req.body;
  if (!Array.isArray(resources)) {
    return res.status(400).json({ error: "resources array required" });
  }
  try {
    const db = await getDb();
    let inserted = 0, updated = 0;
    const ts = new Date().toISOString();

    for (const r of resources) {
      const raId = String(r.raId || r.ra_id || "").trim();
      if (!raId) continue;

      const existing = db.get("SELECT * FROM resources WHERE LOWER(ra_id) = LOWER(?)", [raId]);

      if (existing) {
        const newEng = (r.engagement || "").toLowerCase().trim();
        let allocStatus;
        if (r.allocationStatus !== undefined) {
          allocStatus = r.allocationStatus;
        } else if (newEng === "bench") {
          allocStatus = "Available";
        } else {
          allocStatus = existing.allocation_status || "";
        }
        db.run(
          `UPDATE resources SET sno=?, emp_name=?, email_id=?, piw_role=?, role_or_domain=?,
           previous_workex=?, doj=?, total_workex=?, engagement=?, skills=?, allocation_status=?,
           skill_type=?, engagement_start_date=?, engagement_end_date=?, allocation_percentage=?,
           updated_at=? WHERE id=?`,
          [r.sno || existing.sno, r.empName || "", r.emailId || "", r.piwRole || "",
           r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
           r.totalWorkex || "", r.engagement || "", r.skills || "",
           allocStatus, r.skillType || "", r.engagementStartDate || "", r.engagementEndDate || "",
           r.allocationPercentage !== undefined ? (r.allocationPercentage === null ? null : Number(r.allocationPercentage)) : (existing.allocation_percentage ?? null),
           ts, existing.id]
        );
        // Audit: log changed fields
        const recordName = `${raId} - ${r.empName || existing.emp_name}`;
        const newAllocPct = r.allocationPercentage !== undefined
          ? (r.allocationPercentage === null ? null : Number(r.allocationPercentage))
          : (existing.allocation_percentage ?? null);
        const trackFields = {
          'Employee Name':        [existing.emp_name || '', r.empName || ''],
          'Email':                [existing.email_id || '', r.emailId || ''],
          'PIW Role':             [existing.piw_role || '', r.piwRole || ''],
          'Role/Domain':          [existing.role_or_domain || '', r.roleOrDomain || ''],
          'Previous Workex':      [existing.previous_workex || '', r.previousWorkex || ''],
          'DOJ':                  [existing.doj || '', r.doj || ''],
          'Total Workex':         [existing.total_workex || '', r.totalWorkex || ''],
          'Engagement':           [existing.engagement || '', r.engagement || ''],
          'Engagement Start Date':[existing.engagement_start_date || '', r.engagementStartDate || ''],
          'Engagement End Date':  [existing.engagement_end_date || '', r.engagementEndDate || ''],
          'Skills':               [existing.skills || '', r.skills || ''],
          'Allocation Status':    [existing.allocation_status || '', allocStatus],
          'Allocation %':         [
            existing.allocation_percentage != null ? String(existing.allocation_percentage) : '',
            newAllocPct != null ? String(newAllocPct) : '',
          ],
        };
        for (const [label, [oldVal, newVal]] of Object.entries(trackFields)) {
          if (String(oldVal) !== String(newVal)) {
            db.run(
              `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
               VALUES (?,?,?,?,?,?,?,?)`,
              ['resources', existing.id, recordName, label, String(oldVal), String(newVal), changedBy, ts]
            );
          }
        }
        updated++;
      } else {
        const maxRow = db.get("SELECT MAX(sno) as m FROM resources");
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        const engLower = (r.engagement || "").toLowerCase().trim();
        const defaultAllocStatus = r.allocationStatus !== undefined ? r.allocationStatus
          : (engLower === 'bench' || engLower === '' ? 'Available' : 'Joined');
        db.run(
          `INSERT INTO resources (sno, ra_id, emp_name, email_id, piw_role, role_or_domain,
           previous_workex, doj, total_workex, engagement, skills, allocation_status,
           skill_type, engagement_start_date, engagement_end_date, allocation_percentage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, raId, r.empName || "", r.emailId || "", r.piwRole || "",
           r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
           r.totalWorkex || "", r.engagement || "", r.skills || "", defaultAllocStatus,
           r.skillType || "", r.engagementStartDate || "", r.engagementEndDate || "",
           r.allocationPercentage !== undefined ? (r.allocationPercentage === null ? null : Number(r.allocationPercentage)) : null]
        );
        const newId = db.lastId ? db.lastId() : null;
        const recordName = `${raId} - ${r.empName || ''}`;
        if (newId) {
          db.run(
            `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
             VALUES (?,?,?,?,?,?,?,?)`,
            ['resources', newId, recordName, 'created', '', 'Resource added via upload', changedBy, ts]
          );
        }
        inserted++;
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    logger.error('Failed to bulk upsert resources', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/resources
router.post("/", async (req, res) => {
  const r = req.body;
  const changedBy = r.changedBy || 'system';
  try {
    const db = await getDb();
    const maxRow = db.get("SELECT MAX(sno) as m FROM resources");
    const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
    const engLower = (r.engagement || "").toLowerCase().trim();
    const allocStatus = r.allocationStatus !== undefined ? r.allocationStatus
      : (engLower === 'bench' || engLower === '' ? 'Available' : 'Joined');
    db.run(
      `INSERT INTO resources (sno, ra_id, emp_name, email_id, piw_role, role_or_domain,
       previous_workex, doj, total_workex, engagement, skills, allocation_status,
       skill_type, engagement_start_date, engagement_end_date, allocation_percentage) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sno, r.raId || "", r.empName || "", r.emailId || "", r.piwRole || "",
       r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
       r.totalWorkex || "", r.engagement || "", r.skills || "", allocStatus,
       r.skillType || "", r.engagementStartDate || "", r.engagementEndDate || "",
       r.allocationPercentage !== undefined ? (r.allocationPercentage === null ? null : Number(r.allocationPercentage)) : null]
    );
    const newId = db.lastId ? db.lastId() : null;
    if (newId) {
      const ts = new Date().toISOString();
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        ['resources', newId, `${r.raId || ''} - ${r.empName || ''}`, 'created', '', 'Resource created', changedBy, ts]
      );
    }
    res.json({ ok: true, id: newId });
  } catch (err) {
    logger.error('Failed to create resource', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/batch  — update multiple resources with full audit trail
// Body: { records: [{id, ...fields, changedBy?}], changedBy?: string }
// MUST be registered before PUT /:id so Express doesn't swallow "batch" as an id
router.put("/batch", async (req, res) => {
  const { records = [], changedBy: globalChangedBy = 'system' } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records array required' });
  }
  try {
    const db = await getDb();
    let updated = 0, notFound = 0;
    for (const rec of records) {
      const { id, changedBy: perChangedBy, ...fields } = rec;
      if (!id) { notFound++; continue; }
      const result = updateOneWithAudit(db, id, fields, perChangedBy || globalChangedBy);
      if (result.notFound) notFound++;
      else updated++;
    }
    res.json({ ok: true, updated, notFound });
  } catch (err) {
    logger.error('Failed to batch update resources', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id/process-link — set or clear process_id for a resource
// MUST be registered before PUT /:id
router.put("/:id/process-link", async (req, res) => {
  const { id } = req.params;
  const { processId = null, changedBy = 'system' } = req.body;
  try {
    const db = await getDb();
    const existing = db.get("SELECT * FROM resources WHERE id=?", [parseInt(id, 10)]);
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    const ts = new Date().toISOString();
    const newProcessId = processId ? parseInt(processId, 10) : null;
    db.run(`UPDATE resources SET process_id=?, updated_at=? WHERE id=?`, [newProcessId, ts, parseInt(id, 10)]);
    const oldVal = existing.process_id !== null ? String(existing.process_id) : '';
    const newVal = newProcessId !== null ? String(newProcessId) : '';
    if (oldVal !== newVal) {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)`,
        ['resources', parseInt(id, 10), `${existing.ra_id} - ${existing.emp_name}`, 'Process Link', oldVal, newVal, changedBy, ts]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to update resource process link', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id/beeline-link — set or clear beeline_id for a resource
// MUST be registered before PUT /:id so Express doesn't treat "beeline-link" as an id
router.put("/:id/beeline-link", async (req, res) => {
  const { id } = req.params;
  const { beelineId = '', changedBy = 'system' } = req.body;
  try {
    const db = await getDb();
    const existing = db.get("SELECT * FROM resources WHERE id=?", [parseInt(id, 10)]);
    if (!existing) return res.status(404).json({ error: 'Resource not found' });
    const ts = new Date().toISOString();
    db.run(`UPDATE resources SET beeline_id=?, updated_at=? WHERE id=?`, [beelineId, ts, parseInt(id, 10)]);
    const oldVal = existing.beeline_id || '';
    if (oldVal !== String(beelineId)) {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)`,
        ['resources', parseInt(id, 10), `${existing.ra_id} - ${existing.emp_name}`, 'Beeline ID', oldVal, beelineId, changedBy, ts]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to update resource beeline link', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const r = req.body;
  const changedBy = r.changedBy || 'system';
  try {
    const db = await getDb();
    const result = updateOneWithAudit(db, id, r, changedBy);
    if (result.notFound) return res.status(404).json({ error: 'Resource not found' });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to update resource', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources  - clear ALL
router.delete("/", async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM resources");
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all resources', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/all-comments  - delete ALL resource comments
router.delete("/all-comments", async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM resource_comments");
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all resource comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/all-audit  - delete ALL audit_log entries for resources module
router.delete("/all-audit", async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM audit_log WHERE module='resources'");
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete all resource audit entries', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/resources/:id
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    db.run("DELETE FROM resources WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete resource', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
