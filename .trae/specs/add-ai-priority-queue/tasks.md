# Tasks

- [x] Task 1: 实现 AI 请求优先级队列
  - [x] SubTask 1.1: 新建 server/src/services/aiQueue.ts，实现优先级队列（P0 对话 / P1 后台任务）
  - [x] SubTask 1.2: 队列支持最大并发数配置（默认 5），P0 优先执行，P1 排队等待
  - [x] SubTask 1.3: 在 aiService.ts 中添加 chatWithQueue/chatStreamWithQueue 方法
  - [x] SubTask 1.4: 队列统计信息通过 GET /api/ai/queue/stats 暴露

- [x] Task 2: 后台任务延迟执行
  - [x] SubTask 2.1: 标题生成延迟 5 秒执行
  - [x] SubTask 2.2: 结论提炼延迟 2 秒执行

- [x] Task 3: 多 Key 轮询
  - [x] SubTask 3.1: config/index.ts 添加 ZHIPU_API_KEY_2 配置项
  - [x] SubTask 3.2: aiService.ts 实现 Key 池 Round-Robin 轮询
  - [x] SubTask 3.3: .env.example 更新

- [x] Task 4: 每用户 AI 限流
  - [x] SubTask 4.1: 新建 aiRateLimit.ts 中间件
  - [x] SubTask 4.2: 对话 20次/分钟，后台 10次/分钟
  - [x] SubTask 4.3: 限流中间件应用到 AI 路由

- [x] Task 5: 统一所有 AI 端点为流式输出
  - [x] SubTask 5.1: generate-title 改为 SSE 流式
  - [x] SubTask 5.2: extract-conclusion 改为 SSE 流式
  - [x] SubTask 5.3: conversations/:nodeId/message 改为 SSE 流式
  - [x] SubTask 5.4: 删除 POST /api/ai/chat 非流式端点
  - [x] SubTask 5.5: 客户端 chatService.ts 适配

- [x] Task 6: 统一用量记录
  - [x] SubTask 6.1: generate-title 添加用量记录
  - [x] SubTask 6.2: extract-conclusion 添加用量记录
  - [x] SubTask 6.3: conversations/:nodeId/message 添加用量记录

- [x] Task 7: 统一用户 Key 支持
  - [x] SubTask 7.1: conversations 3 个端点支持用户 Key
  - [x] SubTask 7.2: 客户端传递用户 API 配置

- [x] Task 8: 内置 Key 限流时引导用户配置
  - [x] SubTask 8.1: chatService.ts 检测 429 响应
  - [x] SubTask 8.2: ChatPanel 显示限流引导提示
  - [x] SubTask 8.3: 后台任务限流静默失败

# Task Dependencies

- Task 1 ✅ → Task 2/4/5/6/7 依赖
- Task 3 独立 ✅
- Task 5+6 合并完成 ✅
- Task 7 依赖 Task 5 ✅
- Task 8 依赖 Task 4 ✅
