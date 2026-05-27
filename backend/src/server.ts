import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { openDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { TaskQueries } from './db/queries/tasks.js';
import { ItemQueries } from './db/queries/items.js';
import { createSessionStore, type SessionStore } from './session.js';
import { createDwClient, type DwClient } from './dwClient/index.js';
import { createMailer, createSmtpTransport } from './services/mailer.js';
import { createNotificationService } from './services/notificationService.js';
import { createTaskService } from './services/taskService.js';
import { makeRequireSession } from './middleware/requireSession.js';
import { errorHandler } from './middleware/errorHandler.js';
import { makeAuthRouter } from './routes/auth.js';
import { makePOReleasesRouter } from './routes/poReleases.js';
import { makeEmployeesRouter } from './routes/employees.js';
import { makeLocationsRouter } from './routes/locations.js';
import { makePrintersRouter } from './routes/printers.js';
import { makeEPlantsRouter } from './routes/eplants.js';
import { makeTasksRouter } from './routes/tasks.js';
import { makeNotificationsRouter } from './routes/notifications.js';

export type Deps = {
  store: SessionStore;
  dwForReq: (req: any) => DwClient;
  dwForBaseUrl: (cfg: { baseUrl: string }) => DwClient;
};

export function createApp(deps?: Partial<Deps>): Express {
  const cfg = loadConfig();
  const db = openDb(cfg.sqlitePath);
  runMigrations(db);
  const tasks = new TaskQueries(db);
  const items = new ItemQueries(db);

  const store = deps?.store ?? createSessionStore({ ttlMs: cfg.sessionTtlMs });
  const notif = createNotificationService();
  const mailer = createMailer(
    createSmtpTransport(cfg.smtp),
    { from: cfg.smtp.from, appBaseUrl: cfg.appBaseUrl },
  );
  const service = createTaskService({ tasks, items, mailer, notif });

  const dwForReq = deps?.dwForReq ?? ((req: any) => createDwClient({ baseUrl: req.session!.baseUrl }));
  const dwForBaseUrl = deps?.dwForBaseUrl ?? ((c) => createDwClient(c));

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.get('/health', (_req, res) => { res.json({ ok: true, sessions: store.size() }); });

  app.use('/api/auth', makeAuthRouter(store, dwForBaseUrl));
  app.use('/api/po-releases', makeRequireSession(store), makePOReleasesRouter(dwForReq));
  app.use('/api/employees', makeRequireSession(store), makeEmployeesRouter(dwForReq));
  app.use('/api/locations', makeRequireSession(store), makeLocationsRouter(dwForReq));
  app.use('/api/printers', makeRequireSession(store), makePrintersRouter(dwForReq));
  app.use('/api/eplants', makeEPlantsRouter(dwForBaseUrl));
  app.use('/api/tasks', makeRequireSession(store),
    makeTasksRouter({ service, tasks, items, dwFactory: dwForReq }));
  app.use('/api/notifications', makeRequireSession(store), makeNotificationsRouter(notif));

  app.use(errorHandler);
  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const cfg = loadConfig();
  const app = createApp();
  app.listen(cfg.port, () => logger.info({ port: cfg.port }, 'server listening'));
}
