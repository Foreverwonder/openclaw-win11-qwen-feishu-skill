@echo off
setlocal
title OpenClaw Gateway Supervisor

set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"
set "OPENCLAW_START=C:\Users\71976\.openclaw\gateway-start.cmd"
set "OPENCLAW_PORT=18789"
set "OPENCLAW_LOG=C:\Users\71976\.openclaw\gateway-supervisor.log"

:loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:%OPENCLAW_PORT%/' -TimeoutSec 5; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto sleep

netstat -ano | findstr /R /C:":%OPENCLAW_PORT% .*LISTENING" >nul 2>&1
if errorlevel 1 (
  echo [%date% %time%] starting gateway on %OPENCLAW_PORT%>> "%OPENCLAW_LOG%"
  start "OpenClaw Gateway" /min cmd /c ""%OPENCLAW_START%" >> "%OPENCLAW_LOG%" 2>&1"
  timeout /t 8 /nobreak >nul
)

:sleep
timeout /t 15 /nobreak >nul
goto loop
