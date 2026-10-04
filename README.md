# SyncGuard — Conflict-Aware Offline Operations
> **ALGOTHON’26 Hackathon Project** | **Problem Statement: ALG-WEB-02 — Offline-First Application**  
> Professional, enterprise-grade offline-first PWA for field-service and maintenance teams with versioned concurrency control and conflict resolution.

---

## 1. Problem Statement
Field service technicians, utility engineers, and industrial maintenance personnel frequently operate in remote basements, factory sub-levels, offshore rigs, and rural substations with zero or intermittent internet connectivity. 

Standard web applications fail catastrophically in these environments:
1. Operations freeze or lose state upon disconnect.
2. Changes made offline overwrite each other silently when connectivity returns ("Last-Write-Wins" data loss).
3. Critical equipment safety warnings, calibrated tolerances, or inspection notes get obliterated without human knowledge.

---

## 2. The SyncGuard Solution
SyncGuard is an **offline-first Progressive Web App (PWA)** built around a rock-solid, deterministic synchronization protocol:
- **100% Offline Capability**: Technicians can review work orders, update quantities, edit diagnostics, create tasks, and toggle checklists with zero internet connection.
- **Immediate Local Persistence**: All mutations write instantaneously to IndexedDB (via Dexie.js), ensuring zero input latency.
- **Deterministic Concurrency Control**: Every entity tracks a monotonic `version` counter. Blind Last-Write-Wins is strictly prohibited.
- **Automatic Field-Level Merging**: Safe, non-overlapping field updates from concurrent offline sessions are merged automatically without manual intervention.
- **Visual Conflict Resolution Center**: When two offline devices alter the same field to conflicting values, the system safely halts the mutation, stages the collision in a dedicated conflict store, and presents a side-by-side diff allowing technicians or leads to choose **Keep Server**, **Keep Local**, or **Granular Merge**.

---

## 3. Key Features

- **Field Work Orders & Asset Management**: Equipment diagnostics, plant locations, priority levels, quantities, and multi-step checklists.
- **Offline Outbox Engine**: Serialized mutations with unique UUIDs, base versions, changed field tags, and timestamps.
- **Zero Data Loss Guarantee**: Unsent or unacknowledged mutations remain preserved in IndexedDB even across browser reloads or device restarts.
- **Idempotent API Delivery**: Duplicate packet transmissions caused by cellular network timeouts are cached and re-acknowledged without double-mutations.
- **Interactive Conflict Center**: Real-time visual comparison of Server vX vs Local vY against Base vZ, highlighting exact field collisions.
- **Integrated Scenario Runner / Demo Lab**: Built-in simulator for evaluators to simulate Device A vs Device B offline conflict scenarios with one click.
- **Full Audit Feed**: Immutable activity feed logging who changed what, when, and from which device.
- **Progressive Web App (PWA)**: Installable on iOS/Android/Desktop with Service Worker caching and standalone mode.
- **Mobile-First Responsive UX**: Designed for 320px+ mobile phones (with bottom touch navigation) through 1440px desktop command centers.

---

## 4. Technology Stack

### Frontend
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 (Enterprise Slate/Cyan Industrial Theme)
- **Icons**: Lucide React
- **Offline Storage**: Dexie.js (IndexedDB wrapper)
- **Service Worker**: Cache API for static shell assets & offline fallback

### Backend
- **Runtime**: Node.js v24
- **Web Framework**: Express.js
- **Database**: PostgreSQL (via `pg`) with embedded zero-config SQLite (`better-sqlite3`) fallback
- **Authentication**: JWT & Role-Based Access Control (`ADMIN`, `TECHNICIAN`)

---

## 5. Offline Architecture & IndexedDB Stores

SyncGuard organizes local storage into 7 dedicated IndexedDB tables:
1. `tasks`: Local mirror of maintenance tasks with `_syncStatus` tags.
2. `checklists`: Inspection steps linked to parent tasks.
3. `outbox`: FIFO queue of pending mutations.
4. `conflicts`: Staged collision records awaiting adjudication.
5. `sync_metadata`: High-water marks and sync timestamps.
6. `users`: Local credential cache for role validation.
7. `activity_logs`: Local telemetry and mutation history.

---

## 6. Synchronization Protocol & Conflict Resolution

### Mutation Schema
Every client mutation includes:
- `operationId`: UUIDv4
- `deviceId`: Terminal identifier (e.g., `dev-alpha-01`)
- `userId`: Operator ID
- `entityType`: `task` | `checklist`
- `entityId`: Target record ID
- `operationType`: `create` | `update` | `delete`
- `baseVersion`: Version of the entity when the edit began
- `changedFields`: List of modified keys (e.g. `["status", "quantity"]`)
- `payload`: Updated field key-value pairs
- `createdAt`: ISO 8601 timestamp

### Server Evaluation Logic
```
If baseVersion === serverVersion:
  -> Apply mutation, increment version (version + 1), return SUCCESS.

If baseVersion !== serverVersion:
  -> Inspect changedFields against server modifications since baseVersion:
     - Different fields modified? -> AUTOMATIC MERGE (advance version, return SUCCESS).
     - Same field modified to same value? -> NO CONFLICT (return SUCCESS).
     - Same field modified to different value? -> CONFLICT DETECTED (stage conflict, return CONFLICT).
     - Delete vs Edit? -> CONFLICT DETECTED (return CONFLICT).
```

### Resolution Options
1. **Keep Server**: Discards local offline edits and keeps server state.
2. **Keep Local**: Overwrites server record with offline edits and bumps version.
3. **Merge**: Operator interactively selects values field-by-field.

---

## 7. Demo Credentials & Test Devices

| Role | Username | Password | Default Device ID | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | `admin` | `admin123` | `dev-hq-desk` | Sarah Connor (Operations Lead) |
| **Technician 1** | `tech1` | `tech123` | `dev-alpha-01` | Marcus Vance (Senior Field Tech) |
| **Technician 2** | `tech2` | `tech123` | `dev-beta-02` | Elena Rostova (HVAC Specialist) |

---

## 8. The Official Demo Scenario (Step-by-Step)

The system includes a dedicated **Demo Lab** (accessible via the top navigation or sidebar) that executes the exact hackathon test case:

1. **Baseline**: Task `tsk-7701` ("CNC Milling Unit #4") starts at **version 7** (`status: IN_PROGRESS`, `quantity: 40`).
2. **Device A Offline**: Marcus disconnects and changes `status = COMPLETED`, `quantity = 50`. Mutation is queued with `baseVersion: 7`.
3. **Device B Offline**: Elena disconnects and changes `status = IN_PROGRESS`, `quantity = 45`. Mutation is queued with `baseVersion: 7`.
4. **Device A Reconnects**: Syncs with backend. Server accepts mutation and advances to **version 8**.
5. **Device B Reconnects**: Syncs with `baseVersion: 7`. Server detects version mismatch and value collisions on `status` and `quantity`.
6. **Conflict Flagged**: The server rejects silent overwrite and creates an unresolved conflict.
7. **Resolution**: Operator opens **Conflict Center**, views side-by-side diff, selects resolution (e.g. Merge: `status: COMPLETED`, `quantity: 48`), and commits the final unified state at **version 9**.

---

## 9. Setup & Local Development

### Prerequisites
- Node.js (v18 or higher; v24 recommended)
- npm (v9 or higher)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/syncguard.git
cd syncguard

# 1. Setup Backend
cd server
npm install

# 2. Setup Frontend
cd ../client
npm install
```

### Environment Variables (`server/.env`)
Create a `.env` file in `server/` (optional; defaults work automatically with embedded SQLite):
```env
PORT=5000
JWT_SECRET=syncguard_super_secret_jwt_key_2026
# Optional PostgreSQL connection (if omitted, embedded SQLite is used)
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/syncguard
```

### Starting the Applications
```bash
# Terminal 1 - Backend Server
cd server
npm start
# -> API running on http://localhost:5000

# Terminal 2 - Frontend Client
cd client
npm run dev
# -> PWA running on http://localhost:5173
```

---

## 10. Automated Testing

Run the automated verification suite from the project root:
```bash
cd server
npm test
```
All 7 unit and integration tests verify:
- Deep value equality detection
- Clean optimistic concurrency version bumps
- Deterministic conflict detection for conflicting values
- Automatic merging of non-overlapping fields
- Delete vs edit collision handling
- Idempotent retransmission handling
- Full end-to-end multi-device conflict resolution

---

## 11. Deployment

### Backend (Node.js / Express)
Deploy to Render, Railway, Fly.io, or AWS ECS with a PostgreSQL database instance:
```bash
export DATABASE_URL=postgresql://user:pass@host:5432/syncguard
npm start
```

### Frontend (Static PWA)
Build the optimized static bundle:
```bash
cd client
npm run build
```
Deploy the `client/dist` folder to Vercel, Netlify, or Firebase Hosting.

---

## 12. Limitations & Future Improvements

- **Current Limitations**: Checklists currently resolve at the item level; deep nested document branching is flattened to relational tables.
- **Future Improvements**:
  - WebRTC mesh synchronization for peer-to-peer device syncing in environments with zero central connectivity.
  - Image/binary attachment chunking in IndexedDB for photo inspection reports.
  - Granular cellular data consumption throttling for 2G/EDGE satellite links.

---

## 13. AI Assistance Disclosure
In accordance with ALGOTHON’26 guidelines:
- Architectural design, conflict algorithms, database schemas, and implementation were assisted by Google Deepmind Antigravity.
- All synchronization logic, conflict resolution algorithms, idempotency tests, and edge case assertions were verified and tested by the engineering team.
