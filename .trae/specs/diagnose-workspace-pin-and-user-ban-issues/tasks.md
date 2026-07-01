# Tasks

- [x] Task 1: 收集并整理当前代码状态
  - [x] SubTask 1.1: 读取 `admin/server/src/routes/workspaces.ts` 中置顶接口完整代码
  - [x] SubTask 1.2: 读取 `admin/server/src/routes/users.ts` 中封禁接口完整代码
  - [x] SubTask 1.3: 读取 `admin/client/src/pages/Workspaces/WorkspacesPage.tsx` 中置顶按钮与请求代码
  - [x] SubTask 1.4: 读取 `admin/client/src/pages/Users/UsersPage.tsx` 中封禁按钮与弹窗代码
  - [x] SubTask 1.5: 读取 `admin/client/src/services/api.ts` 中 `workspacesApi.pinWorkspace` / `usersApi.ban` / `usersApi.unban` 定义
  - [x] SubTask 1.6: 检查本地当前是否有未提交的代码变更（`git status`）

- [x] Task 2: 工作区置顶失败诊断
  - [x] SubTask 2.1: 检查 `workspaces` 集合中是否存在 `isPinned` / `pinnedAt` 字段（通过 MongoDB 查询或代码推断）
  - [x] SubTask 2.2: 在本地/服务器手动调用 `POST /api/admin/workspaces/{id}/pin`，记录响应
  - [x] SubTask 2.3: 检查 admin 服务端日志中是否有置顶失败的错误信息
  - [x] SubTask 2.4: 检查前端 `workspacesApi.pinWorkspace` 调用的 URL、参数、错误处理链路
  - [x] SubTask 2.5: 列出置顶失败的至少 2 个可能根因与验证优先级

- [x] Task 3: 用户封禁按钮缺失诊断
  - [x] SubTask 3.1: 检查 `UsersPage.tsx` 中封禁按钮是否被条件渲染隐藏（权限、状态、feature flag）
  - [x] SubTask 3.2: 检查 `GET /api/admin/users` 返回结构是否包含 `isBanned` 字段
  - [x] SubTask 3.3: 检查本地构建产物 `admin/client/dist` 中 `UsersPage` 相关 chunk 是否包含封禁按钮代码
  - [x] SubTask 3.4: 检查服务器当前部署的 `admin/client/dist` 与本地构建产物是否一致
  - [x] SubTask 3.5: 列出封禁按钮缺失的至少 2 个可能根因与验证优先级

- [x] Task 4: 输出诊断报告与修复建议
  - [x] SubTask 4.1: 汇总 Task 2 的置顶失败诊断结论
  - [x] SubTask 4.2: 汇总 Task 3 的封禁按钮缺失诊断结论
  - [x] SubTask 4.3: 针对每个问题给出 1-2 条最可能的修复方案
  - [x] SubTask 4.4: 给出用户自行验证的方法（如调用接口、查看按钮、检查集合字段）

# Task Dependencies

- Task 1 为前置任务
- Task 2 与 Task 3 可并行执行
- Task 4 依赖 Task 2 与 Task 3
