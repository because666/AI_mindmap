# AI 用量仪表盘 - 检查清单

## 后端 API
- [ ] GET /api/admin/ai-usage/stats 返回汇总统计
- [ ] GET /api/admin/ai-usage/trends 返回趋势数据（支持日/周/月粒度）
- [ ] GET /api/admin/ai-usage/model-distribution 返回模型分布
- [ ] GET /api/admin/ai-usage/queue-status 返回队列状态
- [ ] GET /api/admin/ai-usage/export 导出 CSV
- [ ] 路由已注册到 index.ts

## 前端页面
- [ ] /ai-usage 页面可访问
- [ ] 筛选栏（时间范围 + 模型筛选）正常工作
- [ ] 4 个指标卡片正确显示
- [ ] Token 消耗趋势折线图正常渲染
- [ ] 日/周/月粒度切换正常
- [ ] 模型使用分布饼图正常渲染
- [ ] 队列实时状态面板显示
- [ ] 自动刷新（30秒）正常
- [ ] 手动刷新按钮正常
- [ ] CSV 导出功能正常

## 导航集成
- [ ] 侧边栏显示"AI 用量"导航项
- [ ] 路由跳转正常
- [ ] API 调用方法已添加到 api.ts

## 编译验证
- [ ] admin/server TypeScript 编译通过
- [ ] admin/client TypeScript 编译通过
