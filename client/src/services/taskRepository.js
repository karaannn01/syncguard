import db from '../db/dexieDb';
import syncManager from './syncManager';
import { getStoredDevice, getStoredUser } from './api';

// Simple UUID generator for browser
function generateId(prefix = 'tsk') {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}-${Date.now().toString(36)}`;
}

class TaskRepository {
  /**
   * Get all tasks (combines IndexedDB cache with optional network sync)
   */
  async getTasks(filters = {}) {
    let collection = db.tasks.toCollection();

    let allTasks = await collection.toArray();

    // If cache is completely empty and device is online, trigger pull
    if (allTasks.length === 0 && syncManager.isOnline()) {
      await syncManager.pullServerState();
      allTasks = await db.tasks.toArray();
    }

    // Attach checklists to tasks
    const allChecklists = await db.checklists.toArray();
    const checklistsByTask = {};
    for (const chk of allChecklists) {
      if (!checklistsByTask[chk.task_id]) checklistsByTask[chk.task_id] = [];
      checklistsByTask[chk.task_id].push(chk);
    }

    let result = allTasks.map(t => ({
      ...t,
      checklists: checklistsByTask[t.id] || []
    }));

    // Client-side filtering
    if (filters.status && filters.status !== 'ALL') {
      result = result.filter(t => t.status === filters.status);
    }
    if (filters.priority && filters.priority !== 'ALL') {
      result = result.filter(t => t.priority === filters.priority);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.machine_name?.toLowerCase().includes(q) ||
        t.location?.toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
  }

  /**
   * Get single task with checklist and active conflicts
   */
  async getTaskById(taskId) {
    let task = await db.tasks.get(taskId);
    if (!task && syncManager.isOnline()) {
      await syncManager.pullServerState();
      task = await db.tasks.get(taskId);
    }

    if (!task) return null;

    const checklists = await db.checklists.where('task_id').equals(taskId).sortBy('order_index');
    const conflict = await db.conflicts.where('entity_id').equals(taskId).first();
    const pendingOutbox = await db.outbox.where('entityId').equals(taskId).toArray();

    return {
      ...task,
      checklists,
      activeConflict: conflict && conflict.status === 'UNRESOLVED' ? conflict : null,
      pendingOutbox
    };
  }

  /**
   * Create task (Offline-First: updates Dexie immediately + enqueues to outbox)
   */
  async createTask(taskData) {
    const taskId = generateId('tsk');
    const now = new Date().toISOString();
    const deviceId = getStoredDevice();
    const user = getStoredUser();

    const newTask = {
      id: taskId,
      title: taskData.title,
      description: taskData.description || '',
      machine_name: taskData.machine_name,
      location: taskData.location,
      priority: taskData.priority || 'MEDIUM',
      status: taskData.status || 'PENDING',
      quantity: Number(taskData.quantity || 0),
      notes: taskData.notes || '',
      assigned_to: taskData.assigned_to || user.id,
      version: 1,
      updated_at: now,
      updated_by: user.id,
      created_at: now,
      _syncStatus: 'PENDING'
    };

    // 1. Write to Dexie tasks store
    await db.tasks.put(newTask);

    // 2. Write checklists if any
    if (Array.isArray(taskData.checklists)) {
      for (let i = 0; i < taskData.checklists.length; i++) {
        const itemText = typeof taskData.checklists[i] === 'string' ? taskData.checklists[i] : taskData.checklists[i].item_text;
        const chkId = generateId('chk');
        await db.checklists.put({
          id: chkId,
          task_id: taskId,
          item_text: itemText,
          is_completed: false,
          order_index: i + 1,
          version: 1,
          _syncStatus: 'PENDING'
        });
      }
    }

    // 3. Create Outbox Operation
    const operation = {
      operationId: generateId('op'),
      deviceId,
      userId: user.id,
      entityType: 'task',
      entityId: taskId,
      operationType: 'create',
      baseVersion: 0,
      changedFields: Object.keys(newTask),
      payload: newTask,
      status: 'PENDING',
      createdAt: now,
      retryCount: 0
    };

    await db.outbox.put(operation);

    // 4. Log local activity
    await db.activity_logs.put({
      id: generateId('act'),
      timestamp: now,
      entity_type: 'task',
      entity_id: taskId,
      action: 'TASK_CREATED_OFFLINE',
      user_name: user.fullName || 'Technician',
      device_id: deviceId
    });

    // 5. Trigger background sync if online
    if (syncManager.isOnline()) {
      syncManager.syncNow();
    }

    return newTask;
  }

  /**
   * Update task fields (Offline-First: saves locally, generates outbox operation with baseVersion)
   */
  async updateTask(taskId, changedFieldsObj) {
    const current = await db.tasks.get(taskId);
    if (!current) throw new Error(`Task ${taskId} not found in local store`);

    const now = new Date().toISOString();
    const deviceId = getStoredDevice();
    const user = getStoredUser();
    const changedFieldKeys = Object.keys(changedFieldsObj);

    // Updated local state
    const updated = {
      ...current,
      ...changedFieldsObj,
      updated_at: now,
      updated_by: user.id,
      _syncStatus: 'PENDING'
    };

    // 1. Update local IndexedDB
    await db.tasks.put(updated);

    // 2. Add to outbox with precise baseVersion & changedFields
    const operation = {
      operationId: generateId('op'),
      deviceId,
      userId: user.id,
      entityType: 'task',
      entityId: taskId,
      operationType: 'update',
      baseVersion: current.version,
      changedFields: changedFieldKeys,
      payload: changedFieldsObj,
      status: 'PENDING',
      createdAt: now,
      retryCount: 0
    };

    await db.outbox.put(operation);

    // 3. Log local activity
    await db.activity_logs.put({
      id: generateId('act'),
      timestamp: now,
      entity_type: 'task',
      entity_id: taskId,
      action: 'TASK_UPDATED_LOCAL',
      user_name: user.fullName || 'Technician',
      device_id: deviceId
    });

    // 4. Trigger sync in background if online
    if (syncManager.isOnline()) {
      syncManager.syncNow();
    }

    return updated;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId) {
    const current = await db.tasks.get(taskId);
    const now = new Date().toISOString();
    const deviceId = getStoredDevice();
    const user = getStoredUser();

    // Remove from local IndexedDB
    await db.tasks.delete(taskId);

    // Outbox operation
    const operation = {
      operationId: generateId('op'),
      deviceId,
      userId: user.id,
      entityType: 'task',
      entityId: taskId,
      operationType: 'delete',
      baseVersion: current ? current.version : 0,
      changedFields: [],
      payload: {},
      status: 'PENDING',
      createdAt: now,
      retryCount: 0
    };

    await db.outbox.put(operation);

    if (syncManager.isOnline()) {
      syncManager.syncNow();
    }
  }

  /**
   * Toggle Checklist Item
   */
  async toggleChecklistItem(checklistId) {
    const item = await db.checklists.get(checklistId);
    if (!item) return;

    const newCompleted = !item.is_completed;
    const now = new Date().toISOString();
    const deviceId = getStoredDevice();
    const user = getStoredUser();

    await db.checklists.update(checklistId, {
      is_completed: newCompleted,
      _syncStatus: 'PENDING'
    });

    const operation = {
      operationId: generateId('op'),
      deviceId,
      userId: user.id,
      entityType: 'checklist',
      entityId: checklistId,
      operationType: 'update',
      baseVersion: item.version,
      changedFields: ['is_completed'],
      payload: { is_completed: newCompleted, task_id: item.task_id },
      status: 'PENDING',
      createdAt: now,
      retryCount: 0
    };

    await db.outbox.put(operation);

    if (syncManager.isOnline()) {
      syncManager.syncNow();
    }
  }

  /**
   * Add item to Checklist
   */
  async addChecklistItem(taskId, itemText) {
    const chkId = generateId('chk');
    const existing = await db.checklists.where('task_id').equals(taskId).toArray();
    const orderIndex = existing.length + 1;
    const now = new Date().toISOString();
    const deviceId = getStoredDevice();
    const user = getStoredUser();

    const newItem = {
      id: chkId,
      task_id: taskId,
      item_text: itemText,
      is_completed: false,
      order_index: orderIndex,
      version: 1,
      _syncStatus: 'PENDING'
    };

    await db.checklists.put(newItem);

    const operation = {
      operationId: generateId('op'),
      deviceId,
      userId: user.id,
      entityType: 'checklist',
      entityId: chkId,
      operationType: 'create',
      baseVersion: 0,
      changedFields: ['item_text', 'is_completed', 'task_id', 'order_index'],
      payload: newItem,
      status: 'PENDING',
      createdAt: now,
      retryCount: 0
    };

    await db.outbox.put(operation);

    if (syncManager.isOnline()) {
      syncManager.syncNow();
    }

    return newItem;
  }
}

export const taskRepository = new TaskRepository();
export default taskRepository;
