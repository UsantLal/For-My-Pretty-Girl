@echo off
cd /d "%~dp0"
echo Installing dependencies (if needed)...
npm install
echo Starting dev server in a new window...
start "Dev Server" cmd /k "npm run dev"
timeout /t 2 >nul
echo Opening browser...
start "" "http://localhost:5173"
exit /b 0
