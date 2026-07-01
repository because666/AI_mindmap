# 诊断工作区置顶失败与用户封禁按钮缺失 Spec

 ## Why

 用户反馈两个后台管理功能异常：
 1. **工作区置顶**点击后提示失败；
 2. **用户封禁**按钮在当前后台页面中消失，但用户记得之前存在该功能。

 通过代码静态审查发现，这两个功能在本地代码中均已实现（`admin/server/src/routes/workspaces.ts` 有 `/:id/pin` 和 `DELETE /:id/pin`，`admin/server/src/routes/users.ts` 有 `/:id/ban` 和 `/:id/unban`，前端 `WorkspacesPage.tsx` 和 `UsersPage.tsx` 也有对应 UI）。因此问题更可能出现在**运行时环境、部署状态、数据/schema 兼容性**或**前端条件渲染**上。

 需要先系统性地复现和定位问题，再给出针对性修复建议，由用户确认后再执行修复。

 ## What Changes

 - **诊断工作区置顶失败**：
   - 检查后台 `POST /api/admin/workspaces/:id/pin` 接口的本地可访问性与返回值；
   - 检查服务器端该接口的日志/错误响应；
   - 检查 `workspaces` 集合中是否存在 `isPinned` / `pinnedAt` 字段；
   - 检查前端请求路径、角色权限、错误提示链路。
 - **诊断用户封禁按钮缺失**：
   - 对比本地 `UsersPage.tsx` 与线上/当前运行版本的 DOM；
   - 检查用户列表接口返回的 `isBanned` 字段是否存在；
   - 检查前端是否因权限、角色、feature flag 或构建产物过旧导致按钮未渲染；
   - 检查服务器路由是否注册 `/:id/ban` 接口。
 - **输出诊断报告**：
   - 给出置顶失败的根因假设与验证步骤；
   - 给出封禁按钮缺失的根因假设与验证步骤；
   - 给出修复建议与可选修复方案。

 ## Impact

 - Affected specs: `implement-remaining-product-features`（置顶功能）、`p0-p1-security-quality-overhaul` 或历史用户管理相关 spec
 - Affected code（待验证）：
   - `admin/server/src/routes/workspaces.ts`
   - `admin/server/src/routes/users.ts`
   - `admin/client/src/pages/Workspaces/WorkspacesPage.tsx`
   - `admin/client/src/pages/Users/UsersPage.tsx`
   - 服务器 MongoDB `workspaces` / `visitors` 集合字段
   - 线上/本地构建产物一致性

 ## ADDED Requirements

 ### Requirement: 工作区置顶失败根因诊断

 系统 SHALL 通过本地接口测试、服务器日志检查、数据库字段检查，定位工作区置顶失败的根因。

 #### Scenario: 本地接口测试
 - **WHEN** 在本地或服务器上调用 `POST /api/admin/workspaces/{workspaceId}/pin`
 - **THEN** 返回 200 且 `success: true`，或返回明确错误码与错误信息
 - **AND** 记录错误信息用于分析

 #### Scenario: 服务器日志检查
 - **WHEN** 检查 admin 服务端日志
 - **THEN** 找到用户点击置顶时对应的请求日志、错误堆栈或数据库操作失败信息

 #### Scenario: 数据库字段检查
 - **WHEN** 检查 `workspaces` 集合的文档结构
 - **THEN** 确认 `isPinned` 与 `pinnedAt` 字段存在且类型正确
 - **AND** 若字段不存在，记录为 schema 不一致问题

 ### Requirement: 用户封禁按钮缺失根因诊断

 系统 SHALL 通过前端代码审查、DOM 对比、接口字段检查、构建产物检查，定位用户封禁按钮缺失的根因。

 #### Scenario: 前端代码审查
 - **WHEN** 查看 `UsersPage.tsx`
 - **THEN** 确认 `handleBan` / `handleUnban` 函数与封禁按钮 JSX 是否存在
 - **AND** 确认按钮是否被条件渲染隐藏（如权限判断、feature flag、状态过滤）

 #### Scenario: 构建产物对比
 - **WHEN** 对比本地最新构建产物与服务器当前部署的 admin 客户端产物
 - **THEN** 确认服务器上的 `UsersPage` 产物是否包含封禁按钮相关代码
 - **AND** 若产物过旧，记录为部署不同步问题

 #### Scenario: 接口字段检查
 - **WHEN** 调用 `GET /api/admin/users`
 - **THEN** 返回的用户列表项包含 `isBanned` 字段
 - **AND** 若字段缺失，记录为后端返回结构问题

 ## MODIFIED Requirements

 无。本次为诊断性 spec，不修改功能代码。

 ## 诊断结论（基于 2026-07-01 检查）

### 工作区置顶失败

- **现象**：服务器日志中 `POST /api/admin/workspaces/{id}/pin` 返回 **403**，响应体长度 70。
- **根因**：后台登录接口 `admin/server/src/routes/auth.ts` 的 `real-login` 在创建 `admin_sessions` 文档时没有写入 `role` 字段；`requireAuth` 将 `session.role` 挂载到 `req.adminRole`；`workspaces.ts` 的置顶/取消置顶接口使用 `requireRole('super_admin', 'operator')`，当 `adminRole` 为空时直接返回 403。
- **验证方法**：在浏览器开发者工具 Network 面板点击置顶，可看到 403 响应，消息为“当前账户未分配角色，无权访问”。
- **修复建议**：
  1. 在 `real-login` 中创建 session 时固定写入 `role: 'super_admin'`（单管理员模式）。
  2. （可选）登录时从 `admin_accounts` 集合读取管理员角色并写入 session（多管理员模式）。
  3. 临时方案：移除 `workspaces.ts` 中 pin/unpin 的 `requireRole`，但会降低权限控制粒度。

### 用户/工作区封禁按钮缺失

- **现象**：用户反馈找不到封禁按钮。
- **检查结果**：
  - `UsersPage.tsx` 中已包含封禁/解封按钮与弹窗，且未按权限或 feature flag 隐藏。
  - `GET /api/admin/users` 返回 `isBanned` 字段。
  - 本地和服务器 `admin/client/dist` 的最新构建产物均包含“封禁”、“确认封禁”等 UI 代码；`index.html` 引用的也是该最新 JS。
  - 服务器日志显示 `POST /api/admin/users/{id}/ban` 在 2026-07-01 10:38 已返回 200，说明接口可用。
- **可能原因**：
  1. 浏览器或 CDN 缓存了旧的 admin 客户端（虽然 index.html 已更新，但 Service Worker/强缓存仍可能生效）。建议强制刷新或清除缓存后访问 `/users`。
  2. 如果用户查看的是“工作区管理”页面，当前页面只有“关闭”按钮（XCircle），没有名为“封禁”的按钮。若需求是“封禁工作区”，需要新增 workspace ban 功能或把“关闭”文案/语义改为“封禁”。
- **验证方法**：打开后台 `/users`，查看表格最后一列操作区是否有红色“封禁”按钮；或查看浏览器 Network 确认加载的 JS 文件为当前服务器产物（如 `/assets/index-C0TNPBWW.js`）。

### 代码状态说明

- 本地存在未提交变更：上一轮部署/修复相关的 `deploy_server.py`、`rollback_remote.py`、`.trae` 规则与技能、`admin/server/src/services/cacheNotify.ts` 等；本诊断产生的 spec 文件尚未跟踪。
- 工作区置顶/用户封禁的本地前后端源码均完整，服务器产物也包含相关代码，无需新增功能代码，主要修复点在登录时写入角色。

## REMOVED Requirements

无。
