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
