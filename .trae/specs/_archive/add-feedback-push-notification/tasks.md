# Tasks

- [x] Task 1: 反馈数据增加 visitorId 字段
  - [x] 修改 server/src/routes/feedback.ts，从请求头 `X-Visitor-Id` 获取 visitorId 并存入反馈记录
  - [x] 修改 admin/server/src/routes/feedbacks.ts 列表返回数据，包含 visitorId 字段
  - [x] 修改 admin/server/src/types/index.ts，FeedbackListItem 接口添加 visitorId 字段
  - [x] 修改 admin/client/src/types/index.ts，FeedbackListItem 接口添加 visitorId 字段

- [x] Task 2: 主服务端新增反馈推送方法
  - [x] 修改 server/src/services/pushService.ts，新增 sendFeedbackNotification 方法
  - [x] 方法参数：visitorId、feedbackTitle、newStatus
  - [x] 根据 visitorId 查询用户设备，发送极光推送
  - [x] 推送消息存储到 push_messages 集合，type 为 'feedback_notification'
  - [x] visitorId 为 'anonymous' 或无设备时仅记录日志不发送

- [x] Task 3: Admin后台状态更新时触发推送
  - [x] 修改 admin/server/src/routes/feedbacks.ts 的 PATCH /:id/status 路由
  - [x] 状态更新成功后，通过 HTTP 调用主服务端的推送接口
  - [x] 使用 INTERNAL_API_TOKEN 进行内部通信鉴权
  - [x] 新增主服务端内部推送路由 POST /api/internal/push/feedback-notification

- [x] Task 4: 构建并部署验证
  - [x] 主服务端 tsc 编译无错误
  - [x] Admin服务端 tsc 编译无错误
  - [x] 主前端 npm run build 无错误
  - [x] Admin前端 npm run build 无错误
  - [ ] 推送代码到 GitHub
  - [ ] 服务器部署并验证

# Task Dependencies
- Task 1 独立（优先执行）
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖所有其他任务
