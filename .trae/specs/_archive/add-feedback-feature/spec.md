# 反馈功能 Spec

## Why

用户需要一个便捷的反馈渠道来报告问题或提出建议，当前项目缺少反馈机制。需要在左侧导航栏添加反馈按钮，点击后弹出反馈表单，提交后通过邮件发送反馈内容。

## What Changes

* 在左侧导航栏（桌面端和移动端）添加"反馈"按钮，使用 MessageCircle 图标

* 新建 `FeedbackModal` 弹窗组件，包含反馈表单

* 新建服务端反馈 API 路由（`/api/feedback`）

* 新建服务端邮件发送服务（使用 nodemailer + QQ邮箱 SMTP）

* 在服务端 `.env.example` 中添加 SMTP 环境变量配置

* 安装新依赖：`nodemailer`（服务端邮件发送库）

## Impact

* Affected code: MainLayout.tsx（侧边栏添加按钮）、新建 FeedbackModal.tsx、新建 server/src/routes/feedback.ts、新建 server/src/services/emailService.ts

* 新增依赖: nodemailer（需用户确认后安装）

## 安全要求

* **SMTP 凭证必须通过环境变量读取**，禁止硬编码邮箱地址和授权码

* 表单数据必须进行 XSS 防护（HTML 转义）

* 后端需添加限流（rate limiting）防止恶意提交

* 输入验证：标题和描述长度限制、类型枚举校验

## ADDED Requirements

### Requirement: 反馈按钮

系统 SHALL 在左侧导航栏底部（设置按钮上方）添加"反馈"按钮。

#### Scenario: 桌面端用户查看反馈按钮

* **WHEN** 用户查看桌面端侧边栏

* **THEN** 在设置按钮上方显示 MessageCircle 图标按钮

* **AND** hover 时显示"反馈"tooltip

#### Scenario: 移动端用户查看反馈按钮

* **WHEN** 用户查看移动端侧边栏

* **THEN** 在设置按钮上方显示 MessageCircle 图标 + "反馈"文字标签

### Requirement: 反馈表单弹窗

系统 SHALL 提供反馈表单弹窗，包含问题标题（必填）、详细描述（必填）、问题类型下拉菜单、联系方式（选填）、提交和取消按钮。

#### Scenario: 用户打开反馈弹窗

* **WHEN** 用户点击反馈按钮

* **THEN** 显示居中弹窗，包含毛玻璃背景遮罩

* **AND** 弹窗包含：标题输入框、描述文本域、类型下拉菜单（功能异常/界面问题/建议/其他）、联系方式输入框、提交按钮、取消按钮

#### Scenario: 用户提交必填字段为空

* **WHEN** 用户未填写标题或描述就点击提交

* **THEN** 显示验证错误提示，阻止提交

#### Scenario: 用户成功提交反馈

* **WHEN** 用户填写完整表单并点击提交

* **THEN** 系统发送邮件至指定邮箱

* **AND** 显示成功提示

* **AND** 关闭弹窗并清空表单

#### Scenario: 提交失败

* **WHEN** 邮件发送失败

* **THEN** 显示友好的错误提示

* **AND** 保留表单内容允许重试

### Requirement: 邮件发送服务

系统 SHALL 通过 nodemailer + QQ邮箱 SMTP 发送反馈邮件，SMTP 凭证从环境变量读取。

#### Scenario: 后端收到反馈请求

* **WHEN** 后端收到 POST /api/feedback 请求

* **THEN** 验证请求数据（标题和描述必填、类型枚举校验、长度限制）

* **AND** 对数据进行 HTML 转义防止 XSS

* **AND** 通过 SMTP 发送邮件

* **AND** 返回成功/失败响应

### Requirement: 环境变量配置

系统 SHALL 在 .env.example 中添加 SMTP 相关环境变量。

#### Scenario: 部署人员配置邮件

* **WHEN** 部署人员查看 .env.example

* **THEN** 可看到 SMTP\_HOST、SMTP\_PORT、SMTP\_USER、SMTP\_PASS、FEEDBACK\_EMAIL 配置项及说明

<br />

