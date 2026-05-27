import type { DB } from '../index.js';

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
}
