# Tasks

- [ ] Task 1: 完整部署 admin/server 到服务器
  - [ ] SubTask 1.1: 本地构建 admin/server（npm run build）
  - [ ] SubTask 1.2: 将 admin/server/dist/ 完整上传到服务器 /www/wwwroot/AI_mindmap/admin/server/dist/
  - [ ] SubTask 1.3: 将 admin/server/src/ 完整上传到服务器 /www/wwwroot/AI_mindmap/admin/server/src/（确保源码同步）
  - [ ] SubTask 1.4: 验证服务器 dist/routes/ 目录包含 auditLogs.js、adminAccounts.js、userSegments.js、announcements.js、search.js

- [ ] Task 2: 完整部署 main server 到服务器
  - [ ] SubTask 2.1: 本地构建 server（npm run build）
  - [ ] SubTask 2.2: 将 server/dist/ 完整上传到服务器 /www/wwwroot/AI_mindmap/server/dist/
  - [ ] SubTask 2.3: 将 server/src/ 完整上传到服务器 /www/wwwroot/AI_mindmap/server/src/
  - [ ] SubTask 2.4: 验证服务器 dist/routes/ 目录包含 announcements.js、features.js

- [ ] Task 3: 重新部署客户端 dist
  - [ ] SubTask 3.1: 本地构建 client（npm run build）
  - [ ] SubTask 3.2: 将 client/dist/ 完整上传到服务器 /www/wwwroot/AI_mindmap/client/dist/
  - [ ] SubTask 3.3: 本地构建 admin/client（npm run build）
  - [ ] SubTask 3.4: 将 admin/client/dist/ 完整上传到服务器 /www/wwwroot/AI_mindmap/admin/client/dist/

- [ ] Task 4: 检查并修复服务器 MongoDB 连接
  - [ ] SubTask 4.1: 检查服务器 .env 文件中 MONGODB_URI 配置
  - [ ] SubTask 4.2: 检查 MongoDB 服务是否运行
  - [ ] SubTask 4.3: 如需修复，更新 .env 并重启服务

- [ ] Task 5: 重启 PM2 并验证所有端点
  - [ ] SubTask 5.1: pm2 restart deepmindmap-server deepmindmap-admin
  - [ ] SubTask 5.2: 验证 admin 新增端点返回 200（audit-logs、admin-accounts、user-segments、announcements、search）
  - [ ] SubTask 5.3: 验证主应用新增端点返回 200（announcements、features）
  - [ ] SubTask 5.4: 验证 PM2 日志无 404 错误

# Task Dependencies
- Task 5 依赖 Task 1、2、3、4
- Task 1、2、3、4 可并行
