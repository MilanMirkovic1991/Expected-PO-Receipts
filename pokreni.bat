@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo   Expected PO Receipts - pokretanje aplikacije
echo ============================================================
echo.

REM --- 1. Proveri Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo [GRESKA] Node.js nije instaliran ili nije u PATH-u.
  echo Preuzmi sa https://nodejs.org/ ^(verzija 20 ili novija^).
  pause
  exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo [OK] Node.js !NODE_VERSION! pronadjen.

REM --- 2. Proveri da li su zavisnosti instalirane ---
if not exist "node_modules" (
  echo.
  echo [INFO] node_modules nedostaje. Pokrecem 'npm install'...
  call npm install
  if errorlevel 1 (
    echo [GRESKA] npm install nije uspeo.
    pause
    exit /b 1
  )
)
echo [OK] Zavisnosti su instalirane.

REM --- 3. Proveri da li .env postoji, ako ne kopiraj iz example ---
if not exist ".env" (
  if exist ".env.example" (
    echo.
    echo [INFO] .env nedostaje. Kopiram iz .env.example...
    copy /Y ".env.example" ".env" >nul
    echo [VAZNO] Otvori .env i podesi SMTP kredencijale ako koristis email notifikacije.
  )
)

REM --- 4. Proveri da li backend vec radi ---
curl -s -o nul -w "%%{http_code}" --max-time 2 http://localhost:3000/health >temp_status.txt 2>nul
set /p BACKEND_STATUS=<temp_status.txt
del temp_status.txt >nul 2>&1

if "!BACKEND_STATUS!"=="200" (
  echo [INFO] Backend vec radi na portu 3000 - ne pokrecem duplikat.
) else (
  echo.
  echo [INFO] Pokrecem backend ^(http://localhost:3000^)...
  start "epr-backend" cmd /k "title epr-backend && npm --workspace backend run dev"
)

REM --- 5. Proveri da li frontend vec radi ---
curl -s -o nul -w "%%{http_code}" --max-time 2 http://localhost:5173/ >temp_status.txt 2>nul
set /p FRONTEND_STATUS=<temp_status.txt
del temp_status.txt >nul 2>&1

if "!FRONTEND_STATUS!"=="200" (
  echo [INFO] Frontend vec radi na portu 5173 - ne pokrecem duplikat.
) else (
  echo [INFO] Pokrecem frontend ^(http://localhost:5173^)...
  start "epr-frontend" cmd /k "title epr-frontend && npm --workspace frontend run dev"
)

REM --- 6. Sacekaj da backend bude spreman ---
echo.
echo [INFO] Cekam da backend bude spreman...
set RETRY=0
:WAIT_BACKEND
set /a RETRY+=1
if !RETRY! GTR 30 (
  echo [UPOZORENJE] Backend nije odgovorio za 30 sekundi. Otvaram aplikaciju svakako.
  goto OPEN_BROWSER
)
curl -s -o nul -w "%%{http_code}" --max-time 1 http://localhost:3000/health >temp_status.txt 2>nul
set /p HEALTH=<temp_status.txt
del temp_status.txt >nul 2>&1
if "!HEALTH!"=="200" (
  echo [OK] Backend je spreman ^(posle !RETRY! sekundi^).
  goto WAIT_FRONTEND
)
timeout /t 1 /nobreak >nul
goto WAIT_BACKEND

:WAIT_FRONTEND
echo [INFO] Cekam da frontend bude spreman...
set RETRY=0
:WAIT_FRONTEND_LOOP
set /a RETRY+=1
if !RETRY! GTR 30 goto OPEN_BROWSER
curl -s -o nul -w "%%{http_code}" --max-time 1 http://localhost:5173/ >temp_status.txt 2>nul
set /p FE=<temp_status.txt
del temp_status.txt >nul 2>&1
if "!FE!"=="200" (
  echo [OK] Frontend je spreman ^(posle !RETRY! sekundi^).
  goto OPEN_BROWSER
)
timeout /t 1 /nobreak >nul
goto WAIT_FRONTEND_LOOP

:OPEN_BROWSER
echo.
echo ============================================================
echo   Aplikacija je pokrenuta!
echo ============================================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:3000
echo.
echo   Za zaustavljanje pokreni: zaustavi.bat
echo.
echo Otvaram aplikaciju u browser-u...
start "" http://localhost:5173

endlocal
