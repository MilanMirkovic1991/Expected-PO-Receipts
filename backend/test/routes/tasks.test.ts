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
