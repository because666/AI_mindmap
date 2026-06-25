# AI 工具调用（Function Calling）Spec

## Why
当前 AI 只能通过文本对话与用户交互，无法直接操作思维导图。赋予 AI 工具调用能力，使其可以创建节点、创建关系、编辑内容、自动扩展，将 AI 从"只能说"升级为"能做"，大幅提升思维导图工具的智能性和交互体验。

## What Changes
- 服务端 AI 调用增加 `tools` 参数，支持 OpenAI Function Calling 格式
- 服务端流式解析增加 `tool_calls` 响应处理
- SSE 传输新增 `tool_call` 和 `tool_result` 事件类型
- 客户端新增工具执行器，接收 tool_call 事件后操作 Zustand Store
- 客户端工具执行结果回传服务端，AI 继续生成响应
- 新增 `get_mindmap_context` 和 `get_node_detail` 查询工具，AI 按需获取导图结构
- ChatPanel 新增工具调用状态的 UI 展示
- 分级执行机制：创建/编辑类操作直接执行，删除类操作需用户确认
- **仅支持 OpenAI 兼容格式的 Provider**（智谱、DeepSeek、OpenAI），不支持 Anthropic

## Impact
- Affected code:
  - `server/src/services/aiService.ts` — 增加 tools 参数、tool_calls 流式解析、工具执行循环
  - `server/src/routes/ai.ts` — SSE 新增 tool_call/tool_result 事件
  - `server/src/config/prompts.ts` — 系统提示词增加工具使用指引
  - `client/src/services/chatService.ts` — SSE 解析新增 tool_call/tool_result 事件
  - `client/src/components/Chat/ChatPanel.tsx` — 工具调用 UI、工具执行器
  - `client/src/stores/appStore.ts` — 提供工具执行所需的方法调用接口
  - `client/src/types/index.ts` — 新增类型定义

## ADDED Requirements

### Requirement: AI 工具定义
系统 SHALL 定义以下工具供 AI 调用：

1. **create_node** — 在思维导图中创建新节点
   - 参数：parent_node_id (string), title (string), content? (string), position? ("left"|"right")
   - 返回：{ node_id: string, success: boolean }

2. **create_relation** — 在两个节点之间创建关系
   - 参数：source_node_id (string), target_node_id (string), relation_type (RelationType), label? (string)
   - 返回：{ relation_id: string, success: boolean }

3. **update_node** — 修改已有节点的标题或内容
   - 参数：node_id (string), title? (string), content? (string)
   - 返回：{ success: boolean }

4. **expand_node** — 为指定节点自动生成子主题
   - 参数：node_id (string), direction ("deepen"|"broaden"|"apply"|"compare"), count? (number, 默认3)
   - 返回：{ created_node_ids: string[], success: boolean }

5. **get_mindmap_context** — 获取当前思维导图的结构概览
   - 参数：无
   - 返回：{ nodes: Array<{ id, title, type, isRoot, parentIds, childrenIds }>, root_node_id: string }

6. **get_node_detail** — 获取指定节点的详细信息
   - 参数：node_id (string)
   - 返回：{ id, title, content, type, tags, parentIds, childrenIds, relations: Array<{ id, type, targetId, description }> }

#### Scenario: AI 创建节点
- **WHEN** 用户发送"帮我创建一个关于量子计算的子节点"
- **THEN** AI 调用 `create_node` 工具，传入 parent_node_id 和 title
- **THEN** 前端执行工具创建节点，画布上出现新节点
- **THEN** AI 回复确认信息

#### Scenario: AI 自动扩展节点
- **WHEN** 用户发送"帮我展开这个方向"
- **THEN** AI 调用 `expand_node` 工具
- **THEN** 前端创建多个子节点并自动布局
- **THEN** AI 回复扩展内容的概述

#### Scenario: AI 查询导图结构
- **WHEN** AI 需要了解当前导图结构才能做出合理操作
- **THEN** AI 调用 `get_mindmap_context` 获取结构概览
- **THEN** AI 根据结构信息决定下一步操作

### Requirement: 服务端工具调用处理
系统 SHALL 在服务端实现完整的工具调用循环：

1. 将 tools 参数传入 OpenAI SDK 的 `chat.completions.create` 调用
2. 流式解析 `delta.tool_calls` 字段，组装完整的 tool_call 对象
3. 通过 SSE 将 tool_call 事件推送到客户端
4. 接收客户端回传的 tool_result
5. 将 tool_result 作为 `tool` 角色消息加入对话，再次调用 AI 继续生成
6. AI 可以在一次对话中多次调用工具（最多5次）

#### Scenario: 单次工具调用
- **WHEN** AI 返回一个 tool_call
- **THEN** 服务端通过 SSE 推送 tool_call 事件到客户端
- **THEN** 客户端执行工具并回传 tool_result
- **THEN** 服务端将 tool_result 加入消息列表，再次调用 AI
- **THEN** AI 生成最终文本响应

#### Scenario: 多次工具调用
- **WHEN** AI 在一次响应中返回多个 tool_calls
- **THEN** 服务端将所有 tool_calls 推送到客户端
- **THEN** 客户端依次执行所有工具并回传结果
- **THEN** 服务端将所有 tool_results 加入消息列表，再次调用 AI

#### Scenario: 工具调用次数限制
- **WHEN** AI 在一轮对话中累计调用工具超过5次
- **THEN** 服务端终止工具调用循环，返回提示信息

### Requirement: 客户端工具执行器
系统 SHALL 在客户端实现工具执行器：

1. 监听 SSE 中的 `tool_call` 事件
2. 根据工具名称调用 appStore 中对应的方法
3. 将执行结果通过 HTTP 请求回传服务端
4. 展示工具调用的状态（执行中/成功/失败）

#### Scenario: 创建节点工具执行
- **WHEN** 客户端收到 `create_node` tool_call
- **THEN** 调用 `appStore.createChildNode(parentId, title)` 创建节点
- **THEN** 返回 { node_id, success: true }

#### Scenario: 工具执行失败
- **WHEN** 工具执行过程中发生错误（如节点不存在）
- **THEN** 返回 { success: false, error: "节点不存在" }
- **THEN** AI 收到错误信息后向用户说明

### Requirement: 分级执行机制
系统 SHALL 实现分级执行机制：

1. **安全操作（直接执行）**：create_node、create_relation、update_node、expand_node、get_mindmap_context、get_node_detail
2. **危险操作（需确认）**：暂无（删除类操作不在首期实现）

#### Scenario: 安全操作直接执行
- **WHEN** AI 调用安全类工具
- **THEN** 客户端直接执行，无需用户确认

### Requirement: 工具调用 UI 展示
系统 SHALL 在聊天面板中展示工具调用的状态：

1. 工具调用时显示执行状态指示器（工具名称 + 旋转图标）
2. 工具执行成功后显示简要结果（如"已创建节点：量子计算"）
3. 工具执行失败后显示错误提示

#### Scenario: 工具调用状态展示
- **WHEN** AI 正在调用工具
- **THEN** 聊天面板显示"正在创建节点..."的状态指示
- **WHEN** 工具执行完成
- **THEN** 状态指示更新为"已创建节点：量子计算"

### Requirement: 导图上下文查询
系统 SHALL 提供 `get_mindmap_context` 工具让 AI 按需获取导图结构：

- AI 不通过系统提示词注入导图结构（节省 token）
- AI 需要了解导图时主动调用查询工具
- 返回精简的结构信息（节点ID + 标题 + 层级关系）

#### Scenario: AI 按需查询导图
- **WHEN** 用户发送"帮我整理一下这张思维导图"
- **THEN** AI 首先调用 `get_mindmap_context` 获取结构
- **THEN** AI 根据结构信息决定操作方案
- **THEN** AI 调用相应工具执行操作

### Requirement: 系统提示词更新
系统 SHALL 更新系统提示词，告知 AI 可用工具及其使用方式：

1. 在系统提示词中说明 AI 拥有操作思维导图的能力
2. 说明各工具的适用场景
3. 强调创建操作应先查询导图结构再执行
4. 强调操作应精准、最小化，避免过度操作

## MODIFIED Requirements

### Requirement: 流式响应处理
原有的流式响应处理 SHALL 扩展支持 tool_call 和 tool_result 事件类型：

1. `StreamChunk` 联合类型新增 `ToolCallChunk`：`{ type: 'tool_call', tool_call: { id, name, arguments } }`
2. `StreamEvent` 类型新增 `tool_call` 和 `tool_result` 事件
3. SSE 传输新增 `tool_call` 和 `tool_result` 数据格式
4. 客户端 SSE 解析器新增对应事件处理

### Requirement: AI 消息格式
原有的消息格式 SHALL 扩展支持工具调用：

1. `ChatMessage` 新增 `tool_calls` 字段（assistant 消息可携带）
2. 新增 `tool` 角色，用于回传工具执行结果
3. 消息验证逻辑允许 `tool` 角色
