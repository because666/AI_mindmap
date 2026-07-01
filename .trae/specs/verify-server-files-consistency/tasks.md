# Tasks

- [x] Task 1: 本地重新构建所有产物
  - [x] SubTask 1.1: 构建主网站前端（client: `npm run build`）
  - [x] SubTask 1.2: 构建主网站后端（server: `npm run build`）
  - [x] SubTask 1.3: 构建后台前端（admin/client: `npm run build`）
  - [x] SubTask 1.4: 构建后台后端（admin/server: `npm run build`）

- [x] Task 2: 核查服务器文件结构
  - [x] SubTask 2.1: 检查主网站前端 — 无嵌套，index.html 存在（17 个文件）
  - [x] SubTask 2.2: 检查主网站后端 — 发现 dist/src/ 旧版本残留（已清除）
  - [x] SubTask 2.3: 检查后台前端 — 无嵌套，index.html 存在（3 个文件）
  - [x] SubTask 2.4: 检查后台后端 — 无嵌套，index.js 存在（180 个文件）

- [x] Task 3: 修复并重新部署全部 4 个部分
  - [x] SubTask 3.1: 全部重新部署（使用 --strip-components=1 避免嵌套）
  - [x] SubTask 3.2: 清除 dist/src/ 旧版本残留
  - [x] SubTask 3.3: 重启 PM2 服务（deepmindmap-server、deepmindmap-admin）

- [x] Task 4: 最终验证
  - [x] SubTask 4.1: 主网站 HTTP 200
  - [x] SubTask 4.2: 后台健康检查 200
  - [x] SubTask 4.3: PM2 所有服务 online

# Task Dependencies

- Task 2 依赖 Task 1（需要本地产物作为对比基准）
- Task 3 依赖 Task 2（根据核查结果修复）
- Task 4 依赖 Task 3
