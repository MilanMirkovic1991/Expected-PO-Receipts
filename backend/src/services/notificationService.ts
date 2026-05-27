export type SSEClient = {
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close', fn: () => void): void;
};

export type BroadcastInput = { to: string; event: string; payload: unknown };

export type NotificationService = {
  subscribe(username: string, client: SSEClient): void;
  broadcast(input: BroadcastInput): void;
  countSubscribers(username: string): number;
};

export function createNotificationService(): NotificationService {
  const subs = new Map<string, Set<SSEClient>>();
  return {
    subscribe(username, client) {
      const set = subs.get(username) ?? new Set();
      set.add(client);
      subs.set(username, set);
      client.on('close', () => { set.delete(client); if (set.size === 0) subs.delete(username); });
    },
    broadcast({ to, event, payload }) {
      const set = subs.get(to);
      if (!set) return;
      const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
      for (const c of set) {
        try { c.write(msg); } catch { /* swallow */ }
      }
    },
    countSubscribers(username) { return subs.get(username)?.size ?? 0; },
  };
}
