# 修复用户分群、工作区查看、AI配置清理并部署 Spec

## Why

诊断确认四个问题：(1) 用户分群执行规则无效，因为 `visitors` 集合没有 `messageCount`/`hasOwnApiKey` 字段，查询永远返回 0 结果；(2) 标签管理无用，因为 UsersPage 没有标签筛选和分配功能；(3) 工作区查看按钮未绑定 onClick；(4) AI 服务商管理是遗留冗余功能。修复后需部署到服务器同步置顶 403 修复。

## What Changes

* **修复用户分群规则字段**：

  * 将 `SegmentRuleField` 从 `'lastActiveAt' | 'messageCount' | 'hasOwnApiKey'` 改为 `'lastActiveAt' | 'createdAt' | 'workspaceCount'`，只保留 visitors 集合实际存在的字段。

  * 更新 `buildSegmentFilter`：`lastActiveAt` 映射 `lastSeen`、`createdAt` 映射 `createdAt`、`workspaceCount` 使用 `$expr` + `$size` 查询 `workspaces` 数组长度。

  * 更新前端 `FIELD_LABELS` 映射和 `parseRuleValue` 逻辑。

  * **BREAKING**：已创建的旧分群规则（使用 `messageCount`/`hasOwnApiKey`）将无法执行，需重新创建。

* **标签管理实用化**：

  * UsersPage 新增"按标签筛选"下拉过滤器，调用 `userSegmentsApi.listTags` 加载标签，调用 `userSegmentsApi.getUsersByTag` 筛选用户。

  * UsersPage 用户详情弹窗新增"标签"tab，展示用户已有标签并支持添加/移除标签。

* **工作区查看按钮**：

  * WorkspacesPage 的查看按钮绑定 onClick，点击弹出详情弹窗，调用 `GET /api/admin/workspaces/:id` 展示工作区名称、描述、创建时间、成员数、节点数等统计。

* **移除 AI 服务商管理**：

  * SettingsPage 移除 `aiProviders` tab 及相关状态、函数、组件（`AIProviderEditModal`）。

  * 保留后端 `/ai-providers` 路由避免破坏 API 兼容性，但前端不再展示。

* **部署到服务器**：

  * 本地构建 admin/server、admin/client、server 产物。

  * 上传到服务器并备份旧产物，重启 PM2，健康检查。

## Impact

* Affected specs: `diagnose-workspace-view-ai-segment-issues`（诊断已完成，本 spec 承接修复）、`fix-workspace-pin-and-add-workspace-ban`（置顶修复已本地完成，本 spec 部署到服务器）

* Affected code:

  * `admin/server/src/services/userSegmentService.ts`（修复 buildSegmentFilter）

  * `admin/server/src/types/index.ts`（更新 SegmentRuleField）

  * `admin/client/src/types/index.ts`（更新 SegmentRuleField、FIELD\_LABELS）

  * `admin/client/src/pages/UserSegments/UserSegmentsPage.tsx`（更新字段标签和 parseRuleValue）

  * `admin/client/src/pages/Users/UsersPage.tsx`（新增标签筛选和标签分配）

  * `admin/client/src/pages/Workspaces/WorkspacesPage.tsx`（新增查看详情弹窗）

  * `admin/client/src/pages/Settings/SettingsPage.tsx`（移除 AI 服务商 tab）

  * `admin/client/src/services/api.ts`（workspacesApi 新增 getDetail 方法，如不存在）

## ADDED Requirements

### Requirement: 工作区详情弹窗

系统 SHALL 在工作区管理页面点击"查看"按钮时弹出详情弹窗，展示工作区完整信息。

#### Scenario: 查看工作区详情

* **WHEN** 管理员点击工作区列表中某行的"查看"按钮

* **THEN** 弹出详情弹窗，展示工作区名称、描述、类型、创建时间、更新时间、成员数、节点数

* **AND** 弹窗通过调用 `GET /api/admin/workspaces/:id` 获取数据

* **AND** 弹窗有加载态和关闭按钮

### Requirement: 用户管理页标签筛选

系统 SHALL 在用户管理页面提供"按标签筛选"下拉框，选择标签后仅显示拥有该标签的用户。

#### Scenario: 按标签筛选用户

* **WHEN** 管理员在用户管理页选择某个标签

* **THEN** 用户列表仅显示拥有该标签的用户

* **AND** 支持清除筛选恢复全部用户

### Requirement: 用户详情标签管理

系统 SHALL 在用户详情弹窗中提供标签管理功能，支持为用户添加或移除标签。

#### Scenario: 为用户添加标签

* **WHEN** 管理员在用户详情弹窗的"标签"区域点击"添加标签"

* **THEN** 展示可选标签列表，选择后调用 `POST /api/admin/user-segments/users/:userId/tags/:tagId`

* **AND** 成功后更新用户标签展示

#### Scenario: 为用户移除标签

* **WHEN** 管理员点击用户已有标签的"移除"按钮

* **THEN** 调用 `DELETE /api/admin/user-segments/users/:userId/tags/:tagId`

* **AND** 成功后更新用户标签展示

### Requirement: 分群规则字段修正

系统 SHALL 只支持 visitors 集合实际存在的字段作为分群规则字段。

#### Scenario: 按最后活跃时间筛选

* **WHEN** 分群规则为 `lastActiveAt` + `gte` + 日期值

* **THEN** 查询 `visitors.lastSeen >= 日期`，返回匹配用户数

#### Scenario: 按注册时间筛选

* **WHEN** 分群规则为 `createdAt` + `gte` + 日期值

* **THEN** 查询 `visitors.createdAt >= 日期`，返回匹配用户数

#### Scenario: 按工作区数量筛选

* **WHEN** 分群规则为 `workspaceCount` + `gte` + 数字值

* **THEN** 使用 `$expr: { $gte: [{ $size: '$workspaces' }, value] }` 查询，返回匹配用户数

## MODIFIED Requirements

### Requirement: 分群规则字段类型

`SegmentRuleField` 类型从 `'lastActiveAt' | 'messageCount' | 'hasOwnApiKey'` 修改为 `'lastActiveAt' | 'createdAt' | 'workspaceCount'`。

`buildSegmentFilter` 方法修改为：

* `lastActiveAt` -> 查询 `lastSeen` 字段

* `createdAt` -> 查询 `createdAt` 字段

* `workspaceCount` -> 使用 `$expr` + `$size: '$workspaces'` 查询

## REMOVED Requirements

### Requirement: AI 服务商管理界面

**Reason**: AI 服务商管理是遗留冗余功能，主服务端只读取 `ai_model_configs` 集合（AI 模型管理的数据），`admin_configs.aiProviders` 从未被使用。保留会导致用户混淆。
**Migration**: 后端路由保留以避免 API 兼容性问题，仅移除前端 UI。用户应使用"AI 模型管理"页面管理 AI 配置。

### Requirement: messageCount 和 hasOwnApiKey 分群字段

**Reason**: `visitors` 集合没有这两个字段，查询永远返回 0 结果。
**Migration**: 已创建的旧分群规则需重新创建，使用 `lastActiveAt`/`createdAt`/`workspaceCount` 字段。
