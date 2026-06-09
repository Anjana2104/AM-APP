/**
 * Auth routes
 * POST /api/auth/login   — verify credentials, return user + role + permissions
 * POST /api/auth/logout  — (stateless; client clears session)
 * GET  /api/auth/me      — return current session user (by userId header)
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const crypto = require('crypto');

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + 'eam_salt_2024').digest('hex');
}

function now() { return new Date().toISOString(); }

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  try {
    const db = await getDb();
    const user = db.get(
      'SELECT u.*, r.name as role_name, r.permissions as role_permissions FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE LOWER(u.username) = LOWER(?) AND u.active = 1',
      [username]
    );
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const hash = hashPassword(password);
    if (user.password_hash !== hash) return res.status(401).json({ error: 'Invalid username or password' });

    let permissions = {};
    try { permissions = JSON.parse(user.role_permissions || '{}'); } catch { permissions = {}; }

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name || user.username,
        roleId: user.role_id,
        roleName: user.role_name || 'No Role',
        permissions,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout — stateless, client removes session
router.post('/logout', (_req, res) => res.json({ ok: true }));

module.exports = router;
module.exports.hashPassword = hashPassword;
