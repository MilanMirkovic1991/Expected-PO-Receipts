@echo off
echo Starting Expected PO Receipts (backend + frontend)...
start "epr-backend" cmd /k npm run dev:backend
start "epr-frontend" cmd /k npm run dev:frontend
echo Open http://localhost:5173 when both processes are ready.
