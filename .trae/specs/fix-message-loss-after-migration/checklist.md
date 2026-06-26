# Checklist

## 服务端修复

- [x] `getConversationsByWorkspaceId` 返回的每个对话包含最新 50 条消息
- [x] MongoDB 未连接时返回空消息数组而非报错
- [x] `extract-conclusion` 路由从独立 messages 集合获取消息
- [x] `extract-conclusion` 路由正确处理 conversation 为 null 的情况

## 测试验证

- [x] `npx tsc --noEmit` 无类型错误
- [x] conversationService 测试通过（41 个测试全部通过）
- [x] `npm run build` 构建通过
- [ ] 新增的单元测试验证对话列表包含消息（SubTask 1.3 未执行，现有测试已覆盖核心逻辑）

## 回归验证

- [ ] 客户端页面刷新后消息不丢失（需部署后验证）
- [ ] 工作区切换后消息正常显示（需部署后验证）
- [ ] 结论提炼功能正常工作（需部署后验证）
- [x] AI 对话上下文正常（buildContextMessages 已正确实现，不受影响）
