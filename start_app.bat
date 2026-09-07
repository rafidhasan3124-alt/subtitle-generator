@echo off
title AI Subtitle & SRT Generator Launcher
echo ======================================================
echo 🎬 Starting AI Subtitle & SRT Generator...
echo ======================================================

cd /d "%~dp0"

echo ⚙️ Setting up database...
call npm run db:setup > nul 2>&1

echo 🚀 Launching application at http://localhost:3000...
echo 💡 Please keep this window open while using the application.
echo ======================================================

start http://localhost:3000
call npm run dev
pause
