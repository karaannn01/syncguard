const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { analyzeOperationConflict } = require('./conflictDetection');

/**
 * Server-side Synchronization Engine
 * Handles batch processing, idempotency, versioning, conflict detection, and audit logging.
 */
class SyncEngine {
  /**
   * Process a batch of mutations submitted by an offline client
   */
  async processBatch({ operations = [], userId, deviceId }) {
    const results = [];
    const stats = {
      total: operations.length,
      succeeded: 0,
      conflicts: 0,
      autoMerged: 0,
      idempotentCached: 0,
      failed: 0
    };

    // Update device last_sync_at
    if (deviceId) {
      const now = new Date().toISOString();
      const existing = await db.query('SELECT device_id FROM devices WHERE device_id = $1', [deviceId]);
      if (existing.rows.length === 0) {
        await db.query(
          'INSERT INTO devices (device_id, user_id, device_name, last_sync_at, is_active) VALUES ($1, $2, $3, $4, $5)',
          [deviceId, userId, `Device ${deviceId.slice(-6)}`, now, 1]
        );
      } else {
        await db.query(
          'UPDATE devices SET last_sync_at = $1, user_id = COALESCE($2, user_id) WHERE device_id = $3',
          [now, userId, deviceId]
        );
      }
    }

    for (const op of operations) {
      try {
        const res = await this.processSingleOperation(op, userId, deviceId);
        results.push(res);

        if (res.isIdempotent) stats.idempotentCached++;
        else if (res.status === 'SUCCESS' && res.autoMerged) stats.autoMerged++;
        else if (res.status === 'SUCCESS') stats.succeeded++;
        else if (res.status === 'CONFLICT') stats.conflicts++;
        else stats.failed++;
      } catch (err) {
        console.error(`Error processing operation ${op.operationId}:`, err);
        results.push({
          operationId: op.operationId,
          entityId: op.entityId,
          status: 'FAILED',
          error: err.message
        });
        stats.failed++;
      }
    }

    return {
      success: true,
      stats,
      results,
      processedAt: new Date().toISOString()
    };
  }

  /**
   * Process a single synchronizable mutation
   */
  async processSingleOperation(operation, fallbackUserId, fallbackDeviceId) {
    const {
      operationId,
      deviceId = fallbackDeviceId,
      userId = fallbackUserId,
      entityType = 'task',
      entityId,
      operationType,
      baseVersion = 0,
      changedFields = [],
      payload = {},
      createdAt = new Date().toISOString()
    } = operation;

    if (!operationId || !entityId || !operationType) {
      throw new Error('Invalid operation payload: operationId, entityId, and operationType are required');
    }

    // 1. IDEMPOTENCY CHECK
    const existingOp = await db.query(
      'SELECT * FROM sync_operations WHERE operation_id = $1',
      [operationId]
    );

    if (existingOp.rows.length > 0) {
      const prior = existingOp.rows[0];
      // If already recorded, return cached response
      if (prior.status === 'SUCCESS') {
        const currentEntity = await this.getEntity(entityType, entityId);
        return {
          operationId,
          entityId,
          status: 'SUCCESS',
          isIdempotent: true,
          message: 'Operation previously applied (idempotent)',
          currentVersion: currentEntity ? currentEntity.version : baseVersion,
          entity: currentEntity
        };
      } else if (prior.status === 'CONFLICT') {
        const conflictRes = await db.query('SELECT * FROM conflicts WHERE operation_id = $1', [operationId]);
        return {
          operationId,
          entityId,
          status: 'CONFLICT',
          isIdempotent: true,
          message: 'Operation previously registered as conflict',
          conflictId: conflictRes.rows[0]?.id
        };
      }
    }

    // 2. FETCH CURRENT SERVER STATE
    const currentEntity = await this.getEntity(entityType, entityId);

    // 3. FETCH UPDATES SINCE BASE VERSION
    let updatesSinceBase = [];
    if (entityType === 'task' && currentEntity && currentEntity.version > baseVersion) {
      const hist = await db.query(
        'SELECT * FROM task_updates WHERE task_id = $1 AND version > $2 ORDER BY version ASC',
        [entityId, baseVersion]
      );
      updatesSinceBase = hist.rows;
    }

    // 4. ANALYZE CONFLICT
    const analysis = analyzeOperationConflict({
      mutation: { operationType, baseVersion, changedFields, payload },
      currentServerEntity: currentEntity,
      serverUpdatesSinceBase: updatesSinceBase
    });

    // 5. BRANCH BASED ON ANALYSIS
    if (analysis.hasConflict) {
      // CONFLICT DETECTED
      const conflictId = `cnf-${uuidv4()}`;

      // Insert record in sync_operations as CONFLICT
      await db.query(
        `INSERT INTO sync_operations 
         (operation_id, device_id, user_id, entity_type, entity_id, operation_type, base_version, changed_fields, payload, status, created_at, retry_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFLICT', $10, 0)`,
        [
          operationId,
          deviceId || 'unknown',
          userId || null,
          entityType,
          entityId,
          operationType,
          baseVersion,
          JSON.stringify(changedFields),
          JSON.stringify(payload),
          createdAt
        ]
      );

      // Insert into conflicts table
      await db.query(
        `INSERT INTO conflicts 
         (id, operation_id, entity_type, entity_id, base_version, server_version, server_values, local_values, conflicting_fields, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'UNRESOLVED')`,
        [
          conflictId,
          operationId,
          entityType,
          entityId,
          baseVersion,
          currentEntity ? currentEntity.version : 0,
          JSON.stringify(analysis.serverValues),
          JSON.stringify(analysis.localValues),
          JSON.stringify(analysis.conflictingFields)
        ]
      );

      // Log conflict event in activity logs
      await db.query(
        `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
         VALUES ($1, $2, $3, $4, 'CONFLICT_DETECTED', $5, $6, $7)`,
        [
          `act-${uuidv4()}`,
          userId,
          'Field Technician',
          deviceId,
          entityType,
          entityId,
          JSON.stringify({
            conflictId,
            conflictingFields: analysis.conflictingFields,
            serverVersion: currentEntity ? currentEntity.version : 0,
            baseVersion
          })
        ]
      );

      return {
        operationId,
        entityId,
        status: 'CONFLICT',
        conflictId,
        serverVersion: currentEntity ? currentEntity.version : 0,
        baseVersion,
        conflictingFields: analysis.conflictingFields,
        serverValues: analysis.serverValues,
        localValues: analysis.localValues,
        reason: analysis.reason
      };
    }

    // 6. SAFE TO APPLY (Clean match or Auto-Merge)
    let appliedEntity = null;
    let newVersion = 1;

    if (operationType === 'create') {
      appliedEntity = await this.applyCreate(entityType, entityId, payload, userId);
      newVersion = 1;
    } else if (operationType === 'update') {
      const updateResult = await this.applyUpdate(entityType, entityId, payload, changedFields, currentEntity, userId, deviceId);
      appliedEntity = updateResult.entity;
      newVersion = updateResult.newVersion;
    } else if (operationType === 'delete') {
      await this.applyDelete(entityType, entityId);
      newVersion = (currentEntity?.version || 0) + 1;
    }

    // Record successful sync operation
    await db.query(
      `INSERT INTO sync_operations 
       (operation_id, device_id, user_id, entity_type, entity_id, operation_type, base_version, changed_fields, payload, status, created_at, retry_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'SUCCESS', $10, 0)`,
      [
        operationId,
        deviceId || 'unknown',
        userId || null,
        entityType,
        entityId,
        operationType,
        baseVersion,
        JSON.stringify(changedFields),
        JSON.stringify(payload),
        createdAt
      ]
    );

    // Activity log for applied operation
    const actionName = analysis.isAutoMerge ? 'OPERATION_AUTO_MERGED' : `OPERATION_${operationType.toUpperCase()}`;
    await db.query(
      `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        `act-${uuidv4()}`,
        userId,
        'Field Technician',
        deviceId,
        actionName,
        entityType,
        entityId,
        JSON.stringify({
          version: newVersion,
          changedFields,
          autoMerged: analysis.isAutoMerge
        })
      ]
    );

    return {
      operationId,
      entityId,
      status: 'SUCCESS',
      autoMerged: analysis.isAutoMerge,
      version: newVersion,
      entity: appliedEntity,
      message: analysis.isAutoMerge ? 'Operation auto-merged successfully' : 'Operation applied cleanly'
    };
  }

  async getEntity(entityType, entityId) {
    if (entityType === 'task') {
      const res = await db.query('SELECT * FROM tasks WHERE id = $1', [entityId]);
      return res.rows[0] || null;
    } else if (entityType === 'checklist') {
      const res = await db.query('SELECT * FROM task_checklists WHERE id = $1', [entityId]);
      return res.rows[0] || null;
    }
    return null;
  }

  async applyCreate(entityType, entityId, payload, userId) {
    if (entityType === 'task') {
      const now = new Date().toISOString();
      await db.query(
        `INSERT INTO tasks (id, title, description, machine_name, location, priority, status, quantity, notes, assigned_to, version, updated_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 1, $11, $12, $13)`,
        [
          entityId,
          payload.title || 'Untitled Task',
          payload.description || '',
          payload.machine_name || 'General Machinery',
          payload.location || 'Main Facility',
          payload.priority || 'MEDIUM',
          payload.status || 'PENDING',
          Number(payload.quantity || 0),
          payload.notes || '',
          payload.assigned_to || userId,
          userId,
          now,
          now
        ]
      );

      // Create snapshot
      await db.query(
        `INSERT INTO task_updates (id, task_id, version, changed_fields, snapshot, updated_by, device_id)
         VALUES ($1, $2, 1, $3, $4, $5, 'client')`,
        [
          `upd-${uuidv4()}`,
          entityId,
          JSON.stringify(Object.keys(payload)),
          JSON.stringify(payload),
          userId
        ]
      );

      const created = await this.getEntity('task', entityId);
      return created;
    } else if (entityType === 'checklist') {
      await db.query(
        `INSERT INTO task_checklists (id, task_id, item_text, is_completed, order_index, version)
         VALUES ($1, $2, $3, $4, $5, 1)`,
        [
          entityId,
          payload.task_id,
          payload.item_text,
          payload.is_completed ? 1 : 0,
          payload.order_index || 0
        ]
      );
      return await this.getEntity('checklist', entityId);
    }
  }

  async applyUpdate(entityType, entityId, payload, changedFields, currentEntity, userId, deviceId) {
    const newVersion = (currentEntity.version || 0) + 1;
    const now = new Date().toISOString();

    if (entityType === 'task') {
      // Build dynamic parameterized UPDATE statement for only changed fields
      const validFields = ['title', 'description', 'machine_name', 'location', 'priority', 'status', 'quantity', 'notes', 'assigned_to'];
      const fieldsToUpdate = (changedFields.length > 0 ? changedFields : Object.keys(payload)).filter(f => validFields.includes(f));

      const setClauses = [];
      const values = [];
      let paramIdx = 1;

      for (const field of fieldsToUpdate) {
        setClauses.push(`${field} = $${paramIdx++}`);
        if (field === 'quantity') {
          values.push(Number(payload[field] || 0));
        } else {
          values.push(payload[field]);
        }
      }

      setClauses.push(`version = $${paramIdx++}`);
      values.push(newVersion);

      setClauses.push(`updated_at = $${paramIdx++}`);
      values.push(now);

      setClauses.push(`updated_by = $${paramIdx++}`);
      values.push(userId || 'technician');

      values.push(entityId); // for WHERE id = $X

      const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`;
      await db.query(sql, values);

      // Record update history snapshot
      const updatedEntity = await this.getEntity('task', entityId);
      await db.query(
        `INSERT INTO task_updates (id, task_id, version, changed_fields, snapshot, updated_by, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `upd-${uuidv4()}`,
          entityId,
          newVersion,
          JSON.stringify(fieldsToUpdate),
          JSON.stringify(updatedEntity),
          userId,
          deviceId
        ]
      );

      return { entity: updatedEntity, newVersion };
    } else if (entityType === 'checklist') {
      await db.query(
        `UPDATE task_checklists 
         SET is_completed = $1, item_text = COALESCE($2, item_text), version = $3, updated_at = $4
         WHERE id = $5`,
        [
          payload.is_completed ? 1 : 0,
          payload.item_text || null,
          newVersion,
          now,
          entityId
        ]
      );
      const updatedChecklist = await this.getEntity('checklist', entityId);
      return { entity: updatedChecklist, newVersion };
    }
  }

  async applyDelete(entityType, entityId) {
    if (entityType === 'task') {
      await db.query('DELETE FROM tasks WHERE id = $1', [entityId]);
    } else if (entityType === 'checklist') {
      await db.query('DELETE FROM task_checklists WHERE id = $1', [entityId]);
    }
  }
}

module.exports = new SyncEngine();
