'use strict';

const express = require("express");
const router = express.Router();
const { getDb } = require("../../db/connection");
const logger = require("../../utils/logger");

// GET /api/resources/beeline-links — resources that have a non-empty beeline_id
router.get("/beeline-links", async (req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT id, ra_id, emp_name, beeline_id FROM resources WHERE beeline_id IS NOT NULL AND beeline_id != '' ORDER BY sno`
    );
    res.json({ links: rows });
  } catch (err) {
    logger.error('Failed to fetch resource beeline links', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/resources/comments-search?q=... — cross-resource comment search
router.get("/comments-search", async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ results: [] });
  const like = `%${q.trim()}%`;
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
         END AS reported_by,
         r.emp_name, r.ra_id, r.allocation_status, r.engagement
       FROM resource_comments rc
       LEFT JOIN stakeholder_comments sc
         ON rc.source_module = 'stakeholder_escalation' AND sc.id = rc.source_ref_id
       LEFT JOIN team_hierarchy_entries te
         ON te.id = sc.stakeholder_id
       JOIN resources r ON rc.resource_id = r.id
       WHERE rc.body LIKE ? OR rc.tag LIKE ? OR rc.author LIKE ? OR r.emp_name LIKE ? OR r.ra_id LIKE ?
       ORDER BY rc.created_at DESC LIMIT 100`,
      [like, like, like, like, like]
    );
    res.json({ results: rows });
  } catch (err) {
    logger.error('Failed to search resource comments', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
