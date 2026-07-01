# Checklist

## 工作区置顶失败修复

- [x] `admin/server/src/routes/auth.ts` 的 `real-login` 接口在 `insertOne('admin_sessions', {...})` 中已写入 `role: 'super_admin'`
- [x] `admin/server/src/test/auth.route.test.ts` 的"正确密码登录成功"用例已验证 session 包含 `role: 'super_admin'`
- [x] auth 路由单元测试全部通过

## 工作区封禁后端接口

- [x] `POST /:id/ban` 接口已实现，使用 `requireRole('super_admin', 'operator')` 权限控制
- [x] `POST /:id/ban` 接口写入 `isBanned/banReason/bannedAt/banExpiresAt` 字段
- [x] `POST /:id/ban` 接口触发 `notifyWorkspaceCacheClear`
- [x] `POST /:id/ban` 接口缺少 reason 时返回 400
- [x] `POST /:id/ban` 接口工作区不存在时返回 404
- [x] `POST /:id/unban` 接口已实现，清除封禁字段并触发缓存清除
- [x] `GET /` 工作区列表返回项包含 `isBanned/banReason/banExpiresAt` 字段
- [x] `workspaces.route.test.ts` 新增 ban/unban 测试用例覆盖正常/异常/边界情况

## 工作区封禁前端 UI

- [x] `WorkspaceListItem` 类型新增 `isBanned/banReason/banExpiresAt` 字段
- [x] `workspacesApi` 新增 `banWorkspace` 和 `unbanWorkspace` 方法
- [x] `WorkspacesPage.tsx` 新增封禁/解封按钮，与置顶/关闭按钮并列
- [x] `WorkspacesPage.tsx` 新增封禁弹窗，包含原因输入与有效期下拉
- [x] `WorkspacesPage.tsx` 已封禁工作区显示红色"封禁"徽章
- [x] 封禁/解封操作有加载态与错误提示

## 主服务端封禁访问拦截

- [x] `server/src/middleware/index.ts` 工作区访问中间件新增 `isBanned` 检查
- [x] 封禁工作区返回 403 + `code: 'WORKSPACE_BANNED'` + 封禁原因
- [x] `banExpiresAt` 过期时自动放行

## 构建与测试验证

- [x] admin server `npm run build` 通过，无 TypeScript 错误
- [x] admin server `npm test` 通过，所有单元测试通过
- [x] admin client `npm run build` 通过，无 TypeScript 错误
- [x] 主 server `npm run build` 通过，无 TypeScript 错误
