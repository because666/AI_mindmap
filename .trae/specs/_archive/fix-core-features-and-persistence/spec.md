# 修复核心功能与数据持久化 Spec

## Why
后台管理多个功能存在数据不可用问题：公告设置后主网站收不到、工作区排行节点数全为0、用户分群标签数据无法同步、数据在服务重启后丢失。根因包括：Neo4j 节点创建失败（Map 类型属性不支持）、Admin 端查询 MongoDB nodes 集合但节点实际存储在 Neo4j、公告横幅组件未挂载到主应用、用户分群缺少更新端点且 deleteTag 使用 updateOne 导致标签引用残留。

## What Changes
- 修复 Neo4j createNode 中 Map 类型属性导致的节点创建失败
- 在主应用 nodeService 中增加节点元数据同步写入 MongoDB nodes 集合
- 修复 Admin 端工作区排行/统计查询，从 MongoDB nodes 集合获取正确数据
- 将公告横幅组件挂载到主应用 App.tsx
- 修复用户分群：添加标签/分群更新端点，deleteTag 改用 updateMany
- 修复推送消息 BSON 错误（ObjectId 校验）
- 合并公告与推送功能边界，新增工作区广播和展示形式选择

## Impact
- Affected specs: enhance-admin-cde, fix-core-data-persistence, add-feedback-push-notification
- Affected code:
  - server/src/services/nodeService.ts（Neo4j 属性修复 + MongoDB 同步写入）
  - server/src/App.tsx 或 client/src/App.tsx（公告横幅挂载）
  - admin/server/src/routes/userSegments.ts（更新端点 + deleteTag 修复）
  - admin/server/src/config/database.ts（添加 updateMany 方法）
  - admin/server/src/routes/workspaces.ts（排行数据源修复）
  - server/src/services/pushService.ts（ObjectId 校验）

## ADDED Requirements

### Requirement: 节点数据 MongoDB 同步
主应用 nodeService SHALL 在 Neo4j 操作成功后，将节点元数据同步写入 MongoDB nodes 集合，确保 Admin 后台可查询节点统计。

#### Scenario: 创建节点后 MongoDB 同步
- **WHEN** 用户创建新节点
- **THEN** 节点数据同时写入 Neo4j 和 MongoDB nodes 集合
- **AND** Admin 后台工作区排行能正确显示节点数量

#### Scenario: 删除节点后 MongoDB 同步
- **WHEN** 用户删除节点
- **THEN** MongoDB nodes 集合中对应记录同步删除

### Requirement: 工作区广播
工作区创建者 SHALL 能向工作区成员发送广播消息。

#### Scenario: 工作区创建者发送广播
- **WHEN** 工作区创建者在工作区设置中发送广播
- **THEN** 所有工作区成员收到推送通知
- **AND** 广播消息关联到工作区

### Requirement: 广播展示形式选择
管理员发送广播时 SHALL 能选择展示形式。

#### Scenario: 选择公告弹窗形式
- **WHEN** 管理员选择"公告弹窗"展示形式
- **THEN** 用户打开网站时看到弹窗公告
- **AND** 用户关闭后不再重复弹出

#### Scenario: 选择小红点提醒形式
- **WHEN** 管理员选择"小红点提醒"展示形式
- **THEN** 用户看到推送图标上的小红点
- **AND** 不弹出公告窗口

### Requirement: 多 AI 服务商适配
系统 SHALL 支持配置多个 AI 服务商中转站 URL 和密钥。

#### Scenario: 配置新 AI 服务商
- **WHEN** 管理员在后台添加新的 AI 服务商配置（URL + 密钥 + 模型名）
- **THEN** 系统在 AI 请求时支持按配置路由到不同服务商
- **AND** 原有智谱 API 不受影响

## MODIFIED Requirements

### Requirement: Neo4j 节点属性
nodeService.createNode SHALL 确保所有写入 Neo4j 的属性值为基本类型（string/number/boolean）或其数组，不传入嵌套对象或 Map。

### Requirement: 公告横幅挂载
主应用客户端 SHALL 在 App.tsx 顶层挂载 AnnouncementBanner 组件，确保公告横幅在所有页面可见。

### Requirement: 用户分群 CRUD 完整性
用户分群和标签 SHALL 支持完整的 CRUD（含更新），且 deleteTag 时使用 updateMany 清理所有用户的标签引用。

### Requirement: 推送消息 ObjectId 校验
pushService.getMessageDetail SHALL 对传入的 messageId 进行 ObjectId 格式校验，非法格式返回 400 而非抛出 BSONError。
