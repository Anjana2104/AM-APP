-- =============================================================================
-- EAM (Engagement & Account Management) — Full Database DDL
-- =============================================================================
-- Engine  : SQLite 3
-- File    : server/data/eam_finance.db
-- Updated : 2026-06-24
--
-- Tables (22):
--   Finance        : finance_projects, finance_revenue
--   Invoice        : invoice_projects, invoice_amounts
--   Client Mgmt    : client_requests, request_comments
--   Resources      : resources, resource_comments, resource_insights
--   Process        : ra_process
--   Configuration  : app_config_types, app_config_items, app_values
--   User & Access  : roles, users, user_groups, user_group_members,
--                    user_preferences
--   Notifications  : notifications, notification_triggers
--   Templates      : templates
--   Audit          : audit_log
--
-- UI Pages referencing page IDs in roles.permissions:
--   account_summary, executive_summary, executive_revenue, executive_invoicing,
--   clientmgmt_requests, resources_info, engagement_mapping,
--   clientmgmt_connects, configuration, user_access_control, user_settings
-- =============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- =============================================================================
-- FINANCE
-- =============================================================================

-- Billable projects for revenue management
CREATE TABLE IF NOT EXISTS finance_projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sno         INTEGER,
  project     TEXT    NOT NULL DEFAULT '',
  company     TEXT             DEFAULT '',
  code        TEXT             DEFAULT '',   -- unique project code
  space       TEXT             DEFAULT '',   -- business space / division
  owner       TEXT             DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'Active',   -- 'Active' | 'Inactive'
  active      INTEGER          DEFAULT 1,           -- 1=active, 0=inactive (mirrors status)
  comments    TEXT             DEFAULT '',
  created_at  TEXT,
  updated_at  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_finance_projects_code
  ON finance_projects (code);

-- Monthly revenue entries per finance project
CREATE TABLE IF NOT EXISTS finance_revenue (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES finance_projects (id),
  month          TEXT    NOT NULL,              -- format: YYYY-MM
  amount         REAL             DEFAULT 0,
  milestone_type TEXT             DEFAULT 'booked',  -- 'booked' | 'invoiced'
  UNIQUE (project_id, month)
);

-- =============================================================================
-- INVOICE
-- =============================================================================

-- Projects tracked for invoice management (separate from finance)
CREATE TABLE IF NOT EXISTS invoice_projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sno         INTEGER,
  project     TEXT    NOT NULL DEFAULT '',
  company     TEXT             DEFAULT '',
  code        TEXT             DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'Active',
  active      INTEGER          DEFAULT 1,
  comments    TEXT             DEFAULT '',
  created_at  TEXT,
  updated_at  TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_projects_code
  ON invoice_projects (code);

-- Monthly invoice amounts per invoice project
CREATE TABLE IF NOT EXISTS invoice_amounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES invoice_projects (id),
  month       TEXT    NOT NULL,   -- format: YYYY-MM
  amount      REAL             DEFAULT 0,
  UNIQUE (project_id, month)
);

-- =============================================================================
-- CLIENT REQUESTS
-- =============================================================================

-- Beeline / client resource requests (staffing requests)
CREATE TABLE IF NOT EXISTS client_requests (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  sno               INTEGER,
  beeline_id        TEXT    NOT NULL UNIQUE,   -- external Beeline system ID
  description       TEXT             DEFAULT '',
  raised_by         TEXT             DEFAULT '',
  processing_status TEXT             DEFAULT '',  -- e.g. 'In Progress', 'Closed'
  overall_status    TEXT             DEFAULT '',  -- e.g. 'Open', 'Fulfilled'
  account_anchor    TEXT             DEFAULT '',
  date_raised       TEXT             DEFAULT '',
  request_type      TEXT             DEFAULT '',  -- e.g. 'New', 'Replacement'
  updated_on        TEXT             DEFAULT '',
  is_active         INTEGER          DEFAULT 1,   -- soft-delete flag
  created_at        TEXT,
  updated_at        TEXT
);

-- Comments and notes on client requests
CREATE TABLE IF NOT EXISTS request_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id  INTEGER NOT NULL REFERENCES client_requests (id),
  author      TEXT    NOT NULL DEFAULT '',
  tag         TEXT    NOT NULL DEFAULT 'General',
  body        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);

-- =============================================================================
-- RESOURCES
-- =============================================================================

-- RA resource / employee records
CREATE TABLE IF NOT EXISTS resources (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  sno                   INTEGER,
  ra_id                 TEXT    NOT NULL UNIQUE,   -- internal RA employee ID
  emp_name              TEXT             DEFAULT '',
  email_id              TEXT             DEFAULT '',
  piw_role              TEXT             DEFAULT '',   -- role from PIW file
  role_or_domain        TEXT             DEFAULT '',   -- domain / practice area
  previous_workex       TEXT             DEFAULT '',
  doj                   TEXT             DEFAULT '',   -- date of joining (YYYY-MM-DD)
  total_workex          TEXT             DEFAULT '',
  engagement            TEXT             DEFAULT '',   -- current engagement / project name
  skills                TEXT             DEFAULT '',   -- comma-separated skill list
  allocation_status     TEXT             DEFAULT '',   -- 'Joined' | 'Available' | 'On Bench' | 'Resigned'
  skill_type            TEXT             DEFAULT '',   -- 'Commodity' | 'Specialized'
  beeline_id            TEXT             DEFAULT '',   -- linked Beeline request ID
  engagement_start_date TEXT             DEFAULT '',   -- YYYY-MM-DD
  engagement_end_date   TEXT             DEFAULT '',   -- YYYY-MM-DD
  process_id            INTEGER          DEFAULT NULL REFERENCES ra_process (id),
  created_at            TEXT,
  updated_at            TEXT
);

-- Free-form comments on resources
CREATE TABLE IF NOT EXISTS resource_comments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources (id),
  author      TEXT    NOT NULL DEFAULT '',
  tag         TEXT    NOT NULL DEFAULT 'General',
  body        TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL
);

-- Log entries for Resource Intelligence
-- Sections: interaction | escalation | career_preference | plan | general
CREATE TABLE IF NOT EXISTS resource_insights (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  resource_id INTEGER NOT NULL REFERENCES resources (id),
  section     TEXT    NOT NULL DEFAULT 'interaction',
  title       TEXT    NOT NULL DEFAULT '',
  body        TEXT    NOT NULL DEFAULT '',
  tag         TEXT    NOT NULL DEFAULT '',
  status      TEXT    NOT NULL DEFAULT 'open',    -- 'open' | 'closed'
  priority    TEXT    NOT NULL DEFAULT 'medium',  -- 'low' | 'medium' | 'high'
  target_date TEXT             DEFAULT NULL,      -- YYYY-MM-DD
  author      TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

-- =============================================================================
-- PROCESS (SOW / PIW)
-- =============================================================================

-- Internal process / SOW records
CREATE TABLE IF NOT EXISTS ra_process (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sno            INTEGER,
  sow            TEXT    NOT NULL UNIQUE,   -- SOW name (human-readable unique key)
  process_id     TEXT             DEFAULT NULL,  -- human-readable ID: P1, P2, …
  start_date     TEXT             DEFAULT '',
  signed_sow     TEXT             DEFAULT '',    -- signed SOW document reference
  piw            TEXT             DEFAULT '',    -- linked PIW filename (unique if non-empty)
  active         TEXT             DEFAULT '',
  salesforce_id  TEXT             DEFAULT '',
  proms_id       TEXT             DEFAULT '',
  budget         TEXT             DEFAULT '',
  open_air_code  TEXT             DEFAULT '',
  eprev          TEXT             DEFAULT '',    -- ePrev stage
  comments       TEXT             DEFAULT '',
  account_anchor TEXT             DEFAULT '',
  created_at     TEXT,
  updated_at     TEXT
);

-- Prevent duplicate non-empty PIW names
CREATE UNIQUE INDEX IF NOT EXISTS idx_ra_process_piw_unique
  ON ra_process (piw)
  WHERE piw != '' AND piw IS NOT NULL;

-- =============================================================================
-- CONFIGURATION
-- =============================================================================

-- Configuration type definitions (dropdown categories)
CREATE TABLE IF NOT EXISTS app_config_types (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id     TEXT    NOT NULL UNIQUE,   -- e.g. 'allocation_status', 'request_type'
  name        TEXT    NOT NULL,
  description TEXT             DEFAULT '',
  built_in    INTEGER          DEFAULT 0,      -- 1 = system-defined, cannot delete
  linked_to   TEXT             DEFAULT '[]',  -- JSON array of page IDs that use this config
  sort_order  INTEGER          DEFAULT 0,
  created_at  TEXT,
  updated_at  TEXT
);

-- Values within each config type (dropdown options)
CREATE TABLE IF NOT EXISTS app_config_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type_id     TEXT    NOT NULL REFERENCES app_config_types (type_id),
  item_value  TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  color       TEXT             DEFAULT 'default',  -- Ant Design color tag
  sort_order  INTEGER          DEFAULT 0,
  created_at  TEXT,
  updated_at  TEXT,
  UNIQUE (type_id, item_value)
);

-- Generic key-value store for application settings
CREATE TABLE IF NOT EXISTS app_values (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT    NOT NULL UNIQUE,
  value       TEXT             DEFAULT '',
  description TEXT             DEFAULT '',
  created_at  TEXT,
  updated_at  TEXT
);

-- =============================================================================
-- USER & ACCESS CONTROL
-- =============================================================================

-- User access roles with page-level permissions
-- permissions column stores JSON: { "page_id": { "view": bool, "edit": bool, "delete": bool } }
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE,
  description TEXT             DEFAULT '',
  permissions TEXT             DEFAULT '{}',
  created_at  TEXT,
  updated_at  TEXT
);

-- Application users
CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL UNIQUE,
  password_hash  TEXT    NOT NULL,   -- SHA-256(password + 'eam_salt_2024')
  password_plain TEXT             DEFAULT '',   -- plain-text copy for admin visibility; never shown in UI
  display_name   TEXT             DEFAULT '',
  role_id        INTEGER          DEFAULT NULL REFERENCES roles (id),
  active         INTEGER          DEFAULT 1,
  created_at     TEXT,
  updated_at     TEXT
);

-- Named groups for notification targeting
-- user_type_config_id retained for DB compatibility; not exposed in UI
CREATE TABLE IF NOT EXISTS user_groups (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT    NOT NULL,
  description          TEXT             DEFAULT '',
  user_type_config_id  TEXT             DEFAULT '',  -- linked config type
  created_at           TEXT,
  updated_at           TEXT
);

-- Members of user groups
CREATE TABLE IF NOT EXISTS user_group_members (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES user_groups (id),
  user_id   INTEGER NOT NULL REFERENCES users (id),
  UNIQUE (group_id, user_id)
);

-- Per-user UI preferences (column visibility, theme, etc.)
-- preferences column stores JSON blob
CREATE TABLE IF NOT EXISTS user_preferences (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL UNIQUE REFERENCES users (id),
  preferences TEXT             DEFAULT '{}',
  updated_at  TEXT
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================

-- In-app notifications
CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  type             TEXT             DEFAULT 'task',   -- 'task' | 'alert' | 'info'
  title            TEXT    NOT NULL,
  message          TEXT             DEFAULT '',
  target_user_id   INTEGER          DEFAULT NULL,
  target_group_id  INTEGER          DEFAULT NULL,
  source_user      TEXT             DEFAULT '',
  is_read          INTEGER          DEFAULT 0,   -- legacy single-user flag
  read_at          TEXT             DEFAULT NULL,
  read_by          TEXT             DEFAULT '[]',  -- JSON array of user IDs
  trigger_id       INTEGER          DEFAULT NULL REFERENCES notification_triggers (id),
  created_at       TEXT    NOT NULL
);

-- Rules that auto-create notifications when data changes
CREATE TABLE IF NOT EXISTS notification_triggers (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT    NOT NULL,
  source_table         TEXT    NOT NULL,   -- watched table
  trigger_field        TEXT    NOT NULL,   -- watched column
  trigger_label        TEXT             DEFAULT '',
  message_template     TEXT             DEFAULT '',
  notify_target_type   TEXT             DEFAULT 'field_value',  -- 'field_value' | 'group' | 'broadcast'
  notify_target_value  TEXT             DEFAULT '',
  notification_type    TEXT             DEFAULT 'task',
  is_active            INTEGER          DEFAULT 1,
  sort_order           INTEGER          DEFAULT 0,
  created_at           TEXT,
  updated_at           TEXT
);

-- =============================================================================
-- TEMPLATES
-- =============================================================================

-- Binary file storage for PIW, SOW, and holiday calendar templates
CREATE TABLE IF NOT EXISTS templates (
  id           TEXT    PRIMARY KEY,              -- UUID
  type         TEXT    NOT NULL UNIQUE,          -- 'piw' | 'sow' | 'holiday_calendar'
  file_name    TEXT    NOT NULL,
  file_size    INTEGER          DEFAULT 0,       -- bytes
  file_data    BLOB,                             -- raw binary content
  mime_type    TEXT             DEFAULT '',
  uploaded_by  TEXT             DEFAULT 'system',
  uploaded_at  TEXT    NOT NULL,
  description  TEXT             DEFAULT '',
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_templates_type
  ON templates (type);

-- =============================================================================
-- AUDIT LOG
-- =============================================================================

-- Immutable audit trail for all data changes across all modules
-- module values: 'ra_process' | 'resources' | 'client_requests' | etc.
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  module       TEXT    NOT NULL,       -- source table name
  record_id    INTEGER NOT NULL,       -- PK of the changed record
  record_name  TEXT             DEFAULT '',   -- human-readable record identifier
  field        TEXT    NOT NULL,       -- field that changed (or event name)
  old_value    TEXT             DEFAULT '',
  new_value    TEXT             DEFAULT '',
  changed_by   TEXT             DEFAULT '',  -- username
  changed_at   TEXT    NOT NULL              -- ISO 8601 timestamp
);

CREATE INDEX IF NOT EXISTS idx_audit_log_module_record
  ON audit_log (module, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
  ON audit_log (changed_at);

-- =============================================================================
-- END OF DDL
-- =============================================================================
