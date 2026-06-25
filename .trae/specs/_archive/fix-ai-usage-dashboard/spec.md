# 修复AI用量监控页面图表与时间筛选问题 Spec

## Why

AI用量监控页面存在两个问题：1）Token消耗趋势折线图和模型使用分布饼图不显示（空白），因为前端期望后端返回 `{ items: [] }` 格式但后端直接返回数组；2）只有「近7日」和「自定义」标签有数据，「今日」「昨日」「近30日」无数据，因为前端传给后端的 `endDate` 只包含日期不含时间，导致后端筛选条件 `createdAt <= 2026-06-01T00:00:00Z` 只匹配当天0点精确时刻。

## What Changes

- 修复前端 AIUsagePage.tsx 中趋势数据和模型分布数据的解析逻辑，直接读取数组而非 `data.items`
- 修复前端 `getDateRange` 函数，`endDate` 追加 `T23:59:59` 时间后缀，确保后端筛选包含当天全部数据

## Impact

- Affected code:
  - admin/client/src/pages/AIUsage/AIUsagePage.tsx — 数据解析逻辑 + 日期范围生成逻辑

---

## MODIFIED Requirements

### Requirement: 趋势数据解析逻辑

前端 SHALL 直接从 `trendsRes.data.data` 读取数组作为趋势数据，而非从 `data.items` 读取。

- 原实现：`const trends = trendsRes.data.data as { items: TrendItem[] }; setTrendData(trends.items || []);`
- 修改后：`const trends = trendsRes.data.data; setTrendData(Array.isArray(trends) ? trends : []);`

### Requirement: 模型分布数据解析逻辑

前端 SHALL 直接从 `modelRes.data.data` 读取数组作为模型分布数据。

- 原实现：`const dist = modelRes.data.data as { items: ModelDistributionItem[] }; setModelDistribution(dist.items || []);`
- 修改后：`const dist = modelRes.data.data; setModelDistribution(Array.isArray(dist) ? dist : []);`

### Requirement: 日期范围生成逻辑

前端 `getDateRange` 函数 SHALL 在 `endDate` 后追加 `T23:59:59` 时间后缀，确保后端 `$lte` 筛选条件覆盖当天全部数据。

- 原实现：`return { startDate: format(now, fmt), endDate: format(now, fmt) };` → 后端收到 `2026-06-01`，`new Date('2026-06-01')` = `2026-06-01T00:00:00Z`
- 修改后：`return { startDate: format(now, fmt), endDate: format(now, fmt) + 'T23:59:59' };` → 后端收到 `2026-06-01T23:59:59`，`new Date('2026-06-01T23:59:59')` = `2026-06-01T23:59:59Z`
