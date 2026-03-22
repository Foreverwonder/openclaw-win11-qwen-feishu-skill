@echo off
setlocal

set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"
call :load_user_env MINIMAX_API_KEY
call :load_user_env OPENAI_API_KEY
call :load_user_env OPENCLAW_FEISHU_APP_SECRET
call :load_user_env OPENCLAW_GATEWAY_TOKEN
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "SUPERVISOR=C:\Users\71976\.openclaw\gateway-supervisor.cmd"
set "GATEWAY_START=C:\Users\71976\.openclaw\gateway-start.cmd"
set "URL=http://127.0.0.1:18789/"

start "" /min cmd /c ""%SUPERVISOR%""
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:18789/' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "" /min cmd /c ""%GATEWAY_START%""
  timeout /t 4 /nobreak >nul
)

set /a tries=0
:wait_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:18789/' -TimeoutSec 5; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto ready

set /a tries=%tries%+1
if %tries% GEQ 6 goto open_default
timeout /t 3 /nobreak >nul
goto wait_loop

:ready
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$env:Path='C:\\Users\\71976\\.local\\bin;C:\\Users\\71976\\AppData\\Roaming\\npm;C:\\Program Files\\nodejs;'+$env:Path; $out = & openclaw dashboard --no-open 2>&1; $line = ($out | Select-String 'Dashboard URL:' | Select-Object -Last 1).Line; if ($line) { $line -replace '^.*Dashboard URL:\s*', '' }"`) do set "URL=%%I"

:open_default
if exist "%EDGE%" (
  start "" "%EDGE%" --new-tab --proxy-server="direct://" --proxy-bypass-list="<-loopback>;127.0.0.1;localhost;::1" "%URL%"
) else (
  start "" "%URL%"
)
exit /b 0

:load_user_env
for /f "skip=2 tokens=1,2,*" %%A in ('reg query HKCU\Environment /v %~1 2^>nul') do if /I "%%A"=="%~1" set "%~1=%%C"
exit /b 0
