# Tasks

## 阶段一：工程化基础设施（E1-E3，后续阶段依赖）

- [ ] Task 1: E1 审计日志页面
  - [ ] SubTask 1.1: 新建 admin/server/src/services/auditLogService.ts，实现日志查询、筛选、统计、导出
  - [ ] SubTask 1.2: 新建 admin/server/src/routes/auditLogs.ts，注册 GET /api/admin/audit-logs 等端点
  - [ ] SubTask 1.3: 在 admin/server/src/index.ts 注册路由
  - [ ] SubTask 1.4: 新建 admin/client/src/pages/AuditLogs/AuditLogsPage.tsx，展示日志列表、筛选器、分页、导出按钮
  - [ ] SubTask 1.5: 在 AdminLayout 导航和 App.tsx 路由中添加入口
  - [ ] SubTask 1.6: 在 api.ts 中添加 auditLogsApi 方法

- [ ] Task 2: E2 导出中心升级
  - [ ] SubTask 2.1: 新建 admin/client/src/pages/ExportCenter/ExportCenterPage.tsx，展示任务列表、状态筛选、重试按钮、有效期倒计时
  - [ ] SubTask 2.2: 在 export.ts 路由中添加 GET /api/admin/export（列表）和 POST /:id/retry（重试）端点
  - [ ] SubTask 2.3: 在 AdminLayout 导航和 App.tsx 路由中添加入口
  - [ ] SubTask 2.4: 在 api.ts 中补充 exportCenterApi 方法

- [ ] Task 3: E3 多管理员与角色权限
  - [ ] SubTask 3.1: 扩展 admin/server/src/types/index.ts，新增 AdminAccount、AdminRole 类型定义
  - [ ] SubTask 3.2: 新建 admin/server/src/services/adminAccountService.ts，实现管理员 CRUD、角色分配、权限校验
  - [ ] SubTask 3.3: 新建 admin/server/src/routes/adminAccounts.ts，注册管理员管理端点
  - [ ] SubTask 3.4: 修改 admin/server/src/middleware/auth.ts，增加角色权限校验逻辑
  - [ ] SubTask 3.5: 新建 admin/client/src/pages/AdminAccounts/AdminAccountsPage.tsx，展示管理员列表、创建/编辑/删除/角色分配
  - [ ] SubTask 3.6: 在 AdminLayout 导航和 App.tsx 路由中添加入口
  - [ ] SubTask 3.7: 在 api.ts 中添加 adminAccountsApi 方法

## 阶段二：运营增长（C1-C4）

- [ ] Task 4: C1 用户分群与标签
  - [ ] SubTask 4.1: 扩展 types/index.ts，新增 UserTag、UserSegment 类型定义
  - [ ] SubTask 4.2: 新建 admin/server/src/services/userSegmentService.ts，实现标签 CRUD、自动分群规则执行、分群查询
  - [ ] SubTask 4.3: 新建 admin/server/src/routes/userSegments.ts，注册标签和分群端点
  - [ ] SubTask 4.4: 新建 admin/client/src/pages/UserSegments/UserSegmentsPage.tsx，展示标签管理、分群列表、规则配置
  - [ ] SubTask 4.5: 在用户详情页 UsersPage 中添加标签管理入口
  - [ ] SubTask 4.6: 在 AdminLayout 导航和 App.tsx 路由中添加入口
  - [ ] SubTask 4.7: 在 api.ts 中添加 userSegmentsApi 方法

- [ ] Task 5: C2 用户留存与转化漏斗
  - [ ] SubTask 5.1: 在 dashboardService.ts 中新增 getRetentionTrends 和 getConversionFunnel 方法
  - [ ] SubTask 5.2: 在 dashboard.ts 路由中新增 GET /api/dashboard/retention 和 GET /api/dashboard/funnel 端点
  - [ ] SubTask 5.3: 在 DashboardPage.tsx 中新增留存趋势图和转化漏斗图（使用 Recharts FunnelChart 或自定义）
  - [ ] SubTask 5.4: 在 api.ts 中补充 dashboardApi 方法

- [ ] Task 6: C3 工作区排行与价值分层
  - [ ] SubTask 6.1: 在 workspaces.ts 路由中新增 GET /api/admin/workspaces/ranking 端点
  - [ ] SubTask 6.2: 新增 PUT /api/admin/workspaces/:id/star 端点，支持特别关注标记
  - [ ] SubTask 6.3: 在 WorkspacesPage.tsx 中新增排行榜视图和特别关注开关
  - [ ] SubTask 6.4: 在 api.ts 中补充 workspacesApi 方法

- [ ] Task 7: C4 用户消息轨迹回放
  - [ ] SubTask 7.1: 在 users.ts 路由中新增 GET /api/admin/users/:id/timeline 端点
  - [ ] SubTask 7.2: 在 UsersPage 用户详情弹窗中新增"查看轨迹"标签页
  - [ ] SubTask 7.3: 实现时间线组件，展示节点创建/对话/结论/导出事件
  - [ ] SubTask 7.4: 在 api.ts 中补充 usersApi 方法

## 阶段三：运营触达（D1-D3）

- [ ] Task 8: D1 站内公告横幅
  - [ ] SubTask 8.1: 扩展 types/index.ts，新增 Announcement 类型定义
  - [ ] SubTask 8.2: 新建 admin/server/src/services/announcementService.ts，实现公告 CRUD、定时发布、目标分组过滤
  - [ ] SubTask 8.3: 新建 admin/server/src/routes/announcements.ts，注册公告管理端点
  - [ ] SubTask 8.4: 在主应用 server 端新增 GET /api/announcements 端点，供客户端读取当前生效公告
  - [ ] SubTask 8.5: 新建 admin/client/src/pages/Announcements/AnnouncementsPage.tsx，展示公告列表、创建/编辑/启用/禁用
  - [ ] SubTask 8.6: 在主应用客户端 App.tsx 中添加公告横幅组件
  - [ ] SubTask 8.7: 在 AdminLayout 导航和 App.tsx 路由中添加入口
  - [ ] SubTask 8.8: 在 api.ts 中添加 announcementsApi 方法

- [ ] Task 9: D2 功能开关与灰度
  - [ ] SubTask 9.1: 扩展 admin_configs.features 结构，新增 grayRules 字段
  - [ ] SubTask 9.2: 在 settings.ts 路由中扩展 PUT /api/admin/settings/features 端点，支持灰度规则配置
  - [ ] SubTask 9.3: 在主应用 server 端新增 GET /api/features 端点，根据请求者信息判断功能可见性
  - [ ] SubTask 9.4: 在 SettingsPage.tsx 中新增灰度规则配置面板
  - [ ] SubTask 9.5: 在主应用客户端添加功能开关读取与条件渲染逻辑

- [ ] Task 10: D3 反馈工单工作流
  - [ ] SubTask 10.1: 扩展 feedbacks 集合文档结构，新增 assignee、internalNotes、slaDeadline 字段
  - [ ] SubTask 10.2: 在 feedbacks.ts 路由中新增 PUT /:id/assign（分配）、POST /:id/notes（添加备注）端点
  - [ ] SubTask 10.3: 在 FeedbackPage.tsx 中新增工单分配下拉框、内部备注区域、SLA 倒计时显示
  - [ ] SubTask 10.4: 在 api.ts 中补充 feedbacksApi 方法

## 阶段四：全局搜索与快捷键（E4）

- [ ] Task 11: E4 全局搜索与快捷键
  - [ ] SubTask 11.1: 新建 admin/client/src/components/Common/GlobalSearch.tsx，实现 Ctrl+K 唤起搜索面板
  - [ ] SubTask 11.2: 搜索面板支持匹配页面名称、用户昵称、工作区名称
  - [ ] SubTask 11.3: 在 AdminLayout 中挂载 GlobalSearch 组件
  - [ ] SubTask 11.4: 在 admin/server/src/routes/ 中新增 GET /api/admin/search 端点，支持跨实体搜索

## 阶段五：构建验证与部署

- [ ] Task 12: 构建验证与部署
  - [ ] SubTask 12.1: admin/client 构建通过
  - [ ] SubTask 12.2: admin/server TypeScript 校验通过
  - [ ] SubTask 12.3: 上传到服务器并重启 PM2
  - [ ] SubTask 12.4: 线上手动验收所有新增页面功能

# Task Dependencies

- Task 1, 2 独立，可并行
- Task 3 依赖 Task 1（审计日志需要角色权限控制）
- Task 4 依赖 Task 3（分群功能需要角色权限控制）
- Task 5, 6, 7 依赖 Task 3，三者可并行
- Task 8 依赖 Task 3（公告需要角色权限控制）和 Task 4（目标分组依赖标签）
- Task 9 依赖 Task 3（灰度需要角色权限控制）
- Task 10 依赖 Task 3（工单分配依赖多管理员）
- Task 11 独立，可并行
- Task 12 依赖所有前置任务
