# 核心功能数据持久化与 Redis 集成 Spec

## Why

项目当前所有缓存、限流、向量存储全部依赖进程内内存数据结构（Map），服务重启后向量数据丢失导致语义搜索不可用，对话消息嵌套存储存在 MongoDB 16MB 文档限制风险，AI 限流和节点缓存无法跨实例共享。这些问题直接影响核心功能的可用性和可靠性。

## What Changes

- 向量数据库从纯内存 Map 迁移到 MongoDB 持久化存储，服务重启后向量数据不丢失
- 集成 Redis 客户端（ioredis），将 AI 限流、NodeService 缓存、Dashboard 缓存迁移到 Redis
- 对话消息从嵌套在 conversation 文档中拆分为独立的 messages 集合
- Dashboard 消息统计从 $unwind 改为基于独立 messages 集合的聚合查询
- Admin 后台服务间通信添加重试机制

## Impact

- Affected specs: code-quality-optimization-analysis
- Affected code:
  - server/src/data/vector/connection.ts — 向量数据库重构
  - server/src/data/vector/mongoVectorStore.ts — 新增 MongoDB 向量存储
  - server/src/config/index.ts — 添加 Redis 连接初始化
  - server/src/data/redis/connection.ts — 新增 Redis 连接管理
  - server/src/middleware/aiRateLimit.ts — 限流数据迁移到 Redis
  - server/src/services/nodeService.ts — 缓存迁移到 Redis
  - server/src/services/conversationService.ts — 消息存储拆分
  - server/src/services/searchService.ts — 适配新的向量存储
  - server/src/services/aiService.ts — 适配新的向量存储
  - server/src/routes/conversations.ts — 适配消息分页查询
  - server/src/index.ts — Redis 连接初始化和优雅关闭
  - server/package.json — 添加 ioredis 依赖
  - admin/server/src/services/dashboardService.ts — 消息统计优化
  - admin/server/src/services/cacheNotify.ts — 添加重试机制
  - client/src/services/api.ts — 适配消息分页加载

---

## ADDED Requirements

### Requirement: 向量数据库 MongoDB 持久化

系统 SHALL 将向量数据持久化存储到 MongoDB，服务重启后向量数据不丢失。

#### Scenario: 向量数据写入
- **WHEN** 调用 vectorDB.insert 向量插入操作
- **THEN** 向量数据同时写入 MongoDB 的 vector_embeddings 集合，包含 id、vector（数组）、metadata、createdAt 字段

#### Scenario: 向量数据搜索
- **WHEN** 调用 vectorDB.search 向量搜索操作
- **THEN** 从 MongoDB 加载向量数据，计算余弦相似度，返回 topK 结果

#### Scenario: 服务重启后数据恢复
- **WHEN** 服务重启后调用 vectorDB.initialize
- **THEN** 从 MongoDB 加载已有向量数据到内存缓存，语义搜索功能正常可用

#### Scenario: 向量数据删除
- **WHEN** 调用 vectorDB.delete 删除操作
- **THEN** 同时从内存缓存和 MongoDB 中删除对应向量记录

---

### Requirement: Redis 连接管理

系统 SHALL 集成 ioredis 客户端，提供统一的 Redis 连接管理。

#### Scenario: Redis 连接初始化
- **WHEN** 服务启动时
- **THEN** 根据 config.redis 配置创建 ioredis 连接，连接失败时打印警告但不阻止启动（降级为内存模式）

#### Scenario: Redis 不可用时降级
- **WHEN** Redis 连接不可用
- **THEN** AI 限流、NodeService 缓存等功能降级为内存 Map 模式运行，打印警告日志

#### Scenario: Redis 优雅关闭
- **WHEN** 服务收到 SIGINT/SIGTERM 信号
- **THEN** 正确关闭 Redis 连接

---

### Requirement: AI 限流数据迁移到 Redis

系统 SHALL 将 AI 限流数据存储到 Redis，支持跨实例共享。

#### Scenario: 限流计数
- **WHEN** 用户发起 AI 请求
- **THEN** 使用 Redis INCR 命令递增限流计数器，设置 TTL 为窗口时间

#### Scenario: Redis 不可用降级
- **WHEN** Redis 连接不可用
- **THEN** 降级为当前内存 Map 模式运行

---

### Requirement: NodeService 缓存迁移到 Redis

系统 SHALL 将 NodeService 的 LRU 缓存数据存储到 Redis，支持跨实例共享。

#### Scenario: 节点缓存读取
- **WHEN** NodeService 查询节点
- **THEN** 优先从 Redis 缓存读取，缓存未命中时从 Neo4j 加载并写入 Redis

#### Scenario: 缓存失效
- **WHEN** Admin 后台发送缓存清除通知
- **THEN** 主服务端清除 Redis 中对应工作区的缓存数据

#### Scenario: Redis 不可用降级
- **WHEN** Redis 连接不可用
- **THEN** 降级为当前内存 LRU Map 模式运行

---

### Requirement: 对话消息独立集合存储

系统 SHALL 将对话消息从 conversation 文档的 messages 数组拆分为独立的 messages 集合。

#### Scenario: 新消息写入
- **WHEN** 用户发送消息或 AI 回复消息
- **THEN** 消息写入独立的 messages 集合，包含 conversationId、nodeId、workspaceId 字段关联

#### Scenario: 消息分页加载
- **WHEN** 客户端请求对话消息
- **THEN** 支持基于 cursor 的分页查询，默认加载最近 50 条消息，向上滚动时加载更早的消息

#### Scenario: 历史数据迁移
- **WHEN** 服务启动时检测到旧格式数据
- **THEN** 自动将嵌套在 conversation 文档中的消息迁移到 messages 集合

#### Scenario: 向后兼容
- **WHEN** 旧版本客户端请求对话消息
- **THEN** 仍返回 messages 数组格式（从独立集合查询组装）

---

### Requirement: Dashboard 消息统计优化

系统 SHALL 将 Dashboard 消息统计从 $unwind 改为基于独立 messages 集合的直接聚合查询。

#### Scenario: 消息总数统计
- **WHEN** Dashboard 请求消息统计数据
- **THEN** 直接对 messages 集合执行 countDocuments 和聚合查询，无需 $unwind

---

### Requirement: Admin 后台服务间通信重试机制

系统 SHALL 为 Admin 后台与主服务端的 HTTP 通信添加重试机制。

#### Scenario: 通信失败重试
- **WHEN** Admin 后台向主服务端发送缓存清除通知失败
- **THEN** 自动重试最多 3 次，间隔递增（1s/2s/4s），全部失败后打印错误日志

---

## MODIFIED Requirements

### Requirement: 向量数据库初始化

向量数据库初始化 SHALL 从 MongoDB 加载已有向量数据到内存缓存，而非创建空的 Map。

- 原实现：`this.vectors = new Map()` 创建空 Map
- 修改后：从 MongoDB vector_embeddings 集合加载已有数据到内存 Map

### Requirement: 服务启动和关闭流程

服务启动 SHALL 初始化 Redis 连接和向量数据库 MongoDB 持久化；服务关闭 SHALL 断开 Redis 连接。

- 原实现：仅断开 Neo4j 和 MongoDB 连接
- 修改后：额外断开 Redis 连接

### Requirement: 搜索服务向量搜索

搜索服务的语义搜索 SHALL 使用新的 MongoDB 持久化向量存储。

- 原实现：依赖纯内存 VectorDBService
- 修改后：使用 MongoDB 持久化的向量存储服务
