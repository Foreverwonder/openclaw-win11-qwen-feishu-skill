@echo off
setlocal

set "SCRIPT=D:\AI_Projects\openclaw\control-center\start-control-center.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"

endlocal
