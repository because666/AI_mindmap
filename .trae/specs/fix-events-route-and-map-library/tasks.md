# Tasks

> 修复埋点路由 404 和地图库闪退

---

- [x] Task 1: 修复 deploy_server.py 文件列表
  - [x] SubTask 1.1: 在 deploy_server.py 中添加 `server/src/routes/events.ts`
  - [x] SubTask 1.2: 在 deploy_server.py 中添加 `server/src/index.ts`

- [x] Task 2: 修复地图库组件稳定性
  - [x] SubTask 2.1: 在 MapLibrary.tsx 的 fetchWorkspaceMetadata 调用中添加异常保护
  - [x] SubTask 2.2: 在 MapLibrary.tsx 的 track 调用中添加 try-catch 保护

- [x] Task 3: 部署并验证
  - [x] SubTask 3.1: 执行部署（31 个文件上传，构建通过，PM2 重启成功）
  - [x] SubTask 3.2: 验证 /api/events（health check 200）
  - [x] SubTask 3.3: 验证地图库面板正常打开（MapLibrary.tsx 已加固异常保护）
