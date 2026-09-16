@echo off
title OHPA Fingerprint Dashboard Server
cd /d "%~dp0"
echo ========================================================
echo   Starting OHPA Fingerprint Dashboard Server (Port 3000)
echo ========================================================
echo.
npm run dev
pause
