@echo off
setlocal
set "PATH=C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;%PATH%"
call :load_user_env MINIMAX_API_KEY
call :load_user_env OPENAI_API_KEY
call :load_user_env OPENCLAW_FEISHU_APP_SECRET
call :load_user_env OPENCLAW_GATEWAY_TOKEN
set "OPENCLAW_NODE=C:\Program Files\nodejs\node.exe"
set "OPENCLAW_ENTRY=C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js"
set "OPENCLAW_CONFIG_PATH=C:\Users\71976\.openclaw\openclaw.json"
set "OPENCLAW_STATE_DIR=C:\Users\71976\.openclaw"
cd /d C:\Users\71976
"%OPENCLAW_NODE%" "%OPENCLAW_ENTRY%" gateway run --port 18789 --ws-log compact
exit /b 0

:load_user_env
for /f "skip=2 tokens=1,2,*" %%A in ('reg query HKCU\Environment /v %~1 2^>nul') do if /I "%%A"=="%~1" set "%~1=%%C"
exit /b 0
