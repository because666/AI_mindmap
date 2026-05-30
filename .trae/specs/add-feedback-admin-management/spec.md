# 反馈数据存储与管理后台集成 Spec

## Why
当前反馈功能仅通过邮件发送反馈内容，数据未持久化存储，无法进行统计分析和管理。需要将反馈数据存储至 MongoDB 数据库，并在后台管理系统中新增反馈管理页面，支持数据查询、筛选、统计分析和导出。

## What Changes
- 主服务端反馈API增加数据库存储逻辑（将反馈记录写入 `feedbacks` 集合）
- Admin服务端新增反馈管理路由（CRUD + 统计 + 导出）
- Admin服务端新增反馈统计服务
- Admin前端新增反馈管理页面（列表、筛选、统计、导出）
- Admin前端侧边栏新增"反馈管理"导航项

## Impact
- Affected specs: add-feedback-feature
- Affected code: server/src/routes/feedback.ts（增加数据库存储）、admin/server/src/routes/（新增路由）、admin/client/src/pages/（新增页面）

## ADDED Requirements

### Requirement: 反馈数据持久化存储
系统 SHALL 将用户提交的反馈数据存储至 MongoDB `feedbacks` 集合。

#### Scenario: 用户提交反馈
- **WHEN** 用户通过反馈表单提交反馈
- **THEN** 反馈数据存储至 `feedbacks` 集合，包含字段：_id、title、description、type、contact、visitorIp、status（默认 pending）、createdAt
- **AND** 同时发送邮件通知（保持现有行为不变）

### Requirement: 反馈管理API
系统 SHALL 提供反馈管理API，支持列表查询、详情查看、状态更新、统计分析和数据导出。

#### Scenario: 管理员查询反馈列表
- **WHEN** 管理员请求 GET /api/admin/feedbacks
- **THEN** 返回分页反馈列表，支持按 type、status、时间范围筛选
- **AND** 支持按 createdAt 降序排序

#### Scenario: 管理员更新反馈状态
- **WHEN** 管理员请求 PATCH /api/admin/feedbacks/:id/status
- **THEN** 更新反馈状态（pending/processing/resolved/closed）
- **AND** 记录审计日志

#### Scenario: 管理员获取反馈统计
- **WHEN** 管理员请求 GET /api/admin/feedbacks/stats
- **THEN** 返回统计数据：总数、各状态数量、各类型数量、近30天每日提交趋势

#### Scenario: 管理员导出反馈数据
- **WHEN** 管理员请求 POST /api/admin/feedbacks/export
- **THEN** 导出筛选后的反馈数据为 CSV 文件

### Requirement: 反馈管理页面
系统 SHALL 在后台管理系统中新增反馈管理页面。

#### Scenario: 管理员查看反馈管理页
- **WHEN** 管理员点击侧边栏"反馈管理"
- **THEN** 显示反馈管理页面，包含统计卡片、筛选栏、反馈列表
- **AND** 统计卡片显示：总反馈数、待处理数、已解决数、今日新增数
- **AND** 筛选栏支持：类型筛选、状态筛选、时间范围筛选
- **AND** 列表每行显示：标题、类型标签、状态标签、提交时间、操作按钮

#### Scenario: 管理员查看反馈详情
- **WHEN** 管理员点击某条反馈
- **THEN** 显示反馈详情弹窗，包含完整描述、联系方式、提交IP、提交时间
- **AND** 可修改反馈状态

## MODIFIED Requirements

### Requirement: 反馈API增加数据库存储
主服务端 POST /api/feedback 路由在发送邮件的同时，将反馈数据写入 MongoDB `feedbacks` 集合。
