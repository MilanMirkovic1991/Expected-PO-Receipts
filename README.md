# Expected PO Receipts

Web application (responsive desktop + mobile) that helps planners and warehouse staff handle expected receipts from DELMIAWORKS purchase orders.

## Requirements

- Node.js 20+
- Reachable DelmiaWorks WebAPI (e.g. `http://delmiaworks:8080/WebAPI`) + valid credentials
- SMTP relay (host/port/user/pass) for email notifications

## Setup

```bash
npm install
cp .env.example .env
# edit .env with your SMTP + SQLite path
```

## Dev

In two terminals:

```bash
npm run dev:backend   # http://localhost:3000
npm run dev:frontend  # http://localhost:5173
```

Or on Windows: `pokreni.bat` (and `zaustavi.bat` to stop).

Open http://localhost:5173, sign in with your DW credentials + EPlant ID, and use Planning to generate tasks for warehouse workers.

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

## Architecture

See [`docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md`](docs/superpowers/specs/2026-05-27-expected-po-receipts-design.md).
