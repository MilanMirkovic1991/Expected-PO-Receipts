import type { DB } from '../index.js';
import type { ItemInsert } from './items.js';

export type TaskRow = {
  id: number;
  created_by_username: string;
  created_by_eplant_id: number;
  assigned_to_employee_id: number;
  assigned_to_username: string;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  date_from: string;
  date_to: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;
};

export type TaskInsert = {
  createdByUsername: string;
  createdByEplantId: number;
  assignedToEmployeeId: number;
  assignedToUsername: string;
  assignedToEmail: string;
  assignedToName: string;
  dateFrom: string;
  dateTo: string;
};

export class TaskQueries {
  constructor(private db: DB) {}

  insert(input: TaskInsert): number {
    const stmt = this.db.prepare(`
      INSERT INTO expected_receipt_task
        (created_by_username, created_by_eplant_id, assigned_to_employee_id,
         assigned_to_username, assigned_to_email, assigned_to_name, date_from, date_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      input.createdByUsername, input.createdByEplantId, input.assignedToEmployeeId,
      input.assignedToUsername, input.assignedToEmail, input.assignedToName,
      input.dateFrom, input.dateTo,
    );
    return Number(res.lastInsertRowid);
  }

  getById(id: number): TaskRow | undefined {
    return this.db.prepare('SELECT * FROM expected_receipt_task WHERE id = ?').get(id) as TaskRow | undefined;
  }

  listMine(username: string): TaskRow[] {
    return this.db.prepare(`
      SELECT * FROM expected_receipt_task
      WHERE assigned_to_username = ? AND status IN ('open','in_progress')
      ORDER BY created_at DESC
    `).all(username) as TaskRow[];
  }

  /**
   * All open/in-progress tasks regardless of assignee.
   * PR_EMP has no UserName column so we cannot link a logged-in DW user to
   * a specific assignee record. Until we have that mapping, the Receiving
   * page shows every active task to anyone signed in.
   */
  listAllOpen(): TaskRow[] {
    return this.db.prepare(`
      SELECT * FROM expected_receipt_task
      WHERE status IN ('open','in_progress')
      ORDER BY created_at DESC
    `).all() as TaskRow[];
  }

  updateStatus(id: number, status: TaskRow['status']): void {
    const col = status === 'completed' ? 'completed_at' : status === 'cancelled' ? 'cancelled_at' : null;
    if (col) {
      this.db.prepare(`UPDATE expected_receipt_task SET status = ?, ${col} = datetime('now') WHERE id = ?`).run(status, id);
    } else {
      this.db.prepare('UPDATE expected_receipt_task SET status = ? WHERE id = ?').run(status, id);
    }
  }

  setNotificationResult(id: number, result: { success: boolean; error?: string }): void {
    if (result.success) {
      this.db.prepare(`UPDATE expected_receipt_task SET notification_sent_at = datetime('now'), notification_error = NULL WHERE id = ?`).run(id);
    } else {
      this.db.prepare(`UPDATE expected_receipt_task SET notification_error = ? WHERE id = ?`).run(result.error ?? 'unknown', id);
    }
  }

  insertWithItems(input: TaskInsert, itemInserts: ItemInsert[]): number {
    const insertTaskStmt = this.db.prepare(`
      INSERT INTO expected_receipt_task
        (created_by_username, created_by_eplant_id, assigned_to_employee_id,
         assigned_to_username, assigned_to_email, assigned_to_name, date_from, date_to)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertItemStmt = this.db.prepare(`
      INSERT INTO expected_receipt_item
        (task_id, po_id, po_no, po_detail_id, po_release_id, promise_date, ar_invt_id,
         item_class, item_no, item_rev, item_description, qty_expected, default_recv_designator,
         vendor_id, vendor_no, vendor_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((task: TaskInsert, items: ItemInsert[]) => {
      const res = insertTaskStmt.run(
        task.createdByUsername, task.createdByEplantId, task.assignedToEmployeeId,
        task.assignedToUsername, task.assignedToEmail, task.assignedToName,
        task.dateFrom, task.dateTo,
      );
      const taskId = Number(res.lastInsertRowid);
      for (const r of items) {
        insertItemStmt.run(
          taskId, r.poId, r.poNo, r.poDetailId, r.poReleaseId, r.promiseDate, r.arInvtId,
          r.itemClass, r.itemNo, r.itemRev, r.itemDescription, r.qtyExpected, r.defaultRecvDesignator,
          r.vendorId ?? null, r.vendorNo ?? null, r.vendorName ?? null,
        );
      }
      return taskId;
    });
    return tx(input, itemInserts);
  }
}
