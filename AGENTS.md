# Repository Guidelines

## Project Structure & Module Organization

This repository is the `lqj-OpenClaw-skill` - a configuration and operations hub for the OpenClaw MCP gateway running on native Windows 11.

```
openclaw/
├── SKILL.md                    # Master skill (lqj-OpenClaw-skill) - all maintenance rules
├── CLAUDE.md                   # Project documentation for AI agents
├── AGENTS.md                   # This file - repository guidelines
├── README.md                   # Control center usage guide
├── control-center/             # Web management UI
│   ├── server.js               # Backend (pure Node.js HTTP server, port 18809)
│   ├── public/                 # Frontend (vanilla HTML/CSS/JS)
│   ├── start-control-center.ps1
│   ├── test-control-center.ps1
│   └── control-center-state.json
├── ecc-heartbeat-skill/        # ECC heartbeat scheduler
│   └── SKILL.md                # Triggers lqj-OpenClaw-skill on schedule
├── self-improving-agent/       # Self-improvement skill
│   ├── SKILL.md
│   └── .learnings/             # Learnings, errors, feature requests
├── lqj-OpenClaw-skill/         # Renamed skill directory (matches root SKILL.md)
├── scripts/                    # Helper scripts
│   ├── github-push.cmd
│   ├── openclaw-dashboard-stable.cmd
│   ├── openclaw-dashboard-direct.cmd
│   └── openclaw-stop.cmd
├── config/                     # Configuration files
│   └── mcporter.json
├── agents/                     # Agent configurations
│   └── openai.yaml
├── .claude/                    # Claude Code settings
└── .trae/                      # Trae IDE settings and skills
```

## Build, Test, and Development Commands

No build pipeline. The control center is a pure Node.js server with no dependencies.

```powershell
# Start control center
node control-center/server.js

# Run control center regression test
powershell -NoProfile -ExecutionPolicy Bypass -File "control-center/test-control-center.ps1"

# Run Playwright E2E tests (if configured)
cd control-center
npx playwright test
```

OpenClaw CLI commands require environment variables:

```powershell
$env:OPENCLAW_CONFIG_PATH = "C:\Users\71976\.openclaw\openclaw.json"
$env:OPENCLAW_STATE_DIR = "C:\Users\71976\.openclaw"
& "C:\Program Files\nodejs\node.exe" "C:\Users\71976\AppData\Roaming\npm\node_modules\openclaw\dist\index.js" <command>
```

## Coding Style & Naming Conventions

- PowerShell scripts: 4-space indentation, Verb-Noun cmdlets, `camelCase` variables
- JavaScript (server.js): 2-space indentation, no semicolons, `camelCase`
- Frontend (HTML/CSS/JS): vanilla, no framework, no build step
- File names: descriptive, include dates for time-specific content
- Skill names: lowercase with hyphens (e.g., `lqj-OpenClaw-skill`, `ecc-heartbeat`)

## Testing Guidelines

- Control center regression: `control-center/test-control-center.ps1`
- E2E tests: `control-center/tests/e2e/control-center.spec.js` (Playwright)
- Manual verification: check `http://127.0.0.1:18789/` and `http://127.0.0.1:18809/`
- After config changes: run `openclaw config validate` and `openclaw models status --plain`

## Commit & Pull Request Guidelines

Prefer Conventional Commit messages:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `refactor:` code restructuring
- `perf:` performance improvements
- `chore:` maintenance tasks

## Security & Configuration Tips

- Never commit plaintext secrets to the repository
- Use SecretRef objects in `openclaw.json` pointing to `HKCU\Environment`
- Required env vars: `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `OPENCLAW_FEISHU_APP_SECRET`, `OPENCLAW_GATEWAY_TOKEN`, `MINIMAX_API_KEY`, `OPENAI_API_KEY`
- After secret changes: run `openclaw secrets audit --check`

## ECC Heartbeat

The `ecc-heartbeat` skill triggers `lqj-OpenClaw-skill` on schedule (every 30 mins). The heartbeat is a simple scheduler - all maintenance logic lives in `lqj-OpenClaw-skill` (root `SKILL.md`).
