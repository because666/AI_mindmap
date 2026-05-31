# 上下文窗口管理修复与增强

## Why

当前上下文截断逻辑仅实现在 `conversations/:nodeId/message` 路由中，但客户端实际使用的是 `/api/ai/chat/stream` 流式路径，该路径**完全没有截断保护**。同时 Token 估算对中文偏低（0.7 系数 vs 实际约 1.5 token/字），模型映射不完整，深度限制不一致。项目的核心价值是 AI 思维导图式的上下文继承，截断策略必须精心设计，既要防止超出模型窗口导致 API 失败，又要最大限度保留祖先链上下文以保证用户体验。

## What Changes

* **修复**：在流式聊天路径 `/api/ai/chat/stream` 中添加上下文截断逻辑

* **修复**：Token 估算系数从 0.7 调整为 1.2（中文偏高估算，确保安全边界）

* **修复**：补全 MODEL\_CONTEXT\_WINDOWS 映射，覆盖所有可用模型

* **修复**：统一客户端和服务端的深度限制

* **增强**：截断策略从"保留最近6条"改为"按节点粒度保留"，确保完整对话不被截断到半截

* **增强**：截断时对被省略的节点生成摘要替代，而非直接丢弃

## Impact

* Affected code: server/src/routes/ai.ts、server/src/routes/conversations.ts、client/src/stores/appStore.ts、client/src/components/Chat/ChatPanel.tsx

***

## ADDED Requirements

### Requirement: 流式路径上下文截断

系统 SHALL 在 `/api/ai/chat/stream` 流式聊天路径中添加上下文截断逻辑，防止超出模型上下文窗口导致 API 调用失败。

#### Scenario: 流式聊天上下文过长

* **WHEN** 客户端发送的上下文消息总 Token 数超过模型窗口的 85%

* **THEN** 服务端在传递给 AI 前执行截断，保留系统提示词 + 最近完整节点对话 + 尽可能多的中间节点对话

#### Scenario: 截断后继续对话

* **WHEN** 上下文被截断

* **THEN** 在被截断的位置插入系统消息"（部分早期节点对话已省略）"，AI 仍能正常回复

***

### Requirement: 按节点粒度截断

系统 SHALL 按节点粒度执行截断，确保每个保留的节点的对话是完整的，不会出现对话被截断到半截的情况。

#### Scenario: 节点对话完整性

* **WHEN** 截断执行时

* **THEN** 被保留的节点的所有对话消息（user + assistant）作为一个整体保留或整体移除，不会出现只保留半个节点对话的情况

#### Scenario: 祖先链优先保留

* **WHEN** 当前节点的直接父节点链对话较长

* **THEN** 优先保留直接父节点链（parentIds 路径上的节点），其次保留关系节点

***

### Requirement: 被省略节点摘要替代

系统 SHALL 在截断时为被省略的节点生成简短摘要，替代完整对话保留在上下文中。

#### Scenario: 摘要替代

* **WHEN** 某个祖先节点的对话因截断被省略

* **THEN** 在上下文中插入该节点的摘要信息：`[省略的节点: {title} - {summary前50字}]`

#### Scenario: 无摘要节点

* **WHEN** 被省略的节点没有 summary 字段

* **THEN** 仅显示 `[省略的节点: {title}]`

***

### Requirement: Token 估算精度提升

系统 SHALL 将 Token 估算系数从 0.7 调整为 1.2，对中文偏高估算以确保安全边界。

#### Scenario: 中文文本估算

* **WHEN** 估算一段中文文本的 Token 数

* **THEN** 使用 `Math.ceil(text.length * 1.2)` 估算，确保不超过实际 Token 数

***

### Requirement: 模型映射补全

系统 SHALL 补全 MODEL\_CONTEXT\_WINDOWS 映射，覆盖所有可用模型。

新增映射：

* `glm-4-long`: 128000

* `gpt-4-turbo`: 128000

* `gpt-4`: 8192

* `o1-preview`: 128000

* `o1-mini`: 128000

* `claude-3-opus`: 200000

* `claude-3-haiku`: 200000

* `deepseek-coder`: 16384

* `qwen-plus`: 32768

* `qwen-turbo`: 8192

* `qwen-max`: 8192

***

## MODIFIED Requirements

### Requirement: 深度限制统一

客户端和服务端的上下文递归深度限制 SHALL 统一为 15。

* 原实现：客户端 MAX\_CONTEXT\_DEPTH=20，服务端 depth>10

* 修改后：统一为 15，平衡上下文完整性和性能

### Requirement: 截断阈值调整

截断触发阈值 SHALL 从 80% 调整为 85%，为 AI 回复预留更多空间。

* 原实现：`contextLimit * 0.8`

* 修改后：`contextLimit * 0.85`

