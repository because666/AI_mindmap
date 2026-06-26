# Tasks

## 第一阶段：安全审计与信息收集

- [x] Task 1: 审计现有部署脚本中的硬编码敏感信息
  - [x] SubTask 1.1: 扫描 `deploy_server.py`、`deploy.sh` 及 `.trae/specs/deploy-latest-code-to-server/` 中的密码、API Key、Token
  - [x] SubTask 1.2: 列出所有需要迁移到环境变量的敏感字段清单

- [x] Task 2: 确认服务器连接方式
  - [x] SubTask 2.1: 使用提供的 IP/密码测试 SSH 登录
  - [x] SubTask 2.2: 检查服务器上是否已存在 authorized_keys，确认 SSH 密钥登录是否可用
  - [x] SubTask 2.3: 若密钥不可用，生成新的 SSH 密钥对并配置到服务器（或确认使用密码+环境变量的过渡方案）
  - [x] SubTask 2.4: 确认服务器上的部署路径 `/www/wwwroot/AI_mindmap`、PM2 进程名 `deepmindmap-server`、`deepmindmap-admin`、健康检查端点

## 第二阶段：持久化服务器信息

- [x] Task 3: 创建项目级 Skill `deploy-assistant`
  - [x] SubTask 3.1: 创建 `.trae/skills/deploy-assistant/SKILL.md`
  - [x] SubTask 3.2: 在 Skill 中记录非敏感的服务器元信息：IP、用户名、部署路径、PM2 进程名、健康检查端点、私钥路径环境变量名
  - [x] SubTask 3.3: 在 Skill 中定义触发时机：开发任务开始时检查环境、任务完成后询问是否部署
  - [x] SubTask 3.4: 确保 Skill 文件不包含任何密码、API Key、私钥内容

- [x] Task 4: 创建部署环境变量模板
  - [x] SubTask 4.1: 创建 `.env.deploy.example`，包含 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY_PATH`、`DEPLOY_PROJECT_DIR`、`DEPLOY_PM2_SERVER`、`DEPLOY_PM2_ADMIN`、`DEPLOY_HEALTH_URL` 等字段
  - [x] SubTask 4.2: 将 `.env.deploy` 加入 `.gitignore`，防止真实凭据提交
  - [x] SubTask 4.3: 在用户本地生成真实的 `.env.deploy` 文件（不提交到 Git）

## 第三阶段：改造部署脚本

- [x] Task 5: 重构 `deploy_server.py`
  - [x] SubTask 5.1: 移除硬编码的 IP、用户名、密码
  - [x] SubTask 5.2: 从 `.env.deploy` 或环境变量读取连接信息
  - [x] SubTask 5.3: 部署前自动执行本地 Git 提交与打标签 `deploy-backup-<timestamp>`
  - [x] SubTask 5.4: 上传前在服务器创建 `server.bak-<timestamp>`、`admin/server.bak-<timestamp>`、`client/dist.bak-<timestamp>`
  - [x] SubTask 5.5: 上传后执行构建与 PM2 重启
  - [x] SubTask 5.6: 增加健康检查与失败回滚逻辑

- [x] Task 6: 重构 `deploy.sh`
  - [x] SubTask 6.1: 移除硬编码的 API Key
  - [x] SubTask 6.2: 从环境变量读取 `ZHIPU_API_KEY_2`
  - [x] SubTask 6.3: 在脚本开头增加 Git 备份与标签创建
  - [x] SubTask 6.4: 增加服务器端备份与失败回滚逻辑

## 第四阶段：自动触发与回滚机制

- [x] Task 7: 实现自动部署触发
  - [x] SubTask 7.1: 在 Skill 中定义“任务完成后”的提示模板，提供“立即部署 / 仅备份 / 跳过”选项
  - [x] SubTask 7.2: 在 Skill 中定义“开发开始时”的环境检查清单
  - [x] SubTask 7.3: 验证 AI 在新会话中能否自动回忆服务器信息并执行部署流程

- [x] Task 8: 实现回滚脚本
  - [x] SubTask 8.1: 创建 `rollback_local.py`：根据标签 `deploy-backup-<timestamp>` 回滚本地代码
  - [x] SubTask 8.2: 创建 `rollback_remote.py`：根据服务器上的备份目录回滚远程服务
  - [x] SubTask 8.3: 在 Skill 中记录回滚命令与使用场景

## 第五阶段：验证与收尾

- [x] Task 9: 端到端验证
  - [x] SubTask 9.1: 在测试分支上运行一次完整部署，确认备份、上传、重启、健康检查均成功
  - [x] SubTask 9.2: 模拟部署失败，验证回滚脚本能否恢复服务
  - [x] SubTask 9.3: 确认 `deploy_server.py` 与 `deploy.sh` 中已无硬编码敏感信息

- [x] Task 10: 文档与交接
  - [x] SubTask 10.1: 更新 `README.md` 或新增 `docs/deploy.md`，说明部署配置与回滚方法
  - [x] SubTask 10.2: 向用户说明 `.env.deploy` 的存放位置与注意事项

# Task Dependencies

- Task 1 与 Task 2 可并行执行
- Task 3 依赖 Task 2 完成
- Task 4 依赖 Task 1 完成
- Task 5 依赖 Task 3 与 Task 4 完成
- Task 6 依赖 Task 4 完成
- Task 7 依赖 Task 3 完成
- Task 8 依赖 Task 5 完成
- Task 9 依赖 Task 5、Task 6、Task 7、Task 8 完成
- Task 10 依赖 Task 9 完成
