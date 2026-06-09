/**
 * Roles routes
 * GET    /api/roles         — list all roles with permissions
 * POST   /api/roles         — create role
 * PUT    /api/roles/:id     — update role name/description/permissions
 * DELETE /api/roles/:id     — delete role
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

function now() { return new Date().toISOString(); }

function rowToRole(row) {
  let permissions = {};
  try { permissions = JSON.parse(row.permissions || '{}'); } catch { permissions = {}; }
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    permissions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/roles
router.get('/', async (_req, res) => {
  try {
    const db = await getDb();
    const rows = db.all('SELECT * FROM roles ORDER BY id');
    res.json({ roles: rows.map(rowToRole) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/roles
router.post('/', async (req, res) => {
  const { name, description = '', permissions = {} } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const db = await getDb();
    const existing = db.get('SELECT id FROM roles WHERE LOWER(name) = LOWER(?)', [name]);
    if (existing) return res.status(409).json({ error: 'Role name already exists' });
    const ts = now();
    db.run(
      'INSERT INTO roles (name, description, permissions, created_at, updated_at) VALUES (?,?,?,?,?)',
      [name.trim(), description, JSON.stringify(permissions), ts, ts]
    );
    res.json({ ok: true, id: db.lastId() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/roles/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, permissions } = req.body;
  try {
    const db = await getDb();
    const role = db.get('SELECT * FROM roles WHERE id = ?', [id]);
    if (!role) return res.status(404).json({ error: 'Role not found' });
    const ts = now();
    db.run(
      'UPDATE roles SET name=?, description=?, permissions=?, updated_at=? WHERE id=?',
      [
        name ?? role.name,
        description !== undefined ? description : role.description,
        permissions !== undefined ? JSON.stringify(permissions) : role.permissions,
        ts,
        id,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/roles/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDb();
    // Unassign users from this role
    db.run('UPDATE users SET role_id = NULL WHERE role_id = ?', [id]);
    db.run('DELETE FROM roles WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
