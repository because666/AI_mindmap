# 修复埋点事件结构不匹配导致数据无法上报 Spec

## Why

客户端 `tracker.ts` 上报的事件结构（嵌套 `commonProps`）与服务端 `events.ts` 期望的结构（扁平字段）不匹配，导致所有埋点事件被服务端以 400 拒绝，后台数据大盘的"用户行为事件"区域始终无数据。

## What Changes

- 修改 `client/src/services/tracker.ts` 的 `buildTrackerEvent` 方法，将事件结构从嵌套改为扁平，与服务端 `events.ts` 的 `AnalyticsEvent` 接口对齐
- 扁平化后 `TrackerEvent` 接口和 `TrackerEventCommonProps` 接口同步调整
- `handleBeforeUnload` 中 `sendBeacon` 路径使用相同扁平结构

## Impact

- Affected specs: fix-events-route-and-map-library（事件路由相关）
- Affected code:
  - `client/src/services/tracker.ts`（核心修复）

## ADDED Requirements

### Requirement: 埋点事件结构与服务端对齐

客户端 SHALL 以扁平结构上报埋点事件，字段包括：`eventType`、`visitorId`、`workspaceId`、`timestamp`（毫秒时间戳）、`url`、`userAgent`、`payload`，与服务端 `events.ts` 的 `validateEvent` 校验逻辑完全匹配。

#### Scenario: 客户端上报事件成功入库

- **WHEN** 用户在主网站触发埋点事件（如创建节点、使用模板）
- **THEN** 事件通过批量上报接口 `POST /api/events` 发送
- **AND** 服务端校验通过，返回 `{ success: true }`
- **AND** 事件写入 MongoDB `events` 集合

#### Scenario: 后台数据大盘显示埋点数据

- **WHEN** 管理员打开后台数据大盘页面
- **THEN** "用户行为事件"区域显示总事件数、今日事件数、独立访客数
- **AND** 事件趋势图显示近 7 天的每日事件量
- **AND** 关键事件漏斗显示转化率
- **AND** 最近事件流表格显示最新事件记录

## MODIFIED Requirements

### Requirement: Tracker 事件构建

原 `buildTrackerEvent` 返回 `{ eventType, commonProps: { visitorId, workspaceId, timestamp, url, userAgent }, payload }`。
修改为返回扁平结构 `{ eventType, visitorId, workspaceId, timestamp, url, userAgent, payload }`，直接匹配服务端期望。
