# 修复提炼结论和标题生成功能 Spec

## Why

提炼结论和标题生成功能一直返回空内容。经服务器端API直接测试确认根因：**智谱GLM-4-Flash模型在消息数组最后一条是assistant消息时，不会继续生成内容**（返回finishReason:"stop"但content为空）。当前代码将对话历史（system + user + assistant消息）直接传给AI，最后一条是assistant消息，导致模型认为对话已完成而不生成新内容。

## What Changes

- 在 extract-conclusion 路由中，消息数组末尾追加一条 user 消息，明确提示模型执行结论提炼任务
- 在 generate-title 路由中，消息数组末尾追加一条 user 消息，明确提示模型执行标题生成任务
- 清理之前添加的调试日志（保留关键日志）

## Impact

- Affected code:
  - server/src/routes/conversations.ts — extract-conclusion 和 generate-title 路由的消息构建逻辑

---

## ADDED Requirements

### Requirement: 结论提炼消息末尾必须以user消息结尾

系统 SHALL 在构建结论提炼的AI请求消息时，确保消息数组最后一条是user消息，而非assistant消息。

#### Scenario: 对话历史最后一条是assistant消息
- **WHEN** 对话历史的最后一条消息是assistant角色
- **AND** 系统构建结论提炼请求消息
- **THEN** 系统在对话历史后追加一条 `{ role: 'user', content: '请根据以上对话内容提炼核心结论' }` 消息
- **AND** AI模型正常返回结论内容

#### Scenario: 对话历史最后一条是user消息
- **WHEN** 对话历史的最后一条消息是user角色
- **THEN** 系统直接使用对话历史构建请求，无需追加额外消息

### Requirement: 标题生成消息末尾必须以user消息结尾

系统 SHALL 在构建标题生成的AI请求消息时，确保消息数组最后一条是user消息。

#### Scenario: 对话历史最后一条是assistant消息
- **WHEN** 对话历史的最后一条消息是assistant角色
- **THEN** 系统在对话历史后追加一条 `{ role: 'user', content: '请根据以上对话内容生成标题' }` 消息

---

## MODIFIED Requirements

### Requirement: extract-conclusion 路由消息构建逻辑

extract-conclusion 路由 SHALL 在构建AI请求消息时，检查对话历史最后一条消息的角色，如果是assistant则追加user消息。

- 原实现：`[systemMessage, ...chatMessages]`，最后一条可能是assistant消息
- 修改后：`[systemMessage, ...chatMessages, trailingUserMessage?]`，确保最后一条是user消息

### Requirement: generate-title 路由消息构建逻辑

generate-title 路由 SHALL 在构建AI请求消息时，检查对话历史最后一条消息的角色，如果是assistant则追加user消息。

- 原实现：`[systemMessage, ...chatMessages]`，最后一条可能是assistant消息
- 修改后：`[systemMessage, ...chatMessages, trailingUserMessage?]`，确保最后一条是user消息

## REMOVED Requirements

### Requirement: 提炼结论支持 reasoning_content 回退
**Reason**: 根因已确认为消息格式问题（最后一条是assistant消息），而非reasoning_content回退问题。reasoning_content回退逻辑仍保留作为防御性编程，但不是核心修复。
**Migration**: 无需迁移，回退逻辑继续保留。
