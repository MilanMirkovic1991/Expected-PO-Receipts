import type { TaskQueries, TaskRow } from '../db/queries/tasks.js';
import type { ItemQueries, ItemInsert } from '../db/queries/items.js';
import type { Mailer } from './mailer.js';
import type { NotificationService } from './notificationService.js';
import { logger } from '../logger.js';

export type AppError = Error & { code: string };
function appError(code: string, message: string): AppError {
  const e = new Error(message) as AppError;
  e.code = code;
  return e;
}

export type CreateTaskInput = {
  createdByUsername: string;
  createdByEplantId: number;
  assignedTo: { id: number; username: string; email: string; name: string };
  dateFrom: string;
  dateTo: string;
  items: ItemInsert[];
};

export type ReceiveItemInput = {
  taskId: number;
  itemId: number;
  dw: {
    poReceipts: { createAndPost(i: any): Promise<{ receiptId: number; masterLabelId: number }> };
    labels: { printPurchased(i: { masterLabelId: number; printerName: string; qty: number }): Promise<{ printed: true }> };
  };
  input: { qty: number; lotNo: string; locationId: number; locationName: string; printerName: string };
  sessionUsername: string;
};

export type ReceiveItemResult = {
  itemStatus: 'received';
  dwReceiptId: number;
  taskStatus: TaskRow['status'];
  labelPrinted: boolean;
  labelPrintError?: string;
};

export function createTaskService(deps: {
  tasks: TaskQueries; items: ItemQueries; mailer: Mailer; notif: NotificationService;
}) {
  return {
    async createTask(input: CreateTaskInput): Promise<{ taskId: number; itemCount: number }> {
      const taskId = deps.tasks.insert({
        createdByUsername: input.createdByUsername,
        createdByEplantId: input.createdByEplantId,
        assignedToEmployeeId: input.assignedTo.id,
        assignedToUsername: input.assignedTo.username,
        assignedToEmail: input.assignedTo.email,
        assignedToName: input.assignedTo.name,
        dateFrom: input.dateFrom, dateTo: input.dateTo,
      });
      deps.items.bulkInsert(taskId, input.items);

      if (input.assignedTo.email) {
        const r = await deps.mailer.sendTaskCreated({
          toEmail: input.assignedTo.email, taskId,
          itemCount: input.items.length,
          dateRange: `${input.dateFrom} .. ${input.dateTo}`,
        });
        deps.tasks.setNotificationResult(taskId, r.success ? { success: true } : { success: false, error: r.error });
      } else {
        deps.tasks.setNotificationResult(taskId, { success: false, error: 'no email on employee' });
      }

      deps.notif.broadcast({
        to: input.assignedTo.username, event: 'new_task',
        payload: { taskId, itemCount: input.items.length, dateRange: `${input.dateFrom} .. ${input.dateTo}` },
      });

      logger.info({ taskId, itemCount: input.items.length, assignedTo: input.assignedTo.username }, 'task.created');
      return { taskId, itemCount: input.items.length };
    },

    async receiveItem(input: ReceiveItemInput): Promise<ReceiveItemResult> {
      const item = deps.items.getById(input.itemId);
      if (!item || item.task_id !== input.taskId) throw appError('NOT_FOUND', 'item not found');
      if (item.status === 'received') throw appError('ITEM_ALREADY_RECEIVED', 'item already received');
      const task = deps.tasks.getById(input.taskId);
      if (!task) throw appError('NOT_FOUND', 'task not found');
      if (task.status === 'completed' || task.status === 'cancelled') throw appError('TASK_COMPLETED', `task is ${task.status}`);

      if (input.input.qty <= 0) throw appError('INVALID_QTY', 'qty must be > 0');
      if (input.input.qty > item.qty_expected) throw appError('INVALID_QTY', 'qty exceeds expected');

      if (task.status === 'open') deps.tasks.updateStatus(input.taskId, 'in_progress');

      // DW orchestration
      const { receiptId, masterLabelId } = await input.dw.poReceipts.createAndPost({
        poDetailId: item.po_detail_id,
        poReleaseId: item.po_release_id,
        qty: input.input.qty,
        lotNo: input.input.lotNo,
        locationId: input.input.locationId,
        comment: `Task #${input.taskId}`,
        username: input.sessionUsername,
      });

      let labelPrinted = false;
      let labelPrintError: string | undefined;
      try {
        await input.dw.labels.printPurchased({ masterLabelId, printerName: input.input.printerName, qty: input.input.qty });
        labelPrinted = true;
      } catch (e: any) {
        labelPrintError = String(e?.message ?? 'label print failed');
        logger.warn({ taskId: input.taskId, itemId: input.itemId, receiptId, masterLabelId, err: labelPrintError }, 'label.print.failed');
      }

      deps.items.markReceived(input.itemId, {
        qty: input.input.qty, lotNo: input.input.lotNo,
        locationId: input.input.locationId, locationName: input.input.locationName,
        dwReceiptId: receiptId, dwMasterLabelId: masterLabelId,
        labelPrinted, labelPrintError,
      });

      const pending = deps.items.countPending(input.taskId);
      if (pending === 0) {
        deps.tasks.updateStatus(input.taskId, 'completed');
        logger.info({ taskId: input.taskId }, 'task.completed');
      }
      const final = deps.tasks.getById(input.taskId)!;

      return { itemStatus: 'received', dwReceiptId: receiptId, taskStatus: final.status, labelPrinted, labelPrintError };
    },
  };
}
