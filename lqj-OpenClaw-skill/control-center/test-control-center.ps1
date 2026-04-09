$ErrorActionPreference = "Stop"

$launcher = "D:\AI_Projects\openclaw\openclaw-control-center.cmd"
$serverJs = "D:\AI_Projects\openclaw\control-center\server.js"
$url = "http://127.0.0.1:18809/"

function Get-ListeningPids {
  param(
    [int]$Port
  )

  @(
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
}

function Get-ControlCenterProcesses {
  $all = @(Get-CimInstance Win32_Process)
  $byId = @{}

  foreach ($proc in $all | Where-Object { $_.CommandLine -like "*control-center\server.js*" }) {
    $byId[$proc.ProcessId] = $proc
  }

  foreach ($ownerPid in Get-ListeningPids -Port 18809) {
    if (-not $byId.ContainsKey($ownerPid)) {
      $proc = $all | Where-Object { $_.ProcessId -eq $ownerPid } | Select-Object -First 1
      if ($proc) {
        $byId[$ownerPid] = $proc
      }
    }
  }

  @($byId.GetEnumerator() | Sort-Object Name | ForEach-Object { $_.Value })
}

function Get-SupervisorProcesses {
  Get-CimInstance Win32_Process |
    Where-Object { $_.CommandLine -like "*gateway-supervisor.cmd*" }
}

function Stop-ControlCenterProcesses {
  $procs = Get-ControlCenterProcesses
  foreach ($proc in $procs) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    } catch {
      Write-Host "skip stop $($proc.ProcessId): $($_.Exception.Message)"
    }
  }
}

function Stop-DuplicateSupervisors {
  $procs = @(Get-SupervisorProcesses | Sort-Object ProcessId)
  if ($procs.Count -le 1) {
    return
  }

  foreach ($proc in $procs | Select-Object -Skip 1) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    } catch {
      Write-Host "skip stop supervisor $($proc.ProcessId): $($_.Exception.Message)"
    }
  }
}

function Wait-Http200 {
  param(
    [string]$TargetUrl,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $TargetUrl -TimeoutSec 3
      if ($response.StatusCode -eq 200) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 800
    }
  }

  return $false
}

function Wait-ProcessCount {
  param(
    [scriptblock]$Getter,
    [int]$ExpectedCount,
    [int]$TimeoutSeconds = 10
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $items = @(& $Getter)
    if ($items.Count -eq $ExpectedCount) {
      return @($items)
    }
    Start-Sleep -Milliseconds 700
  } while ((Get-Date) -lt $deadline)

  return @(& $Getter)
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

Write-Host "== Baseline cleanup =="
Stop-ControlCenterProcesses
Stop-DuplicateSupervisors
Start-Sleep -Seconds 1

Write-Host "== Cold start launch =="
$env:OPENCLAW_NO_BROWSER = "1"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$launcher`"" -WindowStyle Hidden | Out-Null
$coldStartOk = Wait-Http200 -TargetUrl $url -TimeoutSeconds 20
Assert-True $coldStartOk "Cold start failed: control center did not respond with HTTP 200 on 18809."

$firstProcs = @(Wait-ProcessCount -Getter { Get-ControlCenterProcesses } -ExpectedCount 1)
Assert-True ($firstProcs.Count -eq 1) "Expected exactly 1 control-center process after cold start, got $($firstProcs.Count)."
$firstSupervisors = @(Wait-ProcessCount -Getter { Get-SupervisorProcesses } -ExpectedCount 1)
Assert-True ($firstSupervisors.Count -eq 1) "Expected exactly 1 gateway supervisor after cold start, got $($firstSupervisors.Count)."

Write-Host "== Repeat click launch =="
Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "`"$launcher`"" -WindowStyle Hidden | Out-Null
Start-Sleep -Seconds 4
$repeatOk = Wait-Http200 -TargetUrl $url -TimeoutSeconds 10
Assert-True $repeatOk "Second launch failed: control center did not stay reachable on 18809."

$secondProcs = @(Wait-ProcessCount -Getter { Get-ControlCenterProcesses } -ExpectedCount 1)
Assert-True ($secondProcs.Count -eq 1) "Expected exactly 1 control-center process after repeated launch, got $($secondProcs.Count)."
$secondSupervisors = @(Wait-ProcessCount -Getter { Get-SupervisorProcesses } -ExpectedCount 1)
Assert-True ($secondSupervisors.Count -eq 1) "Expected exactly 1 gateway supervisor after repeated launch, got $($secondSupervisors.Count)."

Write-Host ""
Write-Host "PASS"
Write-Host "cold_start_http200 = $coldStartOk"
Write-Host "repeat_launch_http200 = $repeatOk"
Write-Host "process_count = $($secondProcs.Count)"
Write-Host "supervisor_count = $($secondSupervisors.Count)"
