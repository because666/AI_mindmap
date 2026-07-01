# 修复核验审查发现问题 Spec

## Why
在完成"实现产品策略剩余功能"（implement-remaining-product-features）后，对 Task 3（后台管理能力升级）和 Task 4（地图优先模式）进行了代码深度审查。Task 3 审查发现 2 个严重问题和 7 个警告问题；Task 4 审查发现 2 个严重问题、6 个警告问题和 7 个改进建议。这些问题会导致数据筛选不一致、Dashboard 单点故障、静默失败违反编码规则、自动发送错位、误判逻辑、竞态条件、缺少校验等，必须修复以确保功能正确可靠。

## What Changes

### Task 3 后台管理能力升级修复
- 修复 `buildActivityTierFilter` 与 `calculateActivityTier` 的 `high_active` 筛选范围不一致问题（严重）
- 修复 DashboardPage `Promise.all` 单点失败问题，改用 `Promise.allSettled`（严重）
- 修复 30 分钟活跃曲线循环只覆盖 29 分钟问题
- 修复 5 处 catch 块静默失败问题，补充 `console.warn` 日志
- 修复 `lastSeen as string` 类型断言不安全问题
- 添加实时在线模块定时刷新机制（30 秒轮询）
- 统一 churn_risk/dormant 边界开闭区间
- 补齐 users.ts 的 tags 字段
- 修复 `getStats` 中 `onlineNow: 0` 硬编码问题

### Task 4 地图优先模式修复
- 修复 `handleMapFirstConfirm` 中 `branches[0]` 与 `firstChildId` 不匹配导致自动发送错位（严重）
- 修复 `isBroadQuestion` 短句兜底逻辑过于激进，违反"宁可少提示不要误提示"设计原则（严重）
- 修复大纲生成期间输入框未禁用，存在竞态条件
- 修复 `parseMapOutlineJson` 未强制 4-6 分支数量限制
- 修复 `nodeId` 切换时未清除 `mapFirstPrompt` 和 `isGeneratingMapOutline` 状态
- 修复 `/map-outline` 接口未传递 `workspaceId` 到用量记录
- 修复 `parseMapOutlineJson` 去除 Markdown 代码块的正则可能误删内容
- 补充 `mapOutline.test.ts` 缺失的边界场景测试
- 修复 `temperature` 硬编码为 0.7，改为 0.3 利于结构化 JSON 输出
- 修复 `autoQuestion` 硬编码中文冒号，纳入 i18n 配置
- 统一 `BROAD_KEYWORDS` 检查使用小写匹配
- 导出 `MapOutlineData` 和 `MapOutlineBranch` 接口
- 修复所有 `createChildNode` 调用失败时用户体验差问题
- 修复 `handleMapFirstDismiss` 和失败回退路径未检查 `isLoading`
- 为 `/map-outline` 单独创建限流策略，避免与聊天相互影响

## Impact
- Affected specs: implement-remaining-product-features
- Affected code:
  - **Task 3**:
    - `admin/server/src/utils/activityTier.ts` — 修复筛选范围不一致
    - `admin/server/src/services/dashboardService.ts` — 修复曲线循环、静默 catch、onlineNow 硬编码
    - `admin/server/src/routes/users.ts` — 补齐 tags 字段、修复类型断言
    - `admin/client/src/pages/Dashboard/DashboardPage.tsx` — Promise.allSettled、定时刷新
    - `admin/client/src/pages/Users/UsersPage.tsx` — ACTIVITY_TIER_CONFIG 防御性 fallback
  - **Task 4**:
    - `client/src/components/Chat/ChatPanel.tsx` — 修复竞态条件、分支错位、状态清除、失败回退
    - `client/src/utils/broadQuestion.ts` — 修复短句误判、统一小写匹配
    - `server/src/routes/ai.ts` — 修复分支数量校验、Markdown 正则、workspaceId、temperature、接口导出
    - `server/src/test/mapOutline.test.ts` — 补充边界场景测试
    - `client/src/locales/chat/zh.json`、`en.json` — 新增 autoQuestion 分隔符 i18n 键
    - `server/src/middleware/aiRateLimit.ts` — 新增 /map-outline 独立限流策略

## ADDED Requirements
### Requirement: 活跃度筛选一致性
系统 SHALL 保证 `buildActivityTierFilter` 的筛选范围与 `calculateActivityTier` 的分层判定逻辑完全一致，即某分层下显示的用户，在使用该分层筛选时也能被查询到。

#### Scenario: high_active 筛选覆盖 1-7 天
- **WHEN** 用户 lastSeen 在 1-7 天前
- **THEN** `calculateActivityTier` 返回 `high_active`
- **AND** 使用 `high_active` 筛选时该用户出现在结果中

### Requirement: Dashboard 容错加载
系统 SHALL 使用 `Promise.allSettled` 加载 Dashboard 各模块数据，单个接口失败不影响其他模块展示。

#### Scenario: 单个接口失败
- **WHEN** DashboardPage 加载时某个 API 返回 500
- **THEN** 该模块显示错误提示
- **AND** 其他模块正常展示数据

### Requirement: 实时在线定时刷新
系统 SHALL 每 30 秒自动刷新实时在线数据，无需用户手动操作。

#### Scenario: 自动刷新
- **WHEN** 用户停留在 Dashboard 页面
- **THEN** 实时在线模块每 30 秒自动更新数据
- **AND** 页面离开时停止轮询

### Requirement: 地图大纲自动发送一致性
系统 SHALL 保证自动发送的问题主题与实际选中的子节点对应。

#### Scenario: 首个分支创建失败
- **WHEN** 第一个 `createChildNode` 调用失败
- **AND** 第二个分支创建成功
- **THEN** 自动发送的问题主题使用第二个分支的标题
- **AND** 选中的子节点也是第二个分支

### Requirement: 宽泛问题检测准确性
系统 SHALL 仅对真正的宽泛问题触发"展开成地图"提示，禁止对纯数字、纯标点、无意义字符等误判。

#### Scenario: 纯数字输入
- **WHEN** 用户在根节点空画布输入 "12345"
- **THEN** 不弹出"是否先展开成地图"提示
- **AND** 直接进入对话

### Requirement: 大纲生成期间输入禁用
系统 SHALL 在地图大纲生成期间禁用输入框和发送按钮，防止竞态条件。

#### Scenario: 生成期间尝试发送
- **WHEN** `isGeneratingMapOutline` 为 true
- **THEN** textarea 和发送按钮处于 disabled 状态
- **AND** 按 Enter 键不触发发送

### Requirement: 大纲分支数量校验
系统 SHALL 校验 AI 返回的大纲分支数量在 4-6 个之间，超出上限截取，不足下限拒绝。

#### Scenario: AI 返回过多分支
- **WHEN** AI 返回 10 个分支
- **THEN** 截取前 6 个分支
- **AND** 正常创建 6 个子节点

#### Scenario: AI 返回过少分支
- **WHEN** AI 返回 2 个分支
- **THEN** 解析失败，回退到直接发送原问题

### Requirement: 节点切换清除地图优先状态
系统 SHALL 在 `nodeId` 变化时清除 `mapFirstPrompt` 和 `isGeneratingMapOutline` 状态。

#### Scenario: 提示显示后切换节点
- **WHEN** 根节点显示地图优先提示
- **AND** 用户点击其他子节点
- **THEN** 提示气泡消失
- **AND** `isGeneratingMapOutline` 重置为 false

### Requirement: 所有分支创建失败时的用户体验
系统 SHALL 在所有 `createChildNode` 调用失败时提示错误并回退到直接发送原问题。

#### Scenario: 全部创建失败
- **WHEN** 所有 `createChildNode` 调用均失败
- **THEN** Toast 提示"创建分支节点失败"
- **AND** 回退到 `sendMessage(question)` 直接发送原问题

## MODIFIED Requirements
### Requirement: 错误处理
所有异步操作的 catch 块 MUST 记录错误日志（`console.warn` 或 `console.error`），禁止静默失败（符合编码规则 2.4）。

### Requirement: 类型安全
禁止使用 `as string` 等不安全类型断言处理可能为 null/undefined 的字段，MUST 使用显式空值检查或可选链。

### Requirement: Markdown 代码块清理
`parseMapOutlineJson` 去除 Markdown 代码块 SHALL 仅清理首尾标记，禁止全局替换避免误删 JSON 值中的合法内容。

### Requirement: workspaceId 用量记录
`/map-outline` 接口 SHALL 从请求头 `X-Workspace-Id` 读取 workspaceId 并记录到用量，与 `/chat/stream` 保持一致。

### Requirement: 结构化输出温度
`/map-outline` 接口 SHALL 使用较低的 temperature（0.3）以确保 JSON 输出格式稳定。

### Requirement: 国际化分隔符
自动发送问题的分隔符 SHALL 通过 i18n 配置，避免中英文混排格式问题。

## REMOVED Requirements
（无）
