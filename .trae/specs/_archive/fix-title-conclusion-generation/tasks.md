# Tasks

- [x] Task 1: 复现并定位标题生成与结论提炼失效原因
  - [x] SubTask 1.1: 检查 ChatPanel 中 handleGenerateTitle 与 handleExtractConclusion 的入参与状态来源
  - [x] SubTask 1.2: 检查 chatService 中 generateTitleStream 与 extractConclusionStream 的 SSE 解析逻辑
  - [x] SubTask 1.3: 检查 conversations 路由中 generate-title 与 extract-conclusion 返回结构是否与客户端一致
  - [x] SubTask 1.4: 明确“内容不足”是前端消息未传递、服务端查询失败、还是 AI 空响应导致

- [x] Task 2: 修复结论提炼数据来源与请求协议
  - [x] SubTask 2.1: 确保结论提炼请求携带或服务端可读取当前节点完整有效消息内容
  - [x] SubTask 2.2: 过滤无效空消息，保留用户消息和 AI 回复用于结论生成
  - [x] SubTask 2.3: 修复服务端内容不足判断，避免有对话时误判失败
  - [x] SubTask 2.4: 确保成功响应包含客户端可解析的 conclusion 字段

- [x] Task 3: 修复标题生成数据来源与请求协议
  - [x] SubTask 3.1: 确保标题生成请求使用当前节点有效消息内容
  - [x] SubTask 3.2: 确保服务端标题生成成功响应包含客户端可解析的 title 字段
  - [x] SubTask 3.3: 标题为空或内容不足时返回明确错误，不更新为空标题

- [x] Task 4: 改善前端错误提示与容错
  - [x] SubTask 4.1: 区分内容不足、限流、网络异常、AI 空响应等错误类型
  - [x] SubTask 4.2: 结论提炼失败时不创建结论节点，不影响继续输入
  - [x] SubTask 4.3: 标题生成失败时保留原标题，不影响普通对话

- [x] Task 5: 补充测试与验证
  - [x] SubTask 5.1: 为 SSE done/error 解析补充测试或可执行验证用例
  - [x] SubTask 5.2: 为标题生成成功、内容不足、服务异常补充测试或可执行验证用例
  - [x] SubTask 5.3: 为结论提炼成功、内容不足、服务异常补充测试或可执行验证用例
  - [x] SubTask 5.4: 执行客户端构建、服务端 TypeScript 校验和必要单元测试

- [x] Task 6: 部署与线上验收
  - [x] SubTask 6.1: 上传修复后的客户端与服务端变更到服务器
  - [x] SubTask 6.2: 重启对应 PM2 服务并确认进程 online
  - [x] SubTask 6.3: 在线上管理或用户页面完成标题生成与结论提炼手动验收

# Task Dependencies

- Task 2、Task 3 依赖 Task 1
- Task 4 依赖 Task 2、Task 3
- Task 5 依赖 Task 2、Task 3、Task 4
- Task 6 依赖 Task 5
