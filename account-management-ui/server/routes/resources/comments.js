'use strict';

const express = require("express");
const router = express.Router();
const { getDb } = require("../../db/connection");
const logger = require("../../utils/logger");

// GET /api/resources/:id/comments
router.get("/:id/comments", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT
         rc.*,
         CASE
           WHEN rc.source_module = 'stakeholder_escalation'
             THEN COALESCE(NULLIF(rc.reported_by, ''), te.name, '')
           WHEN rc.tag = 'Escalations'
             THEN COALESCE(
               NULLIF(rc.reported_by, ''),
               (
                 SELECT te2.name
                 FROM stakeholder_comment_resources scr2
                 JOIN stakeholder_comments sc2 ON sc2.id = scr2.stakeholder_comment_id
                 LEFT JOIN team_hierarchy_entries te2 ON te2.id = sc2.stakeholder_id
                 WHERE scr2.resource_id = rc.resource_id
                   AND sc2.tag = 'Escalations'
                   AND LOWER(TRIM(sc2.body)) = LOWER(TRIM(rc.body))
                 ORDER BY sc2.updated_at DESC, sc2.created_at DESC, sc2.id DESC
                 LIMIT 1
               ),
               ''
             )
           ELSE COALESCE(rc.reported_by, '')
         END AS reported_by
       FROM resource_comments rc
       LEFT JOIN stakeholder_comments sc
         ON rc.source_module = 'stakeholder_escalation' AND sc.id = rc.source_ref_id
       LEFT JOIN team_hierarchy_entries te
         ON te.id = sc.stakeholder_id
       WHERE rc.resource_id = ?
       ORDER BY rc.id DESC`,
      [parseInt(req.params.id, 10)]
    );
    res.json({ comments: rows });
  } catch (err) {
    logger.error('Failed to fetch resource comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
    logger.error('Failed to create resource comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/resources/:id/comments/:commentId
router.put("/:id/comments/:commentId", async (req, res) => {
  const { body, tag } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'body required' });
  try {
    const db = await getDb();
    const ts = new Date().toISOString();
    db.run(
      'UPDATE resource_comments SET body=?, tag=COALESCE(NULLIF(?,\'\'), tag), updated_at=? WHERE id=? AND resource_id=?',
      [body.trim(), tag || '', ts, parseInt(req.params.commentId, 10), parseInt(req.params.id, 10)]
    );
    res.json({ ok: true, updated_at: ts });
  } catch (err) {
    logger.error('Failed to update resource comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
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
    logger.error('Failed to delete resource comment', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
