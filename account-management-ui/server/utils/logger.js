/**
 * logger.js
 * Structured server-side logger.
 * Writes JSON-formatted lines to stdout; never logs sensitive fields.
 *
 * Usage:
 *   const logger = require('../utils/logger');
 *   logger.info('Server started', { port: 3001 });
 *   logger.error('DB query failed', { route: '/api/resources', err: e.message });
 */

'use strict';

// Fields that must never appear in log output
const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'password_plain', 'token',
  'secret', 'salt', 'authorization', 'cookie',
]);

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

/**
 * Recursively remove sensitive keys from an object before logging.
 * @param {unknown} obj
 * @returns {unknown}
 */
function redact(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !SENSITIVE_KEYS.has(k.toLowerCase()))
      .map(([k, v]) => [k, redact(v)])
  );
}

/**
 * Emit a log entry as a JSON line to stdout.
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object} [meta]
 */
function log(level, message, meta) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? redact(meta) : {}),
  };

  // Use stderr for error/warn so they appear in PM2 / systemd error streams
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;
  stream.write(JSON.stringify(entry) + '\n');
}

const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),

  /** Log an incoming HTTP request (call at start of route). */
  request: (method, path, meta) =>
    log('info', `${method} ${path}`, meta),

  /** Log a completed HTTP response. */
  response: (method, path, status, meta) =>
    log(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
        `${method} ${path} → ${status}`, meta),
};

module.exports = logger;
