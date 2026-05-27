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
      employees: {
        getById: vi.fn().mockResolvedValue({ id: 42, empNo: '002', username: '002', email: '', displayName: 'Worker', badge: '002' }),
      },
    }),
  }));
  app.use(errorHandler);
});

const itemFixture = {
  poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100,
  promiseDate: '2026-05-28', arInvtId: 500,
  itemClass: 'A', itemNo: 'ITM-1', itemRev: '', itemDescription: 'D',
  qtyExpected: 100, defaultRecvDesignator: '',
  vendorId: 99, vendorNo: 'V-99', vendorName: 'Acme Co',
};

describe('POST /api/tasks', () => {
  it('creates task by PR_EMP id and returns taskId', async () => {
    const res = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToEmployeeId: 42,
      dateFrom: '2026-05-27', dateTo: '2026-06-03',
      items: [itemFixture],
    });
    expect(res.status).toBe(200);
    expect(res.body.taskId).toBeTypeOf('number');
    expect(res.body.itemCount).toBe(1);
  });

  it('returns 400 if items empty', async () => {
    const res = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToEmployeeId: 42, dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [],
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 if assignedToEmployeeId is missing', async () => {
    const res = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [itemFixture],
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/tasks (all open, permissive)', () => {
  it('returns every open/in-progress task regardless of user', async () => {
    await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToEmployeeId: 42, dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [itemFixture],
    });
    const res = await request(app).get('/api/tasks').set('Cookie', `sessionId=${sid}`);
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0]).toMatchObject({
      assignedToName: 'Worker',
      assignedToBadge: '002',
    });
  });
});

describe('POST /api/tasks/:id/items/:itemId/receive', () => {
  it('returns 400 on empty receive payload', async () => {
    const create = await request(app).post('/api/tasks').set('Cookie', `sessionId=${sid}`).send({
      assignedToEmployeeId: 42, dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [itemFixture],
    });
    const taskId = create.body.taskId;
    const detail = await request(app).get(`/api/tasks/${taskId}`).set('Cookie', `sessionId=${sid}`);
    const itemId = detail.body.items[0].id;

    const res = await request(app)
      .post(`/api/tasks/${taskId}/items/${itemId}/receive`)
      .set('Cookie', `sessionId=${sid}`)
      .send({ qty: 0, lotNo: '', locationId: 0, locationName: '', printerName: '' });
    expect(res.status).toBe(400);
  });
});
