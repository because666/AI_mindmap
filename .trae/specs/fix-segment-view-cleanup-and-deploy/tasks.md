# Tasks

- [ ] Task 1: 修复用户分群规则字段
  - [ ] SubTask 1.1: 修改 `admin/server/src/types/index.ts` 的 `SegmentRuleField` 类型为 `'lastActiveAt' | 'createdAt' | 'workspaceCount'`
  - [ ] SubTask 1.2: 修改 `admin/server/src/services/userSegmentService.ts` 的 `buildSegmentFilter`，更新 fieldMap 映射，`workspaceCount` 使用 `$expr`+`$size` 查询
  - [ ] SubTask 1.3: 修改 `admin/client/src/types/index.ts` 的 `SegmentRuleField` 类型同步更新
  - [ ] SubTask 1.4: 修改 `admin/client/src/pages/UserSegments/UserSegmentsPage.tsx` 的 `FIELD_LABELS` 和 `parseRuleValue`，更新字段标签和值解析逻辑

- [ ] Task 2: 用户管理页新增标签筛选与标签管理
  - [ ] SubTask 2.1: `admin/client/src/pages/Users/UsersPage.tsx` 新增标签下拉筛选器（加载标签列表、选择标签后调用 `userSegmentsApi.getUsersByTag` 筛选用户）
  - [ ] SubTask 2.2: `admin/client/src/pages/Users/UsersPage.tsx` 用户详情弹窗新增"标签"区域，展示用户已有标签，支持添加/移除标签（调用 `userSegmentsApi.addTagToUser`/`removeTagFromUser`）

- [ ] Task 3: 工作区查看详情弹窗
  - [ ] SubTask 3.1: `admin/client/src/services/api.ts` 的 `workspacesApi` 确认 `getDetail` 方法存在（调用 `GET /admin/workspaces/:id`），不存在则新增
  - [ ] SubTask 3.2: `admin/client/src/pages/Workspaces/WorkspacesPage.tsx` 为查看按钮绑定 `onClick`，新增详情弹窗状态 `detailModal`，点击时调用接口获取详情
  - [ ] SubTask 3.3: 详情弹窗展示工作区名称、描述、类型、创建时间、更新时间、成员数、节点数，包含加载态和关闭按钮

- [ ] Task 4: 移除 AI 服务商管理界面
  - [ ] SubTask 4.1: `admin/client/src/pages/Settings/SettingsPage.tsx` 移除 `aiProviders` tab 项、`AIProviderEditModal` 组件、`aiProviders`/`providerModal`/`providerMessage` 状态、`handleSaveAIProviders`/`handleAddProvider`/`handleEditProvider`/`handleDeleteProvider`/`handleSaveProvider` 函数、`AIProvider` import
  - [ ] SubTask 4.2: 移除 `activeTab` 类型中的 `'aiProviders'` 选项

- [ ] Task 5: 构建与测试验证
  - [ ] SubTask 5.1: admin server `npx tsc --noEmit` + `npx vitest run` 通过
  - [ ] SubTask 5.2: admin client `npm run build` 通过
  - [ ] SubTask 5.3: 主 server `npx tsc --noEmit` 通过

- [ ] Task 6: 部署到服务器
  - [ ] SubTask 6.1: 本地构建 admin/server、admin/client、server 产物
  - [ ] SubTask 6.2: 使用 deploy_server.py 上传到服务器（含备份）
  - [ ] SubTask 6.3: 服务器 PM2 重启与健康检查

# Task Dependencies

- Task 1、Task 2 可并行（分别改分群服务和用户管理页）
- Task 3 独立
- Task 4 独立
- Task 5 依赖 Task 1-4 完成
- Task 6 依赖 Task 5 通过
