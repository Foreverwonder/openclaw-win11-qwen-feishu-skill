@echo off
setlocal

set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"
set "EDGE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if not exist "%EDGE%" (
  echo Edge not found: %EDGE%
  exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$out = & openclaw dashboard --no-open 2>&1; $line = ($out | Select-String 'Dashboard URL:' | Select-Object -Last 1).Line; if ($line) { $line -replace '^.*Dashboard URL:\s*', '' }"`) do set "OPENCLAW_URL=%%I"

if not defined OPENCLAW_URL set "OPENCLAW_URL=http://127.0.0.1:18789/"

start "" "%EDGE%" --new-tab --proxy-server="direct://" --proxy-bypass-list="<-loopback>;127.0.0.1;localhost;::1" "%OPENCLAW_URL%"
