'use strict';

/**
 * finance.js — entry point (passthrough)
 *
 * The Finance API is split into focused sub-domain modules under ./finance/:
 *   revenue.js  → GET /month-headers
 *   projects.js → Finance project CRUD + bulk upload + milestone types
 *   bookings.js → Project bookings CRUD
 *
 * This file is the Node.js resolution target for require('./routes/finance').
 * All implementation lives in ./finance/index.js and its sub-modules.
 */

module.exports = require('./finance/index');
