# Tasks

- [ ] Task 1: 后端 AI 用量统计 API
  - [ ] SubTask 1.1: 新建 admin/server/src/services/aiUsageService.ts，实现从 ai_usage 集合查询统计数据
  - [ ] SubTask 1.2: 新建 admin/server/src/routes/aiUsage.ts，实现 5 个 API 端点
  - [ ] SubTask 1.3: 在 admin/server/src/index.ts 中注册路由
  - [ ] SubTask 1.4: 实现 CSV 导出端点

- [ ] Task 2: 前端 AI 用量仪表盘页面
  - [ ] SubTask 2.1: 新建 admin/client/src/pages/AIUsage/AIUsagePage.tsx，实现完整仪表盘
  - [ ] SubTask 2.2: 实现筛选栏（时间范围 + 模型筛选）
  - [ ] SubTask 2.3: 实现 4 个指标卡片（Token/调用次数/响应时间/成功率）
  - [ ] SubTask 2.4: 实现 Token 消耗趋势折线图（Recharts LineChart，日/周/月切换）
  - [ ] SubTask 2.5: 实现模型使用分布饼图（Recharts PieChart）
  - [ ] SubTask 2.6: 实现队列实时状态面板
  - [ ] SubTask 2.7: 实现自动刷新（30秒）和手动刷新
  - [ ] SubTask 2.8: 实现数据导出 CSV 按钮

- [ ] Task 3: 路由和导航集成
  - [ ] SubTask 3.1: 在 App.tsx 中添加 /ai-usage 路由
  - [ ] SubTask 3.2: 在 AdminLayout.tsx 侧边栏添加"AI 用量"导航项
  - [ ] SubTask 3.3: 在 api.ts 中添加 AI 用量 API 调用方法

# Task Dependencies

- Task 1 是基础，Task 2 依赖 Task 1
- Task 3 与 Task 2 可并行
