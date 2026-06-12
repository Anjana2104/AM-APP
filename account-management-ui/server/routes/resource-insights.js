const express = require("express");
const router = express.Router();
const { getDb } = require("../db/connection");

// GET /api/resource-insights/search?q=... — cross-resource search — MUST be before /:id
router.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const like = `%${q.trim()}%`;
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT ri.*, r.emp_name, r.ra_id, r.allocation_status, r.engagement
       FROM resource_insights ri
       JOIN resources r ON ri.resource_id = r.id
       WHERE ri.title LIKE ? OR ri.body LIKE ? OR ri.tag LIKE ? OR ri.author LIKE ? OR r.emp_name LIKE ? OR r.ra_id LIKE ?
       ORDER BY ri.created_at DESC LIMIT 100`,
      [like, like, like, like, like, like]
    );
    res.json({ results: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/resource-insights/stats?resourceId=X — MUST be before /:id
router.get("/stats", async (req, res) => {
  const { resourceId } = req.query;
  if (!resourceId) return res.status(400).json({ error: 'resourceId required' });
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT section, COUNT(*) as count, MAX(created_at) as last_at
       FROM resource_insights WHERE resource_id=? GROUP BY section`,
      [parseInt(resourceId, 10)]
    );
    res.json({ stats: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/resource-insights?resourceId=X&section=Y (section optional)
router.get("/", async (req, res) => {
  const { resourceId, section } = req.query;
  if (!resourceId) return res.status(400).json({ error: 'resourceId required' });
  try {
    const db = await getDb();
    let sql = 'SELECT * FROM resource_insights WHERE resource_id=?';
    const params = [parseInt(resourceId, 10)];
    if (section) { sql += ' AND section=?'; params.push(section); }
    sql += ' ORDER BY id DESC';
    const rows = db.all(sql, params);
    res.json({ entries: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/resource-insights
router.post("/", async (req, res) => {
  const { resourceId, section, title, body, tag, status = 'open', priority = 'medium', targetDate = null, author } = req.body;
  if (!resourceId || !section) return res.status(400).json({ error: 'resourceId and section required' });
  try {
    const db = await getDb();
    const ts = new Date().toISOString();
    db.run(
      `INSERT INTO resource_insights (resource_id, section, title, body, tag, status, priority, target_date, author, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [parseInt(resourceId, 10), section, title || '', body || '', tag || '', status, priority, targetDate, author || '', ts, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/resource-insights/:id
router.put("/:id", async (req, res) => {
  const { title, body, tag, status, priority, targetDate, author } = req.body;
  try {
    const db = await getDb();
    const ts = new Date().toISOString();
    db.run(
      `UPDATE resource_insights SET title=?, body=?, tag=?, status=?, priority=?, target_date=?, author=?, updated_at=? WHERE id=?`,
      [title || '', body || '', tag || '', status || 'open', priority || 'medium', targetDate || null, author || '', ts, parseInt(req.params.id, 10)]
    );
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/resource-insights/:id
router.delete("/:id", async (req, res) => {
  try {
    const db = await getDb();
    db.run('DELETE FROM resource_insights WHERE id=?', [parseInt(req.params.id, 10)]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
