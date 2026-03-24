---
name: openclaw-win11-qwen-feishu
description: Maintain OpenClaw on native Windows 11 with a MiniMax baseline, Qwen Coding Plan backup provider, Feishu integration, local dashboard access, and proxy or TUN software such as v2rayN or sing-box.
---

# OpenClaw Win11 Maintenance

Use this skill for the validated Win11-native setup that was made to work on this machine.

## Workflow

1. Confirm the environment before changing anything.
2. Prefer the stable local dashboard flow over the original Scheduled Task flow.
3. Keep secrets in SecretRef form and audit them before runtime testing.
4. Treat `minimax/MiniMax-M2.7-highspeed` via the third-party Anthropic-compatible endpoint as the current default baseline unless the user explicitly asks to switch back.
5. Keep Qwen Coding Plan configured as an OpenAI-compatible backup provider, not as Anthropic-compatible.
6. Verify Feishu separately from model setup.
7. End with concrete runtime checks, not config-only checks.

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

## Current Baseline

- As of `2026-03-24`, the default agent model on this machine is `minimax/MiniMax-M2.7-highspeed`.
- The validated provider base URL is `https://v2.aicodee.com`.
- Treat that MiniMax baseline as temporary and re-evaluate it by `2026-04-10`.
- Keep `qwen-coding-plan/kimi-k2.5` configured and directly probeable as the backup provider.

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
- SecretRefs failing to resolve because user environment variables were not imported into launcher processes
  - the browser opening before `18789` is actually ready
- Keep the startup chain simple and explicit:
  - `gateway-start.cmd` must set `OPENCLAW_CONFIG_PATH`
  - `gateway-start.cmd` must set `OPENCLAW_STATE_DIR`
  - `gateway-start.cmd` must use the absolute `node.exe` path
  - launchers must import the required user environment variables from `HKCU\Environment` before calling `openclaw`
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
  - resolve the dashboard URL via `openclaw dashboard --no-open`, not by assuming `gateway.auth.token` is plaintext in config
- Manual stop behavior matters on this machine:
  - if the user manually stops gateway, do not auto-heal it immediately
  - preserve a manual-stop marker so background refresh does not restart `18789`
  - clear that marker only when the user explicitly chooses `拉起网关` or `重启网关`
- Do not trust browser-cached JS/CSS when a UI fix is claimed to be deployed; always verify the served page reflects the new controls.

## Secrets and Hardening Rules

- Use SecretRef objects with the default env provider for all local secrets.
- On this machine, persist the required secrets in `HKCU\Environment`, not in `openclaw.json`, `auth-profiles.json`, `models.json`, or `~\.openclaw\.env`.
- The required environment variable names are:
  - `MINIMAX_API_KEY`
  - `ANTHROPIC_AUTH_TOKEN`
  - `ANTHROPIC_BASE_URL`
  - `OPENAI_API_KEY`
  - `OPENCLAW_FEISHU_APP_SECRET`
  - `OPENCLAW_GATEWAY_TOKEN`
- Do not leave plaintext secrets in:
  - `C:\Users\71976\.openclaw\openclaw.json`
  - `C:\Users\71976\.openclaw\agents\main\agent\auth-profiles.json`
  - `C:\Users\71976\.openclaw\agents\main\agent\models.json`
- Keep `secrets.providers.default.source=env`.
- Keep `tools.profile=coding` at the root and `agents.list.main.tools.profile=coding`.
- Do not add `agents.defaults.tools` on OpenClaw `2026.3.13`; this build rejects that key.
- Keep `plugins.allow` explicit and limited to trusted plugin ids.
- Keep `channels.feishu.tools.doc=false` unless the user explicitly needs Feishu doc creation from agent turns.
- Keep `gateway.trustedProxies` set to loopback addresses on this local-only machine: `127.0.0.1` and `::1`.
- After any secret or tool-surface change, run:

```powershell
openclaw secrets audit --check
openclaw security audit
```

## Third-Party MiniMax Rules

- For the current working MiniMax setup on this machine, do not use the old direct MiniMax portal path as the primary provider.
- Use a custom provider id `minimax` with:
  - `api = anthropic-messages`
  - `auth = api-key`
  - `baseUrl = https://v2.aicodee.com`
  - `apiKey = SecretRef(env:default:MINIMAX_API_KEY)`
  - `headers.x-api-key = SecretRef(env:default:MINIMAX_API_KEY)`
- Keep `ANTHROPIC_AUTH_TOKEN` mirrored to the same user secret as a compatibility helper for direct endpoint probes and control-center diagnostics.
- Keep `models.providers.minimax.models[0].id = MiniMax-M2.7-highspeed`.
- Keep `agents.defaults.model.primary` and `agents.list.main.model` identical.
- Keep `C:\Users\71976\.openclaw\agents\main\agent\models.json` aligned with `openclaw.json`; this file is part of the live auth/model resolution path on this machine.

The validated provider shape in `openclaw.json` is:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "minimax": {
        "api": "anthropic-messages",
        "apiKey": {
          "source": "env",
          "provider": "default",
          "id": "MINIMAX_API_KEY"
        },
        "auth": "api-key",
        "baseUrl": "https://v2.aicodee.com",
        "headers": {
          "x-api-key": {
            "source": "env",
            "provider": "default",
            "id": "MINIMAX_API_KEY"
          }
        },
        "models": [
          {
            "id": "MiniMax-M2.7-highspeed",
            "name": "MiniMax M2.7 Highspeed",
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
        "primary": "minimax/MiniMax-M2.7-highspeed"
      }
    },
    "list": [
      {
        "id": "main",
        "model": "minimax/MiniMax-M2.7-highspeed"
      }
    ]
  }
}
```

## Qwen Coding Plan Rules

- Do not wire Qwen Coding Plan through Anthropic-compatible settings for OpenClaw.
- Configure it as a custom OpenAI-compatible provider that points to `https://coding.dashscope.aliyuncs.com/v1`.
- Use a custom provider id `qwen-coding-plan`.
- Keep it as a backup provider while `minimax/MiniMax-M2.1` remains the baseline on this machine.
- On this machine, store the backup provider API key in SecretRef form pointing to `OPENAI_API_KEY`.
- Reason: in OpenClaw `2026.3.13`, `models.json` secret-marker audit only recognizes standard env marker names for OpenAI-compatible providers; `OPENAI_API_KEY` keeps `openclaw secrets audit --check` clean.
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

The validated backup-provider shape in `openclaw.json` is:

```json
{
  "secrets": {
    "providers": {
      "default": {
        "source": "env"
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "qwen-coding-plan": {
        "baseUrl": "https://coding.dashscope.aliyuncs.com/v1",
        "apiKey": {
          "source": "env",
          "provider": "default",
          "id": "OPENAI_API_KEY"
        },
        "api": "openai-completions",
        "models": [
          {
            "id": "kimi-k2.5",
            "name": "kimi-k2.5 (Coding Plan)",
            "reasoning": true,
            "input": ["text"]
          }
        ]
      }
    }
  }
}
```

## Model Switching Rules

- In the control center, model switching should favor preset buttons and a short form, not full raw config editing.
- After switching models, verify in this order:
  - config write result
  - control-center direct provider test
  - fresh process runtime state
  - fresh local agent run
- A stale OpenClaw session or stale `server.js` process can keep using an older model even after config changes.
- If a direct test succeeds but an agent turn still reports the old model, treat that as runtime state drift until proven otherwise.
- Do not trust only `agents.defaults.model.primary`; also check `agents.list.main.model`.
- Do not trust only `openclaw.json`; also check `C:\Users\71976\.openclaw\agents\main\agent\models.json`.
- Do not trust only the control-center page; verify the actual owner process and creation time on `18809`.

Common false-success patterns on this machine:

- The UI writes `agents.defaults.model.primary` but leaves `agents.list.main.model` unchanged.
- `openclaw.json` is updated but `agents\main\agent\models.json` still points to an old provider secret or old model.
- `18809` is still owned by an old `node.exe` process, so the new `server.js` code is not actually live.
- A third-party provider direct HTTP probe works, but the live agent still fails because the launcher process did not import the updated user environment variables.
- The control-center `testModel` API can look healthy while hitting the wrong endpoint if the old backend process is still serving.

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

Direct MiniMax verification shape:

```powershell
$body = @{
  model = "MiniMax-M2.7-highspeed"
  messages = @(@{ role = "user"; content = "Reply with OK only." })
  max_tokens = 128
  temperature = 0
} | ConvertTo-Json -Depth 6

Invoke-WebRequest -Method Post `
  -Uri "https://v2.aicodee.com/v1/messages" `
  -Headers @{
    Authorization = "Bearer <ANTHROPIC_AUTH_TOKEN>"
    "x-api-key" = "<ANTHROPIC_AUTH_TOKEN>"
    "anthropic-version" = "2023-06-01"
  } `
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
openclaw channels status --probe
openclaw secrets audit --check
openclaw security audit
openclaw dashboard --no-open
openclaw agent --agent main --message "Reply with OK only." --json --timeout 120
```

Expected results:

- `openclaw models status --plain` shows `minimax/MiniMax-M2.7-highspeed`
- `openclaw channels status --probe` reports Feishu `works`
- `openclaw secrets audit --check` exits clean
- `openclaw dashboard --no-open` prints a `127.0.0.1:18789` URL
- the agent test returns payload text `OK`
- `openclaw security audit` may still fail in local CLI mode on `2026.3.13` because the Feishu plugin attempts direct SecretRef resolution before consuming the gateway runtime snapshot; treat that as a version-specific CLI bug, not a broken gateway, when `channels status --probe` still reports `works`.

For this machine, also verify the direct provider path:

```powershell
Invoke-WebRequest http://127.0.0.1:18789/ -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:18809/ -UseBasicParsing
```

Expected results:

- both endpoints return `200`
- `18809` being healthy is not enough; `18789` must be healthy too
- when validating a newly switched model, prefer a direct provider endpoint test plus a fresh local agent run
- if the direct test works and agent sessions do not, do not misdiagnose the provider until stale processes and env import are ruled out
- when checking `18809`, verify the owning process and its creation time to avoid talking to an old backend
- when checking the control center's `testModel`, confirm the returned endpoint matches the intended provider path

For the current MiniMax baseline, the minimum required success proof is:

```powershell
$body = @{ action = "testModel" } | ConvertTo-Json
Invoke-WebRequest http://127.0.0.1:18809/api/action -Method Post -ContentType "application/json" -Body $body -UseBasicParsing

$env:MINIMAX_API_KEY = [Environment]::GetEnvironmentVariable("MINIMAX_API_KEY", "User")
$env:ANTHROPIC_AUTH_TOKEN = [Environment]::GetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "User")
& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" agent --local --agent main --message "Reply with OK only." --json
```

Expected results:

- `testModel` returns endpoint `https://v2.aicodee.com/v1/messages`
- `testModel` returns content `OK`
- the fresh local agent run returns payload text `OK`
- the fresh local agent run reports provider `minimax` and model `MiniMax-M2.7-highspeed`

For the control center, also run the local regression script:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\AI_Projects\openclaw\control-center\test-control-center.ps1"
```

Expected results:

- cold start reaches `http://127.0.0.1:18809/`
- repeated launcher clicks keep `18809` reachable
- repeated launcher clicks do not accumulate multiple `18809` owner processes
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
