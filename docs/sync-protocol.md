# SyncGuard — Synchronization Protocol Specification

## 1. Protocol Philosophy

SyncGuard rejects fragile "Last-Write-Wins" (LWW) timestamp comparisons. Because device system clocks routinely drift or get manipulated, SyncGuard relies strictly on **Deterministic Causal Versioning (Optimistic Concurrency Control)**.

---

## 2. API Endpoints

### Batch Synchronization Request
- **Endpoint**: `POST /api/sync`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <jwt_token>` (or `x-user-id` header in development mode)
  - `x-device-id: <device_id>`

#### Request Payload Schema
```json
{
  "deviceId": "dev-alpha-01",
  "operations": [
    {
      "operationId": "op-84fa7129-b69c-4c74-a63b-bf76a1420a89",
      "deviceId": "dev-alpha-01",
      "userId": "usr-tech-01",
      "entityType": "task",
      "entityId": "tsk-7701",
      "operationType": "update",
      "baseVersion": 7,
      "changedFields": ["status", "quantity"],
      "payload": {
        "status": "COMPLETED",
        "quantity": 50
      },
      "createdAt": "2026-10-04T10:45:12.190Z"
    }
  ]
}
```

#### Response Payload Schema (Clean Success / Auto-Merge)
```json
{
  "success": true,
  "stats": {
    "total": 1,
    "succeeded": 1,
    "conflicts": 0,
    "autoMerged": 0,
    "idempotentCached": 0,
    "failed": 0
  },
  "results": [
    {
      "operationId": "op-84fa7129-b69c-4c74-a63b-bf76a1420a89",
      "entityId": "tsk-7701",
      "status": "SUCCESS",
      "autoMerged": false,
      "version": 8,
      "message": "Operation applied cleanly",
      "entity": {
        "id": "tsk-7701",
        "title": "CNC Milling Unit #4 - Spindle Bearing Inspection",
        "status": "COMPLETED",
        "quantity": 50,
        "version": 8,
        "updated_at": "2026-10-04T10:45:12.350Z"
      }
    }
  ],
  "processedAt": "2026-10-04T10:45:12.352Z"
}
```

#### Response Payload Schema (Conflict Detected)
```json
{
  "success": true,
  "stats": {
    "total": 1,
    "succeeded": 0,
    "conflicts": 1,
    "autoMerged": 0,
    "idempotentCached": 0,
    "failed": 0
  },
  "results": [
    {
      "operationId": "op-92eb1830-4e12-4f81-9b11-cf199e4190ba",
      "entityId": "tsk-7701",
      "status": "CONFLICT",
      "conflictId": "cnf-3d71ba82-d48e-4a67-b582-8e1245fa7210",
      "serverVersion": 8,
      "baseVersion": 7,
      "conflictingFields": ["status", "quantity"],
      "serverValues": {
        "status": "COMPLETED",
        "quantity": 50
      },
      "localValues": {
        "status": "IN_PROGRESS",
        "quantity": 45
      },
      "reason": "Concurrent conflict detected on fields: status, quantity"
    }
  ],
  "processedAt": "2026-10-04T10:46:01.120Z"
}
```

---

## 3. Client Reconnection & State Reconciliation

When the client transitions from offline to online:
1. `navigator.onLine` fires or user disables simulated offline mode.
2. `SyncManager` queries Dexie IndexedDB `outbox` for all mutations where `status !== 'SUCCESS'`.
3. If pending mutations exist:
   - Operations are marshaled in chronological order (`createdAt ASC`).
   - `POST /api/sync` sends the batch.
   - Successful operations are removed from the local outbox.
   - Conflicted operations are flagged with their `conflictId` and registered in the `conflicts` Dexie store.
4. `SyncManager` pulls down the fresh server catalog (`GET /api/tasks` and `GET /api/conflicts`).
5. Entities with local pending mutations are not overwritten during the pull, preserving in-flight user edits.
6. The UI notifies the operator with a non-intrusive semantic toast indicator.
