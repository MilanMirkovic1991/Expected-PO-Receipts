@echo off
echo Stopping Expected PO Receipts processes...
taskkill /FI "WINDOWTITLE eq epr-backend*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq epr-frontend*" /T /F >nul 2>&1
echo Done.
