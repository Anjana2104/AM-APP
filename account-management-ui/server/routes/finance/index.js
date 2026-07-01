'use strict';

/**
 * finance/index.js
 *
 * Finance module — main router
 * Assembles sub-domain routers for the /api/finance namespace.
 *
 * Sub-domains:
 *   revenue.js   → GET /month-headers
 *   projects.js  → CRUD for finance_projects + finance_revenue
 *   bookings.js  → CRUD for project_bookings
 */

const express  = require('express');
const router   = express.Router();

const revenueRouter   = require('./revenue');
const projectsRouter  = require('./projects');
const bookingsRouter  = require('./bookings');

router.use('/', revenueRouter);
router.use('/', projectsRouter);
router.use('/', bookingsRouter);

module.exports = router;
