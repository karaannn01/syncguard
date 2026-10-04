import db from '../db/dexieDb';
import { api, getStoredDevice, getStoredUser } from './api';

class SyncManager {
  constructor() {
    this.status = 'IDLE'; // 'IDLE' | 'PENDING' | 'SYNCING' | 'SUCCESS' | 'CONFLICT' | 'FAILED'
    this.lastSyncTime = localStorage.getItem('syncguard_last_sync') || null;
    this.listeners = new Set();
    this.isSyncing = false;
    this.lastError = null;

    // Listen to browser network changes
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[SyncManager] Browser reported ONLINE. Initiating sync...');
        this.syncNow();
      });
      window.addEventListener('offline', () => {
        console.log('[SyncManager] Browser reported OFFLINE.');
        this.notifyState();
      });
      // Custom event for simulated network switch
      window.addEventListener('syncguard-network-change', () => {
        this.syncNow();
      });
    }
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  notifyState() {
    const state = this.getState();
    this.listeners.forEach(fn => fn(state));
  }

  getState() {
    return {
      status: this.status,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError
    };
  }

  isOnline() {
    const isSimulatedOffline = localStorage.getItem('syncguard_simulated_offline') === 'true';
    return !isSimulatedOffline && (typeof navigator !== 'undefined' ? navigator.onLine : true);
  }

  /**
   * Main sync trigger
   */
  async syncNow() {
    if (!this.isOnline()) {
      console.log('[SyncManager] Cannot sync: Device is currently OFFLINE.');
      return { success: false, reason: 'offline' };
    }

    if (this.isSyncing) {
      console.log('[SyncManager] Sync already in progress, skipping duplicate call.');
      return { success: false, reason: 'in-progress' };
    }

    this.isSyncing = true;
    this.status = 'SYNCING';
    this.lastError = null;
    this.notifyState();

    try {
      // 1. Fetch pending outbox operations (status !== 'SUCCESS')
      const pendingOps = await db.outbox
        .where('status')
        .notEqual('SUCCESS')
        .sortBy('createdAt');

      console.log(`[SyncManager] Found ${pendingOps.length} pending operations in local outbox.`);

      let conflictFound = false;

      // 2. If there are operations in the outbox, push to backend
      if (pendingOps.length > 0) {
        // Mark all as SYNCING in local Dexie
        for (const op of pendingOps) {
          await db.outbox.update(op.operationId, { status: 'SYNCING' });
        }

        const deviceId = getStoredDevice();
        const payload = pendingOps.map(op => ({
          operationId: op.operationId,
          deviceId: op.deviceId || deviceId,
          userId: op.userId,
          entityType: op.entityType,
          entityId: op.entityId,
          operationType: op.operationType,
          baseVersion: op.baseVersion,
          changedFields: op.changedFields,
          payload: op.payload,
          createdAt: op.createdAt
        }));

        const response = await api.syncBatch(payload, deviceId);
        console.log('[SyncManager] Batch sync response received:', response);

        // Process individual results
        for (const res of response.results) {
          if (res.status === 'SUCCESS') {
            // Remove from outbox or mark SUCCESS
            await db.outbox.delete(res.operationId);

            // Update task in Dexie if entity returned
            if (res.entity && res.entity.id) {
              await db.tasks.put({
                ...res.entity,
                _syncStatus: 'SYNCED'
              });
            } else if (res.entityId) {
              const currentLocal = await db.tasks.get(res.entityId);
              if (currentLocal) {
                await db.tasks.update(res.entityId, {
                  version: res.version || currentLocal.version,
                  _syncStatus: 'SYNCED'
                });
              }
            }
          } else if (res.status === 'CONFLICT') {
            conflictFound = true;
            await db.outbox.update(res.operationId, {
              status: 'CONFLICT',
              conflictId: res.conflictId,
              error: res.reason
            });

            // Store conflict in Dexie conflicts store
            await db.conflicts.put({
              id: res.conflictId,
              operation_id: res.operationId,
              entity_type: 'task',
              entityId: res.entityId,
              base_version: res.baseVersion,
              server_version: res.serverVersion,
              server_values: res.serverValues,
              local_values: res.localValues,
              conflicting_fields: res.conflictingFields,
              status: 'UNRESOLVED',
              created_at: new Date().toISOString()
            });

            // Mark local task as CONFLICT
            await db.tasks.update(res.entityId, { _syncStatus: 'CONFLICT' });
          } else {
            // Failed
            const existing = await db.outbox.get(res.operationId);
            await db.outbox.update(res.operationId, {
              status: 'FAILED',
              retryCount: (existing?.retryCount || 0) + 1,
              error: res.error || 'Server rejected mutation'
            });
          }
        }
      }

      // 3. Pull latest server state to populate local cache
      await this.pullServerState();

      // 4. Update sync metadata
      const now = new Date().toISOString();
      this.lastSyncTime = now;
      localStorage.setItem('syncguard_last_sync', now);
      await db.sync_metadata.put({ key: 'last_successful_sync', value: now, updatedAt: now });

      this.status = conflictFound ? 'CONFLICT' : 'SUCCESS';
      this.isSyncing = false;
      this.notifyState();

      return { success: true, conflictFound };
    } catch (err) {
      console.error('[SyncManager] Sync failed:', err);
      this.status = 'FAILED';
      this.lastError = err.message || 'Synchronization failed';
      this.isSyncing = false;
      this.notifyState();
      return { success: false, error: err };
    }
  }

  /**
   * Pull server tasks and cache them into IndexedDB
   */
  async pullServerState() {
    try {
      const serverTasksRes = await api.getTasks();
      const serverTasks = serverTasksRes.tasks || [];

      // Check which tasks currently have pending outbox operations so we don't overwrite offline uncommitted changes
      const pendingOps = await db.outbox
        .where('status')
        .notEqual('SUCCESS')
        .toArray();

      const pendingEntityIds = new Set(pendingOps.map(op => op.entityId));

      for (const st of serverTasks) {
        if (!pendingEntityIds.has(st.id)) {
          await db.tasks.put({
            ...st,
            _syncStatus: 'SYNCED'
          });

          // Store checklists
          if (Array.isArray(st.checklists)) {
            for (const chk of st.checklists) {
              await db.checklists.put({
                ...chk,
                _syncStatus: 'SYNCED'
              });
            }
          }
        }
      }

      // Pull server conflicts
      const conflictsRes = await api.getConflicts();
      if (Array.isArray(conflictsRes.conflicts)) {
        for (const c of conflictsRes.conflicts) {
          await db.conflicts.put(c);
        }
      }
    } catch (err) {
      console.warn('[SyncManager] Failed pulling server state:', err.message);
    }
  }
}

export const syncManager = new SyncManager();
export default syncManager;
