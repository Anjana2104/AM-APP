# Database Design

**Engine:** SQLite (via `sql.js` in-browser adapter + better-sqlite3 on server)  
**Location:** `server/db/` — `connection.js` manages the singleton; `migrate.js` has legacy DDL; `server/index.js` runs full migrations on startup.

---

## Tables

### `finance_projects`
Tracks billable projects for revenue management.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| sno | INTEGER | Display order |
| project | TEXT | Project name |
| company | TEXT | Client company |
| code | TEXT UNIQUE | Project code (enforced by unique index) |
| space | TEXT | Business space / division |
| owner | TEXT | Project owner name |
| status | TEXT | `Active` \| `Inactive` |
| active | INTEGER | 1=active, 0=inactive (derived from status) |
| comments | TEXT | Free-text notes |
| created_at / updated_at | TEXT | ISO timestamps |

---

### `finance_revenue`
Monthly revenue entries per project.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| project_id | INTEGER FK → finance_projects.id | |
| month | TEXT | Format: `YYYY-MM` |
| amount | REAL | Revenue amount |
| milestone_type | TEXT | `booked` \| `invoiced` |

**Constraint:** `UNIQUE(project_id, month)`

---

### `invoice_projects`
Tracks projects for invoice management (separate from finance).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| sno | INTEGER | |
| project | TEXT | |
| company | TEXT | |
| code | TEXT UNIQUE | |
| status | TEXT | `Active` \| `Inactive` |
| active | INTEGER | |
| comments | TEXT | |
| created_at / updated_at | TEXT | |

---

### `invoice_amounts`
Monthly invoice amounts per invoice project.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| project_id | INTEGER FK → invoice_projects.id | |
| month | TEXT | `YYYY-MM` |
| amount | REAL | |

**Constraint:** `UNIQUE(project_id, month)`

---

### `client_requests`
Beeline / client resource requests (staffing requests).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| sno | INTEGER | |
| beeline_id | TEXT UNIQUE | External Beeline system ID |
| description | TEXT | Request description |
| raised_by | TEXT | Requestor name |
| processing_status | TEXT | e.g. `In Progress`, `Closed` |
| overall_status | TEXT | e.g. `Open`, `Fulfilled` |
| account_anchor | TEXT | Account manager |
| date_raised | TEXT | Date string |
| request_type | TEXT | e.g. `New`, `Replacement` |
| updated_on | TEXT | |
| is_active | INTEGER | Soft-delete flag |
| created_at / updated_at | TEXT | |

---

### `request_comments`
Comments/notes attached to client requests.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| request_id | INTEGER FK → client_requests.id | |
| author | TEXT | |
| tag | TEXT | Category label |
| body | TEXT | Comment text |
| created_at | TEXT | |

---

### `resources`
RA resource / employee records.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| sno | INTEGER | |
| ra_id | TEXT UNIQUE | Internal RA employee ID |
| emp_name | TEXT | Full name |
| email_id | TEXT | Work email |
| piw_role | TEXT | Role from PIW file |
| role_or_domain | TEXT | **Comma-separated roles/domains** (e.g., "Backend, DevOps, Cloud") — supports multiple values like skills. Append new domains during bulk uploads via merge operation. |
| previous_workex | TEXT | Prior experience |
| doj | TEXT | Date of joining (`YYYY-MM-DD`) |
| total_workex | TEXT | Total work experience |
| engagement | TEXT | Current engagement / project name |
| skills | TEXT | Comma-separated skill list |
| allocation_status | TEXT | `Joined` \| `Available` \| `On Bench` \| `Resigned` |
| skill_type | TEXT | `Commodity` \| `Specialized` |
| beeline_id | TEXT | Linked Beeline request ID |
| engagement_start_date | TEXT | Engagement start (`YYYY-MM-DD`) |
| engagement_end_date | TEXT | Engagement end (`YYYY-MM-DD`) |
| process_id | INTEGER FK → ra_process.id | Linked SOW/process |
| created_at / updated_at | TEXT | |

---

### `ra_process`
Internal process / SOW records.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| sno | INTEGER | |
| sow | TEXT UNIQUE | SOW name (human-readable unique key) |
| process_id | TEXT | Human-readable ID e.g. `P1`, `P2` |
| start_date | TEXT | SOW start date |
| signed_sow | TEXT | Signed SOW document reference |
| piw | TEXT UNIQUE (non-empty) | Linked PIW filename |
| active | TEXT | Active status |
| salesforce_id | TEXT | Salesforce opportunity ID |
| proms_id | TEXT | PROMS system ID |
| budget | TEXT | Budget information |
| open_air_code | TEXT | OpenAir project code |
| eprev | TEXT | ePrev stage |
| comments | TEXT | |
| account_anchor | TEXT | Account manager |
| step_completed_at | TEXT (JSON) | Per-step completion timestamps map (UTC ISO), used for process-progress analytics |
| created_at / updated_at | TEXT | |

---

### `resource_insights`
Log entries for the Resource Intelligence feature (interactions, risks, career notes, plans).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| resource_id | INTEGER FK → resources.id | |
| section | TEXT | `interaction` \| `escalation` \| `career_preference` \| `plan` \| `general` |
| title | TEXT | Short title |
| body | TEXT | Full entry text |
| tag | TEXT | Optional tag/label |
| status | TEXT | `open` \| `closed` |
| priority | TEXT | `low` \| `medium` \| `high` |
| target_date | TEXT | Optional target/due date |
| author | TEXT | Who created this entry |
| created_at / updated_at | TEXT | |

---

### `resource_comments`
Free-form comments on resources (separate from insights entries).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| resource_id | INTEGER FK → resources.id | |
| author | TEXT | |
| tag | TEXT | Category label |
| body | TEXT | |
| created_at | TEXT | |

---

### `audit_log`
Immutable audit trail for all data changes across modules.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK AUTOINCREMENT | |
| module | TEXT | Table name: `ra_process`, `resources`, `client_requests`, etc. |
| record_id | INTEGER | FK to the record in the module table |
| record_name | TEXT | Human-readable record name (e.g. SOW name) |
| field | TEXT | Field that changed (or event name like `Resource Linked`) |
| old_value | TEXT | Value before change |
| new_value | TEXT | Value after change |
| changed_by | TEXT | Username |
| changed_at | TEXT | ISO timestamp |

---

### `app_config_types`
Configuration type definitions (dropdown categories).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| type_id | TEXT UNIQUE | e.g. `allocation_status`, `request_type` |
| name | TEXT | Display name |
| description | TEXT | |
| built_in | INTEGER | 1=system-defined, cannot delete |
| linked_to | TEXT | JSON array of pages that use this config |
| sort_order | INTEGER | |

---

### `app_config_items`
Values within each config type (dropdown options).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| type_id | TEXT FK → app_config_types.type_id | |
| item_value | TEXT | Stored value |
| label | TEXT | Display label |
| color | TEXT | Ant Design color tag |
| sort_order | INTEGER | |

**Constraint:** `UNIQUE(type_id, item_value)`

---

### `app_values`
Generic key-value store for app-level settings.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| key | TEXT UNIQUE | Setting key |
| value | TEXT | Setting value |
| description | TEXT | |

---

### `team_hierarchy_entries`
Stakeholder network records for Client and Internal Team structures.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | Stable stakeholder ID |
| team_type | TEXT | `client` \| `ra` |
| name | TEXT | Stakeholder name |
| title | TEXT | Role/title |
| department | TEXT | Department/group |
| reporting_to | TEXT | Parent stakeholder ID (nullable) |
| email | TEXT | Email |
| phone | TEXT | Phone number |
| responsibility | TEXT | Notes/responsibility |
| sort_order | INTEGER | Deterministic display/order index |
| created_at / updated_at | TEXT | ISO timestamps |

**Index:** `idx_team_hierarchy_team_type_sort(team_type, sort_order)`

---

### `roles`
User access roles with page-level permissions.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT UNIQUE | e.g. `Admin`, `Manager`, `Viewer` |
| description | TEXT | |
| permissions | TEXT | JSON: `{ "page_id": { view, edit, delete } }` |

---

### `users`
Application users.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| username | TEXT UNIQUE | Login username |
| password_hash | TEXT | SHA-256 hash with static salt |
| password_plain | TEXT | Plain-text copy for admin visibility only (not shown in UI) |
| display_name | TEXT | |
| role_id | INTEGER FK → roles.id | |
| active | INTEGER | 1=active |

---

### `user_groups`
Named groups for notification targeting.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT | Group name |
| description | TEXT | |
| user_type_config_id | TEXT | Linked config type — retained in DB for compatibility; not exposed in UI |

---

### `user_group_members`
Members of user groups.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| group_id | INTEGER FK → user_groups.id | |
| user_id | INTEGER FK → users.id | |

**Constraint:** `UNIQUE(group_id, user_id)`

---

### `notifications`
In-app notifications.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| type | TEXT | `task` \| `alert` \| `info` |
| title | TEXT | |
| message | TEXT | |
| target_user_id | INTEGER | Specific user target |
| target_group_id | INTEGER | Group target |
| source_user | TEXT | Who triggered it |
| is_read | INTEGER | Legacy single-user read flag |
| read_by | TEXT | JSON array of user IDs who read it |
| trigger_id | INTEGER FK → notification_triggers.id | |
| created_at | TEXT | |

---

### `notification_triggers`
Rules that auto-create notifications when data changes.

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT | Rule name |
| source_table | TEXT | Watched table |
| trigger_field | TEXT | Watched column |
| trigger_label | TEXT | Human label for the field |
| message_template | TEXT | Notification message template |
| notify_target_type | TEXT | `field_value` \| `group` \| `broadcast` |
| notify_target_value | TEXT | Target value/user/group |
| notification_type | TEXT | `task` \| `alert` |
| is_active | INTEGER | |
| sort_order | INTEGER | |

---

### `user_preferences`
Per-user UI preferences (column visibility, theme, etc.).

| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| user_id | INTEGER UNIQUE FK → users.id | |
| preferences | TEXT | JSON blob |
| updated_at | TEXT | |

---

### `templates`
Binary file storage for PIW, SOW, and holiday calendar templates.

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | UUID |
| type | TEXT UNIQUE | `piw` \| `sow` \| `holiday_calendar` |
| file_name | TEXT | Original filename |
| file_size | INTEGER | Bytes |
| file_data | BLOB | Binary file content |
| mime_type | TEXT | |
| uploaded_by | TEXT | |
| description | TEXT | |
| uploaded_at / created_at / updated_at | TEXT | |

---

## Key Relationships

```
resources ──── process_id ────► ra_process
resources ──── beeline_id ────► client_requests (logical, no FK constraint)
resource_insights ── resource_id ──► resources
resource_comments ── resource_id ──► resources
request_comments ── request_id ──► client_requests
audit_log ── (module + record_id) ──► any table
user_group_members ── group_id ──► user_groups
user_group_members ── user_id ──► users
users ── role_id ──► roles
notifications ── trigger_id ──► notification_triggers
user_preferences ── user_id ──► users
finance_revenue ── project_id ──► finance_projects
invoice_amounts ── project_id ──► invoice_projects
team_hierarchy_entries ── reporting_to ──► team_hierarchy_entries.id (logical self-link)
```
