import { describe, it, expect, beforeEach, vi } from 'vitest';
import { openDb, DB } from '../../src/db/index.js';
import { runMigrations } from '../../src/db/migrate.js';
import { TaskQueries } from '../../src/db/queries/tasks.js';
import { ItemQueries } from '../../src/db/queries/items.js';
import { createTaskService } from '../../src/services/taskService.js';

let db: DB, tasks: TaskQueries, items: ItemQueries;
beforeEach(() => {
  db = openDb(':memory:');
  runMigrations(db);
  tasks = new TaskQueries(db);
  items = new ItemQueries(db);
});

function fakeDw(overrides: Partial<any> = {}) {
  return {
    poReceipts: { createAndPost: vi.fn().mockResolvedValue({ receiptId: 555, masterLabelId: 999 }) },
    labels: { printPurchased: vi.fn().mockResolvedValue({ printed: true }) },
    locations: { listForItem: vi.fn().mockResolvedValue([{ id: 7, code: 'A1', description: 'A1' }]) },
    ...overrides,
  };
}

function fakeMailer() { return { sendTaskCreated: vi.fn().mockResolvedValue({ success: true, messageId: 'm1' }) }; }
function fakeNotif() { return { subscribe: vi.fn(), broadcast: vi.fn(), countSubscribers: vi.fn() }; }

const item = {
  poId: 1, poNo: 'PO-1', poDetailId: 10, poReleaseId: 100, promiseDate: '2026-05-28',
  arInvtId: 500, itemClass: 'A', itemNo: 'ITM-1', itemRev: '', itemDescription: 'D',
  qtyExpected: 100, defaultRecvDesignator: '',
};

describe('taskService.createTask', () => {
  it('inserts task + items and notifies via SSE and email', async () => {
    const mailer = fakeMailer(); const notif = fakeNotif();
    const svc = createTaskService({ tasks, items, mailer, notif });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    expect(taskId).toBeTypeOf('number');
    expect(items.listByTask(taskId)).toHaveLength(1);
    expect(mailer.sendTaskCreated).toHaveBeenCalledOnce();
    expect(notif.broadcast).toHaveBeenCalledWith(expect.objectContaining({ to: 'worker', event: 'new_task' }));
  });
});

describe('taskService.receiveItem', () => {
  it('runs DW create → post → print, then marks item received', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    const dw = fakeDw();
    const out = await svc.receiveItem({
      taskId, itemId: it!.id, dw: dw as any,
      input: { qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1' },
      sessionUsername: 'worker',
    });
    expect(out.dwReceiptId).toBe(555);
    expect(out.labelPrinted).toBe(true);
    expect(out.taskStatus).toBe('completed');
    expect(items.getById(it!.id)?.status).toBe('received');
    expect(tasks.getById(taskId)?.status).toBe('completed');
  });

  it('returns labelPrinted=false but item still received when print fails', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    const dw = fakeDw({
      labels: { printPurchased: vi.fn().mockRejectedValue(Object.assign(new Error('no printer'), { code: 'DW_LABEL_PRINT_FAILED' })) },
    });
    const out = await svc.receiveItem({
      taskId, itemId: it!.id, dw: dw as any,
      input: { qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1' },
      sessionUsername: 'worker',
    });
    expect(out.dwReceiptId).toBe(555);
    expect(out.labelPrinted).toBe(false);
    expect(items.getById(it!.id)?.status).toBe('received');
  });

  it('rejects when item not pending', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    items.markReceived(it!.id, { qty: 100, lotNo: 'L', locationId: 1, locationName: 'X', dwReceiptId: 1, dwMasterLabelId: 2, labelPrinted: true });
    await expect(svc.receiveItem({
      taskId, itemId: it!.id, dw: fakeDw() as any,
      input: { qty: 100, lotNo: 'LOT-A', locationId: 7, locationName: 'A1', printerName: 'P1' },
      sessionUsername: 'worker',
    })).rejects.toMatchObject({ code: 'ITEM_ALREADY_RECEIVED' });
  });

  it('rejects qty <= 0 with INVALID_QTY', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    await expect(svc.receiveItem({
      taskId, itemId: it!.id, dw: fakeDw() as any,
      input: { qty: 0, lotNo: 'L', locationId: 1, locationName: 'X', printerName: 'P1' },
      sessionUsername: 'worker',
    })).rejects.toMatchObject({ code: 'INVALID_QTY' });
  });

  it('rejects qty > qtyExpected with INVALID_QTY', async () => {
    const svc = createTaskService({ tasks, items, mailer: fakeMailer(), notif: fakeNotif() });
    const { taskId } = await svc.createTask({
      createdByUsername: 'planner', createdByEplantId: 1,
      assignedTo: { id: 42, username: 'worker', email: 'w@x', name: 'Worker' },
      dateFrom: '2026-05-27', dateTo: '2026-06-03', items: [item],
    });
    const [it] = items.listByTask(taskId);
    await expect(svc.receiveItem({
      taskId, itemId: it!.id, dw: fakeDw() as any,
      input: { qty: 999, lotNo: 'L', locationId: 1, locationName: 'X', printerName: 'P1' },
      sessionUsername: 'worker',
    })).rejects.toMatchObject({ code: 'INVALID_QTY' });
  });
});
