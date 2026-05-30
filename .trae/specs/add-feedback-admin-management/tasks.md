# Tasks

- [ ] Task 1: 主服务端反馈API增加数据库存储
  - [ ] 修改 server/src/routes/feedback.ts，在发送邮件后将反馈数据写入 MongoDB `feedbacks` 集合
  - [ ] 反馈记录字段：title、description、type、contact、visitorIp、status(默认pending)、createdAt
  - [ ] 在 server/src/data/mongodb/connection.ts 中添加 feedbacks 集合索引（createdAt降序、status、type）

- [ ] Task 2: Admin服务端新增反馈管理路由和服务
  - [ ] 新建 admin/server/src/services/feedbackService.ts — 反馈数据查询、统计、状态更新
  - [ ] 新建 admin/server/src/routes/feedbacks.ts — 反馈管理路由
  - [ ] 路由：GET /api/admin/feedbacks（分页列表+筛选）、GET /api/admin/feedbacks/stats（统计）、PATCH /api/admin/feedbacks/:id/status（更新状态）、POST /api/admin/feedbacks/export（导出CSV）
  - [ ] 在 admin/server/src/index.ts 中注册路由
  - [ ] 在 admin/server/src/types/index.ts 中添加反馈相关类型定义

- [ ] Task 3: Admin前端新增反馈管理页面
  - [ ] 新建 admin/client/src/pages/Feedback/FeedbackPage.tsx — 反馈管理页面
  - [ ] 统计卡片：总反馈数、待处理数、已解决数、今日新增
  - [ ] 筛选栏：类型下拉、状态下拉、时间范围选择
  - [ ] 反馈列表：标题、类型标签、状态标签、提交时间、操作按钮
  - [ ] 反馈详情弹窗：完整描述、联系方式、IP、时间、状态修改
  - [ ] 在 admin/client/src/services/api.ts 中添加反馈API调用
  - [ ] 在 admin/client/src/types/index.ts 中添加反馈类型定义

- [ ] Task 4: Admin前端侧边栏和路由添加反馈管理入口
  - [ ] 在 admin/client/src/components/Layout/AdminLayout.tsx 侧边栏添加"反馈管理"导航项
  - [ ] 在 admin/client/src/App.tsx 中添加 /feedbacks 路由

- [ ] Task 5: 构建并部署验证
  - [ ] 主服务端 tsc 编译无错误
  - [ ] Admin服务端 tsc 编译无错误
  - [ ] Admin前端 npm run build 无错误
  - [ ] 推送代码到 GitHub
  - [ ] 服务器部署并验证

# Task Dependencies
- Task 1 独立（优先执行）
- Task 2 依赖 Task 1（需要反馈数据已存储到数据库）
- Task 3 与 Task 2 可并行（前端页面开发不依赖后端完成）
- Task 4 依赖 Task 3
- Task 5 依赖所有其他任务
