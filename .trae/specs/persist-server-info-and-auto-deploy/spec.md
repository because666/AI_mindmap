# 持久化服务器信息并实现自动部署 Spec

## Why

在开发过程中，AI 经常忘记服务器连接信息（IP、认证方式、部署路径、进程名等），导致每次部署都需要重新确认，效率低下且容易出错。同时现有 `deploy_server.py` 中硬编码了服务器密码，`deploy.sh` 中硬编码了第三方 API Key，存在安全风险。

本变更旨在：
1. 将服务器连接与部署元信息持久化为项目级 Skill/Rule，让 AI 在后续会话中自动回忆。
2. 建立“开发前 Git 备份 → 构建 → 上传 → 重启 → 健康检查 → 失败回滚”的自动化部署流程。
3. 消除代码中的硬编码敏感信息，改用 SSH 密钥或环境变量读取。

## What Changes

- 新增项目级 Skill/Rule：`deploy-assistant`，用于保存服务器连接信息、部署路径、PM2 进程名、健康检查端点等元数据，并在开发开始或任务完成后自动触发部署流程。
- 改造 `deploy_server.py`：
  - 移除硬编码密码与服务器 IP。
  - 从环境变量或项目配置中读取连接信息。
  - 部署前自动执行本地 Git 提交与打标签（`deploy-before-<timestamp>`）。
  - 增加服务器端备份与失败回滚逻辑。
- 新增/更新 `.env.deploy.example`：提供部署所需环境变量模板（不含真实密码/Key）。
- 新增 SSH 密钥验证与配置引导：确认 `~/.ssh/id_rsa` 或指定私钥可正常登录服务器。
- 在服务器项目目录保留 `deploy-backup/` 与 Git 标签，支持一键回滚到上一版本。

**BREAKING**：原 `deploy_server.py` 的直接运行方式将失效，必须先配置 `.env.deploy` 或设置对应环境变量。

## Impact

- Affected specs: `deploy-latest-code-to-server`
- Affected code:
  - `deploy_server.py`
  - `deploy.sh`
  - `.trae/skills/deploy-assistant/SKILL.md`（新增）
  - `.env.deploy.example`（新增）
  - 服务器上 `/www/wwwroot/AI_mindmap/` 的备份目录结构

## ADDED Requirements

### Requirement: 服务器信息持久化

The system SHALL 提供一个项目级 Skill/Rule，持久化保存服务器连接与部署元信息，使 AI 在任意新会话中无需用户重复输入即可回忆。

#### Scenario: 新会话自动回忆
- **WHEN** 用户在新的对话中提及“部署到服务器”
- **THEN** AI 能自动引用已保存的 IP、用户名、部署路径、PM2 进程名、健康检查端点

#### Scenario: 信息安全
- **WHEN** 保存服务器连接信息时
- **THEN** 密码、API Key、私钥内容不得写入 Skill/Rule 文件或代码；仅保存“从何处读取”（如环境变量名、私钥路径）

### Requirement: 部署前 Git 备份

The system SHALL 在每次执行自动部署前，在本地仓库创建一次提交并打标签，确保失败时可回滚。

#### Scenario: 自动备份成功
- **WHEN** 自动部署流程启动
- **THEN** 本地 Git 工作区被提交（或已干净），并生成标签 `deploy-backup-<timestamp>`

#### Scenario: 服务器备份成功
- **WHEN** 新代码上传到服务器前
- **THEN** 服务器上目标目录被复制到 `server.bak-<timestamp>`、`admin/server.bak-<timestamp>`、`client/dist.bak-<timestamp>`

### Requirement: 自动部署触发

The system SHALL 在“开发任务开始”和“开发任务完成”两个时机，主动检查是否需要同步部署，并在用户确认后执行。

#### Scenario: 任务完成后提示部署
- **WHEN** 一个功能/修复任务完成并通过本地验证
- **THEN** AI 主动询问用户“是否立即部署到服务器？”并提供“是 / 否 / 仅备份”选项

#### Scenario: 开发开始时检查环境
- **WHEN** 用户开始一个新的开发任务
- **THEN** AI 主动确认当前本地分支是否干净、服务器连接是否可用、上一次部署是否成功

### Requirement: 失败回滚

The system SHALL 在部署失败时，能够使用本地 Git 标签与服务器备份目录恢复到部署前状态。

#### Scenario: 本地回滚
- **WHEN** 用户要求回滚本次部署
- **THEN** AI 执行 `git reset --hard deploy-backup-<timestamp>` 恢复本地代码

#### Scenario: 服务器回滚
- **WHEN** 服务器部署后服务无法启动或健康检查失败
- **THEN** AI 将服务器目录替换为最近一次备份并重启服务

### Requirement: 消除硬编码敏感信息

The system SHALL 从现有部署脚本中移除所有硬编码密码、API Key 和私钥内容。

#### Scenario: 脚本安全
- **WHEN** 检查 `deploy_server.py` 与 `deploy.sh`
- **THEN** 找不到任何明文密码、API Key 或私钥内容；所有凭据均从环境变量或 SSH Agent 获取

## MODIFIED Requirements

### Requirement: 现有部署脚本

现有 `deploy_server.py` 与 `deploy.sh` 从“手动硬编码凭据运行”改为“读取环境变量 + SSH 密钥 + 自动备份/回滚”的运行方式。

#### Scenario: 兼容旧流程
- **WHEN** 用户未配置环境变量时尝试运行部署脚本
- **THEN** 脚本给出清晰错误提示，并指引用户复制 `.env.deploy.example` 到 `.env.deploy` 后填写

## REMOVED Requirements

无。
