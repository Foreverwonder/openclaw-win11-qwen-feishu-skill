@echo off
setlocal

set "ROOT=D:\AI_Projects\openclaw\control-center"
set "URL=http://127.0.0.1:18809/"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"

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
