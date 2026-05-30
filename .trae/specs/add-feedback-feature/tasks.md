# Tasks

- [ ] Task 1: 安装 nodemailer 依赖并配置环境变量
  - [ ] 在 server/ 目录下安装 nodemailer 及其类型定义（@types/nodemailer）
  - [ ] 在 server/.env.example 中添加 SMTP 环境变量（SMTP_HOST、SMTP_PORT、SMTP_USER、SMTP_PASS、FEEDBACK_EMAIL）
  - [ ] 在 server/.env 中添加实际 SMTP 配置值

- [ ] Task 2: 创建服务端邮件发送服务
  - [ ] 新建 server/src/services/emailService.ts
  - [ ] 实现 createTransporter 函数（从环境变量读取 SMTP 配置）
  - [ ] 实现 sendFeedbackEmail 函数（构建邮件内容、发送邮件）
  - [ ] 邮件内容包含：标题、描述、类型、联系方式、提交时间

- [ ] Task 3: 创建服务端反馈 API 路由
  - [ ] 新建 server/src/routes/feedback.ts
  - [ ] 实现 POST /api/feedback 路由
  - [ ] 添加输入验证（标题和描述必填、类型枚举校验、长度限制）
  - [ ] 添加 HTML 转义防 XSS
  - [ ] 添加限流（每IP每分钟最多3次）
  - [ ] 在 server/src/index.ts 中注册路由

- [ ] Task 4: 创建前端 FeedbackModal 组件
  - [ ] 新建 client/src/components/Feedback/FeedbackModal.tsx
  - [ ] 实现反馈表单弹窗（标题、描述、类型下拉、联系方式、提交/取消按钮）
  - [ ] 表单验证（必填字段检查）
  - [ ] 提交逻辑（调用 /api/feedback 接口）
  - [ ] 成功/失败提示（使用 toast 或内联提示）
  - [ ] 弹窗样式参考 SettingsModal（毛玻璃遮罩 + 深色主题）

- [ ] Task 5: 在侧边栏添加反馈按钮
  - [ ] 在 MainLayout.tsx 中添加 isFeedbackOpen 状态
  - [ ] 在 renderDesktopSidebar 中添加反馈按钮（设置按钮上方，MessageCircle 图标）
  - [ ] 在 renderSidebarContent（移动端）中添加反馈按钮
  - [ ] 在主布局中渲染 FeedbackModal 组件

- [ ] Task 6: 构建并部署验证
  - [ ] 服务端 tsc 编译无错误
  - [ ] 前端 npm run build 无错误
  - [ ] 推送代码到 GitHub
  - [ ] 服务器部署并验证

# Task Dependencies
- Task 1 独立（优先执行，安装依赖）
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 独立（可与 Task 2/3 并行）
- Task 5 依赖 Task 4
- Task 6 依赖所有其他任务
