---
name: "server-deploy-checklist"
description: "服务端 TypeScript 项目部署检查清单。当部署服务端代码到远程服务器时触发，确保本地构建、上传产物、服务器替换/重启流程完整，避免服务器端执行构建或拉取代码。"
---

# 服务端 TypeScript 项目部署检查清单

## 触发条件

当需要将服务端 TypeScript 代码部署到远程服务器时，必须执行此检查清单。

## 核心理念

**服务端 TypeScript 项目部署必须「本地构建产物，本地上传产物，服务器端仅替换/重启」，部署流程不走 Git。部署前必须强制备份服务器端产物，备份失败中止部署。**

服务器端运行的是 `dist/` 目录下编译后的 JS 文件。所有编译、构建工作必须在本地完成，禁止在服务器端拉取源码或执行构建。服务器端仅负责强制备份旧产物、替换产物、重启 PM2 进程和健康检查。备份是强制步骤，任何情况下不可跳过。

## 部署流程

### 第一步：本地执行构建

在本地项目根目录依次执行：

```bash
# 服务端构建
npm run build:server

# 客户端构建
npm run build:client

# Admin 后台构建
npm run build:admin
```

**验证构建成功**：
- 所有构建命令 exit code 为 0
- 产物目录已生成：
  - `server/dist`
  - `client/dist`
  - `admin/server/dist`
  - `admin/client/dist`
- 无错误输出

> 注：若 `npm run build:admin` 内部分别执行 `admin/server` 与 `admin/client` 的 build，需确认两者均成功。

> **重要**：构建验证成功后，下一步必须先完成服务器端强制备份，不可跳过。只有在备份成功且通过验证后，才能执行上传和替换。

### 第二步：服务器端强制备份（上传前不可跳过）

在上传新产物之前，必须先在服务器端完成旧产物的强制备份：

```bash
# 在服务器部署路径下执行
mv client/dist client/dist.bak-<timestamp>
mv server/dist server/dist.bak-<timestamp>
mv admin/server/dist admin/server/dist.bak-<timestamp>
mv admin/client/dist admin/client/dist.bak-<timestamp>
```

**验证备份成功**：
- 以下四个备份目录均存在且非空：
  - `client/dist.bak-<timestamp>`
  - `server/dist.bak-<timestamp>`
  - `admin/server/dist.bak-<timestamp>`
  - `admin/client/dist.bak-<timestamp>`
- 备份命令 exit code 为 0
- 无错误输出

**旧备份清理**：备份验证成功后，自动清理过期备份，默认保留最近 10 个完整备份组。

**失败处理**：任一目录备份失败或验证不通过，立即中止部署，不得继续上传、替换或重启。

### 第三步：上传本地构建产物

```bash
python deploy_server.py
```

**验证上传成功**：
- 所有产物目录完整上传到服务器对应路径
- 上传命令 exit code 为 0
- 无传输错误

### 第四步：服务器端替换与重启

服务器端仅执行：

```bash
# 1. 替换为新产物目录（已由 deploy_server.py 上传到新路径，按实际脚本逻辑调整）

# 2. 重启 PM2 服务
pm2 restart deepmindmap-server
pm2 restart deepmindmap-admin

# 3. 健康检查
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3002/api/health
```

**全程禁止在服务器端执行**：
- `git pull`、`git fetch`、`git reset`
- `npm install`
- `npm run build`
- `npx tsc`
- 任何其他构建相关操作

### 第五步：验证服务正常运行

```bash
ssh <DEPLOY_USER>@<DEPLOY_HOST> "pm2 logs 服务名 --nostream --lines 20"
```

> 注：将 `<DEPLOY_USER>` 和 `<DEPLOY_HOST>` 替换为 `.env.deploy` 中的真实值（如 `DEPLOY_USER`、`DEPLOY_HOST`）。

检查：
- 服务状态为 `online`
- 无启动错误
- 健康检查端点返回正常

### 第六步：同步本地仓库到远程（可选）

部署成功后，非阻塞尝试同步本地代码到远程仓库：

```bash
git add .
git commit -m "类型(模块): 描述"
git push
```

> 注：此步骤为可选后置动作，失败仅打印提示信息，不触发回滚，不影响部署结果。可由用户后续手动处理同步失败的情况。

## 部署差异对比

| 步骤 | 客户端（Vite/React） | 服务端（TypeScript/Node） | Admin 后台 |
|------|---------------------|--------------------------|-----------|
| 本地构建 | `npm run build:client` | `npm run build:server` | `npm run build:admin` |
| 上传产物 | `client/dist` | `server/dist` | `admin/server/dist`、`admin/client/dist` |
| 服务器编译 | 不需要 | 不需要 | 不需要 |
| 重启服务 | 不需要（静态文件） | `pm2 restart` | `pm2 restart` |
| 服务器操作 | 仅替换静态文件 | 备份 → 替换 → 重启 → 健康检查 | 备份 → 替换 → 重启 → 健康检查 |

## 常见错误

1. **在服务器端执行构建**：违反「本地构建，上传产物」原则，可能导致环境不一致、构建失败或服务器负载异常。
2. **未备份直接替换产物**：违反强制备份原则，一旦新产物异常将无法回滚。
3. **忘记本地构建**：直接上传旧产物，服务器运行旧代码，修改不生效。
4. **上传产物不完整**：漏传 `admin/client/dist` 等目录，导致 Admin 前端无法加载新版本。
5. **忘记备份旧产物**：上传失败后无法快速回滚。
6. **忘记重启 PM2**：替换产物后进程仍运行旧代码。
7. **未执行健康检查**：服务异常启动后未能及时发现。

## 当前项目部署信息

- 服务器IP：<DEPLOY_HOST>（从 `.env.deploy` 的 `DEPLOY_HOST` 读取）
- 项目路径：/www/wwwroot/AI_mindmap
- 服务端服务名：deepmindmap-server
- Admin服务名：deepmindmap-admin
- 服务端运行目录：/www/wwwroot/AI_mindmap/server/dist
