# Checklist

## 安全审计

- [x] `deploy_server.py` 中已无硬编码服务器 IP、用户名、密码
- [x] `deploy.sh` 中已无硬编码 API Key、Token、密码
- [x] `.trae/specs/deploy-latest-code-to-server/` 下的脚本中已无硬编码敏感信息
- [x] 已列出所有需要迁移到环境变量的敏感字段清单

## 服务器连接确认

- [x] 已使用 IP/密码成功 SSH 登录服务器
- [x] 已确认服务器上 authorized_keys 状态，明确 SSH 密钥登录是否可用
- [x] 已确认部署路径 `/www/wwwroot/AI_mindmap`
- [x] 已确认 PM2 进程名 `deepmindmap-server` 与 `deepmindmap-admin`
- [x] 已确认主服务与管理后台的健康检查端点

## 信息持久化

- [x] 已创建 `.trae/skills/deploy-assistant/SKILL.md`
- [x] Skill 中记录了非敏感服务器元信息（IP、用户名、部署路径、进程名、健康检查端点）
- [x] Skill 中定义了开发开始时检查环境的触发逻辑
- [x] Skill 中定义了任务完成后询问部署的触发逻辑
- [x] Skill 文件中不包含任何密码、API Key、私钥内容

## 环境变量配置

- [x] 已创建 `.env.deploy.example` 模板
- [x] `.env.deploy` 已加入 `.gitignore`
- [x] 已在本地生成真实 `.env.deploy` 文件（未提交 Git）
- [x] `.env.deploy` 中包含 `DEPLOY_HOST`、`DEPLOY_USER`、`DEPLOY_SSH_KEY_PATH`、`DEPLOY_PROJECT_DIR`、`DEPLOY_PM2_SERVER`、`DEPLOY_PM2_ADMIN`、`DEPLOY_HEALTH_URL`

## 部署脚本改造

- [x] `deploy_server.py` 从 `.env.deploy` 或环境变量读取连接信息
- [x] `deploy_server.py` 部署前自动创建本地 Git 提交与标签 `deploy-backup-<timestamp>`
- [x] `deploy_server.py` 上传前在服务器创建目录备份
- [x] `deploy_server.py` 上传后执行构建与 PM2 重启
- [x] `deploy_server.py` 包含健康检查与失败回滚逻辑
- [x] `deploy.sh` 从环境变量读取 `ZHIPU_API_KEY_2`
- [x] `deploy.sh` 包含 Git 备份与服务器端备份逻辑
- [x] `deploy.sh` 包含失败回滚逻辑

## 回滚机制

- [x] 已创建 `rollback_local.py` 并验证可按标签回滚本地代码
- [x] 已创建 `rollback_remote.py` 并验证可按备份目录回滚远程服务
- [x] Skill 中记录了回滚命令与使用场景

## 自动触发验证

- [x] AI 在新会话中提及部署时能自动回忆服务器元信息
- [x] 任务完成后 AI 主动询问是否部署，并提供“立即部署 / 仅备份 / 跳过”选项
- [x] 开发开始时 AI 能主动检查本地 Git 状态与服务器连接

## 端到端验证

- [x] 在测试分支完成一次完整部署，备份、上传、构建、重启、健康检查均成功
- [x] 模拟部署失败场景，回滚脚本成功恢复服务
- [x] 部署失败时本地与服务器均可回滚到部署前状态

## 文档

- [x] 已更新 `README.md` 或新增 `docs/deploy.md`
- [x] 文档中说明了 `.env.deploy` 配置方法、部署命令、回滚命令
- [x] 已向用户说明敏感信息存放位置与注意事项
