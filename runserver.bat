@echo off
setlocal
title Tethys's Archive - Server (port 8220)
cd /d "%~dp0"

set PORT=8220

echo.
echo  ============================================
echo    Tethys's Archive - Public Server
echo    Port: %PORT%
echo  ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 goto nonode

rem node_modules installed on another OS will not have vite.cmd
if exist "node_modules\.bin\vite.cmd" goto build

if exist "node_modules\" (
    echo  [!] node_modules is missing or built for another system. Reinstalling...
    echo.
    rmdir /s /q "node_modules"
    if exist "package-lock.json" del /q "package-lock.json"
)
echo  [1/3] Installing dependencies...
echo.
call npm install
if errorlevel 1 goto failed
if not exist "node_modules\.bin\vite.cmd" goto failed
echo.

:build
echo  [2/3] Building site...
echo.
call npm run build
if errorlevel 1 goto buildfail
echo.

echo  [3/3] Starting server on all interfaces, port %PORT%
echo.
echo    On this PC        http://localhost:%PORT%/
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=* delims= " %%B in ("%%A") do echo    On this network   http://%%B:%PORT%/
)

rem Look up the WAN address from an external echo service
set "PUBIP="
where curl >nul 2>nul
if not errorlevel 1 (
    for /f "usebackq delims=" %%I in (`curl -s -m 6 https://api.ipify.org 2^>nul`) do set "PUBIP=%%I"
    if not defined PUBIP (
        for /f "usebackq delims=" %%I in (`curl -s -m 6 https://ifconfig.me/ip 2^>nul`) do set "PUBIP=%%I"
    )
)
if defined PUBIP (
    echo    Public ^(internet^)  http://%PUBIP%:%PORT%/
) else (
    echo    Public ^(internet^)  could not detect WAN IP - check your router status page
)
echo.
echo    Windows Firewall may ask to allow Node.js the first time. Allow it,
echo    otherwise nobody outside this PC can connect.
echo.
echo    Press Ctrl+C or close this window to stop the server.
echo.

call npm run serve

echo.
echo  Server stopped.
pause
exit /b 0

:nonode
echo  [!] Node.js not found on this computer.
echo      Install it from https://nodejs.org then run this file again.
echo.
pause
exit /b 1

:buildfail
echo.
echo  [!] Build failed. Fix the error above, then run this file again.
echo.
pause
exit /b 1

:failed
echo.
echo  [!] npm install failed. Check your internet connection, then run:
echo          npm install
echo      manually in this folder to see the full error.
echo.
pause
exit /b 1
