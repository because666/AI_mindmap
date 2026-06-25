# 修复AI工具调用消息验证错误 Spec

## Why
AI工具调用的第二轮请求（客户端执行工具后回传结果）被服务端 `chatStream` 方法中的消息验证逻辑错误拦截，抛出 `Invalid message content`，导致工具调用流程无法完成。

## 根本原因
`server/src/services/aiService.ts` 第826-829行的消息验证逻辑：
```typescript
for (const msg of request.messages) {
  if (!msg.content || typeof msg.content !== 'string') {
    throw new Error('Invalid message content');
  }
}
```
此验证要求每条消息都必须有非空的 `content` 字符串，但：
- `assistant + tool_calls` 消息的 `content` 可能为空字符串 `""`（`!""` 为 `true`，验证失败）
- `tool` 角色消息虽然 `content` 非空，但验证未区分不同角色消息的格式要求

服务端日志证实：第一次请求成功返回 `tool_calls`，第二次请求（包含 assistant+tool_calls 和 tool 消息）在6ms内失败，`[AI Stream] 发送给API的消息:` 日志缺失，说明错误在验证阶段就抛出了。

## What Changes
- 修改 `chatStream` 方法中的消息验证逻辑，区分不同角色消息的格式要求
- `assistant + tool_calls` 消息：`content` 可以为空或省略，但 `tool_calls` 必须存在且非空
- `tool` 消息：`content` 必须为字符串，`tool_call_id` 必须存在
- `system`/`user`/`assistant`（无tool_calls）消息：`content` 必须为非空字符串
- 清理之前添加的调试日志（非必要，但保持代码整洁）

## Impact
- Affected specs: add-ai-tool-calling
- Affected code: `server/src/services/aiService.ts`（chatStream 方法消息验证逻辑）

## ADDED Requirements

### Requirement: 工具调用消息格式验证
系统 SHALL 对不同角色的消息采用不同的验证规则：
- `system`/`user` 消息：`content` 必须为非空字符串
- `assistant` 消息（含 `tool_calls`）：`content` 可以为空字符串或省略，`tool_calls` 必须存在且为非空数组
- `assistant` 消息（无 `tool_calls`）：`content` 必须为非空字符串
- `tool` 消息：`content` 必须为字符串（可为空），`tool_call_id` 必须存在

#### Scenario: assistant+tool_calls 消息验证通过
- **WHEN** 客户端发送包含 `assistant + tool_calls` 消息的请求
- **THEN** 验证逻辑允许 `content` 为空字符串，只校验 `tool_calls` 存在且非空

#### Scenario: tool 消息验证通过
- **WHEN** 客户端发送 `tool` 角色消息
- **THEN** 验证逻辑校验 `content` 为字符串且 `tool_call_id` 存在

#### Scenario: 工具调用完整流程成功
- **WHEN** AI 返回 tool_call → 客户端执行工具 → 客户端回传 assistant+tool_calls 和 tool 消息 → 服务端发起新请求
- **THEN** AI 继续生成文本响应，不再抛出 `Invalid message content` 错误

## MODIFIED Requirements

### Requirement: chatStream 消息验证
原验证逻辑要求所有消息的 `content` 为非空字符串。修改为根据消息角色和是否包含 `tool_calls` 采用差异化验证规则。
