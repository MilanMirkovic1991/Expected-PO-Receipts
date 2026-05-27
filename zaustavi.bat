@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo   Expected PO Receipts - zaustavljanje aplikacije
echo ============================================================
echo.

set STOPPED=0

REM --- Zaustavi po title-u (cmd prozori) ---
echo [INFO] Trazim cmd prozore...
taskkill /FI "WINDOWTITLE eq epr-backend*" /T /F >nul 2>&1
if not errorlevel 1 (
  echo [OK] Zatvoren backend cmd prozor.
  set /a STOPPED+=1
)
taskkill /FI "WINDOWTITLE eq epr-frontend*" /T /F >nul 2>&1
if not errorlevel 1 (
  echo [OK] Zatvoren frontend cmd prozor.
  set /a STOPPED+=1
)

REM --- Zaustavi node procese koji slusaju na portovima 3000 i 5173 ---
echo [INFO] Trazim Node procese na portovima 3000 i 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  if not errorlevel 1 (
    echo [OK] Zaustavljen PID %%a ^(port 3000^).
    set /a STOPPED+=1
  )
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  if not errorlevel 1 (
    echo [OK] Zaustavljen PID %%a ^(port 5173^).
    set /a STOPPED+=1
  )
)

echo.
if !STOPPED!==0 (
  echo [INFO] Nije bilo aktivnih procesa za zaustavljanje.
) else (
  echo [OK] Zaustavljeno !STOPPED! proces^(a^).
)
echo.
timeout /t 2 /nobreak >nul
endlocal
