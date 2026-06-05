/**
 * db/migrate.js
 * Creates tables if they do not exist.
 * Run: node db/migrate.js  (from server/ directory)
 */

const { getDb, resetDb } = require("./connection");

async function migrate() {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS finance_projects (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      sno        INTEGER,
      project    TEXT NOT NULL DEFAULT "",
      code       TEXT DEFAULT "",
      space      TEXT DEFAULT "",
      owner      TEXT DEFAULT "",
      status     TEXT NOT NULL DEFAULT "Active",
      active     INTEGER DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // Safely add 'active' column to existing tables (idempotent)
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN active INTEGER DEFAULT 1`); } catch (_) {}
  // Add 'status' column to existing tables (idempotent)
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN status TEXT DEFAULT 'Active'`); } catch (_) {}
  // Backfill: set status from active if null, default all nulls to Active
  db.run(`UPDATE finance_projects SET status = 'Active' WHERE status IS NULL AND (active IS NULL OR active = 1)`);
  db.run(`UPDATE finance_projects SET status = 'Inactive' WHERE status IS NULL AND active = 0`);
  // Backfill active from status for consistency
  db.run(`UPDATE finance_projects SET active = 1 WHERE active IS NULL`);
  db.run(`UPDATE finance_projects SET active = CASE WHEN status = 'Inactive' THEN 0 ELSE 1 END WHERE status IS NOT NULL`);
  // Add 'company' column if missing (idempotent)
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN company TEXT DEFAULT ''`); } catch (_) {}
  // Add 'comments' column for per-project notes (idempotent)
  try { db.run(`ALTER TABLE finance_projects ADD COLUMN comments TEXT DEFAULT ''`); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS finance_revenue (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id     INTEGER NOT NULL,
      month          TEXT NOT NULL,
      amount         REAL DEFAULT 0,
      milestone_type TEXT DEFAULT 'booked',
      UNIQUE(project_id, month)
    )
  `);
  // Add 'milestone_type' to existing finance_revenue rows (idempotent)
  try { db.run(`ALTER TABLE finance_revenue ADD COLUMN milestone_type TEXT DEFAULT 'booked'`); } catch (_) {}

  db.run(`
    CREATE TABLE IF NOT EXISTS client_requests (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      sno               INTEGER,
      beeline_id        TEXT NOT NULL UNIQUE,
      description       TEXT DEFAULT "",
      raised_by         TEXT DEFAULT "",
      processing_status TEXT DEFAULT "",
      overall_status    TEXT DEFAULT "",
      account_anchor    TEXT DEFAULT "",
      date_raised       TEXT DEFAULT "",
      request_type      TEXT DEFAULT "",
      updated_on        TEXT DEFAULT "",
      created_at        TEXT,
      updated_at        TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS resources (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      sno              INTEGER,
      ra_id            TEXT NOT NULL UNIQUE,
      emp_name         TEXT DEFAULT "",
      email_id         TEXT DEFAULT "",
      piw_role         TEXT DEFAULT "",
      role_or_domain   TEXT DEFAULT "",
      previous_workex  TEXT DEFAULT "",
      doj              TEXT DEFAULT "",
      total_workex     TEXT DEFAULT "",
      engagement       TEXT DEFAULT "",
      skills           TEXT DEFAULT "",
      allocation_status TEXT DEFAULT "",
      created_at       TEXT,
      updated_at       TEXT
    )
  `);
  // Add allocation_status to existing tables (idempotent)
  try { db.run(`ALTER TABLE resources ADD COLUMN allocation_status TEXT DEFAULT ''`); } catch (_) {}
  // Backfill: active resources → 'Joined', bench → 'Available'
  db.run(`UPDATE resources SET allocation_status = 'Joined' WHERE (allocation_status IS NULL OR allocation_status = '') AND LOWER(TRIM(engagement)) != 'bench' AND engagement != ''`);
  db.run(`UPDATE resources SET allocation_status = 'Available' WHERE (allocation_status IS NULL OR allocation_status = '') AND (LOWER(TRIM(engagement)) = 'bench' OR engagement = '')`);

  db.run(`
    CREATE TABLE IF NOT EXISTS ra_process (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      sno             INTEGER,
      sow             TEXT NOT NULL UNIQUE,
      start_date      TEXT DEFAULT "",
      signed_sow      TEXT DEFAULT "",
      piw             TEXT DEFAULT "",
      active          TEXT DEFAULT "",
      salesforce_id   TEXT DEFAULT "",
      proms_id        TEXT DEFAULT "",
      budget          TEXT DEFAULT "",
      open_air_code   TEXT DEFAULT "",
      comments        TEXT DEFAULT "",
      account_anchor  TEXT DEFAULT "",
      created_at      TEXT,
      updated_at      TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_config_types (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id    TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      description TEXT DEFAULT "",
      built_in   INTEGER DEFAULT 0,
      linked_to  TEXT DEFAULT "[]",
      sort_order INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_config_items (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type_id    TEXT NOT NULL,
      item_value TEXT NOT NULL,
      label      TEXT NOT NULL,
      color      TEXT DEFAULT "default",
      sort_order INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      UNIQUE(type_id, item_value)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS app_values (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key         TEXT NOT NULL UNIQUE,
      value       TEXT DEFAULT "",
      description TEXT DEFAULT "",
      created_at  TEXT,
      updated_at  TEXT
    )
  `);

  console.log("Migration complete.");
  db.close();
  resetDb();
}

migrate().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });