---
name: "lqj-OpenClaw-skill"
description: "Master skill for OpenClaw Win11 maintenance, Qwen/Feishu integration, and ECC Heartbeat automated optimization loop. Invoke to manage OpenClaw or run heartbeat."
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

- As of `2026-04-03`, the default agent model on this machine is `openrouter/qwen/qwen3.6-plus:free` (via OpenRouter, Anthropic Messages API).
- The validated provider base URL is `https://openrouter.ai/api`.
- The previous MiniMax baseline (`minimax/MiniMax-M2.7-highspeed` via `https://v2.aicodee.com`) was backed up to `D:\AI_Projects\openclaw\backups\2026-04-03-qwen-switch\`.
- A one-click restore script is available at `backups\2026-04-03-qwen-switch\restore-minimax.cmd`.
- Keep `qwen-coding-plan/kimi-k2.5` configuration preserved for potential future use (currently removed from live config).
- Feishu bot `OpenClaw_lqj` (appId: `cli_a90af31621789cd9`) remains active and unchanged.

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
- `gateway-start.cmd` must NOT load env vars that are no longer needed (e.g., MINIMAX_API_KEY, MODELSCOPE_API_KEY, OPENAI_API_KEY after switching to OpenRouter). Only load:
  - `ANTHROPIC_AUTH_TOKEN` (OpenRouter API key)
  - `ANTHROPIC_BASE_URL` (set to `https://openrouter.ai/api`)
  - `OPENCLAW_FEISHU_APP_SECRET`
  - `OPENCLAW_GATEWAY_TOKEN`

> **[CRITICAL UPDATE 2026-04-08: The Gateway Startup Crash Bug]**
> **ISSUE**: If the user switches models in the Control Center (e.g., back to MiniMax or Qwen Coding Plan), the Gateway fails to start and the Dashboard becomes inaccessible.
> **ROOT CAUSE**: `gateway-start.cmd` was hardcoded to only load `ANTHROPIC_AUTH_TOKEN`. When switching to a model that needs `MINIMAX_API_KEY` or `OPENAI_API_KEY`, the Gateway process boots with empty API keys, fails the model warmup, and crashes.
> **FIX**: `gateway-start.cmd` **MUST** be updated to load all potential API keys. Add these lines:
> `call :load_user_env MINIMAX_API_KEY`
> `call :load_user_env OPENAI_API_KEY`
> `call :load_user_env MODELSCOPE_API_KEY`
> Without these, the Control Center's model switching will fatally break the Gateway.
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

## OpenRouter Qwen Rules

- As of `2026-04-03`, the default agent model on this machine was switched from `minimax/MiniMax-M2.7-highspeed` to `openrouter/qwen/qwen3.6-plus:free`.
- OpenRouter provides an Anthropic Messages API compatible endpoint at `https://openrouter.ai/api`.
- Configure OpenRouter as a custom provider using Anthropic-compatible messages API, NOT OpenAI completions.
- Keep `ANTHROPIC_AUTH_TOKEN` set to the OpenRouter API key (`sk-or-v1-...`) in `HKCU\Environment`.
- Keep `ANTHROPIC_BASE_URL` set to `https://openrouter.ai/api` in `HKCU\Environment`.

The validated OpenRouter provider shape in `openclaw.json` is:

```json
{
  "models": {
    "mode": "merge",
    "providers": {
      "openrouter": {
        "baseUrl": "https://openrouter.ai/api",
        "auth": "api-key",
        "api": "anthropic-messages",
        "apiKey": {
          "source": "env",
          "provider": "default",
          "id": "ANTHROPIC_AUTH_TOKEN"
        },
        "headers": {
          "x-api-key": {
            "source": "env",
            "provider": "default",
            "id": "ANTHROPIC_AUTH_TOKEN"
          }
        },
        "models": [
          {
            "id": "qwen/qwen3.6-plus:free",
            "name": "Qwen 3.6 Plus (Free)",
            "reasoning": true,
            "input": ["text"],
            "cost": {
              "input": 0,
              "output": 0,
              "cacheRead": 0,
              "cacheWrite": 0
            },
            "contextWindow": 131072,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "openrouter/qwen/qwen3.6-plus:free"
      }
    },
    "list": [
      {
        "id": "main",
        "model": "openrouter/qwen/qwen3.6-plus:free",
        "tools": {
          "profile": "coding"
        }
      }
    ]
  }
}
```

Direct verification shape for OpenRouter:

```powershell
$body = @{
  model = "qwen/qwen3.6-plus:free"
  messages = @(@{ role = "user"; content = "Reply with OK only." })
  max_tokens = 20
  temperature = 0
  stream = $false
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Method Post `
  -Uri "https://openrouter.ai/api/v1/chat/completions" `
  -Headers @{ Authorization = "Bearer $env:ANTHROPIC_AUTH_TOKEN" } `
  -ContentType "application/json" `
  -Body $body
```

Anthropic-style API verification (OpenClaw uses this format):

```powershell
$body = @{
  model = "qwen/qwen3.6-plus:free"
  messages = @(@{ role = "user"; content = "Reply with OK only." })
  max_tokens = 20
} | ConvertTo-Json -Depth 6

Invoke-WebRequest -Method Post `
  -Uri "https://openrouter.ai/api/v1/messages" `
  -Headers @{
    Authorization = "Bearer $env:ANTHROPIC_AUTH_TOKEN"
    "HTTP-Referer" = "http://127.0.0.1:18789"
    "X-Title" = "OpenClaw"
  } `
  -ContentType "application/json" `
  -Body $body `
  -UseBasicParsing
```

Expected results:
- Direct OpenAI-style API test returns `choices[0].message.content` with model `qwen/qwen3.6-plus-04-02:free`
- Anthropic-style API test returns `content[0].text` with valid thinking content
- Gateway dashboard at `http://127.0.0.1:18789/` returns 200
- Local agent runs and responds correctly

## Model Switching Rules

- In the control center, model switching should favor preset buttons and a short form, not full raw config editing.
- After switching models, verify in this order:
  1. config write result (`openclaw.json` + `models.json` both updated)
  2. direct provider API test (OpenRouter chat completions + messages API)
  3. gateway restart with new `HKCU\Environment` vars loaded
  4. dashboard `http://127.0.0.1:18789/` returns 200
  5. fresh local agent run reports correct model
- A stale OpenClaw session or stale `server.js` process can keep using an older model even after config changes.
- If a direct test succeeds but an agent turn still reports the old model, treat that as runtime state drift until proven otherwise.
- Do not trust only `agents.defaults.model.primary`; also check `agents.list.main.model`.
- Do not trust only `openclaw.json`; also check `C:\Users\71976\.openclaw\agents\main\agent\models.json`.
- Do not trust only the control-center page; verify the actual owner process and creation time on `18809`.
- **Critical**: The running gateway process inherits its environment from its parent process. After changing `HKCU\Environment` values, you MUST kill the existing gateway process and start a fresh one — the old process will NOT pick up the new values.
- **Agent models.json cleanup**: When switching providers, `agents/main/agent/models.json` may still contain entries from old providers (minimax, minimax-portal, openai-codex, etc.). Clean it to only include the new active provider.

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

### Feishu Pairing

- The user's Feishu open_id is `ou_9d244abfcbfc335fab79ecf7d7dd6c1d`.
- This is stored in `C:\Users\71976\.openclaw\credentials\feishu-pairing.json` under `allowFrom`.
- The Feishu bot is `OpenClaw_lqj` (appId: `cli_a90af31621789cd9`).
- Pairing happens when the user first sends a message to the bot on Feishu — OpenClaw records the open_id automatically.

### Sending Messages to Feishu from CLI

To make the agent reply on Feishu (not just return text to the CLI):

```powershell
$env:ANTHROPIC_AUTH_TOKEN = [Environment]::GetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "User")
$env:ANTHROPIC_BASE_URL = [Environment]::GetEnvironmentVariable("ANTHROPIC_BASE_URL", "User")
$env:OPENCLAW_FEISHU_APP_SECRET = [Environment]::GetEnvironmentVariable("OPENCLAW_FEISHU_APP_SECRET", "User")
$env:OPENCLAW_GATEWAY_TOKEN = [Environment]::GetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN", "User")

& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" agent --agent main --channel feishu --to "ou_9d244abfcbfc335fab79ecf7d7dd6c1d" --message "你的消息内容" --deliver

# Required flags:
#   --channel feishu   -> selects the Feishu plugin as delivery channel
#   --to "ou_xxx"      -> the user's Feishu open_id from feishu-pairing.json
#   --deliver          -> actually sends the reply to the channel (without this, reply only goes to CLI)
```

Internal mechanism:
- When `--deliver` is used with `--channel feishu --to <open_id>`, the gateway creates a session keyed to that channel+target
- The agent receives the message, processes it, and uses `sessions_send` internally to route its reply back through the Feishu plugin
- The Feishu plugin calls `sendMessageFeishu` which uses the bot's `tenant_access_token` to POST to Feishu's IM API

### Agent-side Session Delivery

The agent can also send Feishu messages during a conversation using the `sessions_send` tool:

```json
{
  "tool": "sessions_send",
  "arguments": {
    "sessionKey": "feishu:ou_9d244abfcbfc335fab79ecf7d7dd6c1d:main",
    "message": "Proactive message from agent"
  }
}
```

Or simpler: just use `--deliver` in the CLI call and the agent's natural reply text is automatically routed to Feishu.

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

## GitHub Push

- SSH key: `C:\Users\71976\.ssh\github_openclaw_skill_ed25519`
- SSH config at `C:\Users\71976\.ssh\config` already maps `github.com` to port 443 with this key
- GitHub username: `Foreverwonder`
- This repo remote: `git@github.com:Foreverwonder/openclaw-win11-qwen-feishu-skill.git`
- Primary branch: `main` (NOT `master`)

Push workflow:

```bash
# 1. Add or update remote (only needed if no remote exists)
git remote add origin git@github.com:Foreverwonder/openclaw-win11-qwen-feishu-skill.git
# or update existing:
git remote set-url origin git@github.com:Foreverwonder/openclaw-win11-qwen-feishu-skill.git

# 2. Ensure branch is named main
git branch -M main

# 3. Fetch remote changes (remote may have commits not in local)
git fetch origin

# 4. Rebase local onto remote main
# If conflicts arise on files that remote already owns, use theirs:
git rebase origin/main   # resolve any conflicts, then continue
# For a conflicted file where remote version should win:
git checkout --theirs <file> && git add <file>

# 5. Push with explicit SSH command (SSH config handles this, but explicit is safer)
GIT_SSH_COMMAND="ssh -i /c/Users/71976/.ssh/github_openclaw_skill_ed25519 -o StrictHostKeyChecking=no" git push -u origin main
```

Common issues:
- **`remote exists` error**: use `git remote set-url origin <url>` instead of `git remote add`
- **`not found` / `could not read from remote repo`**: email not verified on GitHub — user must verify at https://github.com/settings/emails
- **`rejected` (non-fast-forward)**: remote has commits; must `git fetch origin && git rebase origin/main` first
- **`master` vs `main`**: always use `main` for this repo

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

- `openclaw models status --plain` shows `openrouter/qwen/qwen3.6-plus:free`
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

---

# ECC Heartbeat Integration

This skill is the execution target of the `ecc-heartbeat` skill. When the heartbeat triggers, it executes this skill (`lqj-OpenClaw-skill`).

## Heartbeat Rules

- **Trigger**: Scheduled (every 30 mins) or user request via `ecc-heartbeat`.
- **On trigger**: Execute the full workflow defined in this skill (confirm environment -> check gateway -> check model -> check Feishu -> fix issues).
- **Has fix tasks**: Execute fix flow.
- **No fix tasks**: Use superpower to analyze requirements, evaluate optimizations, discover new directions.
- **Report rule**: Must report to user via Feishu when there is substantive progress or discovery.

## Heartbeat Flow (when triggered by ecc-heartbeat)

1. Record round start time.
2. Execute this skill's Workflow (Section 1 at top of this file).
3. Check gateway health (`http://127.0.0.1:18789/`).
4. Check control center health (`http://127.0.0.1:18809/`).
5. Check model status (`openclaw models status --plain`).
6. Check Feishu channel (`openclaw channels status --probe`).
7. Fix any issues found following the rules in this skill.
8. Report via Feishu if substantive progress was made.
