/**
 * Conflict Detection Service
 * Evaluates mutations against server state according to ALG-WEB-02 specification.
 */

/**
 * Deep equality check for primitives or plain JSON objects/arrays
 */
function areValuesEqual(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  // Coerce string numbers if one is number and other is numeric string
  if (typeof a === 'number' && typeof b === 'string') {
    return a.toString() === b.trim();
  }
  if (typeof b === 'number' && typeof a === 'string') {
    return b.toString() === a.trim();
  }
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

/**
 * Compare client mutation against current server entity and historical updates
 * 
 * @param {Object} params
 * @param {Object} params.mutation - The incoming client operation
 * @param {Object|null} params.currentServerEntity - Current entity state on server
 * @param {Array} params.serverUpdatesSinceBase - All task_updates records between baseVersion and currentVersion
 * 
 * @returns {Object} result:
 *   - canApply: boolean
 *   - hasConflict: boolean
 *   - isAutoMerge: boolean
 *   - conflictingFields: string[]
 *   - nonConflictingFields: string[]
 *   - serverValues: Object
 *   - localValues: Object
 *   - reason: string
 */
function analyzeOperationConflict({ mutation, currentServerEntity, serverUpdatesSinceBase = [] }) {
  const { operationType, baseVersion, changedFields = [], payload = {} } = mutation;

  // Case 1: Entity does not exist on server
  if (!currentServerEntity) {
    if (operationType === 'create') {
      // Clean creation
      return {
        canApply: true,
        hasConflict: false,
        isAutoMerge: false,
        conflictingFields: [],
        nonConflictingFields: changedFields,
        reason: 'New entity creation'
      };
    } else {
      // Edit or delete on non-existent entity
      return {
        canApply: false,
        hasConflict: true,
        isAutoMerge: false,
        conflictingFields: ['[ENTITY_DELETED_OR_MISSING]'],
        serverValues: {},
        localValues: payload,
        reason: 'Entity does not exist on server (Delete vs Edit or Missing)'
      };
    }
  }

  // Case 2: Client wants to delete, but server was modified concurrently
  if (operationType === 'delete') {
    if (currentServerEntity.version !== baseVersion) {
      return {
        canApply: false,
        hasConflict: true,
        isAutoMerge: false,
        conflictingFields: ['[DELETE_VS_EDIT]'],
        serverValues: currentServerEntity,
        localValues: { deleted: true, baseVersion },
        reason: `Delete vs Edit conflict: entity was updated to version ${currentServerEntity.version} while client was offline.`
      };
    }
    return {
      canApply: true,
      hasConflict: false,
      isAutoMerge: false,
      conflictingFields: [],
      reason: 'Safe deletion'
    };
  }

  // Case 3: Exact version match -> Clean application!
  if (currentServerEntity.version === baseVersion) {
    return {
      canApply: true,
      hasConflict: false,
      isAutoMerge: false,
      conflictingFields: [],
      nonConflictingFields: changedFields,
      reason: 'Base version matches server version exactly'
    };
  }

  // Case 4: Version mismatch -> baseVersion !== currentServerEntity.version
  // We must examine the fields changed by server since baseVersion vs fields changed in this mutation.

  // Aggregate all fields modified on the server in intermediate versions
  const serverModifiedFields = new Set();
  for (const update of serverUpdatesSinceBase) {
    try {
      const parsedFields = typeof update.changed_fields === 'string'
        ? JSON.parse(update.changed_fields)
        : update.changed_fields;
      if (Array.isArray(parsedFields)) {
        parsedFields.forEach(f => serverModifiedFields.add(f));
      }
    } catch {
      // Fallback
    }
  }

  const conflictingFields = [];
  const nonConflictingFields = [];
  const conflictingServerValues = {};
  const conflictingLocalValues = {};

  for (const field of changedFields) {
    const localVal = payload[field];
    const serverVal = currentServerEntity[field];

    // Check if the server value is actually different from the local incoming value
    if (areValuesEqual(localVal, serverVal)) {
      // "If the same field changed to the same value: No conflict."
      nonConflictingFields.push(field);
    } else {
      // Values are different. Did the server modify this field concurrently?
      // If serverModifiedFields contains this field, or if serverVal !== localVal
      if (serverModifiedFields.has(field) || serverModifiedFields.size === 0) {
        // True concurrent change on the same field to different values!
        conflictingFields.push(field);
        conflictingServerValues[field] = serverVal;
        conflictingLocalValues[field] = localVal;
      } else {
        // The server was modified, but this specific field was untouched by other updates
        nonConflictingFields.push(field);
      }
    }
  }

  if (conflictingFields.length > 0) {
    // "If the same field changed to different values: Create a conflict."
    return {
      canApply: false,
      hasConflict: true,
      isAutoMerge: false,
      conflictingFields,
      nonConflictingFields,
      serverValues: conflictingServerValues,
      localValues: conflictingLocalValues,
      reason: `Concurrent conflict detected on fields: ${conflictingFields.join(', ')}`
    };
  }

  // "If different fields were changed: Automatically merge."
  return {
    canApply: true,
    hasConflict: false,
    isAutoMerge: true,
    conflictingFields: [],
    nonConflictingFields: changedFields,
    reason: 'Auto-merged non-overlapping field modifications'
  };
}

module.exports = {
  analyzeOperationConflict,
  areValuesEqual
};
