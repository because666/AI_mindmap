# Tasks

- [x] Task 1: 修复 extract-conclusion 路由的 fullContent 累加逻辑
  - [x] 1.1 在 extract-conclusion 路由中新增 `fullThinkingContent` 变量，初始为空字符串
  - [x] 1.2 在 `thinking` case 中，将 `chunk.content` 累加到 `fullThinkingContent`
  - [x] 1.3 在流式循环结束后，将 `const conclusion = fullContent.trim()` 改为 `const conclusion = fullContent.trim() || fullThinkingContent.trim()`
  - [x] 1.4 添加调试日志：在 conclusion 判断前记录 `fullContent` 和 `fullThinkingContent` 的长度

- [x] Task 2: 修复 generate-title 路由的 fullContent 累加逻辑
  - [x] 2.1 在 generate-title 路由中新增 `fullThinkingContent` 变量，初始为空字符串
  - [x] 2.2 在 `thinking` case 中，将 `chunk.content` 累加到 `fullThinkingContent`
  - [x] 2.3 在流式循环结束后，将 `const title = fullContent.trim().substring(0, 10)` 改为 `const title = (fullContent.trim() || fullThinkingContent.trim()).substring(0, 10)`
  - [x] 2.4 添加调试日志：在 title 判断前记录 `fullContent` 和 `fullThinkingContent` 的长度

- [x] Task 3: 编译验证与部署
  - [x] 3.1 服务端 TypeScript 编译通过
  - [x] 3.2 上传修改文件到服务器
  - [x] 3.3 重启 PM2 服务并验证

- [x] Task 4: 修复消息数组末尾为assistant消息导致AI返回空内容的根因
  - [x] 4.1 在 extract-conclusion 路由中，构建 aiMessages 后检查最后一条消息角色，如果是assistant则追加 `{ role: 'user', content: '请根据以上对话内容提炼核心结论' }`
  - [x] 4.2 在 generate-title 路由中，构建 aiMessages 后检查最后一条消息角色，如果是assistant则追加 `{ role: 'user', content: '请根据以上对话内容生成标题' }`

- [x] Task 5: 编译部署到服务器并验证
  - [x] 5.1 服务端 TypeScript 编译通过
  - [x] 5.2 上传修改文件到服务器
  - [x] 5.3 在服务器执行 npx tsc 编译
  - [x] 5.4 重启 PM2 服务
  - [ ] 5.5 线上验证结论提炼和标题生成功能

# Task Dependencies

- Task 4 依赖 Task 1-3 已完成（代码基线稳定）
- Task 5 依赖 Task 4 完成
