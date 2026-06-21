# Checklist

## 安全加固

- [x] IP 白名单中间件从 `admin_ips` 集合读取列表并实际拦截非白名单 IP
- [x] IP 白名单为空时放行所有请求（首次配置场景）
- [x] IP 白名单有 60 秒内存缓存避免每次查库
- [x] 反馈路由的 `visitorId`、`visitorIp` 字段入库前已 HTML 转义
- [x] 文件上传路由在 multer 接收后执行 magic bytes 校验
- [x] magic bytes 校验覆盖项目允许的所有文件类型（JPEG/PNG/GIF/PDF/MD/TXT）
- [x] 伪造 MIME 的文件被拦截并返回 415
- [x] 主服务全局 JSON limit 降至 1MB
- [x] AI/对话等大 payload 路由单独配置 5MB limit
- [x] 文件上传路由不受 JSON limit 影响

## 架构改造

- [x] `conversationService.addMessage` 仅写入独立 `messages` 集合，不再 `$push` 到 conversation 文档
- [x] `conversationService.clearConversation` 仅清空 `messages` 集合，不再 `$set: { messages: [] }`
- [x] `conversationService.getConversation` 消息从 `messages` 集合查询
- [x] `conversationService` 缓存改为 Redis + 内存二级缓存
- [x] Redis 不可用时自动降级到内存缓存并记录日志
- [x] `cacheNotify.ts` 新增 `CircuitBreaker` 熔断器（closed/open/half-open 三态）
- [x] 连续失败 5 次触发熔断，熔断 30 秒后进入半开状态
- [x] 熔断期间快速失败不发起 HTTP 请求
- [x] 访客认证使用 HMAC-SHA256 签名（`X-Visitor-Token`）
- [x] 服务端校验签名使用 `crypto.timingSafeEqual`
- [x] 时间戳 5 分钟内有效，过期返回 401
- [x] 客户端自动生成签名 token 并携带 `X-Visitor-Id`/`X-Visitor-Token`/`X-Visitor-Ts`
- [x] 客户端 401 过期时自动重新签发并重试一次
- [x] 开发环境允许无签名请求，生产环境强制要求签名

## 代码重构

- [x] `appStore.ts` 拆分为 `nodeStore`、`relationStore`、`conversationStore`、`commandStore`、`syncStore`
- [x] `appStore.ts` 保留为聚合 re-export 入口，现有 import 路径不破坏
- [x] 所有引用组件已更新为从对应子 Store 导入
- [x] `ChatPanel` 提取公共 `sendMessage` 内部方法
- [x] `handleSend` 和 `handleSendWithText` 无重复代码
- [x] 发送消息功能行为一致

## 测试覆盖

- [x] `workspaceService` 单元测试覆盖正常/异常/边界
- [x] `conversationService` 单元测试覆盖独立集合写入/查询/缓存/降级
- [x] `pushService` 单元测试覆盖发送/通知/失败处理
- [x] `searchService` 单元测试覆盖语义/关键词搜索
- [x] `nodeService` 单元测试覆盖 CRUD/同步/异常
- [x] `fileService` 单元测试覆盖保存/magic bytes/解析/删除
- [x] 服务端核心服务测试覆盖率 ≥ 80%（总体语句覆盖率 81.95%）
- [x] Admin `auth` 路由测试覆盖登录/锁定/登出/重置
- [x] Admin `auth` 中间件测试覆盖认证/未认证/过期
- [x] Admin `ipWhitelist` 中间件测试覆盖拦截/放行/缓存
- [x] Admin `users`/`workspaces`/`feedbacks`/`push`/`settings` 路由测试
- [x] Admin `cacheNotify` 熔断器测试覆盖三态转换
- [x] Admin 后台测试覆盖率 ≥ 80%（9 个测试文件、180 个测试全部通过）

## 集成验证

- [x] 服务端 `npx tsc --noEmit` 无类型错误
- [x] 客户端 `npm run build` 无类型错误
- [x] Admin 服务端 `npx tsc --noEmit` 无类型错误
- [x] 全部测试通过（服务端 478/479 通过，1 个预先存在的失败非本次引入；Admin 180/180 全部通过）
- [x] 无新增 `any` 类型
- [x] 所有新增函数/方法/类有完整 JSDoc 注释
- [x] 所有异步操作有异常捕获
