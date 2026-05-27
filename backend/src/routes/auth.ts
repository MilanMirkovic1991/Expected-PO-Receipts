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
