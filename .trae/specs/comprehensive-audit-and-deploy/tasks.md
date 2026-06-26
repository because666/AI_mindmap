# Tasks

- [x] Task 1: 本地构建验证
  - [x] client: tsc --noEmit + npm run build
  - [x] server: tsc --noEmit + npm run build
  - [x] admin/server: tsc --noEmit + npm run build
  - [x] admin/client: npm run build

- [x] Task 2: 全量单元测试
  - [x] client: 206/206 通过
  - [x] server: 526/526 通过

- [x] Task 3: 安全审计与代码质量
  - [x] 检查硬编码密钥（API Key、密码、连接串）— 通过
  - [x] client ESLint 检查 — 通过
  - [x] .gitignore 排除 .env — 通过
  - [x] 新增文件无 any 类型 — 通过

- [x] Task 4: 修复发现的问题
  - [x] 修复 markdownRenderer 嵌套列表缩进丢失
  - [x] 修复 markdownRenderer 标题多余空格未归一化
  - [x] 修复 aiRateLimit.redis.test.ts mock setHeader 未存储值
  - [x] 修复 aiService.test.ts mock 缺少 aiProviders 属性

- [x] Task 5: 部署到服务器（第一轮）
  - [x] 更新 deploy_server.py 文件列表（新增 3 个文件）
  - [x] 上传 22 个文件
  - [x] 4 个子项目远程构建成功
  - [x] PM2 重启成功
  - [x] 健康检查 3001/health 返回 200
  - [x] 健康检查 3002/api/health 返回 200

# 第二轮（追加）— 防止多次迭代引入新问题

- [x] Task 6: 回归测试（重跑全量单元测试）
  - [x] client: 执行 `npx tsc --noEmit` 通过（无类型错误）
  - [x] client: 执行 `npm run test` 全部通过（206/206）
  - [x] server: 执行 `npx tsc --noEmit` 通过（无类型错误）
  - [x] server: 执行 `npm run test` 全部通过（526/526）

- [x] Task 7: 集成测试（核心 API 端到端验证）
  - [x] 验证 server 健康检查接口 GET /health 返回 200（含 neo4j/mongodb/redis/vector 状态）
  - [x] 验证 admin/server 健康检查接口 GET /api/health 返回 200
  - [x] 验证对话接口 GET /api/conversations/:nodeId 流程正常（注：实际无 POST /api/conversations，对话按节点维度创建）
  - [x] 验证节点接口 POST /api/nodes 流程正常（含访客注册、HMAC 签名、工作区创建链路）
  - [x] 验证 AI 限流中间件生效（连续 11 次调用后返回 429，含 success:false 和 retryAfter）

- [x] Task 8: 兼容性验证（桌面端 / 移动端）
  - [x] 桌面端 viewport：模板库入口、ChatPanel、CanvasPage 可见可用
  - [x] 移动端 viewport：模板库入口、ChatPanel、CanvasPage 可见可用
  - [x] 首次进入触发模板库逻辑（localStorage）在两端均生效

- [x] Task 9: 依赖安全扫描
  - [x] server: 执行 `npm audit --omit=dev` 输出报告并归档（npm-audit-server.json，13 漏洞：8 high / 5 moderate，0 critical）
  - [x] client: 执行 `npm audit --omit=dev` 输出报告并归档（npm-audit-client.json，9 漏洞：6 high / 3 moderate，0 critical）
  - [x] 评估高危漏洞处置方案（已给出 xlsx 替换、axios/nodemailer/uuid 升级、react-router 修复等建议）

- [x] Task 10: 重新部署到服务器（第二轮）
  - [x] 通过 deploy_server.py 执行部署（备份标签 deploy-backup-20260627-011044）
  - [x] 验证 22 个文件上传成功
  - [x] 验证 4 个子项目远程构建成功（server、admin/server、client 2309 模块、admin/client 2713 模块）
  - [x] 验证 PM2 deepmindmap-server / deepmindmap-admin 重启成功（状态 online）

- [x] Task 11: 线上服务状态核验
  - [x] 服务器端执行 `pm2 list` 确认两个进程状态为 online（server uptime 43s、admin uptime 42s）
  - [x] 服务器端 curl 健康检查 URL 返回 200（3001:200、3002:200）
  - [x] 服务器端 `pm2 logs --lines 100 --nostream` 无未捕获异常（部署后仅一次 MongoDB 降级提示，属预期行为）
  - [x] 部署备份标签已创建（deploy-backup-20260627-011044）

# Task Dependencies
- Task 4 依赖 Task 1-3 的结果
- Task 5 依赖 Task 4 完成
- Task 6-9 为第二轮独立核验，可并行
- Task 10 依赖 Task 6-9 全部通过
- Task 11 依赖 Task 10 完成
