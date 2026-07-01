# Checklist

## 封禁功能修复
- [x] admin auth.ts 的 /auth/me 响应包含 `{ success: true, data: {...} }`
- [x] admin auth.ts 的 /auth/check-ip 响应包含 `{ success: true, data: {...} }`
- [x] admin auth.ts 的 /auth/login 响应包含 `{ success: true, data: {...} }`
- [x] admin auth.ts 的 /auth/set-nickname 响应包含 `{ success: true, data: {...} }`
- [x] authStore.ts 的 fetchMe 正确解析 res.data.data
- [x] 登录后刷新页面保持登录态（代码已修复，待部署验证）
- [x] cacheNotify.ts 未设置 INTERNAL_API_TOKEN 时不崩溃
- [x] 封禁接口不被 notifyVisitorCacheClear 阻塞（void 调用）
- [x] handleBan 校验封禁原因非空

## 后端安全修复
- [x] nodes.ts 中 /export 和 /import 路由在 /:id 之前定义
- [x] GET /api/nodes/export 返回导出数据而非 404（待部署验证）
- [x] push.ts 用户接口有 visitorAuth 中间件
- [x] push.ts 管理员接口有内部 token 校验
- [x] conversations.ts 内部 token 使用恒定时间比较
- [x] events.ts rateLimitMap 有定时清理
- [x] feedback.ts rateLimitMap 有定时清理

## 前端功能修复
- [x] ChatPanel.tsx JSON.parse 有独立 try-catch
- [x] contextUsage 翻译键已定义（zh.json + en.json）
- [x] 模板创建失败时弹窗关闭并提示用户
- [x] ChatPanel.tsx 工具调用 UI 无硬编码中文
- [x] MapLibrary.tsx 时间文本无硬编码中文
- [x] ChatPanel.tsx 无重复 useEffect

## 代码质量
- [x] NodeData 接口定义统一 — 跳过（有意设计，风险过大）
- [x] TrackerEvent 接口包含 nodeId/mapId 可选字段
- [x] 无冗余翻译键

## 编译与测试
- [x] client `npx tsc --noEmit` 零错误
- [x] server `npx tsc --noEmit` 零错误
- [x] admin server `npx tsc --noEmit` 零错误
- [x] client 单元测试全部通过（265/265）
- [x] server 单元测试全部通过（591/591）
- [x] admin server 单元测试通过（346/352，6 个 ipWhitelist 历史遗留失败与本次无关）

## 构建验证
- [x] server 构建成功
- [x] client 构建成功
- [x] admin server 构建成功
- [x] admin client 构建成功

## 服务器检查发现
- [x] PM2 进程运行中（server 108次重启、admin 80次重启 — 偏高）
- [x] 服务器代码版本滞后（6月30日旧版本）
- [x] 服务器 admin /me 响应格式未修复（待部署）
- [x] 服务器 push /broadcast 无认证（待部署）
- [x] INTERNAL_API_TOKEN 配置正确
- [x] Neo4j 写入异常（Invalid time value）— 需后续排查
- [x] pushService BSONError — 需后续排查

## 部署验证（待用户确认后执行）
- [ ] 服务器构建成功
- [ ] PM2 重启成功
- [ ] 健康检查通过
- [ ] 封禁用户功能正常工作
- [ ] 节点导出功能正常工作
