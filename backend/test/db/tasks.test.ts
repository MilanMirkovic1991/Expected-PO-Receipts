import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';
import { ItemQueries } from '../../src/db/queries/items.js';

let db: DB;
let q: TaskQueries;
let items: ItemQueries;

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  q = new TaskQueries(db);
  items = new ItemQueries(db);
});

describe('TaskQueries', () => {
  it('inserts a task and returns its id', () => {
    const id = q.insert({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedToEmployeeId: 42, assignedToUsername: 'worker',
      assignedToEmail: 'w@x.com', assignedToName: 'Worker',
      dateFrom: '2026-05-27', dateTo: '2026-06-03',
    });
    expect(id).toBeTypeOf('number');
  });

  it('lists open tasks for a username', () => {
    q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'worker', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 43, assignedToUsername: 'other', assignedToEmail: '', assignedToName: 'O', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    const rows = q.listMine('worker');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.assigned_to_username).toBe('worker');
  });

  it('updates task status', () => {
    const id = q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'w', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    q.updateStatus(id, 'completed');
    const row = q.getById(id);
    expect(row?.status).toBe('completed');
    expect(row?.completed_at).toBeTruthy();
  });

  it('records notification result', () => {
    const id = q.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'w', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
    q.setNotificationResult(id, { success: true });
    const row = q.getById(id);
    expect(row?.notification_sent_at).toBeTruthy();
    expect(row?.notification_error).toBeNull();
  });

  it('insertWithItems inserts task and items atomically', () => {
    const taskInput = {
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedToEmployeeId: 42, assignedToUsername: 'worker',
      assignedToEmail: 'w@x.com', assignedToName: 'Worker',
      dateFrom: '2026-05-27', dateTo: '2026-06-03',
    };
    const itemInputs = [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: 'DEFAULT' },
      { poId: 1, poNo: 'PO-1', poDetailId: 11, poReleaseId: 101, promiseDate: '2026-05-29', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'E', qtyExpected: 50, defaultRecvDesignator: '' },
    ];
    const taskId = q.insertWithItems(taskInput, itemInputs);
    expect(taskId).toBeTypeOf('number');
    expect(q.getById(taskId)).toBeDefined();
    expect(items.listByTask(taskId)).toHaveLength(2);
  });

  it('insertWithItems with empty items creates task but no items', () => {
    const taskInput = {
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedToEmployeeId: 42, assignedToUsername: 'worker',
      assignedToEmail: 'w@x.com', assignedToName: 'Worker',
      dateFrom: '2026-05-27', dateTo: '2026-06-03',
    };
    const taskId = q.insertWithItems(taskInput, []);
    expect(q.getById(taskId)).toBeDefined();
    expect(items.listByTask(taskId)).toHaveLength(0);
  });
});
