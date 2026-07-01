# 修复工作区置顶失败与新增工作区封禁功能 Spec

## Why

上一轮诊断已确认工作区置顶失败的根因：后台登录接口 `admin/server/src/routes/auth.ts` 的 `real-login` 在创建 `admin_sessions` 文档时未写入 `role` 字段，导致 `requireRole('super_admin', 'operator')` 中间件因 `adminRole` 为空而返回 403。

同时用户提出新需求：当前只有用户可以被封禁，工作区只能"关闭"（`isClosed`），缺少"封禁"（`isBanned`）能力。封禁与关闭语义不同——封禁通常带有有效期、封禁原因、可解封，且应在主服务端拦截访问，而关闭目前只是标记且无解封接口。

本 spec 覆盖这两项确定的任务。用户提到的"AI服务商管理 vs AI模型管理是否重复"和"用户分群功能不可用"两项需进一步讨论，不在本 spec 范围内。

## What Changes

- **修复工作区置顶失败**：
  - 在 `admin/server/src/routes/auth.ts` 的 `real-login` 接口创建 `admin_sessions` 时写入 `role: 'super_admin'`。
  - 当前系统为单管理员密码模式（`admin_configs.passwordHash`），所有通过 `real-login` 登录的均为超级管理员，因此固定写入 `super_admin` 符合现状。
  - 同步更新 `auth.route.test.ts` 中相关测试用例，验证 session 写入 role 字段。
- **新增工作区封禁功能**：
  - 后端 `admin/server/src/routes/workspaces.ts` 新增 `POST /:id/ban` 和 `POST /:id/unban` 接口，使用 `requireRole('super_admin', 'operator')` 权限控制，支持封禁原因与有效期。
  - `workspaces` 集合新增 `isBanned` / `banReason` / `bannedAt` / `banExpiresAt` 字段（惰性迁移，写入时即创建）。
  - `GET /` 工作区列表返回项新增 `isBanned` / `banReason` / `banExpiresAt` 字段，并将封禁工作区在列表中标识。
  - 前端 `admin/client/src/services/api.ts` 新增 `workspacesApi.banWorkspace` 与 `workspacesApi.unbanWorkspace` 方法。
  - 前端 `admin/client/src/types/index.ts` 的 `WorkspaceListItem` 新增 `isBanned` / `banReason` / `banExpiresAt` 字段。
  - 前端 `admin/client/src/pages/Workspaces/WorkspacesPage.tsx` 新增封禁/解封按钮与封禁弹窗（参考 `UsersPage.tsx` 的封禁交互）。
  - 主服务端 `server/src/middleware/index.ts` 的工作区访问中间件中，新增 `isBanned` 检查，封禁工作区返回 403 并提示封禁原因（与现有 `isClosed` 检查并列）。
- **单元测试**：
  - `workspaces.route.test.ts` 新增 ban/unban 接口的正常流程、异常流程、边界情况测试。
  - `auth.route.test.ts` 更新 real-login 成功用例，验证 session 写入 `role: 'super_admin'`。

## Impact

- Affected specs: `diagnose-workspace-pin-and-user-ban-issues`（诊断已完成，本 spec 承接修复）、`implement-remaining-product-features`（置顶功能修复）
- Affected code:
  - `admin/server/src/routes/auth.ts`（修复 role 写入）
  - `admin/server/src/routes/workspaces.ts`（新增 ban/unban 接口、列表返回封禁字段）
  - `admin/server/src/middleware/auth.ts`（无改动，仅依赖 session.role）
  - `admin/client/src/services/api.ts`（新增 ban/unban API 方法）
  - `admin/client/src/types/index.ts`（WorkspaceListItem 新增封禁字段）
  - `admin/client/src/pages/Workspaces/WorkspacesPage.tsx`（新增封禁 UI）
  - `server/src/middleware/index.ts`（新增 isBanned 访问拦截）
  - `admin/server/src/test/workspaces.route.test.ts`（新增测试）
  - `admin/server/src/test/auth.route.test.ts`（更新测试）

## ADDED Requirements

### Requirement: 工作区封禁接口

系统 SHALL 提供 `POST /api/admin/workspaces/:id/ban` 接口，允许 super_admin / operator 角色封禁指定工作区，记录封禁原因与可选有效期。

#### Scenario: 封禁工作区成功
- **WHEN** 已认证的 super_admin 或 operator 调用 `POST /api/admin/workspaces/:id/ban`，body 包含 `reason` 字段和可选 `duration`（小时）
- **THEN** 返回 200，`success: true`，`message: '工作区已封禁'`
- **AND** `workspaces` 集合中该文档更新 `isBanned: true`、`banReason`、`bannedAt`、`banExpiresAt`（若 duration > 0）
- **AND** 触发 `notifyWorkspaceCacheClear` 通知主服务清除缓存

#### Scenario: 未提供封禁原因
- **WHEN** 调用 ban 接口但 body 中 `reason` 为空
- **THEN** 返回 400，`error: '请提供封禁原因'`

#### Scenario: 工作区不存在
- **WHEN** 调用 ban 接口但 `:id` 对应工作区不存在
- **THEN** 返回 404，`error: '工作区不存在'`

#### Scenario: 权限不足
- **WHEN** 未登录或角色不在 `super_admin` / `operator` 中
- **THEN** 返回 401 或 403

### Requirement: 工作区解封接口

系统 SHALL 提供 `POST /api/admin/workspaces/:id/unban` 接口，允许 super_admin / operator 角色解封指定工作区。

#### Scenario: 解封工作区成功
- **WHEN** 已认证的 super_admin 或 operator 调用 `POST /api/admin/workspaces/:id/unban`
- **THEN** 返回 200，`success: true`，`message: '工作区已解封'`
- **AND** `workspaces` 集合中该文档更新 `isBanned: false`、`banReason: null`、`banExpiresAt: null`、`unbannedAt: new Date()`
- **AND** 触发 `notifyWorkspaceCacheClear`

#### Scenario: 工作区不存在
- **WHEN** 调用 unban 接口但工作区不存在
- **THEN** 返回 404，`error: '工作区不存在'`

### Requirement: 工作区列表返回封禁状态

系统 SHALL 在 `GET /api/admin/workspaces` 返回的每个工作区项中包含 `isBanned`、`banReason`、`banExpiresAt` 字段，供前端展示封禁标记。

#### Scenario: 列表包含封禁字段
- **WHEN** 调用 `GET /api/admin/workspaces`
- **THEN** 每个 item 包含 `isBanned: boolean`、`banReason: string | undefined`、`banExpiresAt: string | undefined`

### Requirement: 主服务端封禁访问拦截

系统 SHALL 在主服务端工作区访问中间件中检查 `isBanned` 字段，封禁的工作区拒绝访问并返回 403 与封禁原因。

#### Scenario: 访问封禁工作区
- **WHEN** 用户请求访问 `isBanned: true` 的工作区
- **THEN** 返回 403，`error: '该工作区已被封禁：{banReason}'`，`code: 'WORKSPACE_BANNED'`

#### Scenario: 封禁过期自动放行
- **WHEN** 工作区 `isBanned: true` 但 `banExpiresAt` 已早于当前时间
- **THEN** 允许访问（封禁已过期）

### Requirement: 工作区封禁 UI

前端 SHALL 在工作区管理页面为每个工作区提供封禁/解封按钮，封禁时弹出弹窗收集封禁原因与有效期。

#### Scenario: 封禁未封禁工作区
- **WHEN** 管理员点击未封禁工作区的封禁按钮
- **THEN** 弹出封禁弹窗，包含原因输入框与有效期下拉（永久/1小时/24小时/7天/30天）
- **AND** 确认后调用 `banWorkspace` 接口，成功后更新列表并显示提示

#### Scenario: 解封已封禁工作区
- **WHEN** 管理员点击已封禁工作区的解封按钮
- **THEN** 调用 `unbanWorkspace` 接口，成功后更新列表并显示提示

#### Scenario: 封禁状态可视化
- **WHEN** 工作区列表中存在已封禁工作区
- **THEN** 该行显示红色"封禁"徽章，与置顶/关闭状态并列展示

## MODIFIED Requirements

### Requirement: 后台登录写入角色

`admin/server/src/routes/auth.ts` 的 `real-login` 接口在创建 `admin_sessions` 文档时 SHALL 写入 `role: 'super_admin'` 字段，确保 `requireRole` 中间件能正确放行需要角色的接口。

#### Scenario: 登录成功后 session 包含角色
- **WHEN** 用户通过 `real-login` 接口使用正确密码登录
- **THEN** `admin_sessions` 集合新增文档包含 `role: 'super_admin'`
- **AND** 后续请求经过 `requireAuth` 时 `req.adminRole` 被正确设置为 `super_admin`
- **AND** `requireRole('super_admin', 'operator')` 保护的置顶/封禁接口可正常调用

## REMOVED Requirements

无。
