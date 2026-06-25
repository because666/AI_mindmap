# Tasks

- [x] Task 1: 修改默认 system prompt，移除硬编码中文语言指令
  - [x] SubTask 1.1: 修改 `server/src/config/prompts.ts`，将"使用中文回答，专业术语保留英文原文并附中文解释"从 DEFAULT_SYSTEM_PROMPT 中移除
  - [x] SubTask 1.2: 同步修改 TITLE_GENERATION_PROMPT 和 CONCLUSION_EXTRACTION_PROMPT 中的语言相关指令（无硬编码语言指令，无需修改）

- [x] Task 2: 服务端支持语言指令动态注入
  - [x] SubTask 2.1: 修改 `server/src/routes/ai.ts`，从请求体读取 `language` 字段，根据语言偏好追加语言指令到 system prompt
  - [x] SubTask 2.2: 修改 `server/src/routes/conversations.ts` 的 `buildContextMessages` 函数，支持语言指令
  - [x] SubTask 2.3: 修改标题生成端点，从请求读取语言偏好并追加到 TITLE_GENERATION_PROMPT
  - [x] SubTask 2.4: 修改结论提炼端点，从请求读取语言偏好并追加到 CONCLUSION_EXTRACTION_PROMPT

- [x] Task 3: 客户端传递语言偏好
  - [x] SubTask 3.1: 修改 `client/src/services/chatService.ts`，在 `sendMessageStream` 请求体中新增 `language` 字段
  - [x] SubTask 3.2: 修改 `client/src/components/Chat/ChatPanel.tsx`，在调用 chatService 时传递当前语言
  - [x] SubTask 3.3: 修改标题生成调用，传递当前语言
  - [x] SubTask 3.4: 修改结论提炼调用，传递当前语言

- [x] Task 4: 构建验证与部署
  - [x] SubTask 4.1: 客户端构建通过
  - [x] SubTask 4.2: 服务端 TypeScript 编译通过
  - [x] SubTask 4.3: 部署到服务器并验证

# Task Dependencies
- Task 1 和 Task 2 可并行（Task 2 依赖 Task 1 的 prompt 修改结果，但代码层面可同时修改）
- Task 3 依赖 Task 2（需要知道服务端接受的字段名）
- Task 4 依赖所有前置任务
