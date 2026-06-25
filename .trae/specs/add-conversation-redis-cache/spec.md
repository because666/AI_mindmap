# 对话服务 Redis + 内存二级缓存 Spec

## Why
原 `conversationService` 使用纯内存 Map 缓存对话数据，多实例部署时各实例缓存独立、无法共享，导致缓存命中率低、数据库压力高。引入 Redis 作为二级缓存可解决多实例缓存共享问题，同时保留内存一级缓存保证单实例读取性能。Redis 不可用时需降级到纯内存缓存，确保服务可用性不受影响。

## What Changes
- 在 `RedisService` 类中新增通用缓存辅助方法 `cacheGet<T>`、`cacheSet<T>`、`cacheDel`，支持 JSON 序列化/反序列化与可选 TTL
- 新增降级日志限流机制（60 秒内只记录一次降级日志），避免 Redis 持续异常时日志刷屏
- 修改 `conversationService` 的缓存逻辑为 Redis + 内存二级缓存：
  - 写入时（createConversation、addMessage、updateContextConfig）：先更新内存 Map，再 fire-and-forget 异步更新 Redis
  - 读取时（getConversation）：优先查内存（TTL 30 秒）→ Redis → 数据库，Redis/数据库命中时回填内存
  - 删除/失效时（clearConversation、deleteConversation、evictFromCache、reloadConversation）：同时清除内存和 Redis
- Redis 不可用或操作异常时静默降级到纯内存缓存，不影响服务可用性
- **不破坏 Task 5 的消息独立集合迁移逻辑**：`addMessage` 仍仅写入独立 `messages` 集合，不写 `conversation.messages` 数组

## Impact
- 受影响代码：
  - `server/src/data/redis/connection.ts`（新增缓存辅助方法）
  - `server/src/services/conversationService.ts`（缓存逻辑改造）
  - `server/src/test/conversationService.cache.test.ts`（新增单元测试）
- 受影响能力：对话服务的读取性能、多实例部署的缓存一致性、Redis 故障时的服务可用性
- 不影响：消息独立集合迁移逻辑、对话 CRUD 的方法签名、对外 API 契约

## ADDED Requirements

### Requirement: Redis 通用缓存辅助方法
`RedisService` 类 SHALL 提供三个通用缓存辅助方法，供业务层复用：

- `cacheGet<T>(key: string): Promise<T | null>`：从 Redis 获取缓存值，JSON 反序列化后返回；key 不存在或 Redis 不可用时返回 null
- `cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void>`：将值 JSON 序列化后写入 Redis，可选 TTL（秒）；Redis 不可用或操作异常时静默降级
- `cacheDel(key: string): Promise<void>`：删除 Redis 缓存 key；Redis 不可用或操作异常时静默降级

所有方法在 Redis 不可用或操作异常时 SHALL 静默降级，不抛异常，并记录限流后的 warn 日志（60 秒内只记录一次）。

#### Scenario: Redis 可用时正常读写
- **WHEN** 调用 `cacheSet('key', {a:1}, 60)` 后调用 `cacheGet('key')`
- **THEN** 返回 `{a:1}`，且 key 在 60 秒后自动过期

#### Scenario: Redis 不可用时静默降级
- **WHEN** Redis 客户端为 null（`getClient()` 返回 null）时调用任意缓存方法
- **THEN** 方法不抛异常，`cacheGet` 返回 null，`cacheSet`/`cacheDel` 直接返回，并记录限流 warn 日志

#### Scenario: 降级日志限流
- **WHEN** Redis 持续异常，短时间内多次调用缓存方法
- **THEN** 60 秒内只记录一次降级 warn 日志，避免日志刷屏

### Requirement: 对话服务二级缓存读取
`conversationService.getConversation` SHALL 按以下优先级读取对话数据：

1. 内存缓存（TTL 30 秒）：命中则直接返回
2. Redis 缓存：命中则回填内存缓存后返回
3. 数据库：命中则回填内存和 Redis 缓存后返回
4. 兜底：若以上都未命中但内存中存在过期数据，返回过期数据

#### Scenario: 内存缓存命中
- **WHEN** 30 秒内第二次调用 `getConversation(id)`
- **THEN** 直接返回内存中的对话，不查 Redis 也不查库

#### Scenario: 内存过期后 Redis 命中
- **WHEN** 内存缓存超过 30 秒过期，Redis 中存在该对话
- **THEN** 从 Redis 获取并回填内存缓存，不查库

#### Scenario: Redis 和内存都未命中查库
- **WHEN** 内存和 Redis 都未命中，数据库存在该对话
- **THEN** 从数据库获取并回填内存和 Redis 缓存

### Requirement: 对话服务二级缓存写入与失效
写入操作（createConversation、addMessage、updateContextConfig）SHALL 先更新内存缓存，再 fire-and-forget 异步更新 Redis。失效操作（clearConversation、deleteConversation、evictFromCache）SHALL 同时清除内存和 Redis 缓存。

#### Scenario: 创建对话后写入缓存
- **WHEN** 调用 `createConversation` 创建对话
- **THEN** 内存缓存和 Redis 缓存都被更新

#### Scenario: 清空对话后失效缓存
- **WHEN** 调用 `clearConversation`
- **THEN** 内存和 Redis 缓存都被清除，下次读取从数据库重新加载

### Requirement: Redis 降级不影响服务可用性
Redis 不可用或操作异常时，`conversationService` SHALL 降级到纯内存缓存，所有读写操作正常可用，不抛异常。

#### Scenario: Redis 不可用时服务正常
- **WHEN** Redis 不可用时调用 `getConversation`
- **THEN** 跳过 Redis 查询，直接查库并回填内存缓存，服务正常可用

## MODIFIED Requirements

### Requirement: 对话服务缓存策略
原纯内存缓存改为 Redis + 内存二级缓存。内存缓存 TTL 30 秒，Redis 缓存 TTL 60 秒。Redis key 格式为 `conversation:${id}`。Redis 不可用时降级到纯内存缓存，记录限流 warn 日志。

## REMOVED Requirements
无移除需求。
