# SyncGuard Presentation Deck (Markdown / Marp format)

---
marp: true
theme: uncover
class: invert
paginate: true
header: "SyncGuard — ALGOTHON'26 | ALG-WEB-02"
footer: "Confidential • Field-Service Concurrency Control"
---

# SyncGuard
### Conflict-Aware Offline Operations
**ALGOTHON'26 Final Hackathon Presentation**  
*Problem Statement: ALG-WEB-02 — Offline-First Application*

---

## The Industrial Reality
### Why Standard Apps Fail in the Field

1. **Subterranean & Remote Blackouts**: Mines, basements, and substations have 0% connectivity.
2. **The "Last-Write-Wins" Disaster**: Device clocks drift. The last device to reconnect blindly deletes previous work.
3. **High Stakes**: Overwriting a thermal warning or safety isolation lock is physically hazardous.

---

## Client-Side Architecture
### Dexie.js & IndexedDB Foundation

- **7 Dedicated Object Stores**: `tasks`, `checklists`, `outbox`, `conflicts`, `sync_metadata`, `users`, `activity_logs`.
- **Local-First Mutations**: Updates render in `<5ms`. Zero UI freezes.
- **Persistent Outbox**: Serialized FIFO mutation queue survives browser refreshes and reboots.
- **PWA Service Worker**: Cache API offline shell with zero-connection boot.

---

## Server Concurrency Engine
### Optimistic Concurrency Control (OCC)

- **Atomic Monotonic Versioning**: Every entity maintains a strictly increasing version integer.
- **Strict Idempotency**: Duplicate transmissions are safely ignored via unique `operationId` tracking.
- **Dual-Engine DB**: PostgreSQL production driver with zero-config embedded SQLite fallback.

---

## Algorithmic Conflict Resolution

```
                    Incoming Mutation (baseVersion, changedFields)
                                         |
                                         v
                      Does baseVersion === server.version?
                                    /         \
                                  YES          NO
                                  /             \
                       Clean Apply             Fetch Server Updates
                       Version + 1             since baseVersion
                                                        |
                                                        v
                                           Do changedFields overlap?
                                                 /              \
                                               NO               YES
                                               /                  \
                                        Auto-Merge          Do field values
                                        Apply disjoint       match exactly?
                                        Version + 1          /          \
                                                           YES           NO
                                                           /              \
                                                    No Conflict       FLAG CONFLICT
                                                    Return SUCCESS    Status = UNRESOLVED
```

---

## The Hackathon Demo Scenario
### Real Multi-Device Concurrency Test

1. **Baseline**: Task 7701 (*CNC Milling Unit #4*) starts at **Version 7**.
2. **Device A Offline**: Status $\rightarrow$ `COMPLETED`, Quantity $\rightarrow$ `50`.
3. **Device B Offline**: Status $\rightarrow$ `IN_PROGRESS`, Quantity $\rightarrow$ `45`.
4. **Device A Syncs**: Server advances to **Version 8**.
5. **Device B Syncs**: Stale `baseVersion: 7` triggers **Server Conflict Detection**!
6. **Conflict Center**: Side-by-side comparison and fine-grained merge $\rightarrow$ **Version 9**.

---

## Field-Ready Mobile & Desktop UX

- **Mobile First (320px+)**: Large 44px+ touch targets and bottom navigation designed for field gloves.
- **Desktop Command Center**: Responsive sidebar, live outbox monitors, and audit telemetry.
- **Multi-Sensory Status Badges**: Color + Icon + Text (`Online`, `Offline`, `Syncing`, `Conflict`).
- **Device Simulator**: Real-time terminal identity switcher between Device A, Device B, and Admin HQ.

---

## 100% Automated Test Evidence

- ✔ Detects equal values across primitives and objects
- ✔ Allows clean update when baseVersion equals server version
- ✔ Detects conflict when same field changed to different values
- ✔ Automatically merges when different non-overlapping fields are modified
- ✔ Detects delete vs edit conflict
- ✔ Guarantees idempotency when an operation is retransmitted
- ✔ Executes official multi-device demo scenario cleanly

**7 Tests Passed | 0 Failures | 250ms Execution Time**

---

## Summary & Impact

- **Zero Silent Data Loss Guarantee**
- **Deterministic Optimistic Concurrency Control**
- **Frictionless Field Experience with Auto-Merging**
- **Enterprise-Grade Architecture**

*Ready for Live Questions & Demonstration.*
