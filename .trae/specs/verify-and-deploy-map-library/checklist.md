# Checklist

## TypeScript 编译
- [x] client `npx tsc --noEmit` 零错误
- [x] server `npx tsc --noEmit` 零错误

## 单元测试
- [x] client 所有测试通过（207/207）
- [x] server 所有测试通过（526/526）

## 代码质量
- [x] MapLibrary.tsx 无 any 类型
- [x] 新增文件无硬编码敏感信息
- [x] client ESLint 无 error（修复 set-state-in-effect 后通过）

## 功能逻辑
- [x] `/mine/metadata` 路由在 `/mine` 之前定义
- [x] `getNodeCount` 方法缓存优先逻辑正确
- [x] zh.json 和 en.json 翻译键一致（10 个键）
- [x] tracker.ts 埋点常量与 MapLibrary.tsx 使用一致
- [x] MainLayout.tsx MapLibrary import 路径正确
- [x] visitorWorkspaceStore workspaceMetadata 类型完整

## 部署准备
- [x] deploy_server.py 文件列表已更新（新增 6 个文件）

## 部署验证（用户确认后执行）
- [x] 服务器构建成功（server tsc + client vite build 均 exit 0）
- [x] PM2 重启成功（deepmindmap-server + deepmindmap-admin 均 online）
- [x] 健康检查 3001/health 返回 200，3002/api/health 返回 200
