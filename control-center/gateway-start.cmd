@echo off
setlocal
set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"
set "OPENCLAW_NODE=C:\Program Files\nodejs\node.exe"
set "OPENCLAW_ENTRY=C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js"
set "OPENCLAW_CONFIG_PATH=C:\Users\71976\.openclaw\openclaw.json"
set "OPENCLAW_STATE_DIR=C:\Users\71976\.openclaw"
cd /d C:\Users\71976
"%OPENCLAW_NODE%" "%OPENCLAW_ENTRY%" gateway run --port 18789 --ws-log compact
