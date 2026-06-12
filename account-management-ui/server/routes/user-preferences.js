/**
 * User Preferences routes
 * GET  /api/user-preferences/:userId  — get all preferences for a user
 * PUT  /api/user-preferences/:userId  — upsert all preferences for a user
 */
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');

function now() { return new Date().toISOString(); }

// GET /api/user-preferences/:userId
router.get('/:userId', async (req, res) => {
  try {
    const db = await getDb();
    const row = db.get('SELECT preferences FROM user_preferences WHERE user_id = ?', [req.params.userId]);
    let preferences = {};
    if (row) {
      try { preferences = JSON.parse(row.preferences || '{}'); } catch (_) {}
    }
    res.json({ preferences });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/user-preferences/:userId
router.put('/:userId', async (req, res) => {
  try {
    const db = await getDb();
    const { preferences } = req.body;
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({ error: 'preferences object required' });
    }
    const ts = now();
    db.run(
      `INSERT INTO user_preferences (user_id, preferences, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET preferences = excluded.preferences, updated_at = excluded.updated_at`,
      [req.params.userId, JSON.stringify(preferences), ts]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
