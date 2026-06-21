# Tasks

## 第一阶段：安全加固（可并行）

- [x] Task 1: IP 白名单中间件真正生效
  - [x] SubTask 1.1: 在 `admin/server/src/middleware/ipWhitelist.ts` 中新增 `ipWhitelistMiddleware` 中间件，从 `admin_ips` 集合读取允许的 IP 列表（带 60 秒内存缓存避免每次查库），非白名单 IP 返回 403
  - [x] SubTask 1.2: 在 `admin/server/src/index.ts` 中将 `ipWhitelistMiddleware` 注册到 `/api` 路由之前，确保所有 API 请求经过白名单过滤
  - [x] SubTask 1.3: 白名单为空时放行所有请求（首次配置场景），记录一条 info 日志提示白名单未启用
  - [x] SubTask 1.4: 编写单元测试覆盖：白名单非空拦截、白名单为空放行、IP 缓存刷新

- [x] Task 2: 反馈路由补全 XSS 转义
  - [x] SubTask 2.1: 在 `server/src/routes/feedback.ts` 中对 `visitorId`、`visitorIp` 字段入库前调用 `escapeHtml` 转义
  - [x] SubTask 2.2: 审查所有反馈相关写入路径（创建反馈、更新反馈状态），确保所有用户可控字段均转义
  - [x] SubTask 2.3: 编写单元测试覆盖：含 HTML 标签的 visitorId/visitorIp 转义后存储、管理端读取时安全展示

- [x] Task 3: 文件上传 magic bytes 校验
  - [x] SubTask 3.1: 在 `server/src/services/fileService.ts` 中新增 `verifyFileSignature(buffer: Buffer, declaredMime: string): boolean` 函数，基于文件头 magic bytes 校验真实文件类型（覆盖 JPEG/PNG/GIF/PDF/Markdown/TXT 等项目允许的类型）
  - [x] SubTask 3.2: 在 `server/src/routes/files.ts` 上传路由中，multer 接收文件后读取前 16 字节调用 `verifyFileSignature`，校验失败返回 415 并删除已接收的临时文件
  - [x] SubTask 3.3: 编写单元测试覆盖：真实文件头通过、伪造 MIME 被拦截、空文件处理、边界类型

- [x] Task 4: JSON body limit 按路由精细化
  - [x] SubTask 4.1: 在 `server/src/index.ts` 中将全局 `express.json` limit 从 10MB 降至 1MB
  - [x] SubTask 4.2: 对需要大 payload 的路由（如 `/api/ai`、`/api/conversations`）单独挂载 `express.json({ limit: '5mb' })` 中间件
  - [x] SubTask 4.3: 确认文件上传路由走 multipart/form-data 不受影响
  - [x] SubTask 4.4: 编写测试验证：普通接口 1MB 以内通过、超过 1MB 被拒、AI 路由 5MB 以内通过

## 第二阶段：架构改造

- [x] Task 5: 对话消息独立集合完全迁移
  - [x] SubTask 5.1: 修改 `conversationService.addMessage`，移除向 `conversation.messages` 数组 `$push` 的双写逻辑，仅写入独立 `messages` 集合
  - [x] SubTask 5.2: 修改 `conversationService.clearConversation`，移除 `$set: { messages: [] }` 操作，仅 `deleteMany('messages')`
  - [x] SubTask 5.3: 修改 `conversationService.getConversation`，不再从 conversation 文档读取 messages 数组，消息统一从 `messages` 集合查询
  - [x] SubTask 5.4: 确认 `migrateMessages` 迁移逻辑仍可用于历史数据，迁移后 conversation 文档的 messages 字段置空
  - [x] SubTask 5.5: 编写单元测试覆盖：新增消息仅写独立集合、查询消息从独立集合读取、清空对话仅清独立集合、历史数据迁移

- [x] Task 6: Redis 缓存共享（conversationService）
  - [x] SubTask 6.1: 在 `server/src/data/redis/connection.ts` 中确认 Redis 客户端可复用，新增 `cacheGet`/`cacheSet`/`cacheDel` 通用辅助方法
  - [x] SubTask 6.2: 修改 `conversationService` 的内存缓存为 Redis + 内存二级缓存：写入时同步更新 Redis，读取时优先内存、其次 Redis、最后数据库
  - [x] SubTask 6.3: Redis 不可用时降级到纯内存缓存，记录降级日志
  - [x] SubTask 6.4: 编写单元测试覆盖：缓存命中、缓存未命中查库、缓存失效、Redis 降级

- [x] Task 7: Admin 调用主服务熔断保护
  - [x] SubTask 7.1: 在 `admin/server/src/services/cacheNotify.ts` 中新增 `CircuitBreaker` 类，实现 closed/open/half-open 三态机，连续失败 5 次熔断 30 秒
  - [x] SubTask 7.2: 将 `retryRequest` 包裹在熔断器内，熔断期间快速失败不发起 HTTP 请求
  - [x] SubTask 7.3: 熔断触发和恢复时记录 warn 日志，便于运维排查
  - [x] SubTask 7.4: 编写单元测试覆盖：连续失败触发熔断、熔断期间快速失败、半开状态试探成功恢复、半开状态试探失败重新熔断

- [x] Task 8: 访客签名认证
  - [x] SubTask 8.1: 服务端新增 `server/src/middleware/visitorAuth.ts`（或修改现有 `middleware/index.ts`），实现 HMAC-SHA256 签名校验：从 `X-Visitor-Id`、`X-Visitor-Ts` 和密钥计算签名，与 `X-Visitor-Token` 比对（使用 `crypto.timingSafeEqual`），校验时间戳 5 分钟内有效
  - [x] SubTask 8.2: 服务端新增访客密钥管理：访客注册时生成 `visitorSecret` 并存入 visitors 集合，签名使用该密钥
  - [x] SubTask 8.3: 客户端 `client/src/services/api.ts` 新增签名生成逻辑：从 localStorage 读取 `visitorSecret`，每次请求生成 `X-Visitor-Token`（HMAC）和 `X-Visitor-Ts`（当前时间戳）
  - [x] SubTask 8.4: 客户端拦截 401 认证过期响应，自动重新签发 token 重试请求一次
  - [x] SubTask 8.5: 兼容处理：服务端在过渡期允许无签名请求（带 `NODE_ENV !== 'production'` 判断），生产环境强制要求签名
  - [x] SubTask 8.6: 编写单元测试覆盖：合法签名通过、签名错误拒绝、token 过期拒绝、时间戳缺失拒绝、开发环境无签名放行

## 第三阶段：代码重构（可并行）

- [x] Task 9: appStore.ts 拆分
  - [x] SubTask 9.1: 创建 `client/src/stores/nodeStore.ts`，迁移节点 CRUD 相关状态和方法（createRootNode、createChildNode、addNode、updateNode、deleteNode 等）
  - [x] SubTask 9.2: 创建 `client/src/stores/relationStore.ts`，迁移关系管理（addRelation、updateRelation、deleteRelation）
  - [x] SubTask 9.3: 创建 `client/src/stores/conversationStore.ts`，迁移对话管理（addConversation、addMessage、clearConversation、getConversationContext）
  - [x] SubTask 9.4: 创建 `client/src/stores/commandStore.ts`，迁移撤销/重做（undo、redo、pushCommand、undoTo）
  - [x] SubTask 9.5: 创建 `client/src/stores/syncStore.ts`，迁移数据加载/同步（loadNodesFromApi、loadConversationsFromApi、reloadWorkspaceData）
  - [x] SubTask 9.6: 保留 `appStore.ts` 作为聚合入口，re-export 各子 Store，确保现有 import 路径不破坏
  - [x] SubTask 9.7: 更新所有引用 `useAppStore` 的组件，改为从对应子 Store 导入
  - [x] SubTask 9.8: 运行 `npm run build` 确认无类型错误，运行现有测试确认无回归

- [x] Task 10: ChatPanel 去重
  - [x] SubTask 10.1: 在 `client/src/components/Chat/ChatPanel.tsx` 中提取 `sendMessage(content: string, options?: SendMessageOptions)` 内部方法，包含上下文构建、流式处理、工具调用循环、标题生成、错误处理、限流引导等完整逻辑
  - [x] SubTask 10.2: `handleSend` 改为读取 input 并调用 `sendMessage(input)` 后清空输入框
  - [x] SubTask 10.3: `handleSendWithText` 改为直接调用 `sendMessage(text)`
  - [x] SubTask 10.4: 运行 `npm run build` 确认无类型错误，手动验证发送消息功能正常

## 第四阶段：测试补齐（依赖前面改动完成）

- [x] Task 11: 核心服务端测试覆盖到 80%
  - [x] SubTask 11.1: `workspaceService` 测试：创建/查询/更新/删除工作区、访客工作区、缓存清理、异常流程
  - [x] SubTask 11.2: `conversationService` 测试：创建/获取/删除对话、新增消息（独立集合）、查询消息分页、缓存命中/失效、Redis 降级
  - [x] SubTask 11.3: `pushService` 测试：发送推送、反馈通知、消息索引初始化、推送失败处理
  - [x] SubTask 11.4: `feedbackService` 测试（如存在）：创建反馈、更新状态、查询列表、XSS 转义验证
  - [x] SubTask 11.5: `searchService` 测试：语义搜索、关键词搜索、向量维度校验、空结果
  - [x] SubTask 11.6: `nodeService` 测试：节点 CRUD、节点同步、Neo4j 操作、异常处理
  - [x] SubTask 11.7: `fileService` 测试：文件保存、magic bytes 校验、文件解析、删除
  - [x] SubTask 11.8: 运行 `npm run test:coverage` 确认核心服务覆盖率 ≥ 80%（总体语句覆盖率 81.95%）

- [x] Task 12: Admin 后台测试覆盖到 80%
  - [x] SubTask 12.1: `auth` 路由测试：登录成功/失败、密码锁定、登出、安全问题重置（28 个测试，覆盖 GET /check-ip、POST /init、POST /login 蜜罐、POST /real-login、POST /logout、POST /set-nickname、GET /me）
  - [x] SubTask 12.2: `auth` 中间件测试：已认证放行、未认证拒绝、session 过期（11 个测试，覆盖 requireAuth 和 requireRole，含 24 小时边界）
  - [x] SubTask 12.3: `ipWhitelist` 中间件测试：白名单非空拦截、白名单为空放行、IP 缓存刷新（已有测试，确认覆盖完整）
  - [x] SubTask 12.4: `users` 路由测试：用户列表、封禁/解封、分页、筛选（23 个测试，覆盖 GET /、POST /:id/ban、POST /:id/unban、DELETE /:id、GET /ip/:ip/visitors、POST /ip-ban）
  - [x] SubTask 12.5: `workspaces` 路由测试：工作区列表、关闭工作区、缓存清除通知（19 个测试，覆盖 GET /、GET /:id、POST /:id/close、GET /ranking、PUT /:id/star、POST /:id/notify）
  - [x] SubTask 12.6: `feedbacks` 路由测试：反馈列表、更新状态、推送通知触发（25 个测试，覆盖 GET /、GET /stats、PATCH /:id/status、PUT /:id/assign、POST /:id/notes、GET /:id/notes）
  - [x] SubTask 12.7: `push` 路由测试：发送推送、推送历史、批量推送（14 个测试，覆盖 POST /broadcast、GET /messages、GET /messages/:id/stats）
  - [x] SubTask 12.8: `settings` 路由测试：读取/更新设置、敏感词管理、IP 白名单 CRUD（36 个测试，覆盖 IP 白名单 CRUD、POST /password、GET/PUT /features、GET /features/:key/evaluate 灰度规则、GET/PUT /ai-providers）
  - [x] SubTask 12.9: `cacheNotify` 熔断器测试：已在 Task 7 完成，确认集成（circuitBreaker.test.ts 已存在并通过）
  - [x] SubTask 12.10: 运行 Admin 后台测试确认覆盖率 ≥ 80%（9 个测试文件、180 个测试全部通过，tsc --noEmit 无类型错误）

## 第五阶段：集成验证

- [x] Task 13: 全量构建与回归验证
  - [x] SubTask 13.1: 服务端 `npm run build` 无类型错误
  - [x] SubTask 13.2: 客户端 `npm run build` 无类型错误
  - [x] SubTask 13.3: Admin 客户端 `npm run build` 无类型错误
  - [x] SubTask 13.4: 全部测试通过，覆盖率达标
  - [x] SubTask 13.5: ESLint 无报错

# Task Dependencies

- Task 1-4 可并行执行（安全加固组，互不依赖）
- Task 5 和 Task 6 有弱依赖：Task 6 的 Redis 缓存改造基于 Task 5 的消息独立集合（缓存对象变化），建议 Task 5 先完成
- Task 7 独立，可与 Task 5/6 并行
- Task 8 独立，可与 Task 5/6/7 并行
- Task 9 和 Task 10 可并行（代码重构组）
- Task 11 依赖 Task 5/6/8 完成（测试对象需是改造后的代码）
- Task 12 依赖 Task 1/7/8 完成（测试对象需是改造后的代码）
- Task 13 依赖所有前置 Task 完成
