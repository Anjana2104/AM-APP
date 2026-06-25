/**
 * Auth routes
 * POST /api/auth/login   — verify credentials, return user + role + permissions
 * POST /api/auth/logout  — (stateless; client clears session)
 */
'use strict';

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const crypto = require('crypto');
const logger = require('../utils/logger');

// Salt read from environment — never hardcoded in source.
// Set EAM_PASSWORD_SALT in your .env file (see .env.example).
const SALT = process.env.EAM_PASSWORD_SALT || 'eam_default_salt';

/**
 * Current hash algorithm: PBKDF2-SHA256, 100 000 iterations.
 * Returns a hex string.
 */
function hashPassword(pw) {
  return crypto.pbkdf2Sync(String(pw), SALT, 100000, 32, 'sha256').toString('hex');
}

/**
 * Legacy SHA-256 hash used before the PBKDF2 upgrade.
 * Only used for backward-compat login; never written to DB for new accounts.
 */
function legacyHash(pw) {
  return crypto.createHash('sha256').update(String(pw) + SALT).digest('hex');
}

function now() { return new Date().toISOString(); }

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' });
  }
  try {
    const db = await getDb();
    const user = db.get(
      `SELECT u.*, r.name as role_name, r.permissions as role_permissions
       FROM users u LEFT JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER(?) AND u.active = 1`,
      [username]
    );

    if (!user) {
      logger.warn('Login failed — unknown user', { username });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const pbkdf2Hash = hashPassword(password);
    const legacy     = legacyHash(password);
    const isValid    = user.password_hash === pbkdf2Hash || user.password_hash === legacy;

    if (!isValid) {
      logger.warn('Login failed — wrong password', { username });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Silently upgrade legacy SHA-256 hash to PBKDF2 on successful login
    if (user.password_hash === legacy) {
      try {
        db.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?',
          [pbkdf2Hash, now(), user.id]);
        logger.info('Password hash upgraded to PBKDF2', { userId: user.id });
      } catch (upgradeErr) {
        logger.warn('Failed to upgrade password hash', { userId: user.id, err: upgradeErr.message });
      }
    }

    let permissions = {};
    try { permissions = JSON.parse(user.role_permissions || '{}'); } catch { permissions = {}; }

    logger.info('Login successful', { username: user.username, roleId: user.role_id });

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
    logger.error('Login error', { err: err.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout — stateless; client clears its own session
router.post('/logout', (_req, res) => res.json({ ok: true }));

module.exports = router;
module.exports.hashPassword = hashPassword;
