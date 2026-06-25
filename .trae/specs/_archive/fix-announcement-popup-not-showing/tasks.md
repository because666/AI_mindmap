# Tasks

- [x] Task 1: 后端 getMessageList 返回 displayType 字段
  - [x] SubTask 1.1: 在 pushService.ts getMessageList 的 messageList map 中添加 displayType 字段

- [x] Task 2: 重写 BroadcastPopup 使用 /api/announcements 数据源
  - [x] SubTask 2.1: 修改 BroadcastPopup.tsx，移除 pushClientService 依赖，改用 fetch('/api/announcements') 获取公告数据
  - [x] SubTask 2.2: 使用与 AnnouncementBanner 相同的 AnnouncementData 接口和 localStorage 去重机制（key: 'announcement_closed_'）
  - [x] SubTask 2.3: 弹窗展示所有未关闭的公告（逐条展示），关闭后标记 localStorage

- [x] Task 3: 构建验证与部署
  - [x] SubTask 3.1: server + client 构建通过
  - [x] SubTask 3.2: 上传到服务器并重启 PM2
  - [x] SubTask 3.3: 验证后台创建公告后主网站弹出弹窗

# Task Dependencies
- Task 2 依赖 Task 1（先确保后端数据完整）
- Task 3 依赖 Task 1、2
