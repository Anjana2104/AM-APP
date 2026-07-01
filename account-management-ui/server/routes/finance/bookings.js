'use strict';

/**
 * finance/bookings.js
 *
 * Finance Booking routes
 * Base path: /api/finance  (mounted by finance/index.js)
 *
 * GET    /api/finance/projects/:id/bookings              — list bookings for a project
 * POST   /api/finance/projects/:id/bookings              — create a single booking
 * POST   /api/finance/projects/:id/bookings/batch        — atomic multi-booking insert
 * PUT    /api/finance/projects/:id/bookings/:bookingId   — update a booking
 * DELETE /api/finance/projects/:id/bookings/:bookingId   — delete a booking
 * DELETE /api/finance/projects/:id/bookings              — delete ALL bookings for a project
 * DELETE /api/finance/bookings/all                       — delete ALL bookings across all projects
 */

const express = require('express');
const router  = express.Router();
const { getDb } = require('../../db/connection');
const logger = require('../../utils/logger');
const {
  normalizeBookingInput,
  validateBookingInput,
  insertBooking,
  formatBookingAuditValue,
  insertFinanceAudit,
  projectRecordName,
} = require('./helpers');

// ── GET /api/finance/projects/:id/bookings ────────────────────────────────

router.get('/projects/:id/bookings', async (req, res) => {
  try {
    const db   = await getDb();
    const rows = db.all(
      'SELECT * FROM project_bookings WHERE project_id=? ORDER BY booking_month ASC, milestone_month ASC',
      [req.params.id]
    );
    res.json({ bookings: rows });
  } catch (err) {
    logger.error(`[Finance/Bookings] Failed to list bookings for project ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to retrieve bookings' });
  }
});

// ── POST /api/finance/projects/:id/bookings — single booking ──────────────

router.post('/projects/:id/bookings', async (req, res) => {
  const booking = normalizeBookingInput(req.body);
  const errors  = validateBookingInput(booking, 'Row 1');
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  try {
    const db         = await getDb();
    const projectId  = parseInt(req.params.id, 10);
    const project    = db.get('SELECT id, project, code FROM finance_projects WHERE id=?', [projectId]);
    const recordName = projectRecordName(project, projectId);
    const created_at = new Date().toISOString();

    insertBooking(db.run.bind(db), projectId, booking, created_at);
    const id = db.lastId();

    insertFinanceAudit(db.run.bind(db), {
      recordId: projectId, recordName,
      field: 'Booking Created',
      oldValue: '', newValue: formatBookingAuditValue(booking),
      changedBy: booking.created_by || 'system', changedAt: created_at,
    });

    res.json({ ok: true, id });
  } catch (err) {
    logger.error(`[Finance/Bookings] Failed to create booking for project ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ── POST /api/finance/projects/:id/bookings/batch — atomic multi-insert ───

router.post('/projects/:id/bookings/batch', async (req, res) => {
  const { bookings } = req.body;
  if (!Array.isArray(bookings) || !bookings.length) {
    return res.status(400).json({ error: 'bookings array required' });
  }

  const normalizedBookings = bookings.map(b => normalizeBookingInput(b));
  const errors = [];
  normalizedBookings.forEach((booking, index) => {
    errors.push(...validateBookingInput(booking, `Row ${index + 1}`));
  });
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }

  try {
    const db         = await getDb();
    const projectId  = parseInt(req.params.id, 10);
    const project    = db.get('SELECT id, project, code FROM finance_projects WHERE id=?', [projectId]);
    const recordName = projectRecordName(project, projectId);
    const created_at = new Date().toISOString();
    const changedBy  = normalizedBookings[0]?.created_by || 'system';

    db.runInTransaction((run) => {
      for (const booking of normalizedBookings) {
        insertBooking(run, projectId, booking, created_at);
      }
      const details = normalizedBookings
        .map((b, i) => `#${i + 1} ${formatBookingAuditValue(b)}`)
        .join('\n');
      insertFinanceAudit(run, {
        recordId: projectId, recordName,
        field: 'Booking Created (Batch)',
        oldValue: '', newValue: `Count: ${normalizedBookings.length}\n${details}`,
        changedBy, changedAt: created_at,
      });
    });

    res.json({ ok: true, count: normalizedBookings.length });
  } catch (err) {
    logger.error(`[Finance/Bookings] Batch insert failed for project ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Batch booking insert failed — no data was written.' });
  }
});

// ── PUT /api/finance/projects/:id/bookings/:bookingId ─────────────────────

router.put('/projects/:id/bookings/:bookingId', async (req, res) => {
  const booking = normalizeBookingInput(req.body);
  const errors  = validateBookingInput(booking, 'Row 1');
  if (errors.length) {
    return res.status(400).json({ error: errors.join('; ') });
  }
  try {
    const db         = await getDb();
    const projectId  = parseInt(req.params.id, 10);
    const bookingId  = parseInt(req.params.bookingId, 10);
    const existing   = db.get('SELECT * FROM project_bookings WHERE id=? AND project_id=?', [bookingId, projectId]);
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const project    = db.get('SELECT id, project, code FROM finance_projects WHERE id=?', [projectId]);
    const recordName = projectRecordName(project, projectId);
    const changedAt  = new Date().toISOString();

    db.run(
      `UPDATE project_bookings
       SET milestone_month=?, booking_month=?, amount=?, notes=?, booking_type=?
       WHERE id=? AND project_id=?`,
      [booking.milestone_month, booking.booking_month, booking.amount,
       booking.notes, booking.booking_type, bookingId, projectId]
    );

    insertFinanceAudit(db.run.bind(db), {
      recordId: projectId, recordName,
      field: 'Booking Updated',
      oldValue: formatBookingAuditValue(existing),
      newValue: formatBookingAuditValue(booking),
      changedBy: booking.created_by || 'system', changedAt,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Finance/Bookings] Failed to update booking ${req.params.bookingId}:`, err.message);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// ── DELETE /api/finance/projects/:id/bookings/:bookingId ──────────────────

router.delete('/projects/:id/bookings/:bookingId', async (req, res) => {
  try {
    const db        = await getDb();
    const projectId = parseInt(req.params.id, 10);
    const bookingId = parseInt(req.params.bookingId, 10);
    const booking   = db.get('SELECT * FROM project_bookings WHERE id=? AND project_id=?', [bookingId, projectId]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    const project    = db.get('SELECT id, project, code FROM finance_projects WHERE id=?', [projectId]);
    const recordName = projectRecordName(project, projectId);
    const changedBy  = String(req.query.changedBy || req.body?.changedBy || 'system');
    const changedAt  = new Date().toISOString();

    db.run('DELETE FROM project_bookings WHERE id=? AND project_id=?', [bookingId, projectId]);

    insertFinanceAudit(db.run.bind(db), {
      recordId: projectId, recordName,
      field: 'Booking Deleted',
      oldValue: formatBookingAuditValue(booking), newValue: '',
      changedBy, changedAt,
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Finance/Bookings] Failed to delete booking ${req.params.bookingId}:`, err.message);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ── DELETE /api/finance/projects/:id/bookings — delete all for one project ─

router.delete('/projects/:id/bookings', async (req, res) => {
  try {
    const db         = await getDb();
    const projectId  = parseInt(req.params.id, 10);
    const existing   = db.all('SELECT * FROM project_bookings WHERE project_id=?', [projectId]);
    const project    = db.get('SELECT id, project, code FROM finance_projects WHERE id=?', [projectId]);
    const recordName = projectRecordName(project, projectId);
    const changedBy  = String(req.query.changedBy || req.body?.changedBy || 'system');
    const changedAt  = new Date().toISOString();

    db.run('DELETE FROM project_bookings WHERE project_id=?', [projectId]);

    if (existing.length > 0) {
      const details = existing.map((b, i) => `#${i + 1} ${formatBookingAuditValue(b)}`).join('\n');
      insertFinanceAudit(db.run.bind(db), {
        recordId: projectId, recordName,
        field: 'Booking Deleted (All)',
        oldValue: `Count: ${existing.length}\n${details}`, newValue: '',
        changedBy, changedAt,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Finance/Bookings] Failed to delete all bookings for project ${req.params.id}:`, err.message);
    res.status(500).json({ error: 'Failed to delete all bookings for project' });
  }
});

// ── DELETE /api/finance/bookings/all — delete ALL bookings across all projects

router.delete('/bookings/all', async (req, res) => {
  try {
    const db       = await getDb();
    const existing = db.all('SELECT * FROM project_bookings');

    // Build project name map for audit entries
    const projectMap = new Map();
    db.all('SELECT id, project, code FROM finance_projects').forEach(p => {
      projectMap.set(p.id, projectRecordName(p, p.id));
    });

    const changedBy = String(req.query.changedBy || req.body?.changedBy || 'system');
    const changedAt = new Date().toISOString();

    db.run('DELETE FROM project_bookings');

    // Write audit entry per project
    const groupedByProject = new Map();
    existing.forEach(b => {
      if (!groupedByProject.has(b.project_id)) groupedByProject.set(b.project_id, []);
      groupedByProject.get(b.project_id).push(b);
    });

    groupedByProject.forEach((projectBookings, projectId) => {
      const details = projectBookings.map((b, i) => `#${i + 1} ${formatBookingAuditValue(b)}`).join('\n');
      insertFinanceAudit(db.run.bind(db), {
        recordId: projectId,
        recordName: projectMap.get(projectId) || `Project ${projectId}`,
        field: 'Booking Deleted (All)',
        oldValue: `Count: ${projectBookings.length}\n${details}`, newValue: '',
        changedBy, changedAt,
      });
    });

    res.json({ ok: true });
  } catch (err) {
    logger.error('[Finance/Bookings] Failed to delete all bookings:', err.message);
    res.status(500).json({ error: 'Failed to delete all bookings' });
  }
});

module.exports = router;
