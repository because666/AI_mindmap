---
name: "deploy-assistant"
description: "Persist deployment metadata and trigger backup-then-deploy workflows. Invoke at the start of dev tasks and after local validation completes."
---

# 部署助手

## 核心理念

AI 应主动记住服务器部署元信息，在开发任务开始时检查环境状态，在任务完成后主动询问是否部署，并始终遵循「先 Git 备份，再同步上线」的原则。

## 已确认的服务器元信息（非敏感）

| 项目 | 值 |
|---|---|
| 服务器 IP | 43.139.43.112 |
| 用户名 | root |
| 私钥路径环境变量 | `DEPLOY_SSH_KEY_PATH` |
| 部署路径 | `/www/wwwroot/AI_mindmap` |
| PM2 进程名 | `deepmindmap-server`、`deepmindmap-admin` |
| 健康检查端点 | `http://127.0.0.1:3001/health`、`http://127.0.0.1:3002/api/health` |
| 本地项目根目录 | `d:\study1\DeepMindMap\v2` |

## 触发时机

### 1. 开发任务开始时

在接手任何涉及服务端、Admin 后台或部署相关的开发任务后，首先执行以下检查：

- 本地 Git 工作区是否干净（`git status --short` 无输出）。
- 服务器 SSH 是否可达（使用 `DEPLOY_SSH_KEY_PATH` 对应的私钥）。
- 上一次部署是否成功（通过健康检查端点确认服务正常）。

若检查失败，先告知用户并停止后续操作，等待确认。

### 2. 任务完成后（代码已通过本地验证）

当代码已完成本地验证（测试、构建、Lint 通过）后，主动询问用户：

> 代码已完成本地验证，是否立即部署到服务器？
> - 立即部署
> - 仅备份
> - 跳过

根据用户选择执行：

- **立即部署**：先执行 Git 备份与打标签，再运行 `python deploy_server.py`，最后进行健康检查。
- **仅备份**：执行 Git 备份与打标签，不运行部署脚本。
- **跳过**：不执行任何部署相关操作。

## 部署流程
