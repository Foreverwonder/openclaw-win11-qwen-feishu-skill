# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`control-center/` is a local, Windows-native Node.js web application for managing OpenClaw. It provides a single-page UI (served by a minimal `server.js` Express-less HTTP server) that wraps OpenClaw CLI commands.

- **server.js**: Backend serving static files and a few REST APIs (`/api/status`, `/api/action`, `/api/config/model`, `/api/config/feishu`) that shell out to OpenClaw CLI or directly modify `~/.openclaw/openclaw.json`
- **public/**: Static frontend — plain HTML/CSS/JS (no build step, no framework)
- **control-center-state.json**: Persists model history for rollback

## Key Paths

| Path | Purpose |
|------|---------|
| `~/.openclaw/openclaw.json` | OpenClaw main config (read/written by model & feishu config APIs) |
| `~/.openclaw/` | OpenClaw state directory |
| `~/.openclaw/workspace/memory/` | Memory directory |
| `~/.openclaw/skills/` | Managed skills directory |
| `~/.codex/skills/` | Codex skills directory |

> Read these from the host Windows filesystem, **not** WSL.

## Development Commands

```bash
# Start the control center server (Windows)
node server.js

# Or use the provided batch launcher
openclaw-control-center.cmd
```

The server runs on `http://127.0.0.1:18809/`. No build step, no bundler, no package.json — it uses Node.js built-ins only (`http`, `fs`, `path`, `os`, `child_process`).

## Architecture

### Backend (`server.js`)

- Pure Node.js HTTP server (no Express or other framework)
- Static file serving from `public/`
- API endpoints that delegate to OpenClaw CLI via PowerShell (`runOpenClaw`) or direct `spawn` calls
- Gateway lifecycle management: `ensureGateway`, `restartGateway`, `stopGateway`
- Config management: reads/writes `~/.openclaw/openclaw.json` directly for model and Feishu configs
- Self-healing: auto-repairs missing `controlUi.allowedOrigins` and `agents.list.main.model` in config
- Rate limiting and token-based auth for protected endpoints

### Frontend (`public/`)

- Vanilla HTML/CSS/JS, no framework or build tooling
- Auto-refreshes status every 30 seconds
- Panels for: gateway status, model config (with quick presets), Feishu config, memory, skills, logs

### Gateway

The control center manages an OpenClaw gateway running on port `18789` (default). The gateway itself is a separate Node.js process started via `gateway-supervisor.cmd`.
