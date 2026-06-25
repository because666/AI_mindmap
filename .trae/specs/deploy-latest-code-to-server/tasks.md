# Tasks

## 前置准备

- [x] Task 0: 收集服务器连接信息
  - [x] SubTask 0.1: 确认服务器 IP、SSH 端口、用户名、认证方式（密钥/密码）
  - [x] SubTask 0.2: 确认服务器上主服务、Admin 服务的部署路径
  - [x] SubTask 0.3: 确认服务启动方式（PM2 进程名 / systemd 服务名 / 其他）
  - [x] SubTask 0.4: 确认健康检查端点地址与预期响应

## 第一阶段：本地打包（可并行）

- [x] Task 1: 主服务端打包
  - [x] SubTask 1.1: 进入 `server/` 目录执行 `npm run build`
  - [x] SubTask 1.2: 将 `server/` 目录（含 `dist/`、`package.json`、`package-lock.json`，排除 `node_modules/`、`.env`、`logs/`、`uploads/`）打包为 `server-deploy.tar.gz`

- [x] Task 2: Admin 服务端打包
  - [x] SubTask 2.1: 进入 `admin/server/` 目录执行 `npm run build`
  - [x] SubTask 2.2: 将 `admin/server/` 目录（含 `dist/`、`package.json`、`package-lock.json`，排除 `node_modules/`、`.env`、`logs/`）打包为 `admin-server-deploy.tar.gz`

- [x] Task 3: 前端产物打包
  - [x] SubTask 3.1: 进入 `client/` 目录执行 `npm run build`
  - [x] SubTask 3.2: 将 `client/dist/` 目录打包为 `client-dist.tar.gz`

## 第二阶段：上传到服务器（可并行）

- [x] Task 4: 上传主服务包
  - [x] SubTask 4.1: 使用 scp 将 `server-deploy.tar.gz` 上传到服务器临时目录（如 `/tmp/`）
  - [x] SubTask 4.2: 在服务器上校验压缩包 MD5/SHA256 与本地一致

- [x] Task 5: 上传 Admin 服务包
  - [x] SubTask 5.1: 使用 scp 将 `admin-server-deploy.tar.gz` 上传到服务器临时目录
  - [x] SubTask 5.2: 在服务器上校验压缩包 MD5/SHA256 与本地一致

- [x] Task 6: 上传前端产物包
  - [x] SubTask 6.1: 使用 scp 将 `client-dist.tar.gz` 上传到服务器临时目录
  - [x] SubTask 6.2: 在服务器上校验压缩包 MD5/SHA256 与本地一致

## 第三阶段：服务器部署与重启

- [x] Task 7: 部署主服务
  - [x] SubTask 7.1: 备份服务器上当前主服务目录（如 `mv /app/server /app/server.bak.YYYYMMDD-HHmmss`）
  - [x] SubTask 7.2: 在目标位置解压 `server-deploy.tar.gz`
  - [x] SubTask 7.3: 保留原 `.env`、上传目录等配置文件与数据，不覆盖
  - [x] SubTask 7.4: 在服务器上执行 `npm install --production`（如 node_modules 未打包）
  - [x] SubTask 7.5: 重启主服务进程

- [x] Task 8: 部署 Admin 服务
  - [x] SubTask 8.1: 备份服务器上当前 Admin 服务目录
  - [x] SubTask 8.2: 在目标位置解压 `admin-server-deploy.tar.gz`
  - [x] SubTask 8.3: 保留原 `.env` 等配置文件
  - [x] SubTask 8.4: 在服务器上执行 `npm install --production`
  - [x] SubTask 8.5: 重启 Admin 服务进程

- [x] Task 9: 部署前端产物
  - [x] SubTask 9.1: 备份服务器上当前前端静态目录
  - [x] SubTask 9.2: 在目标位置解压 `client-dist.tar.gz`
  - [x] SubTask 9.3: 确保 Nginx/静态服务器配置无需修改即可服务新产物

## 第四阶段：验证与收尾

- [x] Task 10: 服务健康检查
  - [x] SubTask 10.1: 检查主服务进程状态（PM2 list / systemctl status）
  - [x] SubTask 10.2: 检查 Admin 服务进程状态
  - [x] SubTask 10.3: 调用健康检查接口确认返回 200
  - [x] SubTask 10.4: 访问前端页面确认可正常加载

- [x] Task 11: 清理
  - [x] SubTask 11.1: 删除服务器临时目录中的压缩包
  - [x] SubTask 11.2: 删除本地生成的部署包（可选）
  - [x] SubTask 11.3: 保留最近 1-2 个备份，删除更早的备份

# Task Dependencies

- Task 1/2/3 可并行执行
- Task 4/5/6 可并行执行，依赖 Task 1/2/3 完成
- Task 7/8/9 可并行执行，依赖 Task 4/5/6 完成
- Task 10 依赖 Task 7/8/9 完成
- Task 11 依赖 Task 10 完成
