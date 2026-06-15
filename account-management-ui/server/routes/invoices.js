const express = require("express");
const router = express.Router();
const { getDb } = require("../db/connection");
const { evaluateTriggers } = require("../utils/triggerEvaluator");

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
  const { projects, monthHeaders, changedBy } = req.body;
  if (!Array.isArray(projects)) return res.status(400).json({ error: "projects array required" });
  try {
    const db = await getDb();
    let inserted = 0, updated = 0;
    const changed_by = changedBy || 'system';
    const changed_at = new Date().toISOString();
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
        const existing = db.get("SELECT * FROM invoice_projects WHERE id=?", [p.id]);
        if (existing) {
          projectId = existing.id;
          bulkOldRecords[projectId] = existing;
          const trackFields = { project: p.project, company: p.company, code: p.code };
          const changedValues = {};
          for (const [field, newVal] of Object.entries(trackFields)) {
            const oldVal = existing[field] !== undefined ? String(existing[field]) : '';
            const newValStr = String(newVal ?? '');
            if (oldVal !== newValStr) {
              db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
                ['invoice', projectId, existing.project||'', field, oldVal, newValStr, changed_by, changed_at]);
              changedValues[field] = newVal;
            }
          }
          if ((existing.status||'') !== statusVal) {
            db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['invoice', projectId, existing.project||'', 'status', existing.status||'', statusVal, changed_by, changed_at]);
            changedValues['status'] = statusVal;
          }
          db.run("UPDATE invoice_projects SET project=?, company=?, code=?, status=?, active=?, comments=?, updated_at=? WHERE id=?",
            [p.project||"", p.company||"", p.code||"", statusVal, activeVal, p.comments||"", changed_at, projectId]);
          updated++;
          existingChangedValues[projectId] = changedValues;
        }
      }
      if (!projectId) {
        const existing = db.get("SELECT * FROM invoice_projects WHERE LOWER(project) = LOWER(?)", [p.project||""]);
        if (existing) {
          projectId = existing.id;
          bulkOldRecords[projectId] = existing;
          const trackFields = { project: p.project, company: p.company, code: p.code };
          const changedValues = {};
          for (const [field, newVal] of Object.entries(trackFields)) {
            const oldVal = existing[field] !== undefined ? String(existing[field]) : '';
            const newValStr = String(newVal ?? '');
            if (oldVal !== newValStr) {
              db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
                ['invoice', projectId, existing.project||'', field, oldVal, newValStr, changed_by, changed_at]);
              changedValues[field] = newVal;
            }
          }
          if ((existing.status||'') !== statusVal) {
            db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['invoice', projectId, existing.project||'', 'status', existing.status||'', statusVal, changed_by, changed_at]);
            changedValues['status'] = statusVal;
          }
          db.run("UPDATE invoice_projects SET project=?, company=?, code=?, status=?, active=?, comments=?, updated_at=? WHERE id=?",
            [p.project||"", p.company||"", p.code||"", statusVal, activeVal, p.comments||"", changed_at, projectId]);
          updated++;
          existingChangedValues[projectId] = changedValues;
        }
      }
      if (!projectId) {
        const maxRow = db.get("SELECT MAX(sno) as m FROM invoice_projects");
        const sno = (maxRow && maxRow.m ? maxRow.m : 0) + 1;
        db.run("INSERT INTO invoice_projects (sno, project, company, code, status, active, comments) VALUES (?,?,?,?,?,?,?)",
          [p.sno||sno, p.project||"", p.company||"", p.code||"", statusVal, activeVal, p.comments||""]);
        projectId = db.lastId();
        isInsert = true;
        inserted++;
        db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
          ['invoice', projectId, p.project||'', 'created', '', 'Project created', changed_by, changed_at]);
      }
      const invChangeParts = [];
      months.forEach((month, idx) => {
        const amount = Array.isArray(p.revenue) ? (p.revenue[idx]||0) : (p.revenue ? (p.revenue[month]||0) : 0);
        if (!isInsert) {
          const oldRev = db.get("SELECT amount FROM invoice_amounts WHERE project_id=? AND month=?", [projectId, month]);
          const oldAmt = oldRev ? (oldRev.amount || 0) : 0;
          if (oldAmt !== amount) {
            db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
              ['invoice', projectId, p.project||'', `invoice:${month}`, String(oldAmt), String(amount), changed_by, changed_at]);
            invChangeParts.push(`${month}: ${oldAmt} → ${amount}`);
          }
        }
        db.run("INSERT OR REPLACE INTO invoice_amounts (project_id, month, amount) VALUES (?,?,?)", [projectId, month, amount]);
      });

      if (!isInsert && (Object.keys(existingChangedValues[projectId] || {}).length > 0 || invChangeParts.length > 0)) {
        const cv = existingChangedValues[projectId] || {};
        if (invChangeParts.length > 0) cv['__invoice_amounts__'] = invChangeParts.join('; ');
        const updatedRec = db.get("SELECT * FROM invoice_projects WHERE id=?", [projectId]);
        if (bulkOldRecords[projectId]) {
          evaluateTriggers(db, 'invoice_projects', cv, bulkOldRecords[projectId], updatedRec || bulkOldRecords[projectId], changed_by);
        }
      }
    }
    // Fire __bulk_insert__ trigger if any new rows were added
    if (inserted > 0) {
      evaluateTriggers(db, 'invoice_projects', { __bulk_insert__: `${inserted} new record(s) added` }, null, null, changed_by);
    }
    res.json({ ok: true, inserted, updated });
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      return res.status(409).json({ error: 'Duplicate project code detected.', detail: msg });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/invoice/projects
router.post("/projects", async (req, res) => {
  const { project, company, code, status, comments, revenue, monthHeaders, changedBy } = req.body;
  try {
    const db = await getDb();
    const countRow = db.get("SELECT COUNT(*) as c FROM invoice_projects");
    const sno = (countRow ? countRow.c : 0) + 1;
    const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
    const changed_at = new Date().toISOString();
    db.run("INSERT INTO invoice_projects (sno, project, company, code, status, active, comments) VALUES (?,?,?,?,?,?,?)",
      [sno, project||"", company||"", code||"", statusVal, statusVal==='Active'?1:0, comments||""]);
    const projectId = db.lastId();

    // Log creation
    db.run("INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
      ['invoice', projectId, project||'', 'created', '', 'Project created', changedBy||'system', changed_at]);

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
  const { project, company, code, status, comments, revenue, monthHeaders, changedBy } = req.body;
  try {
    const db = await getDb();

    // Capture old values for audit
    const oldRecord = db.get("SELECT * FROM invoice_projects WHERE id=?", [id]);

    const fields = [];
    const vals = [];
    if (project !== undefined) { fields.push("project=?"); vals.push(project||""); }
    if (company !== undefined) { fields.push("company=?"); vals.push(company||""); }
    if (code !== undefined)    { fields.push("code=?");    vals.push(code||""); }
    if (comments !== undefined) { fields.push("comments=?"); vals.push(comments||""); }
    if (status !== undefined) {
      const statusVal = status === 'Inactive' ? 'Inactive' : 'Active';
      fields.push("status=?"); vals.push(statusVal);
      fields.push("active=?"); vals.push(statusVal==='Active'?1:0);
    }
    fields.push("updated_at=?"); vals.push(new Date().toISOString());
    vals.push(id);
    if (fields.length > 1) db.run(`UPDATE invoice_projects SET ${fields.join(",")} WHERE id=?`, vals);

    // Log audit entries for changed scalar fields (comments excluded — tracked in own trail)
    if (oldRecord) {
      const changed_by = changedBy || 'system';
      const changed_at = new Date().toISOString();
      const trackFields = { project, company, code };
      const newStatusVal = status !== undefined ? (status === 'Inactive' ? 'Inactive' : 'Active') : undefined;
      if (newStatusVal !== undefined) {
        const oldVal = oldRecord.status || '';
        if (oldVal !== newStatusVal) {
          db.run(
            "INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at) VALUES (?,?,?,?,?,?,?,?)",
            ['invoice', id, oldRecord.project || '', 'status', oldVal, newStatusVal, changed_by, changed_at]
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
              ['invoice', id, oldRecord.project || '', field, oldVal, newValStr, changed_by, changed_at]
            );
          }
        }
      }

      // Build changedValues for triggers (scalar fields)
      const changedValues = {};
      for (const [field, newVal] of Object.entries(trackFields)) {
        if (newVal !== undefined) changedValues[field] = newVal;
      }
      if (newStatusVal !== undefined) changedValues['status'] = newStatusVal;

      // Invoice amount changes — collect BEFORE writing
      const invChangeParts = [];
      if (revenue !== undefined && monthHeaders) {
        monthHeaders.forEach((month, idx) => {
          const newAmt = Array.isArray(revenue) ? (revenue[idx]||0) : (revenue[month]||0);
          const oldRow = db.get("SELECT amount FROM invoice_amounts WHERE project_id=? AND month=?", [id, month]);
          const oldAmt = oldRow ? (oldRow.amount || 0) : 0;
          if (oldAmt !== newAmt) invChangeParts.push(`${month}: ${oldAmt} → ${newAmt}`);
          db.run("INSERT OR REPLACE INTO invoice_amounts (project_id, month, amount) VALUES (?,?,?)", [id, month, newAmt]);
        });
      }

      if (invChangeParts.length > 0) {
        changedValues['__invoice_amounts__'] = invChangeParts.join('; ');
      }

      // Fire triggers AFTER all updates
      const updatedRecord = db.get("SELECT * FROM invoice_projects WHERE id=?", [id]);
      evaluateTriggers(db, 'invoice_projects', changedValues, oldRecord, updatedRecord || oldRecord, changed_by);
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
    const record = db.get("SELECT * FROM invoice_projects WHERE id=?", [id]);
    if (record) {
      const changedBy = req.query.changedBy || req.body?.changedBy || 'system';
      const label = record.project || String(record.id);
      evaluateTriggers(db, 'invoice_projects', { __record_delete__: `Record "${label}" was deleted` }, record, null, changedBy);
    }
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
    const count = db.get("SELECT COUNT(*) as c FROM invoice_projects");
    evaluateTriggers(db, 'invoice_projects', { __delete_all__: `${count ? count.c : 0} records deleted` }, null, null, req.body?.changedBy || 'system');
    db.run("DELETE FROM invoice_amounts");
    db.run("DELETE FROM invoice_projects");
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
