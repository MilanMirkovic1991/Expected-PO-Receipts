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
