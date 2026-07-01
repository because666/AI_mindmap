# Tasks

- [x] Task 1: 修复后台对话审计路由从独立 messages 集合查询消息
  - [x] SubTask 1.1: 修改 `GET /conversations` 列表接口，通过 `messages` 集合聚合统计每条对话的消息数和最后消息预览
  - [x] SubTask 1.2: 修改 `GET /conversations/:id` 详情接口，从 `messages` 集合按 `conversationId` 查询消息列表
  - [x] SubTask 1.3: 修改 `POST /scan` 扫描接口，从 `messages` 集合查询 `role='user'` 的消息
  - [x] SubTask 1.4: 修改 DELETE 接口为 `DELETE /messages/:messageId`，从 `messages` 集合按消息 ID 删除

- [x] Task 2: 降低仪表盘趋势数据缓存 TTL
  - [x] SubTask 2.1: 将 `CACHE_TTL_MS` 从 `5 * 60 * 1000` 改为 `60 * 1000`
  - [x] SubTask 2.2: 将 `CACHE_TTL_SECONDS` 从 `300` 改为 `60`

- [x] Task 3: 构建并部署后台服务
  - [x] SubTask 3.1: `npx tsc -b` 无错误（admin/server 目录）
  - [x] SubTask 3.2: 后台服务构建成功（admin/server + admin/client）
  - [x] SubTask 3.3: 部署到服务器并重启 PM2 `deepmindmap-admin` 进程
  - [x] SubTask 3.4: 验证后台服务端口 3002 正常运行，MongoDB 已连接 messages 集合

# Task Dependencies

- Task 2 与 Task 1 无依赖，可并行
- Task 3 依赖 Task 1 和 Task 2
