# 修复提炼结论和标题生成功能 - 检查清单

## extract-conclusion 路由验证
- [x] 新增了 `fullThinkingContent` 变量
- [x] `thinking` case 中累加 `chunk.content` 到 `fullThinkingContent`
- [x] conclusion 使用 `fullContent.trim() || fullThinkingContent.trim()` 回退逻辑
- [x] 添加了调试日志
- [x] 消息数组末尾追加user消息（当最后一条是assistant时）

## generate-title 路由验证
- [x] 新增了 `fullThinkingContent` 变量
- [x] `thinking` case 中累加 `chunk.content` 到 `fullThinkingContent`
- [x] title 使用 `(fullContent.trim() || fullThinkingContent.trim()).substring(0, 10)` 回退逻辑
- [x] 添加了调试日志
- [x] 消息数组末尾追加user消息（当最后一条是assistant时）

## 编译与运行验证
- [x] 服务端 TypeScript 编译通过，无类型错误
- [x] 服务器 PM2 服务正常运行
- [ ] 线上提炼结论功能正常（需用户线上验证）
- [ ] 线上标题生成功能正常（需用户线上验证）

## 根因修复验证
- [x] 服务器端API测试确认：追加user消息后结论提炼返回非空内容
- [x] 服务器端API测试确认：追加user消息后标题生成返回非空内容
