-- Add vendor info to receipt items so the warehouse worker can see who the PO is from.
ALTER TABLE expected_receipt_item ADD COLUMN vendor_id INTEGER;
ALTER TABLE expected_receipt_item ADD COLUMN vendor_no TEXT;
ALTER TABLE expected_receipt_item ADD COLUMN vendor_name TEXT;
