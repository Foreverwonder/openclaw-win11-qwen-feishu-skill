---
name: "ecc-heartbeat"
description: "Periodic heartbeat that executes the lqj-OpenClaw-skill. Invoke when scheduled (every 30 mins) or user requests heartbeat."
---

# ECC Heartbeat

## Goal

Periodic heartbeat that triggers the `lqj-OpenClaw-skill` for automated OpenClaw maintenance and optimization.

## Heartbeat Rules

- **Trigger**: Scheduled (every 30 mins) or user request.
- **On trigger**: Execute `lqj-OpenClaw-skill`.
- **Has fix tasks**: Execute fix flow defined in `lqj-OpenClaw-skill`.
- **No fix tasks**: Use superpower to analyze requirements, evaluate optimizations, discover new directions.
- **Report rule**: Must report to user via Feishu when there is substantive progress or discovery.

## Heartbeat Flow

### Phase 0: Time Record
1. Record current round start time.
2. Calculate next round time (current + 30 min).

### Phase 1: Execute lqj-OpenClaw-skill
1. Load and execute `lqj-OpenClaw-skill`.
2. The skill contains all maintenance rules, self-healing logic, and optimization guidelines.
3. Follow the skill's workflow: confirm environment → check gateway → check model → check Feishu → fix issues.

### Phase 2: Report (Feishu Push)
**Mandatory**: After each heartbeat with substantive progress, report to user via Feishu. Stop if report fails.
**Format**:
```
【ECC Heartbeat Report - HH:MM】
Round: YYYY-MM-DD HH:MM - HH:MM
Next: YYYY-MM-DD HH:MM (~30 min)
Status: [summary of what was done/checked]
Issues: [any issues found or fixed]
Next: [planned action for next round]
```

## Key Paths

- **OpenClaw config**: `C:\Users\71976\.openclaw\openclaw.json`
- **Gateway URL**: `http://127.0.0.1:18789/`
- **Control Center URL**: `http://127.0.0.1:18809/`
- **Gateway supervisor**: `C:\Users\71976\.openclaw\gateway-supervisor.cmd`
- **Gateway starter**: `C:\Users\71976\.openclaw\gateway-start.cmd`

## Feishu Report Command

```powershell
$env:ANTHROPIC_AUTH_TOKEN = [Environment]::GetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", "User")
$env:ANTHROPIC_BASE_URL = [Environment]::GetEnvironmentVariable("ANTHROPIC_BASE_URL", "User")
$env:OPENCLAW_FEISHU_APP_SECRET = [Environment]::GetEnvironmentVariable("OPENCLAW_FEISHU_APP_SECRET", "User")
$env:OPENCLAW_GATEWAY_TOKEN = [Environment]::GetEnvironmentVariable("OPENCLAW_GATEWAY_TOKEN", "User")

& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" agent --agent main --channel feishu --to "ou_9d244abfcbfc335fab79ecf7d7dd6c1d" --message "YOUR_MESSAGE" --deliver
```
