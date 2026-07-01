# Tasks

- [x] Task 1: 修复工作区置顶失败（登录写入角色）
  - [x] SubTask 1.1: 修改 `admin/server/src/routes/auth.ts` 的 `real-login` 接口，在 `adminDB.insertOne('admin_sessions', {...})` 中新增 `role: 'super_admin'` 字段
  - [x] SubTask 1.2: 更新 `admin/server/src/test/auth.route.test.ts` 中 `POST /real-login` 的"正确密码登录成功"用例，验证 `mockInsertOne` 调用参数包含 `role: 'super_admin'`
  - [x] SubTask 1.3: 运行 auth 路由测试，确认通过

- [x] Task 2: 新增工作区封禁后端接口
  - [x] SubTask 2.1: 在 `admin/server/src/routes/workspaces.ts` 新增 `POST /:id/ban` 接口，使用 `requireAuth, requireRole('super_admin', 'operator'), auditLog('BAN_WORKSPACE', 'workspace')`，写入 `isBanned/banReason/bannedAt/banExpiresAt`，触发 `notifyWorkspaceCacheClear`
  - [x] SubTask 2.2: 在 `admin/server/src/routes/workspaces.ts` 新增 `POST /:id/unban` 接口，使用 `requireAuth, requireRole('super_admin', 'operator'), auditLog('UNBAN_WORKSPACE', 'workspace')`，清除封禁字段，触发 `notifyWorkspaceCacheClear`
  - [x] SubTask 2.3: 修改 `GET /` 工作区列表接口，返回项新增 `isBanned`、`banReason`、`banExpiresAt` 字段
  - [x] SubTask 2.4: 在 `admin/server/src/test/workspaces.route.test.ts` 新增 ban/unban 接口测试用例（成功、缺少原因 400、工作区不存在 404、数据库异常 500）

- [x] Task 3: 新增工作区封禁前端 UI
  - [x] SubTask 3.1: 在 `admin/client/src/types/index.ts` 的 `WorkspaceListItem` 接口新增 `isBanned?: boolean`、`banReason?: string`、`banExpiresAt?: string` 字段
  - [x] SubTask 3.2: 在 `admin/client/src/services/api.ts` 的 `workspacesApi` 新增 `banWorkspace(id, reason, duration)` 和 `unbanWorkspace(id)` 方法
  - [x] SubTask 3.3: 在 `admin/client/src/pages/Workspaces/WorkspacesPage.tsx` 新增封禁/解封按钮（参考 UsersPage 的 Ban/Unlock 图标）、封禁弹窗（原因输入 + 有效期下拉）、`handleBan`/`handleUnban` 函数、`banTogglingIds` 加载态
  - [x] SubTask 3.4: 在工作区列表表格中为已封禁工作区显示红色"封禁"徽章，与置顶徽章并列

- [x] Task 4: 主服务端封禁访问拦截
  - [x] SubTask 4.1: 在 `server/src/middleware/index.ts` 的工作区访问中间件中，于 `isClosed` 检查之后新增 `isBanned` 检查，封禁返回 403 + `code: 'WORKSPACE_BANNED'`
  - [x] SubTask 4.2: 处理 `banExpiresAt` 过期情况：若 `banExpiresAt` 存在且早于当前时间，则不拦截（封禁已过期）

- [x] Task 5: 构建与测试验证
  - [x] SubTask 5.1: 运行 admin server 的 TypeScript 编译与单元测试（`npm run build` + `npm test`）
  - [x] SubTask 5.2: 运行 admin client 的 TypeScript 编译与构建（`npm run build`）
  - [x] SubTask 5.3: 运行主 server 的 TypeScript 编译（`npm run build`），确认中间件改动无语法错误

# Task Dependencies

- Task 1 独立，可优先执行
- Task 2 与 Task 3 可并行执行（后端接口与前端 UI 互不依赖代码生成）
- Task 4 独立于 Task 2/3，可并行
- Task 5 依赖 Task 1-4 全部完成
