# Tasks

> 部署现有代码并修复服务器运行时异常

---

- [x] Task 1: 修改 deploy_server.py 增加跳过 Git push 选项
  - [x] SubTask 1.1: 在 argparse 中新增 `--skip-git-push` 命令行参数
  - [x] SubTask 1.2: 修改 `ensure_git_commit_and_push` 函数，支持跳过 Git 操作
  - [x] SubTask 1.3: 修改 Git push 失败时的错误提示，建议用户使用 `--skip-git-push`
  - [x] SubTask 1.4: 验证 `python deploy_server.py --help` 正确显示新选项

- [x] Task 2: 完成现有代码部署到服务器（跳过 Git push）
  - [x] SubTask 2.1: 本地执行 `npm run build:server`、`npm run build:client`、admin 构建
  - [x] SubTask 2.2: 通过 SSH 上传 4 个 dist 目录到服务器（先备份）
  - [x] SubTask 2.3: PM2 重启 deepmindmap-server 和 deepmindmap-admin
  - [x] SubTask 2.4: 健康检查 `DEPLOY_HEALTH_URL_SERVER` 和 `DEPLOY_HEALTH_URL_ADMIN`
  - [x] SubTask 2.5: 验证封禁功能和节点导出功能正常

- [x] Task 3: 修复 Neo4j Invalid time value 异常
  - [x] SubTask 3.1: 在 `nodeService.ts` 新增 `safeDate` 和 `safeIso` 私有工具函数
  - [x] SubTask 3.2: 修复 `toNeo4jNodeProps` 的 `createdAt`/`updatedAt` toISOString 调用
  - [x] SubTask 3.3: 修复 `fromNeo4jNodeProps` 的 `new Date(props.createdAt)` 调用
  - [x] SubTask 3.4: 修复 `getFromRedis` 的 `new Date(nodeData.createdAt)` 调用
  - [x] SubTask 3.5: 修复 `updateNode` 中 `existing.createdAt` 沿用可能非法日期的问题
  - [x] SubTask 3.6: 修复 `toNeo4jRelationProps` 和 `fromNeo4jRelationProps` 的同类问题
  - [x] SubTask 3.7: 添加单元测试覆盖 undefined/null/空字符串/非法字符串场景

- [x] Task 4: 完善 pushService BSONError 修复
  - [x] SubTask 4.1: 修改 `pushService.ts` 的 `getMessageDetail` 方法，移除正则校验直接返回 null
  - [x] SubTask 4.2: 采用 try-catch 双格式兼容策略（ObjectId 查询失败回退到字符串查询）
  - [x] SubTask 4.3: 与 `admin/server/src/routes/push.ts` 第 157-162 行的策略保持一致
  - [x] SubTask 4.4: 添加单元测试覆盖 24 位 hex 格式和 UUID 格式的 messageId

- [x] Task 5: 补齐 cacheNotify.ts 延迟校验
  - [x] SubTask 5.1: 为 `notifyVisitorCacheClear` 添加延迟 token 校验
  - [x] SubTask 5.2: 为 `notifyWorkspaceCacheClear` 添加延迟 token 校验
  - [x] SubTask 5.3: 为 `notifyAllCacheClear` 添加延迟 token 校验
  - [x] SubTask 5.4: 为 `notifyFeedbackPush` 添加延迟 token 校验
  - [x] SubTask 5.5: 添加单元测试覆盖空 token 场景

- [x] Task 6: 服务器异常排查
  - [x] SubTask 6.1: 通过 SSH 查看 PM2 日志 `pm2 logs --lines 200`
  - [x] SubTask 6.2: 识别除 Neo4j 和 pushService 之外的其他异常
  - [x] SubTask 6.3: 记录异常清单，评估是否需要立即修复

### 服务器异常清单（2026-07-01 排查结果）

**已在修复中（Task 3/4/5）：**
1. Neo4j `RangeError: Invalid time value` — Task 3 修复中
2. pushService `BSONError` — Task 4 修复中
3. cacheNotify 403 日志噪音 — Task 5 修复中

**新发现的异常（后续修复）：**
4. admin 后台请求主服务 `/api/ai/queue/stats` 返回 401（缺少访客标识）— 中优先级，影响 dashboard AI 队列统计
5. IP 白名单拦截 127.0.0.1（admin 后台内部请求被拦截）— 中优先级，与异常 4 关联
6. JSON 解析错误 `Unexpected token : in JSON at position 9`（body-parser）— 低优先级，偶发
7. MongoDB 未连接警告 `⚠️ MongoDB 未连接，跳过向量数据加载`（启动时序问题）— 低优先级，不影响功能
8. AI 模型配置警告 `[AI模型] 数据库未找到启用的模型配置` — 低优先级，使用环境变量默认值

**部署前已修复的问题（需验证）：**
9. 封禁接口返回 400 → 部署的代码已包含修复，待验证

- [x] Task 7: 本地验证与重新部署
  - [x] SubTask 7.1: 运行 `npx tsc --noEmit` 验证所有项目 TypeScript 编译通过
  - [x] SubTask 7.2: 运行单元测试验证无回归（server、client、admin server）
  - [x] SubTask 7.3: 本地构建 4 个项目
  - [x] SubTask 7.4: 上传到服务器并 PM2 重启
  - [x] SubTask 7.5: 监控 PM2 日志 5-10 分钟，确认 Neo4j 和 pushService 异常消失

# Task Dependencies

- Task 2 依赖 Task 1（需要 `--skip-git-push` 选项才能部署）
- Task 3、4、5 可并行（独立的代码修复）
- Task 6 依赖 Task 2（部署后才能查看新日志）
- Task 7 依赖 Task 3、4、5、6（所有修复完成后重新部署）
