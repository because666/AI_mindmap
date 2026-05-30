# Tasks

- [x] Task 1: 主服务端反馈API增加数据库存储
  - [x] 修改 server/src/routes/feedback.ts，在发送邮件后将反馈数据写入 MongoDB `feedbacks` 集合
  - [x] 反馈记录字段：title、description、type、contact、visitorIp、status(默认pending)、createdAt
  - [x] 在 server/src/data/mongodb/connection.ts 中添加 feedbacks 集合索引（createdAt降序、status、type）

- [x] Task 2: Admin服务端新增反馈管理路由和服务
  - [x] 新建 admin/server/src/services/feedbackService.ts — 反馈数据查询、统计、状态更新
  - [x] 新建 admin/server/src/routes/feedbacks.ts — 反馈管理路由
  - [x] 路由：GET /api/admin/feedbacks（分页列表+筛选）、GET /api/admin/feedbacks/stats（统计）、PATCH /api/admin/feedbacks/:id/status（更新状态）、POST /api/admin/feedbacks/export（导出CSV）
  - [x] 在 admin/server/src/index.ts 中注册路由
  - [x] 在 admin/server/src/types/index.ts 中添加反馈相关类型定义

- [x] Task 3: Admin前端新增反馈管理页面
  - [x] 新建 admin/client/src/pages/Feedback/FeedbackPage.tsx — 反馈管理页面
  - [x] 统计卡片：总反馈数、待处理数、已解决数、今日新增
  - [x] 筛选栏：类型下拉、状态下拉、时间范围选择
  - [x] 反馈列表：标题、类型标签、状态标签、提交时间、操作按钮
  - [x] 反馈详情弹窗：完整描述、联系方式、IP、时间、状态修改
  - [x] 在 admin/client/src/services/api.ts 中添加反馈API调用
  - [x] 在 admin/client/src/types/index.ts 中添加反馈类型定义

- [x] Task 4: Admin前端侧边栏和路由添加反馈管理入口
  - [x] 在 admin/client/src/components/Layout/AdminLayout.tsx 侧边栏添加"反馈管理"导航项
  - [x] 在 admin/client/src/App.tsx 中添加 /feedbacks 路由

- [x] Task 5: 构建并部署验证
  - [x] 主服务端 tsc 编译无错误
  - [x] Admin服务端 tsc 编译无错误
  - [x] 主前端 npm run build 无错误
  - [x] Admin前端 npm run build 无错误
  - [x] 推送代码到 GitHub
  - [x] 服务器 SFTP 上传 + 4个构建 + PM2 重启
  - [x] 反馈 API 验证通过（curl 测试返回 success:true）

# Task Dependencies
- Task 1 独立（优先执行）
- Task 2 依赖 Task 1
- Task 3 与 Task 2 可并行
- Task 4 依赖 Task 3
- Task 5 依赖所有其他任务
