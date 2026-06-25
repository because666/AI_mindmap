# Tasks

- [x] Task 1: 修复 Neo4j 节点创建 Map 类型属性错误
  - [x] SubTask 1.1: 定位 nodeService.ts createNode 方法中传入 Map/嵌套对象的位置
  - [x] SubTask 1.2: 将嵌套对象/Map 展开为基本类型属性或 JSON 字符串
  - [x] SubTask 1.3: 同样检查 updateNode 方法是否有类似问题

- [x] Task 2: 节点数据 MongoDB 同步写入
  - [x] SubTask 2.1: 在 nodeService.ts 的 createNode 成功后，将节点元数据（id, workspaceId, title, type, createdBy, createdAt）写入 MongoDB nodes 集合
  - [x] SubTask 2.2: 在 updateNode 成功后，同步更新 MongoDB nodes 集合
  - [x] SubTask 2.3: 在 deleteNode 成功后，同步删除 MongoDB nodes 集合对应记录
  - [x] SubTask 2.4: 添加启动时从 Neo4j 全量同步节点元数据到 MongoDB 的逻辑（一次性迁移）

- [x] Task 3: 挂载公告横幅到主应用
  - [x] SubTask 3.1: 在 client/src/App.tsx 中引入并挂载 AnnouncementBanner 组件
  - [x] SubTask 3.2: 验证公告在主应用页面顶部正确显示

- [x] Task 4: 修复用户分群标签 CRUD
  - [x] SubTask 4.1: 在 adminDB（database.ts）中添加 updateMany 方法
  - [x] SubTask 4.2: 修复 userSegmentService.ts 中 deleteTag 使用 updateMany 替代 updateOne
  - [x] SubTask 4.3: 添加 PUT /tags/:id 更新标签端点
  - [x] SubTask 4.4: 添加 PUT /segments/:id 更新分群端点
  - [x] SubTask 4.5: 在 UserSegmentsPage.tsx 中添加编辑标签和编辑分群功能

- [x] Task 5: 修复推送消息 BSON 错误
  - [x] SubTask 5.1: 在 pushService.ts getMessageDetail 中添加 ObjectId 格式校验
  - [x] SubTask 5.2: 非法 ObjectId 返回错误而非抛出异常

- [x] Task 6: 广播展示形式选择与工作区广播
  - [x] SubTask 6.1: 扩展推送消息数据结构，新增 displayType 字段（'banner'|'dot'）
  - [x] SubTask 6.2: 在 admin 推送页面添加展示形式选择（公告弹窗/小红点提醒）
  - [x] SubTask 6.3: 主应用客户端根据 displayType 决定展示方式
  - [x] SubTask 6.4: 新增工作区创建者向成员发送广播的端点 POST /api/workspaces/:id/broadcast
  - [x] SubTask 6.5: 在工作区设置面板中添加"发送广播"入口

- [x] Task 7: 多 AI 服务商适配框架
  - [x] SubTask 7.1: 扩展 server/src/config/index.ts，新增 AI_PROVIDERS 配置（支持多个 URL+Key+Model 组合）
  - [x] SubTask 7.2: 修改 aiService.ts，支持按 provider 配置路由 AI 请求
  - [x] SubTask 7.3: 在 admin 后台设置页面添加 AI 服务商配置面板
  - [x] SubTask 7.4: 保留现有智谱 API 作为默认 provider，确保向后兼容

- [x] Task 8: 构建验证与部署
  - [x] SubTask 8.1: server + client + admin/server + admin/client 构建通过
  - [x] SubTask 8.2: 上传到服务器并重启 PM2
  - [x] SubTask 8.3: 验证节点创建不再报 Neo4j 错误
  - [x] SubTask 8.4: 验证工作区排行节点数不再为0
  - [x] SubTask 8.5: 验证公告横幅在主应用显示
  - [x] SubTask 8.6: 验证用户分群标签 CRUD 正常

# Task Dependencies
- Task 2 依赖 Task 1（先修复 Neo4j 创建，再同步数据）
- Task 6 依赖 Task 3（公告横幅挂载后才能展示 banner 类型广播）
- Task 8 依赖所有前置任务
- Task 3、4、5、7 可并行
