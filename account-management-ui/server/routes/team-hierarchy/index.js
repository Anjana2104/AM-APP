'use strict';

/**
 * team-hierarchy/index.js
 * Team Hierarchy API ? main router
 * Sub-domains:
 *   stakeholders.js ? GET / (list), PUT /:teamType/bulk
 *   comments.js     ? GET/POST/PUT/DELETE /:stakeholderId/comments
 */

const express = require('express');
const router = express.Router();

const stakeholdersRouter = require('./stakeholders');
const commentsRouter = require('./comments');

router.use('/', stakeholdersRouter);
router.use('/', commentsRouter);

module.exports = router;
