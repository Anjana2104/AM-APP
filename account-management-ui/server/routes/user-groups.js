/**
 * User Groups routes
 * GET    /api/user-groups             — list all groups with members
 * POST   /api/user-groups             — create group
 * PUT    /api/user-groups/:id         — update group
 * DELETE /api/user-groups/:id         — delete group
 * POST   /api/user-groups/:id/members — add user to group
 * DELETE /api/user-groups/:id/members/:userId — remove user from group
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

function now() { return new Date().toISOString(); }

// GET /api/user-groups
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const groups = db.all('SELECT * FROM user_groups ORDER BY id');
    const members = db.all(
      `SELECT ugm.group_id, u.id, u.username, u.display_name as displayName
       FROM user_group_members ugm
       JOIN users u ON ugm.user_id = u.id`
    );
    const memberMap = {};
    members.forEach(m => {
      if (!memberMap[m.group_id]) memberMap[m.group_id] = [];
      memberMap[m.group_id].push({ id: m.id, username: m.username, displayName: m.displayName || m.username });
    });
    const result = groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description || '',
      user_type_config_id: g.user_type_config_id || '',
      created_at: g.created_at,
      updated_at: g.updated_at,
      members: memberMap[g.id] || [],
    }));
    res.json({ groups: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user-groups
router.post('/', async (req, res) => {
  const { name, description = '', user_type_config_id = '' } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const db = await getDb();
    const ts = now();
    db.run(
      'INSERT INTO user_groups (name, description, user_type_config_id, created_at, updated_at) VALUES (?,?,?,?,?)',
      [name.trim(), description, user_type_config_id, ts, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user-groups/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, user_type_config_id } = req.body;
  try {
    const db = await getDb();
    const group = db.get('SELECT * FROM user_groups WHERE id = ?', [id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    db.run(
      'UPDATE user_groups SET name=?, description=?, user_type_config_id=?, updated_at=? WHERE id=?',
      [
        name ?? group.name,
        description !== undefined ? description : group.description,
        user_type_config_id !== undefined ? user_type_config_id : group.user_type_config_id,
        now(),
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/user-groups/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM user_group_members WHERE group_id = ?', [id]);
    db.run('DELETE FROM user_groups WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/user-groups/:id/members
router.post('/:id/members', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    const db = await getDb();
    const group = db.get('SELECT id FROM user_groups WHERE id = ?', [id]);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    const user = db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    try {
      db.run('INSERT INTO user_group_members (group_id, user_id) VALUES (?,?)', [id, userId]);
    } catch (dupErr) {
      // UNIQUE constraint — already a member
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/user-groups/:id/members/:userId
router.delete('/:id/members/:userId', async (req, res) => {
  const { id, userId } = req.params;
  try {
    const db = await getDb();
    db.run('DELETE FROM user_group_members WHERE group_id = ? AND user_id = ?', [id, userId]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
