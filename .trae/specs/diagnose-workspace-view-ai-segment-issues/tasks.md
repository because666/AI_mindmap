# Tasks

- [x] Task 1: 诊断置顶 403 + auth/me 401 问题
  - [x] SubTask 1.1: 确认本地 auth.ts 是否已修复（写入 role: 'super_admin'）
  - [x] SubTask 1.2: 确认服务器是否部署了最新代码（未部署）
  - [x] SubTask 1.3: 确认 auth/me 401 原因（session 失效）

- [x] Task 2: 诊断查看工作区按钮无反应问题
  - [x] SubTask 2.1: 检查 WorkspacesPage.tsx 中查看按钮的 onClick 绑定
  - [x] SubTask 2.2: 确认 GET /:id 接口是否已存在（已存在但前端未调用）

- [x] Task 3: 诊断 AI 服务商管理 vs AI 模型管理重复问题
  - [x] SubTask 3.1: 对比两个功能的字段、存储、路由
  - [x] SubTask 3.2: 确认主服务端 aiService.ts 实际使用哪个数据源（ai_model_configs 集合）
  - [x] SubTask 3.3: 确认 admin_configs.aiProviders 是否被主服务端读取（未被读取）

- [x] Task 4: 诊断用户分群功能不可用问题
  - [x] SubTask 4.1: 检查后端路由是否注册（已注册）
  - [x] SubTask 4.2: 检查前端 API 方法与 UI 按钮绑定（完整）
  - [x] SubTask 4.3: 分析"没有实际使用场景"的产品设计层面原因（标签/分群未被其他模块消费）

# Task Dependencies

- 所有诊断任务相互独立，已并行完成
