# 修复流式输出延迟与对话面板位置 Spec

## Why

流式输出虽然已生效，但呈现"卡顿式"逐段出现而非平滑的打字机效果，延迟感明显；对话面板消息布局偏右，用户消息和AI消息的对齐方式不正确。这两个问题直接影响核心交互体验。

## What Changes

- 移除 `flushSync`，改用 `requestAnimationFrame` 节流渲染，每帧最多更新一次流式内容
- 实现字符级打字机动画：将SSE收到的内容片段缓冲后，以固定间隔逐字符追加到显示内容
- 优化 `StreamingMessage` 组件：流式阶段使用纯文本渲染，流式结束后切换为 Markdown 渲染
- 修复消息 flex 布局：AI 消息添加 `justify-start`，用户消息添加 `justify-end`
- 统一流式消息与历史消息的布局结构
- 确保消息容器占满可用宽度

## Impact

- Affected specs: fix-streaming-and-auto-title（流式回调处理方式变更）
- Affected code:
  - client/src/components/Chat/ChatPanel.tsx — 流式回调、消息布局、StreamingMessage
  - client/src/components/Chat/MarkdownRenderer.tsx — 可能需要调整 memo 策略

---

## ADDED Requirements

### Requirement: 流式输出打字机效果

系统 SHALL 将AI回复内容以逐字符打字机方式实时渲染到聊天面板，呈现平滑的视觉输出效果。

#### Scenario: SSE内容片段缓冲与逐字符输出
- **WHEN** 客户端收到SSE `content` 类型事件
- **THEN** 将 `event.content` 追加到内部缓冲区
- **AND** 以 `requestAnimationFrame` 节流，每帧从缓冲区取出未显示的字符追加到显示内容
- **AND** 视觉上呈现逐字符打字机效果

#### Scenario: 多个SSE事件短时间内到达
- **WHEN** 多个SSE事件在一帧（~16ms）内到达
- **THEN** 仅在下一帧渲染时批量追加到显示内容
- **AND** 不触发多次DOM更新，避免主线程阻塞

#### Scenario: 流式结束后完整Markdown渲染
- **WHEN** 流式输出完成（收到 `done` 事件或流结束）
- **THEN** 将流式内容切换为完整的 Markdown 渲染模式
- **AND** 显示完整的格式化内容（代码高亮、表格、列表等）

#### Scenario: 流式阶段纯文本快速渲染
- **WHEN** 流式内容正在生成中
- **THEN** 使用纯文本渲染（不经过 Markdown 解析），减少渲染开销
- **AND** 保留闪烁光标动画指示正在生成

### Requirement: 对话面板消息正确对齐

系统 SHALL 确保聊天面板中用户消息右对齐、AI消息左对齐，消息容器占满可用宽度。

#### Scenario: AI消息左对齐
- **WHEN** 渲染AI消息（role=assistant）
- **THEN** 消息行使用 `flex justify-start` 布局
- **AND** 头像在左侧，消息气泡在右侧

#### Scenario: 用户消息右对齐
- **WHEN** 渲染用户消息（role=user）
- **THEN** 消息行使用 `flex justify-end` 布局
- **AND** 头像在右侧，消息气泡在左侧

#### Scenario: 流式消息与历史消息布局一致
- **WHEN** 渲染流式生成中的AI消息
- **THEN** 使用与历史AI消息相同的布局结构（`flex justify-start`）
- **AND** 头像位置、气泡样式与历史消息一致

#### Scenario: 消息容器占满宽度
- **WHEN** 消息列表渲染时
- **THEN** 每条消息的行容器占满父容器宽度
- **AND** 消息气泡最大宽度为85%，短内容自然收缩

---

## MODIFIED Requirements

### Requirement: 流式回调处理

流式回调 SHALL 使用缓冲+节流模式更新UI内容，而非 `flushSync` 强制同步渲染。

- 原实现：`flushSync(() => setStreamingContent(prev => prev + event.content))` — 每次SSE事件强制同步渲染
- 修改后：SSE事件追加到缓冲区，`requestAnimationFrame` 节流每帧从缓冲区取出内容追加到显示状态

### Requirement: StreamingMessage 渲染策略

StreamingMessage 组件 SHALL 在流式阶段使用轻量渲染，流式结束后切换为完整 Markdown 渲染。

- 原实现：始终使用 `MarkdownRenderer` 渲染流式内容
- 修改后：流式阶段使用纯文本渲染，流式结束后切换为 `MarkdownRenderer`
