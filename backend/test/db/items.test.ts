import { describe, it, expect, beforeEach } from 'vitest';
import { openDb, DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';
import { ItemQueries } from '../../src/db/queries/items.js';

let db: DB;
let tasks: TaskQueries;
let items: ItemQueries;
let taskId: number;

beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  tasks = new TaskQueries(db);
  items = new ItemQueries(db);
  taskId = tasks.insert({ createdByUsername: 'p', createdByEplantId: 1, assignedToEmployeeId: 42, assignedToUsername: 'w', assignedToEmail: '', assignedToName: 'W', dateFrom: '2026-05-27', dateTo: '2026-06-03' });
});

describe('ItemQueries', () => {
  it('bulk inserts items for a task', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: 'DEFAULT' },
      { poId: 1, poNo: 'PO-1', poDetailId: 11, poReleaseId: 101, promiseDate: '2026-05-29', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'E', qtyExpected: 50, defaultRecvDesignator: 'ZONE-A' },
    ]);
    expect(items.listByTask(taskId)).toHaveLength(2);
  });

  it('marks an item received and records receipt details', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: 'DEFAULT' },
    ]);
    const [item] = items.listByTask(taskId);
    const wasUpdated = items.markReceived(item!.id, {
      qty: 100, lotNo: 'LOT-1', locationId: 7, locationName: 'A1', dwReceiptId: 555,
      dwMasterLabelId: 666, labelPrinted: true,
    });
    expect(wasUpdated).toBe(true);
    const updated = items.getById(item!.id);
    expect(updated?.status).toBe('received');
    expect(updated?.received_qty).toBe(100);
    expect(updated?.dw_receipt_id).toBe(555);
  });

  it('markReceived returns false when item is not pending', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: 'DEFAULT' },
    ]);
    const [item] = items.listByTask(taskId);
    // First call succeeds
    items.markReceived(item!.id, { qty: 100, lotNo: 'L', locationId: 7, locationName: 'A1', dwReceiptId: 1, dwMasterLabelId: 2, labelPrinted: false });
    // Second call on already-received item should return false
    const second = items.markReceived(item!.id, { qty: 100, lotNo: 'L', locationId: 7, locationName: 'A1', dwReceiptId: 99, dwMasterLabelId: 99, labelPrinted: false });
    expect(second).toBe(false);
  });

  it('counts pending items per task', () => {
    items.bulkInsert(taskId, [
      { poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28', arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: 'R1', itemDescription: 'D', qtyExpected: 100, defaultRecvDesignator: '' },
      { poId: 1, poNo: 'PO-1', poDetailId: 11, poReleaseId: 101, promiseDate: '2026-05-29', arInvtId: 501, itemClass: 'B', itemNo: 'ITM-2', itemRev: '', itemDescription: 'E', qtyExpected: 50, defaultRecvDesignator: '' },
    ]);
    expect(items.countPending(taskId)).toBe(2);
  });
});
