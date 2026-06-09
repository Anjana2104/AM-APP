/**
 * Users routes
 * GET    /api/users         — list all users
 * POST   /api/users         — create user
 * PUT    /api/users/:id     — update user
 * DELETE /api/users/:id     — delete user
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const { hashPassword } = require('./auth');

function now() { return new Date().toISOString(); }

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name || row.username,
    passwordPlain: row.password_plain || '',
    roleId: row.role_id,
    roleName: row.role_name || '',
    active: !!row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/users
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const rows = db.all(
      'SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id ORDER BY u.id'
    );
    res.json({ users: rows.map(rowToUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users
router.post('/', async (req, res) => {
  const { username, password, displayName, roleId, active = true } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const db = await getDb();
    const existing = db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (existing) return res.status(409).json({ error: 'Username already exists' });
    const ts = now();
    db.run(
      'INSERT INTO users (username, password_hash, password_plain, display_name, role_id, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [username.trim(), hashPassword(password), password, displayName || username, roleId || null, active ? 1 : 0, ts, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { password, displayName, roleId, active, username } = req.body;
  try {
    const db = await getDb();
    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newHash = password ? hashPassword(password) : user.password_hash;
    const newPlain = password ? password : user.password_plain;
    const ts = now();
    db.run(
      'UPDATE users SET username=?, password_hash=?, password_plain=?, display_name=?, role_id=?, active=?, updated_at=? WHERE id=?',
      [
        username ?? user.username,
        newHash,
        newPlain,
        displayName ?? user.display_name,
        roleId !== undefined ? (roleId || null) : user.role_id,
        active !== undefined ? (active ? 1 : 0) : user.active,
        ts,
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    // Prevent deleting the last admin user
    const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const role = user.role_id ? db.get('SELECT * FROM roles WHERE id = ?', [user.role_id]) : null;
    if (role && role.name === 'Admin') {
      const adminCount = db.get(
        'SELECT COUNT(*) as cnt FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = ? AND u.active = 1',
        ['Admin']
      );
      if (adminCount && adminCount.cnt <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last active Admin user' });
      }
    }
    db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
