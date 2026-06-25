# Tasks

- [x] Task 1: 集成 Redis 连接管理
  - [x] 1.1 安装 ioredis 依赖（确认版本和用途：ioredis ^5.x，Redis 客户端）
  - [x] 1.2 创建 server/src/data/redis/connection.ts，实现 Redis 连接管理（连接、断开、健康检查、降级模式）
  - [x] 1.3 修改 server/src/config/index.ts，添加 Redis 连接初始化逻辑
  - [x] 1.4 修改 server/src/index.ts，启动时初始化 Redis 连接，关闭时断开 Redis 连接

- [x] Task 2: 向量数据库 MongoDB 持久化
  - [x] 2.1 创建 server/src/data/vector/mongoVectorStore.ts，实现基于 MongoDB 的向量存储（insert/search/delete/clear/loadAll）
  - [x] 2.2 修改 server/src/data/vector/connection.ts，集成 MongoDB 持久化：初始化时从 MongoDB 加载数据，insert/delete 时同步写入 MongoDB
  - [x] 2.3 修改 server/src/services/aiService.ts，适配新的向量存储接口（indexNodeContent 和 searchSimilarNodes）
  - [x] 2.4 修改 server/src/services/searchService.ts，确保语义搜索使用持久化向量存储

- [x] Task 3: AI 限流数据迁移到 Redis
  - [x] 3.1 修改 server/src/middleware/aiRateLimit.ts，使用 Redis INCR + TTL 实现限流计数
  - [x] 3.2 添加 Redis 不可用时的内存 Map 降级逻辑

- [x] Task 4: NodeService 缓存迁移到 Redis
  - [x] 4.1 修改 server/src/services/nodeService.ts，节点和关系缓存优先从 Redis 读取
  - [x] 4.2 缓存写入时同步写入 Redis，设置合理的 TTL
  - [x] 4.3 添加 Redis 不可用时的内存 LRU Map 降级逻辑
  - [x] 4.4 修改缓存清除逻辑，Admin 通知时清除 Redis 中对应缓存

- [x] Task 5: 对话消息独立集合存储
  - [x] 5.1 修改 server/src/services/conversationService.ts，新消息写入独立的 messages 集合
  - [x] 5.2 实现基于 cursor 的消息分页查询方法
  - [x] 5.3 实现历史数据自动迁移：启动时检测旧格式数据，将嵌套消息迁移到 messages 集合
  - [x] 5.4 修改 server/src/routes/conversations.ts，适配消息分页查询接口
  - [x] 5.5 修改客户端 client/src/services/api.ts 和 ChatPanel，支持消息分页加载（向上滚动加载更多）

- [x] Task 6: Dashboard 消息统计优化
  - [x] 6.1 修改 admin/server/src/services/dashboardService.ts，消息统计改为对 messages 集合直接聚合查询
  - [x] 6.2 Dashboard 缓存迁移到 Redis（替换内存 Map 缓存）

- [x] Task 7: Admin 后台服务间通信重试机制
  - [x] 7.1 修改 admin/server/src/services/cacheNotify.ts，添加指数退避重试逻辑（最多3次，1s/2s/4s）

- [x] Task 8: 编写单元测试
  - [x] 8.1 为 Redis 连接管理编写测试（连接、降级、关闭）
  - [x] 8.2 为 MongoDB 向量存储编写测试（insert/search/delete/重启恢复）
  - [x] 8.3 为对话消息独立集合存储编写测试（写入、分页、迁移）
  - [x] 8.4 为 AI 限流 Redis 模式编写测试

# Task Dependencies

- Task 1（Redis 连接）是 Task 3（限流迁移）、Task 4（缓存迁移）、Task 6（Dashboard 缓存）的前置依赖
- Task 2（向量持久化）独立于 Redis，可并行开发
- Task 5（消息拆分）独立于 Redis，可并行开发，但 Task 6 依赖 Task 5 完成
- Task 7（通信重试）独立于其他任务，可并行开发
- Task 8（测试）依赖所有功能任务完成后编写
