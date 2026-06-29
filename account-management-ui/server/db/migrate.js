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
      updated_at        TEXT,
      is_active         INTEGER DEFAULT 1
    )
  `);
  // Add is_active to existing client_requests rows (idempotent)
  try { db.run(`ALTER TABLE client_requests ADD COLUMN is_active INTEGER DEFAULT 1`); } catch (_) {}
  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_client_requests_beeline_id_ci_unique
      ON client_requests (LOWER(TRIM(beeline_id)))
      WHERE beeline_id IS NOT NULL AND TRIM(beeline_id) != ''`);
  } catch (_) {}

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
  // Add skill_type column (Commodity / Specialized) — idempotent
  try { db.run(`ALTER TABLE resources ADD COLUMN skill_type TEXT DEFAULT ''`); } catch (_) {}
  // Add per-resource engagement date range columns — idempotent
  try { db.run(`ALTER TABLE resources ADD COLUMN engagement_start_date TEXT DEFAULT ''`); } catch (_) {}
  try { db.run(`ALTER TABLE resources ADD COLUMN engagement_end_date TEXT DEFAULT ''`); } catch (_) {}
  // Add process_id to link a resource to a process (idempotent)
  try { db.run(`ALTER TABLE resources ADD COLUMN process_id INTEGER DEFAULT NULL`); } catch (_) {}
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
      step_completed_at TEXT DEFAULT "{}",
      created_at      TEXT,
      updated_at      TEXT
    )
  `);

  // Add process_id (human-readable PK like P1, P2) to ra_process (idempotent)
  try { db.run(`ALTER TABLE ra_process ADD COLUMN process_id TEXT DEFAULT NULL`); } catch (_) {}
  // Backfill existing rows: P1, P2, ... based on internal id
  try { db.run(`UPDATE ra_process SET process_id = 'P' || id WHERE process_id IS NULL`); } catch (_) {}
  // Add eprev stage column (idempotent)
  try { db.run(`ALTER TABLE ra_process ADD COLUMN eprev TEXT DEFAULT ''`); } catch (_) {}
  // Per-step completion timestamp map
  try { db.run(`ALTER TABLE ra_process ADD COLUMN step_completed_at TEXT DEFAULT '{}'`); } catch (_) {}
  // Unique partial index for PIW name (non-empty) — prevents duplicate PIW names
  try { db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_process_piw_unique ON ra_process(piw) WHERE piw != '' AND piw IS NOT NULL`); } catch (_) {}

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

  db.run(`
    CREATE TABLE IF NOT EXISTS team_hierarchy_entries (
      id            TEXT PRIMARY KEY,
      team_type     TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT "",
      title         TEXT DEFAULT "",
      department    TEXT DEFAULT "",
      reporting_to  TEXT DEFAULT NULL,
      email         TEXT DEFAULT "",
      phone         TEXT DEFAULT "",
      responsibility TEXT DEFAULT "",
      sort_order    INTEGER DEFAULT 0,
      created_at    TEXT,
      updated_at    TEXT
    )
  `);
  try { db.run(`ALTER TABLE team_hierarchy_entries ADD COLUMN phone TEXT DEFAULT ''`); } catch (_) {}
  db.run(`CREATE INDEX IF NOT EXISTS idx_team_hierarchy_team_type_sort ON team_hierarchy_entries(team_type, sort_order)`);

  // Request comments table (idempotent)
  db.run(`CREATE TABLE IF NOT EXISTS request_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER NOT NULL,
    author TEXT NOT NULL DEFAULT "",
    tag TEXT NOT NULL DEFAULT "General",
    body TEXT NOT NULL DEFAULT "",
    created_at TEXT NOT NULL
  )`);

  // Add booking_type column to project_bookings (idempotent)
  try { db.run(`ALTER TABLE project_bookings ADD COLUMN booking_type TEXT DEFAULT 'fixed'`); } catch (_) {}

  db.close();
  resetDb();
}

migrate().then(() => process.exit(0)).catch(err => { console.error('Migration error:', err); process.exit(1); });