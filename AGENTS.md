# Repository Guidelines

## Project Structure & Module Organization

This repository is a lightweight configuration and operations hub for the OpenClaw MCP gateway. Most content lives at the root as working notes and artifacts rather than application source code. Key items include:

- `CLAUDE.md`: environment and runtime notes (WSL2, ports, Node version).
- `.claude/settings.local.json`: local agent settings.
- `cleanup.ps1`: Windows automation script for closing specific windows.
- `*.txt`: operational notes, API details, and status logs.
- `*.png`: screenshots or reference images.

Keep new additions in the root unless there is a clear reason to create a new folder (for example, `docs/` for long-form guides).

## Build, Test, and Development Commands

There is no build or test pipeline in this repository. OpenClaw is managed in the WSL Ubuntu environment instead. Common commands:

- `openclaw gateway status`: verify the gateway state.
- `openclaw gateway start` / `openclaw gateway stop`: manage the service lifecycle.
- `openclaw logs --follow`: tail runtime logs.

OpenClaw runs at `http://127.0.0.1:18790/` in WSL. Ensure `~/.npm-global/bin` and `~/node/bin` are on PATH before running commands.

## Coding Style & Naming Conventions

- PowerShell scripts use 4-space indentation, Verb-Noun cmdlets, and `camelCase` variables.
- Notes should be UTF-8 encoded, concise, and focused on one topic.
- File names should be descriptive; include dates when the content is time-specific (for example, `2026-02-23-status.txt`).

## Testing Guidelines

There are no automated tests. When editing scripts, run them manually and confirm the expected behavior. Record any manual verification steps in a nearby note or in the script header.

## Commit & Pull Request Guidelines

No Git history is present in this workspace. If the repository is tracked, prefer Conventional Commit messages (for example, `docs: update OpenClaw notes`). Pull requests should summarize the change, list affected files, and mention any operational impact (port changes, service restarts). Include screenshots for UI-affecting updates.

## Security & Configuration Tips

Avoid committing secrets. Store API keys in a secure vault and reference them in notes without the raw value. If sensitive files already exist, restrict sharing and redact before publishing.
