/**
 * db/connection.js
 *
 * Returns a singleton DB adapter.  Call await getDb() to get the adapter.
 *
 * SQLite  -- uses sql.js (pure-JS/WASM, no native compilation needed)
 * Postgres -- uses pg (npm install pg in server/)
 *
 * Adapter interface:
 *   db.all(sql, params)  => rows[]
 *   db.get(sql, params)  => row | null
 *   db.run(sql, params)  => void
 *   db.lastId()          => last inserted rowid
 *   db.close()           => void
 */

const config = require('../config/database');
let _adapter = null;

async function getDb() {
  if (_adapter) return _adapter;

  if (config.client === 'sqlite3') {
    const SqliteAdapter = require('./sqliteAdapter');
    _adapter = new SqliteAdapter(config.filename);
    await _adapter.connect();
  } else if (config.client === 'pg') {
    const PgAdapter = require('./pgAdapter');
    _adapter = new PgAdapter(config);
    await _adapter.connect();
  } else {
    throw new Error('Unsupported DB client: ' + config.client);
  }

  return _adapter;
}

function resetDb() { _adapter = null; }

module.exports = { getDb, resetDb };