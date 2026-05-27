CREATE TABLE expected_receipt_task (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_by_username TEXT NOT NULL,
  created_by_eplant_id INTEGER NOT NULL,
  assigned_to_employee_id INTEGER NOT NULL,
  assigned_to_username TEXT NOT NULL,
  assigned_to_email TEXT,
  assigned_to_name TEXT,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  cancelled_at TEXT,
  notification_sent_at TEXT,
  notification_error TEXT
);

CREATE TABLE expected_receipt_item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES expected_receipt_task(id) ON DELETE CASCADE,
  po_id INTEGER NOT NULL,
  po_no TEXT NOT NULL,
  po_detail_id INTEGER NOT NULL,
  po_release_id INTEGER NOT NULL,
  promise_date TEXT NOT NULL,
  ar_invt_id INTEGER NOT NULL,
  item_class TEXT,
  item_no TEXT NOT NULL,
  item_rev TEXT,
  item_description TEXT,
  qty_expected REAL NOT NULL,
  default_recv_designator TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  received_qty REAL,
  received_lot_no TEXT,
  received_location_id INTEGER,
  received_location_name TEXT,
  received_at TEXT,
  dw_receipt_id INTEGER,
  dw_master_label_id INTEGER,
  label_printed INTEGER DEFAULT 0,
  label_print_error TEXT,
  error_message TEXT
);

CREATE INDEX idx_task_assigned ON expected_receipt_task(assigned_to_username, status);
CREATE INDEX idx_task_created_by ON expected_receipt_task(created_by_username, created_at);
CREATE INDEX idx_item_task ON expected_receipt_item(task_id, status);
