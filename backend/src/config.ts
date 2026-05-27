import 'dotenv/config';

export type Config = {
  port: number;
  sessionTtlMs: number;
  sqlitePath: string;
  appBaseUrl: string;
  smtp: { host: string; port: number; secure: boolean; user: string; pass: string; from: string };
  logLevel: string;
};

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 3000),
    sessionTtlMs: Number(process.env.SESSION_TTL_HOURS ?? 8) * 60 * 60 * 1000,
    sqlitePath: process.env.SQLITE_PATH ?? './data/expected-po-receipts.db',
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:5173',
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM ?? 'Expected PO Receipts <no-reply@localhost>',
    },
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
}
