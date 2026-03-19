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
- Stable dashboard launcher: `D:\AI_Projects\openclaw\openclaw-dashboard-stable.cmd`
- Gateway supervisor: `C:\Users\71976\.openclaw\gateway-supervisor.cmd`
- Startup watchdog: `C:\Users\71976\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\OpenClaw Gateway Watchdog.vbs`
- v2rayN root: `C:\Users\71976\Desktop\v2rayN-windows-64-desktop\v2rayN-windows-64`

## Dashboard Stability Rules

- Treat `schtasks` as unreliable on this Win11 machine even when the task says `Ready` or `Running`.
- Prefer the watchdog + supervisor flow for keeping the gateway alive.
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

## Qwen Coding Plan Rules

- Do not wire Qwen Coding Plan through Anthropic-compatible settings for OpenClaw.
- Configure it as a custom OpenAI-compatible provider that points to `https://coding.dashscope.aliyuncs.com/v1`.
- Use a custom provider id `qwen-coding-plan`.
- Use default model `qwen-coding-plan/qwen3.5-plus`.
- Store the API key in `env.QWEN_CODING_PLAN_API_KEY`.

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

## Recovery Order

If something breaks, recover in this order:

1. Test `http://127.0.0.1:18789/`
2. Run `D:\AI_Projects\openclaw\openclaw-dashboard-stable.cmd`
3. Confirm the watchdog path exists and the supervisor is running
4. Re-check `openclaw models status --plain`
5. Re-run the one-line agent test

Do not switch back to Anthropic-compatible Qwen wiring unless there is a new official document proving that route is now preferred.
