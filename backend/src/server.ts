import { pathToFileURL } from 'node:url';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { loadConfig } from './config.js';
import { logger } from './logger.js';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health', (_req, res) => { res.json({ ok: true }); });
  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig();
  const app = createApp();
  app.listen(cfg.port, () => logger.info({ port: cfg.port }, 'server listening'));
}
