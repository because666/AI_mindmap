---
name: "deploy-assistant"
description: "Persist deployment metadata and trigger backup-then-deploy workflows. Invoke at the start of dev tasks and after local validation completes."
---

# 部署助手

## 核心理念

AI 应主动记住服务器部署元信息，在开发任务开始时检查环境状态，在任务完成后主动询问是否部署，并始终遵循「先本地 Git 提交推送，再本地构建，最后上传产物并重启」的原则。

## 已确认的服务器元信息（非敏感）

| 项目 | 值 |
|---|---|
| 服务器地址 | 从 `DEPLOY_HOST` 环境变量读取 |
| 用户名 | 从 `DEPLOY_USER` 环境变量读取 |
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

- **立即部署**：依次执行本地 Git 提交推送、本地构建、上传产物、服务器端替换与重启、健康检查。
- **仅备份**：执行本地 Git 提交推送并创建部署备份标签，不上传产物、不重启服务。
- **跳过**：不执行任何部署相关操作。

## 部署流程

选择「立即部署」时，按以下顺序执行：

1. **本地 Git 提交并推送**
   - 将当前所有改动加入暂存区并提交：`git add .`、`git commit -m "deploy: <timestamp>"`。
   - 推送代码到远程仓库：`git push`。
   - 创建并推送部署备份标签：`deploy-backup-<timestamp>`，例如 `deploy-backup-20260630-183000`。
2. **本地构建**
   - 在本地项目根目录依次执行：
     - `npm run build:client`
     - `npm run build:server`
     - `npm run build:admin`（如涉及 Admin 后台）
   - 确认 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist` 目录已生成且构建无报错。
3. **上传前服务器端备份**
   - 通过 SSH 登录服务器，在部署目录下将当前运行中的产物目录备份为：
     - `client/dist.bak-<timestamp>`
     - `server/dist.bak-<timestamp>`
     - `admin/server/dist.bak-<timestamp>`
     - `admin/client/dist.bak-<timestamp>`
   - 备份命令示例：`mv client/dist client/dist.bak-<timestamp>`（需按实际部署路径调整）。
4. **上传构建产物**
   - 通过 SSH/SCP/RSYNC 将本地构建产物上传到服务器对应目录：
     - 本地 `client/dist` → 服务器 `client/dist`
     - 本地 `server/dist` → 服务器 `server/dist`
     - 本地 `admin/server/dist` → 服务器 `admin/server/dist`
     - 本地 `admin/client/dist` → 服务器 `admin/client/dist`
5. **服务器端替换与重启**
   - 在服务器端仅执行目录替换（将新上传产物目录放置到运行路径）。
   - 使用 PM2 重启服务：`pm2 restart deepmindmap-server`、`pm2 restart deepmindmap-admin`。
   - **全程禁止在服务器端执行 `git pull`、`git reset`、`npm run build` 等与拉取代码或构建相关的操作。**
6. **健康检查**
   - 检查 `http://127.0.0.1:3001/health` 与 `http://127.0.0.1:3002/api/health` 是否返回正常。
7. **失败处理与回滚**
   - 若本地构建失败、上传失败、健康检查失败或 PM2 重启异常，立即停止后续步骤。
   - 回滚方式：
     - 本地回滚：通过 Git 标签 `deploy-backup-<timestamp>` 恢复代码。
     - 远程回滚：在服务器端将 `dist.bak-<timestamp>` 目录恢复为当前运行目录，并重启 PM2 进程。
   - 在问题排查完成前，不再继续后续部署步骤。

## 安全要求

- Skill 文件中不得出现任何密码、API Key、私钥内容。
- 私钥仅通过环境变量 `DEPLOY_SSH_KEY_PATH` 读取，部署配置通过 `.env.deploy` 管理。
- 部署前必须完成本地 Git 提交、推送与标签，禁止直接覆盖线上代码。

## 沟通风格

- 使用简体中文。
- 输出简洁、可执行，避免冗长解释。
- 每个步骤给出明确命令或操作选项，方便用户一键确认。
