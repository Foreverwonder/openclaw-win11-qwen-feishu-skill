---
name: openclaw-win11-qwen-feishu
description: Configure, repair, or verify OpenClaw on native Windows 11 when using Qwen Coding Plan through DashScope, Feishu integration, local dashboard access, and proxy or TUN software such as v2rayN or sing-box. Use for Win11-native OpenClaw installs, dashboard refused-connection issues, Qwen model wiring, Feishu channel setup, or when the gateway becomes unreliable under Scheduled Tasks.
---

# OpenClaw Win11 Qwen Feishu

Use this skill for the validated Win11-native setup that was made to work on this machine.

## Workflow

1. Confirm the environment before changing anything.
2. Prefer the stable local dashboard flow over the original Scheduled Task flow.
3. Configure Qwen Coding Plan as an OpenAI-compatible custom provider, not as Anthropic-compatible.
4. Verify Feishu separately from model setup.
5. End with concrete runtime checks, not config-only checks.

## Machine-Specific Paths

- OpenClaw config: `C:\Users\71976\.openclaw\openclaw.json`
- Main agent auth store: `C:\Users\71976\.openclaw\agents\main\agent\auth-profiles.json`
- Gateway direct starter: `C:\Users\71976\.openclaw\gateway-start.cmd`
- Stable dashboard launcher: `D:\AI_Projects\openclaw\openclaw-dashboard-stable.cmd`
- Stable control center launcher: `D:\AI_Projects\openclaw\openclaw-control-center.cmd`
- Control center PowerShell starter: `D:\AI_Projects\openclaw\control-center\start-control-center.ps1`
- Control center backend: `D:\AI_Projects\openclaw\control-center\server.js`
- Control center regression test: `D:\AI_Projects\openclaw\control-center\test-control-center.ps1`
- Gateway supervisor: `C:\Users\71976\.openclaw\gateway-supervisor.cmd`
- Startup watchdog: `C:\Users\71976\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\OpenClaw Gateway Watchdog.vbs`
- v2rayN root: `C:\Users\71976\Desktop\v2rayN-windows-64-desktop\v2rayN-windows-64`

## Dashboard Stability Rules

- Treat `schtasks` as unreliable on this Win11 machine even when the task says `Ready` or `Running`.
- Prefer the watchdog + supervisor flow for keeping the gateway alive, but do not rely on the supervisor alone.
- If the gateway is down, the most reliable recovery is to start `gateway-start.cmd` or a direct `node ... gateway run` path, then let the supervisor take over.
- Treat `127.0.0.1` as the canonical dashboard host.
- Avoid relying on `localhost` because this machine has shown loopback and IPv6 weirdness under TUN.
- If dashboard access fails, verify the local HTTP endpoint first with:

```powershell
Invoke-WebRequest http://127.0.0.1:18789/ -UseBasicParsing
```

- If that returns non-200 or connection failure, restore local access by launching:

```powershell
D:\AI_Projects\openclaw\openclaw-dashboard-stable.cmd
```

- If `18789` is still down, verify both ports:

```powershell
Get-NetTCPConnection -LocalPort 18789,18809 -State Listen -ErrorAction SilentlyContinue
```

- Treat these as separate health signals:
  - `18809` is the local management UI
  - `18789` is the real OpenClaw gateway and dashboard
- A healthy `18809` does not guarantee a healthy `18789`.

## Gateway Startup Rules

- This machine has shown several Win11-specific startup failures:
  - `node` missing from the environment under some launcher paths
  - the supervisor starting without the correct `OPENCLAW_CONFIG_PATH`
  - the browser opening before `18789` is actually ready
- Keep the startup chain simple and explicit:
  - `gateway-start.cmd` must set `OPENCLAW_CONFIG_PATH`
  - `gateway-start.cmd` must set `OPENCLAW_STATE_DIR`
  - `gateway-start.cmd` must use the absolute `node.exe` path
  - launchers should wait for `http://127.0.0.1:18789/` to return `200` before opening browser UI
- Prefer these file roles:
  - `gateway-start.cmd`: single source of truth for starting the gateway
  - `gateway-supervisor.cmd`: keepalive loop only
  - `openclaw-dashboard-stable.cmd`: dashboard opener with readiness wait
  - `openclaw-control-center.cmd`: management UI opener with readiness wait

## Control Center Rules

- The management UI lives at `http://127.0.0.1:18809/`.
- Prefer a dedicated PowerShell starter over nested `cmd/start/redirection` quoting.
- Use it as the default operator surface for:
  - gateway restart
  - dashboard opening
  - model switching
  - Feishu config
  - memory setup
  - logs and warnings
- The control center should:
  - cache-bust static assets with `Cache-Control: no-store`
  - mask secrets in the UI state payload
  - keep the result panel compact and collapsible
  - auto-refresh status
  - attempt background gateway recovery if `18789` is down
- The launcher should:
  - ensure `18789` before attempting `18809`
  - kill stale `server.js` processes before replacing them
  - only start a new `server.js` when `18809` is unhealthy
  - never stack multiple `gateway-supervisor.cmd` instances on repeated launches
  - support `OPENCLAW_NO_BROWSER=1` for non-interactive verification
- Manual stop behavior matters on this machine:
  - if the user manually stops gateway, do not auto-heal it immediately
  - preserve a manual-stop marker so background refresh does not restart `18789`
  - clear that marker only when the user explicitly chooses `拉起网关` or `重启网关`
- Do not trust browser-cached JS/CSS when a UI fix is claimed to be deployed; always verify the served page reflects the new controls.

## Qwen Coding Plan Rules

- Do not wire Qwen Coding Plan through Anthropic-compatible settings for OpenClaw.
- Configure it as a custom OpenAI-compatible provider that points to `https://coding.dashscope.aliyuncs.com/v1`.
- Use a custom provider id `qwen-coding-plan`.
- Use default model `qwen-coding-plan/qwen3.5-plus`.
- Store the API key in `env.QWEN_CODING_PLAN_API_KEY`.
- For this machine, direct model verification against the DashScope endpoint is more trustworthy than relying on a reused OpenClaw session test.

Supported model ids validated from official Qwen Code docs and local testing:

- `qwen3.5-plus`
- `qwen3-coder-plus`
- `qwen3-coder-next`
- `qwen3-max-2026-01-23`
- `glm-4.7`
- `kimi-k2.5`

Important naming rule:

- `kimi-k2.5` is valid
- `kimi k2.5` is invalid

The validated `openclaw.json` shape is:

```json
{
  "env": {
    "QWEN_CODING_PLAN_API_KEY": "..."
  },
  "models": {
    "mode": "merge",
    "providers": {
      "qwen-coding-plan": {
        "baseUrl": "https://coding.dashscope.aliyuncs.com/v1",
        "apiKey": "${QWEN_CODING_PLAN_API_KEY}",
        "api": "openai-completions",
        "models": [
          {
            "id": "qwen3.5-plus",
            "name": "Qwen 3.5 Plus (Qwen Coding Plan)",
            "reasoning": true,
            "input": ["text"]
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "qwen-coding-plan/qwen3.5-plus"
      }
    }
  }
}
```

## Model Switching Rules

- In the control center, model switching should favor preset buttons and a short form, not full raw config editing.
- After switching models, verify with a direct HTTP test to the provider endpoint rather than a session-bound agent test.
- A stale OpenClaw session can keep using an older model even after config changes.
- If a direct test succeeds but an agent turn still reports the old model, treat that as session/runtime state drift, not provider failure.

Direct verification shape:

```powershell
$body = @{
  model = "kimi-k2.5"
  messages = @(@{ role = "user"; content = "Reply with OK only." })
  max_tokens = 20
  temperature = 0
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post `
  -Uri "https://coding.dashscope.aliyuncs.com/v1/chat/completions" `
  -Headers @{ Authorization = "Bearer <QWEN_CODING_PLAN_API_KEY>" } `
  -ContentType "application/json" `
  -Body $body
```

## Feishu Rules

- Keep Feishu separate from model auth debugging.
- Validate Feishu in two steps:
  - OpenClaw channel status
  - Direct Feishu token exchange

Required config keys:

```json
{
  "channels": {
    "feishu": {
      "appId": "...",
      "appSecret": "...",
      "enabled": true
    }
  },
  "plugins": {
    "entries": {
      "feishu": {
        "enabled": true
      }
    }
  }
}
```

## v2rayN and TUN Rules

- Assume TUN can interfere with dashboard loopback access.
- Keep system proxy exceptions and TUN direct rules for `127.0.0.0/8`, `::1`, and `localhost`.
- Keep user environment variables:

```text
NO_PROXY=localhost,127.0.0.1,::1
no_proxy=localhost,127.0.0.1,::1
```

- If dashboard becomes flaky again, inspect:
  - `guiConfigs\guiNConfig.json`
  - `binConfigs\config.json`
  - `binConfigs\configPre.json`

## Required Verification

Run all of these before declaring success:

```powershell
openclaw config validate
openclaw models status --plain
openclaw channels status
openclaw dashboard --no-open
openclaw agent --agent main --message "Reply with OK only." --json --timeout 120
```

Expected results:

- `openclaw models status --plain` shows `qwen-coding-plan/qwen3.5-plus`
- `openclaw dashboard --no-open` prints a `127.0.0.1:18789` URL
- the agent test returns payload text `OK`

For this machine, also verify the direct provider path:

```powershell
Invoke-WebRequest http://127.0.0.1:18789/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:18809/ -UseBasicParsing
```

Expected results:

- both endpoints return `200`
- `18809` being healthy is not enough; `18789` must be healthy too
- when validating a newly switched model, prefer a direct `/v1/chat/completions` test
- if the direct test works and agent sessions do not, do not misdiagnose the provider

For the control center, also run the local regression script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\AI_Projects\openclaw\control-center\test-control-center.ps1"
```

Expected results:

- cold start reaches `http://127.0.0.1:18809/`
- repeated launcher clicks keep `18809` reachable
- repeated launcher clicks do not accumulate multiple `server.js` processes
- repeated launcher clicks do not accumulate multiple `gateway-supervisor.cmd` processes
- after an explicit manual stop, `18789` stays down while `18809` remains up

## Recovery Order

If something breaks, recover in this order:

1. Test `http://127.0.0.1:18789/`
2. Test `http://127.0.0.1:18809/`
3. Run `C:\Users\71976\.openclaw\gateway-start.cmd`
4. Run `D:\AI_Projects\openclaw\openclaw-dashboard-stable.cmd`
5. Confirm the watchdog path exists and the supervisor is running
6. Re-check `openclaw models status --plain`
7. Re-run the direct model test
8. Only then re-run an agent test if needed

Do not switch back to Anthropic-compatible Qwen wiring unless there is a new official document proving that route is now preferred.
