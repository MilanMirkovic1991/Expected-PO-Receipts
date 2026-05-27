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
