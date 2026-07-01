# 部署现有代码并修复服务器运行时异常 Spec

## Why

上一轮 `comprehensive-audit-fix` spec 已完成 Task 1-9 的代码修复（封禁功能、路由顺序、认证中间件、IP 限流内存泄漏等），但部署因 `deploy_server.py` 的 Git push 步骤遇到 GitHub 网络超时而中止，导致修复未上线。同时服务器 PM2 日志显示存在两类运行时异常：Neo4j `Invalid time value`（节点日期序列化失败）和 pushService `BSONError`（消息 _id 格式不兼容 ObjectId）。需要先把现有修复部署到服务器，再在现有代码基础上修复这些运行时异常，恢复服务稳定性。

## What Changes

### 阶段一：完成现有代码部署
- 修改 `deploy_server.py` 增加跳过 Git push 的选项（`--skip-git-push`），允许在网络异常时仅执行本地构建 + 上传 + PM2 重启
- 通过 SSH 直接上传 4 个 dist 目录（server/dist、client/dist、admin/server/dist、admin/client/dist）到服务器
- 执行 PM2 重启与健康检查
- 验证封禁功能、节点导出功能正常

### 阶段二：修复 Neo4j Invalid time value 异常
- 在 `server/src/services/nodeService.ts` 中新增 `safeDate` 工具函数，非法入参时回退到 `new Date()`
- 修复 `toNeo4jNodeProps` 第 163-164 行的 `toISOString()` 调用，增加 `safeIso` 防御性校验
- 修复 `fromNeo4jNodeProps` 第 218-219 行的 `new Date(props.createdAt as string)` 调用
- 修复 `getFromRedis` 第 328-329 行的 `new Date(nodeData.createdAt)` 调用
- 修复 `updateNode` 中 `existing.createdAt` 直接沿用可能非法日期的问题
- 同步修复 `toNeo4jRelationProps` 和 `fromNeo4jRelationProps` 中的同类问题
- 添加单元测试覆盖 undefined/null/空字符串/非法字符串等 Invalid Date 场景

### 阶段三：完善 pushService BSONError 修复
- 修改 `server/src/services/pushService.ts` 的 `getMessageDetail` 方法
- 将正则校验直接返回 null 的策略改为与 `admin/server/src/routes/push.ts` 一致的双格式兼容策略
- 先尝试 `new ObjectId(messageId)` 查询，失败时回退到字符串查询
- 添加单元测试覆盖 24 位 hex 格式和 UUID 格式的 _id

### 阶段四：补齐 cacheNotify.ts 延迟校验（低优先级）
- 为 `admin/server/src/services/cacheNotify.ts` 中 4 个缺少延迟校验的函数补齐校验
- `notifyVisitorCacheClear`、`notifyWorkspaceCacheClear`、`notifyAllCacheClear`、`notifyFeedbackPush` 在调用时检查 `INTERNAL_TOKEN` 是否为空
- 减少服务器 403 日志噪音

### 阶段五：服务器异常排查与重新部署
- 通过 SSH 查看 PM2 日志，识别其他潜在异常
- 修复发现的其他异常
- 重新部署修复后的代码
- 监控日志确认异常消失

## Impact

- **Affected specs**:
  - `comprehensive-audit-fix`（Task 10 部署验证将被本 spec 的阶段一覆盖）
  - `fix-tracker-and-redesign-map-library`（不冲突，本 spec 不涉及地图库重构）
- **Affected code**:
  - `deploy_server.py` — 新增 `--skip-git-push` 选项
  - `server/src/services/nodeService.ts` — 新增 `safeDate`/`safeIso` 函数，修复 5+ 处日期处理
  - `server/src/services/nodeService.test.ts` — 新增 Invalid Date 场景测试
  - `server/src/services/pushService.ts` — `getMessageDetail` 双格式兼容
  - `server/src/services/pushService.test.ts` — 新增 UUID 格式测试
  - `admin/server/src/services/cacheNotify.ts` — 4 个函数补齐延迟校验
  - `admin/server/src/services/cacheNotify.test.ts` — 新增空 token 场景测试

## ADDED Requirements

### Requirement: 部署脚本支持跳过 Git push
系统 SHALL 提供 `--skip-git-push` 命令行选项，允许在网络异常时跳过 Git 提交推送步骤，仅执行本地构建、上传、PM2 重启流程。

#### Scenario: GitHub 网络超时
- **WHEN** 用户执行 `python deploy_server.py --skip-git-push`
- **THEN** 跳过 Git commit/push/tag 步骤，直接进入本地构建阶段
- **AND** 控制台输出警告提示"已跳过 Git push，请稍后手动推送代码"

#### Scenario: 正常部署
- **WHEN** 用户执行 `python deploy_server.py`（不带选项）
- **THEN** 执行完整的 Git 提交推送流程
- **AND** 失败时中止部署并提示用户使用 `--skip-git-push`

### Requirement: Neo4j 日期序列化防御性处理
系统 SHALL 在所有 Neo4j 节点/关系的日期序列化与反序列化路径上添加防御性校验，确保非法日期不会导致 `RangeError: Invalid time value` 异常。

#### Scenario: Neo4j 节点属性缺失 createdAt
- **WHEN** `fromNeo4jNodeProps` 接收的 props 中 `createdAt` 为 undefined/null/空字符串
- **THEN** 使用 `new Date()` 作为回退值，记录 warn 日志
- **AND** 不抛出异常，返回有效 Node 对象

#### Scenario: Node 对象 createdAt 为 Invalid Date
- **WHEN** `toNeo4jNodeProps` 掓获到 `node.createdAt` 为 Invalid Date
- **THEN** 使用 `new Date().toISOString()` 作为回退值
- **AND** 记录 warn 日志，不抛出异常

#### Scenario: Redis 缓存中 createdAt 字段非法
- **WHEN** `getFromRedis` 解析缓存时 `nodeData.createdAt` 为非法字符串
- **THEN** 使用 `new Date()` 作为回退值
- **AND** 不抛出异常，正常返回缓存对象

### Requirement: pushService 消息查询双格式兼容
系统 SHALL 在 `pushService.getMessageDetail` 中支持 ObjectId 格式和字符串格式的 `_id` 查询，确保数据库中存在 UUID 格式 _id 的消息也能被正常查询。

#### Scenario: 24 位 hex 格式 messageId
- **WHEN** `messageId` 匹配 `/^[0-9a-fA-F]{24}$/`
- **THEN** 使用 `new ObjectId(messageId)` 查询
- **AND** 查询成功返回消息详情

#### Scenario: UUID 格式 messageId
- **WHEN** `messageId` 不匹配 24 位 hex 正则（如 UUID 格式）
- **THEN** 第一次 ObjectId 查询抛出异常时，回退到字符串 `_id` 查询
- **AND** 查询成功返回消息详情，不返回 null

#### Scenario: 完全非法的 messageId
- **WHEN** `messageId` 既不是 24 位 hex 也不是数据库中存在的字符串
- **THEN** 两种查询方式都失败后返回 null
- **AND** 记录 warn 日志

### Requirement: cacheNotify 延迟 token 校验完整
系统 SHALL 在 `cacheNotify.ts` 中所有调用内部 API 的函数内部检查 `INTERNAL_TOKEN` 是否为空，未设置时跳过请求并记录 warn 日志，不产生 403 错误日志噪音。

#### Scenario: INTERNAL_API_TOKEN 未设置
- **WHEN** admin 服务启动时未设置 `INTERNAL_API_TOKEN` 环境变量
- **THEN** 所有 `notify*` 函数被调用时跳过 HTTP 请求
- **AND** 记录 warn 日志提示"INTERNAL_API_TOKEN 未设置，跳过缓存通知"
- **AND** 不产生 403 错误日志

## MODIFIED Requirements

### Requirement: 部署脚本错误处理
`deploy_server.py` SHALL 在 Git push 失败时不仅提示错误，还要建议用户使用 `--skip-git-push` 选项重试，避免用户卡在网络问题无法部署。

## REMOVED Requirements

无删除项。
