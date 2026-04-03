# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 OpenClaw 配置和数据存储库。OpenClaw 是一个 MCP (Model Context Protocol) 服务器，用于连接 Claude 和微信/飞书等即时通信工具。

## 环境配置

当前项目运行在 Windows 10 上的 WSL2 (Ubuntu 24.04) 环境中：

- **端口配置**: WSL 中 OpenClaw 运行在端口 `18790`（避免与 Windows 系统进程在 18789 端口的冲突）
- **访问地址**: http://127.0.0.1:18790/
- **Node.js**: v22.13.1，安装在 `~/node/bin/node`
- **OpenClaw**: 通过 npm 安装在 WSL 用户目录下

## OpenClaw 管理命令

在 WSL Ubuntu 环境中执行以下命令：

```bash
# 查看状态
openclaw gateway status

# 停止服务
openclaw gateway stop

# 启动服务
openclaw gateway start

# 查看日志
openclaw logs --follow
```

注意：确保 PATH 包含 `~/.npm-global/bin` 和 `~/node/bin`。

## 系统服务

OpenClaw 已配置为 systemd 用户服务，可实现开机自启动。
