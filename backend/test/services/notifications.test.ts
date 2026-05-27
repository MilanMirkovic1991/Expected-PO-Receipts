import { describe, it, expect, vi } from 'vitest';
import { createNotificationService, type SSEClient } from '../../src/services/notificationService.js';

function fakeClient(): SSEClient & { written: string[]; closed: boolean } {
  const written: string[] = [];
  return {
    write(msg: string) { written.push(msg); return true; },
    end() { (this as any).closed = true; },
    on(event: string, fn: () => void) { if (event === 'close') (this as any)._onClose = fn; },
    written, closed: false,
  };
}

describe('notificationService', () => {
  it('broadcasts to subscribers of a given username', () => {
    const svc = createNotificationService();
    const a = fakeClient(); const b = fakeClient(); const c = fakeClient();
    svc.subscribe('ana', a); svc.subscribe('ana', b); svc.subscribe('bob', c);

    svc.broadcast({ to: 'ana', event: 'new_task', payload: { taskId: 7 } });

    expect(a.written.join('')).toContain('event: new_task');
    expect(a.written.join('')).toContain('"taskId":7');
    expect(b.written.length).toBeGreaterThan(0);
    expect(c.written.length).toBe(0);
  });

  it('unsubscribes on close', () => {
    const svc = createNotificationService();
    const a = fakeClient();
    svc.subscribe('ana', a);
    (a as any)._onClose();
    svc.broadcast({ to: 'ana', event: 'new_task', payload: {} });
    expect(a.written.length).toBe(0);
  });
});
