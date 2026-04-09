# OpenClaw Win11 Control Center

This folder contains the local Win11-native control center we built for OpenClaw.

Files:
- `server.js`: local-only Node backend for status + whitelisted actions
- `public/`: static UI
- `openclaw-control-center.cmd`: one-click launcher for Edge with direct proxy bypass

What it manages:
- Dashboard and gateway lifecycle
- Custom model config for Qwen Coding Plan
- Feishu app config
- Memory folder setup and reindex
- Skill listing and folder shortcuts
- Official docs links and best-practice notes

Default URL:
- `http://127.0.0.1:18809/`
