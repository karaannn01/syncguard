const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

class ConflictResolver {
  /**
   * Resolve an existing conflict record
   * @param {Object} params
   * @param {string} params.conflictId
   * @param {string} params.resolutionType - 'KEEP_SERVER' | 'KEEP_LOCAL' | 'MERGE'
   * @param {Object} params.resolvedValues - custom field mapping if MERGE or KEEP_LOCAL
   * @param {string} params.userId
   */
  async resolve({ conflictId, resolutionType, resolvedValues = {}, userId = 'technician' }) {
    const conflictRes = await db.query('SELECT * FROM conflicts WHERE id = $1', [conflictId]);
    if (conflictRes.rows.length === 0) {
      throw new Error(`Conflict record not found: ${conflictId}`);
    }

    const conflict = conflictRes.rows[0];
    if (conflict.status === 'RESOLVED') {
      return {
        message: 'Conflict was already resolved',
        conflict,
        alreadyResolved: true
      };
    }

    const entityType = conflict.entity_type;
    const entityId = conflict.entity_id;
    const serverValues = typeof conflict.server_values === 'string' ? JSON.parse(conflict.server_values) : conflict.server_values;
    const localValues = typeof conflict.local_values === 'string' ? JSON.parse(conflict.local_values) : conflict.local_values;

    let finalValues = {};
    if (resolutionType === 'KEEP_SERVER') {
      finalValues = { ...serverValues };
    } else if (resolutionType === 'KEEP_LOCAL') {
      finalValues = { ...localValues };
    } else if (resolutionType === 'MERGE') {
      finalValues = { ...serverValues, ...resolvedValues };
    } else {
      throw new Error(`Invalid resolutionType: ${resolutionType}. Must be KEEP_SERVER, KEEP_LOCAL, or MERGE.`);
    }

    let updatedEntity = null;
    const now = new Date().toISOString();

    if (resolutionType !== 'KEEP_SERVER') {
      // Apply the chosen local or merged values to the entity on the server
      if (entityType === 'task') {
        const taskCheck = await db.query('SELECT * FROM tasks WHERE id = $1', [entityId]);
        if (taskCheck.rows.length > 0) {
          const currentTask = taskCheck.rows[0];
          const newVersion = currentTask.version + 1;

          const allowedFields = ['title', 'description', 'machine_name', 'location', 'priority', 'status', 'quantity', 'notes', 'assigned_to'];
          const fieldsToUpdate = Object.keys(finalValues).filter(f => allowedFields.includes(f));

          const setClauses = [];
          const values = [];
          let paramIdx = 1;

          for (const f of fieldsToUpdate) {
            setClauses.push(`${f} = $${paramIdx++}`);
            values.push(f === 'quantity' ? Number(finalValues[f] || 0) : finalValues[f]);
          }

          setClauses.push(`version = $${paramIdx++}`);
          values.push(newVersion);

          setClauses.push(`updated_at = $${paramIdx++}`);
          values.push(now);

          setClauses.push(`updated_by = $${paramIdx++}`);
          values.push(userId);

          values.push(entityId);

          const sql = `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`;
          await db.query(sql, values);

          // Record snapshot
          const tRes = await db.query('SELECT * FROM tasks WHERE id = $1', [entityId]);
          updatedEntity = tRes.rows[0];

          await db.query(
            `INSERT INTO task_updates (id, task_id, version, changed_fields, snapshot, updated_by, device_id)
             VALUES ($1, $2, $3, $4, $5, $6, 'conflict-resolver')`,
            [
              `upd-${uuidv4()}`,
              entityId,
              newVersion,
              JSON.stringify(fieldsToUpdate),
              JSON.stringify(updatedEntity),
              userId
            ]
          );
        }
      }
    } else {
      // KEEP_SERVER
      const tRes = await db.query('SELECT * FROM tasks WHERE id = $1', [entityId]);
      updatedEntity = tRes.rows[0] || null;
    }

    // Mark conflict resolved
    await db.query(
      `UPDATE conflicts 
       SET status = 'RESOLVED', resolution_type = $1, resolved_values = $2, resolved_by = $3, resolved_at = $4
       WHERE id = $5`,
      [
        resolutionType,
        JSON.stringify(finalValues),
        userId,
        now,
        conflictId
      ]
    );

    // Update corresponding sync_operations status
    if (conflict.operation_id) {
      await db.query(
        `UPDATE sync_operations SET status = 'RESOLVED' WHERE operation_id = $1`,
        [conflict.operation_id]
      );
    }

    // Activity log
    await db.query(
      `INSERT INTO activity_logs (id, user_id, user_name, device_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, 'resolver', 'CONFLICT_RESOLVED', $4, $5, $6)`,
      [
        `act-${uuidv4()}`,
        userId,
        'Technician / Admin',
        entityType,
        entityId,
        JSON.stringify({
          conflictId,
          resolutionType,
          finalValues
        })
      ]
    );

    return {
      success: true,
      conflictId,
      resolutionType,
      resolvedValues: finalValues,
      updatedEntity
    };
  }
}

module.exports = new ConflictResolver();
