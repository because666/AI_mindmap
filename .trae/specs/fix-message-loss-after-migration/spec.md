# 修复消息独立集合迁移后消息丢失 Spec

## Why

P0/P1 优化中将对话消息从 `conversation.messages` 数组迁移到独立 `messages` 集合，`addMessage` 不再维护 `conversation.messages` 数组。但多处代码仍直接读取 `conversation.messages`，导致页面刷新或工作区切换后消息全部消失，以及结论提炼功能无法获取消息。

## What Changes

- 服务端 `getConversationsByWorkspaceId` 返回对话时，为每个对话附加最新 N 条消息
- 服务端 `extract-conclusion` 路由改用 `getConversationMessages` 替代 `conversation.messages`
- 服务端 `getConversationByNodeId` 返回时附加最新消息（可选，视调用方需求）

## Impact

- Affected specs: p0-p1-security-quality-overhaul
- Affected code:
  - `server/src/services/conversationService.ts` - `getConversationsByWorkspaceId` 需附加消息
  - `server/src/routes/conversations.ts` - `extract-conclusion` 路由行 421-422 需修复
  - `server/src/routes/nodes.ts` - 导出路由已有正确实现（行 199），无需修改

## ADDED Requirements

无。

## MODIFIED Requirements

### Requirement: 对话列表接口返回消息

`GET /conversations/list` 返回的每个对话对象 SHALL 包含最新 N 条消息（默认 50 条），从独立 `messages` 集合查询，按时间升序排列。

#### Scenario: 正常加载
- **WHEN** 客户端请求对话列表
- **THEN** 每个对话的 `messages` 字段包含该对话的最新消息列表

#### Scenario: 页面刷新后消息不丢失
- **WHEN** 用户刷新页面或切换工作区后重新加载
- **THEN** 之前对话的消息正常显示

### Requirement: 结论提炼获取消息

`extract-conclusion` 路由 SHALL 从独立 `messages` 集合获取消息，不再依赖 `conversation.messages` 数组。

#### Scenario: 结论提炼正常
- **WHEN** 用户触发结论提炼且未传入 messages 参数
- **THEN** 从独立 messages 集合正确加载对话消息用于提炼

## REMOVED Requirements

无。
