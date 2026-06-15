/**
 * EAM API Server
 * Run: node index.js   (from server/ directory)
 *
 * Endpoints:
 *   /api/finance/*   — finance revenue data
 *   /api/health      — health check
 */

const express = require('express');
const cors = require('cors');
const { getDb } = require('./db/connection');
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
const resourceInsightsRoutes = require('./routes/resource-insights');
const aiRoutes = require('./routes/ai');
const { hashPassword } = require('./routes/auth');

const PORT = process.env.PORT || 3001;

const app = express();

// ── Run DB migrations on startup ─────────────────────────────────────
async function runMigrations() {
  const db = await getDb();
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
    engagement TEXT DEFAULT "", skills TEXT DEFAULT "",
    created_at TEXT, updated_at TEXT
  )`);
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
    created_at TEXT NOT NULL
  )`);

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
  // Seed default Admin role and admin user if they don't exist
  const adminRole = db.get("SELECT id FROM roles WHERE name = 'Admin'");
  let adminRoleId = adminRole ? adminRole.id : null;

  // ── Patch ALL roles: add any missing page permissions ─────────────────
  // This runs on every startup so new pages are automatically granted to Admin
  // and visible in UAC for other roles to configure.
  const ALL_KNOWN_PAGES = [
    'account_summary','executive_summary','executive_revenue','executive_invoicing',
    'resources_info','resources_utilization','resources_upskilling','resources_insights',
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
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update('admin123' + 'eam_salt_2024').digest('hex');
    const ts = new Date().toISOString();
    db.run(
      "INSERT INTO users (username, password_hash, password_plain, display_name, role_id, active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)",
      ['admin', hash, 'admin123', 'Administrator', adminRoleId, 1, ts, ts]
    );
  }

}

// ── Global error handlers ─────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  process.exit(1);
});

// ── Request logger ────────────────────────────────────────────────────
app.use((req, _res, next) => {
  next();
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
app.use('/api/user-preferences', userPreferencesRoutes);
app.use('/api/resource-insights', resourceInsightsRoutes);
app.use('/api/ai', aiRoutes);

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────
runMigrations().then(() => {
  app.listen(PORT, () => {
    const dbConfig = require('./config/database');
  });
}).catch(err => { process.exit(1); });