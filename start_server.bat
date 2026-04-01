@echo off
echo =========================================
echo  DrawDraw Server Startup Tool
echo =========================================
echo.

echo [1] Cleaning up previous processes...
echo Checking for processes using port 3000.
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    echo Found process PID: %%a. Terminating...
    taskkill /f /pid %%a > nul 2>&1
    echo Terminated successfully. Port 3000 is free!
)
echo.

echo [2] Building Frontend...
echo Applying your latest code changes (May take a few seconds)
call npm run build:all
echo.

echo [3] Starting server...
echo Serving app on http://localhost:3000
echo.
echo Press [Ctrl + C] or close this window to stop the server.
echo =========================================
echo.

node server/index.js

pause
