# Checklist

## 前置准备

- [x] 已确认服务器 IP、SSH 端口、用户名、认证方式
- [x] 已确认主服务在服务器上的部署路径
- [x] 已确认 Admin 服务在服务器上的部署路径
- [x] 已确认前端静态资源在服务器上的部署路径
- [x] 已确认服务启动方式（PM2 进程名 / systemd 服务名 / 其他）
- [x] 已确认健康检查端点与预期响应

## 本地打包

- [x] 主服务 `npm run build` 成功
- [x] Admin 服务 `npm run build` 成功
- [x] 前端 `npm run build` 成功
- [x] 本地生成 `server-deploy.tar.gz`
- [x] 本地生成 `admin-server-deploy.tar.gz`
- [x] 本地生成 `client-dist.tar.gz`

## 上传验证

- [x] `server-deploy.tar.gz` 已上传到服务器临时目录
- [x] `admin-server-deploy.tar.gz` 已上传到服务器临时目录
- [x] `client-dist.tar.gz` 已上传到服务器临时目录
- [x] 三个压缩包的校验和与本地一致

## 部署与重启

- [x] 主服务旧版本已备份
- [x] Admin 服务旧版本已备份
- [x] 前端旧版本已备份
- [x] 主服务新代码已解压到目标路径
- [x] Admin 服务新代码已解压到目标路径
- [x] 前端新产物已解压到目标路径
- [x] 原 `.env`、上传目录、日志目录等关键数据未丢失
- [x] 服务器上已执行依赖安装（server 单独安装 ioredis，admin/server npm install）
- [x] 主服务进程已重启
- [x] Admin 服务进程已重启

## 健康检查

- [x] 主服务进程状态正常
- [x] Admin 服务进程状态正常
- [x] 主服务健康检查接口返回 200
- [x] Admin 服务健康检查接口返回 200
- [x] 前端页面可正常加载

## 清理

- [x] 服务器临时目录中的压缩包已删除
- [x] 本地部署包已清理（可选）
- [x] 保留最新备份（server.bak-latest、admin/server.bak-latest、client/dist.bak-latest）
