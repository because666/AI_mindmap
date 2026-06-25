# AI 回复语言适配 Spec

## Why
用户切换到英文后，UI 界面变为英文，但 AI 回复仍然是中文（因为默认 system prompt 硬编码了"使用中文回答"），体验不一致。需要让 AI 根据用户选择的语言来决定使用中文还是英文回复。

## What Changes
- 客户端发送消息时，在请求体中携带当前语言偏好（`language` 字段）
- 服务端 `ai.ts` 的 `/api/ai/chat/stream` 端点读取语言偏好，动态追加语言指令到 system prompt
- 服务端 `conversations.ts` 的 `buildContextMessages` 函数同步支持语言指令
- 标题生成和结论提炼的 prompt 也根据语言偏好调整输出语言
- 修改默认 system prompt 中的硬编码中文语言指令为条件化指令

## Impact
- Affected code:
  - `client/src/services/chatService.ts` — 请求体新增 `language` 字段
  - `client/src/components/Chat/ChatPanel.tsx` — 传递当前语言到 chatService
  - `server/src/routes/ai.ts` — 读取语言偏好，动态追加语言指令
  - `server/src/routes/conversations.ts` — buildContextMessages 支持语言指令
  - `server/src/config/prompts.ts` — 移除硬编码"使用中文回答"，改为条件化

## ADDED Requirements

### Requirement: AI 回复语言跟随用户界面语言
系统 SHALL 根据用户当前选择的语言（中文/英文），在 AI 对话的 system prompt 中注入对应的语言指令，使 AI 使用与界面一致的语言回复。

#### Scenario: 用户使用中文界面
- **WHEN** 用户界面语言为中文
- **AND** 用户向 AI 发送消息
- **THEN** system prompt 中包含"使用中文回答"指令
- **AND** AI 使用中文回复

#### Scenario: 用户使用英文界面
- **WHEN** 用户界面语言为英文
- **AND** 用户向 AI 发送消息
- **THEN** system prompt 中包含"Please respond in English"指令
- **AND** AI 使用英文回复

#### Scenario: 未指定语言
- **WHEN** 请求中未携带语言偏好
- **THEN** 默认使用中文回复（向后兼容）

### Requirement: 客户端传递语言偏好
客户端在发送 AI 对话请求时，SHALL 在请求体中携带 `language` 字段，值为当前 i18n 语言代码（`'zh'` 或 `'en'`）。

#### Scenario: 发送消息时携带语言
- **WHEN** 用户发送消息
- **THEN** 请求体包含 `language` 字段，值为 `i18n.language` 的前两位（zh/en）

### Requirement: 标题生成和结论提炼语言适配
标题生成和结论提炼功能 SHALL 根据用户语言偏好，使用对应语言生成标题和结论。

#### Scenario: 英文界面下生成标题
- **WHEN** 用户界面语言为英文
- **AND** 触发标题生成
- **THEN** 生成的标题为英文

#### Scenario: 英文界面下提炼结论
- **WHEN** 用户界面语言为英文
- **AND** 触发结论提炼
- **THEN** 提炼的结论为英文

## MODIFIED Requirements

### Requirement: 默认 system prompt 语言指令
原状态：`DEFAULT_SYSTEM_PROMPT` 中硬编码"使用中文回答，专业术语保留英文原文并附中文解释"
新需求：移除此硬编码指令，改为由服务端根据请求中的语言偏好动态追加语言指令

### Requirement: 服务端 system prompt 注入
原状态：`ai.ts` 固定使用 `DEFAULT_SYSTEM_PROMPT`
新需求：`ai.ts` 在 `DEFAULT_SYSTEM_PROMPT` 基础上，根据请求中的 `language` 字段追加语言指令
