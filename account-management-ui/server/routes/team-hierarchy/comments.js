'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../../db/connection');
const logger = require('../../utils/logger');
const { normalizeTeamType, normalizeCommentTag, asIntList, toStakeholderCommentApiRow, upsertEscalationResourceLinks, createClientRequestForRequirement } = require('./helpers');

router.get('/comments', async (req, res) => {
  const teamType = normalizeTeamType(req.query.teamType);
  if (!teamType) {
    return res.status(400).json({ error: 'Valid teamType is required (client | ra)' });
  }
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT sc.*, te.name AS stakeholder_name, te.title AS stakeholder_title
       FROM stakeholder_comments sc
       JOIN team_hierarchy_entries te ON te.id = sc.stakeholder_id
       WHERE sc.stakeholder_team_type = ?
       ORDER BY sc.created_at DESC, sc.id DESC`,
      [teamType]
    );
    const comments = rows.map(row => {
      const linkedResourceRows = db.all(
        `SELECT r.id, r.ra_id, r.emp_name
         FROM stakeholder_comment_resources scr
         JOIN resources r ON r.id = scr.resource_id
         WHERE scr.stakeholder_comment_id = ?
         ORDER BY r.emp_name ASC`,
        [row.id]
      );
      return toStakeholderCommentApiRow(
        row,
        linkedResourceRows.map(item => Number(item.id)),
        linkedResourceRows.map(item => `${item.ra_id} - ${item.emp_name}`)
      );
    });
    res.json({ comments });
  } catch (err) {
    logger.error('Failed to fetch stakeholder comments', { err: err.message, teamType });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:stakeholderId/comments', async (req, res) => {
  const stakeholderId = String(req.params.stakeholderId || '').trim();
  if (!stakeholderId) {
    return res.status(400).json({ error: 'stakeholderId is required' });
  }
  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT sc.*, te.name AS stakeholder_name, te.title AS stakeholder_title
       FROM stakeholder_comments sc
       LEFT JOIN team_hierarchy_entries te ON te.id = sc.stakeholder_id
       WHERE sc.stakeholder_id = ?
       ORDER BY sc.created_at DESC, sc.id DESC`,
      [stakeholderId]
    );
    const comments = rows.map(row => {
      const linkedResourceRows = db.all(
        `SELECT r.id, r.ra_id, r.emp_name
         FROM stakeholder_comment_resources scr
         JOIN resources r ON r.id = scr.resource_id
         WHERE scr.stakeholder_comment_id = ?
         ORDER BY r.emp_name ASC`,
        [row.id]
      );
      return toStakeholderCommentApiRow(
        row,
        linkedResourceRows.map(item => Number(item.id)),
        linkedResourceRows.map(item => `${item.ra_id} - ${item.emp_name}`)
      );
    });
    res.json({ comments });
  } catch (err) {
    logger.error('Failed to fetch stakeholder comments by stakeholder', { err: err.message, stakeholderId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:stakeholderId/comments', async (req, res) => {
  const stakeholderId = String(req.params.stakeholderId || '').trim();
  const { author = 'system', tag, body, linkedResourceIds = [], changedBy = 'system' } = req.body;
  const normalizedTag = normalizeCommentTag(tag);
  if (!stakeholderId) return res.status(400).json({ error: 'stakeholderId is required' });
  if (!normalizedTag) return res.status(400).json({ error: 'Invalid comment tag' });
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Comment body is required' });
  const trimmedBody = String(body).trim();
  const resources = normalizedTag === 'Escalations' ? asIntList(linkedResourceIds) : [];
  try {
    const db = await getDb();
    const stakeholder = db.get(
      'SELECT id, name, team_type FROM team_hierarchy_entries WHERE id = ?',
      [stakeholderId]
    );
    if (!stakeholder) {
      return res.status(404).json({ error: 'Stakeholder not found' });
    }
    const ts = new Date().toISOString();
    const commentAuthor = String(author || changedBy || 'system');
    db.run(
      `INSERT INTO stakeholder_comments
       (stakeholder_id, stakeholder_team_type, author, tag, body, requirement_status, account_anchor, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stakeholderId,
        stakeholder.team_type,
        commentAuthor,
        normalizedTag,
        trimmedBody,
        '',
        '',
        ts,
        ts,
      ]
    );
    const commentId = db.lastId();
    if (!commentId) {
      return res.status(500).json({ error: 'Failed to create comment' });
    }
    if (resources.length) {
      upsertEscalationResourceLinks(
        db,
        commentId,
        commentAuthor,
        stakeholder.name || '',
        trimmedBody,
        resources,
        ts
      );
    }
    if (normalizedTag === 'Current Requirement' || normalizedTag === 'Future Requirement') {
      const linkedRequest = createClientRequestForRequirement(db, {
        requirementTag: normalizedTag,
        commentBody: trimmedBody,
        reporterName: stakeholder.name || '',
        createdAt: ts,
        changedBy: commentAuthor,
      });
      if (linkedRequest?.requestId) {
        db.run(
          `UPDATE stakeholder_comments
           SET requirement_request_id = ?, requirement_request_beeline = ?, updated_at = ?
           WHERE id = ?`,
          [linkedRequest.requestId, linkedRequest.beelineId || '', ts, commentId]
        );
      }
    }
    res.json({ ok: true, id: commentId });
  } catch (err) {
    logger.error('Failed to create stakeholder comment', { err: err.message, stakeholderId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:stakeholderId/comments/:commentId', async (req, res) => {
  const stakeholderId = String(req.params.stakeholderId || '').trim();
  const commentId = Number.parseInt(req.params.commentId, 10);
  const { body, linkedResourceIds = [], changedBy = 'system' } = req.body;
  if (!stakeholderId) return res.status(400).json({ error: 'stakeholderId is required' });
  if (!Number.isFinite(commentId)) return res.status(400).json({ error: 'Valid commentId is required' });
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'Comment body is required' });
  try {
    const db = await getDb();
    const existing = db.get(
      `SELECT * FROM stakeholder_comments WHERE id = ? AND stakeholder_id = ?`,
      [commentId, stakeholderId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const stakeholder = db.get(
      'SELECT name FROM team_hierarchy_entries WHERE id = ?',
      [stakeholderId]
    );
    const reportedBy = stakeholder?.name || '';
    const ts = new Date().toISOString();
    const nextBody = String(body).trim();
    db.run(
      `UPDATE stakeholder_comments
       SET body = ?, requirement_status = ?, account_anchor = ?, updated_at = ?
       WHERE id = ? AND stakeholder_id = ?`,
      [nextBody, '', '', ts, commentId, stakeholderId]
    );
    if (existing.tag === 'Escalations') {
      const escalationAuthor = String(existing.author || changedBy || 'system');
      const resources = asIntList(linkedResourceIds);
      upsertEscalationResourceLinks(
        db,
        commentId,
        escalationAuthor,
        reportedBy,
        nextBody,
        resources,
        ts
      );
      db.run(
        `UPDATE resource_comments
         SET body = ?, author = ?, reported_by = ?, updated_at = ?
         WHERE source_module = 'stakeholder_escalation' AND source_ref_id = ?`,
        [nextBody, escalationAuthor, reportedBy, ts, commentId]
      );
    }
    res.json({ ok: true, updatedAt: ts });
  } catch (err) {
    logger.error('Failed to update stakeholder comment', { err: err.message, stakeholderId, commentId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:stakeholderId/comments/:commentId', async (req, res) => {
  const stakeholderId = String(req.params.stakeholderId || '').trim();
  const commentId = Number.parseInt(req.params.commentId, 10);
  const changedBy = String(req.query.changedBy || req.body?.changedBy || 'system');
  if (!stakeholderId) return res.status(400).json({ error: 'stakeholderId is required' });
  if (!Number.isFinite(commentId)) return res.status(400).json({ error: 'Valid commentId is required' });
  try {
    const db = await getDb();
    const existing = db.get(
      `SELECT * FROM stakeholder_comments WHERE id = ? AND stakeholder_id = ?`,
      [commentId, stakeholderId]
    );
    if (!existing) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (
      (existing.tag === 'Current Requirement' || existing.tag === 'Future Requirement') &&
      Number.isFinite(Number(existing.requirement_request_id))
    ) {
      const requestId = Number(existing.requirement_request_id);
      const linkedRequest = db.get('SELECT * FROM client_requests WHERE id = ?', [requestId]);
      if (linkedRequest) {
        const stakeholderRow = db.get('SELECT name FROM team_hierarchy_entries WHERE id = ?', [stakeholderId]);
        const stakeholderName = String(stakeholderRow?.name || existing.stakeholder_id || 'stakeholder');
        const now = new Date().toISOString();
        const deletedBy = String(changedBy || 'system');
        const note = `Requirement "${existing.tag}" deleted by ${deletedBy} from ${stakeholderName} on ${now}. Original note: ${String(existing.body || '').trim()}`;

        db.run(
          `UPDATE client_requests
           SET is_active = 0, processing_status = '', updated_on = ?, updated_at = ?
           WHERE id = ?`,
          [now, now, requestId]
        );
        db.run(
          `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
           VALUES (?,?,?,?,?,?,?,?)`,
          [
            'client_requests',
            requestId,
            linkedRequest.beeline_id || String(requestId),
            'Status',
            linkedRequest.is_active === 0 ? 'Inactive' : 'Active',
            'Inactive',
            deletedBy,
            now,
          ]
        );
        db.run(`CREATE TABLE IF NOT EXISTS request_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_id INTEGER NOT NULL,
          author TEXT NOT NULL DEFAULT "",
          tag TEXT NOT NULL DEFAULT "General",
          body TEXT NOT NULL DEFAULT "",
          created_at TEXT NOT NULL
        )`);
        db.run(
          'INSERT INTO request_comments (request_id, author, tag, body, created_at) VALUES (?,?,?,?,?)',
          [requestId, deletedBy, 'Requirement Deleted', note, now]
        );
      }
    }
    db.run(
      "DELETE FROM resource_comments WHERE source_module = 'stakeholder_escalation' AND source_ref_id = ?",
      [commentId]
    );
    db.run('DELETE FROM stakeholder_comment_resources WHERE stakeholder_comment_id = ?', [commentId]);
    db.run('DELETE FROM stakeholder_comments WHERE id = ? AND stakeholder_id = ?', [commentId, stakeholderId]);
    void changedBy;
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete stakeholder comment', { err: err.message, stakeholderId, commentId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:stakeholderId/comment-audit', async (req, res) => {
  const stakeholderId = String(req.params.stakeholderId || '').trim();
  if (!stakeholderId) {
    return res.status(400).json({ error: 'stakeholderId is required' });
  }
  try {
    res.json({ entries: [] });
  } catch (err) {
    logger.error('Failed to fetch stakeholder comment audit', { err: err.message, stakeholderId });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
