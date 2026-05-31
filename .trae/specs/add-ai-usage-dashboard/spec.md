# AI 用量仪表盘 Spec

## Why

管理后台当前仅有 `aiInteractions` 一个聚合数字，缺少模型维度、Token 维度、响应时间维度、队列状态等关键运营指标。上线推广后需要实时监控 AI 调用成本和性能，及时发现异常。

## What Changes

- 新增 admin 后端 AI 用量统计 API（从主服务的 ai_usage 集合读取数据）
- 新增 admin 前端 AI 用量仪表盘页面
- 新增侧边栏导航入口

## Impact

- Affected code: admin/server/src/routes/、admin/server/src/services/、admin/client/src/pages/、admin/client/src/App.tsx、admin/client/src/components/Layout/AdminLayout.tsx、admin/client/src/services/api.ts

---

## ADDED Requirements

### Requirement: AI 用量统计后端 API

系统 SHALL 提供以下 API 端点供管理后台调用：

#### GET /api/admin/ai-usage/stats
返回汇总统计数据：
- totalTokens: 总 Token 消耗
- totalCalls: 总调用次数
- avgResponseTime: 平均响应时间(ms)
- successRate: 成功率(%)
- todayTokens: 今日 Token 消耗
- todayCalls: 今日调用次数

#### GET /api/admin/ai-usage/trends
返回趋势数据，支持参数：
- startDate / endDate: 时间范围
- granularity: day/week/month
- model: 按模型筛选
返回每日/周/月的 Token 消耗和调用次数

#### GET /api/admin/ai-usage/model-distribution
返回模型使用分布：
- model: 模型名
- count: 调用次数
- tokens: Token 消耗
- percentage: 占比

#### GET /api/admin/ai-usage/queue-status
返回队列实时状态（从主服务 API 代理获取）

#### GET /api/admin/ai-usage/export
导出用量数据为 CSV

### Requirement: AI 用量仪表盘页面

系统 SHALL 提供 /ai-usage 页面，包含：

1. **筛选栏**：时间范围（今日/昨日/近7天/近30天/自定义）+ 模型筛选下拉
2. **指标卡片**（4个）：总Token消耗、总调用次数、平均响应时间、成功率
3. **Token 消耗趋势图**：Recharts LineChart，支持日/周/月粒度切换，悬停显示详情
4. **模型使用分布饼图**：Recharts PieChart，图例+点击筛选
5. **队列实时状态面板**：当前并发数、队列长度、处理速度
6. **自动刷新**：默认 30 秒，支持手动刷新
7. **数据导出**：导出 CSV 按钮

### Requirement: 侧边栏导航

系统 SHALL 在管理后台侧边栏添加"AI 用量"导航项，图标使用 Activity（lucide-react），位于"数据大盘"之后。

---

## MODIFIED Requirements

### Requirement: AdminDBService 连接

AdminDBService 需要能访问主服务的 ai_usage 集合。由于 admin 和主服务共用同一个 MongoDB 数据库，AdminDBService 已有连接，只需新增 ai_usage 集合的查询方法。
