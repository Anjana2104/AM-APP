/**
 * DATABASE CONFIGURATION
 * ─────────────────────────────────────────────────────────────────────────────
 * This is the ONLY file you need to change when migrating from SQLite → cloud DB.
 *
 * HOW TO SWITCH:
 *
 * Local / Dev  (SQLite — default, no setup needed, pure JS via sql.js):
 *   DB_CLIENT = 'sqlite3'  (or leave undefined)
 *
 * Cloud / Prod (PostgreSQL):
 *   DB_CLIENT = 'pg'
 *   Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD as env vars
 *   Run: npm install pg   in the server/ directory
 *
 * Cloud / Prod (MySQL / MariaDB):
 *   DB_CLIENT = 'mysql2'
 *   Set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD as env vars
 *   Run: npm install mysql2   in the server/ directory
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require('path');

const DB_CLIENT = process.env.DB_CLIENT || 'sqlite3';

const configs = {
  sqlite3: {
    client: 'sqlite3',
    filename: path.join(__dirname, '..', 'data', 'eam_finance.db'),
  },

  pg: {
    client: 'pg',
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'eam',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl:      process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  },

  mysql2: {
    client: 'mysql2',
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME     || 'eam',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
  },
};

module.exports = configs[DB_CLIENT] || configs.sqlite3;
