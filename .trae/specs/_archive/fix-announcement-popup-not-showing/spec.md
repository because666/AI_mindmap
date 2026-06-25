# 修复公告弹窗不显示 Spec

## Why
主网站公告弹窗（BroadcastPopup）始终不显示，原因有三：1) 后端 `getMessageList` 返回的消息列表缺少 `displayType` 字段，前端过滤 `displayType === 'banner'` 永远匹配不到；2) 推送消息接口依赖 `X-Visitor-Id` 请求头，未登录用户无法获取广播消息；3) 公告弹窗与公告横幅使用不同的数据源（推送消息 vs 公告系统），用户期望的是后台管理设置的公告能在主网站以弹窗形式展示。

## What Changes
- 后端 `getMessageList` 返回的消息列表项新增 `displayType` 字段
- 修改 `BroadcastPopup` 组件的数据获取逻辑，改为从 `/api/announcements` 接口获取公告数据，与 `AnnouncementBanner` 使用相同数据源
- `BroadcastPopup` 根据 `AnnouncementData` 的 `type` 字段决定是否弹窗展示（所有公告类型均可弹窗展示）
- 移除 `BroadcastPopup` 对 `pushClientService.getBannerMessages()` 的依赖，改为直接 `fetch('/api/announcements')`

## Impact
- Affected specs: fix-core-features-and-persistence
- Affected code:
  - server/src/services/pushService.ts（getMessageList 返回 displayType）
  - client/src/components/Common/BroadcastPopup.tsx（改用 /api/announcements 数据源）
  - client/src/services/pushService.ts（getBannerMessages 方法保留但不再被 BroadcastPopup 使用）

## ADDED Requirements

### Requirement: 公告弹窗数据源统一
BroadcastPopup SHALL 从 `/api/announcements` 接口获取公告数据，与 AnnouncementBanner 使用相同数据源，确保后台管理设置的公告能在主网站以弹窗形式展示。

#### Scenario: 后台创建公告后主网站弹出弹窗
- **WHEN** 管理员在后台创建公告并选择"公告弹窗"展示形式
- **THEN** 主网站用户打开页面时看到公告弹窗
- **AND** 弹窗标题和内容与后台设置一致

#### Scenario: 用户关闭弹窗后不再重复弹出
- **WHEN** 用户关闭公告弹窗
- **THEN** 同一公告不再重复弹出
- **AND** 公告横幅也不再显示该公告

### Requirement: 推送消息列表包含 displayType
后端 `getMessageList` 返回的消息列表项 SHALL 包含 `displayType` 字段，确保消息中心能正确区分展示类型。

## MODIFIED Requirements

### Requirement: BroadcastPopup 数据获取方式
BroadcastPopup 不再依赖 pushClientService.getBannerMessages()，改为直接调用 /api/announcements 接口获取公告数据，以弹窗形式展示未关闭的公告。
