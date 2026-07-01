# Checklist

## 用户分群规则字段修复

- [ ] `SegmentRuleField` 类型已更新为 `'lastActiveAt' | 'createdAt' | 'workspaceCount'`（前后端同步）
- [ ] `buildSegmentFilter` 的 `lastActiveAt` 映射 `lastSeen` 字段
- [ ] `buildSegmentFilter` 的 `createdAt` 映射 `createdAt` 字段
- [ ] `buildSegmentFilter` 的 `workspaceCount` 使用 `$expr` + `$size: '$workspaces'` 查询
- [ ] 前端 `FIELD_LABELS` 已更新为新的字段标签
- [ ] 前端 `parseRuleValue` 已更新，`workspaceCount` 转数字、日期字段保留字符串

## 标签管理实用化

- [ ] UsersPage 新增标签下拉筛选器，选择标签后仅显示拥有该标签的用户
- [ ] UsersPage 支持清除标签筛选恢复全部用户
- [ ] 用户详情弹窗新增标签管理区域，展示用户已有标签
- [ ] 用户详情弹窗支持添加标签（调用 addTagToUser）
- [ ] 用户详情弹窗支持移除标签（调用 removeTagFromUser）

## 工作区查看详情弹窗

- [ ] `workspacesApi.getDetail` 方法存在（GET /admin/workspaces/:id）
- [ ] WorkspacesPage 查看按钮已绑定 onClick
- [ ] 点击查看按钮弹出详情弹窗，调用接口获取数据
- [ ] 详情弹窗展示名称、描述、类型、创建时间、更新时间、成员数、节点数
- [ ] 详情弹窗有加载态和关闭按钮

## 移除 AI 服务商管理

- [ ] SettingsPage 的 tabItems 不再包含 `aiProviders` 选项
- [ ] SettingsPage 移除 `AIProviderEditModal` 组件及相关状态和函数
- [ ] SettingsPage 的 `activeTab` 类型移除 `'aiProviders'`
- [ ] 后端 `/ai-providers` 路由保留（不破坏 API 兼容性）

## 构建与测试验证

- [ ] admin server `npx tsc --noEmit` 通过
- [ ] admin server `npx vitest run` 通过（预存在的 ipWhitelist 失败可忽略）
- [ ] admin client `npm run build` 通过
- [ ] 主 server `npx tsc --noEmit` 通过

## 部署到服务器

- [ ] 本地构建产物完成
- [ ] 服务器备份旧产物完成并验证
- [ ] 上传新产物完成
- [ ] PM2 重启成功
- [ ] 健康检查通过（管理后台可访问、置顶接口返回 200）
