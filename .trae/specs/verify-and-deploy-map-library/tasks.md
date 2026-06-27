# Tasks

> 对应 spec.md：核验并部署工作区地图库功能
> 范围：全面核验 workspace-map-library 功能，用户确认后部署

---

- [x] Task 1: TypeScript 编译验证
  - [x] SubTask 1.1: client 目录执行 `npx tsc --noEmit`，确认零错误
  - [x] SubTask 1.2: server 目录执行 `npx tsc --noEmit`，确认零错误

- [x] Task 2: 单元测试回归
  - [x] SubTask 2.1: client 目录执行 `npm run test`，确认全部通过（207/207）
  - [x] SubTask 2.2: server 目录执行 `npm run test`，确认全部通过（526/526）

- [x] Task 3: 代码质量检查
  - [x] SubTask 3.1: 检查新增文件 MapLibrary.tsx 无 any 类型
  - [x] SubTask 3.2: 检查新增文件无硬编码敏感信息（API Key、密码等）
  - [x] SubTask 3.3: client 目录执行 ESLint 检查（修复 set-state-in-effect 后通过）

- [x] Task 4: 功能逻辑核验
  - [x] SubTask 4.1: 核验后端 `/mine/metadata` 路由在 `/mine` 之前定义（Express 路由顺序）
  - [x] SubTask 4.2: 核验 nodeService.getNodeCount 方法的缓存优先逻辑
  - [x] SubTask 4.3: 核验 i18n 翻译键 zh.json 和 en.json 一致性（10 个键完全一致）
  - [x] SubTask 4.4: 核验 tracker.ts 埋点常量与 MapLibrary.tsx 中使用的一致性
  - [x] SubTask 4.5: 核验 MainLayout.tsx 中 MapLibrary 的 import 路径正确
  - [x] SubTask 4.6: 核验 visitorWorkspaceStore 中 workspaceMetadata 类型定义完整

- [x] Task 5: 部署准备
  - [x] SubTask 5.1: 更新 deploy_server.py 文件列表，新增 MapLibrary.tsx 等 6 个文件
  - [x] SubTask 5.2: 确认所有新增文件路径正确

- [ ] Task 6: 部署（**仅在用户确认 Task 1-5 全部无问题后执行**）
  - [ ] SubTask 6.1: 执行 deploy_server.py 部署到生产服务器
  - [ ] SubTask 6.2: 验证服务器构建成功
  - [ ] SubTask 6.3: 验证 PM2 重启成功
  - [ ] SubTask 6.4: 验证健康检查接口返回 200

---

# Task Dependencies

- Task 1-4 可并行执行（无相互依赖）
- Task 5 依赖 Task 1-4 全部通过
- Task 6 依赖 Task 5 完成 + **用户确认**
