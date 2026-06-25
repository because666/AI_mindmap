# Tasks

- [x] Task 1: 定义工具调用类型和工具 Schema
  - [x] SubTask 1.1: 在 client/src/types/index.ts 中新增 ToolCall、ToolResult、ToolCallStreamEvent 等类型定义
  - [x] SubTask 1.2: 在 server/src/services/aiService.ts 中新增 ToolDefinition 接口和 TOOLS 常量（6个工具的 JSON Schema 定义）
  - [x] SubTask 1.3: 在 server/src/services/aiService.ts 的 StreamChunk 联合类型中新增 ToolCallChunk

- [x] Task 2: 服务端支持 tools 参数和 tool_calls 流式解析
  - [x] SubTask 2.1: 修改 chatStreamWithProvider 方法，增加 tools 参数传入 OpenAI SDK 调用
  - [x] SubTask 2.2: 在流式解析循环中处理 delta.tool_calls 字段，组装完整 tool_call 对象
  - [x] SubTask 2.3: 修改 chatStream 入口方法，支持传入 tools 参数

- [x] Task 3: 服务端实现工具调用循环
  - [x] SubTask 3.1: 在 ai.ts 路由中实现 tool_call 事件的 SSE 推送
  - [x] SubTask 3.2: 新增 /chat/tool-result 端点，接收客户端回传的工具执行结果
  - [x] SubTask 3.3: 实现工具调用循环逻辑：收到 tool_call → 推送客户端 → 等待 tool_result → 加入消息 → 再次调用 AI
  - [x] SubTask 3.4: 实现工具调用次数限制（最多5次）

- [x] Task 4: 客户端 SSE 解析支持 tool_call 事件
  - [x] SubTask 4.1: 在 chatService.ts 的 parseSSEStream 中新增 tool_call 和 tool_result 事件解析
  - [x] SubTask 4.2: 在 StreamEvent 类型中新增 tool_call 和 tool_result 事件类型
  - [x] SubTask 4.3: 修改 sendMessageStream 返回类型，支持工具调用结果

- [x] Task 5: 客户端工具执行器
  - [x] SubTask 5.1: 创建 client/src/services/toolExecutor.ts，实现6个工具的执行逻辑
  - [x] SubTask 5.2: toolExecutor 调用 appStore 中对应的 CRUD 方法
  - [x] SubTask 5.3: 实现工具执行结果的回传逻辑（调用 /chat/tool-result 端点）
  - [x] SubTask 5.4: 实现工具执行错误处理

- [x] Task 6: ChatPanel 工具调用 UI 和流程集成
  - [x] SubTask 6.1: 在 ChatPanel 中处理 tool_call 事件，调用 toolExecutor 执行工具
  - [x] SubTask 6.2: 新增工具调用状态 UI 组件（执行中/成功/失败指示器）
  - [x] SubTask 6.3: 工具执行完成后回传结果并等待 AI 继续响应
  - [x] SubTask 6.4: 处理工具调用过程中的流式内容展示（先展示 AI 文本，再展示工具状态，再展示后续响应）

- [x] Task 7: 系统提示词更新
  - [x] SubTask 7.1: 在 prompts.ts 中增加工具使用指引，告知 AI 可用工具及使用场景
  - [x] SubTask 7.2: 强调 AI 应先查询导图结构再执行操作

- [x] Task 8: 测试和验证
  - [x] SubTask 8.1: 编译验证（TypeScript 无报错）
  - [x] SubTask 8.2: 功能验证：AI 创建节点
  - [x] SubTask 8.3: 功能验证：AI 创建关系
  - [x] SubTask 8.4: 功能验证：AI 编辑节点内容
  - [x] SubTask 8.5: 功能验证：AI 自动扩展节点
  - [x] SubTask 8.6: 功能验证：AI 查询导图结构
  - [x] SubTask 8.7: 功能验证：多次工具调用
  - [x] SubTask 8.8: 功能验证：工具调用失败处理

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 5]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 3, Task 6, Task 7]
- [Task 1] 和 [Task 7] 可并行
- [Task 3] 和 [Task 4] 可并行（Task 3 做服务端，Task 4 做客户端类型）
- [Task 5] 和 [Task 3] 可并行（Task 5 做客户端执行器，Task 3 做服务端循环）
