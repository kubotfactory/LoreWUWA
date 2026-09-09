@echo off
setlocal
title Tethys's Archive - Dev Server
cd /d "%~dp0"

echo.
echo  ============================================
echo    Tethys's Archive - Dev Server
echo  ============================================
echo.

where npm >nul 2>nul
if errorlevel 1 goto nonode

rem Check for the actual Windows binary, not just the folder.
rem A node_modules installed on another OS will fail this check.
if exist "node_modules\.bin\vite.cmd" goto run

if exist "node_modules\" (
    echo  [!] node_modules is missing or was installed for another system.
    echo      Removing it and reinstalling...
    echo.
    rmdir /s /q "node_modules"
    if exist "package-lock.json" del /q "package-lock.json"
)

echo  [1/2] Installing dependencies, please wait...
echo.
call npm install
if errorlevel 1 goto failed
if not exist "node_modules\.bin\vite.cmd" goto failed
echo.

:run
echo  [2/2] Starting dev server...
echo        The browser will open automatically.
echo        Press Ctrl+C or close this window to stop.
echo.
call npm run dev:open
echo.
echo  Dev server stopped.
pause
exit /b 0

:nonode
echo  [!] Node.js not found on this computer.
echo      Install it from https://nodejs.org then run this file again.
echo.
pause
exit /b 1

:failed
echo.
echo  [!] npm install failed.
echo      Check your internet connection, then try running:
echo          npm install
echo      manually in this folder to see the full error.
echo.
pause
exit /b 1
