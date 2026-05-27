# Expected PO Receipts

Web application (responsive desktop + mobile) that helps planners and warehouse staff handle expected receipts from DELMIAWORKS purchase orders.

## Workflow

1. **Planning** — Planner enters a date range, reviews open PO release items grouped by Promise Date, selects items, picks a warehouse worker, and generates an "Expected POs" task.
2. **Receiving** — Warehouse worker opens the task via in-app notification or email link, enters Lot No / Qty / Location per item, and confirms receipt. The app then performs `CreatePOReceipt` → `PostPOReceiptAndUpdateMasterLabel` → `PrintPurchased` against the DELMIAWORKS WebAPI.

## Status

Design phase complete. See [`docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md`](docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md) for the full design document.

## Tech stack

- **Backend:** Node.js 20+ / TypeScript / Express, axios for DW WebAPI, better-sqlite3, nodemailer, pino
- **Frontend:** React 18 / TypeScript / Vite, TanStack Query, Zustand, React Router
- **Storage:** SQLite (file-based)
- **Notifications:** Server-Sent Events (in-app) + SMTP (email)
