# 修复消息已读状态与新增消息提醒 Spec

## Why
消息推送存在两个体验问题：(1) "全部已读"操作后，UnreadBadge 组件的轮询未及时同步，导致重新打开消息面板时红点仍然显示；(2) 桌面端侧边栏消息按钮使用裸 Bell 图标而非 UnreadBadge，用户无法看到未读提醒，且收到新消息时无弹窗提示。

## What Changes
- 修复"全部已读"后红点不消失：MessageList 的 `onUnreadCountChange` 回调未传递到 UnreadBadge，需建立状态同步机制
- 桌面端侧边栏消息按钮替换为 UnreadBadge 组件，显示红点/未读数
- 新消息到达时缩短轮询间隔或增加即时刷新机制

## Impact
- Affected code:
  - `client/src/components/MessageCenter/UnreadBadge.tsx` — 增加外部控制未读数的能力
  - `client/src/components/MessageCenter/MessageList.tsx` — 已读操作后通知外部
  - `client/src/components/Layout/MainLayout.tsx` — 桌面端侧边栏使用 UnreadBadge

## ADDED Requirements

### Requirement: "全部已读"后红点立即消失
系统SHALL在用户点击"全部已读"后，立即同步更新所有未读状态显示组件（包括 UnreadBadge 红点），无需等待下一次轮询。

#### Scenario: 点击全部已读后红点消失
- **WHEN** 用户在消息面板点击"全部已读"按钮
- **THEN** 侧边栏消息按钮上的红点/未读数立即消失，无需等待30秒轮询

#### Scenario: 关闭消息面板后红点不再出现
- **WHEN** 用户点击"全部已读"后关闭消息面板，再重新打开
- **THEN** 红点不再显示（除非有新消息到达）

### Requirement: 桌面端侧边栏消息按钮显示未读红点
系统SHALL在桌面端侧边栏的消息按钮上显示未读消息红点/数字，与移动端行为一致。

#### Scenario: 有未读消息时显示红点
- **WHEN** 存在未读消息
- **THEN** 桌面端侧边栏消息按钮右上角显示红色数字徽章

#### Scenario: 无未读消息时无红点
- **WHEN** 所有消息已读
- **THEN** 桌面端侧边栏消息按钮无红点

### Requirement: 新消息到达时及时提醒
系统SHALL在有新消息到达时，确保侧边栏消息按钮的红点在合理时间内（≤10秒）更新显示。

#### Scenario: 轮询检测到新消息
- **WHEN** 轮询检测到新的未读消息
- **THEN** 侧边栏消息按钮红点/数字在10秒内更新

## MODIFIED Requirements

### Requirement: UnreadBadge 组件支持外部控制未读数
原需求：UnreadBadge 仅通过内部轮询获取未读数
新需求：UnreadBadge 支持通过 props 接收外部未读数更新，实现与 MessageList 的状态同步