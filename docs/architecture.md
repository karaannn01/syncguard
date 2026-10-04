# SyncGuard — System Architecture

## High-Level Architectural Overview

SyncGuard is an enterprise offline-first Progressive Web Application (PWA) designed for field-service and critical infrastructure maintenance teams. It provides deterministic, conflict-aware synchronization using versioned optimistic concurrency control and an IndexedDB operation outbox.

```
+-----------------------------------------------------------------------------------+
|                                  CLIENT (PWA)                                     |
|                                                                                   |
|  +------------------------+      +--------------------+      +-----------------+  |
|  |     React Views &      | ---> |  Task Repository   | ---> | Dexie IndexedDB |  |
|  | Components (Tailwind)  |      |   (Local First)    |      | (Local Stores)  |  |
|  +------------------------+      +--------------------+      +-----------------+  |
|              ^                             |                          |           |
|              |                             v                          v           |
|              |                   +--------------------+      +-----------------+  |
|              +------------------ |    Sync Manager    | <--- | Operation Outbox|  |
|                                  +--------------------+      +-----------------+  |
+--------------------------------------------|--------------------------------------+
                                             | REST / JSON Batch
                                             v
+-----------------------------------------------------------------------------------+
|                                BACKEND SERVER (Node.js)                           |
|                                                                                   |
|  +------------------------+      +--------------------+      +-----------------+  |
|  |      Express APIs      | ---> | Server Sync Engine | ---> |   PostgreSQL    |  |
|  | (/api/sync, /api/tasks)|      |  (Version Control) |      | (Dual SQLite fb)|  |
|  +------------------------+      +--------------------+      +-----------------+  |
|                                            |                          |           |
|                                            v                          v           |
|                                  +--------------------+      +-----------------+  |
|                                  | Conflict Detection |      | Task Snapshots  |  |
|                                  | & Resolver Engine  |      | & Audit Logs    |  |
|                                  +--------------------+      +-----------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 1. Client-Side Offline Architecture

### Storage Layer (Dexie.js / IndexedDB)
SyncGuard isolates operations into dedicated object stores:
1. `tasks`: Local mirror of field work orders with `_syncStatus` tags (`SYNCED`, `PENDING`, `CONFLICT`).
2. `checklists`: Granular inspection step records attached to parent tasks.
3. `outbox`: Persistent FIFO queue of pending mutations generated while offline or unacknowledged.
4. `conflicts`: Unresolved concurrent modification records requiring technician or administrator review.
5. `sync_metadata`: High-water marks, device pairing state, and last sync timestamps.
6. `users`: Local credential and role cache for role-based authorization offline.
7. `activity_logs`: Immutable client telemetry of mutations and device transitions.

### Mutation Pipeline & Outbox Ingestion
When a technician alters any field or toggles a checklist step:
1. **Immediate Local State Write**: Dexie IndexedDB updates instantly, eliminating UI latency.
2. **Operation Outbox Generation**: An atomic mutation object is serialized:
   ```json
   {
     "operationId": "op-4f9b8c-171829384",
     "deviceId": "dev-alpha-01",
     "userId": "usr-tech-01",
     "entityType": "task",
     "entityId": "tsk-7701",
     "operationType": "update",
     "baseVersion": 7,
     "changedFields": ["status", "quantity"],
     "payload": { "status": "COMPLETED", "quantity": 50 },
     "createdAt": "2026-10-04T10:30:00.000Z",
     "status": "PENDING"
   }
   ```
3. **Background Sync Dispatch**: If browser connectivity is detected, `SyncManager` flushes the outbox asynchronously without blocking user workflows.

---

## 2. Server-Side Synchronization Engine

### Version-Based Concurrency Control (OCC)
Every synchronizable record contains a strictly monotonic integer `version` initialized at `1`.
When processing an incoming operation:
- If `mutation.baseVersion === server.version`: The server applies the patch, increments `version = version + 1`, and creates an immutable snapshot in `task_updates`.
- If `mutation.baseVersion !== server.version`: The server enters the **Conflict Detection & Auto-Merge Engine**.

### Concurrency Evaluation Matrix
| Condition | Detection Logic | Resulting Action |
| :--- | :--- | :--- |
| **Clean Match** | `baseVersion === currentVersion` | Apply mutation, bump version, return `SUCCESS`. |
| **Disjoint Fields** | `baseVersion < currentVersion` AND `changedFields ∩ serverModifiedFields = ∅` | **Auto-Merge**: Server applies non-overlapping fields, bumps version, returns `SUCCESS` (`autoMerged: true`). |
| **Identical Field Values** | Same field modified to identical value on both devices | **Redundant Match**: No conflict, acknowledge `SUCCESS`. |
| **Conflicting Field Values** | Same field modified to different values on both devices | **Conflict**: Server creates entry in `conflicts` table with status `UNRESOLVED`. Record is preserved untouched on server. |
| **Delete vs Edit** | One device deleted record while another updated fields | **Conflict**: Preserved in `conflicts` table for manual adjudication. |

---

## 3. Idempotency & Network Resilience
- Every operation bears a unique UUID `operationId`.
- The backend verifies `sync_operations(operation_id)` before applying changes.
- Duplicate transmissions (due to network timeout or retry) return the previously computed result without re-executing mutations or inflating version counters.
- Operations remain safely preserved in the client outbox until the server explicitly acknowledges with HTTP 200 and `status: "SUCCESS"`.
