const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;
let dbType = 'sqlite';

const DATABASE_URL = process.env.DATABASE_URL;

function initDatabase() {
  if (DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      pgPool = new Pool({
        connectionString: DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      dbType = 'postgres';
      console.log('Using PostgreSQL database engine');
      return;
    } catch (err) {
      console.warn('PostgreSQL initialization failed, falling back to embedded SQLite:', err.message);
    }
  }

  // Embedded SQLite fallback (zero configuration required)
  const Database = require('better-sqlite3');
  const dbDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'syncguard.sqlite');
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('journal_mode = WAL');
  sqliteDb.pragma('foreign_keys = ON');
  dbType = 'sqlite';
  console.log(`Using embedded SQLite database at: ${dbPath}`);
}

initDatabase();

/**
 * Universal query runner
 * Supports PostgreSQL $1, $2 parameter placeholders and returns { rows, rowCount }
 */
async function query(text, params = []) {
  if (dbType === 'postgres') {
    const res = await pgPool.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount };
  }

  // SQLite adapter
  let sqliteQuery = text;
  // Replace $1, $2, ... with ? for SQLite
  sqliteQuery = sqliteQuery.replace(/\$(\d+)/g, '?');

  // Handle differences in boolean / JSON types
  const normalizedParams = params.map(val => {
    if (typeof val === 'boolean') {
      return val ? 1 : 0;
    }
    if (val !== null && typeof val === 'object') {
      return JSON.stringify(val);
    }
    return val;
  });

  const trimmed = sqliteQuery.trim();
  const isSelect = trimmed.toUpperCase().startsWith('SELECT') || trimmed.toUpperCase().startsWith('WITH');

  try {
    if (isSelect) {
      const stmt = sqliteDb.prepare(sqliteQuery);
      const rows = stmt.all(...normalizedParams);
      return { rows, rowCount: rows.length };
    } else {
      const stmt = sqliteDb.prepare(sqliteQuery);
      const info = stmt.run(...normalizedParams);
      // For insert / update / delete with RETURNING clause simulation
      if (sqliteQuery.toUpperCase().includes('RETURNING')) {
        // If query has RETURNING, better-sqlite3 doesn't automatically return rows on .run() unless using .all()
        try {
          const rows = stmt.all(...normalizedParams);
          return { rows, rowCount: rows.length };
        } catch {
          return { rows: [{ id: info.lastInsertRowid }], rowCount: info.changes };
        }
      }
      return { rows: [], rowCount: info.changes };
    }
  } catch (err) {
    console.error('Database query error:', err.message, '\nQuery:', sqliteQuery, '\nParams:', normalizedParams);
    throw err;
  }
}

/**
 * Run a transaction
 */
async function transaction(callback) {
  if (dbType === 'postgres') {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  // SQLite transaction
  const executeTx = sqliteDb.transaction(() => {
    return callback({ query });
  });
  return executeTx();
}

module.exports = {
  query,
  transaction,
  getDbType: () => dbType,
  getSqliteDb: () => sqliteDb,
  getPgPool: () => pgPool
};
