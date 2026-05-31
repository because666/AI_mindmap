# 修复反馈与推送功能 - 验收清单

- [x] 反馈提交后主服务端日志输出连接状态和写入结果
- [x] 反馈写入成功时日志包含 insertedId
- [x] 反馈写入失败时日志包含 isConnected 状态
- [x] 无注册设备时 pushService.sendFeedbackNotification 仍创建 push_messages 记录
- [x] anonymous 用户不创建推送记录
- [x] 有注册设备时推送消息正常发送并标记 sentAt
- [x] 广播消息写入失败时返回明确500错误
- [x] 广播消息写入成功时正常返回 messageId
- [x] Admin反馈列表查询时日志输出 DB 连接状态
- [x] notifyFeedbackPush HTTP调用失败时输出详细错误信息（状态码、响应体）
- [x] 主服务端 tsc 编译无错误
- [x] Admin服务端 tsc 编译无错误
- [x] 主前端 npm run build 无错误
- [x] Admin前端 npm run build 无错误
- [x] 服务器部署后PM2日志无异常错误
- [x] 服务器主服务端和Admin服务端 INTERNAL_API_TOKEN 配置一致
- [x] 服务器 Admin MAIN_SERVER_URL 正确指向主服务端