# Tasks

> 对应 spec.md：工作区地图库
> 范围：在侧边栏新增地图库入口，展示用户所有地图的列表、元数据，支持搜索、排序、切换

---

- [x] Task 1: 后端 - 新增工作区节点数批量查询接口
  - [x] SubTask 1.1: 在 `server/src/routes/workspaces.ts` 新增 `GET /api/workspaces/mine/metadata` 接口，返回用户所有工作区的节点数、最后编辑时间
  - [x] SubTask 1.2: 在 `server/src/services/nodeService.ts` 新增 `getNodeCount(workspaceId)` 方法，从缓存中获取节点数量（不加载全部节点数据）
  - [x] SubTask 1.3: 接口返回格式：`{ success: true, data: Array<{ workspaceId: string; nodeCount: number; lastNodeUpdatedAt: string }> }`

- [x] Task 2: 前端 - 扩展 API 和 Store
  - [x] SubTask 2.1: 在 `client/src/services/api.ts` 的 `workspaceApi` 中新增 `getMineMetadata()` 方法，调用后端元数据接口
  - [x] SubTask 2.2: 在 `client/src/stores/visitorWorkspaceStore.ts` 中新增 `workspaceMetadata` 状态（`Record<string, { nodeCount: number; lastNodeUpdatedAt: string }>`）和 `fetchWorkspaceMetadata` 方法

- [x] Task 3: 前端 - 地图库面板组件
  - [x] SubTask 3.1: 新建 `client/src/components/Workspace/MapLibrary.tsx` 组件，包含搜索框、排序选择器、地图卡片列表
  - [x] SubTask 3.2: 地图卡片展示：地图名称、节点数、最后编辑时间（相对时间）、当前地图高亮标记
  - [x] SubTask 3.3: 实现搜索过滤逻辑（按名称模糊匹配，前端过滤）
  - [x] SubTask 3.4: 实现排序逻辑（最近编辑时间 / 创建时间，前端排序）
  - [x] SubTask 3.5: 点击地图卡片调用 `switchWorkspace` 切换并关闭面板
  - [x] SubTask 3.6: 新增"新建地图"按钮，复用现有 `createWorkspace` 逻辑

- [x] Task 4: 前端 - 侧边栏入口和集成
  - [x] SubTask 4.1: 在 `MainLayout.tsx` 的侧边栏"导航"区域新增"地图库"按钮（Map 图标）
  - [x] SubTask 4.2: 按钮点击后打开 MapLibrary 面板（与搜索、历史等面板同级）
  - [x] SubTask 4.3: 移动端侧边栏同步新增地图库入口

- [x] Task 5: 前端 - i18n 和埋点
  - [x] SubTask 5.1: 在 `locales/nav/zh.json` 和 `locales/nav/en.json` 新增地图库相关翻译键
  - [x] SubTask 5.2: 在 `tracker.ts` 新增 `map_library_opened`、`map_library_search`、`map_library_switch` 埋点事件常量
  - [x] SubTask 5.3: 在 MapLibrary 组件中接入埋点上报

---

# Task Dependencies

- Task 1 是前置任务，Task 2 依赖 Task 1（需要后端接口）
- Task 3 依赖 Task 2（需要 Store 数据）
- Task 4 依赖 Task 3（需要组件渲染）
- Task 5 可与 Task 3、Task 4 并行（i18n 和埋点独立）

# Parallelization

- 第一批：Task 1（后端接口）
- 第二批：Task 2（前端 API + Store）
- 第三批：Task 3 + Task 5（组件 + i18n/埋点，可并行）
- 第四批：Task 4（集成到侧边栏）
