# 修复后台网站对话消息不可见与数据同步延迟 Spec

## Why

主网站已将对话消息迁移到独立的 `messages` 集合（`conversation.messages` 数组不再维护，始终为空），但后台网站 `chatAudit` 路由仍从 `conversations` 文档的 `messages` 数组读取消息，导致后台完全看不到任何对话消息内容。此外，仪表盘趋势数据有 5 分钟 Redis 缓存，用户在主网站产生新数据后后台最多延迟 5 分钟才能看到趋势更新。

## What Changes

- 修复 `admin/server/src/routes/chatAudit.ts` 中 4 个接口，改为从独立 `messages` 集合查询消息：
  - `GET /conversations`（对话列表）：通过 `messages` 集合聚合统计消息数
  - `GET /conversations/:id`（对话详情）：从 `messages` 集合查询完整消息列表
  - `POST /scan`（敏感词扫描）：从 `messages` 集合查询用户消息进行扫描
  - `DELETE /conversations/:convId/messages/:msgIndex`（删除消息）：从 `messages` 集合按消息 ID 删除
- 降低仪表盘趋势数据缓存 TTL 从 5 分钟到 1 分钟，减少数据同步延迟

## Impact

- Affected specs: fix-message-loss-after-migration（消息独立集合迁移的后台适配遗漏）
- Affected code:
  - `admin/server/src/routes/chatAudit.ts`（核心修复）
  - `admin/server/src/services/dashboardService.ts`（缓存 TTL 调整）

## ADDED Requirements

### Requirement: 后台对话消息从独立 messages 集合查询

系统 SHALL 在后台对话审计接口中从独立 `messages` 集合查询消息，而非从 `conversations` 文档的 `messages` 数组读取。

`messages` 集合文档结构（由主网站 `conversationService.addMessage` 写入）：
- `id`: 消息 UUID
- `conversationId`: 所属对话 ID
- `nodeId`: 所属节点 ID
- `workspaceId`: 工作区 ID
- `role`: `'user' | 'assistant' | 'system'`
- `content`: 消息文本
- `timestamp`: Date

#### Scenario: 后台查看对话列表

- **WHEN** 管理员在后台打开对话审计页面
- **THEN** 列表显示所有对话，每条对话的消息数通过 `messages` 集合按 `conversationId` 聚合统计
- **AND** 最后一条消息预览从 `messages` 集合按 `timestamp` 倒序取第一条
- **AND** 不再从 `conversation.messages` 数组读取（该数组迁移后始终为空）

#### Scenario: 后台查看对话详情

- **WHEN** 管理员点击某条对话查看详情
- **THEN** 从 `messages` 集合按 `conversationId` 查询全部消息，按 `timestamp` 升序排列
- **AND** 返回完整的消息列表（role、content、timestamp）

#### Scenario: 后台敏感词扫描

- **WHEN** 管理员手动触发敏感词扫描
- **THEN** 从 `messages` 集合查询 `role='user'` 的消息进行敏感词匹配
- **AND** 命中的消息写入 `chat_audits` 集合

#### Scenario: 后台删除指定消息

- **WHEN** 管理员删除对话中的某条消息
- **THEN** 从 `messages` 集合按消息 `id` 字段删除对应文档（不再通过数组索引 splice）

### Requirement: 仪表盘趋势数据缓存延迟降低

系统 SHALL 将仪表盘趋势数据的缓存 TTL 从 5 分钟降低到 1 分钟，使主网站新产生的数据在 1 分钟内反映到后台趋势图表。

#### Scenario: 主网站产生新数据后后台趋势更新

- **WHEN** 主网站用户产生新的对话消息
- **THEN** 后台仪表盘趋势图在最多 1 分钟内反映该数据
- **AND** 仪表盘核心统计指标（`getStats`）保持无缓存实时查询

## MODIFIED Requirements

### Requirement: 后台对话审计消息查询

原实现从 `conversations` 集合文档内嵌的 `messages` 数组读取消息。修改为从独立 `messages` 集合查询，通过 `conversationId` 关联。
