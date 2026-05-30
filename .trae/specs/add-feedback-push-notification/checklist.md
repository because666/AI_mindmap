# 反馈处理结果推送通知 - 验收清单

- [x] 反馈提交时记录 visitorId 字段
- [x] Admin反馈列表返回 visitorId 字段
- [x] Admin反馈详情弹窗显示提交者标识
- [x] 管理员更新反馈状态为"处理中"时发送推送通知
- [x] 管理员更新反馈状态为"已解决"时发送推送通知
- [x] 管理员更新反馈状态为"已关闭"时发送推送通知
- [x] 推送消息存储到 push_messages 集合
- [x] 推送消息类型为 feedback_notification
- [x] visitorId 为 anonymous 时不发送推送（仅记录日志）
- [x] 无设备注册时不发送推送（仅记录日志）
- [x] 主服务端 tsc 编译无错误
- [x] Admin服务端 tsc 编译无错误
- [ ] 服务器部署后功能正常
