'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const logger = require('../utils/logger');

const VALID_TEAM_TYPES = new Set(['client', 'ra']);
const COMMENT_TAGS = new Set(['Interactions', 'Escalations', 'Current Requirement', 'Future Requirement']);

function normalizeTeamType(input) {
  const teamType = String(input || '').trim().toLowerCase();
  return VALID_TEAM_TYPES.has(teamType) ? teamType : '';
}

function toApiRow(row) {
  return {
    id: row.id,
    teamType: row.team_type,
    name: row.name || '',
    title: row.title || '',
    department: row.department || '',
    reportingTo: row.reporting_to || null,
    email: row.email || '',
    phone: row.phone || '',
    responsibility: row.responsibility || '',
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function normalizeCommentTag(input) {
  const tag = String(input || '').trim();
  return COMMENT_TAGS.has(tag) ? tag : '';
}

function asIntList(values) {
  if (!Array.isArray(values)) return [];
  const dedup = new Set();
  values.forEach(value => {
    const parsed = Number.parseInt(String(value), 10);
    if (Number.isFinite(parsed) && parsed > 0) dedup.add(parsed);
  });
  return Array.from(dedup);
}

function toStakeholderCommentApiRow(row, linkedResourceIds = [], linkedResourceLabels = []) {
  return {
    id: row.id,
    stakeholderId: row.stakeholder_id,
    stakeholderTeamType: row.stakeholder_team_type,
    stakeholderName: row.stakeholder_name || '',
    stakeholderTitle: row.stakeholder_title || '',
    author: row.author || '',
    tag: row.tag || 'Interactions',
    body: row.body || '',
    requirementRequestId: Number.isFinite(Number(row.requirement_request_id))
      ? Number(row.requirement_request_id)
      : null,
    requirementRequestBeeline: row.requirement_request_beeline || '',
    linkedResourceIds,
    linkedResourceLabels,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
  };
}

function upsertEscalationResourceLinks(db, commentId, author, reportedBy, commentBody, resourceIds, changedAt) {
  const existingLinks = db.all(
    'SELECT resource_id FROM stakeholder_comment_resources WHERE stakeholder_comment_id = ?',
    [commentId]
  ).map(row => Number(row.resource_id));
  const existingSet = new Set(existingLinks);
  const incomingSet = new Set(resourceIds);

  const toAdd = resourceIds.filter(id => !existingSet.has(id));
  const toDelete = existingLinks.filter(id => !incomingSet.has(id));

  toDelete.forEach(resourceId => {
    db.run(
      'DELETE FROM stakeholder_comment_resources WHERE stakeholder_comment_id = ? AND resource_id = ?',
      [commentId, resourceId]
    );
    db.run(
      "DELETE FROM resource_comments WHERE resource_id = ? AND source_module = 'stakeholder_escalation' AND source_ref_id = ?",
      [resourceId, commentId]
    );
  });

  toAdd.forEach(resourceId => {
    db.run(
      `INSERT OR IGNORE INTO stakeholder_comment_resources (stakeholder_comment_id, resource_id, created_at)
       VALUES (?, ?, ?)`,
      [commentId, resourceId, changedAt]
    );
    db.run(
      `INSERT INTO resource_comments (resource_id, author, tag, body, reported_by, source_module, source_ref_id, created_at)
       VALUES (?, ?, 'Escalations', ?, ?, 'stakeholder_escalation', ?, ?)`,
      [resourceId, author || 'system', commentBody, reportedBy || '', commentId, changedAt]
    );
  });
}

function generateTempBeelineId(db) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = `Temp-${Math.floor(100000 + Math.random() * 900000)}`;
    const exists = db.get(
      'SELECT id FROM client_requests WHERE LOWER(beeline_id) = LOWER(?)',
      [candidate]
    );
    if (!exists) return candidate;
  }
  return `Temp-${Date.now()}`;
}

function createClientRequestForRequirement(db, options) {
  const {
    requirementTag,
    commentBody,
    reporterName,
    createdAt,
    changedBy,
  } = options;
  const maxRow = db.get('SELECT MAX(sno) AS m FROM client_requests');
  const sno = (maxRow && maxRow.m ? Number(maxRow.m) : 0) + 1;
  const beelineId = generateTempBeelineId(db);
  const dateRaised = String(createdAt || new Date().toISOString()).slice(0, 10);
  const commentText = String(commentBody || '').trim();
  const description = commentText ? `${requirementTag} - ${commentText}` : requirementTag;
  db.run(
    `INSERT INTO client_requests (sno, beeline_id, description, raised_by, processing_status,
     overall_status, account_anchor, date_raised, request_type, updated_on, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      sno,
      beelineId,
      description,
      String(reporterName || 'Unknown'),
      '',
      'Not Started',
      '',
      dateRaised,
      'Resource Demand',
      createdAt,
      createdAt,
    ]
  );
  const requestId = db.lastId ? db.lastId() : null;
  if (requestId) {
    db.run(
      `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        'client_requests',
        requestId,
        beelineId,
        'Created',
        '',
        `${requirementTag} created from stakeholder requirement comment`,
        String(changedBy || 'system'),
        createdAt,
      ]
    );
  }
  return { requestId, beelineId };
}

router.get('/', async (req, res) => {
  const teamType = normalizeTeamType(req.query.teamType);
  if (!teamType) {
    return res.status(400).json({ error: 'Valid teamType is required (client | ra)' });
  }

  try {
    const db = await getDb();
    const rows = db.all(
      `SELECT id, team_type, name, title, department, reporting_to, email, phone, responsibility, sort_order, created_at, updated_at
       FROM team_hierarchy_entries
       WHERE team_type = ?
       ORDER BY sort_order ASC, name ASC`,
      [teamType]
    );

    res.json({ teamType, stakeholders: rows.map(toApiRow) });
  } catch (err) {
    logger.error('Failed to fetch team hierarchy', { err: err.message, teamType });
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

router.put('/:teamType/bulk', async (req, res) => {
  const teamType = normalizeTeamType(req.params.teamType);
  const { stakeholders, changedBy = 'system' } = req.body;

  if (!teamType) {
    return res.status(400).json({ error: 'Valid teamType is required (client | ra)' });
  }
  if (!Array.isArray(stakeholders)) {
    return res.status(400).json({ error: 'stakeholders array required' });
  }

  try {
    const db = await getDb();
    const ts = new Date().toISOString();

    db.run('DELETE FROM team_hierarchy_entries WHERE team_type = ?', [teamType]);

    let inserted = 0;
    stakeholders.forEach((s, idx) => {
      const id = String(s.id || '').trim();
      const name = String(s.name || '').trim();
      if (!id || !name) return;

      db.run(
        `INSERT INTO team_hierarchy_entries
         (id, team_type, name, title, department, reporting_to, email, phone, responsibility, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          teamType,
          name,
          String(s.title || '').trim(),
          String(s.department || '').trim(),
          s.reportingTo ? String(s.reportingTo).trim() : null,
          String(s.email || '').trim(),
          String(s.phone || '').trim(),
          String(s.responsibility || '').trim(),
          Number.isFinite(Number(s.sortOrder)) ? Number(s.sortOrder) : idx,
          ts,
          ts,
        ]
      );
      inserted += 1;
    });

    db.run(
      `INSERT INTO audit_log (module, record_id, record_name, field, old_value, new_value, changed_by, changed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['team_hierarchy', 0, teamType, 'bulk_save', '', `Saved ${inserted} stakeholder(s)`, changedBy, ts]
    );

    res.json({ ok: true, inserted });
  } catch (err) {
    logger.error('Failed to save team hierarchy', { err: err.message, teamType });
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
