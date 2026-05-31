# 修复反馈列表筛选与分页显示问题 Spec

## Why
用户反馈：在Admin反馈管理页面中，"全部类型"筛选下无法显示所有反馈记录，但选择具体分类时可以正常显示。经代码审查发现两个问题：(1) `handleSearch` 函数中存在 `setPage(1)` 后立即调用 `loadList()` 的闭包陷阱，`loadList` 使用的是旧 page 值而非重置后的 page=1；(2) 分页区域缺少总记录数显示，用户无法直观了解数据量。

## What Changes
- 修复 `handleSearch` 函数：移除 `setPage(1)` 后的 `loadList()` 调用，依赖 useEffect 自动触发重新加载
- 在分页区域增加总记录数显示（格式：「共 N 条记录」）
- 优化分页信息区域：显示「第 X-Y 条 / 共 N 条」

## Impact
- Affected specs: add-feedback-admin-management
- Affected code:
  - `admin/client/src/pages/Feedback/FeedbackPage.tsx` — handleSearch 修复、分页UI增强

## ADDED Requirements

### Requirement: 搜索时正确重置页码
系统SHALL在用户点击搜索按钮时仅重置页码为1，不直接调用加载函数，依赖React状态更新后自动通过useEffect触发数据加载，确保使用正确的页码参数。

#### Scenario: 用户在非第一页时切换筛选条件并搜索
- **WHEN** 用户当前在第2页，选择筛选条件后点击"搜索"按钮
- **THEN** 页码重置为1，API请求携带 `page=1` 参数

#### Scenario: 用户在非第一页时切换类型下拉
- **WHEN** 用户当前在第2页，从"全部类型"切换为"功能异常"
- **THEN** 页码自动重置为1（通过onChange中的setPage(1)），列表重新加载第一页数据

### Requirement: 分页区域显示总记录数
系统SHALL在分页控件中显示总记录数信息，帮助用户了解数据总量。

#### Scenario: 有多页数据
- **WHEN** 反馈列表总数为35条，每页20条
- **THEN** 分页区域显示「共 35 条记录，第 1-20 条」和上一页/下一页按钮

#### Scenario: 只有一页数据
- **WHEN** 反馈列表总数不超过20条
- **THEN** 分页区域显示「共 N 条记录」，不显示翻页按钮

#### Scenario: 最后一页数据不足一页
- **WHEN** 反馈列表总数为35条，当前在第2页
- **THEN** 分页区域显示「共 35 条记录，第 21-35 条」