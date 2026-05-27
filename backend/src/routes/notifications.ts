import { Router } from 'express';
import type { NotificationService } from '../services/notificationService.js';

export function makeNotificationsRouter(notif: NotificationService) {
  const router = Router();
  router.get('/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);

    const heartbeatInterval = setInterval(() => {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }, 30_000);

    notif.subscribe(req.session!.username, {
      write: (msg: string) => res.write(msg),
      end: () => res.end(),
      on: (event, fn) => res.on(event, fn),
    });

    req.on('close', () => { clearInterval(heartbeatInterval); });
  });
  return router;
}
