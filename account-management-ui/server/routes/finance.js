/**
 * Finance API routes
 * Base path: /api/finance
 *
 * GET    /api/finance/projects           - list all projects + revenue
 * GET    /api/finance/month-headers      - distinct month headers in order
 * POST   /api/finance/projects/bulk      - replace all data (full upload)
 * POST   /api/finance/projects           - create one project
 * PUT    /api/finance/projects/:id       - update project fields
 * DELETE /api/finance/projects/:id       - delete project
 */

const express = require("express");
const router = express.Router();
const { getDb } = require("../db/connection");
const { evaluateTriggers } = require("../utils/triggerEvaluator");

// Month ordering helper
const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthSortKey(m) {
  const match = m.match(/([A-Za-z]{3})['''`]?(\d{2,4})/);
  if (!match) return 0;
  const yr = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
  const mo = MONTH_ORDER.indexOf(match[1]);
  return yr * 100 + mo;
}

// GET /api/finance/month-headers
router.get("/month-headers", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all("SELECT DISTINCT month FROM finance_revenue");
    const months = rows.map(r => r.month).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    res.json({ months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/finance/projects
router.get("/projects", async (req, res) => {
  try {
    const db = await getDb();
    const projects = db.all("SELECT * FROM finance_projects ORDER BY sno");
    const revenues = db.all("SELECT * FROM finance_revenue");

    const revMap = {};
    revenues.forEach(r => {
      if (!revMap[r.project_id]) revMap[r.project_id] = { amounts: {}, types: {} };
      revMap[r.project_id].amounts[r.month] = r.amount;
      revMap[r.project_id].types[r.month] = r.milestone_type || 'booked';
    });

    const result = projects.map(p => ({
      ...p,
      revenue: revMap[p.id]?.amounts || {},
      milestoneTypes: revMap[p.id]?.types || {},
    }));
    res.json({ projects: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/projects/bulk
router.post("/projects/bulk", async (req, res) => {
  const { projects, monthHeaders, changedBy } = req.body;
  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: "projects array required" });
  }

  try {
    const db = await getDb();
    let inserted = 0, updated = 0;
    const changed_by = changedBy || 'system';
    const changed_at = new Date().toISOString();
    // Track per-project changed values and old records for trigger evaluation
    const bulkOldRecords = {};
    const existingChangedValues = {};

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      const months = monthHeaders || [];
      const statusVal = p.status === 'Inactive' ? 'Inactive' : 'Active';
      const activeVal = statusVal === 'Active' ? 1 : 0;

      let projectId;
      let isInsert = false;

      if (p.id) {
        // Prefer match by DB id — handles project name renames correctly
        const existing = db.get("SELECT * FROM finance_projects WHERE id=?", [p.id]);
        if (existing) {
          projectId = existing.id;
          bulkOldRecords[projectId] = existing;

          // Log field changes
          const trackFields = { project: p.project, company: p.company, code: p.code, space: p.space, owner: p.owner };
          const changedValues = {};
          for (const [field, newVal] of Object.entries(trackFields)) {
            const oldVal = existing[field] !== undefined ? String(existing[field]) : '';
            const newValStr = String(newVal ?? '');
            if (oldVal !== newValStr) {
              db.run(
                "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
                ['finance', projectId, existing.project || '', field, oldVal, newValStr, changed_by, changed_at]
              );
              changedValues[field] = newVal;
            }
          }
          const newStatus = statusVal;
          if ((existing.status || '') !== newStatus) {
            db.run(
              "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['finance', projectId, existing.project || '', 'status', existing.status || '', newStatus, changed_by, changed_at]
            );
            changedValues['status'] = newStatus;
          }
          // Track comments changes too
          const oldComments = existing.comments !== undefined ? String(existing.comments ?? '') : '';
          const newComments = p.comments !== undefined ? String(p.comments ?? '') : '';
          if (oldComments !== newComments) changedValues['comments'] = p.comments || '';

          db.run(
            "UPDATE finance_projects SET project=?, company=?, code=?, space=?, owner=?, status=?, active=?, comments=?, updated_at=? WHERE id=?",
            [p.project || "", p.company || "", p.code || "", p.space || "", p.owner || "", statusVal, activeVal, p.comments || "", changed_at, projectId]
          );
          updated++;
          existingChangedValues[projectId] = changedValues;
        }
      }

      if (!projectId) {
        // Fall back to name match for records without an id
        const existing = db.get(
          "SELECT * FROM finance_projects WHERE LOWER(project) = LOWER(?)",
          [p.project || ""]
        );
        if (existing) {
          projectId = existing.id;
          bulkOldRecords[projectId] = existing;

          const trackFields = { project: p.project, company: p.company, code: p.code, space: p.space, owner: p.owner };
          const changedValues = {};
          for (const [field, newVal] of Object.entries(trackFields)) {
            const oldVal = existing[field] !== undefined ? String(existing[field]) : '';
            const newValStr = String(newVal ?? '');
            if (oldVal !== newValStr) {
              db.run(
                "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
                ['finance', projectId, existing.project || '', field, oldVal, newValStr, changed_by, changed_at]
              );
              changedValues[field] = newVal;
            }
          }
          if ((existing.status || '') !== statusVal) {
            db.run(
              "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['finance', projectId, existing.project || '', 'status', existing.status || '', statusVal, changed_by, changed_at]
            );
            changedValues['status'] = statusVal;
          }
          const oldComments2 = existing.comments !== undefined ? String(existing.comments ?? '') : '';
          const newComments2 = p.comments !== undefined ? String(p.comments ?? '') : '';
          if (oldComments2 !== newComments2) changedValues['comments'] = p.comments || '';

          db.run(
            "UPDATE finance_projects SET project=?, company=?, code=?, space=?, owner=?, status=?, active=?, comments=?, updated_at=? WHERE id=?",
            [p.project || "", p.company || "", p.code || "", p.space || "", p.owner || "", statusVal, activeVal, p.comments || "", changed_at, projectId]
          );
          updated++;
          existingChangedValues[projectId] = changedValues;
        }
      }

      if (!projectId) {
        // Insert new project
        const maxRow = db.get("SELECT MAX(sno) as m FROM finance_projects");
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run(
          "INSERT INTO finance_projects (sno, project, company, code, space, owner, status, active, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [p.sno || sno, p.project || "", p.company || "", p.code || "", p.space || "", p.owner || "", statusVal, activeVal, p.comments || ""]
        );
        projectId = db.lastId();
        isInsert = true;
        inserted++;

        // Log creation
        db.run(
          "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
          ['finance', projectId, p.project || '', 'created', '', 'Project created', changed_by, changed_at]
        );
      }

      // Upsert revenue rows with milestone_type; log month data changes; collect for triggers
      const revChangeParts = [];
      months.forEach((month, idx) => {
        const amount = Array.isArray(p.revenue)
          ? (p.revenue[idx] || 0)
          : (p.revenue ? (p.revenue[month] || 0) : 0);
        const milestoneType = (p.milestoneTypes && p.milestoneTypes[month]) === 'anticipated' ? 'anticipated' : 'booked';

        if (!isInsert) {
          const oldRev = db.get("SELECT amount, milestone_type FROM finance_revenue WHERE project_id=? AND month=?", [projectId, month]);
          const oldAmt = oldRev ? (oldRev.amount || 0) : 0;
          const oldMilestone = oldRev ? (oldRev.milestone_type || 'booked') : 'booked';
          if (oldAmt !== amount) {
            db.run(
              "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['finance', projectId, p.project || '', `revenue:${month}`, String(oldAmt), String(amount), changed_by, changed_at]
            );
            revChangeParts.push(`${month}: ${oldAmt} → ${amount}`);
          }
          if (oldMilestone !== milestoneType) {
            revChangeParts.push(`${month} type: ${oldMilestone} → ${milestoneType}`);
          }
        }

        db.run(
          "INSERT OR REPLACE INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, ?, ?)",
          [projectId, month, amount, milestoneType]
        );
      });

      // Fire triggers for this project if anything changed (scalar or revenue)
      if (!isInsert && (Object.keys(existingChangedValues[projectId] || {}).length > 0 || revChangeParts.length > 0)) {
        const cv = existingChangedValues[projectId] || {};
        if (revChangeParts.length > 0) cv['__revenue__'] = revChangeParts.join('; ');
        const existingRec = db.get("SELECT * FROM finance_projects WHERE id=?", [projectId]);
        // oldRecord stored before update
        if (bulkOldRecords[projectId]) {
          evaluateTriggers(db, 'finance_projects', cv, bulkOldRecords[projectId], existingRec || bulkOldRecords[projectId], changed_by);
        }
      }
    }

    // Fire __bulk_insert__ trigger if any new rows were added
    if (inserted > 0) {
      evaluateTriggers(db, 'finance_projects', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, changed_by);
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return res.status(409).json({ error: 'Duplicate project code detected. Each project must have a unique code (derived from project name). Fix the file and re-upload.', detail: msg });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/projects
router.post("/projects", async (req, res) => {
  const { project, company, code, space, owner, status, revenue, monthHeaders, comments, changedBy } = req.body;
  try {
    const db = await getDb();
    const countRow = db.get("SELECT COUNT(*) as c FROM finance_projects");
    const sno = (countRow ? countRow.c : 0) + 1;
    const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
    const changed_at = new Date().toISOString();

    db.run(
      "INSERT INTO finance_projects (sno, project, company, code, space, owner, status, active, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [sno, project || "", company || "", code || "", space || "", owner || "", statusVal, statusVal === 'Active' ? 1 : 0, comments || ""]
    );
    const projectId = db.lastId();

    // Log creation
    db.run(
      "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
      ['finance', projectId, project || '', 'created', '', 'Project created', changedBy || 'system', changed_at]
    );

    if (revenue && monthHeaders) {
      monthHeaders.forEach((month, idx) => {
        const amount = Array.isArray(revenue) ? (revenue[idx] || 0) : (revenue[month] || 0);
        if (amount) {
          db.run(
            "INSERT OR REPLACE INTO finance_revenue (project_id, month, amount) VALUES (?, ?, ?)",
            [projectId, month, amount]
          );
        }
      });
    }

    res.json({ ok: true, id: projectId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/projects/:id
// Only updates fields that are present in the request body — safe for partial updates (e.g. status-only toggle)
router.put("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const { project, company, code, space, owner, status, revenue, monthHeaders, comments, milestoneTypes, changedBy } = req.body;
  try {
    const db = await getDb();

    // Capture old values for audit
    const oldRecord = db.get("SELECT * FROM finance_projects WHERE id=?", [id]);

    const fields = [];
    const vals = [];
    if (project !== undefined) { fields.push("project=?"); vals.push(project || ""); }
    if (company !== undefined) { fields.push("company=?"); vals.push(company || ""); }
    if (code !== undefined)    { fields.push("code=?");    vals.push(code || ""); }
    if (space !== undefined)   { fields.push("space=?");   vals.push(space || ""); }
    if (owner !== undefined)   { fields.push("owner=?");   vals.push(owner || ""); }
    if (comments !== undefined){ fields.push("comments=?"); vals.push(comments || ""); }
    if (status !== undefined) {
      const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
      fields.push("status=?");  vals.push(statusVal);
      fields.push("active=?");  vals.push(statusVal === 'Active' ? 1 : 0);
    }
    fields.push("updated_at=?"); vals.push(new Date().toISOString());
    vals.push(id);
    if (fields.length > 1) db.run(`UPDATE finance_projects SET ${fields.join(",")} WHERE id=?`, vals);

    // Log audit entries for changed scalar fields (comments excluded — tracked in own trail)
    if (oldRecord) {
      const changed_by = changedBy || 'system';
      const changed_at = new Date().toISOString();
      const trackFields = { project, company, code, space, owner };
      // Handle status separately (resolve to display value)
      const newStatusVal = status !== undefined ? (status === 'Inactive' ? 'Inactive' : 'Active') : undefined;
      if (newStatusVal !== undefined) {
        const oldVal = oldRecord.status || '';
        if (oldVal !== newStatusVal) {
          db.run(
            "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
            ['finance', id, oldRecord.project || '', 'status', oldVal, newStatusVal, changed_by, changed_at]
          );
        }
      }
      for (const [field, newVal] of Object.entries(trackFields)) {
        if (newVal !== undefined) {
          const oldVal = oldRecord[field] !== undefined ? String(oldRecord[field]) : '';
          const newValStr = String(newVal ?? '');
          if (oldVal !== newValStr) {
            db.run(
              "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['finance', id, oldRecord.project || '', field, oldVal, newValStr, changed_by, changed_at]
            );
          }
        }
      }

      // Build changedValues for triggers (scalar fields — including comments and status)
      const changedValues = {};
      for (const [field, newVal] of Object.entries(trackFields)) {
        if (newVal !== undefined) changedValues[field] = newVal;
      }
      if (newStatusVal !== undefined) changedValues['status'] = newStatusVal;
      // Include comments change if present
      if (comments !== undefined) {
        const oldComments = oldRecord.comments !== undefined ? String(oldRecord.comments ?? '') : '';
        if (String(comments ?? '') !== oldComments) changedValues['comments'] = comments;
      }

      // Revenue / milestone changes — collect BEFORE writing so we can compare
      const revChangeParts = [];
      if (revenue !== undefined && monthHeaders) {
        monthHeaders.forEach((month, idx) => {
          const newAmt = Array.isArray(revenue) ? (revenue[idx] || 0) : (revenue[month] || 0);
          const oldRow = db.get("SELECT amount, milestone_type FROM finance_revenue WHERE project_id=? AND month=?", [id, month]);
          const oldAmt = oldRow ? (oldRow.amount || 0) : 0;
          const newMilestone = (milestoneTypes && milestoneTypes[month]) === 'anticipated' ? 'anticipated' : 'booked';
          const oldMilestone = oldRow ? (oldRow.milestone_type || 'booked') : 'booked';
          if (oldAmt !== newAmt) revChangeParts.push(`${month}: ${oldAmt} → ${newAmt}`);
          if (oldMilestone !== newMilestone) revChangeParts.push(`${month} type: ${oldMilestone} → ${newMilestone}`);
          db.run("INSERT OR REPLACE INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, ?, ?)", [id, month, newAmt, newMilestone]);
        });
      } else if (milestoneTypes && typeof milestoneTypes === 'object') {
        for (const [month, type] of Object.entries(milestoneTypes)) {
          const milestoneType = type === 'anticipated' ? 'anticipated' : 'booked';
          const oldRow = db.get("SELECT id, amount, milestone_type FROM finance_revenue WHERE project_id=? AND month=?", [id, month]);
          const oldMilestone = oldRow ? (oldRow.milestone_type || 'booked') : 'booked';
          if (oldMilestone !== milestoneType) revChangeParts.push(`${month} type: ${oldMilestone} → ${milestoneType}`);
          if (oldRow) {
            db.run("UPDATE finance_revenue SET milestone_type=? WHERE project_id=? AND month=?", [milestoneType, id, month]);
          } else {
            db.run("INSERT INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, 0, ?)", [id, month, milestoneType]);
          }
        }
      }

      if (revChangeParts.length > 0) {
        changedValues['__revenue__'] = revChangeParts.join('; ');
      }

      // Fire triggers AFTER all updates
      const updatedRecord = db.get("SELECT * FROM finance_projects WHERE id=?", [id]);
      evaluateTriggers(db, 'finance_projects', changedValues, oldRecord, updatedRecord || oldRecord, changed_by);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/finance/projects/:id/milestone-types  — upsert milestone types without changing amounts
router.put("/projects/:id/milestone-types", async (req, res) => {
  const { id } = req.params;
  const { types } = req.body;
  if (!types || typeof types !== 'object') {
    return res.status(400).json({ error: 'types object required' });
  }
  try {
    const db = await getDb();
    for (const [month, type] of Object.entries(types)) {
      const milestoneType = type === 'anticipated' ? 'anticipated' : 'booked';
      // Use INSERT OR REPLACE so rows with amount=0 (never inserted before) are also persisted
      const existing = db.get(
        "SELECT id, amount FROM finance_revenue WHERE project_id=? AND month=?",
        [id, month]
      );
      if (existing) {
        db.run(
          "UPDATE finance_revenue SET milestone_type=? WHERE project_id=? AND month=?",
          [milestoneType, id, month]
        );
      } else {
        db.run(
          "INSERT INTO finance_revenue (project_id, month, amount, milestone_type) VALUES (?, ?, 0, ?)",
          [id, month, milestoneType]
        );
      }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/projects/:id
router.delete("/projects/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const record = db.get("SELECT * FROM finance_projects WHERE id=?", [id]);
    if (record) {
      const changedBy = req.query.changedBy || req.body?.changedBy || 'system';
      const label = record.project || String(record.id);
      evaluateTriggers(db, 'finance_projects', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
    }
    db.run("DELETE FROM finance_revenue WHERE project_id=?", [id]);
    db.run("DELETE FROM finance_projects WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/finance/projects  — clear ALL data
router.delete("/projects", async (req, res) => {
  try {
    const db = await getDb();
    const count = db.get("SELECT COUNT(*) as c FROM finance_projects");
    evaluateTriggers(db, 'finance_projects', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    db.run("DELETE FROM finance_revenue");
    db.run("DELETE FROM finance_projects");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;