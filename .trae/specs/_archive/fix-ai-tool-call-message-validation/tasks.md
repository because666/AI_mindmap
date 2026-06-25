# Tasks

- [x] Task 1: 修复 chatStream 方法中的消息验证逻辑
  - [x] 修改 `server/src/services/aiService.ts` 第826-833行的验证循环，区分不同角色消息的格式要求
  - [x] assistant+tool_calls 消息：允许 content 为空，校验 tool_calls 存在且非空
  - [x] tool 消息：校验 content 为字符串且 tool_call_id 存在
  - [x] system/user/assistant（无tool_calls）消息：content 必须为非空字符串
- [x] Task 2: 编译服务端代码并部署到服务器
  - [x] 运行 `npm run build` 编译
  - [x] SCP 上传 dist 到服务器
  - [x] PM2 重启 deepmindmap-server
- [x] Task 3: 端到端验证工具调用流程
  - [ ] 发送"帮我创建一个新节点"触发工具调用
  - [ ] 确认AI返回工具调用结果，画布上出现新节点
  - [ ] 确认服务端日志无 `Invalid message content` 错误

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 2
