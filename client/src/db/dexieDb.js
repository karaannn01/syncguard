import Dexie from 'dexie';

export const db = new Dexie('SyncGuardOfflineDB');

db.version(1).stores({
  tasks: 'id, title, status, priority, machine_name, location, assigned_to, version, updated_at, _syncStatus',
  checklists: 'id, task_id, is_completed, version, _syncStatus',
  outbox: 'operationId, deviceId, userId, entityType, entityId, operationType, baseVersion, status, createdAt',
  conflicts: 'id, operation_id, entity_type, entity_id, base_version, server_version, status, created_at',
  sync_metadata: 'key, updatedAt',
  users: 'id, username, role',
  activity_logs: 'id, timestamp, entity_type, action'
});

export default db;
