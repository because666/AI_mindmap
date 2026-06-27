# Tasks

> 修复埋点路由 404 和地图库闪退

---

- [x] Task 1: 修复 deploy_server.py 文件列表
  - [x] SubTask 1.1: 在 deploy_server.py 中添加 `server/src/routes/events.ts`
  - [x] SubTask 1.2: 在 deploy_server.py 中添加 `server/src/index.ts`

- [x] Task 2: 修复地图库组件稳定性
  - [x] SubTask 2.1: 在 MapLibrary.tsx 的 fetchWorkspaceMetadata 调用中添加异常保护
  - [x] SubTask 2.2: 在 MapLibrary.tsx 的 track 调用中添加 try-catch 保护

- [ ] Task 3: 部署并验证
  - [ ] SubTask 3.1: 执行部署
  - [ ] SubTask 3.2: 验证 /api/events 返回 200
  - [ ] SubTask 3.3: 验证地图库面板正常打开
