# Tasks

- [x] Task 1: 调整 MainLayout 面板渲染顺序并添加 flex-shrink-0
  - [x] 1.1 在 MainLayout.tsx 中，将 ChatPanel 容器移到 HistoryPanel 和 MessageCenter 之后渲染
  - [x] 1.2 为 ChatPanel 容器添加 `shrink-0`
  - [x] 1.3 为 HistoryPanel 容器添加 `shrink-0`
  - [x] 1.4 为 MessageCenter 容器添加 `shrink-0`

- [x] Task 2: 修复用户消息右对齐
  - [x] 2.1 在 ChatPanel.tsx，将 `flex-row-reverse justify-end` 改为 `flex-row-reverse justify-start`

- [x] Task 3: 修复 chatService 请求头缺少 X-Workspace-Id
  - [x] 3.1 在 chatService.ts 中添加 `getLocalWorkspaceId` 函数
  - [x] 3.2 在 `buildHeaders` 中添加 `X-Workspace-Id` 请求头

- [x] Task 4: 编译验证与部署
  - [x] 4.1 客户端 TypeScript 编译通过
  - [x] 4.2 客户端构建成功
  - [x] 4.3 上传构建产物到服务器
  - [x] 4.4 重启 PM2 服务并验证

# Task Dependencies

- Task 1、2、3 相互独立，可并行修改
- Task 4 依赖 Task 1、2、3 全部完成
