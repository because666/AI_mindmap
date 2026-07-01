# 部署指南

## 部署概述

本项目采用「本地构建后直接上传产物」的标准化部署流程，**部署流程不走 Git**，**所有部署必须先完成服务器端强制备份**：

1. 本地执行 lint / test / build，确保构建产物通过验证。
2. 通过 `deploy_server.py` 将本地构建产物（`server/dist`、`client/dist`、`admin/server/dist`、`admin/client/dist`）上传到远程服务器。
3. 服务器端**强制备份**四个 dist 目录到 `.bak-<timestamp>`，并验证备份目录存在且非空；备份失败时立即中止部署。
4. 服务器端替换 dist 目录、PM2 重启、健康检查。
5. 部署成功后可选尝试同步本地仓库到远程（非阻塞，失败不影响部署结果）。

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
2. 本地执行 lint / test / build（若根目录存在 lint/test 脚本则执行，否则跳过并提示）。
3. 连接远程服务器。
4. 在服务器端**强制备份** `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist` 到对应的 `.bak-<timestamp>` 目录。
5. **验证备份完整性**：确认四个备份目录均存在且非空；若验证失败，立即中止部署。
6. **清理过期备份**：保留最近 10 个完整备份组（可通过 `DEPLOY_BACKUP_KEEP_COUNT` 环境变量调整），删除更早的历史备份。
7. 上传本地构建产物并原子替换服务器上的 dist 目录。
8. `pm2 restart` 主服务端与 Admin 服务端。
9. 对健康检查端点发起请求，确认返回 HTTP 200。
10. （可选）尝试同步本地仓库到远程：检查工作区并提交、推送分支、创建并推送 `deploy-backup-<timestamp>` 标签。此步骤非阻塞，失败仅打印提示，不影响部署结果。

### 干运行预览

```powershell
python deploy_server.py --dry-run
```

干运行模式会输出将要上传的产物目录、备份路径、重启命令以及健康检查地址，但不会真正修改本地或服务器状态，可用于上线前的检查。

## 服务器端说明

服务器端仅允许执行以下操作：

- **强制备份**现有 `client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist` 到对应的 `.bak-<timestamp>` 目录，并验证备份目录存在且非空。
- **清理过期备份**（保留最近 10 个完整备份组，可配置）。
- 将上传的构建产物替换为当前 dist 目录。
- `pm2 restart deepmindmap-server`
- `pm2 restart deepmindmap-admin`
- 通过 `curl` 请求健康检查端点。

**重要**：备份失败时 `deploy_server.py` 会立即中止部署，不会继续上传或替换 dist 目录。

服务器端严禁：

- 执行 `git pull`、`git fetch`、`git reset --hard origin/main`
- 执行 `npm install`、`npm ci`
- 执行 `npm run build`、`npx tsc`
- 直接修改源码后重新构建

## 回滚命令

### 本地回滚（依赖可选同步步骤）

> **注意**：本地回滚依赖部署后可选同步步骤创建的 `deploy-backup-<timestamp>` Git 标签。若部署时未执行可选同步（或同步失败），则无法使用本地回滚，此时请使用远程回滚。

回退本地仓库到部署前状态：

```powershell
python rollback_local.py <timestamp>
```

或回滚到最近一次部署：

```powershell
python rollback_local.py --latest
```

### 远程回滚

`rollback_remote.py` 使用 `deploy_server.py` 创建的四个备份目录进行回滚：

- `server/dist.bak-<timestamp>`
- `admin/server/dist.bak-<timestamp>`
- `client/dist.bak-<timestamp>`
- `admin/client/dist.bak-<timestamp>`

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
- **替换或重启后健康检查失败**：立即使用 `rollback_remote.py` 恢复服务器端备份，排查问题后再重新部署。服务器端备份由 `deploy_server.py` 在每次部署前强制创建。
- **本地代码需要回退**：若部署时执行了可选同步步骤并成功创建标签，可使用 `rollback_local.py` 恢复到部署前标签；否则需手动通过 `git reset` 回退。

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
- 部署前必须在服务器端**强制备份**旧产物目录（`client/dist`、`server/dist`、`admin/server/dist`、`admin/client/dist` 到对应的 `.bak-<timestamp>`），并验证备份目录存在且非空；备份失败时部署必须中止，禁止无备份直接覆盖线上代码。部署流程不走 Git，Git 同步仅作为部署后的可选非阻塞步骤。
