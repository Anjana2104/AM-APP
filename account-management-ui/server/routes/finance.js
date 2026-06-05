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
      if (!revMap[r.project_id]) revMap[r.project_id] = {};
      revMap[r.project_id][r.month] = r.amount;
    });

    const result = projects.map(p => ({ ...p, revenue: revMap[p.id] || {} }));
    res.json({ projects: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/projects/bulk
router.post("/projects/bulk", async (req, res) => {
  const { projects, monthHeaders } = req.body;
  if (!Array.isArray(projects)) {
    return res.status(400).json({ error: "projects array required" });
  }

  try {
    const db = await getDb();
    let inserted = 0, updated = 0;

    for (let i = 0; i < projects.length; i++) {
      const p = projects[i];
      const months = monthHeaders || [];
      const statusVal = p.status === 'Inactive' ? 'Inactive' : 'Active';
      const activeVal = statusVal === 'Active' ? 1 : 0;

      let projectId;

      if (p.id) {
        // Prefer match by DB id — handles project name renames correctly
        const existing = db.get("SELECT id FROM finance_projects WHERE id=?", [p.id]);
        if (existing) {
          projectId = existing.id;
          db.run(
            "UPDATE finance_projects SET project=?, company=?, code=?, space=?, owner=?, status=?, active=?, updated_at=? WHERE id=?",
            [p.project || "", p.company || "", p.code || "", p.space || "", p.owner || "", statusVal, activeVal, new Date().toISOString(), projectId]
          );
          updated++;
        }
      }

      if (!projectId) {
        // Fall back to name match for records without an id
        const existing = db.get(
          "SELECT id FROM finance_projects WHERE LOWER(project) = LOWER(?)",
          [p.project || ""]
        );
        if (existing) {
          projectId = existing.id;
          db.run(
            "UPDATE finance_projects SET project=?, company=?, code=?, space=?, owner=?, status=?, active=?, updated_at=? WHERE id=?",
            [p.project || "", p.company || "", p.code || "", p.space || "", p.owner || "", statusVal, activeVal, new Date().toISOString(), projectId]
          );
          updated++;
        }
      }

      if (!projectId) {
        // Insert new project
        const maxRow = db.get("SELECT MAX(sno) as m FROM finance_projects");
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run(
          "INSERT INTO finance_projects (sno, project, company, code, space, owner, status, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [p.sno || sno, p.project || "", p.company || "", p.code || "", p.space || "", p.owner || "", statusVal, activeVal]
        );
        projectId = db.lastId();
        inserted++;
      }

      // Upsert revenue rows
      months.forEach((month, idx) => {
        const amount = Array.isArray(p.revenue)
          ? (p.revenue[idx] || 0)
          : (p.revenue ? (p.revenue[month] || 0) : 0);
        db.run(
          "INSERT OR REPLACE INTO finance_revenue (project_id, month, amount) VALUES (?, ?, ?)",
          [projectId, month, amount]
        );
      });
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error("Upsert error:", err);
    const msg = err.message || '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return res.status(409).json({ error: 'Duplicate project code detected. Each project must have a unique code (derived from project name). Fix the file and re-upload.', detail: msg });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/finance/projects
router.post("/projects", async (req, res) => {
  const { project, company, code, space, owner, status, revenue, monthHeaders } = req.body;
  try {
    const db = await getDb();
    const countRow = db.get("SELECT COUNT(*) as c FROM finance_projects");
    const sno = (countRow ? countRow.c : 0) + 1;
    const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';

    db.run(
      "INSERT INTO finance_projects (sno, project, company, code, space, owner, status, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [sno, project || "", company || "", code || "", space || "", owner || "", statusVal, statusVal === 'Active' ? 1 : 0]
    );
    const projectId = db.lastId();

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
  const { project, company, code, space, owner, status, revenue, monthHeaders } = req.body;
  try {
    const db = await getDb();
    const fields = [];
    const vals = [];
    if (project !== undefined) { fields.push("project=?"); vals.push(project || ""); }
    if (company !== undefined) { fields.push("company=?"); vals.push(company || ""); }
    if (code !== undefined)    { fields.push("code=?");    vals.push(code || ""); }
    if (space !== undefined)   { fields.push("space=?");   vals.push(space || ""); }
    if (owner !== undefined)   { fields.push("owner=?");   vals.push(owner || ""); }
    if (status !== undefined) {
      const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
      fields.push("status=?");  vals.push(statusVal);
      fields.push("active=?");  vals.push(statusVal === 'Active' ? 1 : 0);
    }
    fields.push("updated_at=?"); vals.push(new Date().toISOString());
    vals.push(id);
    if (fields.length > 1) db.run(`UPDATE finance_projects SET ${fields.join(",")} WHERE id=?`, vals);

    if (revenue !== undefined && monthHeaders) {
      monthHeaders.forEach((month, idx) => {
        const amount = Array.isArray(revenue) ? (revenue[idx] || 0) : (revenue[month] || 0);
        db.run(
          "INSERT OR REPLACE INTO finance_revenue (project_id, month, amount) VALUES (?, ?, ?)",
          [id, month, amount]
        );
      });
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
    db.run("DELETE FROM finance_revenue");
    db.run("DELETE FROM finance_projects");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;