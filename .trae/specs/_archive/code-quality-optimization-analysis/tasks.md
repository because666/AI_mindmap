# Tasks

本文档为纯分析任务，不涉及代码实现。以下为建议的优化实施顺序，供后续迭代参考。

- [ ] 阶段一：安全漏洞修复（P0）
  - [ ] 1.1 将 docker-compose 中硬编码的数据库密码迁移到 .env 文件
  - [ ] 1.2 内部 API 令牌比较改用 crypto.timingSafeEqual
  - [ ] 1.3 Admin 后台 Session Cookie 设置 secure 标志（生产环境）
  - [ ] 1.4 强制要求设置管理员初始密码（移除弱默认值）
  - [ ] 1.5 移除蜜罐安全问题答案硬编码，改为环境变量配置
  - [ ] 1.6 强制要求设置 Session 密钥（移除弱默认值）
  - [ ] 1.7 实现 IP 白名单中间件的实际过滤逻辑
  - [ ] 1.8 完善反馈路由的 XSS 防护
  - [ ] 1.9 文件上传添加 magic bytes 类型验证
  - [ ] 1.10 配置合适的 CSP 策略替代完全禁用

- [ ] 阶段二：测试覆盖补齐（P0）
  - [ ] 2.1 为 workspaceService 编写单元测试
  - [ ] 2.2 为 conversationService 编写单元测试
  - [ ] 2.3 为 searchService 编写单元测试
  - [ ] 2.4 为 pushService 编写单元测试
  - [ ] 2.5 为 emailService 编写单元测试
  - [ ] 2.6 为 historyService 编写单元测试
  - [ ] 2.7 为 sensitiveWordService 编写单元测试
  - [ ] 2.8 修复 nodeService.test.ts：测试真实代码而非 Mock
  - [ ] 2.9 扩展 aiService.test.ts：覆盖 chat/chatStream/降级链/超时控制
  - [ ] 2.10 为 Admin 后台路由和服务编写单元测试
  - [ ] 2.11 添加关键流程的集成测试

- [ ] 阶段三：架构优化（P1）
  - [ ] 3.1 向量数据库持久化（短期：MongoDB 存储；中期：专业向量数据库）
  - [ ] 3.2 Redis 实际启用（Session 存储、限流计数器、缓存）
  - [ ] 3.3 对话消息从嵌套文档拆分为独立集合
  - [ ] 3.4 Admin 后台服务间通信添加重试和熔断机制
  - [ ] 3.5 访客认证体系增强（签名验证、Token 过期）

- [ ] 阶段四：代码质量提升（P1-P2）
  - [ ] 4.1 拆分 appStore.ts 为多个子 Store
  - [ ] 4.2 提取 ChatPanel 中 handleSend/handleSendWithText 的公共逻辑
  - [ ] 4.3 统一模型上下文窗口映射定义（消除客户端/服务端重复）
  - [ ] 4.4 统一 Token 估算函数定义
  - [ ] 4.5 修复 Admin 后台 Session 类型定义（使用 express-session.d.ts 扩展）
  - [ ] 4.6 消除代码中的 any 类型
  - [ ] 4.7 为 Admin 客户端 API 添加完整的响应类型定义
  - [ ] 4.8 修复 ChatPanel 中的静默 catch 块

- [ ] 阶段五：性能优化（P1-P2）
  - [ ] 5.1 AI 限流存储迁移到 Redis
  - [ ] 5.2 Dashboard 消息统计优化（添加冗余字段替代 $unwind）
  - [ ] 5.3 MindMapThumbnail 添加 React.memo/useMemo 优化
  - [ ] 5.4 上下文构建添加缓存机制
  - [ ] 5.5 差异化请求体大小限制

- [ ] 阶段六：前端优化（P1-P2）
  - [ ] 6.1 MainLayout 状态管理重构（useReducer 或拆分子组件）
  - [ ] 6.2 提取 SidebarButton 组件消除 tooltip 重复代码
  - [ ] 6.3 WelcomePage 添加 Error Boundary
  - [ ] 6.4 合并 useMobile 和 useIsMobile Hook
  - [ ] 6.5 消除 SettingsModal 中 OnboardingGuide 的重复渲染

- [ ] 阶段七：部署运维优化（P1-P2）
  - [ ] 7.1 docker-compose 添加主应用和 Admin 后台服务定义
  - [ ] 7.2 Admin 后台添加 Dockerfile
  - [ ] 7.3 健康检查端点增加 AI 服务可用性、内存使用等指标
  - [ ] 7.4 添加结构化日志和 Prometheus 指标导出
  - [ ] 7.5 优雅关闭时断开向量数据库连接
  - [ ] 7.6 定时任务独立为单独进程或使用任务队列

# Task Dependencies

- 阶段二（测试）依赖阶段一（安全修复）完成后再补测试，避免测试基于有漏洞的代码
- 阶段三（架构）中的 3.2（Redis 启用）是 5.1（限流迁移 Redis）的前置依赖
- 阶段三中的 3.3（对话消息拆分）需要同步修改 conversationService 和相关路由
- 阶段四中的 4.1（appStore 拆分）和 4.2（ChatPanel 重构）可并行进行
- 阶段七中的 7.1（docker-compose 完善）依赖 7.2（Admin Dockerfile）完成
