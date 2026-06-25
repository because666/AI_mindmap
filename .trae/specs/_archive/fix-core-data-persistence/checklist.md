# 核心功能数据持久化验证清单

## 向量数据库持久化
- [x] 向量数据写入时同步写入 MongoDB vector_embeddings 集合
- [x] 向量搜索从 MongoDB 加载数据并计算相似度
- [x] 服务重启后向量数据从 MongoDB 自动恢复，语义搜索正常可用
- [x] 向量删除操作同步删除 MongoDB 中的记录
- [x] aiService.indexNodeContent 和 searchSimilarNodes 正常工作

## Redis 连接管理
- [x] ioredis 依赖已安装
- [x] 服务启动时 Redis 连接初始化成功
- [x] Redis 连接失败时打印警告但不阻止启动，降级为内存模式
- [x] 服务关闭时 Redis 连接正确断开
- [x] Redis 不可用时各功能降级为内存模式运行

## AI 限流 Redis 迁移
- [x] AI 限流计数器使用 Redis INCR + TTL 实现
- [x] Redis 不可用时降级为内存 Map 模式
- [x] 多实例部署时限流数据可跨实例共享

## NodeService 缓存 Redis 迁移
- [x] 节点缓存优先从 Redis 读取
- [x] 缓存未命中时从 Neo4j 加载并写入 Redis
- [x] Redis 不可用时降级为内存 LRU Map 模式
- [x] Admin 缓存清除通知能正确清除 Redis 缓存

## 对话消息独立集合存储
- [x] 新消息写入独立的 messages 集合
- [x] 消息包含 conversationId、nodeId、workspaceId 关联字段
- [x] 支持基于 cursor 的消息分页查询
- [x] 历史嵌套消息自动迁移到 messages 集合
- [x] 旧版本客户端请求仍返回兼容格式
- [x] 客户端支持向上滚动加载更多消息

## Dashboard 消息统计优化
- [x] 消息统计直接对 messages 集合聚合查询，不使用 $unwind
- [x] Dashboard 缓存使用 Redis 替代内存 Map

## Admin 后台通信重试
- [x] 缓存清除通知失败时自动重试最多3次
- [x] 重试间隔递增（1s/2s/4s）
- [x] 全部失败后打印错误日志

## 编译与运行验证
- [x] server TypeScript 编译通过
- [x] admin/server TypeScript 编译通过
- [x] client TypeScript 编译通过
- [x] 服务启动无报错
