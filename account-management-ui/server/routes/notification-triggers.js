/**
 * Notification Triggers CRUD routes
 * Base path: /api/notification-triggers
 *
 * GET    /                 — list all triggers
 * GET    /debug            — health check: shows all triggers + group/user resolution
 * POST   /                 — create trigger
 * PUT    /:id              — update trigger
 * DELETE /:id              — delete trigger
 * PUT    /:id/toggle       — toggle is_active
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { TRIGGER_SOURCES } = require('../config/triggerSources');

function now() { return new Date().toISOString(); }

// GET /api/notification-triggers/sources — available trigger sources (config-driven)
router.get('/sources', (_req, res) => {
  res.json({ sources: TRIGGER_SOURCES });
});

// GET /api/notification-triggers/relevant?userId=X
// Returns only active, non-empty triggers that are relevant to the given user
// (based on group membership for group-targeted, role page-permissions for field_value)
router.get('/relevant', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const db = await getDb();
    const userIdInt = parseInt(userId, 10);

    // User's group IDs
    const groupRows = db.all('SELECT group_id FROM user_group_members WHERE user_id = ?', [userIdInt]);
    const userGroupIds = new Set(groupRows.map(r => String(r.group_id)));

    // User's role permissions → which pages they can view
    const userRow = db.get(
      'SELECT u.role_id, r.permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [userIdInt]
    );
    let permissions = {};
    try { permissions = JSON.parse(userRow?.permissions || '{}'); } catch { permissions = {}; }
    const viewablePages = new Set(
      Object.entries(permissions).filter(([, p]) => p?.view).map(([pid]) => pid)
    );

    // source_table → page IDs that gate visibility
    const SOURCE_PAGE_MAP = {
      resources:       ['resources_info', 'resources_utilization', 'resources_insights'],
      requests:        ['clientmgmt_requests'],
      client_requests: ['clientmgmt_requests'],
      ra_process:      ['clientmgmt_connects'],
      process:         ['clientmgmt_connects'],
      finance:         ['executive_summary', 'executive_revenue'],
      sow:             ['executive_summary', 'executive_revenue'],
      invoice:         ['executive_invoicing'],
      invoices:        ['executive_invoicing'],
    };

    // Only active triggers with a real non-empty name
    const allTriggers = db.all(
      "SELECT * FROM notification_triggers WHERE is_active = 1 AND name IS NOT NULL AND TRIM(name) != '' ORDER BY sort_order ASC, id ASC"
    );

    const relevant = allTriggers.filter(t => {
      const targetType  = (t.notify_target_type  || '').trim();
      const targetValue = (t.notify_target_value || '').trim();

      if (!targetType || targetType === 'broadcast') return true;

      if (targetType === 'group') return userGroupIds.has(targetValue);

      if (targetType === 'field_value') {
        const pageIds = SOURCE_PAGE_MAP[(t.source_table || '').toLowerCase().trim()];
        if (!pageIds) return true; // unmapped → show by default
        return pageIds.some(pid => viewablePages.has(pid));
      }

      return true;
    });

    res.json({ triggers: relevant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notification-triggers
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const rows = db.all('SELECT * FROM notification_triggers ORDER BY sort_order ASC, id ASC');
    res.json({ triggers: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notification-triggers/debug — verify all triggers resolve correctly
router.get('/debug', async (_req, res) => {
  try {
    const db = await getDb();
    const triggers = db.all('SELECT * FROM notification_triggers ORDER BY id');
    const groups = db.all('SELECT id, name FROM user_groups');
    const users = db.all('SELECT id, username, display_name FROM users');

    const report = triggers.map(t => {
      const base = {
        id: t.id,
        name: t.name,
        source_table: t.source_table,
        trigger_field: t.trigger_field,
        notify_target_type: t.notify_target_type,
        notify_target_value: t.notify_target_value,
        is_active: !!t.is_active,
      };

      if (t.notify_target_type === 'group') {
        const gid = t.notify_target_value ? parseInt(t.notify_target_value, 10) : null;
        const group = groups.find(g => g.id === gid);
        return {
          ...base,
          resolved_group: group ? `id=${group.id} name="${group.name}"` : `⚠ NOT FOUND (id=${gid})`,
          status: group ? '✓ OK' : '✗ BROKEN — group not found',
        };
      }
      if (t.notify_target_type === 'field_value') {
        return {
          ...base,
          note: 'Resolves at fire-time: new field value must match a user display_name or username',
          known_users: users.map(u => u.display_name || u.username),
          status: '✓ OK (runtime resolution)',
        };
      }
      return { ...base, status: '✓ OK (broadcast)' };
    });

    res.json({ triggers: report, user_groups: groups, total_users: users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notification-triggers/debug-full — full state check
router.get('/debug-full', async (req, res) => {
  try {
    const db = await getDb();
    // All notifications raw
    const notifications = db.all('SELECT id, title, target_user_id, target_group_id, source_user, created_at FROM notifications ORDER BY id DESC LIMIT 20');
    // All group members
    const members = db.all(`
      SELECT ugm.group_id, ug.name as group_name, ugm.user_id, u.username, u.display_name
      FROM user_group_members ugm
      JOIN user_groups ug ON ugm.group_id = ug.id
      JOIN users u ON ugm.user_id = u.id
    `);
    // All users
    const users = db.all('SELECT id, username, display_name FROM users');
    res.json({ recent_notifications: notifications, group_members: members, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notification-triggers
router.post('/', async (req, res) => {
  const {
    name,
    source_table,
    trigger_field,
    trigger_label = '',
    message_template = '',
    notify_target_type = 'field_value',
    notify_target_value = '',
    notification_type = 'task',
    is_active = 1,
  } = req.body;

  if (!name)          return res.status(400).json({ error: 'name is required' });
  if (!source_table)  return res.status(400).json({ error: 'source_table is required' });
  if (!trigger_field) return res.status(400).json({ error: 'trigger_field is required' });

  try {
    const db = await getDb();
    const ts = now();
    // Place new trigger at the end of the list
    const maxRow = db.get('SELECT MAX(sort_order) as m FROM notification_triggers');
    const sortOrder = (maxRow && maxRow.m != null ? maxRow.m : 0) + 1;
    db.run(
      `INSERT INTO notification_triggers
         (name, source_table, trigger_field, trigger_label, message_template,
          notify_target_type, notify_target_value, notification_type, is_active, sort_order, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [name, source_table, trigger_field, trigger_label, message_template,
       notify_target_type, notify_target_value, notification_type, is_active ? 1 : 0, sortOrder, ts, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-triggers/reorder — accepts { ids: [1,3,2,...] }
// IMPORTANT: must be registered BEFORE /:id to avoid Express matching "reorder" as an id param
router.put('/reorder', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  try {
    const db = await getDb();
    const ts = now();
    ids.forEach((id, index) => {
      db.run(
        'UPDATE notification_triggers SET sort_order=?, updated_at=? WHERE id=?',
        [index + 1, ts, id]
      );
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-triggers/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const {
    name,
    source_table,
    trigger_field,
    trigger_label,
    message_template,
    notify_target_type,
    notify_target_value,
    notification_type,
    is_active,
  } = req.body;

  try {
    const db = await getDb();
    const existing = db.get('SELECT * FROM notification_triggers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Trigger not found' });

    db.run(
      `UPDATE notification_triggers SET
         name=?, source_table=?, trigger_field=?, trigger_label=?, message_template=?,
         notify_target_type=?, notify_target_value=?, notification_type=?, is_active=?, updated_at=?
       WHERE id=?`,
      [
        name          ?? existing.name,
        source_table  ?? existing.source_table,
        trigger_field ?? existing.trigger_field,
        trigger_label !== undefined ? trigger_label : existing.trigger_label,
        message_template !== undefined ? message_template : existing.message_template,
        notify_target_type ?? existing.notify_target_type,
        notify_target_value !== undefined ? notify_target_value : existing.notify_target_value,
        notification_type ?? existing.notification_type,
        is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        now(),
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notification-triggers/:id/toggle
router.put('/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    const existing = db.get('SELECT id, is_active FROM notification_triggers WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Trigger not found' });
    db.run(
      'UPDATE notification_triggers SET is_active=?, updated_at=? WHERE id=?',
      [existing.is_active ? 0 : 1, now(), id]
    );
    res.json({ ok: true, is_active: !existing.is_active });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notification-triggers/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM notification_triggers WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
