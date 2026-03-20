@echo off
setlocal

set "ROOT=D:\AI_Projects\openclaw\control-center"
set "URL=http://127.0.0.1:18809/"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "SUPERVISOR=C:\Users\71976\.openclaw\gateway-supervisor.cmd"
set "GATEWAY_START=C:\Users\71976\.openclaw\gateway-start.cmd"
set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"

start "" /min cmd /c ""%SUPERVISOR%""
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:18789/' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "" /min cmd /c ""%GATEWAY_START%""
  set /a gateway_tries=0
  :gateway_wait_loop
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:18789/' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
  if not errorlevel 1 goto gateway_ready
  set /a gateway_tries=%gateway_tries%+1
  if %gateway_tries% GEQ 8 goto gateway_ready
  timeout /t 2 /nobreak >nul
  goto gateway_wait_loop
)
:gateway_ready

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing '%URL%' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  start "" /min cmd /c "node ""%ROOT%\server.js"" > ""%ROOT%\control-center.log"" 2>&1"
  timeout /t 3 /nobreak >nul
)

if exist "%EDGE%" (
  start "" "%EDGE%" --new-window --proxy-server="direct://" --proxy-bypass-list="<-loopback>;127.0.0.1;localhost;::1" "%URL%"
) else (
  start "" "%URL%"
)

endlocal
