/**
 * db/sqliteAdapter.js
 *
 * SQLite adapter built on sql.js (pure JS/WASM — no native build tools needed).
 * The database is loaded from / saved to a file on disk after every mutation.
 *
 * When migrating to PostgreSQL: update config/database.js to set client = "pg"
 * and the pg adapter will be used instead (same interface).
 */

const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

class SqliteAdapter {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this._lastId = null;
    this._inTransaction = false;
  }

  async connect() {
    const SQL = await initSqlJs();
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    // Enable WAL-like behaviour (ignored by sql.js but good habit)
    this.db.run("PRAGMA journal_mode = MEMORY");
  }

  /** Persist in-memory DB back to file — skipped during open transactions */
  _save() {
    if (this._inTransaction) return;
    const data = this.db.export();
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /** Execute a mutating statement (INSERT / UPDATE / DELETE / DDL) */
  run(sql, params = []) {
    this.db.run(sql, params);
    // Capture last inserted row id
    const res = this.db.exec("SELECT last_insert_rowid() as id");
    this._lastId = res[0] ? res[0].values[0][0] : null;
    this._save();
  }

  /**
   * Run multiple statements atomically in a single transaction.
   * callback receives `runStmt(sql, params)` — does NOT auto-save.
   * Only saves once after COMMIT. ROLLBACK is attempted on error (best-effort).
   */
  runInTransaction(callback) {
    if (this._inTransaction) {
      throw new Error("Nested transactions are not supported");
    }
    this._inTransaction = true;
    this.db.run("BEGIN");
    try {
      const runStmt = (sql, params = []) => {
        this.db.run(sql, params);
        const res = this.db.exec("SELECT last_insert_rowid() as id");
        this._lastId = res[0] ? res[0].values[0][0] : null;
      };
      callback(runStmt);
      this.db.run("COMMIT");
      this._inTransaction = false;
      this._save();
    } catch (err) {
      this._inTransaction = false;
      try { this.db.run("ROLLBACK"); } catch (_) { /* already rolled back or never opened */ }
      throw err;
    }
  }

  /** Return all matching rows as plain objects */
  all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params && params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  /** Return the first matching row or null */
  get(sql, params = []) {
    const rows = this.all(sql, params);
    return rows.length ? rows[0] : null;
  }

  /** Return the rowid of the last INSERT */
  lastId() {
    return this._lastId;
  }

  close() {
    if (this.db) {
      this._save();
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = SqliteAdapter;