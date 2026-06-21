# P0/P1 安全与质量全面优化 Spec

## Why

基于 `code-quality-optimization-analysis` 审查报告，项目在安全防护、架构设计、代码质量和测试覆盖方面仍存在多处技术债务。前期 `harden-security-and-code-quality` 已完成部分安全加固（CSP、时序安全令牌比较、Session Cookie secure、弱密码移除等），本次聚焦剩余的 P0 和 P1 级问题，涵盖 IP 白名单失效、XSS 防护不完整、文件上传校验缺失、对话消息双写、Redis 未充分使用、访客认证薄弱、appStore 巨型文件、ChatPanel 代码重复、JSON 限制过粗，以及核心业务逻辑和 Admin 后台测试覆盖严重不足等问题。

注：2.1 向量持久化、4.1 AI 限流 Redis、4.2 Dashboard $unwind 经代码核实已实现，不在本次范围内。

## What Changes

### 安全加固（P0）
- IP 白名单中间件真正生效：读取 `admin_ips` 集合并拦截非白名单 IP 请求
- 反馈路由补全 XSS 转义：`visitorId`、`visitorIp` 等元数据字段入库前转义
- 文件上传增加 magic bytes 校验：通过文件头真实类型检测，防止 MIME 伪造
- JSON body limit 按路由精细化配置：普通接口降至 1MB，文件上传路由单独配置

### 架构改造（P0-P1）
- 对话消息完全迁移到独立 `messages` 集合：移除 `addMessage` 中的双写逻辑，`conversation` 文档不再保存 messages 数组
- Redis 充分使用：将 `conversationService` 等服务的内存缓存改为 Redis（带内存一级缓存降级），支持多实例共享
- Admin 调用主服务增加熔断保护：在现有重试基础上增加失败计数熔断器，熔断期间快速失败并记录日志
- 访客认证升级为签名+过期机制：客户端生成 HMAC 签名 token，服务端校验签名和时间戳，token 过期需重新签发

### 代码重构（P1）
- `appStore.ts` 拆分为 `nodeStore`、`relationStore`、`conversationStore`、`commandStore`、`syncStore` 等子 Store
- `ChatPanel` 提取公共 `sendMessage` 内部方法，消除 `handleSend` 和 `handleSendWithText` 约 190 行重复代码

### 测试补齐（P0）
- 核心服务端测试覆盖率达到 80%：`workspaceService`、`conversationService`、`pushService`、`feedbackService`、`searchService`、`emailService`、`nodeService`、`fileService`
- Admin 后台测试覆盖率达到 80%：`auth` 路由、`auth` 中间件、`ipWhitelist` 中间件、`users` 路由、`workspaces` 路由、`feedbacks` 路由、`push` 路由、`settings` 路由
- 覆盖正常流程、异常流程、边界情况

## Impact

- Affected specs: `code-quality-optimization-analysis`（本次为该分析剩余 P0/P1 项的实施）、`harden-security-and-code-quality`（延续安全加固方向）
- Affected code:
  - 服务端安全: `server/src/routes/feedback.ts`、`server/src/routes/files.ts`、`server/src/services/fileService.ts`、`server/src/index.ts`、`server/src/middleware/index.ts`
  - 服务端架构: `server/src/services/conversationService.ts`、`server/src/data/redis/connection.ts`
  - Admin 服务端: `admin/server/src/middleware/ipWhitelist.ts`、`admin/server/src/middleware/auth.ts`、`admin/server/src/services/cacheNotify.ts`、`admin/server/src/index.ts`
  - 客户端: `client/src/stores/appStore.ts`（拆分）、`client/src/components/Chat/ChatPanel.tsx`（去重）、`client/src/services/api.ts`（签名认证）、`client/src/stores/`（新增子 Store）
  - 测试: `server/src/test/`、`admin/server/src/test/`（新增大量测试文件）

## ADDED Requirements

### Requirement: IP 白名单实际过滤
Admin 后台 SHALL 在认证中间件之前执行 IP 白名单过滤，从 `admin_ips` 集合读取允许的 IP 列表，非白名单 IP 请求返回 403。白名单为空时允许所有 IP 访问（首次配置场景）。

#### Scenario: 白名单非空时拦截非白名单 IP
- **WHEN** `admin_ips` 集合中有 IP 记录，且请求 IP 不在列表中
- **THEN** 返回 403 状态码和"IP不在白名单"错误信息
- **AND** 不进入后续认证中间件

#### Scenario: 白名单为空时放行
- **WHEN** `admin_ips` 集合为空
- **THEN** 所有 IP 请求正常放行
- **AND** 进入后续认证中间件

### Requirement: 文件上传 magic bytes 校验
文件上传 SHALL 在 multer 接收文件后，读取文件前若干字节进行 magic bytes 校验，校验不通过时拒绝上传并返回 415 错误。

#### Scenario: 上传真实图片文件
- **WHEN** 用户上传一个 JPEG 文件，文件头为 `FF D8 FF`
- **THEN** 校验通过，文件正常保存

#### Scenario: 上传伪装 MIME 的恶意文件
- **WHEN** 用户上传一个 EXE 文件，但 Content-Type 伪装为 image/jpeg
- **THEN** magic bytes 校验发现文件头不匹配
- **AND** 返回 415 状态码和"文件类型不合法"错误信息

### Requirement: 访客签名认证
系统 SHALL 使用 HMAC 签名 token 进行访客认证，客户端在请求头中携带 `X-Visitor-Id`、`X-Visitor-Token`、`X-Visitor-Ts`，服务端校验签名有效性和时间戳新鲜度。

#### Scenario: 合法签名请求
- **WHEN** 客户端携带正确签名的 token，且时间戳在有效期内（5分钟）
- **THEN** 请求正常处理

#### Scenario: 签名错误
- **WHEN** 客户端携带的签名与服务端计算的签名不一致
- **THEN** 返回 401 状态码和"认证失败"错误信息

#### Scenario: token 过期
- **WHEN** 客户端时间戳与服务端时间差超过 5 分钟
- **THEN** 返回 401 状态码和"认证已过期"错误信息
- **AND** 客户端自动重新签发 token 重试请求

### Requirement: 对话消息独立集合完全迁移
系统 SHALL 将所有对话消息存储在独立的 `messages` 集合中，`conversation` 文档不再保存 `messages` 数组，新增消息仅写入 `messages` 集合。

#### Scenario: 新增消息
- **WHEN** 向对话添加新消息
- **THEN** 消息仅写入 `messages` 集合
- **AND** `conversation` 文档的 `messages` 字段不再被更新

#### Scenario: 查询对话消息
- **WHEN** 查询某个对话的所有消息
- **THEN** 从 `messages` 集合按 `conversationId` 查询
- **AND** 不再从 `conversation` 文档读取 messages 数组

### Requirement: Redis 缓存共享
`conversationService` 等服务 SHALL 使用 Redis 作为缓存层（内存 Map 作为一级缓存），支持多实例部署时缓存共享。

#### Scenario: 多实例缓存一致
- **WHEN** 实例 A 更新对话数据
- **THEN** Redis 缓存同步更新
- **AND** 实例 B 读取时获取最新数据

#### Scenario: Redis 不可用降级
- **WHEN** Redis 连接断开
- **THEN** 自动降级到内存缓存
- **AND** 服务正常可用，记录降级日志

### Requirement: Admin 调用主服务熔断保护
Admin 后台调用主服务端内部 API 时 SHALL 启用熔断器，连续失败达到阈值后熔断一段时间，熔断期间快速失败。

#### Scenario: 连续失败触发熔断
- **WHEN** 调用主服务连续失败 5 次
- **THEN** 触发熔断，后续请求直接快速失败
- **AND** 记录熔断日志

#### Scenario: 熔断恢复
- **WHEN** 熔断时间窗口（30秒）过后
- **THEN** 进入半开状态，允许一次试探请求
- **AND** 试探成功则恢复，失败则重新熔断

### Requirement: appStore 拆分
客户端 SHALL 将 `appStore.ts` 拆分为多个职责单一的子 Store，包括 `nodeStore`、`relationStore`、`conversationStore`、`commandStore`、`syncStore`。

#### Scenario: 节点操作
- **WHEN** 组件需要创建/删除节点
- **THEN** 从 `nodeStore` 获取状态和操作方法
- **AND** 不再依赖 `appStore` 的节点相关逻辑

### Requirement: ChatPanel 去重
`ChatPanel` SHALL 提取公共的 `sendMessage` 内部方法，`handleSend` 和 `handleSendWithText` 均委托调用该方法。

#### Scenario: 发送消息
- **WHEN** 用户点击发送或通过外部调用发送文本
- **THEN** 两个入口共用同一个 `sendMessage` 核心逻辑
- **AND** 行为一致，无重复代码

## MODIFIED Requirements

### Requirement: 反馈路由 XSS 防护
反馈路由 SHALL 对所有用户输入字段（包括 `visitorId`、`visitorIp` 等元数据字段）进行 HTML 转义后存储，防止存储型 XSS。

### Requirement: JSON body limit 精细化
主服务端 SHALL 按路由配置不同的 JSON body limit：普通 API 接口 1MB，需要大 payload 的接口（如 AI 对话）单独配置更大限制。

### Requirement: 核心服务测试覆盖
服务端核心服务（`workspaceService`、`conversationService`、`pushService`、`feedbackService`、`searchService`、`emailService`、`nodeService`、`fileService`）SHALL 有完整的单元测试，覆盖正常流程、异常流程、边界情况，覆盖率不低于 80%。

### Requirement: Admin 后台测试覆盖
Admin 后台的路由、中间件、服务 SHALL 有完整的单元测试，覆盖正常流程、异常流程、边界情况，覆盖率不低于 80%。
