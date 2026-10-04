const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const syncEngine = require('../server/src/services/syncEngine');
const conflictResolver = require('../server/src/services/conflictResolver');
const db = require('../server/src/config/db');
const { createSchema } = require('../server/src/models/schema');
const { seedData } = require('../server/src/models/seed');

describe('Sync Engine & Concurrency Verification', () => {
  before(async () => {
    await createSchema();
    await seedData();
  });

  it('guarantees idempotency when an operation is retransmitted', async () => {
    await db.query("UPDATE tasks SET version = 1, quantity = 12 WHERE id = 'tsk-7703'");
    const opId = `op-idem-test-${Date.now()}`;
    const op = {
      operationId: opId,
      deviceId: 'dev-alpha-01',
      userId: 'usr-tech-01',
      entityType: 'task',
      entityId: 'tsk-7703',
      operationType: 'update',
      baseVersion: 1,
      changedFields: ['quantity'],
      payload: { quantity: 15 },
      createdAt: new Date().toISOString()
    };

    // First transmission
    const res1 = await syncEngine.processBatch({ operations: [op], userId: 'usr-tech-01', deviceId: 'dev-alpha-01' });
    assert.strictEqual(res1.results[0].status, 'SUCCESS');
    assert.strictEqual(res1.stats.succeeded, 1);

    // Second transmission with the EXACT SAME operationId
    const res2 = await syncEngine.processBatch({ operations: [op], userId: 'usr-tech-01', deviceId: 'dev-alpha-01' });
    assert.strictEqual(res2.results[0].status, 'SUCCESS');
    assert.strictEqual(res2.results[0].isIdempotent, true);
    assert.strictEqual(res2.stats.idempotentCached, 1);

    // Verify version was NOT bumped a second time
    const taskCheck = await db.query('SELECT version, quantity FROM tasks WHERE id = $1', ['tsk-7703']);
    assert.strictEqual(taskCheck.rows[0].version, 2);
    assert.strictEqual(taskCheck.rows[0].quantity, 15);
  });

  it('executes official multi-device demo scenario cleanly', async () => {
    // 1. Reset demo state
    await db.query("UPDATE tasks SET version = 7, status = 'IN_PROGRESS', quantity = 40 WHERE id = 'tsk-7701'");

    // 2. Device A submits update from version 7: status = Completed, quantity = 50
    const opDeviceA = {
      operationId: `op-devA-${Date.now()}`,
      deviceId: 'dev-alpha-01',
      userId: 'usr-tech-01',
      entityType: 'task',
      entityId: 'tsk-7701',
      operationType: 'update',
      baseVersion: 7,
      changedFields: ['status', 'quantity'],
      payload: { status: 'Completed', quantity: 50 },
      createdAt: new Date().toISOString()
    };

    const resA = await syncEngine.processBatch({ operations: [opDeviceA], userId: 'usr-tech-01', deviceId: 'dev-alpha-01' });
    assert.strictEqual(resA.results[0].status, 'SUCCESS');
    assert.strictEqual(resA.results[0].version, 8);

    // Server is now version 8!
    const taskAfterA = await db.query('SELECT version, status, quantity FROM tasks WHERE id = $1', ['tsk-7701']);
    assert.strictEqual(taskAfterA.rows[0].version, 8);
    assert.strictEqual(taskAfterA.rows[0].status, 'Completed');
    assert.strictEqual(taskAfterA.rows[0].quantity, 50);

    // 3. Device B reconnects with baseVersion 7 (was offline): status = In Progress, quantity = 45
    const opDeviceB = {
      operationId: `op-devB-${Date.now()}`,
      deviceId: 'dev-beta-02',
      userId: 'usr-tech-02',
      entityType: 'task',
      entityId: 'tsk-7701',
      operationType: 'update',
      baseVersion: 7,
      changedFields: ['status', 'quantity'],
      payload: { status: 'IN_PROGRESS', quantity: 45 },
      createdAt: new Date().toISOString()
    };

    const resB = await syncEngine.processBatch({ operations: [opDeviceB], userId: 'usr-tech-02', deviceId: 'dev-beta-02' });
    assert.strictEqual(resB.results[0].status, 'CONFLICT');
    assert.strictEqual(resB.stats.conflicts, 1);
    assert.ok(resB.results[0].conflictId);
    assert.deepStrictEqual(resB.results[0].conflictingFields.sort(), ['quantity', 'status'].sort());

    // 4. Resolve the conflict using MERGE: keep status 'Completed' (from Server) and quantity 48 (merged compromise)
    const resolveResult = await conflictResolver.resolve({
      conflictId: resB.results[0].conflictId,
      resolutionType: 'MERGE',
      resolvedValues: { status: 'Completed', quantity: 48 },
      userId: 'usr-admin-01'
    });

    assert.strictEqual(resolveResult.success, true);
    assert.strictEqual(resolveResult.updatedEntity.version, 9);
    assert.strictEqual(resolveResult.updatedEntity.status, 'Completed');
    assert.strictEqual(resolveResult.updatedEntity.quantity, 48);
  });
});
