"""
generate_schema.py
------------------
Reads the live EAM SQLite database and produces:
  1. schema_report.md  — human-readable table/column documentation
  2. schema_ddl.sql    — CREATE TABLE statements for all tables
  3. schema.json       — machine-readable JSON schema

Usage (from project root):
    python scripts/generate_schema.py

Optional: point to a different DB file:
    python scripts/generate_schema.py --db path/to/other.db

Output files are written to:  docs/generated/
"""

import sqlite3
import json
import argparse
import os
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DEFAULT_DB   = os.path.join(PROJECT_ROOT, "server", "data", "eam_finance.db")
OUTPUT_DIR   = os.path.join(PROJECT_ROOT, "docs", "generated")

# Human-readable descriptions for known tables
TABLE_DESCRIPTIONS = {
    "finance_projects":       "Billable projects for revenue management",
    "finance_revenue":        "Monthly revenue entries per finance project",
    "invoice_projects":       "Projects tracked for invoice management",
    "invoice_amounts":        "Monthly invoice amounts per invoice project",
    "client_requests":        "Beeline / client resource requests (staffing)",
    "request_comments":       "Comments and notes on client requests",
    "resources":              "RA resource / employee records",
    "ra_process":             "Internal process / SOW records",
    "resource_insights":      "Log entries for Resource Intelligence (interactions, risks, plans)",
    "resource_comments":      "Free-form comments on resources",
    "audit_log":              "Immutable audit trail for all data changes",
    "app_config_types":       "Configuration type definitions (dropdown categories)",
    "app_config_items":       "Values within each config type (dropdown options)",
    "app_values":             "Generic key-value store for app-level settings",
    "roles":                  "User access roles with page-level permissions",
    "users":                  "Application users",
    "user_groups":            "Named groups for notification targeting",
    "user_group_members":     "Members of user groups",
    "notifications":          "In-app notifications",
    "notification_triggers":  "Rules that auto-create notifications on data changes",
    "user_preferences":       "Per-user UI preferences (column visibility, theme)",
    "templates":              "Binary file storage for PIW, SOW, and holiday calendar templates",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_tables(conn: sqlite3.Connection) -> list:
    """Return all non-system table names, sorted alphabetically."""
    cur = conn.execute(
        "SELECT name FROM sqlite_master "
        "WHERE type='table' AND name NOT LIKE 'sqlite_%' "
        "ORDER BY name"
    )
    return [row[0] for row in cur.fetchall()]


def get_columns(conn: sqlite3.Connection, table: str) -> list:
    """Return column metadata for a table via PRAGMA table_info."""
    cur = conn.execute(f"PRAGMA table_info('{table}')")
    columns = []
    for row in cur.fetchall():
        cid, name, col_type, notnull, default_val, pk = row
        columns.append({
            "cid":      cid,
            "name":     name,
            "type":     col_type or "TEXT",
            "not_null": bool(notnull),
            "default":  default_val,
            "pk":       bool(pk),
        })
    return columns


def get_indexes(conn: sqlite3.Connection, table: str) -> list:
    """Return index metadata for a table (excludes auto primary-key indexes)."""
    cur = conn.execute(f"PRAGMA index_list('{table}')")
    indexes = []
    for row in cur.fetchall():
        seq, name, unique, origin, partial = row
        col_cur = conn.execute(f"PRAGMA index_info('{name}')")
        cols = [r[2] for r in col_cur.fetchall()]
        indexes.append({
            "name":    name,
            "unique":  bool(unique),
            "columns": cols,
            "origin":  origin,  # 'c'=explicit, 'u'=unique constraint, 'pk'=primary key
        })
    return indexes


def get_foreign_keys(conn: sqlite3.Connection, table: str) -> list:
    """Return foreign key metadata for a table."""
    cur = conn.execute(f"PRAGMA foreign_key_list('{table}')")
    fks = []
    for row in cur.fetchall():
        fks.append({
            "from_col":  row[3],
            "to_table":  row[2],
            "to_col":    row[4],
            "on_update": row[5],
            "on_delete": row[6],
        })
    return fks


def get_ddl(conn: sqlite3.Connection, table: str) -> str:
    """Return the original CREATE TABLE SQL stored in sqlite_master."""
    cur = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    row = cur.fetchone()
    return row[0] if row else ""


def get_row_count(conn: sqlite3.Connection, table: str) -> int:
    """Return current row count for a table."""
    try:
        cur = conn.execute(f"SELECT COUNT(*) FROM '{table}'")
        return cur.fetchone()[0]
    except Exception:
        return -1


# ── Schema extraction ─────────────────────────────────────────────────────────

def extract_schema(db_path: str) -> dict:
    """Connect to DB and build the full schema dictionary."""
    conn = sqlite3.connect(db_path)

    tables = get_tables(conn)
    schema = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "db_path":       db_path,
        "table_count":   len(tables),
        "tables":        {},
    }

    for table in tables:
        schema["tables"][table] = {
            "description":   TABLE_DESCRIPTIONS.get(table, ""),
            "row_count":     get_row_count(conn, table),
            "columns":       get_columns(conn, table),
            "indexes":       get_indexes(conn, table),
            "foreign_keys":  get_foreign_keys(conn, table),
            "ddl":           get_ddl(conn, table),
        }

    conn.close()
    return schema


# ── Output writers ────────────────────────────────────────────────────────────

def write_markdown(schema: dict, out_path: str) -> None:
    """Write human-readable schema report as Markdown."""
    lines = [
        "# EAM Database Schema Report",
        "",
        f"**Generated:** {schema['generated_at']}  ",
        f"**Database:** `{os.path.basename(schema['db_path'])}`  ",
        f"**Tables:** {schema['table_count']}",
        "",
        "---",
        "",
        "## Table of Contents",
        "",
    ]

    for table in sorted(schema["tables"]):
        anchor = table.replace("_", "-")
        lines.append(f"- [{table}](#{anchor})")
    lines += ["", "---", ""]

    for table in sorted(schema["tables"]):
        info    = schema["tables"][table]
        columns = info["columns"]
        indexes = [ix for ix in info["indexes"] if ix["origin"] != "pk"]
        fks     = info["foreign_keys"]

        lines += [f"## `{table}`", ""]
        if info["description"]:
            lines += [f"_{info['description']}_", ""]
        lines += [f"**Rows:** {info['row_count']:,}", ""]

        # Column table
        lines += [
            "| # | Column | Type | PK | Not Null | Default |",
            "|---|--------|------|----|----------|---------|",
        ]
        for col in columns:
            pk_mark = "✓" if col["pk"]       else ""
            nn_mark = "✓" if col["not_null"]  else ""
            default = f"`{col['default']}`"   if col["default"] is not None else ""
            lines.append(
                f"| {col['cid']} | `{col['name']}` | `{col['type']}` "
                f"| {pk_mark} | {nn_mark} | {default} |"
            )
        lines.append("")

        if indexes:
            lines += ["**Indexes:**", ""]
            for ix in indexes:
                label    = "UNIQUE " if ix["unique"] else ""
                cols_str = ", ".join(f"`{c}`" for c in ix["columns"])
                lines.append(f"- `{ix['name']}` — {label}({cols_str})")
            lines.append("")

        if fks:
            lines += ["**Foreign Keys:**", ""]
            for fk in fks:
                lines.append(f"- `{fk['from_col']}` → `{fk['to_table']}.{fk['to_col']}`")
            lines.append("")

        lines += ["---", ""]

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  ✓ Markdown report  → {out_path}")


def write_ddl(schema: dict, out_path: str) -> None:
    """Write SQL DDL (CREATE TABLE + CREATE INDEX statements) for all tables."""
    lines = [
        "-- EAM Database Schema DDL",
        f"-- Generated: {schema['generated_at']}",
        f"-- Source:    {schema['db_path']}",
        "",
        "PRAGMA foreign_keys = ON;",
        "",
    ]

    for table in sorted(schema["tables"]):
        info = schema["tables"][table]
        if info["ddl"]:
            if info["description"]:
                lines.append(f"-- {info['description']}")
            lines += [info["ddl"] + ";", ""]

        # Emit explicit CREATE INDEX statements
        for ix in info["indexes"]:
            if ix["origin"] == "c":   # only explicitly created indexes
                unique   = "UNIQUE " if ix["unique"] else ""
                cols_str = ", ".join(ix["columns"])
                lines.append(
                    f"CREATE {unique}INDEX IF NOT EXISTS {ix['name']} "
                    f"ON {table}({cols_str});"
                )
        lines.append("")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  ✓ DDL SQL          → {out_path}")


def write_json(schema: dict, out_path: str) -> None:
    """Write machine-readable JSON schema (DDL excluded — it's in the SQL file)."""
    slim = {
        "generated_at": schema["generated_at"],
        "db_path":       schema["db_path"],
        "table_count":   schema["table_count"],
        "tables": {
            table: {k: v for k, v in info.items() if k != "ddl"}
            for table, info in schema["tables"].items()
        },
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(slim, f, indent=2)
    print(f"  ✓ JSON schema      → {out_path}")


def print_summary(schema: dict) -> None:
    """Print a quick summary table to stdout."""
    print(f"\n  {'Table':<35} {'Rows':>8}  {'Cols':>5}  Description")
    print("  " + "-" * 80)
    for table in sorted(schema["tables"]):
        info    = schema["tables"][table]
        col_cnt = len(info["columns"])
        row_cnt = info["row_count"]
        desc    = (info["description"] or "")[:40]
        print(f"  {table:<35} {row_cnt:>8,}  {col_cnt:>5}  {desc}")
    print()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Generate EAM database schema documentation from the live SQLite DB"
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB,
        help=f"Path to SQLite .db file (default: {DEFAULT_DB})",
    )
    parser.add_argument(
        "--out",
        default=OUTPUT_DIR,
        help=f"Output directory (default: {OUTPUT_DIR})",
    )
    args = parser.parse_args()

    db_path = os.path.abspath(args.db)
    out_dir = os.path.abspath(args.out)

    if not os.path.exists(db_path):
        print(f"\n❌  Database not found: {db_path}")
        print("    Start the server once to create it:  node server/index.js")
        print("    Then re-run this script.\n")
        raise SystemExit(1)

    os.makedirs(out_dir, exist_ok=True)

    print(f"\n📦 Reading schema from:  {db_path}")
    schema = extract_schema(db_path)
    print(f"   Found {schema['table_count']} tables\n")

    print("📝 Writing output files:")
    write_markdown(schema, os.path.join(out_dir, "schema_report.md"))
    write_ddl(     schema, os.path.join(out_dir, "schema_ddl.sql"))
    write_json(    schema, os.path.join(out_dir, "schema.json"))

    print_summary(schema)
    print(f"✅  Done — output in: {out_dir}\n")


if __name__ == "__main__":
    main()
