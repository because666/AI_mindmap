# Checklist

## 用户分群规则字段修复

- [x] `SegmentRuleField` 类型已更新为 `'lastActiveAt' | 'createdAt' | 'workspaceCount'`（前后端同步）
- [x] `buildSegmentFilter` 的 `lastActiveAt` 映射 `lastSeen` 字段
- [x] `buildSegmentFilter` 的 `createdAt` 映射 `createdAt` 字段
- [x] `buildSegmentFilter` 的 `workspaceCount` 使用 `$expr` + `$size: '$workspaces'` 查询
- [x] 前端 `FIELD_LABELS` 已更新为新的字段标签
- [x] 前端 `parseRuleValue` 已更新，`workspaceCount` 转数字、日期字段保留字符串

## 标签管理实用化

- [x] UsersPage 新增标签下拉筛选器，选择标签后仅显示拥有该标签的用户
- [x] UsersPage 支持清除标签筛选恢复全部用户
- [x] 用户详情弹窗新增标签管理区域，展示用户已有标签
- [x] 用户详情弹窗支持添加标签（调用 addTagToUser）
- [x] 用户详情弹窗支持移除标签（调用 removeTagFromUser）

## 工作区查看详情弹窗

- [x] `workspacesApi.getDetail` 方法存在（GET /admin/workspaces/:id）
- [x] WorkspacesPage 查看按钮已绑定 onClick
- [x] 点击查看按钮弹出详情弹窗，调用接口获取数据
- [x] 详情弹窗展示名称、描述、类型、创建时间、更新时间、成员数、节点数
- [x] 详情弹窗有加载态和关闭按钮

## 移除 AI 服务商管理

- [x] SettingsPage 的 tabItems 不再包含 `aiProviders` 选项
- [x] SettingsPage 移除 `AIProviderEditModal` 组件及相关状态和函数
- [x] SettingsPage 的 `activeTab` 类型移除 `'aiProviders'`
- [x] 后端 `/ai-providers` 路由保留（不破坏 API 兼容性）

## 构建与测试验证

- [x] admin server `npx tsc --noEmit` 通过
- [x] admin server `npx vitest run` 通过（66/66 测试通过）
- [x] admin client `npm run build` 通过
- [x] 主 server `npx tsc --noEmit` 通过

## 部署到服务器

- [x] 本地构建产物完成
- [x] 服务器备份旧产物完成并验证（4 个 dist 目录备份验证通过）
- [x] 上传新产物完成
- [x] PM2 重启成功（deepmindmap-server + deepmindmap-admin 均 online）
- [x] 健康检查通过（主服务 HTTP 200、Admin 服务 HTTP 200）
