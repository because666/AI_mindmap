# Tasks

> 修复埋点 400 + 重构地图库为独立实体

---

- [ ] Task 1: 修复 Tracker 数据格式（紧急）
  - [ ] SubTask 1.1: 修改 `tracker.ts` 的 `buildTrackerEvent` 方法，将 `commonProps` 中的 `visitorId`、`workspaceId`、`timestamp`、`url`、`userAgent` 展平到事件顶层
  - [ ] SubTask 1.2: 确保 `eventType`、`timestamp`、`createdAt` 字段在顶层
  - [ ] SubTask 1.3: 验证修复后 `/api/events` 返回 200

- [ ] Task 2: 后端 - 新增地图实体服务和 API
  - [ ] SubTask 2.1: 新增 `server/src/services/mapService.ts`，实现地图 CRUD（创建、查询列表、查询详情、更新、删除）
  - [ ] SubTask 2.2: 新增 `server/src/routes/maps.ts`，实现 RESTful 路由
  - [ ] SubTask 2.3: 地图数据存储使用 MongoDB `maps` 集合
  - [ ] SubTask 2.4: 在 `server/src/index.ts` 注册地图路由 `/api/workspaces/:workspaceId/maps`

- [ ] Task 3: 后端 - 节点增加 mapId 字段
  - [ ] SubTask 3.1: `nodeService.ts` 的 `createNode` 方法支持 `mapId` 参数
  - [ ] SubTask 3.2: `nodeService.ts` 的 `getAllNodes` 方法支持按 `mapId` 过滤
  - [ ] SubTask 3.3: 新增工作区时自动创建默认地图，返回 `defaultMapId`
  - [ ] SubTask 3.4: 现有节点兼容处理：无 `mapId` 的节点归属默认地图

- [ ] Task 4: 前端 - 地图 Store 和 API
  - [ ] SubTask 4.1: 在 `api.ts` 新增 `mapApi`（CRUD 接口）
  - [ ] SubTask 4.2: 新增 `client/src/stores/mapStore.ts`，管理当前地图、地图列表状态
  - [ ] SubTask 4.3: 在 `appStore.ts` 中集成 mapStore

- [ ] Task 5: 前端 - 重写地图库面板
  - [ ] SubTask 5.1: 重写 `MapLibrary.tsx`，展示当前工作区下的地图列表（非工作区列表）
  - [ ] SubTask 5.2: 地图卡片展示：地图名称、节点数、最后编辑时间
  - [ ] SubTask 5.3: 支持创建新地图、切换地图、搜索地图
  - [ ] SubTask 5.4: 切换地图后画布和对话面板关联到新地图

- [ ] Task 6: 前端 - 画布和对话关联地图
  - [ ] SubTask 6.1: `nodeStore.ts` 的节点操作（创建、加载）关联当前 `mapId`
  - [ ] SubTask 6.2: `chatStore.ts` 的对话操作关联当前 `mapId`
  - [ ] SubTask 6.3: 切换地图时重新加载节点和对话

- [ ] Task 7: 部署和验证
  - [ ] SubTask 7.1: 更新 `deploy_server.py` 文件列表
  - [ ] SubTask 7.2: 执行部署
  - [ ] SubTask 7.3: 验证 `/api/events` 返回 200
  - [ ] SubTask 7.4: 验证地图库展示当前工作区的地图列表
  - [ ] SubTask 7.5: 验证创建/切换地图功能正常

---

# Task Dependencies

- Task 1 独立，可立即执行（紧急修复）
- Task 2 和 Task 3 为后端基础，可并行
- Task 4 依赖 Task 2（需要后端 API）
- Task 5 依赖 Task 4（需要 Store）
- Task 6 依赖 Task 3 + Task 4
- Task 7 依赖所有前置任务
