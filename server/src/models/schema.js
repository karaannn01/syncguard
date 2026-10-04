const db = require('../config/db');

async function createSchema() {
  const isPostgres = db.getDbType() === 'postgres';

  const schemaSQL = isPostgres ? `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      email VARCHAR(128) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'TECHNICIAN',
      full_name VARCHAR(128) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS devices (
      device_id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) REFERENCES users(id),
      device_name VARCHAR(128) NOT NULL,
      last_sync_at TIMESTAMP WITH TIME ZONE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(64) PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      machine_name VARCHAR(128) NOT NULL,
      location VARCHAR(128) NOT NULL,
      priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      quantity INTEGER DEFAULT 0,
      notes TEXT,
      assigned_to VARCHAR(64) REFERENCES users(id),
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id VARCHAR(64) PRIMARY KEY,
      task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE CASCADE,
      item_text VARCHAR(255) NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      order_index INTEGER DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS task_updates (
      id VARCHAR(64) PRIMARY KEY,
      task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      changed_fields TEXT,
      snapshot TEXT,
      updated_by VARCHAR(64),
      device_id VARCHAR(64),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sync_operations (
      operation_id VARCHAR(64) PRIMARY KEY,
      device_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64),
      entity_type VARCHAR(32) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      operation_type VARCHAR(32) NOT NULL,
      base_version INTEGER NOT NULL,
      changed_fields TEXT,
      payload TEXT,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP WITH TIME ZONE,
      processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      retry_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id VARCHAR(64) PRIMARY KEY,
      operation_id VARCHAR(64) REFERENCES sync_operations(operation_id),
      entity_type VARCHAR(32) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      base_version INTEGER NOT NULL,
      server_version INTEGER NOT NULL,
      server_values TEXT NOT NULL,
      local_values TEXT NOT NULL,
      conflicting_fields TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'UNRESOLVED',
      resolution_type VARCHAR(32),
      resolved_values TEXT,
      resolved_by VARCHAR(64),
      resolved_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64),
      user_name VARCHAR(128),
      device_id VARCHAR(64),
      action VARCHAR(64) NOT NULL,
      entity_type VARCHAR(32) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      details TEXT,
      timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_entity ON sync_operations(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
  ` : `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'TECHNICIAN',
      full_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      user_id TEXT,
      device_name TEXT NOT NULL,
      last_sync_at TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      machine_name TEXT NOT NULL,
      location TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'PENDING',
      quantity INTEGER DEFAULT 0,
      notes TEXT,
      assigned_to TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now')),
      updated_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assigned_to) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      item_text TEXT NOT NULL,
      is_completed INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_updates (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      changed_fields TEXT,
      snapshot TEXT,
      updated_by TEXT,
      device_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_operations (
      operation_id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      user_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation_type TEXT NOT NULL,
      base_version INTEGER NOT NULL,
      changed_fields TEXT,
      payload TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TEXT,
      processed_at TEXT DEFAULT (datetime('now')),
      retry_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      operation_id TEXT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      base_version INTEGER NOT NULL,
      server_version INTEGER NOT NULL,
      server_values TEXT NOT NULL,
      local_values TEXT NOT NULL,
      conflicting_fields TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'UNRESOLVED',
      resolution_type TEXT,
      resolved_values TEXT,
      resolved_by TEXT,
      resolved_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (operation_id) REFERENCES sync_operations(operation_id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      device_id TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      details TEXT,
      timestamp TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_sync_operations_entity ON sync_operations(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);
  `;

  if (isPostgres) {
    await db.query(schemaSQL);
  } else {
    // SQLite can execute multiple statements via exec
    db.getSqliteDb().exec(schemaSQL);
  }

  console.log('Database schema initialized successfully.');
}

module.exports = {
  createSchema
};
