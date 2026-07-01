# Tasks

> 全面核查与问题修复

---

- [x] Task 1: 修复 Admin 认证响应格式（P0，封禁功能核心问题）
  - [x] SubTask 1.1: 统一 `admin/server/src/routes/auth.ts` 的 `/auth/me`、`/auth/check-ip`、`/auth/login`、`/auth/set-nickname` 响应格式为 `{ success: true, data: {...} }`
  - [x] SubTask 1.2: 确认 `admin/client/src/stores/authStore.ts` 的 `fetchMe`、`checkSystemStatus`、`login` 正确解析 `res.data.data`
  - [x] SubTask 1.3: 验证登录后刷新页面保持登录态

- [x] Task 2: 修复 cacheNotify.ts 模块加载硬抛错（P0）
  - [x] SubTask 2.1: 将 `cacheNotify.ts` 中的 `INTERNAL_API_TOKEN` 校验从模块加载时改为延迟到调用时
  - [x] SubTask 2.2: 确保未设置 token 时 admin 服务仍能启动

- [x] Task 3: 优化封禁接口不被阻塞（P0）
  - [x] SubTask 3.1: `admin/server/src/routes/users.ts` `await notifyVisitorCacheClear(id)` 改为 `void notifyVisitorCacheClear(id)`
  - [x] SubTask 3.2: 同样修复解封接口和 IP 封禁接口中的 `notifyVisitorCacheClear` 调用
  - [x] SubTask 3.3: 前端 `UsersPage.tsx` handleBan 增加封禁原因非空校验

- [x] Task 4: 修复 nodes.ts 路由顺序 bug（P0）
  - [x] SubTask 4.1: 将 `/export` 和 `/import` 路由移到 `/:id` 之前
  - [x] SubTask 4.2: 验证 `GET /api/nodes/export` 不再返回 404

- [x] Task 5: 修复 push.ts 无认证中间件（P0）
  - [x] SubTask 5.1: 为用户接口添加 `visitorAuth` 中间件
  - [x] SubTask 5.2: 为管理员接口添加内部 token 校验
  - [x] SubTask 5.3: 验证未认证请求返回 403

- [x] Task 6: 修复 conversations.ts 时序攻击漏洞（P0）
  - [x] SubTask 6.1: 将 `!==` 比较改为使用 `crypto.timingSafeEqual`
  - [x] SubTask 6.2: 检查其他路由文件是否有相同的时序攻击问题

- [x] Task 7: 修复 IP 限流 Map 内存泄漏（P1）
  - [x] SubTask 7.1: 为 `events.ts` 的 `rateLimitMap` 添加定时清理
  - [x] SubTask 7.2: 为 `feedback.ts` 的 `rateLimitMap` 添加同样的定时清理

- [x] Task 8: 修复前端功能问题（P1）
  - [x] SubTask 8.1: `ChatPanel.tsx` JSON.parse 添加独立 try-catch
  - [x] SubTask 8.2: 添加 `contextUsage` 翻译键
  - [x] SubTask 8.3: `TemplateLibrary.tsx` 模板创建失败时提示用户并关闭弹窗
  - [x] SubTask 8.4: 修复 `ChatPanel.tsx` 中工具调用 UI 的硬编码中文
  - [x] SubTask 8.5: 修复 `MapLibrary.tsx` 中时间文本和新地图名称的硬编码中文
  - [x] SubTask 8.6: 删除 `ChatPanel.tsx` 重复的 useEffect

- [x] Task 9: 代码质量改进（P2）
  - [x] SubTask 9.1: 统一 `NodeData` 接口定义 — 跳过（有意设计，强行统一风险过大）
  - [x] SubTask 9.2: 补充 `tracker.ts` 的 `TrackerEvent` 接口 `nodeId`/`mapId` 可选字段
  - [x] SubTask 9.3: 清理 `locales/` 中未使用的翻译键

- [ ] Task 10: 部署验证
  - [ ] SubTask 10.1: 运行 `npx tsc --noEmit` 验证所有项目编译通过
  - [ ] SubTask 10.2: 运行单元测试验证无回归
  - [ ] SubTask 10.3: 更新 `deploy_server.py` 文件列表（如需要）
  - [ ] SubTask 10.4: 部署到服务器并验证封禁功能正常
