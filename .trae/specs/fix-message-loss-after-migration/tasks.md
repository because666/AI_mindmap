# Tasks

- [x] Task 1: 修复 `getConversationsByWorkspaceId` 返回消息
  - [x] SubTask 1.1: 在 `conversationService.getConversationsByWorkspaceId` 中，对每个对话调用 `getConversationMessages` 附加最新 50 条消息到 `conversation.messages` 字段
  - [x] SubTask 1.2: 确保 MongoDB 未连接时返回空消息数组而非报错
  - [ ] SubTask 1.3: 添加单元测试验证返回的对话包含消息

- [x] Task 2: 修复 `extract-conclusion` 路由消息获取
  - [x] SubTask 2.1: 在 `server/src/routes/conversations.ts` 行 421-422，将 `conversation?.messages || []` 改为调用 `conversationService.getConversationMessages(conversation.id)`
  - [x] SubTask 2.2: 处理 conversation 为 null 的情况

- [x] Task 3: 修复 `getConversationByNodeId` 返回消息（可选）
  - [x] SubTask 3.1: 检查 `getConversationByNodeId` 的所有调用方，确认是否需要附加消息
  - [x] SubTask 3.2: 如需要，在返回前附加最新消息

- [x] Task 4: 验证与测试
  - [x] SubTask 4.1: 运行 `cd server && npx tsc --noEmit` 确认无类型错误
  - [x] SubTask 4.2: 运行 `cd server && npx vitest run src/test/conversationService.test.ts` 确认测试通过
  - [x] SubTask 4.3: 运行 `cd server && npm run build` 确认构建通过

# Task Dependencies

- Task 1 和 Task 2 可并行执行
- Task 3 依赖 Task 1 完成后评估
- Task 4 依赖 Task 1 和 Task 2 完成
