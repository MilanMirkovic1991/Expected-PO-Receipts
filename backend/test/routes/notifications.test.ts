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
