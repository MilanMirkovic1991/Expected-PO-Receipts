import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '../store/session.js';

export function useNotifications() {
  const qc = useQueryClient();
  const me = useSession(s => s.me);

  useEffect(() => {
    if (!me) return;
    let es: EventSource | null = null;
    let backoff = 1000;

    function connect() {
      es = new EventSource('/api/notifications/stream', { withCredentials: true });
      es.addEventListener('new_task', () => { qc.invalidateQueries({ queryKey: ['tasks', 'mine'] }); });
      es.addEventListener('open', () => { backoff = 1000; });
      es.addEventListener('error', () => {
        es?.close();
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 30000);
      });
    }
    connect();
    return () => { es?.close(); };
  }, [me, qc]);
}
