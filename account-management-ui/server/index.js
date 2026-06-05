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
    updated_on TEXT DEFAULT "", created_at TEXT, updated_at TEXT
  )`);
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
  console.log(' Migrations applied.');
}

// ── Middleware ────────────────────────────────────────────────────────
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

// ── 404 handler ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────
runMigrations().then(() => {
  app.listen(PORT, () => {
    const dbConfig = require('./config/database');
    console.log(`\n EAM API Server running on http://localhost:${PORT}`);
    console.log(` Database: ${dbConfig.client}`);
    if (dbConfig.client === 'sqlite3') {
      console.log(` SQLite file: ${dbConfig.filename}`);
    }
    console.log(`\n   GET    /api/health`);
    console.log(`   GET    /api/finance/projects`);
    console.log(`   GET    /api/finance/month-headers`);
    console.log(`   POST   /api/finance/projects/bulk`);
    console.log(`   PUT    /api/finance/projects/:id`);
    console.log(`   DELETE /api/finance/projects/:id\n`);
  });
}).catch(err => { console.error('Migration failed:', err); process.exit(1); });