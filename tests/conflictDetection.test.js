const { describe, it } = require('node:test');
const assert = require('node:assert');
const { analyzeOperationConflict, areValuesEqual } = require('../server/src/services/conflictDetection');

describe('Conflict Detection Logic', () => {
  it('detects equal values across primitives and objects', () => {
    assert.strictEqual(areValuesEqual('Completed', 'Completed'), true);
    assert.strictEqual(areValuesEqual(50, 50), true);
    assert.strictEqual(areValuesEqual(50, '50'), true);
    assert.strictEqual(areValuesEqual('In Progress', 'Completed'), false);
    assert.strictEqual(areValuesEqual({ a: 1 }, { a: 1 }), true);
  });

  it('allows clean update when baseVersion equals server version', () => {
    const mutation = {
      operationType: 'update',
      baseVersion: 7,
      changedFields: ['status', 'quantity'],
      payload: { status: 'Completed', quantity: 50 }
    };

    const currentServerEntity = {
      id: 'tsk-7701',
      version: 7,
      status: 'IN_PROGRESS',
      quantity: 40
    };

    const result = analyzeOperationConflict({
      mutation,
      currentServerEntity,
      serverUpdatesSinceBase: []
    });

    assert.strictEqual(result.canApply, true);
    assert.strictEqual(result.hasConflict, false);
    assert.strictEqual(result.isAutoMerge, false);
  });

  it('detects conflict when same field changed to different values (Demo Scenario)', () => {
    // Device B tries to apply with baseVersion 7, but server is at version 8
    // Server has status: 'Completed', quantity: 50
    // Device B wants status: 'IN_PROGRESS', quantity: 45
    const mutation = {
      operationType: 'update',
      baseVersion: 7,
      changedFields: ['status', 'quantity'],
      payload: { status: 'IN_PROGRESS', quantity: 45 }
    };

    const currentServerEntity = {
      id: 'tsk-7701',
      version: 8,
      status: 'Completed',
      quantity: 50
    };

    const serverUpdatesSinceBase = [
      {
        version: 8,
        changed_fields: JSON.stringify(['status', 'quantity'])
      }
    ];

    const result = analyzeOperationConflict({
      mutation,
      currentServerEntity,
      serverUpdatesSinceBase
    });

    assert.strictEqual(result.canApply, false);
    assert.strictEqual(result.hasConflict, true);
    assert.deepStrictEqual(result.conflictingFields.sort(), ['quantity', 'status'].sort());
    assert.strictEqual(result.serverValues.status, 'Completed');
    assert.strictEqual(result.localValues.status, 'IN_PROGRESS');
    assert.strictEqual(result.serverValues.quantity, 50);
    assert.strictEqual(result.localValues.quantity, 45);
  });

  it('automatically merges when different non-overlapping fields are modified', () => {
    // Device modified notes from baseVersion 7
    // Server modified priority to 'CRITICAL' in version 8
    const mutation = {
      operationType: 'update',
      baseVersion: 7,
      changedFields: ['notes'],
      payload: { notes: 'Bearing lubricant inspected by tech on site.' }
    };

    const currentServerEntity = {
      id: 'tsk-7701',
      version: 8,
      priority: 'CRITICAL',
      notes: 'Initial sensor baseline recorded.'
    };

    const serverUpdatesSinceBase = [
      {
        version: 8,
        changed_fields: JSON.stringify(['priority'])
      }
    ];

    const result = analyzeOperationConflict({
      mutation,
      currentServerEntity,
      serverUpdatesSinceBase
    });

    assert.strictEqual(result.canApply, true);
    assert.strictEqual(result.hasConflict, false);
    assert.strictEqual(result.isAutoMerge, true);
  });

  it('detects delete vs edit conflict', () => {
    const mutation = {
      operationType: 'delete',
      baseVersion: 7,
      changedFields: [],
      payload: {}
    };

    const currentServerEntity = {
      id: 'tsk-7701',
      version: 8,
      status: 'Completed'
    };

    const result = analyzeOperationConflict({
      mutation,
      currentServerEntity,
      serverUpdatesSinceBase: [{ version: 8, changed_fields: '["status"]' }]
    });

    assert.strictEqual(result.canApply, false);
    assert.strictEqual(result.hasConflict, true);
    assert.strictEqual(result.conflictingFields[0], '[DELETE_VS_EDIT]');
  });
});
