const express = require("express");
const router = express.Router();
const { getDb } = require("../db/connection");

const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function monthSortKey(m) {
  const match = m.match(/([A-Za-z]{3})['''`]?(\d{2,4})/);
  if (!match) return 0;
  const yr = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
  const mo = MONTH_ORDER.indexOf(match[1]);
  return yr * 100 + mo;
}

// GET /api/invoice/month-headers
router.get("/month-headers", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all("SELECT DISTINCT month FROM invoice_amounts");
    const months = rows.map(r => r.month).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    res.json({ months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/invoice/projects
router.get("/projects", async (req, res) => {
  try {
    const db = await getDb();
    const projects = db.all("SELECT * FROM invoice_projects ORDER BY sno");
    const amounts = db.all("SELECT * FROM invoice_amounts");
    const amtMap = {};
    amounts.forEach(r => {
      if (!amtMap[r.project_id]) amtMap[r.project_id] = {};
      amtMap[r.project_id][r.month] = r.amount;
    });
    const result = projects.map(p => ({ ...p, revenue: amtMap[p.id] || {} }));
    res.json({ projects: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoice/projects/bulk
router.post("/projects/bulk", async (req, res) => {
  const { projects, monthHeaders } = req.body;
  if (!Array.isArray(projects)) return res.status(400).json({ error: "projects array required" });
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
        const existing = db.get("SELECT id FROM invoice_projects WHERE id=?", [p.id]);
        if (existing) {
          projectId = existing.id;
          db.run("UPDATE invoice_projects SET project=?, company=?, code=?, status=?, active=?, updated_at=? WHERE id=?",
            [p.project||"", p.company||"", p.code||"", statusVal, activeVal, new Date().toISOString(), projectId]);
          updated++;
        }
      }
      if (!projectId) {
        const existing = db.get("SELECT id FROM invoice_projects WHERE LOWER(project) = LOWER(?)", [p.project||""]);
        if (existing) {
          projectId = existing.id;
          db.run("UPDATE invoice_projects SET project=?, company=?, code=?, status=?, active=?, updated_at=? WHERE id=?",
            [p.project||"", p.company||"", p.code||"", statusVal, activeVal, new Date().toISOString(), projectId]);
          updated++;
        }
      }
      if (!projectId) {
        const maxRow = db.get("SELECT MAX(sno) as m FROM invoice_projects");
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run("INSERT INTO invoice_projects (sno, project, company, code, status, active) VALUES (?,?,?,?,?,?)",
          [p.sno||sno, p.project||"", p.company||"", p.code||"", statusVal, activeVal]);
        projectId = db.lastId();
        inserted++;
      }
      months.forEach((month, idx) => {
        const amount = Array.isArray(p.revenue) ? (p.revenue[idx]||0) : (p.revenue ? (p.revenue[month]||0) : 0);
        db.run("INSERT OR REPLACE INTO invoice_amounts (project_id, month, amount) VALUES (?,?,?)", [projectId, month, amount]);
      });
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error("Invoice upsert error:", err);
    const msg = err.message || '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return res.status(409).json({ error: 'Duplicate project code detected.', detail: msg });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoice/projects
router.post("/projects", async (req, res) => {
  const { project, company, code, status, revenue, monthHeaders } = req.body;
  try {
    const db = await getDb();
    const countRow = db.get("SELECT COUNT(*) as c FROM invoice_projects");
    const sno = (countRow ? countRow.c : 0) + 1;
    const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
    db.run("INSERT INTO invoice_projects (sno, project, company, code, status, active) VALUES (?,?,?,?,?,?)",
      [sno, project||"", company||"", code||"", statusVal, statusVal==='Active'?1:0]);
    const projectId = db.lastId();
    if (revenue && monthHeaders) {
      monthHeaders.forEach((month, idx) => {
        const amount = Array.isArray(revenue) ? (revenue[idx]||0) : (revenue[month]||0);
        if (amount) db.run("INSERT OR REPLACE INTO invoice_amounts (project_id, month, amount) VALUES (?,?,?)", [projectId, month, amount]);
      });
    }
    res.json({ ok: true, id: projectId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/invoice/projects/:id
router.put("/projects/:id", async (req, res) => {
  const { id } = req.params;
  const { project, company, code, status, revenue, monthHeaders } = req.body;
  try {
    const db = await getDb();
    const fields = [];
    const vals = [];
    if (project !== undefined) { fields.push("project=?"); vals.push(project||""); }
    if (company !== undefined) { fields.push("company=?"); vals.push(company||""); }
    if (code !== undefined)    { fields.push("code=?");    vals.push(code||""); }
    if (status !== undefined) {
      const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
      fields.push("status=?"); vals.push(statusVal);
      fields.push("active=?"); vals.push(statusVal==='Active'?1:0);
    }
    fields.push("updated_at=?"); vals.push(new Date().toISOString());
    vals.push(id);
    if (fields.length > 1) db.run(`UPDATE invoice_projects SET ${fields.join(",")} WHERE id=?`, vals);
    if (revenue !== undefined && monthHeaders) {
      monthHeaders.forEach((month, idx) => {
        const amount = Array.isArray(revenue) ? (revenue[idx]||0) : (revenue[month]||0);
        db.run("INSERT OR REPLACE INTO invoice_amounts (project_id, month, amount) VALUES (?,?,?)", [id, month, amount]);
      });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoice/projects/:id
router.delete("/projects/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    db.run("DELETE FROM invoice_amounts WHERE project_id=?", [id]);
    db.run("DELETE FROM invoice_projects WHERE id=?", [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/invoice/projects
router.delete("/projects", async (req, res) => {
  try {
    const db = await getDb();
    db.run("DELETE FROM invoice_amounts");
    db.run("DELETE FROM invoice_projects");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
