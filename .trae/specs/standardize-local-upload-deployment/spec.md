# 标准化本地构建后直接上传服务器的部署流程 Spec

## Why

现有部署流程存在两条路径：`deploy.sh` 在服务器端拉取 Git 代码并重新构建，`deploy_server.py` 在本地构建后上传。服务器端拉取代码的方式依赖服务器网络访问 GitHub、依赖服务器具备完整构建环境，且与本地已验证的构建产物不一致，容易因环境差异导致部署异常。为了统一、可控、可回滚，需要明确并强制执行"本地构建 → 上传产物 → 服务器仅替换/重启"的部署规范。

## What Changes

- 明确部署顺序：**本地 Git 提交并推送 → 本地构建 client/server → 将构建产物上传至服务器 → 服务器仅执行替换与重启**，不再在服务器端拉取 Git 代码。
- 更新或新增部署脚本/命令，支持本地一键完成"提交 → 构建 → 上传 → 重启 → 健康检查"。
- 在服务器端保留备份机制，上传前自动备份当前 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist`，失败可回滚。
- 将本规则写入项目级记忆（project_memory.md），确保后续会话统一执行。
- 文档中说明新的部署流程，废弃服务器端拉取代码的旧路径。

## Impact

- Affected specs: persist-server-info-and-auto-deploy
- Affected code:
  - `deploy_server.py`（本地构建上传脚本）
  - `deploy.sh`（服务器端脚本，需调整或废弃拉取/构建逻辑）
  - `.trae/skills/deploy-assistant/SKILL.md`（如存在，更新触发逻辑）
  - `docs/deploy.md` 或 `README.md` 部署说明
  - `project_memory.md`（新增 Hard Constraint）

## ADDED Requirements

### Requirement: 部署流程规范

系统 SHALL 采用"本地构建后直接上传服务器"的部署流程，禁止在服务器端执行 `git pull` / `git reset` / `npm run build`。

#### Scenario: 标准部署流程

- **WHEN** 用户要求同步/部署到服务器
- **THEN** AI 首先在本地执行 `git add` / `git commit` / `git push`
- **AND** 在本地执行 `npm run build`（client / server / admin）
- **AND** 通过 SSH/SCP/RSYNC 将本地构建产物上传到服务器对应目录
- **AND** 在服务器端仅执行目录替换、PM2 重启、健康检查
- **AND** 全程不在服务器端拉取 Git 代码或运行构建命令

#### Scenario: 部署前备份

- **WHEN** 上传新的构建产物前
- **THEN** 在服务器端将 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist` 备份为 `dist.bak-<timestamp>`
- **AND** 本地仓库创建备份标签 `deploy-backup-<timestamp>`

#### Scenario: 部署失败回滚

- **WHEN** 上传后服务健康检查失败
- **THEN** 自动将服务器目录恢复为最近一次备份
- **AND** 重启 PM2 服务

## MODIFIED Requirements

### Requirement: 现有 `deploy.sh`

现有 `deploy.sh` 从"服务器端拉取代码并构建"改为"服务器端仅替换产物与重启"，或明确标记为已废弃，由新的本地部署脚本替代。

#### Scenario: 兼容旧脚本

- **WHEN** 用户或 CI 仍调用 `deploy.sh`
- **THEN** 脚本输出提示："请改用新的本地部署脚本，服务器端不再拉取代码"

## REMOVED Requirements

无。
