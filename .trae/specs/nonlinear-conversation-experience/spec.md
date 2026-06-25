# 非线性对话核心闭环 Spec

> 对应产品策略：`product-strategy.md` v1.2-final 第一阶段 A
> 范围：核心体验闭环（埋点 + 延伸方向 + 节点摘要 + 导航树优化）

---

## Why

当前 DeepMindMap 已具备非线性对话的"容器"（节点级独立上下文、手动创建分支），但缺少非线性的"默认行为"：

- 用户不会主动创建分支，仍把产品当普通聊天工具用。
- 支线聊完后价值无法沉淀，地图信息密度低。
- 用户在支线中容易迷失，不知道如何回到主线。
- 缺少行为数据，无法判断功能效果。

本 spec 实现核心闭环，让分支成为对话的自然下一步，让支线价值自动沉淀，让用户始终知道自己在哪。

---

## What Changes

- **新增"延伸方向按钮"**：AI 回答后解析 `🌱 延伸方向：` 格式，渲染 2-4 个可点击按钮，点击自动创建子节点并发送问题。
- **新增"节点自动摘要"**：节点增加 `summary` 字段，支线结束时触发摘要生成（调用一次 AI），展示在画布、导航树、聊天面板。
- **优化"节点导航树"**：高亮当前路径、增加"回到上一级"按钮、自动展开并滚动到当前节点。
- **新增"用户行为埋点"**：前端事件采集 → 主服务 `/api/events` 接收 → admin Dashboard 展示。

---

## Impact

- Affected specs: `nonlinear-conversation-experience/product-strategy.md`
- Affected code:
  - `client/src/components/Chat/ChatPanel.tsx` — 延伸方向解析与渲染、摘要展示
  - `client/src/components/Chat/MindMapThumbnail.tsx` — 导航树优化
  - `client/src/stores/appStore.ts` — `createChildNode` 复用、节点摘要状态
  - `client/src/stores/chatStore.ts` — 支线结束检测
  - `client/src/services/` — 新增埋点上报服务
  - `client/src/utils/` — 新增延伸方向解析工具
  - `server/src/config/prompts.ts` — 延伸方向格式稳定化
  - `server/src/routes/ai.ts` — 摘要生成接口
  - `server/src/routes/events.ts` — 新增，埋点接收
  - `server/src/services/nodeService.ts` — `summary` 字段持久化
  - `admin/client/src/pages/Dashboard/DashboardPage.tsx` — 事件展示

---

## ADDED Requirements

### Requirement: 延伸方向按钮

系统 SHALL 在 AI 回答末尾解析 `🌱 延伸方向：` 格式，渲染 2-4 个可点击按钮。用户点击后 SHALL 自动创建子节点、切换到子节点、发送对应问题。

#### Scenario: AI 回答包含延伸方向

- **WHEN** AI 回答末尾包含 `🌱 延伸方向：① xxx ② yyy ③ zzz`
- **THEN** 消息底部显示 3 个可点击按钮
- **AND** 按钮文案为对应的延伸方向文本
- **AND** 原始 `🌱 延伸方向：` 文本从回答正文中移除

#### Scenario: 用户点击延伸方向

- **WHEN** 用户点击某个延伸方向按钮
- **THEN** 自动创建子节点，节点标题为该延伸方向文本
- **AND** 自动切换到该子节点
- **AND** 自动发送问题"请详细讲解：{延伸方向文本}"
- **AND** 上报埋点事件 `extension_direction_click`

#### Scenario: AI 回答不包含延伸方向

- **WHEN** AI 回答末尾没有延伸方向格式
- **THEN** 不显示按钮，不影响正常对话

---

### Requirement: 节点自动摘要

系统 SHALL 为每个节点支持 `summary` 字段。当支线对话结束时，SHALL 触发摘要生成（调用一次 AI），并将摘要存入节点。

#### Scenario: 手动触发摘要

- **WHEN** 用户点击"生成摘要"按钮
- **THEN** 调用 AI 提炼当前节点对话核心结论
- **AND** 将摘要存入节点 `summary` 字段并持久化
- **AND** 在画布节点卡片、导航树、聊天面板展示摘要
- **AND** 上报埋点事件 `summary_generated`

#### Scenario: 返回主线时触发

- **WHEN** 用户在子节点点击"回到上一级"
- **AND** 该子节点有新增对话且尚未生成摘要
- **THEN** 提示"是否为该分支生成摘要？"
- **AND** 用户确认后生成摘要

#### Scenario: 自动触发提示

- **WHEN** 子节点对话达到 4-6 轮且 3 分钟内无新消息
- **THEN** 轻提示"是否为该分支生成摘要？"
- **AND** 用户确认后生成摘要
- **AND** 用户可忽略提示继续对话

#### Scenario: 摘要展示

- **WHEN** 节点已生成摘要
- **THEN** 画布节点卡片标题下方显示摘要预览（可折叠）
- **AND** 导航树节点悬停显示摘要
- **AND** 聊天面板节点信息区显示完整摘要

---

### Requirement: 节点导航树优化

系统 SHALL 在现有 `MindMapThumbnail` 导航树中高亮当前节点到根节点的路径，SHALL 提供"回到上一级"按钮，SHALL 自动展开并滚动到当前节点。

#### Scenario: 进入子节点

- **WHEN** 用户进入一个子节点
- **THEN** 导航树自动展开到该节点
- **AND** 高亮从根节点到当前节点的路径
- **AND** 导航树滚动到当前节点可见位置
- **AND** 如果当前节点有父节点，显示"← 回到 {父节点标题}"按钮

#### Scenario: 点击回到上一级

- **WHEN** 用户点击"回到上一级"按钮
- **THEN** 选中父节点
- **AND** 聊天面板切换到父节点对话
- **AND** 画布聚焦到父节点
- **AND** 如果父节点有未摘要的子节点新增对话，提示是否生成摘要

#### Scenario: 根节点

- **WHEN** 当前节点是根节点（无父节点）
- **THEN** 不显示"回到上一级"按钮

#### Scenario: 移动端

- **WHEN** 在移动端访问
- **THEN** 导航树默认展开显示

---

### Requirement: 用户行为埋点

系统 SHALL 在前端采集用户行为事件，SHALL 通过 `/api/events` 上报到主服务，SHALL 在 admin Dashboard 展示事件统计。

#### Scenario: 事件采集与上报

- **WHEN** 用户触发已埋点的行为
- **THEN** 前端通过 `tracker.track(eventType, payload)` 采集事件
- **AND** 通过 `POST /api/events` 批量上报到主服务
- **AND** 主服务将事件写入 admin MongoDB `events` 集合
- **AND** 上报失败时静默重试，不阻塞用户操作

#### Scenario: admin Dashboard 展示

- **WHEN** 管理员访问 admin Dashboard
- **THEN** 展示事件总量卡片
- **AND** 展示最近 7 天事件趋势图
- **AND** 展示关键漏斗（注册 → 完成引导 → 创建地图 → 创建分支 → 生成摘要）

#### Scenario: 关键事件覆盖

- **WHEN** 用户使用产品
- **THEN** 以下事件被采集：
  - `page_view`：页面访问
  - `node_created`：节点创建
  - `branch_created`：分支创建
  - `extension_direction_click`：延伸方向点击
  - `summary_generated`：摘要生成
  - `map_created`：地图创建

---

## MODIFIED Requirements

### Requirement: AI 对话回答渲染

现有 `ChatPanel` 渲染 AI 回答时，SHALL 额外解析延伸方向格式并渲染为可点击按钮，SHALL 从回答正文中移除延伸方向原始文本。

### Requirement: 节点数据模型

现有 `Node` 模型 SHALL 新增 `summary?: string` 字段，用于存储节点摘要。该字段为可选字段，未生成摘要时为 `undefined`。

### Requirement: AI System Prompt

现有 `server/src/config/prompts.ts` 中的 system prompt SHALL 稳定化延伸方向输出格式，确保 AI 在每次回答末尾输出 `🌱 延伸方向：① xxx ② yyy ③ zzz` 格式。

---

## REMOVED Requirements

无。本 spec 不移除任何现有功能。
