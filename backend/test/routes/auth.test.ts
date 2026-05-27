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
