# 验证清单

## 安全问题验证
- [ ] docker-compose.yml 中不再包含明文数据库密码
- [ ] 内部 API 令牌比较使用 crypto.timingSafeEqual
- [ ] Admin 后台 Session Cookie 在生产环境设置 secure: true
- [ ] 管理员初始密码通过环境变量强制设置，无弱默认值
- [ ] 蜜罐安全问题答案不再硬编码在代码中
- [ ] Session 密钥通过环境变量强制设置，无弱默认值
- [ ] IP 白名单中间件实际执行过滤逻辑
- [ ] 反馈路由对所有用户输入字段进行 XSS 防护
- [ ] 文件上传验证 magic bytes 而非仅依赖 MIME 类型
- [ ] CSP 策略已配置而非完全禁用

## 测试覆盖验证
- [ ] 核心服务（workspace/conversation/search/push/email/history/sensitiveWord）有单元测试
- [ ] nodeService.test.ts 测试真实代码而非 Mock
- [ ] aiService.test.ts 覆盖 chat/chatStream/降级链/超时控制
- [ ] Admin 后台路由和服务有单元测试
- [ ] 关键流程有集成测试
- [ ] 核心业务逻辑测试覆盖率达到 80% 以上

## 架构优化验证
- [ ] 向量数据在服务重启后不丢失
- [ ] Redis 被实际用于 Session/限流/缓存
- [ ] 对话消息存储在独立集合中，无 16MB 限制风险
- [ ] Admin 后台服务间通信有重试和熔断机制
- [ ] 访客认证有签名验证或 Token 过期机制

## 代码质量验证
- [ ] appStore.ts 拆分为多个子 Store，单个文件不超过 500 行
- [ ] ChatPanel 中无重复的发送逻辑
- [ ] 模型上下文窗口映射仅在一处定义
- [ ] Token 估算函数仅在一处定义
- [ ] 代码中无 any 类型
- [ ] Admin 客户端 API 返回类型有完整类型定义
- [ ] 无静默 catch 块

## 性能优化验证
- [ ] AI 限流数据存储在 Redis 中，支持跨实例共享
- [ ] Dashboard 消息统计不使用 $unwind
- [ ] MindMapThumbnail 使用 React.memo 避免不必要重渲染
- [ ] 请求体大小限制按路由差异化配置

## 前端优化验证
- [ ] MainLayout 单个组件 useState 不超过 5 个
- [ ] 侧边栏按钮使用统一组件，无重复 tooltip 代码
- [ ] WelcomePage 被 Error Boundary 包裹
- [ ] 仅有一个移动端检测 Hook

## 部署运维验证
- [ ] docker-compose up 可一键启动完整环境（含应用服务）
- [ ] Admin 后台有 Dockerfile
- [ ] 健康检查端点包含 AI 服务可用性检查
- [ ] 有结构化日志输出
- [ ] 优雅关闭时断开所有数据库连接
