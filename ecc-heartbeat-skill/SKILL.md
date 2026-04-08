---
name: "ecc-heartbeat"
description: "Executes the Continuous Agent Loop (ECC) for quant system optimization. Invoke when scheduled (every 30 mins) or user requests heartbeat."
---

# ECC Heartbeat 自动修复框架

## 🎯 目标
使用 superpower + ECC 框架自动解决量化系统所有已识别的问题，永远不停止。

## ♻️ 心跳规则
- **触发条件**：定期执行（如每 30 分钟）或用户请求时执行。
- **有修复任务** → 执行修复流程。
- **无修复任务** → 使用 superpower 分析需求、评估优化当前结果、挖掘新优化方向。
- **汇报规则**：有实质进展或发现时，必须通过飞书向用户汇报。

## ⚙️ 心跳执行流程

### Phase 0: 时间记录
1. 记录本轮开始时间。
2. 计算下一轮时间（当前时间 + 15/30分钟）。

### Phase 1: 评估 (agent-eval)
1. 运行完整测试套件确认当前状态：
   ```bash
   cd C:/Users/71976/.openclaw/workspace/quant_system
   python -m pytest --tb=short -q
   ```
2. 检查当前未解决的 P0 问题（位于 `C:/Users/71976/.openclaw/workspace/HEARTBEAT.md` 中）。
3. 识别下一个最高优先级问题。

### Phase 2: 规划
1. 读取所选问题的详情。
2. 制定修复计划。
3. 确定成功标准（如何验证该问题被彻底解决）。

### Phase 3: 执行 (使用 superpower)
1. dispatch 修复 subagent 执行修复任务。
2. 每个任务经过：implement → spec review → code quality review。
3. TDD 流程：先写测试，再改代码。
4. 遵循 python-patterns 最佳实践。

### Phase 4: 验证
1. 再次运行测试套件，确认修复成功且未引入回归。
2. 更新问题状态（如在相关文档中标记为 ✅ 已完成）。
3. 记录优化结果到日志文件：`C:/Users/71976/.openclaw/workspace/quant_optimize_log.txt`。

### Phase 5: 汇报 (飞书推送)
**强制要求**：每个 P0/P1 问题修复完成后，必须通过飞书向用户汇报。若汇报失败则停止执行。
**汇报格式**：
```
【ECC自动修复汇报 - HH:MM】
🕐 本轮时间：YYYY-MM-DD HH:MM - HH:MM
🕐 下一轮时间：YYYY-MM-DD HH:MM（≈15分钟后）
✅ 已修复：[问题名称]
🔧 修复方法：[描述]
✅ 验证结果：[测试通过/性能提升数据]
📊 当前进度：X/Y P0 问题已解决
📝 下一步：[下一个问题]
```

## 💻 常用命令备忘

**运行完整测试**
```bash
cd C:/Users/71976/.openclaw/workspace/quant_system
python -m pytest --tb=short -q
```

**运行 Claude Code 自动修复问题**
```bash
cd C:/Users/71976/.openclaw/workspace/quant_system
claude --permission-mode bypassPermissions --print "修复问题描述"
```

## 📂 项目依赖路径
- **量化系统**：`C:/Users/71976/.openclaw/workspace/quant_system/`
- **优化日志**：`C:/Users/71976/.openclaw/workspace/quant_optimize_log.txt`
- **任务队列**：`C:/Users/71976/.openclaw/workspace/HEARTBEAT.md`
