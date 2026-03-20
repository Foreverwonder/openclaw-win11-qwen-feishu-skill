$ErrorActionPreference = "Stop"

$Root = "D:\AI_Projects\openclaw\control-center"
$Url = "http://127.0.0.1:18809/"
$GatewayUrl = "http://127.0.0.1:18789/"
$ConfigPath = "C:\Users\71976\.openclaw\openclaw.json"
$Edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$NodeExe = "C:\Program Files\nodejs\node.exe"
$ServerJs = Join-Path $Root "server.js"
$Supervisor = "C:\Users\71976\.openclaw\gateway-supervisor.cmd"
$GatewayStart = "C:\Users\71976\.openclaw\gateway-start.cmd"

$env:Path = "C:\Users\71976\.local\bin;C:\Users\71976\AppData\Roaming\npm;C:\Program Files\nodejs;$env:Path"
$env:NO_PROXY = "localhost,127.0.0.1,::1"
$env:no_proxy = "localhost,127.0.0.1,::1"
$env:OPENCLAW_CONFIG_PATH = "C:\Users\71976\.openclaw\openclaw.json"
$env:OPENCLAW_STATE_DIR = "C:\Users\71976\.openclaw"

function Get-DashboardUrl {
  try {
    $config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
    $token = $config.gateway.auth.token
    if ($token) {
      return "http://127.0.0.1:18789/#token=$token"
    }
  } catch {
  }

  return $GatewayUrl
}

function Test-Http200 {
  param(
    [string]$TargetUrl,
    [int]$TimeoutSeconds = 3
  )

  try {
    $response = Invoke-WebRequest -UseBasicParsing $TargetUrl -TimeoutSec $TimeoutSeconds
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-Http200 {
  param(
    [string]$TargetUrl,
    [int]$Retries,
    [int]$DelaySeconds
  )

  for ($i = 0; $i -lt $Retries; $i++) {
    if (Test-Http200 -TargetUrl $TargetUrl) {
      return $true
    }
    Start-Sleep -Seconds $DelaySeconds
  }

  return $false
}

function Start-GatewayIfNeeded {
  Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $Supervisor -WindowStyle Minimized | Out-Null

  if (-not (Test-Http200 -TargetUrl $GatewayUrl -TimeoutSeconds 2)) {
    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $GatewayStart -WindowStyle Minimized | Out-Null
    [void](Wait-Http200 -TargetUrl $GatewayUrl -Retries 8 -DelaySeconds 2)
  }
}

function Start-ControlCenterIfNeeded {
  if (Test-Http200 -TargetUrl $Url -TimeoutSeconds 2) {
    return
  }

  $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*control-center\server.js*" }
  foreach ($proc in $procs) {
    try {
      Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    } catch {
    }
  }

  Start-Process -FilePath $NodeExe -ArgumentList $ServerJs -WindowStyle Hidden | Out-Null

  if (-not (Wait-Http200 -TargetUrl $Url -Retries 10 -DelaySeconds 1)) {
    throw "Control Center failed to start on 18809."
  }
}

Start-GatewayIfNeeded
Start-ControlCenterIfNeeded

if ($env:OPENCLAW_NO_BROWSER -ne "1") {
  $dashboardUrl = Get-DashboardUrl
  if (Test-Path $Edge) {
    Start-Process -FilePath $Edge -ArgumentList @(
      "--new-window",
      '--proxy-server=direct://',
      '--proxy-bypass-list=<-loopback>;127.0.0.1;localhost;::1',
      $Url,
      $dashboardUrl
    ) | Out-Null
  } else {
    Start-Process -FilePath $Url | Out-Null
    Start-Process -FilePath $dashboardUrl | Out-Null
  }
}
