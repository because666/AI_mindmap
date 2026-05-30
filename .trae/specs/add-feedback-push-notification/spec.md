# 反馈处理结果推送通知 Spec

## Why
用户提交反馈后无法获知处理进度，需要通过极光推送将反馈处理结果实时通知给提交反馈的用户，形成完整的反馈闭环。

## What Changes
- 反馈数据增加 `visitorId` 字段，记录提交者的用户标识
- Admin后台更新反馈状态时，自动通过极光推送发送通知给反馈提交者
- 主服务端新增反馈推送方法，复用已有的 pushService 推送能力

## Impact
- Affected specs: add-feedback-feature, add-feedback-admin-management
- Affected code: server/src/routes/feedback.ts（添加visitorId字段）、admin/server/src/routes/feedbacks.ts（状态更新时触发推送）、server/src/services/pushService.ts（新增反馈推送方法）

## ADDED Requirements

### Requirement: 反馈数据记录提交者标识
系统 SHALL 在反馈数据中记录提交者的 visitorId，用于关联推送目标。

#### Scenario: 用户提交反馈
- **WHEN** 用户通过反馈表单提交反馈
- **THEN** 反馈记录中包含 `visitorId` 字段（从请求头 `X-Visitor-Id` 获取）
- **AND** 如果用户未登录，visitorId 为 'anonymous'（不发送推送）

### Requirement: 反馈状态更新推送通知
系统 SHALL 在管理员更新反馈状态时，自动通过极光推送发送通知给反馈提交者。

#### Scenario: 管理员将反馈状态更新为"处理中"
- **WHEN** 管理员将反馈状态从 pending 更新为 processing
- **THEN** 系统向该反馈的提交者发送推送通知
- **AND** 通知标题为"反馈处理通知"
- **AND** 通知内容包含反馈标题和处理状态
- **AND** 如果提交者未注册设备（visitorId为anonymous或无设备），仅记录日志不发送推送

#### Scenario: 管理员将反馈状态更新为"已解决"
- **WHEN** 管理员将反馈状态更新为 resolved
- **THEN** 系统向提交者发送推送通知，内容包含解决确认信息

#### Scenario: 管理员将反馈状态更新为"已关闭"
- **WHEN** 管理员将反馈状态更新为 closed
- **THEN** 系统向提交者发送推送通知，内容包含关闭通知

### Requirement: 反馈推送消息存储
系统 SHALL 将反馈推送消息存储到 push_messages 集合，供用户在消息中心查看。

#### Scenario: 推送消息存储
- **WHEN** 反馈状态更新触发推送
- **THEN** 推送消息存储到 push_messages 集合
- **AND** 消息类型为 'feedback_notification'
- **AND** 用户可在消息中心查看反馈处理通知

## MODIFIED Requirements

### Requirement: 反馈数据字段扩展
反馈记录在原有字段基础上增加 `visitorId` 字段（string，从请求头获取）。
