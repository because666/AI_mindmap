# 修复流式输出与自动标题生成 Spec

## Why

AI回复内容一次性完整显示而非逐字流式渲染，用户体验差；对话标题在首次消息发送后不会自动生成，始终显示用户消息的前15字截取文本。这两个问题直接影响核心交互体验。

## What Changes

- 修复客户端流式回调使用 `content` 增量追加而非 `fullContent` 整体替换，实现逐字流式渲染
- 修复标题自动生成触发条件：将自动截取的15字临时标题也视为"待AI生成"状态
- 检查并修复 Nginx SSE 代理缓冲配置

## Impact

- Affected specs: fix-title-conclusion-generation（补充自动触发逻辑）
- Affected code:
  - client/src/components/Chat/ChatPanel.tsx — 流式回调和标题自动生成触发
  - client/src/services/chatService.ts — SSE 解析逻辑
  - server/src/routes/ai.ts — AI 路由 SSE 输出（如需调整）

---

## ADDED Requirements

### Requirement: AI回复逐字流式渲染

系统 SHALL 将AI回复内容以逐字/逐词方式实时渲染到聊天面板，而非一次性完整显示。

#### Scenario: 流式内容增量追加
- **WHEN** 客户端收到SSE `content` 类型事件
- **THEN** 将 `event.content`（当前片段）追加到已有流式内容末尾
- **AND** UI立即更新显示新增内容，呈现打字机效果

#### Scenario: 流式思考内容增量追加
- **WHEN** 客户端收到SSE `thinking` 类型事件
- **THEN** 将思考内容增量追加到已有思考内容末尾
- **AND** UI立即更新显示

#### Scenario: React批量更新不阻断流式渲染
- **WHEN** 多个SSE事件在短时间内到达
- **THEN** 使用 `flushSync` 或等效机制确保每次内容更新都立即渲染到DOM
- **AND** 用户视觉上看到逐字出现而非批量跳跃

---

### Requirement: 对话标题自动生成

系统 SHALL 在首次有效AI回复完成后自动触发标题生成，将临时截取标题替换为AI精炼标题。

#### Scenario: 首次AI回复后自动生成标题
- **WHEN** 节点首次收到AI回复（userMsgCount=1, assistantMsgCount=1）
- **AND** 节点标题是自动截取的临时标题（包含"..."或等于用户消息前15字）
- **THEN** 5秒后自动调用AI标题生成接口
- **AND** 生成成功后替换临时标题

#### Scenario: 临时标题视为"待生成"状态
- **WHEN** 判断是否需要AI生成标题时
- **THEN** 自动截取的临时标题（包含"..."的标题）也视为"待生成"状态
- **AND** 不阻止AI标题生成的触发

#### Scenario: AI标题生成失败时保留临时标题
- **WHEN** AI标题生成失败
- **THEN** 保留当前的临时截取标题
- **AND** 不影响用户继续对话

---

## MODIFIED Requirements

### Requirement: 流式回调处理

流式回调 SHALL 使用增量追加模式更新UI内容，而非整体替换。

- 原实现：`setStreamingContent(event.fullContent)` — 整体替换，React批量更新导致视觉跳跃
- 修改后：`setStreamingContent(prev => prev + event.content)` — 增量追加，实现逐字渲染

### Requirement: 标题自动生成触发条件

标题自动生成触发条件 SHALL 包含自动截取的临时标题。

- 原实现：仅当标题为 '新对话'、'新分支'、空、或包含'...'时触发
- 修改后：增加条件——当标题等于用户首条消息内容（或其前15字截取）时也触发
