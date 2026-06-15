/**
 * Notifications routes
 * GET    /api/notifications?userId=X&limit=20&offset=0&unreadOnly=true  — get notifications for user
 * GET    /api/notifications/count?userId=X  — get unread count only (lightweight)
 * POST   /api/notifications               — create notification
 * PUT    /api/notifications/:id/read      — mark one as read by userId
 * PUT    /api/notifications/read-all      — mark all as read for userId
 * DELETE /api/notifications/:id           — delete notification
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

function now() { return new Date().toISOString(); }

function buildWhereClause(userIdInt, groupIds) {
  if (groupIds.length > 0) {
    const placeholders = groupIds.map(() => '?').join(',');
    return {
      where: `WHERE target_user_id = ?
               OR (target_group_id IS NOT NULL AND target_group_id IN (${placeholders}))
               OR (target_user_id IS NULL AND target_group_id IS NULL)`,
      params: [userIdInt, ...groupIds],
    };
  }
  return {
    where: `WHERE target_user_id = ?
             OR (target_user_id IS NULL AND target_group_id IS NULL)`,
    params: [userIdInt],
  };
}

function formatNotification(n, userIdInt) {
  let readBy = [];
  try { readBy = JSON.parse(n.read_by || '[]'); } catch (_) {}
  const isReadByUser = readBy.map(String).includes(String(userIdInt)) || (n.is_read === 1 && !n.target_group_id);
  return {
    id: n.id,
    type: n.type || 'task',
    title: n.title,
    message: n.message || '',
    target_user_id: n.target_user_id,
    target_group_id: n.target_group_id,
    source_user: n.source_user || '',
    is_read: !!n.is_read,
    is_read_by_user: isReadByUser,
    read_at: n.read_at,
    created_at: n.created_at,
    trigger_id: n.trigger_id || null,
  };
}

/**
 * Load the active snooze rules for a user from user_preferences.
 * Returns an array of { triggerId: number|null, until: ISO string } for rules that haven't expired.
 */
function getActiveSnoozeRules(db, userIdInt) {
  try {
    const row = db.get('SELECT preferences FROM user_preferences WHERE user_id = ?', [userIdInt]);
    if (!row) return [];
    let prefs = {};
    try { prefs = JSON.parse(row.preferences || '{}'); } catch (_) { return []; }
    const rules = prefs.notificationSnooze || [];
    const nowTs = new Date();
    return rules.filter(r => new Date(r.until) > nowTs);
  } catch (_) {
    return [];
  }
}

/**
 * Check if a notification's trigger_id is covered by any active snooze rule.
 * - A rule with triggerId === null means "snooze ALL triggers"
 * - A rule with triggerId === X means "snooze trigger X only"
 * Notifications NOT from a trigger (trigger_id is null) are never snoozed.
 */
function isNotificationSnoozed(notifTriggerId, snoozeRules) {
  if (!notifTriggerId) return false; // manual / broadcast notifications are never snoozed
  return snoozeRules.some(rule => rule.triggerId === null || rule.triggerId === notifTriggerId);
}

// GET /api/notifications/count?userId=X  — lightweight unread count
router.get('/count', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const userIdInt = parseInt(String(userId), 10);
  if (isNaN(userIdInt)) return res.status(400).json({ error: 'userId must be a number' });
  try {
    const db = await getDb();
    const groupRows = db.all('SELECT group_id FROM user_group_members WHERE user_id = ?', [userIdInt]);
    const groupIds = groupRows.map(r => r.group_id);
    const { where, params } = buildWhereClause(userIdInt, groupIds);
    const snoozeRules = getActiveSnoozeRules(db, userIdInt);

    // Count only rows not read by this user and not snoozed
    const all = db.all(`SELECT id, is_read, read_by, target_group_id, trigger_id FROM notifications ${where} ORDER BY created_at DESC`, params);
    let unreadCount = 0;
    for (const n of all) {
      if (isNotificationSnoozed(n.trigger_id, snoozeRules)) continue;
      let readBy = [];
      try { readBy = JSON.parse(n.read_by || '[]'); } catch (_) {}
      const isReadByUser = readBy.map(String).includes(String(userIdInt)) || (n.is_read === 1 && !n.target_group_id);
      if (!isReadByUser) unreadCount++;
    }
    res.json({ unread_count: unreadCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications?userId=X&limit=20&offset=0&unreadOnly=false
router.get('/', async (req, res) => {
  const { userId, limit = '20', offset = '0', unreadOnly = 'false' } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId query param required' });
  const userIdInt = parseInt(String(userId), 10);
  if (isNaN(userIdInt)) return res.status(400).json({ error: 'userId must be a number' });
  const limitInt = Math.min(Math.max(parseInt(String(limit), 10) || 20, 1), 100);
  const offsetInt = Math.max(parseInt(String(offset), 10) || 0, 0);
  const onlyUnread = String(unreadOnly).toLowerCase() === 'true';

  try {
    const db = await getDb();
    const groupRows = db.all('SELECT group_id FROM user_group_members WHERE user_id = ?', [userIdInt]);
    const groupIds = groupRows.map(r => r.group_id);
    const { where, params } = buildWhereClause(userIdInt, groupIds);
    const snoozeRules = getActiveSnoozeRules(db, userIdInt);

    // Fetch all matching notifications, then apply read-filter + snooze-filter + pagination in JS
    const all = db.all(`SELECT * FROM notifications ${where} ORDER BY created_at DESC`, params);

    const formatted = all.map(n => formatNotification(n, userIdInt));
    // Remove snoozed notifications from unread view; still visible in read history
    const filtered = formatted.filter(n => {
      if (onlyUnread && isNotificationSnoozed(n.trigger_id, snoozeRules)) return false;
      if (onlyUnread && n.is_read_by_user) return false;
      if (!onlyUnread && n.is_read_by_user) return true; // history — always show
      return true;
    });

    const total = filtered.length;
    const page = filtered.slice(offsetInt, offsetInt + limitInt);

    res.json({ notifications: page, total, has_more: offsetInt + limitInt < total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications
router.post('/', async (req, res) => {
  const { type = 'task', title, message = '', target_user_id = null, target_group_id = null, source_user = '' } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  try {
    const db = await getDb();
    const ts = now();
    db.run(
      `INSERT INTO notifications (type, title, message, target_user_id, target_group_id, source_user, is_read, read_by, created_at)
       VALUES (?,?,?,?,?,?,0,'[]',?)`,
      [type, title, message, target_user_id || null, target_group_id || null, source_user, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/read-all  (must be before /:id routes)
router.put('/read-all', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const db = await getDb();
    const groupRows = db.all('SELECT group_id FROM user_group_members WHERE user_id = ?', [userId]);
    const groupIds = groupRows.map(r => r.group_id);

    let rows;
    if (groupIds.length > 0) {
      const placeholders = groupIds.map(() => '?').join(',');
      rows = db.all(
        `SELECT * FROM notifications
         WHERE target_user_id = ?
            OR (target_group_id IS NOT NULL AND target_group_id IN (${placeholders}))
            OR (target_user_id IS NULL AND target_group_id IS NULL)`,
        [userId, ...groupIds]
      );
    } else {
      rows = db.all(
        `SELECT * FROM notifications
         WHERE target_user_id = ?
            OR (target_user_id IS NULL AND target_group_id IS NULL)`,
        [userId]
      );
    }

    const ts = now();
    rows.forEach(n => {
      let readBy = [];
      try { readBy = JSON.parse(n.read_by || '[]'); } catch (_) {}
      if (!readBy.map(String).includes(String(userId))) readBy.push(userId);

      let allRead = true;
      if (n.target_group_id) {
        const groupMembers = db.all('SELECT user_id FROM user_group_members WHERE group_id = ?', [n.target_group_id]);
        allRead = groupMembers.every(m => readBy.map(String).includes(String(m.user_id)));
      }

      db.run(
        'UPDATE notifications SET read_by=?, is_read=?, read_at=? WHERE id=?',
        [JSON.stringify(readBy), allRead ? 1 : n.is_read, ts, n.id]
      );
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    const db = await getDb();
    const notif = db.get('SELECT * FROM notifications WHERE id = ?', [id]);
    if (!notif) return res.status(404).json({ error: 'Notification not found' });

    let readBy = [];
    try { readBy = JSON.parse(notif.read_by || '[]'); } catch (_) {}
    if (!readBy.map(String).includes(String(userId))) readBy.push(userId);

    let isRead = 1;
    if (notif.target_group_id) {
      const groupMembers = db.all('SELECT user_id FROM user_group_members WHERE group_id = ?', [notif.target_group_id]);
      isRead = groupMembers.every(m => readBy.map(String).includes(String(m.user_id))) ? 1 : 0;
    }

    const ts = now();
    db.run(
      'UPDATE notifications SET read_by=?, is_read=?, read_at=? WHERE id=?',
      [JSON.stringify(readBy), isRead, ts, id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM notifications WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
