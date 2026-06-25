# Tasks

- [x] Task 1: 在 RedisService 中新增通用缓存辅助方法
  - [x] SubTask 1.1: 新增 `cacheGet<T>(key): Promise<T | null>` 方法，JSON 反序列化，Redis 不可用返回 null
  - [x] SubTask 1.2: 新增 `cacheSet<T>(key, value, ttlSeconds?): Promise<void>` 方法，JSON 序列化，支持可选 TTL
  - [x] SubTask 1.3: 新增 `cacheDel(key): Promise<void>` 方法，删除 Redis key
  - [x] SubTask 1.4: 新增降级日志限流机制（`lastDegradedLogTime`、`DEGRADED_LOG_INTERVAL`、`logDegraded` 私有方法），60 秒内只记录一次降级日志
  - [x] SubTask 1.5: 所有方法在 Redis 不可用或异常时静默降级，不抛异常

- [x] Task 2: 修改 conversationService 缓存逻辑为 Redis + 内存二级缓存
  - [x] SubTask 2.1: 引入 `redisService` 依赖，新增 `REDIS_KEY_PREFIX`、`REDIS_CACHE_TTL` 常量
  - [x] SubTask 2.2: 新增 `getRedisKey`、`updateRedisCache`、`invalidateRedisCache` 私有方法
  - [x] SubTask 2.3: 修改 `createConversation`：先更新内存，再 fire-and-forget 异步更新 Redis
  - [x] SubTask 2.4: 修改 `getConversation`：内存（TTL 30s）→ Redis → 数据库，命中时回填上层缓存
  - [x] SubTask 2.5: 修改 `getConversationByNodeId`、`getConversationsByWorkspaceId`：数据库命中时回填 Redis
  - [x] SubTask 2.6: 修改 `addMessage`：先更新内存，再 fire-and-forget 异步更新 Redis（保持 Task 5 消息独立集合逻辑不变）
  - [x] SubTask 2.7: 修改 `clearConversation`：同时清除内存和 Redis 缓存
  - [x] SubTask 2.8: 修改 `updateContextConfig`：先更新内存，再 fire-and-forget 异步更新 Redis
  - [x] SubTask 2.9: 修改 `deleteConversation`：同时清除内存和 Redis 缓存
  - [x] SubTask 2.10: 修改 `evictFromCache`：同步清除内存，异步清除 Redis（保持方法同步签名）
  - [x] SubTask 2.11: 修改 `reloadConversation`：先清除内存和 Redis，再重新加载

- [x] Task 3: 编写单元测试 conversationService.cache.test.ts
  - [x] SubTask 3.1: 使用 vi.doMock + 动态导入模拟 mongoDBService 和 redisService
  - [x] SubTask 3.2: 测试内存缓存命中（第二次 getConversation 不查库也不查 Redis）
  - [x] SubTask 3.3: 测试内存过期后 Redis 命中（使用 fake timers 模拟 TTL 过期）
  - [x] SubTask 3.4: 测试 Redis 和内存都未命中查库（验证回填内存和 Redis）
  - [x] SubTask 3.5: 测试缓存失效（clearConversation、deleteConversation、evictFromCache）
  - [x] SubTask 3.6: 测试 Redis 降级（不可用、cacheSet 抛异常、cacheDel 抛异常）
  - [x] SubTask 3.7: 测试 createConversation 写入缓存
  - [x] SubTask 3.8: 测试 addMessage 更新缓存

- [x] Task 4: 验证与交付
  - [x] SubTask 4.1: 运行 `cd server && npx tsc --noEmit` 类型检查通过
  - [x] SubTask 4.2: 运行 `cd server && npx vitest run src/test/conversationService.cache.test.ts` 测试全部通过（11 个测试用例）

# Task Dependencies
- Task 2 依赖 Task 1（conversationService 使用 RedisService 的缓存辅助方法）
- Task 3 依赖 Task 2（测试验证 conversationService 的缓存逻辑）
- Task 4 依赖 Task 1、Task 2、Task 3（验证所有修改）
