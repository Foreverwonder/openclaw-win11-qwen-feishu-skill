# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the `lqj-OpenClaw-skill` repository - a configuration and operations hub for the OpenClaw MCP gateway running on native Windows 11. OpenClaw connects AI models to messaging platforms (Feishu) through an MCP gateway, with a local web control center for management.

## Environment

Native Windows 11 (not WSL):

- **Gateway port**: `18789` (OpenClaw gateway + dashboard)
- **Control Center port**: `18809` (management UI)
- **Node.js**: `C:\Program Files\nodejs\node.exe`
- **OpenClaw entry**: `C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js`
- **OpenClaw config**: `C:\Users\71976\.openclaw\openclaw.json`
- **Current model**: `openrouter/qwen/qwen3.6-plus:free` (via OpenRouter, Anthropic Messages API)

## OpenClaw CLI Commands

Run in PowerShell with environment variables loaded:

```powershell
# Load required env vars first
$env:OPENCLAW_CONFIG_PATH = "C:\Users\71976\.openclaw\openclaw.json"
$env:OPENCLAW_STATE_DIR = "C:\Users\71976\.openclaw"

# Status
& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" gateway status

# Config validate
& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" config validate

# Models status
& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" models status --plain
```

Or use the control center at `http://127.0.0.1:18809/` for most operations.

## Key Files

| File | Purpose |
|------|---------|
| `SKILL.md` | Master skill with all maintenance rules (lqj-OpenClaw-skill) |
| `control-center/server.js` | Control center backend (pure Node.js HTTP server) |
| `control-center/public/` | Control center frontend (vanilla HTML/CSS/JS) |
| `ecc-heartbeat-skill/SKILL.md` | ECC heartbeat scheduler (triggers lqj-OpenClaw-skill) |
| `self-improving-agent/` | Self-improvement skill (learnings/errors/features) |
| `lqj-OpenClaw-skill/` | Renamed skill directory (matches root SKILL.md) |

## Gateway Lifecycle

- **Start**: `C:\Users\71976\.openclaw\gateway-start.cmd`
- **Supervisor**: `C:\Users\71976\.openclaw\gateway-supervisor.cmd` (keepalive loop)
- **Stop**: Use control center or `openclaw gateway stop`
- **Dashboard**: `D:\AI_Projects\openclaw\openclaw-dashboard-stable.cmd`

## Secrets

All secrets stored in `HKCU\Environment` as user environment variables:
- `ANTHROPIC_AUTH_TOKEN` (OpenRouter API key)
- `ANTHROPIC_BASE_URL` (set to `https://openrouter.ai/api`)
- `OPENCLAW_FEISHU_APP_SECRET`
- `OPENCLAW_GATEWAY_TOKEN`
- `MINIMAX_API_KEY` (backup provider)
- `OPENAI_API_KEY` (backup provider)

Use SecretRef objects in `openclaw.json`, never plaintext.

## GitHub

- Remote: `git@github.com:Foreverwonder/openclaw-win11-qwen-feishu-skill.git`
- Branch: `main`
- SSH key: `C:\Users\71976\.ssh\github_openclaw_skill_ed25519`
