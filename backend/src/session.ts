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
