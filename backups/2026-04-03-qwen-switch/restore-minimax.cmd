@echo off
REM Restore to previous MiniMax baseline
REM Created: 2026-04-03 by Claude Code
REM This restores the config that was backed up before the Qwen switch

echo === Restoring previous MiniMax config ===
echo.

REM Kill existing gateway
for /f "tokens=2 delims=," %%i in ('netstat -ano ^| findstr ":18789" ^| findstr "LISTEN"') do (
    echo Killing process %%i
    taskkill /F /PID %%i >nul 2>&1
)

REM Restore backup configs
if exist "openclaw.json.bak" (
    copy /Y "openclaw.json.bak" "C:\Users\71976\.openclaw\openclaw.json" >nul
    echo Restored openclaw.json
)
if exist "models.json.bak" (
    copy /Y "models.json.bak" "C:\Users\71976\.openclaw\agents\main\agent\models.json" >nul
    echo Restored models.json
)
if exist "gateway-start.cmd.bak" (
    copy /Y "gateway-start.cmd.bak" "C:\Users\71976\.openclaw\gateway-start.cmd" >nul
    echo Restored gateway-start.cmd
)

echo.
echo === Restoration complete ===
echo Run gateway-start.cmd to start with the previous config
pause
