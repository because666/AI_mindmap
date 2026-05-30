# Tasks

- [x] Task 1: 安装 nodemailer 依赖并配置环境变量
  - [x] 在 server/ 目录下安装 nodemailer 及其类型定义（@types/nodemailer）
  - [x] 在 server/.env.example 中添加 SMTP 环境变量（SMTP_HOST、SMTP_PORT、SMTP_USER、SMTP_PASS、FEEDBACK_EMAIL）
  - [x] 在服务器 server/.env 中添加实际 SMTP 配置值

- [x] Task 2: 创建服务端邮件发送服务
  - [x] 新建 server/src/services/emailService.ts
  - [x] 实现 createTransporter 函数（从环境变量读取 SMTP 配置）
  - [x] 实现 sendFeedbackEmail 函数（构建邮件内容、发送邮件）
  - [x] 邮件内容包含：标题、描述、类型、联系方式、提交时间

- [x] Task 3: 创建服务端反馈 API 路由
  - [x] 新建 server/src/routes/feedback.ts
  - [x] 实现 POST /api/feedback 路由
  - [x] 添加输入验证（标题和描述必填、类型枚举校验、长度限制）
  - [x] 添加 HTML 转义防 XSS
  - [x] 添加限流（每IP每分钟最多3次）
  - [x] 在 server/src/index.ts 中注册路由

- [x] Task 4: 创建前端 FeedbackModal 组件
  - [x] 新建 client/src/components/Feedback/FeedbackModal.tsx
  - [x] 实现反馈表单弹窗（标题、描述、类型下拉、联系方式、提交/取消按钮）
  - [x] 表单验证（必填字段检查）
  - [x] 提交逻辑（调用 /api/feedback 接口）
  - [x] 成功/失败提示（内联提示 + 自动关闭）
  - [x] 弹窗样式参考 SettingsModal（毛玻璃遮罩 + 深色主题）

- [x] Task 5: 在侧边栏添加反馈按钮
  - [x] 在 MainLayout.tsx 中添加 isFeedbackOpen 状态
  - [x] 在 renderDesktopSidebar 中添加反馈按钮（设置按钮上方，MessageCircle 图标）
  - [x] 在 renderSidebarContent（移动端）中添加反馈按钮
  - [x] 在主布局中渲染 FeedbackModal 组件

- [x] Task 6: 构建并部署验证
  - [x] 服务端 tsc 编译无错误
  - [x] 前端 npm run build 无错误
  - [x] 推送代码到 GitHub
  - [x] 服务器 SFTP 上传 + npm install + 构建 + PM2 重启
  - [x] 反馈 API 验证通过（curl 测试返回 success:true）

# Task Dependencies
- Task 1 独立（优先执行，安装依赖）
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 独立（可与 Task 2/3 并行）
- Task 5 依赖 Task 4
- Task 6 依赖所有其他任务
