# Tasks

- [x] Task 1: 修复 tracker.ts 事件结构扁平化
  - [x] SubTask 1.1: 修改 `buildTrackerEvent` 方法，将 `commonProps` 内的字段提升到顶层
  - [x] SubTask 1.2: 调整 `TrackerEvent` 接口为扁平结构
  - [x] SubTask 1.3: `handleBeforeUnload` 的 sendBeacon 路径自动使用扁平结构（通过 buildTrackerEvent 调用）
  - [x] SubTask 1.4: 同步更新 tracker.test.ts 测试断言

- [x] Task 2: 验证并部署
  - [x] SubTask 2.1: `npx tsc -b` 无错误（client 目录）
  - [x] SubTask 2.2: `npm run build` 构建成功（client 目录）
  - [x] SubTask 2.3: 单元测试 9 个全部通过
  - [x] SubTask 2.4: 部署到服务器 `/www/wwwroot/AI_mindmap/client/dist/`
  - [x] SubTask 2.5: 验证服务器 HTTP 200

# Task Dependencies

- Task 2 依赖 Task 1
