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
