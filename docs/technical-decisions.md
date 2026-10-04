# SyncGuard — Technical Decisions & Architecture Rationale

## 1. Concurrency Model: Versioned OCC vs. CRDTs vs. Operational Transformation

### The Trade-off
- **CRDTs (Conflict-free Replicated Data Types)** work exceptionally well for unstructured collaborative text documents (like Google Docs or Figma canvas vectors), where operations can commute mathematically.
- However, in industrial maintenance, maintenance tasks have **strict operational and regulatory invariants**:
  - A work order cannot be both "IN_PROGRESS" and "COMPLETED".
  - A calibrated torque setting or fluid quantity cannot be mathematically averaged without human verification.
  - Deleting an asset ticket while another technician records a dangerous safety flaw requires human judgment.

### Decision
We implemented **Versioned Optimistic Concurrency Control (OCC) with Field-Level Semantic Auto-Merging**:
- Non-overlapping field edits are merged automatically.
- Colliding semantic values are preserved in a first-class `conflicts` repository.
- Human technicians and operations leads are empowered with clear, side-by-side adjudication controls.

---

## 2. Local Storage: Dexie.js vs. Raw IndexedDB vs. LocalStorage

### Decision
We chose **Dexie.js over raw IndexedDB**:
- Raw `indexedDB` APIs are callback-heavy, prone to unhandled schema upgrade deadlocks, and lack high-performance compound indexing.
- `localStorage` is synchronous, blocks the main browser thread, and is restricted to 5MB, making it unsuitable for offline field applications caching hundreds of work orders and snapshot histories.
- Dexie provides clean Promise-based transactions, compound indices (`entityType, entityId`), and rock-solid cross-tab stability.

---

## 3. Database Layer: Dual PostgreSQL + SQLite Engine

### Decision
- **PostgreSQL** is the target enterprise production database, fully supported via connection pooling (`pg.Pool`), parameterized queries (`$1, $2`), and relational integrity constraints.
- To ensure zero hurdles during hackathon judging, CI/CD, and local developer evaluations, we implemented a zero-config embedded SQLite fallback (`better-sqlite3`).
- If `DATABASE_URL` is configured in the environment, the server automatically connects to PostgreSQL; otherwise, it boots the embedded database with the exact same schema, queries, and constraints.

---

## 4. In-App Device Simulation & Offline Controls

### Decision
Field evaluations and hackathon presentations rarely provide multiple physical laptops or Faraday cages to test offline behavior.
- We built a native **In-App Device & Network Switcher**:
  - Toggle "Simulate Offline Mode" to disconnect network requests at the application boundary without breaking browser devtools.
  - Switch active terminal identity (`dev-alpha-01`, `dev-beta-02`, `dev-hq-desk`) with a single click to simulate two physical technicians modifying records simultaneously.
  - Built-in "Interactive Demo Lab" to guide judges through the official conflict scenario step-by-step.
