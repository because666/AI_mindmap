# Tasks

- [x] Task 1: 修复"全部已读"后红点不消失问题
  - [x] 修改 `UnreadBadge.tsx`：增加 `externalUnreadCount` 可选 prop，当外部传入时优先使用
  - [x] 修改 `MainLayout.tsx`：添加 `unreadCount` 状态，传递给 UnreadBadge 和 MessageCenter
  - [x] 修改 `MessageCenter.tsx`：增加 `onUnreadCountChange` 可选 prop，透传给 MessageList
  - [x] 修改 `MessageList.tsx`：`handleMarkAllRead` 成功后通过 `onUnreadCountChange(0)` 通知父组件
  - [x] 确保 MainLayout 中的 unreadCount 状态同步到桌面端和移动端的 UnreadBadge

- [x] Task 2: 桌面端侧边栏消息按钮替换为 UnreadBadge
  - [x] 修改 `MainLayout.tsx` 第599-614行：将裸 Bell 按钮替换为 UnreadBadge 组件
  - [x] 保持与现有侧边栏按钮样式一致（深色主题、hover效果等）
  - [x] UnreadBadge 的 onClick 触发 `setIsMessageCenterOpen`

- [x] Task 3: 缩短新消息检测轮询间隔
  - [x] 修改 `UnreadBadge.tsx`：将轮询间隔从 30000ms 缩短到 10000ms
  - [x] 移除 `MessageList.tsx` 中的重复轮询（第45-54行），避免冗余请求

- [x] Task 4: 构建验证
  - [x] 主前端 `npm run build` 无错误