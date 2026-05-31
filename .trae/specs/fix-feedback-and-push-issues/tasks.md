# Tasks

- [x] Task 1: 增强主服务端反馈写入诊断日志
  - [x] 修改 `server/src/routes/feedback.ts`：在 `insertOne` 前后增加 `mongoDBService.isConnected()` 状态日志
  - [x] 写入成功时输出 `insertedId`
  - [x] 写入返回null时输出连接状态详细信息
  - [x] 异常捕获时输出完整堆栈

- [x] Task 2: 修复推送通知无设备时仍创建消息记录
  - [x] 修改 `server/src/services/pushService.ts` 的 `sendFeedbackNotification` 方法
  - [x] 将设备检查逻辑后移：先创建 `push_messages` 记录，再检查设备
  - [x] 无设备时记录 `sentAt=null`，`stats.totalCount=0`，返回消息记录对象
  - [x] 仅 `anonymous` 用户跳过不创建记录

- [x] Task 3: 修复Admin广播消息写入校验
  - [x] 修改 `admin/server/src/routes/push.ts` 的 `POST /broadcast` 路由
  - [x] 检查 `insertOne` 返回值，为null时返回500错误
  - [x] 增加写入成功/失败的诊断日志

- [x] Task 4: 增强Admin反馈查询DB连接状态诊断
  - [x] 修改 `admin/server/src/routes/feedbacks.ts` 的 `GET /` 路由
  - [x] 在查询前输出 `adminDB.isConnected()` 状态日志
  - [x] 输出当前查询的筛选条件和分页参数

- [x] Task 5: 增强推送通知HTTP调用错误详情日志
  - [x] 修改 `admin/server/src/services/cacheNotify.ts` 的 `notifyFeedbackPush` 函数
  - [x] 捕获错误时区分HTTP错误(有response)、网络错误(无response)和未知错误
  - [x] 403错误特别提示 INTERNAL_API_TOKEN 配置检查

- [x] Task 6: 构建验证
  - [x] 主服务端 `tsc --noEmit` 编译无错误
  - [x] Admin服务端 `tsc --noEmit` 编译无错误
  - [x] 主前端 `npm run build` 无错误
  - [x] Admin前端 `npm run build` 无错误

- [x] Task 7: 部署到服务器并验证
  - [x] SFTP上传修改的文件到服务器
  - [x] 在服务器上执行4个构建（server、admin/server、client、admin/client）
  - [x] PM2重启 `deepmindmap-server` 和 `deepmindmap-admin`
  - [x] 检查PM2日志确认服务正常启动
  - [x] 检查Admin .env中 `MAIN_SERVER_URL=http://127.0.0.1:3001`
  - [x] 检查主服务端 .env中 `INTERNAL_API_TOKEN` 存在且与Admin一致

# Task Dependencies
- Task 1、Task 2、Task 3、Task 4 相互独立，可并行执行
- Task 5 独立
- Task 6 依赖 Task 1~5
- Task 7 依赖 Task 6