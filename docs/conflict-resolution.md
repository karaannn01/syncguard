# SyncGuard — Conflict Detection & Resolution Engine

## The Dangers of Blind "Last-Write-Wins" (LWW)

In high-stakes industrial maintenance, blind timestamp-based Last-Write-Wins (LWW) causes silent, catastrophic data loss:
- A technician at Substation Alpha logs high temperature readings (85°C) and flags a coolant leak.
- Another technician simultaneously closes the ticket as "Routine inspection complete" because they inspected a different section.
- If LWW is applied, the critical safety warning is silently overwritten and deleted from the database.

SyncGuard strictly enforces **Conflict-Aware Concurrency Control**:
1. No concurrent modification is ever silently overwritten.
2. Safe non-overlapping edits are automatically unified.
3. True collisions are preserved and submitted to human operators with explicit side-by-side diffing.

---

## Conflict Detection Rules

```
                      Incoming Mutation (baseVersion, changedFields)
                                           |
                                           v
                        Does baseVersion === server.version?
                                      /         \
                                    YES          NO
                                    /             \
                         Clean Apply             Fetch Server Updates
                         Bump Version            since baseVersion
                         Return SUCCESS                   |
                                                          v
                                             Do changedFields overlap
                                           with serverModifiedFields?
                                                   /              \
                                                 NO               YES
                                                 /                  \
                                          Auto-Merge          Do field values
                                        Apply disjoint fields  match exactly?
                                        Bump Version           /          \
                                        Return SUCCESS       YES           NO
                                                             /              \
                                                      Redundant Match      CREATE CONFLICT
                                                      Return SUCCESS       Preserve Server State
                                                                           Status = UNRESOLVED
```

---

## Resolution Strategies

SyncGuard provides three explicit resolution strategies:

### 1. Keep Server (`KEEP_SERVER`)
- The incoming offline mutation is discarded.
- The existing server state is retained.
- The conflict record is updated to `status: 'RESOLVED'` and `resolution_type: 'KEEP_SERVER'`.
- The corresponding outbox entry on the client is cleared.

### 2. Keep Local (`KEEP_LOCAL`)
- The technician's local offline values override the server record.
- Server increments `version = server.version + 1`.
- An immutable snapshot is recorded in `task_updates`.
- The conflict record is updated to `status: 'RESOLVED'` and `resolution_type: 'KEEP_LOCAL'`.

### 3. Granular Field-Level Merge (`MERGE`)
- The operator selects which value to adopt on a field-by-field basis:
  - Example: `status: Server ("COMPLETED")`, `quantity: Local (48 units)`.
- The composite record is applied atomically to the server database.
- Server version advances to `server.version + 1`.
- Full audit records are logged detailing the composite resolution.
