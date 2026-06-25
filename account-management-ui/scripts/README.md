# scripts/

Utility scripts for the EAM project.

---

## generate_schema.py

Connects to the live SQLite database and generates three output files in `docs/generated/`:

| Output file | Description |
|---|---|
| `schema_report.md` | Human-readable table/column documentation with row counts |
| `schema_ddl.sql` | `CREATE TABLE` + `CREATE INDEX` statements for all tables |
| `schema.json` | Machine-readable JSON schema (columns, indexes, foreign keys) |

### Requirements

- Python 3.8+ (standard library only — no pip installs needed)
- The server must have been started at least once so the DB file exists at `server/data/eam_finance.db`

### Usage

```bash
# From project root
python scripts/generate_schema.py

# Point to a different DB file
python scripts/generate_schema.py --db path/to/other.db

# Write output to a different folder
python scripts/generate_schema.py --out my/output/dir
```

### Sample output

```
📦 Reading schema from:  .../server/data/eam_finance.db
   Found 22 tables

📝 Writing output files:
  ✓ Markdown report  → docs/generated/schema_report.md
  ✓ DDL SQL          → docs/generated/schema_ddl.sql
  ✓ JSON schema      → docs/generated/schema.json

  Table                               Rows   Cols  Description
  ────────────────────────────────────────────────────────────
  app_config_items                      42      7  Values within each config type
  app_config_types                       8      8  Configuration type definitions
  audit_log                            318      9  Immutable audit trail
  client_requests                       24     13  Beeline / client resource requests
  ...
```
