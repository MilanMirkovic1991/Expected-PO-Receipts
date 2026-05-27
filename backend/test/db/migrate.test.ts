import { describe, it, expect } from 'vitest';
import { openDb } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';

describe('migrations', () => {
  it('creates the expected_receipt_task and expected_receipt_item tables', () => {
    const db = openDb(':memory:');
    runMigrations(db);
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all() as Array<{ name: string }>;
    expect(tables.map(t => t.name)).toContain('expected_receipt_task');
    expect(tables.map(t => t.name)).toContain('expected_receipt_item');
    expect(tables.map(t => t.name)).toContain('schema_migrations');
  });

  it('is idempotent', () => {
    const db = openDb(':memory:');
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();
  });
});
