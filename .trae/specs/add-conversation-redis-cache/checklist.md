# Checklist

## RedisService 缓存辅助方法
- [x] `cacheGet<T>` 方法已实现，支持 JSON 反序列化，Redis 不可用返回 null
- [x] `cacheSet<T>` 方法已实现，支持 JSON 序列化和可选 TTL（秒）
- [x] `cacheDel` 方法已实现，能删除 Redis key
- [x] 所有方法在 Redis 不可用时静默降级，不抛异常
- [x] 降级日志限流机制已实现（60 秒内只记录一次 warn 日志）
- [x] 所有方法添加完整 JSDoc 中文注释，使用泛型而非 any

## conversationService 二级缓存逻辑
- [x] 引入 `redisService` 依赖
- [x] 新增 `REDIS_KEY_PREFIX = 'conversation:'` 和 `REDIS_CACHE_TTL = 60` 常量
- [x] 新增 `getRedisKey`、`updateRedisCache`、`invalidateRedisCache` 私有方法
- [x] `createConversation` 先更新内存，再 fire-and-forget 异步更新 Redis
- [x] `getConversation` 按内存（TTL 30s）→ Redis → 数据库优先级读取
- [x] `getConversation` Redis 命中时回填内存缓存
- [x] `getConversation` 数据库命中时回填内存和 Redis 缓存
- [x] `getConversation` 都未命中时兜底返回内存过期数据
- [x] `getConversationByNodeId` 数据库命中时回填 Redis
- [x] `getConversationsByWorkspaceId` 数据库命中时回填 Redis
- [x] `addMessage` 先更新内存，再 fire-and-forget 异步更新 Redis
- [x] `addMessage` 保持 Task 5 消息独立集合逻辑不变（仅写 messages 集合，不写 conversation.messages 数组）
- [x] `clearConversation` 同时清除内存和 Redis 缓存
- [x] `updateContextConfig` 先更新内存，再 fire-and-forget 异步更新 Redis
- [x] `deleteConversation` 同时清除内存和 Redis 缓存
- [x] `evictFromCache` 同步清除内存，异步清除 Redis（保持方法同步签名）
- [x] `reloadConversation` 先清除内存和 Redis，再重新加载
- [x] 所有新增/修改方法添加完整 JSDoc 中文注释
- [x] 所有异常捕获完整，无静默失败
- [x] 未破坏现有方法签名

## 单元测试
- [x] 测试文件 `server/src/test/conversationService.cache.test.ts` 已创建
- [x] 使用 vi.doMock + 动态导入模拟 mongoDBService 和 redisService
- [x] 测试内存缓存命中场景
- [x] 测试内存过期后 Redis 命中场景（使用 fake timers）
- [x] 测试 Redis 和内存都未命中查库场景
- [x] 测试 clearConversation 缓存失效
- [x] 测试 deleteConversation 缓存失效
- [x] 测试 evictFromCache 缓存失效
- [x] 测试 Redis 不可用降级
- [x] 测试 Redis cacheSet 抛异常降级
- [x] 测试 Redis cacheDel 抛异常降级
- [x] 测试 createConversation 写入缓存
- [x] 测试 addMessage 更新缓存
- [x] 测试覆盖正常流程、异常流程、边界情况

## 验证
- [x] `cd server && npx tsc --noEmit` 类型检查通过，无语法错误
- [x] `cd server && npx vitest run src/test/conversationService.cache.test.ts` 全部测试通过（11 个用例）
- [x] 未引入新的第三方依赖（使用已有的 ioredis、vitest）
- [x] 代码符合 ESLint/Prettier 规范
- [x] 全程使用简体中文注释，无 any 类型
