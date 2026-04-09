# OpenClaw Control Center

OpenClaw 控制中心 - 企业级部署

## 目录结构

```
openclaw/
├── control-center/         # 控制中心核心应用
│   ├── public/          # Web UI (HTML/CSS/JS)
│   ├── server.js        # 主服务器
│   ├── start-control-center.ps1  # 启动脚本
│   └── control-center-state.json # 状态存储
├── scripts/              # 辅助脚本
│   ├── openclaw-dashboard-stable.cmd  # 稳定版 Dashboard
│   ├── openclaw-dashboard-direct.cmd  # 直连 Dashboard
│   └── openclaw-stop.cmd              # 停止服务
├── config/               # 配置文件
├── .claude/             # Claude Code 设置
├── CLAUDE.md            # 项目文档
├── AGENTS.md            # Agents 文档
└── openclaw-control-center.cmd  # 主启动器 (主要入口)
```

## 快速开始

### 启动控制中心
```cmd
openclaw-control-center.cmd
```

### 命令行选项
```cmd
openclaw-control-center.cmd --help     # 显示帮助
openclaw-control-center.cmd --status   # 检查服务状态
openclaw-control-center.cmd --no-browser  # 不打开浏览器
openclaw-control-center.cmd -v         # 详细输出
```

### 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| OPENCLAW_GATEWAY_PORT | 18790 | 网关端口 |
| OPENCLAW_CONTROL_PORT | 18809 | 控制中心端口 |
| OPENCLAW_NO_BROWSER | 0 | 设为 1 禁用浏览器自动打开 |

## 服务端口

- **控制中心**: http://127.0.0.1:18809
- **网关**: http://127.0.0.1:18790

## 注意事项

1. 控制中心会自动检测并启动网关服务（如未运行）
2. 重复运行不会启动多个实例
3. 使用 `--status` 检查服务状态
