'use strict';

/**
 * finance/revenue.js
 *
 * Finance Revenue routes
 * Base path: /api/finance  (mounted by finance/index.js)
 *
 * GET /api/finance/month-headers  — sorted list of distinct revenue months
 */

const express = require('express');
const router  = express.Router();
const { getDb } = require('../../db/connection');
const { monthSortKey } = require('./helpers');

const logger = require('../../utils/logger');

// GET /api/finance/month-headers
router.get('/month-headers', async (req, res) => {
  try {
    const db = await getDb();
    const rows   = db.all('SELECT DISTINCT month FROM finance_revenue');
    const months = rows.map(r => r.month).sort((a, b) => monthSortKey(a) - monthSortKey(b));
    res.json({ months });
  } catch (err) {
    logger.error('[Finance/Revenue] Failed to fetch month-headers:', err.message);
    res.status(500).json({ error: 'Failed to retrieve month headers' });
  }
});

module.exports = router;
