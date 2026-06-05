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
  const { resources } = req.body;
  if (!Array.isArray(resources)) {
    return res.status(400).json({ error: "resources array required" });
  }
  try {
    const db = await getDb();
    let inserted = 0, updated = 0;

    for (const r of resources) {
      const raId = String(r.raId || r.ra_id || "").trim();
      if (!raId) continue;

      const existing = db.get("SELECT id FROM resources WHERE LOWER(ra_id) = LOWER(?)", [raId]);

      if (existing) {
        db.run(
          `UPDATE resources SET sno=?, emp_name=?, email_id=?, piw_role=?, role_or_domain=?,
           previous_workex=?, doj=?, total_workex=?, engagement=?, skills=?,
           allocation_status=?, updated_at=? WHERE id=?`,
          [r.sno || existing.sno, r.empName || "", r.emailId || "", r.piwRole || "",
           r.roleOrDomain || "", r.previousWorkex || "", r.doj || "",
           r.totalWorkex || "", r.engagement || "", r.skills || "",
           r.allocationStatus !== undefined ? r.allocationStatus : (r.allocation_status || ""),
           new Date().toISOString(), existing.id]
        );
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
        inserted++;
      }
    }

    res.json({ ok: true, inserted, updated });
  } catch (err) {
    console.error("Resource upsert error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/resources
router.post("/", async (req, res) => {
  const r = req.body;
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
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/resources/:id
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const r = req.body;
  try {
    const db = await getDb();
    db.run(
      `UPDATE resources SET emp_name=?, email_id=?, piw_role=?, role_or_domain=?,
       previous_workex=?, doj=?, total_workex=?, engagement=?, skills=?,
       allocation_status=?, updated_at=? WHERE id=?`,
      [r.empName || "", r.emailId || "", r.piwRole || "", r.roleOrDomain || "",
       r.previousWorkex || "", r.doj || "", r.totalWorkex || "",
       r.engagement || "", r.skills || "",
       r.allocationStatus !== undefined ? r.allocationStatus : (r.allocation_status || ""),
       new Date().toISOString(), id]
    );
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

module.exports = router;