@echo off
title OHPA Dashboard
cd /d "c:\Users\aa11909\OneDrive - Goodyear\Documents\AI\OHPA"

:: Check if port 3000 is already active
netstat -ano | findstr :3000 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    echo Starting OHPA Dev Server...
    start /b cmd /c "npm run dev"
    timeout /t 4 /nobreak >nul 2>&1
)

start "" "http://localhost:3000"
exit
