# 部署指南

## 部署概述

本项目支持通过 `deploy_server.py` 从 Windows 开发机一键部署到远程 Linux 服务器。该脚本会自动完成本地提交与打标、服务器端备份、文件上传、远程构建、pm2 重启以及健康检查等步骤，确保上线流程可重复、可追溯。

## 环境准备

1. 复制项目根目录下的 `.env.deploy.example` 为 `.env.deploy`，并填入真实值：

   ```text
   DEPLOY_HOST=your_server_ip
   DEPLOY_USER=your_ssh_user
   DEPLOY_SSH_KEY_PATH=your_ssh_key_path
   DEPLOY_PROJECT_DIR=your_project_dir
   DEPLOY_PM2_SERVER=deepmindmap-server
   DEPLOY_PM2_ADMIN=deepmindmap-admin
   DEPLOY_HEALTH_URL_SERVER=http://your_server_ip:3001/health
   DEPLOY_HEALTH_URL_ADMIN=http://your_server_ip:3002/api/health
   ZHIPU_API_KEY_2=your_zhipu_api_key
   ```

2. 确保 `.secrets/deploy_key` 私钥存在且对服务器有效（已配置）。
3. 确保服务器上已安装 Node.js、npm、pm2、curl。

## 部署命令

### 完整部署

```powershell
python deploy_server.py
```

### 干运行预览

```powershell
python deploy_server.py --dry-run
```

干运行模式会输出将要上传的文件、要执行的远程命令以及健康检查地址，但不会真正修改服务器状态，可用于上线前的检查。

## 部署流程说明

1. **本地 Git 自动提交并打标签**：生成标签 `deploy-backup-<timestamp>`，记录本次部署前的本地代码状态。
2. **服务器端备份**：
   - `server.bak-<timestamp>`
   - `admin/server.bak-<timestamp>`
   - `client/dist.bak-<timestamp>`
3. **上传变更文件**：将本次需要更新的文件通过 SFTP 上传到服务器对应目录。
4. **服务器端构建**：依次构建 `server`、`admin/server`、`client`、`admin/client`。
5. **pm2 重启**：重启 `deepmindmap-server` 与 `deepmindmap-admin`。
6. **健康检查**：检查 `3001/health` 与 `3002/api/health`，确认服务已正常启动。

## 回滚命令

### 本地回滚

```powershell
python rollback_local.py <timestamp>
```

或回滚到最近一次部署：

```powershell
python rollback_local.py --latest
```

### 远程回滚

```powershell
python rollback_remote.py <timestamp>
```

或回滚到最近一次部署：

```powershell
python rollback_remote.py --latest
```

## 服务器端全量部署脚本

项目根目录下的 `deploy.sh` 用于在服务器上执行全量部署。使用前需要先在服务器环境中设置 `ZHIPU_API_KEY_2`：

```bash
export ZHIPU_API_KEY_2=your_zhipu_api_key
bash deploy.sh
```

该脚本会在服务器本地完成依赖安装、构建、pm2 启动/重启等操作，适用于初次部署或在服务器上直接维护的场景。

## 安全注意事项

- `.env.deploy` 与 `.secrets/` 已加入 `.gitignore`，请勿提交到 Git。
- 不要在任何代码中硬编码密码、API Key、私钥等敏感信息。
- 私钥文件应设置合适的文件权限，避免被未授权用户读取。
- 生产环境健康检查地址建议通过内网或带认证的访问策略进行保护。
