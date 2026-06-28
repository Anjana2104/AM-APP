/**
 * EAM API Server
 * Run: node index.js   (from server/ directory)
 *
 * Endpoints:
 *   /api/finance/*   — finance revenue data
 *   /api/health      — health check
 */
'use strict';

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { getDb } = require('./db/connection');
const logger = require('./utils/logger');
const financeRoutes = require('./routes/finance');
const invoiceRoutes = require('./routes/invoices');
const resourceRoutes = require('./routes/resources');
const requestRoutes = require('./routes/requests');
const processRoutes = require('./routes/process');
const configRoutes = require('./routes/config');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const auditRoutes = require('./routes/audit');
const userGroupRoutes = require('./routes/user-groups');
const notificationRoutes = require('./routes/notifications');
const notificationTriggerRoutes = require('./routes/notification-triggers');
const userPreferencesRoutes = require('./routes/user-preferences');
const notificationRulesRoutes = require('./routes/notification-rules');
const { evaluateRules } = require('./utils/evaluateRules');
const resourceInsightsRoutes = require('./routes/resource-insights');
const aiRoutes = require('./routes/ai');
const templatesRoutes = require('./routes/templates');
const piwGenerationRoutes = require('./routes/piwGeneration');
const sowGenerationRoutes = require('./routes/sowGeneration');

const PORT = process.env.PORT || 3001;

const app = express();

// ── Run DB migrations on startup ─────────────────────────────────────
async function runMigrations() {
  logger.info('Running database migrations...');
  const db = await getDb();
  logger.info('Database connection established');
  
  // finance_projects base table
  db.run(`CREATE TABLE IF NOT EXISTS finance_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sno INTEGER,
    project TEXT NOT NULL DEFAULT "", company TEXT DEFAULT "",
    code TEXT DEFAULT "", space TEXT DEFAULT "", owner TEXT DEFAULT "",
    status TEXT NOT NULL DEFAULT "Active", active INTEGER DEFAULT 1,
    created_at TEXT, updated_at TEXT
  )`);
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN active INTEGER DEFAULT 1`); } catch (_) {}
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN status TEXT DEFAULT 'Active'`); } catch (_) {}
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN company TEXT DEFAULT ""`); } catch (_) {}
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN comments TEXT DEFAULT ""`); } catch (_) {}
  db.run(`UPDATE finance_projects SET status = 'Active' WHERE status IS NULL AND (active IS NULL OR active = 1)`);
  db.run(`UPDATE finance_projects SET status = 'Inactive' WHERE status IS NULL AND active = 0`);
  db.run(`UPDATE finance_projects SET active = CASE WHEN status = 'Inactive' THEN 0 ELSE 1 END WHERE status IS NOT NULL`);
  // Unique index on code — enforces PK constraint at DB level
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_projects_code ON finance_projects(code)`);

  db.run(`CREATE TABLE IF NOT EXISTS finance_revenue (
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
    month TEXT NOT NULL, amount REAL DEFAULT 0,
    milestone_type TEXT DEFAULT 'booked', UNIQUE(project_id, month)
  )`);
  try { db.run(`ALTER TABLE finance_revenue ADD COLUMN milestone_type TEXT DEFAULT 'booked'`); } catch (_) {}

  // ── Project bookings — when and how much booked per milestone month ──────────
  db.run(`CREATE TABLE IF NOT EXISTS project_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    milestone_month TEXT NOT NULL,
    booking_month TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    notes TEXT DEFAULT "",
    created_by TEXT DEFAULT "system",
    booking_type TEXT DEFAULT "fixed",
    created_at TEXT NOT NULL
  )`);
  // Idempotent migration for existing DBs
  try { db.run(`ALTER TABLE project_bookings ADD COLUMN booking_type TEXT DEFAULT 'fixed'`); } catch (_) {}

  db.run(`CREATE TABLE IF NOT EXISTS client_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sno INTEGER,
    beeline_id TEXT NOT NULL UNIQUE, description TEXT DEFAULT "",
    raised_by TEXT DEFAULT "", processing_status TEXT DEFAULT "",
    overall_status TEXT DEFAULT "", account_anchor TEXT DEFAULT "",
    date_raised TEXT DEFAULT "", request_type TEXT DEFAULT "",
    updated_on TEXT DEFAULT "", created_at TEXT, updated_at TEXT,
    is_active INTEGER DEFAULT 1
  )`);
  try { db.run(`ALTER TABLE client_requests ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (_) {}
  db.run(`CREATE TABLE IF NOT EXISTS resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sno INTEGER,
    ra_id TEXT NOT NULL UNIQUE, emp_name TEXT DEFAULT "",
    email_id TEXT DEFAULT "", piw_role TEXT DEFAULT "",
    role_or_domain TEXT DEFAULT "", previous_workex TEXT DEFAULT "",
    doj TEXT DEFAULT "", total_workex TEXT DEFAULT "",
    engagement TEXT DEFAULT "", skills TEXT DEFAULT "", is_active INTEGER DEFAULT 1,
    allocation_percentage REAL DEFAULT NULL,
    created_at TEXT, updated_at TEXT
  )`);
  try { db.run(`ALTER TABLE resources ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (_) {}
  try { db.run(`ALTER TABLE resources ADD COLUMN allocation_percentage REAL DEFAULT NULL`); } catch (_) {}
  db.run(`CREATE TABLE IF NOT EXISTS ra_process (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sno INTEGER,
    sow TEXT NOT NULL UNIQUE, start_date TEXT DEFAULT "",
    signed_sow TEXT DEFAULT "", piw TEXT DEFAULT "",
    active TEXT DEFAULT "", salesforce_id TEXT DEFAULT "",
    proms_id TEXT DEFAULT "", budget TEXT DEFAULT "",
    open_air_code TEXT DEFAULT "", comments TEXT DEFAULT "",
    account_anchor TEXT DEFAULT "", created_at TEXT, updated_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS app_config_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, description TEXT DEFAULT "",
    built_in INTEGER DEFAULT 0, linked_to TEXT DEFAULT "[]",
    sort_order INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS app_config_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type_id TEXT NOT NULL,
    item_value TEXT NOT NULL, label TEXT NOT NULL,
    color TEXT DEFAULT "default", sort_order INTEGER DEFAULT 0,
    created_at TEXT, updated_at TEXT, UNIQUE(type_id, item_value)
  )`);
  // Invoice tables
  db.run(`CREATE TABLE IF NOT EXISTS invoice_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sno INTEGER,
    project TEXT NOT NULL DEFAULT "", company TEXT DEFAULT "",
    code TEXT DEFAULT "", status TEXT NOT NULL DEFAULT "Active", active INTEGER DEFAULT 1,
    created_at TEXT, updated_at TEXT
  )`);
  try { db.run(`ALTER TABLE invoice_projects ADD COLUMN active INTEGER DEFAULT 1`); } catch (_) {}
  try { db.run(`ALTER TABLE invoice_projects ADD COLUMN status TEXT DEFAULT 'Active'`); } catch (_) {}
  try { db.run(`ALTER TABLE invoice_projects ADD COLUMN comments TEXT DEFAULT ""`); } catch (_) {}
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_projects_code ON invoice_projects(code)`);

  db.run(`CREATE TABLE IF NOT EXISTS invoice_amounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
    month TEXT NOT NULL, amount REAL DEFAULT 0, UNIQUE(project_id, month)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS app_values (
    id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE,
    value TEXT DEFAULT "", description TEXT DEFAULT "",
    created_at TEXT, updated_at TEXT
  )`);

  // ── User Access Control tables ────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT "",
    permissions TEXT DEFAULT "{}",
    created_at TEXT,
    updated_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_plain TEXT DEFAULT "",
    display_name TEXT DEFAULT "",
    role_id INTEGER REFERENCES roles(id),
    active INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  )`);
  // Add password_plain column if upgrading from older schema
  try { db.run(`ALTER TABLE users ADD COLUMN password_plain TEXT DEFAULT ""`); } catch (_) {}

  // Audit log table
  db.run(`CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    record_name TEXT DEFAULT "",
    field TEXT NOT NULL,
    old_value TEXT DEFAULT "",
    new_value TEXT DEFAULT "",
    changed_by TEXT DEFAULT "",
    changed_at TEXT NOT NULL
  )`);

  // ── User Groups tables ────────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS user_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT "",
    user_type_config_id TEXT DEFAULT "",
    created_at TEXT,
    updated_at TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    UNIQUE(group_id, user_id)
  )`);

  // ── Notifications table ───────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT DEFAULT "task",
    title TEXT NOT NULL,
    message TEXT DEFAULT "",
    target_user_id INTEGER,
    target_group_id INTEGER,
    source_user TEXT DEFAULT "",
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    read_by TEXT DEFAULT "[]",
    created_at TEXT NOT NULL
  )`);

  // ── Notification Triggers table ───────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS notification_triggers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source_table TEXT NOT NULL,
    trigger_field TEXT NOT NULL,
    trigger_label TEXT DEFAULT "",
    message_template TEXT DEFAULT "",
    notify_target_type TEXT DEFAULT "field_value",
    notify_target_value TEXT DEFAULT "",
    notification_type TEXT DEFAULT "task",
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  )`);
  // Add sort_order to existing notification_triggers (idempotent)
  try { db.run(`ALTER TABLE notification_triggers ADD COLUMN sort_order INTEGER DEFAULT 0`); } catch (_) {}
  // Backfill sort_order with id order for existing rows
  db.run(`UPDATE notification_triggers SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL`);

  // ── Scheduled Notification Rules table ────────────────────────────────────
  // Proactive time-based rules; evaluated by evaluateRules.js on a schedule.
  db.run(`CREATE TABLE IF NOT EXISTS notification_rules (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL,
    description          TEXT    DEFAULT '',
    source_table         TEXT    NOT NULL,
    condition_type       TEXT    NOT NULL,
    date_field           TEXT    DEFAULT '',
    lead_time_days       INTEGER DEFAULT 0,
    filter_field         TEXT    DEFAULT '',
    filter_operator      TEXT    DEFAULT '',
    filter_value         TEXT    DEFAULT '',
    threshold_field      TEXT    DEFAULT '',
    threshold_operator   TEXT    DEFAULT '',
    threshold_value      REAL    DEFAULT NULL,
    config_value_key     TEXT    DEFAULT '',
    schedule_type        TEXT    DEFAULT 'daily',
    schedule_day         INTEGER DEFAULT NULL,
    notification_type    TEXT    DEFAULT 'alert',
    notify_target_type   TEXT    DEFAULT 'group',
    notify_target_value  TEXT    DEFAULT '',
    message_template     TEXT    DEFAULT '',
    is_active            INTEGER DEFAULT 1,
    last_run_at          TEXT    DEFAULT NULL,
    sort_order           INTEGER DEFAULT 0,
    created_at           TEXT,
    updated_at           TEXT
  )`);
  // Migration: add sort_order if it doesn't exist (for existing databases)
  try { db.run('ALTER TABLE notification_rules ADD COLUMN sort_order INTEGER DEFAULT 0'); } catch (_) { /* already exists */ }
  // Migration: normalize source_user values to consistent tab names
  db.run(`UPDATE notifications SET source_user = 'Scheduled Rules' WHERE source_user = 'Rule Engine'`);
  db.run(`UPDATE notifications SET source_user = 'Change Triggers' WHERE source_user NOT IN ('Scheduled Rules', 'System Error') AND source_user != ''`);

  // Deduplication log for scheduled rules — one entry per rule+record per day
  db.run(`CREATE TABLE IF NOT EXISTS notification_rule_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_id    INTEGER NOT NULL,
    record_id  INTEGER NOT NULL,
    fired_date TEXT    NOT NULL,
    fired_at   TEXT    NOT NULL,
    UNIQUE (rule_id, record_id, fired_date)
  )`);

  // ── User Preferences table ────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    preferences TEXT DEFAULT "{}",
    updated_at TEXT
  )`);

  // Add trigger_id to notifications (idempotent — used for snooze filtering)
  try { db.run(`ALTER TABLE notifications ADD COLUMN trigger_id INTEGER DEFAULT NULL`); } catch (_) {}

  // ── Beeline ID link on resources ─────────────────────────────────────────
  try { db.run(`ALTER TABLE resources ADD COLUMN beeline_id TEXT DEFAULT ""`); } catch (_) {}

  // ── Resource Comments table ────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS resource_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT "",
    tag TEXT NOT NULL DEFAULT "General",
    body TEXT NOT NULL DEFAULT "",
    created_at TEXT NOT NULL,
    updated_at TEXT
  )`);
  try { db.run(`ALTER TABLE resource_comments ADD COLUMN updated_at TEXT`); } catch (_) {}

  // ── Request Comments table ─────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS request_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT "",
    tag TEXT NOT NULL DEFAULT "General",
    body TEXT NOT NULL DEFAULT "",
    created_at TEXT NOT NULL
  )`);

  // ── Resource Insights table ────────────────────────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS resource_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id INTEGER NOT NULL,
    section TEXT NOT NULL DEFAULT 'interaction',
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    tag TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    priority TEXT NOT NULL DEFAULT 'medium',
    target_date TEXT DEFAULT NULL,
    author TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);

  // ── Templates table (PIW, SOW, Holiday Calendar) ────────────────────────
  db.run(`CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    file_data BLOB,
    mime_type TEXT DEFAULT "",
    uploaded_by TEXT DEFAULT "system",
    uploaded_at TEXT NOT NULL,
    description TEXT DEFAULT "",
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(type)
  )`);
  // Create index on type for faster filtering
  db.run(`CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(type)`);

  // Seed default Admin role and admin user if they don't exist
  const adminRole = db.get("SELECT id FROM roles WHERE name = 'Admin'");
  let adminRoleId = adminRole ? adminRole.id : null;

  // ── Patch ALL roles: add any missing page permissions ─────────────────
  // This runs on every startup so new pages are automatically granted to Admin
  // and visible in UAC for other roles to configure.
  const ALL_KNOWN_PAGES = [
    'account_summary','executive_summary','executive_revenue','executive_invoicing',
    'resources_info','resources_utilization','resources_upskilling','resources_insights','resources_forecasting',
    'clientmgmt_requests','clientmgmt_connects',
    'information_ratecard','information_teamhierarchy','information_process','information_codeguide',
    'configuration','user_settings','user_access_control',
  ];
  const existingRoles = db.all("SELECT id, name, permissions FROM roles");
  for (const role of existingRoles) {
    let perms = {};
    try { perms = JSON.parse(role.permissions || '{}'); } catch { perms = {}; }
    let changed = false;
    for (const page of ALL_KNOWN_PAGES) {
      if (!perms[page]) {
        // Admin gets full access; others get view-only by default
        perms[page] = role.name === 'Admin'
          ? { view: true, edit: true, delete: true }
          : { view: false, edit: false, delete: false };
        changed = true;
      }
    }
    if (changed) {
      db.run("UPDATE roles SET permissions=?, updated_at=? WHERE id=?",
        [JSON.stringify(perms), new Date().toISOString(), role.id]);
    }
  }

  if (!adminRoleId) {
    const allPages = ALL_KNOWN_PAGES;
    const permissions = {};
    allPages.forEach(p => { permissions[p] = { view: true, edit: true, delete: true }; });
    const ts = new Date().toISOString();
    db.run(
      "INSERT INTO roles (name, description, permissions, created_at, updated_at) VALUES (?,?,?,?,?)",
      ['Admin', 'Full access to all pages and features', JSON.stringify(permissions), ts, ts]
    );
    adminRoleId = db.lastId();
  }

  const adminUser = db.get("SELECT id FROM users WHERE username = 'admin'");
  if (!adminUser) {
    const adminPassword = process.env.EAM_ADMIN_DEFAULT_PASSWORD || 'admin123';
    const adminSalt = process.env.EAM_PASSWORD_SALT || 'eam_default_salt';
    const hash = crypto.pbkdf2Sync(adminPassword, adminSalt, 100000, 32, 'sha256').toString('hex');
    const ts = new Date().toISOString();
    db.run(
      "INSERT INTO users (username, password_hash, display_name, role_id, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
      ['admin', hash, 'Administrator', adminRoleId, 1, ts, ts]
    );
  }

  // ── Seed / repair default non-admin users ────────────────────────────
  // These users are always seeded on startup so that a fresh or upgraded DB
  // has working credentials. We also rehash any existing user whose password_hash
  // no longer matches (e.g., after the SHA-256 → PBKDF2 migration).
  const salt = process.env.EAM_PASSWORD_SALT || 'eam_default_salt';
  function seedHash(pw) {
    return crypto.pbkdf2Sync(String(pw), salt, 100000, 32, 'sha256').toString('hex');
  }

  // Ensure supporting roles exist before seeding users
  function ensureRole(name, description) {
    const existing = db.get("SELECT id FROM roles WHERE name = ?", [name]);
    if (existing) return existing.id;
    const allPages = ALL_KNOWN_PAGES;
    const permissions = {};
    allPages.forEach(p => { permissions[p] = { view: true, edit: false, delete: false }; });
    const ts = new Date().toISOString();
    db.run(
      "INSERT INTO roles (name, description, permissions, created_at, updated_at) VALUES (?,?,?,?,?)",
      [name, description, JSON.stringify(permissions), ts, ts]
    );
    return db.lastId();
  }

  const staffingRoleId = ensureRole('Staffing Team', 'Staffing team access');
  const aaRoleId       = ensureRole('AA Team', 'AA team access');
  const pcRoleId       = ensureRole('PC Team', 'PC team access');

  const defaultUsers = [
    { username: 'StaffingTeam', password: 'st@123',  displayName: 'Staffing Team', roleId: staffingRoleId },
    { username: 'AATeam',       password: 'aa@123',  displayName: 'AA Team',       roleId: aaRoleId },
    { username: 'PCTeam',       password: 'pc@123',  displayName: 'PC Team',       roleId: pcRoleId },
  ];

  for (const u of defaultUsers) {
    const correctHash = seedHash(u.password);
    const ts = new Date().toISOString();
    const row = db.get("SELECT id, password_hash FROM users WHERE LOWER(username) = LOWER(?)", [u.username]);
    if (!row) {
      // Create missing user
      db.run(
        "INSERT INTO users (username, password_hash, display_name, role_id, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
        [u.username, correctHash, u.displayName, u.roleId, 1, ts, ts]
      );
      logger.info('Default user seeded', { username: u.username });
    } else if (row.password_hash !== correctHash) {
      // Rehash: user exists but hash is from old SHA-256 scheme or different salt
      db.run("UPDATE users SET password_hash=?, updated_at=? WHERE id=?", [correctHash, ts, row.id]);
      logger.info('Default user password rehashed to PBKDF2', { username: u.username });
    }
  }

  // Also repair admin if it exists with a stale hash
  const adminRow = db.get("SELECT id, password_hash FROM users WHERE username = 'admin'");
  if (adminRow) {
    const adminPw = process.env.EAM_ADMIN_DEFAULT_PASSWORD || 'admin123';
    const correctAdminHash = seedHash(adminPw);
    if (adminRow.password_hash !== correctAdminHash) {
      db.run("UPDATE users SET password_hash=?, updated_at=? WHERE id=?",
        [correctAdminHash, new Date().toISOString(), adminRow.id]);
      logger.info('Admin password rehashed to PBKDF2', {});
    }
  }

  console.log('✅ Database migrations completed');
}

// ── Global error handlers ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { err: err.message, stack: err.stack });
  // Don't exit — keep server alive for non-fatal errors
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  // Don't exit — keep server alive; individual request errors are handled in routes
});


app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dbConfig = require('./config/database');
  res.json({
    status: 'ok',
    database: dbConfig.client,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/finance', financeRoutes);
app.use('/api/invoice', invoiceRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/process', processRoutes);
app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/user-groups', userGroupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-triggers', notificationTriggerRoutes);
app.use('/api/notification-rules', notificationRulesRoutes);
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/resource-insights', resourceInsightsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/piwGeneration', piwGenerationRoutes);
app.use('/api/sowGeneration', sowGenerationRoutes);

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error('Unhandled route error', { method: req.method, path: req.path, err: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────
runMigrations().then(() => {
  app.listen(PORT, () => {
    try {
      const dbConfig = require('./config/database');
      logger.info(`Server started`, { port: PORT, database: dbConfig.client, url: `http://localhost:${PORT}` });
    } catch (e) {
      logger.info(`Server started`, { port: PORT });
    }
  });

  // ── Scheduled Rule Engine ─────────────────────────────────────────────
  // Evaluate active notification rules every hour.
  // Rules with schedule_type='daily' fire at most once per day,
  // 'monthly' once on the configured day-of-month, 'weekly' once on Monday.
  async function runRuleEngine() {
    try {
      const db = await getDb();
      const result = await evaluateRules(db, false); // scheduled — respects dedup
      if (result.totalFired > 0) {
        logger.info('Rule engine cycle complete', { notificationsFired: result.totalFired });
      }
    } catch (err) {
      logger.error('Rule engine error', { err: err.message });
    }
  }
  // Run once on startup (catches any missed runs if server was down)
  runRuleEngine();
  // Then every 60 minutes
  setInterval(runRuleEngine, 60 * 60 * 1000);

}).catch(err => {
  logger.error('Server startup failed', { err: err.message, stack: err.stack });
  process.exit(1);
});
