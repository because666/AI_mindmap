# 添加回答内可点击延伸方向按钮

## Why

当前 AI 回答末尾会按 system prompt 要求输出 `🌱 延伸方向：` 及 2-4 个方向列表，但这些方向以纯 Markdown 文本展示，用户不会主动点击或据此创建分支。核心痛点 P0-A 指出“用户根本不会主动创建分支”，因此需要把文本方向变成可点击按钮，让分支成为对话的自然下一步。

本功能不额外调用模型，完全复用现有 AI 输出格式，仅在前端解析并渲染按钮，是 ROI 最高的 P0 功能。

## What Changes

- 新增 `client/src/utils/extensionDirections.ts`：解析 AI 回答中的 `🌱 延伸方向：` 块，提取方向列表。
- 修改 `client/src/components/Chat/ChatPanel.tsx`：在每条已完成的 assistant 消息下方渲染延伸方向按钮。
- 新增 `ExtensionDirectionButtons` 组件（可内联在 ChatPanel 或单独文件）：展示按钮并处理点击。
- 更新 `client/src/locales/chat/zh.json` 与 `en.json`：添加按钮相关文案与自动生成的问题模板。
- 在消息渲染时隐藏原始的 `🌱 延伸方向：` 文本块，避免按钮与文本重复。

## Impact

- 受影响的产品策略：`.trae/specs/nonlinear-conversation-experience/product-strategy.md` 中的“P0：回答内可点击的延伸方向”。
- 受影响的代码：
  - `client/src/components/Chat/ChatPanel.tsx`
  - `client/src/locales/chat/zh.json`
  - `client/src/locales/chat/en.json`
  - 新增 `client/src/utils/extensionDirections.ts`
  - 新增对应单测文件

## ADDED Requirements

### Requirement: 解析延伸方向

The system SHALL parse assistant message content and extract extension directions when present.

#### Scenario: 标准中文格式
- **GIVEN** assistant 消息末尾包含：
  ```text
  🌱 延伸方向：
  - 泰勒展开的推导
  - 泰勒展开 vs 麦克劳林展开
  - 常见错误与边界条件
  ```
- **WHEN** 渲染该消息
- **THEN** 提取到 `["泰勒展开的推导", "泰勒展开 vs 麦克劳林展开", "常见错误与边界条件"]`

#### Scenario: 标准英文格式
- **GIVEN** assistant 消息末尾包含：
  ```text
  🌱 Extension Directions:
  - Derivation of Taylor expansion
  - Taylor vs Maclaurin expansion
  - Common mistakes and boundary conditions
  ```
- **WHEN** 渲染该消息
- **THEN** 提取到对应三个英文方向

#### Scenario: 无延伸方向
- **GIVEN** assistant 消息不包含 `🌱 延伸方向：` 或 `🌱 Extension Directions:`
- **WHEN** 渲染该消息
- **THEN** 返回空数组，不渲染按钮

#### Scenario: 格式不完整或为空
- **GIVEN** assistant 消息包含 `🌱 延伸方向：` 但后续无有效列表项
- **WHEN** 渲染该消息
- **THEN** 返回空数组，不渲染按钮

### Requirement: 渲染延伸方向按钮

The system SHALL render extracted extension directions as clickable buttons below the assistant message.

#### Scenario: 桌面端
- **WHEN** 消息有 2-4 个方向
- **THEN** 在消息气泡下方显示按钮组，水平排列，超出自动换行

#### Scenario: 移动端
- **WHEN** 在移动端查看
- **THEN** 按钮垂直堆叠，宽度适配屏幕

#### Scenario: 流式消息不显示
- **WHEN** 消息仍在流式生成中
- **THEN** 不显示延伸方向按钮，待流式结束后再显示

### Requirement: 点击按钮自动深入分支

The system SHALL create a child node, switch to it, and auto-send a follow-up question when user clicks an extension direction button.

#### Scenario: 成功创建分支并发送问题
- **GIVEN** 用户当前在节点 A，点击方向“泰勒展开的推导”
- **WHEN** 按钮点击处理完成
- **THEN**：
  1. 在节点 A 下创建子节点 B，标题为“泰勒展开的推导”
  2. 自动选中节点 B 并打开其对话面板
  3. 向节点 B 发送问题：“请详细解释泰勒展开的推导过程。”（中文）或对应英文
  4. AI 在节点 B 中开始回答

#### Scenario: 当前无选中节点
- **GIVEN** 用户未选中任何节点
- **WHEN** 不应出现延伸方向按钮（无对话消息）
- **THEN** 无需处理

### Requirement: 隐藏原始延伸方向文本

The system SHALL remove the raw `🌱 延伸方向：` block from the displayed message content while preserving it in stored message data.

#### Scenario: 正常消息
- **GIVEN** assistant 消息包含回答正文 + 延伸方向块
- **WHEN** 渲染时
- **THEN** 只显示回答正文，正文下方显示按钮

## MODIFIED Requirements

无修改现有功能需求。

## REMOVED Requirements

无移除需求。
