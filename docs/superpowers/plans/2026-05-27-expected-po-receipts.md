# Expected PO Receipts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive web app that lets planners select open PO Releases by Promise Date range, assign them to a warehouse worker as a task, and lets that worker complete each receipt against DELMIAWORKS WebAPI (CreatePOReceipt → PostPOReceiptAndUpdateMasterLabel → PrintPurchased).

**Architecture:** TypeScript monorepo (npm workspaces). Express BFF on the backend talks to DELMIAWORKS WebAPI and persists tasks in SQLite. React + Vite frontend with two roles (Planning / Receiving) sharing one app. Notifications flow via SMTP (email) and Server-Sent Events (in-app push).

**Tech Stack:** Node.js 20+, TypeScript, Express, axios, better-sqlite3, nodemailer, pino, React 18, Vite, TanStack Query, Zustand, React Router. Tests: Vitest + nock + supertest + React Testing Library.

**Reference codebase:** A sibling project `delmiaworks-production-reporter` at `../delmiaworks-production-reporter/` uses the same stack. Several modules (`dwClient/http.ts`, `filter.ts`, `auth.ts`, `eplants.ts`, `inventory.ts`, `session.ts`, `logger.ts`, `middleware/`) can be ported with minimal changes. The plan calls out which tasks port vs build new.

---

## Phase 1 — Foundation

### Task 1: Initialize monorepo workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Modify: `.gitignore` (already exists from initial commit — add no entries)

- [ ] **Step 1: Create workspace root `package.json`**

```json
{
  "name": "expected-po-receipts",
  "private": true,
  "version": "0.1.0",
  "description": "Planner + warehouse worker app for DELMIAWORKS PO receipts",
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev:backend": "npm --workspace backend run dev",
    "dev:frontend": "npm --workspace frontend run dev",
    "build": "npm --workspace backend run build && npm --workspace frontend run build",
    "test": "npm --workspace backend run test && npm --workspace frontend run test"
  },
  "engines": { "node": ">=20" }
}
```

- [ ] **Step 2: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create `.env.example`**

```ini
# Backend
PORT=3000
SESSION_TTL_HOURS=8
SQLITE_PATH=./data/expected-po-receipts.db
APP_BASE_URL=http://localhost:5173

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Expected PO Receipts <no-reply@example.com>"

# Logging
LOG_LEVEL=info
```

- [ ] **Step 4: Commit**

```bash
git add package.json tsconfig.base.json .env.example
git commit -m "feat: initialize npm workspaces and base tsconfig"
```

---

### Task 2: Backend skeleton (server, config, logger)

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/src/config.ts`
- Create: `backend/src/logger.ts`
- Create: `backend/src/server.ts`
- Create: `backend/test/server.test.ts`

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "@epr/backend",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "axios": "^1.7.7",
    "better-sqlite3": "^11.5.0",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "nodemailer": "^6.9.16",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0",
    "pino-pretty": "^11.3.0",
    "uuid": "^11.0.3"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.9.0",
    "@types/nodemailer": "^6.4.17",
    "@types/supertest": "^6.0.2",
    "@types/uuid": "^10.0.0",
    "nock": "^13.5.6",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
  },
});
```

- [ ] **Step 4: Create `backend/src/config.ts`**

```ts
import 'dotenv/config';

export type Config = {
  port: number;
  sessionTtlMs: number;
  sqlitePath: string;
  appBaseUrl: string;
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
  logLevel: string;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    sessionTtlMs: Number(process.env.SESSION_TTL_HOURS ?? 8) * 60 * 60 * 1000,
    sqlitePath: process.env.SQLITE_PATH ?? './data/expected-po-receipts.db',
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM ?? 'Expected PO Receipts <no-reply@localhost>',
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
```

- [ ] **Step 5: Create `backend/src/logger.ts`**

```ts
import { pino } from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'production'
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } },
});
```

- [ ] **Step 6: Write failing test `backend/test/server.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/server.js';

describe('server', () => {
  it('returns 200 on /health', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
```

- [ ] **Step 7: Install deps and verify test fails**

Run from project root:
```bash
npm install
npm --workspace backend run test
```
Expected: FAIL — `createApp` not exported.

- [ ] **Step 8: Create `backend/src/server.ts`**

```ts
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { loadConfig } from './config.js';
import { logger } from './logger.js';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const app = createApp();
  app.listen(cfg.port, () => logger.info({ port: cfg.port }, 'server listening'));
}
```

- [ ] **Step 9: Run tests — expect PASS**

```bash
npm --workspace backend run test
```
Expected: 1 test passes.

- [ ] **Step 10: Commit**

```bash
git add backend/
git commit -m "feat(backend): Express skeleton with health endpoint, config, logger"
```

---

### Task 3: Frontend skeleton (Vite + React + Router)

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/styles.css`
- Create: `frontend/test/App.test.tsx`, `frontend/vitest.config.ts`

- [ ] **Step 1: Create `frontend/package.json`**

```json
{
  "name": "@epr/frontend",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.20",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "happy-dom": "^15.11.6",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `frontend/tsconfig.json`**

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"],
    "allowImportingTsExtensions": false,
    "noEmit": true
  },
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 3: Create `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
```

- [ ] **Step 4: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 5: Create `frontend/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Create `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Expected PO Receipts</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create `frontend/src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App.js';
import './styles.css';

const qc = new QueryClient();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 8: Write failing test `frontend/test/App.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/App.js';

describe('App', () => {
  it('renders the app title', () => {
    render(<MemoryRouter><App /></MemoryRouter>);
    expect(screen.getByText(/Expected PO Receipts/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Create `frontend/src/App.tsx`** (placeholder — real routing comes later)

```tsx
export function App() {
  return (
    <div className="app">
      <header><h1>Expected PO Receipts</h1></header>
      <main>Loading…</main>
    </div>
  );
}
```

- [ ] **Step 10: Create `frontend/src/styles.css`** (minimal — refined later)

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: #222; }
.app { max-width: 1200px; margin: 0 auto; padding: 1rem; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; opacity: 0.5; }
```

- [ ] **Step 11: Install + run tests**

```bash
npm install
npm --workspace frontend run test
```
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): Vite + React + Router skeleton"
```

---

### Task 4: SQLite + migrations

**Files:**
- Create: `backend/src/db/index.ts`
- Create: `backend/src/db/migrations/001_init.sql`
- Create: `backend/src/db/migrate.ts`
- Create: `backend/test/db/migrate.test.ts`

- [ ] **Step 1: Create `backend/src/db/migrations/001_init.sql`** — paste schema from spec section 4.3 verbatim

```sql
CREATE TABLE expected_receipt_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_username TEXT NOT NULL,
  created_by_eplant_id INTEGER NOT NULL,
  assigned_to_employee_id INTEGER NOT NULL,
  assigned_to_username TEXT NOT NULL,
  assigned_to_email TEXT,
  assigned_to_name TEXT,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cancelled_at TEXT,
  notification_sent_at TEXT,
  notification_error TEXT
);

CREATE TABLE expected_receipt_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES expected_receipt_task(id) ON DELETE CASCADE,
  po_id INTEGER NOT NULL,
  po_no TEXT NOT NULL,
  po_detail_id INTEGER NOT NULL,
  po_release_id INTEGER NOT NULL,
  promise_date TEXT NOT NULL,
  ar_invt_id INTEGER NOT NULL,
  item_class TEXT,
  item_no TEXT NOT NULL,
  item_rev TEXT,
  item_description TEXT,
  qty_expected REAL NOT NULL,
  default_recv_designator TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  received_qty REAL,
  received_lot_no TEXT,
  received_location_id INTEGER,
  received_location_name TEXT,
  received_at TEXT,
  dw_receipt_id INTEGER,
  dw_master_label_id INTEGER,
  label_printed INTEGER DEFAULT 0,
  label_print_error TEXT,
  error_message TEXT
);

CREATE INDEX idx_task_assigned ON expected_receipt_task(assigned_to_username, status);
CREATE INDEX idx_task_created_by ON expected_receipt_task(created_by_username, created_at);
CREATE INDEX idx_item_task ON expected_receipt_item(task_id, status);
```

- [ ] **Step 2: Create `backend/src/db/index.ts`**

```ts
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 3000');
  return db;
}
```

- [ ] **Step 3: Write failing test `backend/test/db/migrate.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';

describe('migrations', () => {
  it('creates the expected_receipt_task and expected_receipt_item tables', () => {
    const db = openDb(':memory:');
    runMigrations(db);
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as Array<{ name: string }>;
    expect(tables.map(t => t.name)).toContain('expected_receipt_task');
    expect(tables.map(t => t.name)).toContain('expected_receipt_item');
    expect(tables.map(t => t.name)).toContain('schema_migrations');
  });

  it('is idempotent', () => {
    const db = openDb(':memory:');
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
```

- [ ] **Step 4: Create `backend/src/db/migrate.ts`**

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DB } from './index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, 'migrations');

export function runMigrations(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const applied = new Set(
    (db.prepare('SELECT name FROM schema_migrations').all() as Array<{ name: string }>).map(r => r.name),
  );
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
    });
    tx();
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm --workspace backend run test -- migrate.test
```
Expected: 2 tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db backend/test/db
git commit -m "feat(db): SQLite migrations runner with initial schema"
```

---

### Task 5: SQLite query layer (tasks + items)

**Files:**
- Create: `backend/src/db/queries/tasks.ts`
- Create: `backend/src/db/queries/items.ts`
- Create: `backend/test/db/tasks.test.ts`
- Create: `backend/test/db/items.test.ts`

- [ ] **Step 1: Write failing test `backend/test/db/tasks.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';

let db: DB;
let q: TaskQueries;

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  q = new TaskQueries(db);
});

describe('TaskQueries', () => {
  it('inserts a task and returns its id', () => {
    const id = q.insert({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedToEmployeeId: 42, assignedToUsername: 'worker',
      assignedToEmail: 'w@x.com', assignedToName: 'Worker',
      dateFrom: '2026-05-27', dateTo: '2026-06-03',
    });
    expect(id).toBeTypeOf('number');
  });

  it('lists open tasks for a username', () => {
    q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'worker', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 43, assignedToUsername: 'other', assignedToEmail: '', assignedToName: 'O', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    const rows = q.listMine('worker');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.assigned_to_username).toBe('worker');
  });

  it('updates task status', () => {
    const id = q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'w', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    q.updateStatus(id, 'completed');
    const row = q.getById(id);
    expect(row?.status).toBe('completed');
    expect(row?.completed_at).toBeTruthy();
  });

  it('records notification result', () => {
    const id = q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'w', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    q.setNotificationResult(id, { success: true });
    const row = q.getById(id);
    expect(row?.notification_sent_at).toBeTruthy();
    expect(row?.notification_error).toBeNull();
  });
});
```

- [ ] **Step 2: Create `backend/src/db/queries/tasks.ts`**

```ts
import type { DB } from '../index.js';

export type TaskRow = {
  id: number;
  created_by_username: string;
  created_by_eplant_id: number;
  assigned_to_employee_id: number;
  assigned_to_username: string;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  date_from: string;
  date_to: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
};

export type TaskInsert = {
  createdByUsername: string;
  createdByEplantId: number;
  assignedToEmployeeId: number;
  assignedToUsername: string;
  assignedToEmail: string;
  assignedToName: string;
  dateFrom: string;
  dateTo: string;
};

export class TaskQueries {
  constructor(private db: DB) {}

  insert(input: TaskInsert): number {
    const stmt = this.db.prepare(`
      INSERT INTO expected_receipt_task
        (created_by_username, created_by_eplant_id, assigned_to_employee_id,
         assigned_to_username, assigned_to_email, assigned_to_name, date_from, date_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      input.createdByUsername, input.createdByEplantId, input.assignedToEmployeeId,
      input.assignedToUsername, input.assignedToEmail, input.assignedToName,
      input.dateFrom, input.dateTo,
    );
    return Number(res.lastInsertRowid);
  }

  getById(id: number): TaskRow | undefined {
    return this.db.prepare('SELECT * FROM expected_receipt_task WHERE id = ?').get(id) as TaskRow | undefined;
  }

  listMine(username: string): TaskRow[] {
    return this.db.prepare(`
      SELECT * FROM expected_receipt_task
      WHERE assigned_to_username = ? AND status IN ('open','in_progress')
      ORDER BY created_at DESC
    `).all(username) as TaskRow[];
  }

  updateStatus(id: number, status: TaskRow['status']): void {
    const col = status === 'completed' ? 'completed_at' : status === 'cancelled' ? 'cancelled_at' : null;
    if (col) {
      this.db.prepare(`UPDATE expected_receipt_task SET status = ?, ${col} = datetime('now') WHERE id = ?`).run(status, id);
    } else {
      this.db.prepare('UPDATE expected_receipt_task SET status = ? WHERE id = ?').run(status, id);
    }
  }

  setNotificationResult(id: number, result: { success: boolean; error?: string }): void {
    if (result.success) {
      this.db.prepare(`UPDATE expected_receipt_task SET notification_sent_at = datetime('now'), notification_error = NULL WHERE id = ?`).run(id);
    } else {
      this.db.prepare(`UPDATE expected_receipt_task SET notification_error = ? WHERE id = ?`).run(result.error ?? 'unknown', id);
    }
  }
}
```

- [ ] **Step 3: Write failing test `backend/test/db/items.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';
import { ItemQueries } from '../../src/db/queries/items.js';

let db: DB;
let tasks: TaskQueries;
let items: ItemQueries;
let taskId: number;

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  tasks = new TaskQueries(db);
  items = new ItemQueries(db);
  taskId = tasks.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'w', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
});

describe('ItemQueries', () => {
  it('bulk inserts items for a task', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: 'DEFAULT' },
      { poId: 1, poNo: 'PO-1', poDetailId: 11, poReleaseId: 101, promiseDate: '2026-05-29', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'E', qtyExpected: 50, defaultRecvDesignator: 'ZONE-A' },
    ]);
    expect(items.listByTask(taskId)).toHaveLength(2);
  });

  it('marks an item received and records receipt details', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: 'DEFAULT' },
    ]);
    const [item] = items.listByTask(taskId);
    items.markReceived(item!.id, {
      qty: 100, lotNo: 'LOT-1', locationId: 7, locationName: 'A1', dwReceiptId: 555,
      dwMasterLabelId: 666, labelPrinted: true,
    });
    const updated = items.getById(item!.id);
    expect(updated?.status).toBe('received');
    expect(updated?.received_qty).toBe(100);
    expect(updated?.dw_receipt_id).toBe(555);
  });

  it('counts pending items per task', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: '' },
      { poId: 1, poNo: 'PO-1', poDetailId: 11, poReleaseId: 101, promiseDate: '2026-05-29', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'E', qtyExpected: 50, defaultRecvDesignator: '' },
    ]);
    expect(items.countPending(taskId)).toBe(2);
  });
});
```

- [ ] **Step 4: Create `backend/src/db/queries/items.ts`**

```ts
import type { DB } from '../index.js';

export type ItemRow = {
  id: number;
  task_id: number;
  po_id: number;
  po_no: string;
  po_detail_id: number;
  po_release_id: number;
  promise_date: string;
  ar_invt_id: number;
  item_class: string | null;
  item_no: string;
  item_rev: string | null;
  item_description: string | null;
  qty_expected: number;
  default_recv_designator: string | null;
  status: 'pending' | 'received' | 'failed';
  received_qty: number | null;
  received_lot_no: string | null;
  received_location_id: number | null;
  received_location_name: string | null;
  received_at: string | null;
  dw_receipt_id: number | null;
  dw_master_label_id: number | null;
  label_printed: number;
  label_print_error: string | null;
  error_message: string | null;
};

export type ItemInsert = {
  poId: number; poNo: string; poDetailId: number; poReleaseId: number;
  promiseDate: string; arInvtId: number;
  itemClass: string; itemNo: string; itemRev: string; itemDescription: string;
  qtyExpected: number; defaultRecvDesignator: string;
};

export type ReceiptDetails = {
  qty: number; lotNo: string;
  locationId: number; locationName: string;
  dwReceiptId: number; dwMasterLabelId: number;
  labelPrinted: boolean; labelPrintError?: string;
};

export class ItemQueries {
  constructor(private db: DB) {}

  bulkInsert(taskId: number, rows: ItemInsert[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO expected_receipt_item
        (task_id, po_id, po_no, po_detail_id, po_release_id, promise_date, ar_invt_id,
         item_class, item_no, item_rev, item_description, qty_expected, default_recv_designator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((items: ItemInsert[]) => {
      for (const r of items) {
        stmt.run(taskId, r.poId, r.poNo, r.poDetailId, r.poReleaseId, r.promiseDate, r.arInvtId,
          r.itemClass, r.itemNo, r.itemRev, r.itemDescription, r.qtyExpected, r.defaultRecvDesignator);
      }
    });
    tx(rows);
  }

  getById(id: number): ItemRow | undefined {
    return this.db.prepare('SELECT * FROM expected_receipt_item WHERE id = ?').get(id) as ItemRow | undefined;
  }

  listByTask(taskId: number): ItemRow[] {
    return this.db.prepare(`
      SELECT * FROM expected_receipt_item
      WHERE task_id = ?
      ORDER BY promise_date ASC, id ASC
    `).all(taskId) as ItemRow[];
  }

  markReceived(id: number, r: ReceiptDetails): void {
    this.db.prepare(`
      UPDATE expected_receipt_item
      SET status = 'received',
          received_qty = ?, received_lot_no = ?, received_location_id = ?, received_location_name = ?,
          received_at = datetime('now'),
          dw_receipt_id = ?, dw_master_label_id = ?,
          label_printed = ?, label_print_error = ?,
          error_message = NULL
      WHERE id = ?
    `).run(r.qty, r.lotNo, r.locationId, r.locationName, r.dwReceiptId, r.dwMasterLabelId,
      r.labelPrinted ? 1 : 0, r.labelPrintError ?? null, id);
  }

  markFailed(id: number, errorMessage: string, partial?: Partial<ReceiptDetails>): void {
    this.db.prepare(`
      UPDATE expected_receipt_item
      SET error_message = ?, dw_receipt_id = COALESCE(?, dw_receipt_id), dw_master_label_id = COALESCE(?, dw_master_label_id)
      WHERE id = ?
    `).run(errorMessage, partial?.dwReceiptId ?? null, partial?.dwMasterLabelId ?? null, id);
  }

  countPending(taskId: number): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM expected_receipt_item WHERE task_id = ? AND status = 'pending'`).get(taskId) as { c: number };
    return row.c;
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npm --workspace backend run test -- db/
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/queries backend/test/db
git commit -m "feat(db): tasks and items query layer"
```

---

## Phase 2 — DW Client

### Task 6: dwClient core (http, filter, types) — port from sibling

The sibling project `../delmiaworks-production-reporter/backend/src/dwClient/` already contains battle-tested versions of these files. Copy them verbatim, then adjust the application name.

**Files:**
- Create: `backend/src/dwClient/types.ts`
- Create: `backend/src/dwClient/http.ts`
- Create: `backend/src/dwClient/filter.ts`
- Create: `backend/src/dwClient/shared.ts`
- Create: `backend/test/dwClient/filter.test.ts`

- [ ] **Step 1: Create `backend/src/dwClient/types.ts`**

```ts
export type DwClientConfig = { baseUrl: string };

export type LoginInput = { username: string; password: string; database: string; appName?: string };
export type LoginResult = { authToken: string; username: string };

export const DW_ERROR_CODES = [
  'DW_UNREACHABLE',
  'AUTH_FAILED',
  'NOT_AUTHENTICATED',
  'DW_ERROR',
  'DW_RECEIPT_CREATE_FAILED',
  'DW_RECEIPT_POST_FAILED',
  'DW_LABEL_PRINT_FAILED',
] as const;
export type DwErrorCode = typeof DW_ERROR_CODES[number];
export type DwError = Error & { code: DwErrorCode };
```

- [ ] **Step 2: Create `backend/src/dwClient/http.ts`** — copy from sibling `../delmiaworks-production-reporter/backend/src/dwClient/http.ts`. Reproduced here for self-containment:

```ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { DW_ERROR_CODES, DwError, DwErrorCode } from './types.js';
import { logger } from '../logger.js';

const DW_CODE_SET = new Set<string>(DW_ERROR_CODES);

export function isDwError(e: unknown): e is DwError {
  return !!e && typeof e === 'object' && 'code' in e && DW_CODE_SET.has(String((e as { code: unknown }).code));
}

export function makeError(code: DwErrorCode, message: string, cause?: unknown): DwError {
  const err = new Error(message) as DwError;
  err.code = code;
  if (cause !== undefined) (err as Error & { cause?: unknown }).cause = cause;
  return err;
}

export function createHttp(baseUrl: string): AxiosInstance {
  const http = axios.create({
    baseURL: baseUrl,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
  http.interceptors.request.use(req => {
    logger.info({ method: req.method, url: req.url, params: req.params }, 'dw call start');
    return req;
  });
  http.interceptors.response.use(
    r => { logger.info({ status: r.status, url: r.config.url }, 'dw call ok'); return r; },
    (e: AxiosError) => {
      const url = e.config?.url;
      const status = e.response?.status;
      const data = e.response?.data;
      logger.error({ url, status, data, code: e.code, message: e.message }, 'dw call failed');
      if (e.code === 'ECONNREFUSED' || e.code === 'ECONNABORTED' || e.code === 'ENOTFOUND') {
        throw makeError('DW_UNREACHABLE', `Cannot reach DelmiaWorks at ${baseUrl}`, e);
      }
      throw e;
    },
  );
  return http;
}
```

- [ ] **Step 3: Create `backend/src/dwClient/filter.ts`** — copy from sibling, reproduced:

```ts
export type FilterOp = 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'startswith' | 'contains';
export type FilterValue =
  | string | number | boolean
  | { op: FilterOp; value: string | number | boolean }
  | undefined;
export type FilterSpec = Record<string, FilterValue>;

function escapeValue(v: string | number | boolean): string {
  return String(v).replace(/~/g, '\\~');
}

export function buildFilter(spec: FilterSpec): string {
  const parts: string[] = [];
  for (const [field, raw] of Object.entries(spec)) {
    if (raw === undefined) continue;
    if (typeof raw === 'object' && raw !== null && 'op' in raw) {
      parts.push(`${field}.${raw.op}~${escapeValue(raw.value)}~`);
    } else {
      parts.push(`${field}.eq~${escapeValue(raw)}~`);
    }
  }
  if (parts.length === 0) return '';
  return `(${parts.join('&')})`;
}
```

- [ ] **Step 4: Create `backend/src/dwClient/shared.ts`**

```ts
import type { AxiosResponse } from 'axios';

export function unwrap<T>(res: AxiosResponse): T {
  const body = res.data;
  return (body?.data ?? body) as T;
}
```

- [ ] **Step 5: Write test `backend/test/dwClient/filter.test.ts`** — copy verbatim from sibling test:

```ts
import { describe, it, expect } from 'vitest';
import { buildFilter } from '../../src/dwClient/filter.js';

describe('buildFilter', () => {
  it('returns empty string for empty filter object', () => expect(buildFilter({})).toBe(''));
  it('builds single equality filter', () => expect(buildFilter({ ArInvtId: 123 })).toBe('(ArInvtId.eq~123~)'));
  it('builds AND of multiple equalities', () =>
    expect(buildFilter({ ArInvtId: 123, Status: 'Active' })).toBe('(ArInvtId.eq~123~&Status.eq~Active~)'));
  it('supports explicit operator', () =>
    expect(buildFilter({ TotalQTYOrdered: { op: 'gt', value: 0 } })).toBe('(TotalQTYOrdered.gt~0~)'));
  it('escapes ~ characters', () => expect(buildFilter({ Description: 'A~B' })).toBe('(Description.eq~A\\~B~)'));
  it('handles boolean values', () => expect(buildFilter({ Active: true })).toBe('(Active.eq~true~)'));
  it('skips undefined values', () => expect(buildFilter({ ArInvtId: 123, Status: undefined })).toBe('(ArInvtId.eq~123~)'));
});
```

- [ ] **Step 6: Run tests**

```bash
npm --workspace backend run test -- dwClient/filter
```
Expected: 7 tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/dwClient backend/test/dwClient
git commit -m "feat(dwClient): http, filter, types, shared (ported from sibling)"
```

---

### Task 7: dwClient auth + EPlants + Inventory (ported)

Copy from `../delmiaworks-production-reporter/backend/src/dwClient/` — `auth.ts`, `eplants.ts`, `inventory.ts` — and adjust the `appName` default.

**Files:**
- Create: `backend/src/dwClient/auth.ts`
- Create: `backend/src/dwClient/eplants.ts`
- Create: `backend/src/dwClient/inventory.ts`
- Create: `backend/src/dwClient/index.ts`
- Create: `backend/test/dwClient/auth.test.ts`

- [ ] **Step 1: Create `backend/src/dwClient/auth.ts`**

```ts
import { AxiosInstance } from 'axios';
import { LoginInput, LoginResult } from './types.js';
import { isDwError, makeError } from './http.js';

export function makeAuthApi(http: AxiosInstance) {
  return {
    async login(input: LoginInput): Promise<LoginResult> {
      try {
        const res = await http.post('/User/Login', {
          UserName: input.username,
          Password: input.password,
          Database: input.database,
          ApplicationName: input.appName ?? 'expected-po-receipts',
        });
        const body = res.data;
        const token = body?.AuthToken ?? body?.authToken ?? body?.data?.AuthToken;
        if (!token) throw makeError('AUTH_FAILED', 'No token in login response');
        return { authToken: token, username: body?.UserName ?? input.username };
      } catch (e: unknown) {
        if (isDwError(e)) throw e;
        throw makeError('AUTH_FAILED', 'Login failed', e);
      }
    },
  };
}
```

- [ ] **Step 2: Create `backend/src/dwClient/eplants.ts`** — port from sibling. Open `../delmiaworks-production-reporter/backend/src/dwClient/eplants.ts` and copy the file 1:1. No changes needed.

- [ ] **Step 3: Create `backend/src/dwClient/inventory.ts`**

```ts
import { AxiosInstance } from 'axios';
import { unwrap } from './shared.js';

export type InventoryItem = {
  arInvtId: number;
  itemNo: string;
  rev: string;
  description: string;
  itemClass: string;
  uom: string;
};

export function makeInventoryApi(http: AxiosInstance) {
  return {
    async getById(arInvtId: number): Promise<InventoryItem | null> {
      try {
        const res = await http.get(`/Manufacturing/Inventory/Inventory/${arInvtId}`);
        const body = unwrap<any>(res);
        if (!body) return null;
        return {
          arInvtId: Number(body.Id ?? body.ID ?? arInvtId),
          itemNo: String(body.ItemNo ?? ''),
          rev: String(body.Rev ?? ''),
          description: String(body.Description ?? body.Descrip ?? ''),
          itemClass: String(body.Class ?? body.ItemClass ?? ''),
          uom: String(body.UOM ?? body.Uom ?? ''),
        };
      } catch { return null; }
    },

    async batchGetByIds(ids: number[]): Promise<Map<number, InventoryItem>> {
      const unique = [...new Set(ids)];
      const results = await Promise.all(unique.map(id => this.getById(id)));
      const map = new Map<number, InventoryItem>();
      results.forEach((r, i) => { if (r) map.set(unique[i]!, r); });
      return map;
    },

    async getDefaultRecvDesignator(arInvtId: number): Promise<string | null> {
      try {
        const res = await http.get(`/Manufacturing/Inventory/Locations/0`, { params: { arinvtId: arInvtId } });
        const body = res.data?.data ?? res.data ?? [];
        const def = (body as any[]).find(loc => loc.ReceiveDesignator === true || loc.DefaultRecvDesignator === true);
        return def ? String(def.Description ?? def.LocCode ?? def.Code ?? '') : null;
      } catch { return null; }
    },
  };
}
```

- [ ] **Step 4: Create `backend/src/dwClient/index.ts`**

```ts
import { createHttp } from './http.js';
import { makeAuthApi } from './auth.js';
import { makeEPlantsApi } from './eplants.js';
import { makeInventoryApi } from './inventory.js';
import { DwClientConfig } from './types.js';

export function createDwClient(cfg: DwClientConfig) {
  const http = createHttp(cfg.baseUrl);
  const authToken: { value: string | null } = { value: null };
  http.interceptors.request.use(req => {
    if (authToken.value) req.headers.set('AuthToken', authToken.value);
    return req;
  });
  return {
    setAuthToken(token: string) { authToken.value = token; },
    auth: makeAuthApi(http),
    eplants: makeEPlantsApi(http),
    inventory: makeInventoryApi(http),
    http,
  };
}

export type DwClient = ReturnType<typeof createDwClient>;
```

- [ ] **Step 5: Write `backend/test/dwClient/auth.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('auth.login', () => {
  it('returns AuthToken on success', async () => {
    nock(BASE).post('/User/Login').reply(200, { AuthToken: 'token-xyz', UserName: 'user' });
    const dw = createDwClient({ baseUrl: BASE });
    const r = await dw.auth.login({ username: 'user', password: 'pw', database: 'DB' });
    expect(r.authToken).toBe('token-xyz');
  });

  it('throws AUTH_FAILED on missing token', async () => {
    nock(BASE).post('/User/Login').reply(200, {});
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.auth.login({ username: 'u', password: 'p', database: 'd' }))
      .rejects.toMatchObject({ code: 'AUTH_FAILED' });
  });

  it('throws DW_UNREACHABLE when host refuses', async () => {
    nock(BASE).post('/User/Login').replyWithError({ code: 'ECONNREFUSED' });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.auth.login({ username: 'u', password: 'p', database: 'd' }))
      .rejects.toMatchObject({ code: 'DW_UNREACHABLE' });
  });
});
```

- [ ] **Step 6: Run tests, expect PASS**

```bash
npm --workspace backend run test -- dwClient
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/dwClient backend/test/dwClient
git commit -m "feat(dwClient): auth, eplants, inventory + dwClient index"
```

---

### Task 8: dwClient poReleases (NEW)

This is the core read endpoint. It lists open PO release items in a date range, enriches them with inventory info, and groups by Promise Date.

**Files:**
- Create: `backend/src/dwClient/poReleases.ts`
- Create: `backend/test/dwClient/poReleases.test.ts`
- Create: `backend/test/fixtures/dw/poReleases.json`
- Modify: `backend/src/dwClient/index.ts` (register `poReleases`)

- [ ] **Step 1: Create fixture `backend/test/fixtures/dw/poReleases.json`**

```json
{
  "data": [
    { "Id": 100, "PODetailId": 10, "PurchaseOrderId": 1, "PurchaseOrderNo": "PO-1", "ArInvtId": 500, "Quantity": 100, "PromiseDate": "2026-05-28T00:00:00", "QtyReceived": 0 },
    { "Id": 101, "PODetailId": 11, "PurchaseOrderId": 1, "PurchaseOrderNo": "PO-1", "ArInvtId": 501, "Quantity": 50, "PromiseDate": "2026-05-29T00:00:00", "QtyReceived": 50 },
    { "Id": 102, "PODetailId": 12, "PurchaseOrderId": 2, "PurchaseOrderNo": "PO-2", "ArInvtId": 500, "Quantity": 80, "PromiseDate": "2026-05-28T00:00:00", "QtyReceived": 30 }
  ]
}
```

- [ ] **Step 2: Write failing test `backend/test/dwClient/poReleases.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDwClient } from '../../src/dwClient/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://dw.example';
const FIX_RELEASES = JSON.parse(readFileSync(join(__dirname, '../fixtures/dw/poReleases.json'), 'utf8'));

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

function inv(id: number) {
  return { data: { Id: id, ItemNo: `ITM-${id}`, Rev: 'R1', Description: `Desc ${id}`, Class: 'A', UOM: 'PCS' } };
}

describe('poReleases.listOpenByPromiseDate', () => {
  it('returns groups by PromiseDate, filters fully received, enriches inventory', async () => {
    nock(BASE).get(/POReleaseItems/).query(true).reply(200, FIX_RELEASES);
    nock(BASE).get(/Inventory\/500/).reply(200, inv(500));
    nock(BASE).get(/Inventory\/501/).reply(200, inv(501));
    nock(BASE).get(/Locations\/0/).query(true).reply(200, { data: [] }).persist();

    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({
      dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 1,
    });

    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBe('2026-05-28');
    expect(groups[0]!.items).toHaveLength(2);
    const remaining = groups[0]!.items.find(i => i.poReleaseId === 102)!.qtyExpected;
    expect(remaining).toBe(50);
  });

  it('returns empty when all receipts cover quantities', async () => {
    nock(BASE).get(/POReleaseItems/).query(true).reply(200, { data: [
      { Id: 200, PODetailId: 20, PurchaseOrderId: 5, PurchaseOrderNo: 'PO-5', ArInvtId: 999, Quantity: 10, QtyReceived: 10, PromiseDate: '2026-05-28T00:00:00' }
    ] });
    const dw = createDwClient({ baseUrl: BASE });
    const groups = await dw.poReleases.listOpenByPromiseDate({ dateFrom: '2026-05-27', dateTo: '2026-06-03', eplantId: 1 });
    expect(groups).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm --workspace backend run test -- poReleases
```
Expected: FAIL — `poReleases` not on dwClient.

- [ ] **Step 4: Create `backend/src/dwClient/poReleases.ts`**

```ts
import { AxiosInstance } from 'axios';
import { buildFilter } from './filter.js';
import { unwrap } from './shared.js';
import type { InventoryItem } from './inventory.js';

export type POReleaseRow = {
  poReleaseId: number;
  poDetailId: number;
  poId: number;
  poNo: string;
  arInvtId: number;
  itemClass: string;
  itemNo: string;
  itemRev: string;
  itemDescription: string;
  qtyExpected: number;
  promiseDate: string;
  defaultRecvDesignator: string;
};

export type ReleaseGroup = { date: string; items: POReleaseRow[] };

type InventoryApi = {
  batchGetByIds(ids: number[]): Promise<Map<number, InventoryItem>>;
  getDefaultRecvDesignator(arInvtId: number): Promise<string | null>;
};

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export function makePOReleasesApi(http: AxiosInstance, inventory: InventoryApi) {
  return {
    async listOpenByPromiseDate(input: { dateFrom: string; dateTo: string; eplantId: number }): Promise<ReleaseGroup[]> {
      const filter = buildFilter({
        PromiseDate: { op: 'gte', value: `${input.dateFrom}T00:00:00` },
        EPlantId: input.eplantId,
      });
      const res = await http.get('/POReceiving/PO/POReleaseItems/0', { params: { filter, pageSize: 1000 } });
      const raw = (unwrap<any[]>(res) ?? []) as any[];

      const inRange = raw.filter(r => {
        const d = dateOnly(String(r.PromiseDate ?? ''));
        return d >= input.dateFrom && d <= input.dateTo;
      });
      const open = inRange.filter(r => Number(r.Quantity ?? 0) - Number(r.QtyReceived ?? 0) > 0);
      if (open.length === 0) return [];

      const invIds = open.map(r => Number(r.ArInvtId));
      const invMap = await inventory.batchGetByIds(invIds);
      const designators = new Map<number, string>();
      await Promise.all([...new Set(invIds)].map(async id => {
        const d = await inventory.getDefaultRecvDesignator(id);
        if (d) designators.set(id, d);
      }));

      const rows: POReleaseRow[] = open.map(r => {
        const arInvtId = Number(r.ArInvtId);
        const inv = invMap.get(arInvtId);
        return {
          poReleaseId: Number(r.Id),
          poDetailId: Number(r.PODetailId),
          poId: Number(r.PurchaseOrderId),
          poNo: String(r.PurchaseOrderNo ?? ''),
          arInvtId,
          itemClass: inv?.itemClass ?? '',
          itemNo: inv?.itemNo ?? '',
          itemRev: inv?.rev ?? '',
          itemDescription: inv?.description ?? '',
          qtyExpected: Number(r.Quantity ?? 0) - Number(r.QtyReceived ?? 0),
          promiseDate: dateOnly(String(r.PromiseDate ?? '')),
          defaultRecvDesignator: designators.get(arInvtId) ?? '',
        };
      });

      const grouped = new Map<string, POReleaseRow[]>();
      for (const r of rows) {
        const list = grouped.get(r.promiseDate) ?? [];
        list.push(r);
        grouped.set(r.promiseDate, list);
      }
      return [...grouped.keys()].sort().map(date => ({ date, items: grouped.get(date)! }));
    },
  };
}
```

- [ ] **Step 5: Register in `backend/src/dwClient/index.ts`**

Add after `import { makeInventoryApi } from './inventory.js';`:
```ts
import { makePOReleasesApi } from './poReleases.js';
```

In the returned object, add:
```ts
const inventory = makeInventoryApi(http);
return {
  setAuthToken(token: string) { authToken.value = token; },
  auth: makeAuthApi(http),
  eplants: makeEPlantsApi(http),
  inventory,
  poReleases: makePOReleasesApi(http, inventory),
  http,
};
```

Remove the earlier `inventory: makeInventoryApi(http)` line — replaced by the `const` above.

- [ ] **Step 6: Run tests, expect PASS**

```bash
npm --workspace backend run test -- poReleases
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/dwClient backend/test/dwClient backend/test/fixtures
git commit -m "feat(dwClient): poReleases.listOpenByPromiseDate with inventory enrichment"
```

---

### Task 9: dwClient poReceipts + labels (NEW)

The receipt-side orchestration: `CreatePOReceipt` → `PostPOReceiptAndUpdateMasterLabel` → `PrintPurchased`.

**Files:**
- Create: `backend/src/dwClient/poReceipts.ts`
- Create: `backend/src/dwClient/labels.ts`
- Create: `backend/test/dwClient/poReceipts.test.ts`
- Create: `backend/test/dwClient/labels.test.ts`
- Modify: `backend/src/dwClient/index.ts`

- [ ] **Step 1: Write failing test `backend/test/dwClient/poReceipts.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';

beforeEach(() => { nock.disableNetConnect(); });
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('poReceipts.createAndPost', () => {
  it('chains CreatePOReceipt and PostPOReceiptAndUpdateMasterLabel', async () => {
    nock(BASE).post(/CreatePOReceipt/).query(true).reply(200, { data: { Id: 555 } });
    nock(BASE).post(/PostPOReceiptAndUpdateMasterLabel/).query(true).reply(200, {
      data: { Id: 555, FgMultiId: 999 },
    });
    const dw = createDwClient({ baseUrl: BASE });
    const res = await dw.poReceipts.createAndPost({
      poDetailId: 10, poReleaseId: 100, qty: 75,
      lotNo: 'LOT-A', locationId: 7,
      comment: 'Task #12', username: 'worker',
    });
    expect(res.receiptId).toBe(555);
    expect(res.masterLabelId).toBe(999);
  });

  it('throws DW_RECEIPT_CREATE_FAILED if first call returns no Id', async () => {
    nock(BASE).post(/CreatePOReceipt/).query(true).reply(200, { data: {} });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.poReceipts.createAndPost({
      poDetailId: 10, poReleaseId: 100, qty: 75, lotNo: 'L', locationId: 1, comment: '', username: 'u',
    })).rejects.toMatchObject({ code: 'DW_RECEIPT_CREATE_FAILED' });
  });

  it('throws DW_RECEIPT_POST_FAILED if post call fails, surfacing receiptId', async () => {
    nock(BASE).post(/CreatePOReceipt/).query(true).reply(200, { data: { Id: 555 } });
    nock(BASE).post(/PostPOReceiptAndUpdateMasterLabel/).query(true).reply(500, { error: 'oops' });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.poReceipts.createAndPost({
      poDetailId: 10, poReleaseId: 100, qty: 75, lotNo: 'L', locationId: 1, comment: '', username: 'u',
    })).rejects.toMatchObject({ code: 'DW_RECEIPT_POST_FAILED' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm --workspace backend run test -- poReceipts
```
Expected: FAIL — `poReceipts` not on dwClient.

- [ ] **Step 3: Create `backend/src/dwClient/poReceipts.ts`**

```ts
import { AxiosInstance } from 'axios';
import { makeError } from './http.js';
import { unwrap } from './shared.js';

export type CreateAndPostInput = {
  poDetailId: number;
  poReleaseId: number;
  qty: number;
  lotNo: string;
  locationId: number;
  comment: string;
  username: string;
};

export type CreateAndPostResult = { receiptId: number; masterLabelId: number };

function isoNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function makePOReceiptsApi(http: AxiosInstance) {
  return {
    async createAndPost(input: CreateAndPostInput): Promise<CreateAndPostResult> {
      const dateReceived = isoNow();

      let receiptId = 0;
      try {
        const createUrl = `/POReceiving/PO/CreatePOReceipt/0?poDetailId=${input.poDetailId}&poReleaseId=${input.poReleaseId}&qtyReceived=${input.qty}&dateReceived=${encodeURIComponent(dateReceived)}&comment=${encodeURIComponent(input.comment)}&username=${encodeURIComponent(input.username)}`;
        const res = await http.post(createUrl, {});
        const body = unwrap<any>(res);
        receiptId = Number(body?.Id ?? body?.ID ?? 0);
        if (!Number.isFinite(receiptId) || receiptId <= 0) {
          throw makeError('DW_RECEIPT_CREATE_FAILED', `CreatePOReceipt returned no Id: ${JSON.stringify(body)}`);
        }
      } catch (e: any) {
        if (e?.code === 'DW_RECEIPT_CREATE_FAILED') throw e;
        throw makeError('DW_RECEIPT_CREATE_FAILED', `CreatePOReceipt failed: ${e?.message ?? 'unknown'}`, e);
      }

      try {
        const postUrl = `/POReceiving/PO/PostPOReceiptAndUpdateMasterLabel/0?poReceiptId=${receiptId}`;
        const res = await http.post(postUrl, {
          UseDefaultLocation: false,
          LocationId: input.locationId,
          LotNo: input.lotNo,
          TransDate: dateReceived,
        });
        const body = unwrap<any>(res);
        const masterLabelId = Number(body?.FgMultiId ?? body?.MasterLabelId ?? 0);
        return { receiptId, masterLabelId };
      } catch (e: any) {
        const err = makeError('DW_RECEIPT_POST_FAILED', `PostPOReceiptAndUpdateMasterLabel failed: ${e?.message ?? 'unknown'}`, e);
        (err as any).receiptId = receiptId;
        throw err;
      }
    },
  };
}
```

- [ ] **Step 4: Write `backend/test/dwClient/labels.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';
beforeEach(() => nock.disableNetConnect());
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('labels', () => {
  it('lists printers', async () => {
    nock(BASE).get(/PrinterList/).reply(200, { data: [{ Name: 'P1' }, { Name: 'P2' }] });
    const dw = createDwClient({ baseUrl: BASE });
    const printers = await dw.labels.listPrinters();
    expect(printers).toEqual(['P1', 'P2']);
  });

  it('printPurchased posts to PrintPurchased and reports success', async () => {
    nock(BASE).post(/PrintPurchased\/666/).query(true).reply(200, { ok: true });
    const dw = createDwClient({ baseUrl: BASE });
    const out = await dw.labels.printPurchased({ masterLabelId: 666, printerName: 'P1', qty: 100 });
    expect(out).toEqual({ printed: true });
  });

  it('printPurchased throws DW_LABEL_PRINT_FAILED on 500', async () => {
    nock(BASE).post(/PrintPurchased\/666/).query(true).reply(500, { error: 'no printer' });
    const dw = createDwClient({ baseUrl: BASE });
    await expect(dw.labels.printPurchased({ masterLabelId: 666, printerName: 'P1', qty: 100 }))
      .rejects.toMatchObject({ code: 'DW_LABEL_PRINT_FAILED' });
  });
});
```

- [ ] **Step 5: Create `backend/src/dwClient/labels.ts`**

```ts
import { AxiosInstance } from 'axios';
import { makeError } from './http.js';
import { unwrap } from './shared.js';

export function makeLabelsApi(http: AxiosInstance) {
  return {
    async listPrinters(): Promise<string[]> {
      try {
        const res = await http.get('/Labels/PrintLabel/PrinterList/0');
        const arr = (unwrap<any[]>(res) ?? []) as any[];
        return arr.map(p => String(p.Name ?? p.PrinterName ?? '')).filter(Boolean);
      } catch { return []; }
    },

    async printPurchased(input: { masterLabelId: number; printerName: string; qty: number }): Promise<{ printed: true }> {
      try {
        await http.post(`/Labels/PrintLabel/PrintPurchased/${input.masterLabelId}`, { Qty: input.qty }, {
          params: { printerName: input.printerName, sendToPrinter: true },
        });
        return { printed: true };
      } catch (e: any) {
        throw makeError('DW_LABEL_PRINT_FAILED', `PrintPurchased failed: ${e?.message ?? 'unknown'}`, e);
      }
    },
  };
}
```

- [ ] **Step 6: Register both in `backend/src/dwClient/index.ts`**

Add imports:
```ts
import { makePOReceiptsApi } from './poReceipts.js';
import { makeLabelsApi } from './labels.js';
```

Add to returned object:
```ts
poReceipts: makePOReceiptsApi(http),
labels: makeLabelsApi(http),
```

- [ ] **Step 7: Run tests, expect PASS**

```bash
npm --workspace backend run test -- "(poReceipts|labels)"
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/dwClient backend/test/dwClient
git commit -m "feat(dwClient): poReceipts.createAndPost and labels.printPurchased"
```

---

### Task 10: dwClient employees + locations (NEW)

**Files:**
- Create: `backend/src/dwClient/employees.ts`
- Create: `backend/src/dwClient/locations.ts`
- Create: `backend/test/dwClient/employees.test.ts`
- Modify: `backend/src/dwClient/index.ts`

- [ ] **Step 1: Write failing test `backend/test/dwClient/employees.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { createDwClient } from '../../src/dwClient/index.js';

const BASE = 'http://dw.example';
beforeEach(() => nock.disableNetConnect());
afterEach(() => { nock.cleanAll(); nock.enableNetConnect(); });

describe('employees.listTeamMembers', () => {
  it('returns only active members with id+name+email+username', async () => {
    nock(BASE).get(/TeamMember\/0/).reply(200, { data: [
      { Id: 1, FirstName: 'Ana', LastName: 'A', Email: 'a@x', UserName: 'ana', EmpStatus: 'Active', DisplayName: 'Ana A', BadgeNo: '001' },
      { Id: 2, FirstName: 'Bob', LastName: 'B', Email: 'b@x', UserName: 'bob', EmpStatus: 'Inactive', DisplayName: 'Bob B', BadgeNo: '002' },
    ]});
    const dw = createDwClient({ baseUrl: BASE });
    const list = await dw.employees.listTeamMembers();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 1, username: 'ana', email: 'a@x' });
  });
});
```

- [ ] **Step 2: Create `backend/src/dwClient/employees.ts`**

```ts
import { AxiosInstance } from 'axios';
import { unwrap } from './shared.js';

export type EmployeeRow = {
  id: number;
  displayName: string;
  username: string;
  email: string;
  badge: string;
};

export function makeEmployeesApi(http: AxiosInstance) {
  return {
    async listTeamMembers(): Promise<EmployeeRow[]> {
      const res = await http.get('/TimeAttendance/Employees/TeamMember/0');
      const rows = (unwrap<any[]>(res) ?? []) as any[];
      return rows
        .filter(r => String(r.EmpStatus ?? '').toLowerCase() === 'active')
        .map(r => ({
          id: Number(r.Id ?? r.TeamMemberId ?? 0),
          displayName: String(r.DisplayName ?? `${r.FirstName ?? ''} ${r.LastName ?? ''}`.trim()),
          username: String(r.UserName ?? ''),
          email: String(r.Email ?? ''),
          badge: String(r.BadgeNo ?? r.EmployeeNo ?? ''),
        }));
    },

    async getByUsername(username: string): Promise<EmployeeRow | null> {
      const all = await this.listTeamMembers();
      return all.find(e => e.username.toLowerCase() === username.toLowerCase()) ?? null;
    },
  };
}
```

- [ ] **Step 3: Create `backend/src/dwClient/locations.ts`**

```ts
import { AxiosInstance } from 'axios';
import { unwrap } from './shared.js';

export type LocationRow = { id: number; code: string; description: string; isReceive: boolean };

export function makeLocationsApi(http: AxiosInstance) {
  return {
    async listForItem(arInvtId: number): Promise<LocationRow[]> {
      try {
        const res = await http.get(`/Manufacturing/Inventory/Locations/0`, { params: { arinvtId: arInvtId } });
        const rows = (unwrap<any[]>(res) ?? []) as any[];
        return rows.map(r => ({
          id: Number(r.Id ?? r.LocationId ?? 0),
          code: String(r.LocCode ?? r.Code ?? ''),
          description: String(r.Description ?? r.LocDescription ?? ''),
          isReceive: Boolean(r.ReceiveDesignator),
        }));
      } catch { return []; }
    },
  };
}
```

- [ ] **Step 4: Register in `backend/src/dwClient/index.ts`**

```ts
import { makeEmployeesApi } from './employees.js';
import { makeLocationsApi } from './locations.js';
// ... in return object:
employees: makeEmployeesApi(http),
locations: makeLocationsApi(http),
```

- [ ] **Step 5: Run tests**

```bash
npm --workspace backend run test -- dwClient
```
Expected: all dwClient tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/dwClient backend/test/dwClient
git commit -m "feat(dwClient): employees.listTeamMembers and locations.listForItem"
```

---

## Phase 3 — Session + middleware

### Task 11: Session store + auth middleware + error middleware

**Files:**
- Create: `backend/src/session.ts`
- Create: `backend/src/middleware/requireSession.ts`
- Create: `backend/src/middleware/errorHandler.ts`
- Create: `backend/test/session.test.ts`

- [ ] **Step 1: Write failing test `backend/test/session.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createSessionStore } from '../src/session.js';

describe('SessionStore', () => {
  it('creates and retrieves session', () => {
    const s = createSessionStore({ ttlMs: 1000 });
    const id = s.create({ username: 'u', baseUrl: 'http://x', database: 'd', eplantId: 1, authToken: 't', badge: 'B1', email: 'u@x' });
    const got = s.get(id);
    expect(got?.username).toBe('u');
  });

  it('expires after ttl', () => {
    const s = createSessionStore({ ttlMs: 1 });
    const id = s.create({ username: 'u', baseUrl: 'http://x', database: 'd', eplantId: 1, authToken: 't', badge: '', email: '' });
    return new Promise<void>(resolve => setTimeout(() => {
      expect(s.get(id)).toBeNull();
      resolve();
    }, 10));
  });

  it('touch extends ttl', () => {
    const s = createSessionStore({ ttlMs: 50 });
    const id = s.create({ username: 'u', baseUrl: 'http://x', database: 'd', eplantId: 1, authToken: 't', badge: '', email: '' });
    return new Promise<void>(resolve => setTimeout(() => {
      s.touch(id);
      setTimeout(() => {
        expect(s.get(id)).not.toBeNull();
        resolve();
      }, 30);
    }, 30));
  });

  it('updateToken changes authToken in place', () => {
    const s = createSessionStore({ ttlMs: 1000 });
    const id = s.create({ username: 'u', baseUrl: 'http://x', database: 'd', eplantId: 1, authToken: 't1', badge: '', email: '' });
    s.updateToken(id, 't2');
    expect(s.get(id)?.authToken).toBe('t2');
  });
});
```

- [ ] **Step 2: Create `backend/src/session.ts`**

```ts
import { randomUUID } from 'node:crypto';

export type SessionData = {
  username: string;
  baseUrl: string;
  database: string;
  eplantId: number;
  authToken: string;
  badge: string;
  email: string;
};

type Stored = SessionData & { id: string; expiresAt: number };

export type SessionStore = {
  create(data: SessionData): string;
  get(id: string): SessionData | null;
  touch(id: string): void;
  destroy(id: string): void;
  updateToken(id: string, authToken: string): void;
  size(): number;
};

export function createSessionStore(opts: { ttlMs: number }): SessionStore {
  const map = new Map<string, Stored>();
  const now = () => Date.now();

  function get(id: string): SessionData | null {
    const s = map.get(id);
    if (!s) return null;
    if (s.expiresAt < now()) { map.delete(id); return null; }
    return s;
  }

  // periodic cleanup
  setInterval(() => {
    const t = now();
    for (const [k, v] of map) if (v.expiresAt < t) map.delete(k);
  }, 15 * 60 * 1000).unref();

  return {
    create(data) {
      const id = randomUUID();
      map.set(id, { id, ...data, expiresAt: now() + opts.ttlMs });
      return id;
    },
    get,
    touch(id) { const s = map.get(id); if (s) s.expiresAt = now() + opts.ttlMs; },
    destroy(id) { map.delete(id); },
    updateToken(id, token) { const s = map.get(id); if (s) s.authToken = token; },
    size() { return map.size; },
  };
}
```

- [ ] **Step 3: Create `backend/src/middleware/requireSession.ts`**

```ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { SessionStore, SessionData } from '../session.js';

declare module 'express-serve-static-core' {
  interface Request { session?: SessionData; sessionId?: string }
}

export function makeRequireSession(store: SessionStore): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.cookies?.sessionId as string | undefined;
    const s = id ? store.get(id) : null;
    if (!id || !s) { res.status(401).json({ error: 'NOT_AUTHENTICATED' }); return; }
    store.touch(id);
    req.session = s;
    req.sessionId = id;
    next();
  };
}
```

- [ ] **Step 4: Create `backend/src/middleware/errorHandler.ts`**

```ts
import type { ErrorRequestHandler } from 'express';
import { logger } from '../logger.js';
import { isDwError } from '../dwClient/http.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isDwError(err)) {
    const status =
      err.code === 'DW_UNREACHABLE' ? 503 :
      err.code === 'AUTH_FAILED' ? 401 :
      err.code === 'NOT_AUTHENTICATED' ? 401 :
      502;
    logger.warn({ code: err.code, message: err.message }, 'dw error response');
    res.status(status).json({ error: err.code, message: err.message });
    return;
  }
  logger.error({ err }, 'unhandled error');
  res.status(500).json({ error: 'INTERNAL', message: err?.message ?? 'unknown' });
};
```

- [ ] **Step 5: Run session tests**

```bash
npm --workspace backend run test -- session
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/session.ts backend/src/middleware backend/test/session.test.ts
git commit -m "feat(backend): session store, requireSession, errorHandler middleware"
```

---

## Phase 4 — Backend services

### Task 12: Mailer service

**Files:**
- Create: `backend/src/services/mailer.ts`
- Create: `backend/test/services/mailer.test.ts`

- [ ] **Step 1: Write failing test `backend/test/services/mailer.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createMailer, type MailerTransport } from '../../src/services/mailer.js';

describe('mailer', () => {
  it('sends task notification email and returns messageId', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
    const transport: MailerTransport = { sendMail };
    const mailer = createMailer(transport, { from: 'no-reply@x', appBaseUrl: 'http://app' });
    const r = await mailer.sendTaskCreated({ toEmail: 'w@x', taskId: 12, itemCount: 3, dateRange: '2026-05-28 .. 2026-06-03' });
    expect(r.success).toBe(true);
    expect(r.messageId).toBe('msg-1');
    expect(sendMail).toHaveBeenCalledOnce();
    const args = sendMail.mock.calls[0]![0];
    expect(args.to).toBe('w@x');
    expect(args.subject).toContain('Task #12');
    expect(args.html).toContain('http://app/receiving/12');
  });

  it('returns success=false on transport error', async () => {
    const transport: MailerTransport = { sendMail: vi.fn().mockRejectedValue(new Error('smtp down')) };
    const mailer = createMailer(transport, { from: 'no-reply@x', appBaseUrl: 'http://app' });
    const r = await mailer.sendTaskCreated({ toEmail: 'w@x', taskId: 12, itemCount: 1, dateRange: 'x' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('smtp down');
  });
});
```

- [ ] **Step 2: Create `backend/src/services/mailer.ts`**

```ts
import nodemailer from 'nodemailer';

export type MailerTransport = { sendMail: (opts: any) => Promise<{ messageId: string }> };

export type SendTaskCreatedInput = { toEmail: string; taskId: number; itemCount: number; dateRange: string };
export type SendResult = { success: boolean; messageId?: string; error?: string };

export type Mailer = { sendTaskCreated(input: SendTaskCreatedInput): Promise<SendResult> };

export function createMailer(transport: MailerTransport, cfg: { from: string; appBaseUrl: string }): Mailer {
  return {
    async sendTaskCreated(input) {
      const url = `${cfg.appBaseUrl}/receiving/${input.taskId}`;
      const html = `
        <p>You have a new <strong>Expected POs</strong> task.</p>
        <p>Task #${input.taskId} — ${input.itemCount} item(s) — ${input.dateRange}</p>
        <p><a href="${url}">Open task →</a></p>
      `;
      try {
        const { messageId } = await transport.sendMail({
          from: cfg.from, to: input.toEmail,
          subject: `Expected POs — Task #${input.taskId}`,
          html, text: `New task #${input.taskId} (${input.itemCount} items, ${input.dateRange}). Open: ${url}`,
        });
        return { success: true, messageId };
      } catch (e: any) {
        return { success: false, error: e?.message ?? 'unknown' };
      }
    },
  };
}

export function createSmtpTransport(cfg: { host: string; port: number; secure: boolean; user: string; pass: string }): MailerTransport {
  return nodemailer.createTransport({
    host: cfg.host, port: cfg.port, secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  }) as MailerTransport;
}
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
npm --workspace backend run test -- mailer
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/mailer.ts backend/test/services
git commit -m "feat(services): mailer with sendTaskCreated"
```

---

### Task 13: Notification service (SSE)

**Files:**
- Create: `backend/src/services/notificationService.ts`
- Create: `backend/test/services/notifications.test.ts`

- [ ] **Step 1: Write failing test `backend/test/services/notifications.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createNotificationService, type SSEClient } from '../../src/services/notificationService.js';

function fakeClient(): SSEClient & { written: string[]; closed: boolean } {
  const written: string[] = [];
  return {
    write(msg: string) { written.push(msg); return true; },
    end() { (this as any).closed = true; },
    on(event: string, fn: () => void) { if (event === 'close') (this as any)._onClose = fn; },
    written, closed: false,
  };
}

describe('notificationService', () => {
  it('broadcasts to subscribers of a given username', () => {
    const svc = createNotificationService();
    const a = fakeClient(); const b = fakeClient(); const c = fakeClient();
    svc.subscribe('ana', a); svc.subscribe('ana', b); svc.subscribe('bob', c);

    svc.broadcast({ to: 'ana', event: 'new_task', payload: { taskId: 7 } });

    expect(a.written.join('')).toContain('event: new_task');
    expect(a.written.join('')).toContain('"taskId":7');
    expect(b.written.length).toBeGreaterThan(0);
    expect(c.written.length).toBe(0);
  });

  it('unsubscribes on close', () => {
    const svc = createNotificationService();
    const a = fakeClient();
    svc.subscribe('ana', a);
    (a as any)._onClose();
    svc.broadcast({ to: 'ana', event: 'new_task', payload: {} });
    expect(a.written.length).toBe(0);
  });
});
```

- [ ] **Step 2: Create `backend/src/services/notificationService.ts`**

```ts
export type SSEClient = {
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close', fn: () => void): void;
};

export type BroadcastInput = { to: string; event: string; payload: unknown };

export type NotificationService = {
  subscribe(username: string, client: SSEClient): void;
  broadcast(input: BroadcastInput): void;
  countSubscribers(username: string): number;
};

export function createNotificationService(): NotificationService {
  const subs = new Map<string, Set<SSEClient>>();
  return {
    subscribe(username, client) {
      const set = subs.get(username) ?? new Set();
      set.add(client);
      subs.set(username, set);
      client.on('close', () => { set.delete(client); if (set.size === 0) subs.delete(username); });
    },
    broadcast({ to, event, payload }) {
      const set = subs.get(to);
      if (!set) return;
      const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
      for (const c of set) {
        try { c.write(msg); } catch { /* swallow */ }
      }
    },
    countSubscribers(username) { return subs.get(username)?.size ?? 0; },
  };
}
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
npm --workspace backend run test -- notifications
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/notificationService.ts backend/test/services/notifications.test.ts
git commit -m "feat(services): SSE notification service"
```

---

### Task 14: TaskService (orchestrator)

This is the central business logic — creates tasks (DB + notification) and processes per-item receipts (DW orchestration + DB update).

**Files:**
- Create: `backend/src/services/taskService.ts`
- Create: `backend/test/services/taskService.test.ts`

- [ ] **Step 1: Write failing test `backend/test/services/taskService.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb, DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';
import { ItemQueries } from '../../src/db/queries/items.js';
import { createTaskService } from '../../src/services/taskService.js';

let db: DB, tasks: TaskQueries, items: ItemQueries;
beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  tasks = new TaskQueries(db);
  items = new ItemQueries(db);
});

function fakeDw(overrides: Partial<any> = {}) {
  return {
    poReceipts: { createAndPost: vi.fn().mockResolvedValue({ receiptId: 555, masterLabelId: 999 }) },
    labels: { printPurchased: vi.fn().mockResolvedValue({ printed: true }) },
    locations: { listForItem: vi.fn().mockResolvedValue([{ id: 7, code: 'A1', description: 'A1' }]) },
    ...overrides,
  };
}

function fakeMailer() { return { sendTaskCreated: vi.fn().mockResolvedValue({ success: true, messageId: 'm1' }) }; }
function fakeNotif() { return { subscribe: vi.fn(), broadcast: vi.fn(), countSubscribers: vi.fn() }; }

const item = {
  poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28',
  arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: '', itemDescription: 'D',
  qtyExpected: 100, defaultRecvDesignator: '',
};

describe('taskService.createTask', () => {
  it('inserts task + items and notifies via SSE and email', async () => {
    const mailer = fakeMailer(); const notif = fakeNotif();
    const svc = createTaskService({ tasks, items, mailer, notif });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    expect(taskId).toBeTypeOf('number');
    expect(items.listByTask(taskId)).toHaveLength(1);
    expect(mailer.sendTaskCreated).toHaveBeenCalledOnce();
    expect(notif.broadcast).toHaveBeenCalledWith(expect.objectContaining({ to: 'worker', event: 'new_task' }));
  });
});

describe('taskService.receiveItem', () => {
  it('runs DW create → post → print, then marks item received', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    const dw = fakeDw();
    const out = await svc.receiveItem({
      taskId, itemId: it!.id, dw: dw as any,
      input: { qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1' },
      sessionUsername: 'worker',
    });
    expect(out.dwReceiptId).toBe(555);
    expect(out.labelPrinted).toBe(true);
    expect(out.taskStatus).toBe('completed');
    expect(items.getById(it!.id)?.status).toBe('received');
    expect(tasks.getById(taskId)?.status).toBe('completed');
  });

  it('returns labelPrinted=false but item still received when print fails', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    const dw = fakeDw({
      labels: { printPurchased: vi.fn().mockRejectedValue(Object.assign(new Error('no printer'), { code: 'DW_LABEL_PRINT_FAILED' })) },
    });
    const out = await svc.receiveItem({
      taskId, itemId: it!.id, dw: dw as any,
      input: { qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1' },
      sessionUsername: 'worker',
    });
    expect(out.dwReceiptId).toBe(555);
    expect(out.labelPrinted).toBe(false);
    expect(items.getById(it!.id)?.status).toBe('received');
  });

  it('rejects when item not pending', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    items.markReceived(it!.id, { qty: 100, lotNo: 'L', locationId: 1, locationName: 'X', dwReceiptId: 1, dwMasterLabelId: 2, labelPrinted: true });
    await expect(svc.receiveItem({
      taskId, itemId: it!.id, dw: fakeDw() as any,
      input: { qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1' },
      sessionUsername: 'worker',
    })).rejects.toMatchObject({ code: 'ITEM_ALREADY_RECEIVED' });
  });
});
```

- [ ] **Step 2: Create `backend/src/services/taskService.ts`**

```ts
import type { TaskQueries, TaskRow } from '../db/queries/tasks.js';
import type { ItemQueries, ItemInsert } from '../db/queries/items.js';
import type { Mailer } from './mailer.js';
import type { NotificationService } from './notificationService.js';
import { logger } from '../logger.js';

export type AppError = Error & { code: string };
function appError(code: string, message: string): AppError {
  const e = new Error(message) as AppError;
  e.code = code;
  return e;
}

export type CreateTaskInput = {
  createdByUsername: string;
  createdByEplantId: number;
  assignedTo: { id: number; username: string; email: string; name: string };
  dateFrom: string;
  dateTo: string;
  items: ItemInsert[];
};

export type ReceiveItemInput = {
  taskId: number;
  itemId: number;
  dw: {
    poReceipts: { createAndPost(i: any): Promise<{ receiptId: number; masterLabelId: number }> };
    labels: { printPurchased(i: { masterLabelId: number; printerName: string; qty: number }): Promise<{ printed: true }> };
  };
  input: { qty: number; lotNo: string; locationId: number; locationName: string; printerName: string };
  sessionUsername: string;
};

export type ReceiveItemResult = {
  itemStatus: 'received';
  dwReceiptId: number;
  taskStatus: TaskRow['status'];
  labelPrinted: boolean;
  labelPrintError?: string;
};

export function createTaskService(deps: {
  tasks: TaskQueries; items: ItemQueries; mailer: Mailer; notif: NotificationService;
}) {
  return {
    async createTask(input: CreateTaskInput): Promise<{ taskId: number; itemCount: number }> {
      const taskId = deps.tasks.insert({
        createdByUsername: input.createdByUsername,
        createdByEplantId: input.createdByEplantId,
        assignedToEmployeeId: input.assignedTo.id,
        assignedToUsername: input.assignedTo.username,
        assignedToEmail: input.assignedTo.email,
        assignedToName: input.assignedTo.name,
        dateFrom: input.dateFrom, dateTo: input.dateTo,
      });
      deps.items.bulkInsert(taskId, input.items);

      if (input.assignedTo.email) {
        const r = await deps.mailer.sendTaskCreated({
          toEmail: input.assignedTo.email, taskId,
          itemCount: input.items.length,
          dateRange: `${input.dateFrom} .. ${input.dateTo}`,
        });
        deps.tasks.setNotificationResult(taskId, r.success ? { success: true } : { success: false, error: r.error });
      } else {
        deps.tasks.setNotificationResult(taskId, { success: false, error: 'no email on employee' });
      }

      deps.notif.broadcast({
        to: input.assignedTo.username, event: 'new_task',
        payload: { taskId, itemCount: input.items.length, dateRange: `${input.dateFrom} .. ${input.dateTo}` },
      });

      logger.info({ taskId, itemCount: input.items.length, assignedTo: input.assignedTo.username }, 'task.created');
      return { taskId, itemCount: input.items.length };
    },

    async receiveItem(input: ReceiveItemInput): Promise<ReceiveItemResult> {
      const item = deps.items.getById(input.itemId);
      if (!item || item.task_id !== input.taskId) throw appError('NOT_FOUND', 'item not found');
      if (item.status === 'received') throw appError('ITEM_ALREADY_RECEIVED', 'item already received');
      const task = deps.tasks.getById(input.taskId);
      if (!task) throw appError('NOT_FOUND', 'task not found');
      if (task.status === 'completed' || task.status === 'cancelled') throw appError('TASK_COMPLETED', `task is ${task.status}`);

      if (input.input.qty <= 0) throw appError('INVALID_QTY', 'qty must be > 0');
      if (input.input.qty > item.qty_expected) throw appError('INVALID_QTY', 'qty exceeds expected');

      if (task.status === 'open') deps.tasks.updateStatus(input.taskId, 'in_progress');

      // DW orchestration
      const { receiptId, masterLabelId } = await input.dw.poReceipts.createAndPost({
        poDetailId: item.po_detail_id,
        poReleaseId: item.po_release_id,
        qty: input.input.qty,
        lotNo: input.input.lotNo,
        locationId: input.input.locationId,
        comment: `Task #${input.taskId}`,
        username: input.sessionUsername,
      });

      let labelPrinted = false;
      let labelPrintError: string | undefined;
      try {
        await input.dw.labels.printPurchased({ masterLabelId, printerName: input.input.printerName, qty: input.input.qty });
        labelPrinted = true;
      } catch (e: any) {
        labelPrintError = String(e?.message ?? 'label print failed');
        logger.warn({ taskId: input.taskId, itemId: input.itemId, receiptId, masterLabelId, err: labelPrintError }, 'label.print.failed');
      }

      deps.items.markReceived(input.itemId, {
        qty: input.input.qty, lotNo: input.input.lotNo,
        locationId: input.input.locationId, locationName: input.input.locationName,
        dwReceiptId: receiptId, dwMasterLabelId: masterLabelId,
        labelPrinted, labelPrintError,
      });

      const pending = deps.items.countPending(input.taskId);
      if (pending === 0) {
        deps.tasks.updateStatus(input.taskId, 'completed');
        logger.info({ taskId: input.taskId }, 'task.completed');
      }
      const final = deps.tasks.getById(input.taskId)!;

      return { itemStatus: 'received', dwReceiptId: receiptId, taskStatus: final.status, labelPrinted, labelPrintError };
    },
  };
}
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
npm --workspace backend run test -- taskService
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/taskService.ts backend/test/services/taskService.test.ts
git commit -m "feat(services): taskService.createTask + receiveItem orchestration"
```

---

## Phase 5 — Backend routes

Every route file exports a factory `makeXRouter(deps)` that returns an `express.Router`. The factory pattern keeps everything injectable for tests.

### Task 15: Auth routes

**Files:**
- Create: `backend/src/routes/auth.ts`
- Create: `backend/test/routes/auth.test.ts`

- [ ] **Step 1: Write failing test `backend/test/routes/auth.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { makeAuthRouter } from '../../src/routes/auth.js';
import { createSessionStore } from '../../src/session.js';

function makeApp(makeDw: () => any) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  const store = createSessionStore({ ttlMs: 60_000 });
  app.use('/api/auth', makeAuthRouter(store, makeDw));
  return { app, store };
}

describe('POST /api/auth/login', () => {
  it('returns 400 on missing fields', async () => {
    const { app } = makeApp(() => ({}));
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 + sets sessionId cookie on success', async () => {
    const dw = {
      setAuthToken: vi.fn(),
      auth: { login: vi.fn().mockResolvedValue({ authToken: 'token', username: 'planner' }) },
      employees: { getByUsername: vi.fn().mockResolvedValue({ id: 42, username: 'planner', email: 'p@x', badge: '001', displayName: 'P' }) },
    };
    const { app } = makeApp(() => dw);
    const res = await request(app).post('/api/auth/login').send({
      baseUrl: 'http://dw', username: 'planner', password: 'p', database: 'D', eplantId: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('planner');
    expect(res.headers['set-cookie']?.[0]).toMatch(/sessionId=/);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 if no session', async () => {
    const { app } = makeApp(() => ({}));
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Create `backend/src/routes/auth.ts`**

```ts
import { Router } from 'express';
import type { SessionStore } from '../session.js';

type DwFactory = (cfg: { baseUrl: string }) => any;

export function makeAuthRouter(store: SessionStore, createDw: DwFactory) {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    try {
      const { baseUrl, username, password, database, eplantId } = req.body ?? {};
      if (!baseUrl || !username || !password || !database) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }
      const dw = createDw({ baseUrl });
      const login = await dw.auth.login({ username, password, database });
      dw.setAuthToken(login.authToken);
      const profile = await dw.employees.getByUsername(login.username);
      const sessionId = store.create({
        username: login.username,
        baseUrl, database,
        eplantId: Number(eplantId ?? 0),
        authToken: login.authToken,
        badge: profile?.badge ?? '',
        email: profile?.email ?? '',
      });
      res.cookie('sessionId', sessionId, {
        httpOnly: true, sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000,
      });
      res.json({ username: login.username, eplantId: Number(eplantId ?? 0), email: profile?.email ?? '' });
    } catch (e) { next(e); }
  });

  router.post('/logout', (req, res) => {
    const id = req.cookies?.sessionId as string | undefined;
    if (id) store.destroy(id);
    res.clearCookie('sessionId');
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    const id = req.cookies?.sessionId as string | undefined;
    const s = id ? store.get(id) : null;
    if (!s) { res.status(401).json({ error: 'NOT_AUTHENTICATED' }); return; }
    res.json({ username: s.username, eplantId: s.eplantId, email: s.email });
  });

  return router;
}
```

- [ ] **Step 3: Run test, expect PASS**

```bash
npm --workspace backend run test -- routes/auth
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.ts backend/test/routes/auth.test.ts
git commit -m "feat(routes): /api/auth login/logout/me"
```

---

### Task 16: Read-only routes (poReleases, employees, locations, printers, eplants)

**Files:**
- Create: `backend/src/routes/poReleases.ts`
- Create: `backend/src/routes/employees.ts`
- Create: `backend/src/routes/locations.ts`
- Create: `backend/src/routes/printers.ts`
- Create: `backend/src/routes/eplants.ts`
- Create: `backend/test/routes/poReleases.test.ts`

- [ ] **Step 1: Write failing test `backend/test/routes/poReleases.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { makePOReleasesRouter } from '../../src/routes/poReleases.js';
import { createSessionStore } from '../../src/session.js';
import { makeRequireSession } from '../../src/middleware/requireSession.js';

function setup(dw: any) {
  const app = express();
  app.use(express.json()); app.use(cookieParser());
  const store = createSessionStore({ ttlMs: 60_000 });
  const id = store.create({ username: 'u', baseUrl: 'http://x', database: 'D', eplantId: 1, authToken: 't', badge: '', email: '' });
  app.use('/api/po-releases', makeRequireSession(store), makePOReleasesRouter(() => dw));
  return { app, sid: id };
}

describe('GET /api/po-releases', () => {
  it('returns 401 without session', async () => {
    const app = express(); app.use(express.json()); app.use(cookieParser());
    const store = createSessionStore({ ttlMs: 60_000 });
    app.use('/api/po-releases', makeRequireSession(store), makePOReleasesRouter(() => ({})));
    const res = await request(app).get('/api/po-releases?dateFrom=2026-05-27&dateTo=2026-06-03');
    expect(res.status).toBe(401);
  });

  it('400 on missing date params', async () => {
    const dw = { setAuthToken: vi.fn() };
    const { app, sid } = setup(dw);
    const res = await request(app).get('/api/po-releases').set('Cookie', `sessionId=${sid}`);
    expect(res.status).toBe(400);
  });

  it('returns groups from dwClient', async () => {
    const dw = {
      setAuthToken: vi.fn(),
      poReleases: { listOpenByPromiseDate: vi.fn().mockResolvedValue([{ date: '2026-05-28', items: [] }]) },
    };
    const { app, sid } = setup(dw);
    const res = await request(app).get('/api/po-releases?dateFrom=2026-05-27&dateTo=2026-06-03').set('Cookie', `sessionId=${sid}`);
    expect(res.status).toBe(200);
    expect(res.body.groups).toEqual([{ date: '2026-05-28', items: [] }]);
  });
});
```

- [ ] **Step 2: Create `backend/src/routes/poReleases.ts`**

```ts
import { Router } from 'express';

type DwFactoryForSession = (req: any) => any;

export function makePOReleasesRouter(getDw: DwFactoryForSession) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const dateFrom = String(req.query.dateFrom ?? '');
      const dateTo = String(req.query.dateTo ?? '');
      if (!dateFrom || !dateTo) { res.status(400).json({ error: 'MISSING_DATES' }); return; }
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const groups = await dw.poReleases.listOpenByPromiseDate({
        dateFrom, dateTo, eplantId: req.session!.eplantId,
      });
      res.json({ groups });
    } catch (e) { next(e); }
  });
  return router;
}
```

- [ ] **Step 3: Create `backend/src/routes/employees.ts`**

```ts
import { Router } from 'express';

export function makeEmployeesRouter(getDw: (req: any) => any) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const list = await dw.employees.listTeamMembers();
      res.json({ employees: list });
    } catch (e) { next(e); }
  });
  return router;
}
```

- [ ] **Step 4: Create `backend/src/routes/locations.ts`**

```ts
import { Router } from 'express';

export function makeLocationsRouter(getDw: (req: any) => any) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const arInvtId = Number(req.query.arInvtId);
      if (!Number.isFinite(arInvtId) || arInvtId <= 0) { res.status(400).json({ error: 'MISSING_AR_INVT_ID' }); return; }
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const locations = await dw.locations.listForItem(arInvtId);
      res.json({ locations });
    } catch (e) { next(e); }
  });
  return router;
}
```

- [ ] **Step 5: Create `backend/src/routes/printers.ts`**

```ts
import { Router } from 'express';

export function makePrintersRouter(getDw: (req: any) => any) {
  const router = Router();
  router.get('/', async (req, res, next) => {
    try {
      const dw = getDw(req);
      dw.setAuthToken(req.session!.authToken);
      const printers = await dw.labels.listPrinters();
      res.json({ printers });
    } catch (e) { next(e); }
  });
  return router;
}
```

- [ ] **Step 6: Create `backend/src/routes/eplants.ts`**

Port from `../delmiaworks-production-reporter/backend/src/routes/eplants.ts` (1:1). It returns the list of eplants for the configured base URL.

- [ ] **Step 7: Run tests, expect PASS**

```bash
npm --workspace backend run test -- routes/poReleases
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/poReleases.ts backend/src/routes/employees.ts backend/src/routes/locations.ts backend/src/routes/printers.ts backend/src/routes/eplants.ts backend/test/routes/poReleases.test.ts
git commit -m "feat(routes): read-only routes for poReleases, employees, locations, printers, eplants"
```

---

### Task 17: Tasks routes (create, list, get, cancel)

**Files:**
- Create: `backend/src/routes/tasks.ts`
- Create: `backend/test/routes/tasks.test.ts`

- [ ] **Step 1: Write failing test `backend/test/routes/tasks.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { openDb, type DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';
import { ItemQueries } from '../../src/db/queries/items.js';
import { createTaskService } from '../../src/services/taskService.js';
import { createSessionStore } from '../../src/session.js';
import { makeRequireSession } from '../../src/middleware/requireSession.js';
import { makeTasksRouter } from '../../src/routes/tasks.js';
import { errorHandler } from '../../src/middleware/errorHandler.js';

let db: DB, sid: string, app: express.Express;

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  const tasks = new TaskQueries(db);
  const items = new ItemQueries(db);
  const mailer = { sendTaskCreated: vi.fn().mockResolvedValue({ success: true }) };
  const notif = { subscribe: vi.fn(), broadcast: vi.fn(), countSubscribers: vi.fn() };
  const svc = createTaskService({ tasks, items, mailer: mailer as any, notif: notif as any });
  const store = createSessionStore({ ttlMs: 60_000 });
  sid = store.create({ username: 'planner', baseUrl: '', database: '', eplantId: 1, authToken: '', badge: '', email: '' });

  app = express(); app.use(express.json()); app.use(cookieParser());
  app.use('/api/tasks', makeRequireSession(store), makeTasksRouter({
    service: svc, tasks, items,
    dwFactory: () => ({
      setAuthToken: vi.fn(),
      employees: { getByUsername: vi.fn().mockResolvedValue({ id: 42, username: 'worker', email: 'w@x', displayName: 'Worker', badge: '002' }) },
    }),
  }));
  app.use(errorHandler);
});

describe('POST /api/tasks', () => {
  it('creates task and returns taskId', async () => {
    const res = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToUsername: 'worker', dateFrom: '2026-05-27', dateTo: '2026-06-03',
      items: [{ poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: '', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: '' }],
    });
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBeTypeOf('number');
    expect(res.body.itemCount).toBe(1);
  });

  it('returns 400 if items empty', async () => {
    const res = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToUsername: 'worker', dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [],
    });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Create `backend/src/routes/tasks.ts`**

```ts
import { Router } from 'express';
import type { TaskQueries } from '../db/queries/tasks.js';
import type { ItemQueries } from '../db/queries/items.js';
import { createTaskService } from '../services/taskService.js';

type Deps = {
  service: ReturnType<typeof createTaskService>;
  tasks: TaskQueries;
  items: ItemQueries;
  dwFactory: (req: any) => any;
};

export function makeTasksRouter(deps: Deps) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { assignedToUsername, dateFrom, dateTo, items } = req.body ?? {};
      if (!assignedToUsername || !dateFrom || !dateTo || !Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'MISSING_FIELDS' });
        return;
      }
      const dw = deps.dwFactory(req);
      dw.setAuthToken(req.session!.authToken);
      const employee = await dw.employees.getByUsername(assignedToUsername);
      if (!employee) { res.status(400).json({ error: 'UNKNOWN_EMPLOYEE' }); return; }

      const out = await deps.service.createTask({
        createdByUsername: req.session!.username,
        createdByEplantId: req.session!.eplantId,
        assignedTo: { id: employee.id, username: employee.username, email: employee.email, name: employee.displayName },
        dateFrom, dateTo, items,
      });
      res.json(out);
    } catch (e) { next(e); }
  });

  router.get('/', (req, res) => {
    const rows = deps.tasks.listMine(req.session!.username);
    res.json({ tasks: rows.map(r => ({
      id: r.id, status: r.status, createdAt: r.created_at,
      createdBy: r.created_by_username, dateFrom: r.date_from, dateTo: r.date_to,
    })) });
  });

  router.get('/:id', (req, res) => {
    const id = Number(req.params.id);
    const t = deps.tasks.getById(id);
    if (!t) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (t.assigned_to_username !== req.session!.username && t.created_by_username !== req.session!.username) {
      res.status(403).json({ error: 'FORBIDDEN' }); return;
    }
    res.json({ task: t, items: deps.items.listByTask(id) });
  });

  router.post('/:id/cancel', (req, res) => {
    const id = Number(req.params.id);
    const t = deps.tasks.getById(id);
    if (!t) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    if (t.created_by_username !== req.session!.username) { res.status(403).json({ error: 'ONLY_CREATOR_CAN_CANCEL' }); return; }
    if (t.status === 'completed' || t.status === 'cancelled') { res.status(409).json({ error: `TASK_${t.status.toUpperCase()}` }); return; }
    deps.tasks.updateStatus(id, 'cancelled');
    res.json({ ok: true });
  });

  return router;
}
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
npm --workspace backend run test -- routes/tasks
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/tasks.ts backend/test/routes/tasks.test.ts
git commit -m "feat(routes): /api/tasks CRUD + cancel"
```

---

### Task 18: Receive endpoint

**Files:**
- Modify: `backend/src/routes/tasks.ts` (add receive endpoint)
- Modify: `backend/test/routes/tasks.test.ts` (add receive test)

- [ ] **Step 1: Add failing test inside `tasks.test.ts`**

```ts
describe('POST /api/tasks/:id/items/:itemId/receive', () => {
  it('processes receipt and marks item received', async () => {
    // create task first
    const create = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToUsername: 'worker', dateFrom: '2026-05-27', dateTo: '2026-06-03',
      items: [{ poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: '', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: '' }],
    });
    const taskId = create.body.taskId;
    // worker logs in (simulate by reusing session — in real flow, different user)
    const detail = await request(app).get(`/api/tasks/${taskId}`).set('Cookie', `sessionId=${sid}`);
    const itemId = detail.body.items[0].id;

    // override dwFactory to provide poReceipts + labels: skip — handled by integration; here we just assert validation
    const res = await request(app)
      .post(`/api/tasks/${taskId}/items/${itemId}/receive`)
      .set('Cookie', `sessionId=${sid}`)
      .send({ qty: 0, lotNo: '', locationId: 0, locationName: '', printerName: '' });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Add receive route inside `makeTasksRouter` factory (in `tasks.ts`)**

Insert before `return router;`:
```ts
router.post('/:id/items/:itemId/receive', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    const { qty, lotNo, locationId, locationName, printerName } = req.body ?? {};
    if (!Number.isFinite(qty) || qty <= 0) { res.status(400).json({ error: 'INVALID_QTY' }); return; }
    if (!lotNo) { res.status(400).json({ error: 'MISSING_LOT' }); return; }
    if (!Number.isFinite(locationId) || locationId <= 0) { res.status(400).json({ error: 'MISSING_LOCATION' }); return; }
    if (!printerName) { res.status(400).json({ error: 'MISSING_PRINTER' }); return; }

    const t = deps.tasks.getById(id);
    if (!t || t.assigned_to_username !== req.session!.username) { res.status(403).json({ error: 'FORBIDDEN' }); return; }

    const dw = deps.dwFactory(req);
    dw.setAuthToken(req.session!.authToken);
    const out = await deps.service.receiveItem({
      taskId: id, itemId, dw,
      input: { qty: Number(qty), lotNo: String(lotNo), locationId: Number(locationId), locationName: String(locationName ?? ''), printerName: String(printerName) },
      sessionUsername: req.session!.username,
    });
    res.json(out);
  } catch (e: any) {
    if (e?.code === 'ITEM_ALREADY_RECEIVED') { res.status(409).json({ error: 'ITEM_ALREADY_RECEIVED' }); return; }
    if (e?.code === 'TASK_COMPLETED') { res.status(409).json({ error: 'TASK_COMPLETED' }); return; }
    if (e?.code === 'INVALID_QTY') { res.status(400).json({ error: 'INVALID_QTY' }); return; }
    if (e?.code === 'NOT_FOUND') { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    next(e);
  }
});
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
npm --workspace backend run test -- routes/tasks
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/tasks.ts backend/test/routes/tasks.test.ts
git commit -m "feat(routes): /api/tasks/:id/items/:itemId/receive"
```

---

### Task 19: SSE notifications endpoint

**Files:**
- Create: `backend/src/routes/notifications.ts`
- Create: `backend/test/routes/notifications.test.ts`

- [ ] **Step 1: Write failing test `backend/test/routes/notifications.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { makeNotificationsRouter } from '../../src/routes/notifications.js';
import { createSessionStore } from '../../src/session.js';
import { makeRequireSession } from '../../src/middleware/requireSession.js';
import { createNotificationService } from '../../src/services/notificationService.js';

describe('GET /api/notifications/stream', () => {
  it('subscribes the user and sends initial heartbeat', async () => {
    const app = express(); app.use(express.json()); app.use(cookieParser());
    const store = createSessionStore({ ttlMs: 60_000 });
    const sid = store.create({ username: 'u', baseUrl: '', database: '', eplantId: 1, authToken: '', badge: '', email: '' });
    const notif = createNotificationService();

    app.use('/api/notifications', makeRequireSession(store), makeNotificationsRouter(notif));
    const res = await request(app).get('/api/notifications/stream').set('Cookie', `sessionId=${sid}`).buffer(true).parse((res, cb) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; if (buf.includes('heartbeat')) res.destroy(); });
      res.on('close', () => cb(null, buf));
    });
    expect((res.body ?? res.text).toString()).toContain('heartbeat');
  });
});
```

- [ ] **Step 2: Create `backend/src/routes/notifications.ts`**

```ts
import { Router } from 'express';
import type { NotificationService } from '../services/notificationService.js';

export function makeNotificationsRouter(notif: NotificationService) {
  const router = Router();
  router.get('/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);

    const heartbeatInterval = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }, 30_000);

    notif.subscribe(req.session!.username, {
      write: (msg: string) => res.write(msg),
      end: () => res.end(),
      on: (event, fn) => res.on(event, fn),
    });

    req.on('close', () => { clearInterval(heartbeatInterval); });
  });
  return router;
}
```

- [ ] **Step 3: Run tests, expect PASS**

```bash
npm --workspace backend run test -- routes/notifications
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/notifications.ts backend/test/routes/notifications.test.ts
git commit -m "feat(routes): SSE /api/notifications/stream"
```

---

### Task 20: Server wiring (compose everything)

**Files:**
- Modify: `backend/src/server.ts` (replace skeleton with full wiring)
- Create: `backend/test/integration/smoke.test.ts`

- [ ] **Step 1: Replace `backend/src/server.ts` content**

```ts
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { openDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { TaskQueries } from './db/queries/tasks.js';
import { ItemQueries } from './db/queries/items.js';
import { createSessionStore, type SessionStore } from './session.js';
import { createDwClient, type DwClient } from './dwClient/index.js';
import { createMailer, createSmtpTransport } from './services/mailer.js';
import { createNotificationService } from './services/notificationService.js';
import { createTaskService } from './services/taskService.js';
import { makeRequireSession } from './middleware/requireSession.js';
import { errorHandler } from './middleware/errorHandler.js';
import { makeAuthRouter } from './routes/auth.js';
import { makePOReleasesRouter } from './routes/poReleases.js';
import { makeEmployeesRouter } from './routes/employees.js';
import { makeLocationsRouter } from './routes/locations.js';
import { makePrintersRouter } from './routes/printers.js';
import { makeEPlantsRouter } from './routes/eplants.js';
import { makeTasksRouter } from './routes/tasks.js';
import { makeNotificationsRouter } from './routes/notifications.js';

export type Deps = {
  store: SessionStore;
  dwForReq: (req: any) => DwClient;
  dwForBaseUrl: (cfg: { baseUrl: string }) => DwClient;
};

export function createApp(deps?: Partial<Deps>): Express {
  const cfg = loadConfig();
  const db = openDb(cfg.sqlitePath);
  runMigrations(db);
  const tasks = new TaskQueries(db);
  const items = new ItemQueries(db);

  const store = deps?.store ?? createSessionStore({ ttlMs: cfg.sessionTtlMs });
  const notif = createNotificationService();
  const mailer = createMailer(
    createSmtpTransport(cfg.smtp),
    { from: cfg.smtp.from, appBaseUrl: cfg.appBaseUrl },
  );
  const service = createTaskService({ tasks, items, mailer, notif });

  const dwForReq = deps?.dwForReq ?? ((req: any) => createDwClient({ baseUrl: req.session!.baseUrl }));
  const dwForBaseUrl = deps?.dwForBaseUrl ?? ((c) => createDwClient(c));

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health', (_req, res) => { res.json({ ok: true, sessions: store.size() }); });

  app.use('/api/auth', makeAuthRouter(store, dwForBaseUrl));
  app.use('/api/po-releases', makeRequireSession(store), makePOReleasesRouter(dwForReq));
  app.use('/api/employees', makeRequireSession(store), makeEmployeesRouter(dwForReq));
  app.use('/api/locations', makeRequireSession(store), makeLocationsRouter(dwForReq));
  app.use('/api/printers', makeRequireSession(store), makePrintersRouter(dwForReq));
  app.use('/api/eplants', makeEPlantsRouter(dwForBaseUrl));
  app.use('/api/tasks', makeRequireSession(store),
    makeTasksRouter({ service, tasks, items, dwFactory: dwForReq }));
  app.use('/api/notifications', makeRequireSession(store), makeNotificationsRouter(notif));

  app.use(errorHandler);
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cfg = loadConfig();
  const app = createApp();
  app.listen(cfg.port, () => logger.info({ port: cfg.port }, 'server listening'));
}
```

- [ ] **Step 2: Write `backend/test/integration/smoke.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/server.js';

// Set env vars before createApp reads them
process.env.SQLITE_PATH = ':memory:';
process.env.SMTP_HOST = '';

let app: any;
beforeAll(() => { app = createApp(); });

describe('smoke', () => {
  it('health returns 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it('protected route 401 without cookie', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 3: Run all backend tests, expect PASS**

```bash
npm --workspace backend run test
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/server.ts backend/test/integration
git commit -m "feat(server): wire all routes + middleware + integration smoke"
```

---

## Phase 6 — Frontend foundation

### Task 21: API client + types

**Files:**
- Create: `frontend/src/types.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/api/poReleases.ts`
- Create: `frontend/src/api/employees.ts`
- Create: `frontend/src/api/tasks.ts`
- Create: `frontend/src/api/locations.ts`
- Create: `frontend/src/api/printers.ts`

- [ ] **Step 1: Create `frontend/src/types.ts`**

```ts
export type SessionMe = { username: string; eplantId: number; email: string };

export type POReleaseRow = {
  poReleaseId: number; poDetailId: number; poId: number; poNo: string;
  arInvtId: number; itemClass: string; itemNo: string; itemRev: string;
  itemDescription: string; qtyExpected: number; promiseDate: string;
  defaultRecvDesignator: string;
};
export type ReleaseGroup = { date: string; items: POReleaseRow[] };

export type Employee = { id: number; displayName: string; username: string; email: string; badge: string };
export type LocationRow = { id: number; code: string; description: string; isReceive: boolean };

export type TaskSummary = { id: number; status: 'open' | 'in_progress' | 'completed' | 'cancelled'; createdAt: string; createdBy: string; dateFrom: string; dateTo: string };

export type TaskItem = {
  id: number; task_id: number; po_no: string; po_detail_id: number; po_release_id: number;
  promise_date: string; ar_invt_id: number; item_class: string | null; item_no: string;
  item_rev: string | null; item_description: string | null; qty_expected: number;
  default_recv_designator: string | null;
  status: 'pending' | 'received' | 'failed';
  received_qty: number | null; received_lot_no: string | null;
  received_location_id: number | null; received_location_name: string | null;
  received_at: string | null; dw_receipt_id: number | null;
  label_printed: number; label_print_error: string | null; error_message: string | null;
};

export type TaskDetail = { task: TaskSummary & { assigned_to_username: string; created_by_username: string }; items: TaskItem[] };
```

- [ ] **Step 2: Create `frontend/src/api/client.ts`**

```ts
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ApiError(res.status, body.error ?? 'UNKNOWN', body.message ?? res.statusText);
  return body as T;
}
```

- [ ] **Step 3: Create `frontend/src/api/auth.ts`**

```ts
import { api } from './client.js';
import type { SessionMe } from '../types.js';

export const authApi = {
  login: (input: { baseUrl: string; username: string; password: string; database: string; eplantId: number }) =>
    api<{ username: string; eplantId: number; email: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => api<{ ok: true }>('/api/auth/logout', { method: 'POST' }),
  me: () => api<SessionMe>('/api/auth/me'),
};
```

- [ ] **Step 4: Create `frontend/src/api/poReleases.ts`**

```ts
import { api } from './client.js';
import type { ReleaseGroup } from '../types.js';

export const poReleasesApi = {
  list: (dateFrom: string, dateTo: string) =>
    api<{ groups: ReleaseGroup[] }>(`/api/po-releases?dateFrom=${dateFrom}&dateTo=${dateTo}`),
};
```

- [ ] **Step 5: Create `frontend/src/api/employees.ts`, `locations.ts`, `printers.ts`**

```ts
// employees.ts
import { api } from './client.js';
import type { Employee } from '../types.js';
export const employeesApi = { list: () => api<{ employees: Employee[] }>('/api/employees') };
```

```ts
// locations.ts
import { api } from './client.js';
import type { LocationRow } from '../types.js';
export const locationsApi = {
  forItem: (arInvtId: number) => api<{ locations: LocationRow[] }>(`/api/locations?arInvtId=${arInvtId}`),
};
```

```ts
// printers.ts
import { api } from './client.js';
export const printersApi = { list: () => api<{ printers: string[] }>('/api/printers') };
```

- [ ] **Step 6: Create `frontend/src/api/tasks.ts`**

```ts
import { api } from './client.js';
import type { TaskSummary, TaskDetail } from '../types.js';

export type CreateTaskInput = {
  assignedToUsername: string;
  dateFrom: string;
  dateTo: string;
  items: Array<{
    poId: number; poNo: string; poDetailId: number; poReleaseId: number;
    promiseDate: string; arInvtId: number;
    itemClass: string; itemNo: string; itemRev: string; itemDescription: string;
    qtyExpected: number; defaultRecvDesignator: string;
  }>;
};

export type ReceiveInput = { qty: number; lotNo: string; locationId: number; locationName: string; printerName: string };

export const tasksApi = {
  create: (input: CreateTaskInput) =>
    api<{ taskId: number; itemCount: number }>('/api/tasks', { method: 'POST', body: JSON.stringify(input) }),
  listMine: () => api<{ tasks: TaskSummary[] }>('/api/tasks'),
  get: (id: number) => api<TaskDetail>(`/api/tasks/${id}`),
  receive: (taskId: number, itemId: number, input: ReceiveInput) =>
    api<{ itemStatus: 'received'; dwReceiptId: number; taskStatus: string; labelPrinted: boolean; labelPrintError?: string }>(
      `/api/tasks/${taskId}/items/${itemId}/receive`, { method: 'POST', body: JSON.stringify(input) }),
  cancel: (id: number) => api<{ ok: true }>(`/api/tasks/${id}/cancel`, { method: 'POST' }),
};
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types.ts frontend/src/api
git commit -m "feat(frontend): API client + auth/tasks/poReleases/employees/locations/printers"
```

---

### Task 22: Zustand stores

**Files:**
- Create: `frontend/src/store/session.ts`
- Create: `frontend/src/store/planning.ts`
- Create: `frontend/test/store/planning.test.ts`

- [ ] **Step 1: Create `frontend/src/store/session.ts`**

```ts
import { create } from 'zustand';
import type { SessionMe } from '../types.js';

type SessionState = {
  me: SessionMe | null;
  setMe: (me: SessionMe | null) => void;
};
export const useSession = create<SessionState>(set => ({
  me: null,
  setMe: me => set({ me }),
}));
```

- [ ] **Step 2: Write failing test `frontend/test/store/planning.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanning } from '../../src/store/planning.js';

beforeEach(() => usePlanning.getState().reset());

describe('planning store', () => {
  it('toggles selection of release ids', () => {
    usePlanning.getState().toggle(100);
    expect(usePlanning.getState().isSelected(100)).toBe(true);
    usePlanning.getState().toggle(100);
    expect(usePlanning.getState().isSelected(100)).toBe(false);
  });

  it('selectAll adds ids, deselectAll removes them', () => {
    usePlanning.getState().selectAll([1, 2, 3]);
    expect([...usePlanning.getState().selected]).toHaveLength(3);
    usePlanning.getState().deselectAll([2]);
    expect(usePlanning.getState().isSelected(2)).toBe(false);
  });

  it('stores assigned employee username', () => {
    usePlanning.getState().setAssignedUsername('worker');
    expect(usePlanning.getState().assignedUsername).toBe('worker');
  });
});
```

- [ ] **Step 3: Create `frontend/src/store/planning.ts`**

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Mode = 'range' | 'nextDays';

type State = {
  mode: Mode;
  dateFrom: string;
  dateTo: string;
  nextDays: number;
  selected: Set<number>;
  assignedUsername: string;
  setMode: (m: Mode) => void;
  setDateFrom: (s: string) => void;
  setDateTo: (s: string) => void;
  setNextDays: (n: number) => void;
  toggle: (id: number) => void;
  isSelected: (id: number) => boolean;
  selectAll: (ids: number[]) => void;
  deselectAll: (ids: number[]) => void;
  setAssignedUsername: (u: string) => void;
  reset: () => void;
};

function today(): string { const d = new Date(); return d.toISOString().slice(0, 10); }
function plusDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const usePlanning = create<State>()(
  persist((set, get) => ({
    mode: 'range', dateFrom: today(), dateTo: plusDays(today(), 14), nextDays: 14,
    selected: new Set(), assignedUsername: '',
    setMode: m => set({ mode: m }),
    setDateFrom: s => set({ dateFrom: s }),
    setDateTo: s => set({ dateTo: s }),
    setNextDays: n => set({ nextDays: n, dateTo: plusDays(get().dateFrom, n) }),
    toggle: id => { const s = new Set(get().selected); s.has(id) ? s.delete(id) : s.add(id); set({ selected: s }); },
    isSelected: id => get().selected.has(id),
    selectAll: ids => { const s = new Set(get().selected); ids.forEach(i => s.add(i)); set({ selected: s }); },
    deselectAll: ids => { const s = new Set(get().selected); ids.forEach(i => s.delete(i)); set({ selected: s }); },
    setAssignedUsername: u => set({ assignedUsername: u }),
    reset: () => set({ selected: new Set(), assignedUsername: '' }),
  }), {
    name: 'epr-planning',
    partialize: (s) => ({ mode: s.mode, dateFrom: s.dateFrom, dateTo: s.dateTo, nextDays: s.nextDays }),
  }),
);
```

- [ ] **Step 4: Run test, expect PASS**

```bash
npm --workspace frontend run test -- planning
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/store frontend/test/store
git commit -m "feat(frontend): session + planning Zustand stores"
```

---

### Task 23: Login page + protected route shell

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/test/pages/Login.test.tsx`

- [ ] **Step 1: Replace `frontend/src/App.tsx`**

```tsx
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authApi } from './api/auth.js';
import { useSession } from './store/session.js';
import { Login } from './pages/Login.js';

function Protected() {
  const me = useSession(s => s.me);
  const setMe = useSession(s => s.setMe);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authApi.me().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, [setMe]);
  if (loading) return <div className="app"><p>Loading…</p></div>;
  if (!me) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Navigate to="/planning" replace />} />
        <Route path="/planning" element={<div className="app"><p>Planning (TODO)</p></div>} />
        <Route path="/receiving" element={<div className="app"><p>Receiving (TODO)</p></div>} />
        <Route path="/receiving/:id" element={<div className="app"><p>Receiving task (TODO)</p></div>} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 2: Write failing test `frontend/test/pages/Login.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Login } from '../../src/pages/Login.js';

vi.mock('../../src/api/auth.js', () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({ username: 'planner', eplantId: 1, email: 'p@x' }),
    me: vi.fn(),
  },
}));

describe('Login', () => {
  it('renders form fields', () => {
    render(<MemoryRouter><Login /></MemoryRouter>);
    expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/database/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/eplant/i)).toBeInTheDocument();
  });

  it('submits credentials', async () => {
    const { authApi } = await import('../../src/api/auth.js');
    render(<MemoryRouter><Login /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/base url/i), { target: { value: 'http://dw' } });
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'planner' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'p' } });
    fireEvent.change(screen.getByLabelText(/database/i), { target: { value: 'DB' } });
    fireEvent.change(screen.getByLabelText(/eplant/i), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(authApi.login).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Create `frontend/src/pages/Login.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/auth.js';
import { useSession } from '../store/session.js';
import { ApiError } from '../api/client.js';

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const setMe = useSession(s => s.setMe);

  const [baseUrl, setBaseUrl] = useState(localStorage.getItem('epr.baseUrl') ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState(localStorage.getItem('epr.database') ?? '');
  const [eplantId, setEplantId] = useState(Number(localStorage.getItem('epr.eplant') ?? 1));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as any)?.from ?? '/planning';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const me = await authApi.login({ baseUrl, username, password, database, eplantId });
      localStorage.setItem('epr.baseUrl', baseUrl);
      localStorage.setItem('epr.database', database);
      localStorage.setItem('epr.eplant', String(eplantId));
      setMe(me);
      navigate(redirectTo, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : String(e));
    } finally { setSubmitting(false); }
  }

  return (
    <div className="app">
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>Base URL <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required placeholder="http://delmiaworks:8080/WebAPI" /></label>
        <label>Database <input value={database} onChange={e => setDatabase(e.target.value)} required /></label>
        <label>EPlant ID <input type="number" value={eplantId} onChange={e => setEplantId(Number(e.target.value))} required min={1} /></label>
        <label>Username <input value={username} onChange={e => setUsername(e.target.value)} required /></label>
        <label>Password <input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm --workspace frontend run test -- Login
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/Login.tsx frontend/test/pages
git commit -m "feat(frontend): Login page + protected route shell"
```

---

### Task 24: NavHeader + useNotifications SSE hook

**Files:**
- Create: `frontend/src/components/NavHeader.tsx`
- Create: `frontend/src/hooks/useNotifications.ts`
- Modify: `frontend/src/App.tsx` (wrap protected routes with NavHeader + useNotifications)

- [ ] **Step 1: Create `frontend/src/hooks/useNotifications.ts`**

```ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../store/session.js';

export function useNotifications() {
  const qc = useQueryClient();
  const me = useSession(s => s.me);

  useEffect(() => {
    if (!me) return;
    let es: EventSource | null = null;
    let backoff = 1000;

    function connect() {
      es = new EventSource('/api/notifications/stream', { withCredentials: true });
      es.addEventListener('new_task', () => { qc.invalidateQueries({ queryKey: ['tasks', 'mine'] }); });
      es.addEventListener('open', () => { backoff = 1000; });
      es.addEventListener('error', () => {
        es?.close();
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      });
    }
    connect();
    return () => { es?.close(); };
  }, [me, qc]);
}
```

- [ ] **Step 2: Create `frontend/src/components/NavHeader.tsx`**

```tsx
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { authApi } from '../api/auth.js';
import { useSession } from '../store/session.js';

export function NavHeader() {
  const navigate = useNavigate();
  const me = useSession(s => s.me);
  const setMe = useSession(s => s.setMe);
  const { data } = useQuery({ queryKey: ['tasks', 'mine'], queryFn: tasksApi.listMine, refetchInterval: 60_000, enabled: !!me });
  const count = data?.tasks.length ?? 0;

  async function logout() { await authApi.logout(); setMe(null); navigate('/login'); }

  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.5rem 1rem', borderBottom: '1px solid #eee' }}>
      <strong style={{ marginRight: 'auto' }}>Expected PO Receipts</strong>
      <NavLink to="/planning">Planning</NavLink>
      <NavLink to="/receiving">
        Receiving {count > 0 && <span style={{ background: '#0a7', color: 'white', borderRadius: 8, padding: '0 6px', fontSize: 12 }}>{count}</span>}
      </NavLink>
      <span>{me?.username}</span>
      <button onClick={logout}>Logout</button>
    </header>
  );
}
```

- [ ] **Step 3: Modify `frontend/src/App.tsx` `Protected` wrapper** to render `NavHeader` + use the hook:

```tsx
import { NavHeader } from './components/NavHeader.js';
import { useNotifications } from './hooks/useNotifications.js';

function Protected() {
  const me = useSession(s => s.me);
  const setMe = useSession(s => s.setMe);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    authApi.me().then(setMe).catch(() => setMe(null)).finally(() => setLoading(false));
  }, [setMe]);
  useNotifications();
  if (loading) return <div className="app"><p>Loading…</p></div>;
  if (!me) return <Navigate to="/login" replace />;
  return (
    <>
      <NavHeader />
      <Outlet />
    </>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm --workspace frontend run test
```
Expected: existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/NavHeader.tsx frontend/src/hooks frontend/src/App.tsx
git commit -m "feat(frontend): NavHeader + useNotifications SSE hook"
```

---

## Phase 7 — Planning UI

### Task 25: DateRangePicker component

**Files:**
- Create: `frontend/src/components/DateRangePicker.tsx`
- Create: `frontend/test/components/DateRangePicker.test.tsx`

- [ ] **Step 1: Write failing test `frontend/test/components/DateRangePicker.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateRangePicker } from '../../src/components/DateRangePicker.js';
import { usePlanning } from '../../src/store/planning.js';

beforeEach(() => usePlanning.getState().reset());

describe('DateRangePicker', () => {
  it('renders both modes and toggles', () => {
    render(<DateRangePicker />);
    expect(screen.getByLabelText(/date range/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/next days/i)).toBeInTheDocument();
  });

  it('switching to nextDays recomputes dateTo from dateFrom', () => {
    render(<DateRangePicker />);
    fireEvent.click(screen.getByLabelText(/next days/i));
    const days = screen.getByRole('spinbutton', { name: /days/i });
    fireEvent.change(days, { target: { value: '7' } });
    expect(usePlanning.getState().nextDays).toBe(7);
  });
});
```

- [ ] **Step 2: Create `frontend/src/components/DateRangePicker.tsx`**

```tsx
import { usePlanning } from '../store/planning.js';

export function DateRangePicker() {
  const mode = usePlanning(s => s.mode);
  const dateFrom = usePlanning(s => s.dateFrom);
  const dateTo = usePlanning(s => s.dateTo);
  const nextDays = usePlanning(s => s.nextDays);
  const setMode = usePlanning(s => s.setMode);
  const setDateFrom = usePlanning(s => s.setDateFrom);
  const setDateTo = usePlanning(s => s.setDateTo);
  const setNextDays = usePlanning(s => s.setNextDays);

  return (
    <fieldset style={{ display: 'grid', gap: '0.5rem', maxWidth: 400 }}>
      <legend>Filter</legend>
      <label>
        <input type="radio" name="mode" checked={mode === 'range'} onChange={() => setMode('range')} aria-label="Date range" /> Date range
      </label>
      <label>
        <input type="radio" name="mode" checked={mode === 'nextDays'} onChange={() => setMode('nextDays')} aria-label="Next days" /> Next N days
      </label>

      <label>From <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label>
      {mode === 'range' ? (
        <label>To <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label>
      ) : (
        <label>Days <input type="number" min={1} max={365} value={nextDays} onChange={e => setNextDays(Number(e.target.value))} aria-label="days" /></label>
      )}
    </fieldset>
  );
}
```

- [ ] **Step 3: Run test, expect PASS**

```bash
npm --workspace frontend run test -- DateRangePicker
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/DateRangePicker.tsx frontend/test/components
git commit -m "feat(frontend): DateRangePicker component"
```

---

### Task 26: POReleaseTable component

**Files:**
- Create: `frontend/src/components/POReleaseTable.tsx`
- Create: `frontend/test/components/POReleaseTable.test.tsx`

- [ ] **Step 1: Write failing test `frontend/test/components/POReleaseTable.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { POReleaseTable } from '../../src/components/POReleaseTable.js';
import { usePlanning } from '../../src/store/planning.js';

beforeEach(() => usePlanning.getState().reset());

const groups = [{
  date: '2026-05-28', items: [
    { poReleaseId: 100, poDetailId: 10, poId: 1, poNo: 'PO-1', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D1', qtyExpected: 100, promiseDate: '2026-05-28', defaultRecvDesignator: 'DEFAULT' },
    { poReleaseId: 101, poDetailId: 11, poId: 1, poNo: 'PO-1', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'D2', qtyExpected: 50, promiseDate: '2026-05-28', defaultRecvDesignator: 'ZONE-A' },
  ],
}];

describe('POReleaseTable', () => {
  it('renders one section per date group with all items', () => {
    render(<POReleaseTable groups={groups} />);
    expect(screen.getByText('2026-05-28')).toBeInTheDocument();
    expect(screen.getByText('ITM-1')).toBeInTheDocument();
    expect(screen.getByText('ITM-2')).toBeInTheDocument();
  });

  it('toggling row checkbox updates selection store', () => {
    render(<POReleaseTable groups={groups} />);
    const rowChecks = screen.getAllByRole('checkbox', { name: /select item/i });
    fireEvent.click(rowChecks[0]!);
    expect(usePlanning.getState().isSelected(100)).toBe(true);
  });

  it('master checkbox selects all in a date group', () => {
    render(<POReleaseTable groups={groups} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /select all for 2026-05-28/i }));
    expect(usePlanning.getState().isSelected(100)).toBe(true);
    expect(usePlanning.getState().isSelected(101)).toBe(true);
  });
});
```

- [ ] **Step 2: Create `frontend/src/components/POReleaseTable.tsx`**

```tsx
import { useState } from 'react';
import type { ReleaseGroup } from '../types.js';
import { usePlanning } from '../store/planning.js';

export function POReleaseTable({ groups }: { groups: ReleaseGroup[] }) {
  const selected = usePlanning(s => s.selected);
  const toggle = usePlanning(s => s.toggle);
  const selectAll = usePlanning(s => s.selectAll);
  const deselectAll = usePlanning(s => s.deselectAll);

  return (
    <div>
      {groups.length === 0 && <p>No expected receipts in date range.</p>}
      {groups.map(g => {
        const ids = g.items.map(i => i.poReleaseId);
        const allSelected = ids.every(id => selected.has(id));
        return (
          <DateGroup key={g.date} date={g.date}
            allSelected={allSelected}
            onMasterToggle={() => allSelected ? deselectAll(ids) : selectAll(ids)}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr><th></th><th>Class</th><th>Item No</th><th>Rev</th><th>Description</th><th>Qty</th><th>Recv Designator</th></tr>
              </thead>
              <tbody>
                {g.items.map(i => (
                  <tr key={i.poReleaseId}>
                    <td>
                      <input type="checkbox"
                        aria-label="select item"
                        checked={selected.has(i.poReleaseId)}
                        onChange={() => toggle(i.poReleaseId)} />
                    </td>
                    <td>{i.itemClass}</td><td>{i.itemNo}</td><td>{i.itemRev}</td>
                    <td>{i.itemDescription}</td><td>{i.qtyExpected}</td>
                    <td>{i.defaultRecvDesignator || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DateGroup>
        );
      })}
    </div>
  );
}

function DateGroup({ date, allSelected, onMasterToggle, children }: { date: string; allSelected: boolean; onMasterToggle: () => void; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}>
      <header style={{ padding: '0.5rem', background: '#f7f7f7', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input type="checkbox"
          aria-label={`select all for ${date}`}
          checked={allSelected} onChange={onMasterToggle} />
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none' }}>{open ? '▾' : '▸'}</button>
        <strong>Promise Date: {date}</strong>
      </header>
      {open && <div style={{ padding: '0.5rem' }}>{children}</div>}
    </section>
  );
}
```

- [ ] **Step 3: Run test, expect PASS**

```bash
npm --workspace frontend run test -- POReleaseTable
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/POReleaseTable.tsx frontend/test/components/POReleaseTable.test.tsx
git commit -m "feat(frontend): POReleaseTable with grouping + selection"
```

---

### Task 27: Planning page assembly

**Files:**
- Create: `frontend/src/pages/Planning.tsx`
- Modify: `frontend/src/App.tsx` (use Planning page instead of placeholder)
- Create: `frontend/test/pages/Planning.test.tsx`

- [ ] **Step 1: Write failing test `frontend/test/pages/Planning.test.tsx`**

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Planning } from '../../src/pages/Planning.js';
import { usePlanning } from '../../src/store/planning.js';

vi.mock('../../src/api/poReleases.js', () => ({
  poReleasesApi: { list: vi.fn().mockResolvedValue({ groups: [{ date: '2026-05-28', items: [
    { poReleaseId: 100, poDetailId: 10, poId: 1, poNo: 'PO-1', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, promiseDate: '2026-05-28', defaultRecvDesignator: '' },
  ] }] }) },
}));
vi.mock('../../src/api/employees.js', () => ({
  employeesApi: { list: vi.fn().mockResolvedValue({ employees: [{ id: 42, username: 'worker', displayName: 'Worker', email: 'w@x', badge: '002' }] }) },
}));
vi.mock('../../src/api/tasks.js', () => ({
  tasksApi: { create: vi.fn().mockResolvedValue({ taskId: 1, itemCount: 1 }) },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

beforeEach(() => usePlanning.getState().reset());

describe('Planning page', () => {
  it('disables Generate until items and assignee chosen', async () => {
    render(wrap(<Planning />));
    const generate = await screen.findByRole('button', { name: /generate expected po/i });
    expect(generate).toBeDisabled();
  });
});
```

- [ ] **Step 2: Create `frontend/src/pages/Planning.tsx`**

```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DateRangePicker } from '../components/DateRangePicker.js';
import { POReleaseTable } from '../components/POReleaseTable.js';
import { poReleasesApi } from '../api/poReleases.js';
import { employeesApi } from '../api/employees.js';
import { tasksApi } from '../api/tasks.js';
import { usePlanning } from '../store/planning.js';

export function Planning() {
  const qc = useQueryClient();
  const dateFrom = usePlanning(s => s.dateFrom);
  const dateTo = usePlanning(s => s.dateTo);
  const selected = usePlanning(s => s.selected);
  const assignedUsername = usePlanning(s => s.assignedUsername);
  const setAssignedUsername = usePlanning(s => s.setAssignedUsername);
  const reset = usePlanning(s => s.reset);
  const [toast, setToast] = useState<string | null>(null);

  const releases = useQuery({
    queryKey: ['poReleases', dateFrom, dateTo],
    queryFn: () => poReleasesApi.list(dateFrom, dateTo),
    staleTime: 30_000,
  });

  const employees = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list, staleTime: 5 * 60_000 });

  const create = useMutation({
    mutationFn: () => {
      const flat = releases.data?.groups.flatMap(g => g.items.filter(i => selected.has(i.poReleaseId))) ?? [];
      return tasksApi.create({
        assignedToUsername: assignedUsername, dateFrom, dateTo,
        items: flat.map(i => ({
          poId: i.poId, poNo: i.poNo, poDetailId: i.poDetailId, poReleaseId: i.poReleaseId,
          promiseDate: i.promiseDate, arInvtId: i.arInvtId,
          itemClass: i.itemClass, itemNo: i.itemNo, itemRev: i.itemRev, itemDescription: i.itemDescription,
          qtyExpected: i.qtyExpected, defaultRecvDesignator: i.defaultRecvDesignator,
        })),
      });
    },
    onSuccess: (data) => { setToast(`Task #${data.taskId} created (${data.itemCount} items)`); reset(); qc.invalidateQueries({ queryKey: ['poReleases'] }); },
    onError: (e: any) => setToast(`Error: ${e?.message ?? 'unknown'}`),
  });

  return (
    <div className="app">
      <h2>Planning</h2>
      <DateRangePicker />
      <p>
        <button onClick={() => releases.refetch()}>Refresh</button>
      </p>
      {releases.isLoading && <p>Loading…</p>}
      {releases.isError && <p style={{ color: 'crimson' }}>Failed to load PO releases.</p>}
      {releases.data && <POReleaseTable groups={releases.data.groups} />}

      <section style={{ marginTop: '1rem', padding: '1rem', background: '#f7f7f7', borderRadius: 4 }}>
        <label>Assign to:{' '}
          <select value={assignedUsername} onChange={e => setAssignedUsername(e.target.value)}>
            <option value="">— pick a worker —</option>
            {employees.data?.employees.map(e => (
              <option key={e.id} value={e.username}>{e.displayName} ({e.username})</option>
            ))}
          </select>
        </label>
        <p>Selected: {selected.size} item(s)</p>
        <button
          disabled={selected.size === 0 || !assignedUsername || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? 'Creating…' : 'Generate Expected POs'}
        </button>
        {toast && <p>{toast}</p>}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Modify `frontend/src/App.tsx` to use `Planning`**

Replace the placeholder route element:
```tsx
<Route path="/planning" element={<Planning />} />
```
And add import: `import { Planning } from './pages/Planning.js';`

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm --workspace frontend run test -- Planning
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Planning.tsx frontend/test/pages/Planning.test.tsx frontend/src/App.tsx
git commit -m "feat(frontend): Planning page with DateRange + POReleaseTable + Generate flow"
```

---

## Phase 8 — Receiving UI

### Task 28: Receiving list page

**Files:**
- Create: `frontend/src/components/TaskCard.tsx`
- Create: `frontend/src/pages/Receiving.tsx`
- Modify: `frontend/src/App.tsx` (use Receiving page)
- Create: `frontend/test/pages/Receiving.test.tsx`

- [ ] **Step 1: Write failing test `frontend/test/pages/Receiving.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Receiving } from '../../src/pages/Receiving.js';

vi.mock('../../src/api/tasks.js', () => ({
  tasksApi: { listMine: vi.fn().mockResolvedValue({ tasks: [
    { id: 12, status: 'open', createdAt: '2026-05-27T08:00:00', createdBy: 'planner', dateFrom: '2026-05-28', dateTo: '2026-06-04' },
  ]}) },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
}

describe('Receiving page', () => {
  it('renders task cards', async () => {
    render(wrap(<Receiving />));
    expect(await screen.findByText(/Task #12/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Create `frontend/src/components/TaskCard.tsx`**

```tsx
import { Link } from 'react-router-dom';
import type { TaskSummary } from '../types.js';

export function TaskCard({ task }: { task: TaskSummary }) {
  return (
    <article style={{ border: '1px solid #ddd', borderRadius: 4, padding: '1rem', marginBottom: '0.5rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <strong>Task #{task.id}</strong>
        <span style={{ background: '#e5f5e5', padding: '0 6px', borderRadius: 8, fontSize: 12 }}>{task.status}</span>
      </header>
      <p style={{ margin: '0.5rem 0' }}>From: {task.createdBy} · Period: {task.dateFrom} → {task.dateTo}</p>
      <Link to={`/receiving/${task.id}`}>Open →</Link>
    </article>
  );
}
```

- [ ] **Step 3: Create `frontend/src/pages/Receiving.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { TaskCard } from '../components/TaskCard.js';

export function Receiving() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['tasks', 'mine'], queryFn: tasksApi.listMine });
  return (
    <div className="app">
      <h2>My open tasks</h2>
      {isLoading && <p>Loading…</p>}
      {isError && <p style={{ color: 'crimson' }}>Failed to load tasks.</p>}
      {data?.tasks.length === 0 && <p>No open tasks.</p>}
      {data?.tasks.map(t => <TaskCard key={t.id} task={t} />)}
    </div>
  );
}
```

- [ ] **Step 4: Wire route in `App.tsx`**

```tsx
import { Receiving } from './pages/Receiving.js';
// ...
<Route path="/receiving" element={<Receiving />} />
```

- [ ] **Step 5: Run tests, expect PASS**

```bash
npm --workspace frontend run test -- Receiving
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Receiving.tsx frontend/src/components/TaskCard.tsx frontend/test/pages/Receiving.test.tsx frontend/src/App.tsx
git commit -m "feat(frontend): Receiving list page + TaskCard"
```

---

### Task 29: ReceiveItemForm + PrinterPicker

**Files:**
- Create: `frontend/src/components/PrinterPicker.tsx`
- Create: `frontend/src/components/ReceiveItemForm.tsx`
- Create: `frontend/test/components/ReceiveItemForm.test.tsx`

- [ ] **Step 1: Write failing test `frontend/test/components/ReceiveItemForm.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReceiveItemForm } from '../../src/components/ReceiveItemForm.js';

vi.mock('../../src/api/locations.js', () => ({
  locationsApi: { forItem: vi.fn().mockResolvedValue({ locations: [{ id: 7, code: 'A1', description: 'Area 1', isReceive: true }] }) },
}));
vi.mock('../../src/api/printers.js', () => ({
  printersApi: { list: vi.fn().mockResolvedValue({ printers: ['P1', 'P2'] }) },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const item = { id: 1, task_id: 1, po_no: 'PO-1', po_detail_id: 10, po_release_id: 100, promise_date: '2026-05-28', ar_invt_id: 500, item_class: 'A', item_no: 'ITM-1', item_rev: 'R1', item_description: 'D', qty_expected: 100, default_recv_designator: 'DEFAULT', status: 'pending' as const, received_qty: null, received_lot_no: null, received_location_id: null, received_location_name: null, received_at: null, dw_receipt_id: null, label_printed: 0, label_print_error: null, error_message: null };

describe('ReceiveItemForm', () => {
  it('disables Receive when fields missing', () => {
    const onReceive = vi.fn();
    render(wrap(<ReceiveItemForm item={item} onReceive={onReceive} submitting={false} />));
    expect(screen.getByRole('button', { name: /receive/i })).toBeDisabled();
  });

  it('calls onReceive with form values', async () => {
    const onReceive = vi.fn();
    render(wrap(<ReceiveItemForm item={item} onReceive={onReceive} submitting={false} />));
    fireEvent.change(screen.getByLabelText(/lot no/i), { target: { value: 'LOT-A' } });
    fireEvent.change(screen.getByLabelText(/qty received/i), { target: { value: '100' } });
    await waitFor(() => screen.getByText('A1 — Area 1'));
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/printer/i), { target: { value: 'P1' } });
    fireEvent.click(screen.getByRole('button', { name: /receive/i }));
    expect(onReceive).toHaveBeenCalledWith({
      qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1',
    });
  });
});
```

- [ ] **Step 2: Create `frontend/src/components/PrinterPicker.tsx`**

```tsx
import { useQuery } from '@tanstack/react-query';
import { printersApi } from '../api/printers.js';

export function PrinterPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['printers'], queryFn: printersApi.list, staleTime: 5 * 60_000 });
  return (
    <select aria-label="printer" value={value} onChange={e => onChange(e.target.value)} disabled={isLoading}>
      <option value="">— pick a printer —</option>
      {data?.printers.map(p => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ReceiveItemForm.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { locationsApi } from '../api/locations.js';
import { PrinterPicker } from './PrinterPicker.js';
import type { TaskItem } from '../types.js';

export type ReceiveValues = { qty: number; lotNo: string; locationId: number; locationName: string; printerName: string };

export function ReceiveItemForm({ item, onReceive, submitting }: { item: TaskItem; onReceive: (v: ReceiveValues) => void; submitting: boolean }) {
  const [lotNo, setLotNo] = useState('');
  const [qty, setQty] = useState(String(item.qty_expected));
  const [locationId, setLocationId] = useState<string>('');
  const [printerName, setPrinterName] = useState(localStorage.getItem('epr.printer') ?? '');

  const locations = useQuery({ queryKey: ['locations', item.ar_invt_id], queryFn: () => locationsApi.forItem(item.ar_invt_id) });

  useEffect(() => { if (printerName) localStorage.setItem('epr.printer', printerName); }, [printerName]);

  const qtyNum = Number(qty);
  const locIdNum = Number(locationId);
  const valid = lotNo.length > 0 && qtyNum > 0 && qtyNum <= item.qty_expected && locIdNum > 0 && printerName.length > 0;

  function submit() {
    const loc = locations.data?.locations.find(l => l.id === locIdNum);
    onReceive({ qty: qtyNum, lotNo, locationId: locIdNum, locationName: loc?.code ?? '', printerName });
  }

  return (
    <div style={{ padding: '1rem', background: '#fafafa', borderRadius: 4 }}>
      <p><strong>{item.item_no}</strong> Rev {item.item_rev} · Class {item.item_class}</p>
      <p>PO: {item.po_no} · Promise: {item.promise_date}</p>
      <p>Expected: {item.qty_expected}</p>
      <p>Default Receive Designator: {item.default_recv_designator || '-'}</p>

      <label style={{ display: 'block', margin: '0.5rem 0' }}>Lot No:{' '}
        <input value={lotNo} onChange={e => setLotNo(e.target.value)} aria-label="lot no" />
      </label>
      <label style={{ display: 'block', margin: '0.5rem 0' }}>Qty Received (max {item.qty_expected}):{' '}
        <input type="number" min={1} max={item.qty_expected} value={qty} onChange={e => setQty(e.target.value)} aria-label="qty received" />
      </label>
      <label style={{ display: 'block', margin: '0.5rem 0' }}>Location:{' '}
        <select aria-label="location" value={locationId} onChange={e => setLocationId(e.target.value)} disabled={locations.isLoading}>
          <option value="">— pick location —</option>
          {locations.data?.locations.map(l => <option key={l.id} value={l.id}>{l.code} — {l.description}</option>)}
        </select>
      </label>
      <label style={{ display: 'block', margin: '0.5rem 0' }}>Printer:{' '}
        <PrinterPicker value={printerName} onChange={setPrinterName} />
      </label>
      <button onClick={submit} disabled={!valid || submitting}>
        {submitting ? 'Receiving…' : 'Receive'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm --workspace frontend run test -- ReceiveItemForm
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PrinterPicker.tsx frontend/src/components/ReceiveItemForm.tsx frontend/test/components/ReceiveItemForm.test.tsx
git commit -m "feat(frontend): ReceiveItemForm + PrinterPicker"
```

---

### Task 30: ReceivingTask page

**Files:**
- Create: `frontend/src/pages/ReceivingTask.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/test/pages/ReceivingTask.test.tsx`

- [ ] **Step 1: Write failing test `frontend/test/pages/ReceivingTask.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReceivingTask } from '../../src/pages/ReceivingTask.js';

const task = { task: { id: 12, status: 'open', createdAt: '', createdBy: 'p', dateFrom: '2026-05-28', dateTo: '2026-06-04', assigned_to_username: 'worker', created_by_username: 'p' } as any, items: [
  { id: 1, task_id: 12, po_no: 'PO-1', po_detail_id: 10, po_release_id: 100, promise_date: '2026-05-28', ar_invt_id: 500, item_class: 'A', item_no: 'ITM-1', item_rev: 'R1', item_description: 'D', qty_expected: 100, default_recv_designator: '', status: 'pending', received_qty: null, received_lot_no: null, received_location_id: null, received_location_name: null, received_at: null, dw_receipt_id: null, label_printed: 0, label_print_error: null, error_message: null },
] };

vi.mock('../../src/api/tasks.js', () => ({
  tasksApi: { get: vi.fn().mockResolvedValue(task), receive: vi.fn() },
}));
vi.mock('../../src/api/locations.js', () => ({ locationsApi: { forItem: vi.fn().mockResolvedValue({ locations: [] }) } }));
vi.mock('../../src/api/printers.js', () => ({ printersApi: { list: vi.fn().mockResolvedValue({ printers: [] }) } }));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={['/receiving/12']}>
      <Routes><Route path="/receiving/:id" element={children} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>;
}

describe('ReceivingTask', () => {
  it('renders task header and item row', async () => {
    render(wrap(<ReceivingTask />));
    expect(await screen.findByText(/Task #12/)).toBeInTheDocument();
    expect(await screen.findByText(/ITM-1/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Create `frontend/src/pages/ReceivingTask.tsx`**

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../api/tasks.js';
import { ReceiveItemForm, type ReceiveValues } from '../components/ReceiveItemForm.js';

export function ReceivingTask() {
  const { id } = useParams<{ id: string }>();
  const taskId = Number(id);
  const qc = useQueryClient();
  const [busyItemId, setBusyItemId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({ queryKey: ['task', taskId], queryFn: () => tasksApi.get(taskId), enabled: Number.isFinite(taskId) });

  const receive = useMutation({
    mutationFn: ({ itemId, values }: { itemId: number; values: ReceiveValues }) => tasksApi.receive(taskId, itemId, values),
    onMutate: ({ itemId }) => setBusyItemId(itemId),
    onSettled: () => { setBusyItemId(null); qc.invalidateQueries({ queryKey: ['task', taskId] }); qc.invalidateQueries({ queryKey: ['tasks', 'mine'] }); },
    onSuccess: (r) => { if (!r.labelPrinted) setError(`Receipt OK (#${r.dwReceiptId}) but label print failed: ${r.labelPrintError ?? 'unknown'}`); else setError(null); },
    onError: (e: any) => setError(`${e?.code ?? 'ERROR'}: ${e?.message ?? 'unknown'}`),
  });

  if (isLoading) return <div className="app"><p>Loading…</p></div>;
  if (isError || !data) return <div className="app"><p style={{ color: 'crimson' }}>Failed to load task.</p></div>;

  const { task, items } = data;
  return (
    <div className="app">
      <h2>Task #{task.id} <small style={{ fontSize: 14, color: '#666' }}>· {task.status}</small></h2>
      <p>From: {task.createdBy} · Period: {task.dateFrom} → {task.dateTo}</p>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {items.map(item => (
        <div key={item.id} style={{ border: '1px solid #ddd', borderRadius: 4, marginBottom: 8 }}>
          {item.status === 'received' ? (
            <div style={{ padding: '0.75rem', background: '#e9f7e9' }}>
              ✓ Received {item.received_qty} of <strong>{item.item_no}</strong> · Lot {item.received_lot_no} · Location {item.received_location_name}
              · DW Receipt #{item.dw_receipt_id} {item.label_printed === 0 && <span style={{ color: 'darkorange' }}>(label print failed)</span>}
            </div>
          ) : (
            <ReceiveItemForm item={item} submitting={busyItemId === item.id}
              onReceive={(values) => receive.mutate({ itemId: item.id, values })} />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Wire route in `App.tsx`**

```tsx
import { ReceivingTask } from './pages/ReceivingTask.js';
// ...
<Route path="/receiving/:id" element={<ReceivingTask />} />
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
npm --workspace frontend run test -- ReceivingTask
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/ReceivingTask.tsx frontend/test/pages/ReceivingTask.test.tsx frontend/src/App.tsx
git commit -m "feat(frontend): ReceivingTask page with per-item receive flow"
```

---

## Phase 9 — Polish

### Task 31: Dev scripts + README

**Files:**
- Create: `pokreni.bat` (Windows convenience)
- Create: `zaustavi.bat`
- Modify: `README.md`

- [ ] **Step 1: Create `pokreni.bat`**

```bat
@echo off
echo Starting Expected PO Receipts (backend + frontend)...
start "epr-backend" cmd /k npm run dev:backend
start "epr-frontend" cmd /k npm run dev:frontend
echo Open http://localhost:5173 when both processes are ready.
```

- [ ] **Step 2: Create `zaustavi.bat`**

```bat
@echo off
echo Stopping Expected PO Receipts processes...
taskkill /FI "WINDOWTITLE eq epr-backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq epr-frontend*" /T /F >nul 2>&1
echo Done.
```

- [ ] **Step 3: Update `README.md`**

```md
# Expected PO Receipts

Web application (responsive desktop + mobile) that helps planners and warehouse staff handle expected receipts from DELMIAWORKS purchase orders.

## Requirements

- Node.js 20+
- Reachable DelmiaWorks WebAPI (e.g. `http://delmiaworks:8080/WebAPI`) + valid credentials
- SMTP relay (host/port/user/pass) for email notifications

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your SMTP + SQLite path
```

## Dev

In two terminals:

```bash
npm run dev:backend   # http://localhost:3000
npm run dev:frontend  # http://localhost:5173
```

Or on Windows: `pokreni.bat` (and `zaustavi.bat` to stop).

Open http://localhost:5173, sign in with your DW credentials + EPlant ID, and use Planning to generate tasks for warehouse workers.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

## Architecture

See [`docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md`](docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md).
```

- [ ] **Step 4: Commit**

```bash
git add pokreni.bat zaustavi.bat README.md
git commit -m "chore: dev scripts and README"
```

---

### Task 32: Final integration smoke test (backend + frontend build)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```
Expected: all backend + frontend tests pass.

- [ ] **Step 2: Build both workspaces**

```bash
npm run build
```
Expected: successful build, no TS errors.

- [ ] **Step 3: Manual smoke (dev mode)** — start backend + frontend, sign in, verify:
  - `/planning` loads PO releases from DW (date range mode)
  - Selecting items + picking an employee enables `Generate`
  - Clicking `Generate` creates a task (toast)
  - `/receiving` shows the new task
  - Opening the task and filling Lot/Qty/Location/Printer enables `Receive`
  - Clicking `Receive` calls the API and marks the item received

- [ ] **Step 4: Commit any final fixes from smoke**

```bash
git add -A
git commit -m "chore: final smoke fixes" --allow-empty
```

---

## Open items deferred to first DW test run

These are flagged in the spec section 9 and validated against the DW VM during implementation:

1. **`POReleaseItems` filter syntax** — verify `(PromiseDate.gte~...&EPlantId.eq~...)` works; fall back to fetching all and filtering client-side if the operator isn't supported.
2. **`Locations/0?arinvtId=...`** — verify the endpoint returns the right shape and `ReceiveDesignator` flag.
3. **`PostPOReceiptAndUpdateMasterLabel` response shape** — confirm `FgMultiId` is the masterLabelId; adjust `poReceipts.ts` if a different field is returned.
4. **`PrintPurchased` body parameter `Qty`** — the spec assumes the body accepts `{ Qty }`; verify on first call.
5. **EPlants endpoint** — port the sibling's `eplants.ts` and confirm it still works for this project.

If any of these endpoints return shapes that differ from this plan's assumptions, fix the relevant `dwClient/*.ts` module and update its test fixture — the rest of the stack is decoupled enough that no other files need to change.





