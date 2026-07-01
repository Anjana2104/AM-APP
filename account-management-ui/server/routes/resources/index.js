'use strict';

/**
 * resources/index.js
 * Resource API ? main router
 * Assembles sub-domain routers for /api/resources namespace.
 *
 * Sub-domains:
 *   search.js    ? GET /beeline-links, GET /comments-search
 *   crud.js      ? CRUD for resources (list, create, update, delete, batch)
 *   comments.js  ? GET/POST/PUT/DELETE /:id/comments/:commentId
 */

const express = require('express');
const router = express.Router();

const searchRouter = require('./search');
const crudRouter = require('./crud');
const commentsRouter = require('./comments');

// search must be mounted before crud (specific paths before /:id catch-alls)
router.use('/', searchRouter);
router.use('/', crudRouter);
router.use('/', commentsRouter);

module.exports = router;
