import type { DB } from '../index.js';

export type ItemRow = {
  id: number;
  task_id: number;
  po_id: number;
  po_no: string;
  po_detail_id: number;
  po_release_id: number;
  promise_date: string;
  ar_invt_id: number;
  item_class: string | null;
  item_no: string;
  item_rev: string | null;
  item_description: string | null;
  qty_expected: number;
  default_recv_designator: string | null;
  status: 'pending' | 'received' | 'failed';
  received_qty: number | null;
  received_lot_no: string | null;
  received_location_id: number | null;
  received_location_name: string | null;
  received_at: string | null;
  dw_receipt_id: number | null;
  dw_master_label_id: number | null;
  label_printed: number;
  label_print_error: string | null;
  error_message: string | null;
};

export type ItemInsert = {
  poId: number; poNo: string; poDetailId: number; poReleaseId: number;
  promiseDate: string; arInvtId: number;
  itemClass: string; itemNo: string; itemRev: string; itemDescription: string;
  qtyExpected: number; defaultRecvDesignator: string;
};

export type ReceiptDetails = {
  qty: number; lotNo: string;
  locationId: number; locationName: string;
  dwReceiptId: number; dwMasterLabelId: number;
  labelPrinted: boolean; labelPrintError?: string;
};

export class ItemQueries {
  constructor(private db: DB) {}

  bulkInsert(taskId: number, rows: ItemInsert[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO expected_receipt_item
        (task_id, po_id, po_no, po_detail_id, po_release_id, promise_date, ar_invt_id,
         item_class, item_no, item_rev, item_description, qty_expected, default_recv_designator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const tx = this.db.transaction((items: ItemInsert[]) => {
      for (const r of items) {
        stmt.run(taskId, r.poId, r.poNo, r.poDetailId, r.poReleaseId, r.promiseDate, r.arInvtId,
          r.itemClass, r.itemNo, r.itemRev, r.itemDescription, r.qtyExpected, r.defaultRecvDesignator);
      }
    });
    tx(rows);
  }

  getById(id: number): ItemRow | undefined {
    return this.db.prepare('SELECT * FROM expected_receipt_item WHERE id = ?').get(id) as ItemRow | undefined;
  }

  listByTask(taskId: number): ItemRow[] {
    return this.db.prepare(`
      SELECT * FROM expected_receipt_item
      WHERE task_id = ?
      ORDER BY promise_date ASC, id ASC
    `).all(taskId) as ItemRow[];
  }

  markReceived(id: number, r: ReceiptDetails): boolean {
    const result = this.db.prepare(`
      UPDATE expected_receipt_item
      SET status = 'received',
          received_qty = ?, received_lot_no = ?, received_location_id = ?, received_location_name = ?,
          received_at = datetime('now'),
          dw_receipt_id = ?, dw_master_label_id = ?,
          label_printed = ?, label_print_error = ?,
          error_message = NULL
      WHERE id = ? AND status = 'pending'
    `).run(r.qty, r.lotNo, r.locationId, r.locationName, r.dwReceiptId, r.dwMasterLabelId,
      r.labelPrinted ? 1 : 0, r.labelPrintError ?? null, id);
    return result.changes > 0;
  }

  markFailed(id: number, errorMessage: string, partial?: Partial<ReceiptDetails>): void {
    this.db.prepare(`
      UPDATE expected_receipt_item
      SET error_message = ?, dw_receipt_id = COALESCE(?, dw_receipt_id), dw_master_label_id = COALESCE(?, dw_master_label_id)
      WHERE id = ?
    `).run(errorMessage, partial?.dwReceiptId ?? null, partial?.dwMasterLabelId ?? null, id);
  }

  countPending(taskId: number): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM expected_receipt_item WHERE task_id = ? AND status = 'pending'`).get(taskId) as { c: number };
    return row.c;
  }
}
