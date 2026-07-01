'use strict';

const { getDb } = require('../../db/connection');
const logger = require('../../utils/logger');

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

module.exports = { normalizeTeamType, toApiRow, normalizeCommentTag, asIntList, toStakeholderCommentApiRow, upsertEscalationResourceLinks, generateTempBeelineId, createClientRequestForRequirement };
