# Tasks

本文档为产品优化分析任务，不涉及代码实现，仅用于讨论和决策。

- [x] Task 1: 讨论确认 P0 级优化方向的实施优先级和资源分配
  - [x] SubTask 1.1: 确认 NodeService 内存泄漏修复方案（LRU缓存 vs Redis迁移）
  - [x] SubTask 1.2: 确认数据同步一致性方案（操作队列 vs 乐观锁 vs 定期全量校验）
  - [x] SubTask 1.3: 确认 CORS 加固策略（域名白名单 vs CSRF Token）
  - [x] SubTask 1.4: 确认 Toast 通知组件设计方向（自研 vs 引入组件库）
- [x] Task 2: 讨论确认 P1 级优化方向的技术选型
  - [x] SubTask 2.1: 键盘快捷键系统实现方案（全局事件监听 vs 快捷键库）
  - [x] SubTask 2.2: 画布工具栏重构方案（分组折叠 vs 浮动工具栏 vs 底部操作栏）
  - [x] SubTask 2.3: 结论提炼功能的交互设计（按钮位置、AI提示词、节点样式）
  - [x] SubTask 2.4: 撤销/重做完善方案（状态快照 vs 命令模式）
  - [x] SubTask 2.5: 关系权重上下文策略（各关系类型的权重和提示词设计）
- [x] Task 3: 讨论确认 P2 级优化方向的业务价值
  - [x] SubTask 3.1: AI 用量追踪是否需要配额限制（免费用户 vs 付费用户）
  - [x] SubTask 3.2: Redis 启用的优先级排序（Session vs 缓存 vs 限流 vs 在线统计）
  - [x] SubTask 3.3: 向量数据库选型（Milvus vs Qdrant vs Pinecone vs MongoDB Atlas Vector）
  - [x] SubTask 3.4: 运营分析面板的数据需求确认
- [x] Task 4: 讨论确认 P3 级优化方向的长期规划
  - [x] SubTask 4.1: 多用户实时协作的技术方案（WebSocket vs Socket.io vs SSE）
  - [x] SubTask 4.2: 社交功能的优先级排序
  - [x] SubTask 4.3: 思维导图分享的隐私策略

# Task Dependencies

- Task 2 依赖 Task 1（P0 方向确认后再讨论 P1 技术选型）
- Task 3 依赖 Task 2（P1 技术选型确认后再评估 P2 业务价值）
- Task 4 独立于 Task 1-3，可并行讨论
