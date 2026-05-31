# Tasks

- [x] Task 1: 脱敏 server/.env.example 中的真实API密钥
  - [x] 将 `ZHIPU_API_KEY` 替换为占位符
  - [x] 将 `JPUSH_APPKEY` 替换为占位符
  - [x] 将 `JPUSH_MASTER_SECRET` 替换为占位符
  - [x] 将 `INTERNAL_API_TOKEN` 替换为占位符
  - [x] 将 `NEO4J_PASSWORD` 替换为占位符
  - [x] 将 `MONGODB_URI` 中的密码替换为占位符

- [x] Task 2: 补全 server/.env 缺失的配置项
  - [x] 追加 JPUSH 配置段
  - [x] 追加定时任务配置段
  - [x] 追加 INTERNAL_API_TOKEN 配置
  - [x] 追加 SMTP 配置段

- [x] Task 3: 检查并修复 admin/server/.env.example
  - [x] 将 MONGODB_URI 中的密码替换为占位符
  - [x] 将 JPUSH_APPKEY 替换为占位符
  - [x] 将 JPUSH_MASTER_SECRET 替换为占位符
  - [x] 将 SESSION_SECRET 替换为占位符
  - [x] 将 INTERNAL_API_TOKEN 替换为占位符

# Task Dependencies
- Task 1、Task 2、Task 3 相互独立，可并行执行