/**
 * Resource API routes
 * Base path: /api/resources
 *
 * GET    /api/resources           - list all resources
 * POST   /api/resources/bulk      - upsert by ra_id (append new, overwrite existing)
 * POST   /api/resources           - create one resource
 * PUT    /api/resources/:id       - update resource
 * DELETE /api/resources/:id       - delete one resource
 * DELETE /api/resources           - delete ALL resources
 */

const express = require("express");
const router = express.Router();
const { getDb } = require("../db/connection");

// GET /api/resources/beeline-links — resources that have a non-empty beeline_id
router.get("/beeline-links", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT id, ra_id, emp_name, beeline_id FROM resources WHERE beeline_id IS NOT NULL AND beeline_id != '' ORDER BY sno`
    );
    res.json({ links: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/resources/comments-search?q=... — cross-resource comment search
router.get("/comments-search", async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const like = `%${q.trim()}%`;
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT rc.*, r.emp_name, r.ra_id, r.allocation_status, r.engagement
       FROM resource_comments rc
       JOIN resources r ON rc.resource_id = r.id
       WHERE rc.body LIKE ? OR rc.tag LIKE ? OR rc.author LIKE ? OR r.emp_name LIKE ? OR r.ra_id LIKE ?
       ORDER BY rc.created_at DESC LIMIT 100`,
      [like, like, like, like, like]
    );
    res.json({ results: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/resources
router.get("/", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all("SELECT * FROM resources ORDER BY sno");
    res.json({ resources: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
           skill_type=?, engagement_start_date=?, engagement_end_date=?,
           updated_at=? WHERE id=?`,
          [r.sno || existing.sno, r.empName || "", r.emailId || "", r.piwRole || "",
           r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
           r.totalWorkex || "", r.engagement || "", r.skills || "",
           allocStatus, r.skillType || "", r.engagementStartDate || "", r.engagementEndDate || "",
           ts, existing.id]
        );
        // Audit: log changed fields
        const recordName = `${raId} - ${r.empName || existing.emp_name}`;
        const trackFields = {
          'Employee Name': [existing.emp_name || '', r.empName || ''],
          'Email':         [existing.email_id || '', r.emailId || ''],
          'PIW Role':      [existing.piw_role || '', r.piwRole || ''],
          'Role/Domain':   [existing.role_or_domain || '', r.roleOrDomain || ''],
          'Previous Workex': [existing.previous_workex || '', r.previousWorkex || ''],
          'DOJ':           [existing.doj || '', r.doj || ''],
          'Total Workex':  [existing.total_workex || '', r.totalWorkex || ''],
          'Engagement':    [existing.engagement || '', r.engagement || ''],
          'Skills':        [existing.skills || '', r.skills || ''],
          'Allocation Status': [existing.allocation_status || '', allocStatus],
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
           previous_workex, doj, total_workex, engagement, skills, allocation_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [r.sno || sno, raId, r.empName || "", r.emailId || "", r.piwRole || "",
           r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
           r.totalWorkex || "", r.engagement || "", r.skills || "", defaultAllocStatus]
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
    res.status(500).json({ error: err.message });
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
       previous_workex, doj, total_workex, engagement, skills, allocation_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [sno, r.raId || "", r.empName || "", r.emailId || "", r.piwRole || "",
       r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
       r.totalWorkex || "", r.engagement || "", r.skills || "", allocStatus]
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
    res.status(500).json({ error: err.message });
  }
});

// ── Shared helpers ──────────────────────────────────────────────────────────

const FIELD_MAP = {
  emp_name: 'empName', email_id: 'emailId', piw_role: 'piwRole',
  role_or_domain: 'roleOrDomain', previous_workex: 'previousWorkex', doj: 'doj',
  total_workex: 'totalWorkex', engagement: 'engagement', skills: 'skills',
  allocation_status: 'allocationStatus',
};
const LABEL_MAP = {
  empName: 'Employee Name', emailId: 'Email', piwRole: 'PIW Role',
  roleOrDomain: 'Role/Domain', previousWorkex: 'Previous Workex', doj: 'DOJ',
  totalWorkex: 'Total Workex', engagement: 'Engagement', skills: 'Skills',
  allocationStatus: 'Allocation Status',
};

/**
 * Update one resource row and write audit log entries for changed fields.
 * Uses the db connection that's already open.
 * Returns { ok, notFound } — never throws.
 */
function updateOneWithAudit(db, id, r, changedBy) {
  const existing = db.get("SELECT * FROM resources WHERE id=?", [parseInt(id, 10)]);
  if (!existing) return { ok: false, notFound: true };

  const newEng = (r.engagement || "").toLowerCase().trim();
  const currentAllocStatus = existing.allocation_status || "";
  let updatedAllocStatus;
  if (r.allocationStatus !== undefined) {
    updatedAllocStatus = r.allocationStatus;
  } else if (newEng === "bench") {
    updatedAllocStatus = "Available";
  } else {
    updatedAllocStatus = currentAllocStatus;
  }

  db.run(
    `UPDATE resources SET emp_name=?, email_id=?, piw_role=?, role_or_domain=?,
     previous_workex=?, doj=?, total_workex=?, engagement=?, skills=?,
     allocation_status=?, updated_at=? WHERE id=?`,
    [r.empName || existing.emp_name, r.emailId || existing.email_id,
     r.piwRole || existing.piw_role, r.roleOrDomain || existing.role_or_domain,
     r.previousWorkex || existing.previous_workex, r.doj || existing.doj,
     r.totalWorkex || existing.total_workex,
     r.engagement !== undefined ? r.engagement : (existing.engagement || ''),
     r.skills !== undefined ? r.skills : (existing.skills || ''),
     updatedAllocStatus, new Date().toISOString(), parseInt(id, 10)]
  );

  const ts = new Date().toISOString();
  const recordName = `${existing.ra_id} - ${existing.emp_name}`;

  // Compute effective new values for diff
  const effectiveNew = {
    empName: r.empName !== undefined ? (r.empName || '') : (existing.emp_name || ''),
    emailId: r.emailId !== undefined ? (r.emailId || '') : (existing.email_id || ''),
    piwRole: r.piwRole !== undefined ? (r.piwRole || '') : (existing.piw_role || ''),
    roleOrDomain: r.roleOrDomain !== undefined ? (r.roleOrDomain || '') : (existing.role_or_domain || ''),
    previousWorkex: r.previousWorkex !== undefined ? (r.previousWorkex || '') : (existing.previous_workex || ''),
    doj: r.doj !== undefined ? (r.doj || '') : (existing.doj || ''),
    totalWorkex: r.totalWorkex !== undefined ? (r.totalWorkex || '') : (existing.total_workex || ''),
    engagement: r.engagement !== undefined ? (r.engagement || '') : (existing.engagement || ''),
    skills: r.skills !== undefined ? (r.skills || '') : (existing.skills || ''),
    allocationStatus: updatedAllocStatus,
  };

  for (const [dbCol, jsKey] of Object.entries(FIELD_MAP)) {
    const oldVal = String(existing[dbCol] || '');
    const newVal = String(effectiveNew[jsKey] || '');
    if (oldVal !== newVal) {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        ['resources', parseInt(id, 10), recordName, LABEL_MAP[jsKey] || jsKey, oldVal, newVal, changedBy, ts]
      );
    }
  }

  return { ok: true };
}

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
    res.status(500).json({ error: err.message });
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
    const oldVal = existing.process_id != null ? String(existing.process_id) : '';
    const newVal = newProcessId != null ? String(newProcessId) : '';
    if (oldVal !== newVal) {
      db.run(
        `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)`,
        ['resources', parseInt(id, 10), `${existing.ra_id} - ${existing.emp_name}`, 'Process Link', oldVal, newVal, changedBy, ts]
      );
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/resources  - clear ALL
router.delete("/", async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM resources");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// ── Resource Comments ──────────────────────────────────────────────────────

// GET /api/resources/:id/comments
router.get("/:id/comments", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(
      'SELECT * FROM resource_comments WHERE resource_id=? ORDER BY id DESC',
      [parseInt(req.params.id, 10)]
    );
    res.json({ comments: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resources/:id/comments
router.post("/:id/comments", async (req, res) => {
  const { author, tag = 'General', body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });
  try {
    const db = await getDb();
    const ts = new Date().toISOString();
    db.run(
      'INSERT INTO resource_comments (resource_id, author, tag, body, created_at) VALUES (?,?,?,?,?)',
      [parseInt(req.params.id, 10), author || 'Unknown', tag, body.trim(), ts]
    );
    const newId = db.lastId();
    res.json({ ok: true, id: newId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/resources/:id/comments/:commentId
router.delete("/:id/comments/:commentId", async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM resource_comments WHERE id=? AND resource_id=?',
      [parseInt(req.params.commentId, 10), parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;