# 全面核查与问题修复 Spec

## Why

对 `nonlinear-conversation-experience` 产品策略中已实现的全部功能进行系统核查后，发现 26 个问题，其中严重问题 10 个（导致封禁功能失效、安全漏洞、功能不可用）。本 spec 统一修复所有发现的问题。你还要到服务器上检查正在运行的服务，我担心有时候本地没问题，但是服务器上跑就有问题

## What Changes

### P0 - 封禁功能修复（用户报告的核心问题）

* 修复 admin `auth.ts` 三个接口（`/auth/me`、`/auth/check-ip`、`/auth/login`）响应格式不统一，导致前端 `fetchMe` 永远判定未登录

* 修复 `cacheNotify.ts` 模块加载时硬抛错，未设置 `INTERNAL_API_TOKEN` 导致 admin 服务启动崩溃

* 修复 `handleBan` 未校验封禁原因，前端应拦截空原因并提示

* 优化封禁接口不被 `notifyVisitorCacheClear` 阻塞（改为 `void` 调用）

### P0 - 后端安全修复

* 修复 `nodes.ts` 路由顺序 bug：`/:id` 遮蔽 `/export` 和 `/import`，导致导出/导入功能 404

* 修复 `push.ts` 全部 10 个路由无认证中间件，任何人可发送广播

* 修复 `conversations.ts` 内部 API token 使用 `!==` 比较的时序攻击漏洞

* 修复 `events.ts` 和 `feedback.ts` IP 限流 Map 无清理机制导致内存泄漏

### P1 - 前端功能修复

* 修复 `ChatPanel.tsx` JSON.parse 缺少独立错误处理

* 修复 `contextUsage` 翻译键缺失

* 修复模板创建失败时弹窗不关闭且无提示

* 修复 `ChatPanel.tsx`、`MapLibrary.tsx`、`MainLayout.tsx` 中硬编码中文文本

### P2 - 代码质量改进

* 删除 `ChatPanel.tsx` 重复的 useEffect

* 统一 `NodeData` 接口定义

* 补充埋点数据结构 `nodeId`/`mapId` 顶层字段

* 清理冗余翻译键

* 优化 Tracker 重试逻辑

## Impact

* Affected code:

  * `admin/server/src/routes/auth.ts`（响应格式统一）

  * `admin/server/src/services/cacheNotify.ts`（延迟校验）

  * `admin/server/src/routes/users.ts`（不阻塞调用）

  * `admin/client/src/stores/authStore.ts`（响应解析适配）

  * `admin/client/src/pages/Users/UsersPage.tsx`（封禁原因校验）

  * `server/src/routes/nodes.ts`（路由顺序）

  * `server/src/routes/push.ts`（添加认证）

  * `server/src/routes/conversations.ts`（时序安全）

  * `server/src/routes/events.ts`（内存清理）

  * `server/src/routes/feedback.ts`（内存清理）

  * `client/src/components/Chat/ChatPanel.tsx`（错误处理+i18n）

  * `client/src/components/Workspace/TemplateLibrary.tsx`（失败提示）

  * `client/src/components/Workspace/MapLibrary.tsx`（i18n）

  * `client/src/locales/`（翻译键补充）

## ADDED Requirements

### Requirement: Admin 认证状态保持

管理员登录后刷新页面 SHALL 保持登录状态，不被错误地重定向到登录页。

#### Scenario: 刷新页面保持登录

* **WHEN** 管理员登录后刷新页面

* **THEN** `fetchMe` 正确解析响应，保持 `isAuthenticated: true`

* **AND** 不被重定向到登录页

### Requirement: 封禁功能可用

管理员 SHALL 能成功封禁用户账号，封禁后用户立即无法访问。

#### Scenario: 封禁用户

* **WHEN** 管理员填写封禁原因并点击确认

* **THEN** 用户被标记为封禁状态

* **AND** 主服务清除该用户缓存

* **AND** 前端显示封禁成功提示

### Requirement: 节点导出导入可用

用户 SHALL 能正常使用节点导出和导入功能。

#### Scenario: 导出节点

* **WHEN** 用户请求 `GET /api/nodes/export`

* **THEN** 返回导出数据而非 404

### Requirement: 推送接口安全

推送路由 SHALL 需要认证才能访问，管理员路由 SHALL 需要内部 token。

#### Scenario: 未认证访问广播

* **WHEN** 未认证用户请求 `POST /api/push/broadcast`

* **THEN** 返回 403 Forbidden

