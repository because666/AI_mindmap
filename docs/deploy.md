# 部署指南

## 部署概述

本项目采用「本地构建后上传产物」的标准化部署流程：

1. 本地完成 Git 提交并推送到远程仓库。
2. 本地执行 lint / test / build，确保构建产物通过验证。
3. 通过 `deploy_server.py` 将本地构建产物（`server/dist`、`client/dist`、`admin/server/dist`、`admin/client/dist`）上传到远程服务器。
4. 服务器端仅执行备份、替换 dist 目录、PM2 重启、健康检查。

**禁止在服务器端执行 `git pull`、`git fetch`、`git reset`、`npm install`、`npm run build` 或任何源码构建操作。**

## 环境准备

1. 复制项目根目录下的 `.env.deploy.example` 为 `.env.deploy`，并填入真实值：

   ```text
   DEPLOY_HOST=your_server_ip
   DEPLOY_USER=your_ssh_user
   DEPLOY_SSH_KEY_PATH=your_ssh_key_path
   DEPLOY_PROJECT_DIR=/www/wwwroot/AI_mindmap
   DEPLOY_PM2_SERVER=deepmindmap-server
   DEPLOY_PM2_ADMIN=deepmindmap-admin
   DEPLOY_HEALTH_URL_SERVER=http://127.0.0.1:3001/health
   DEPLOY_HEALTH_URL_ADMIN=http://127.0.0.1:3002/api/health
   ```

2. 确保私钥文件存在且对服务器有效，路径与 `DEPLOY_SSH_KEY_PATH` 一致。
3. 确保服务器上已安装 Node.js、npm、pm2、curl。
4. 确保本地已安装 Python 3 及 `paramiko`、`python-dotenv`（已包含在项目依赖中）。

## 部署命令

### 完整部署

```powershell
cd d:\study1\DeepMindMap\v2
python deploy_server.py
```

脚本执行顺序：

1. 加载 `.env.deploy` 配置。
2. 检查 Git 工作区，自动提交未提交变更。
3. 推送当前分支到远程仓库。
4. 创建并推送标签 `deploy-backup-<timestamp>`。
5. 本地执行 lint / test / build（若根目录存在 lint/test 脚本则执行，否则跳过并提示）。
6. 连接远程服务器。
7. 在服务器端备份 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist`。
8. 上传本地构建产物并原子替换服务器上的 dist 目录。
9. `pm2 restart` 主服务端与 Admin 服务端。
10. 对健康检查端点发起请求，确认返回 HTTP 200。

### 干运行预览

```powershell
python deploy_server.py --dry-run
```

干运行模式会输出将要上传的产物目录、备份路径、重启命令以及健康检查地址，但不会真正修改本地或服务器状态，可用于上线前的检查。

## 服务器端说明

服务器端仅允许执行以下操作：

- 备份现有 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist` 到对应的 `.bak-<timestamp>` 目录。
- 将上传的构建产物替换为当前 dist 目录。
- `pm2 restart deepmindmap-server`
- `pm2 restart deepmindmap-admin`
- 通过 `curl` 请求健康检查端点。

服务器端严禁：

- 执行 `git pull`、`git fetch`、`git reset --hard origin/main`
- 执行 `npm install`、`npm ci`
- 执行 `npm run build`、`npx tsc`
- 直接修改源码后重新构建

## 回滚命令

### 本地回滚

回退本地仓库到部署前状态：

```powershell
python rollback_local.py <timestamp>
```

或回滚到最近一次部署：

```powershell
python rollback_local.py --latest
```

### 远程回滚

恢复服务器端的 dist 目录到部署前备份：

```powershell
python rollback_remote.py <timestamp>
```

或回滚到最近一次部署：

```powershell
python rollback_remote.py --latest
```

### 回滚使用场景

- **本地构建失败**：无需回滚服务器，修复本地问题后重新运行 `python deploy_server.py`。
- **上传阶段失败**：服务器尚未替换 dist，直接重试 `python deploy_server.py`。
- **替换或重启后健康检查失败**：立即使用 `rollback_remote.py` 恢复服务器端备份，排查问题后再重新部署。
- **本地代码需要回退**：使用 `rollback_local.py` 恢复到部署前标签。

## 服务器端脚本 `deploy.sh`

`deploy.sh` 已调整为仅提示脚本。若被单独在服务器上调用，会输出以下信息并退出：

```text
请改用本地 deploy_server.py 进行部署。
服务器端不再拉取 Git 代码，也不再执行 npm install / npm run build。
```

所有部署操作必须由本地开发机通过 `deploy_server.py` 触发。

## 安全注意事项

- `.env.deploy` 与 `.secrets/` 已加入 `.gitignore`，请勿提交到 Git。
- 不要在任何代码中硬编码密码、API Key、私钥、服务器 IP 等敏感信息。
- 私钥文件应设置合适的文件权限，避免被未授权用户读取。
- 生产环境健康检查地址建议通过内网或带认证的访问策略进行保护。
- 部署前必须完成 Git 提交、推送与标签，禁止直接覆盖线上代码。
