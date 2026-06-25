# AI 请求优先级队列与端点统一 - 检查清单

## 优先级队列
- [x] AI 请求优先级队列已实现（P0 对话 / P1 后台任务）
- [x] P0 请求优先执行，P1 请求排队等待
- [x] 最大并发数可配置（默认 5）
- [x] 队列统计信息可通过 API 查询

## 后台任务延迟
- [x] 标题生成延迟 5 秒执行
- [x] 结论提炼延迟 2 秒执行

## 多 Key 轮询
- [x] ZHIPU_API_KEY_2 环境变量已添加
- [x] 同一 Provider 多 Key 轮询（Round-Robin）已实现
- [x] .env.example 已更新

## 每用户限流
- [x] 对话端点限流 20 次/分钟/用户
- [x] 后台任务端点限流 10 次/分钟/用户
- [x] 限流中间件已应用到 AI 路由

## 端点统一
- [x] generate-title 端点已改为 SSE 流式输出
- [x] extract-conclusion 端点已改为 SSE 流式输出
- [x] conversations/:nodeId/message 端点已改为 SSE 流式输出
- [x] POST /api/ai/chat 非流式端点已删除
- [x] 客户端 chatService.ts 已适配新端点

## 用量记录统一
- [x] generate-title 端点已添加用量记录
- [x] extract-conclusion 端点已添加用量记录
- [x] conversations/:nodeId/message 端点已添加用量记录

## 用户 Key 支持
- [x] conversations 路由 3 个端点支持用户自带 Key
- [x] 客户端标题生成/结论提炼调用时传递用户 API 配置

## 限流引导
- [x] 客户端检测 429 响应并触发限流回调
- [x] ChatPanel 显示引导提示（配置自己的 Key）
- [x] 后台任务限流时静默失败

## 编译验证
- [x] client TypeScript 编译通过（exit code 0）
- [x] server TypeScript 编译通过（仅 searchService.ts:69 预已存在错误）
