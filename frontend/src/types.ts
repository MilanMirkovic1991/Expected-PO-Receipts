export type SessionMe = { username: string; eplantId: number; email: string };

export type POReleaseRow = {
  poReleaseId: number; poDetailId: number; poId: number; poNo: string;
  arInvtId: number; itemClass: string; itemNo: string; itemRev: string;
  itemDescription: string; qtyExpected: number; promiseDate: string;
  defaultRecvDesignator: string;
};
export type ReleaseGroup = { date: string; items: POReleaseRow[] };

export type Employee = { id: number; displayName: string; username: string; email: string; badge: string };
export type LocationRow = { id: number; code: string; description: string; isReceive: boolean };

export type TaskSummary = { id: number; status: 'open' | 'in_progress' | 'completed' | 'cancelled'; createdAt: string; createdBy: string; dateFrom: string; dateTo: string };

export type TaskItem = {
  id: number; task_id: number; po_no: string; po_detail_id: number; po_release_id: number;
  promise_date: string; ar_invt_id: number; item_class: string | null; item_no: string;
  item_rev: string | null; item_description: string | null; qty_expected: number;
  default_recv_designator: string | null;
  status: 'pending' | 'received' | 'failed';
  received_qty: number | null; received_lot_no: string | null;
  received_location_id: number | null; received_location_name: string | null;
  received_at: string | null; dw_receipt_id: number | null;
  label_printed: number; label_print_error: string | null; error_message: string | null;
};

export type TaskDetail = { task: TaskSummary & { assigned_to_username: string; created_by_username: string }; items: TaskItem[] };
