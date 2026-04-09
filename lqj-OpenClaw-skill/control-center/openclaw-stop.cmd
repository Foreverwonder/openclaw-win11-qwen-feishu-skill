@echo off
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$statePath = 'D:\AI_Projects\openclaw\control-center\control-center-state.json';" ^
  "$state = if (Test-Path $statePath) { Get-Content -Raw $statePath | ConvertFrom-Json } else { [pscustomobject]@{} };" ^
  "$state | Add-Member -NotePropertyName gatewayManuallyStoppedAt -NotePropertyValue ([DateTime]::UtcNow.ToString('o')) -Force;" ^
  "$state | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $statePath;" ^
  "$patterns = @('gateway-supervisor.cmd', 'gateway-start.cmd', 'openclaw\dist\index.js"" gateway run', 'openclaw\dist\index.js gateway run');" ^
  "$procs = Get-CimInstance Win32_Process | Where-Object { $cmd = $_.CommandLine; $cmd -and ($patterns | Where-Object { $cmd -like ('*' + $_ + '*') }) };" ^
  "foreach ($p in $procs) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop } catch {} }"

endlocal
