# Checklist

> 部署现有代码并修复服务器运行时异常 - 验证检查清单

---

## 阶段一：部署脚本与首次部署

- [x] `deploy_server.py` 新增 `--skip-git-push` 命令行参数
- [x] `python deploy_server.py --help` 正确显示新选项的帮助说明
- [x] Git push 失败时错误提示包含"使用 `--skip-git-push` 重试"的建议
- [x] 执行 `python deploy_server.py --skip-git-push` 成功完成部署
- [x] 4 个 dist 目录（server/dist、client/dist、admin/server/dist、admin/client/dist）已上传到服务器
- [x] 服务器上原 dist 目录已备份为 `.bak-<timestamp>` 后缀
- [x] PM2 重启 deepmindmap-server 和 deepmindmap-admin 成功
- [x] 健康检查 `DEPLOY_HEALTH_URL_SERVER` 返回 200
- [x] 健康检查 `DEPLOY_HEALTH_URL_ADMIN` 返回 200

## 阶段二：Neo4j Invalid time value 修复

- [x] `nodeService.ts` 新增 `safeDate` 工具函数，非法入参回退到 `new Date()`
- [x] `nodeService.ts` 新增 `safeIso` 工具函数，Invalid Date 回退到 `new Date().toISOString()`
- [x] `nodeService.ts` 新增 `dedupWarn` 日志去重函数，60 秒内相同消息只输出一次
- [x] `toNeo4jNodeProps` 的 `createdAt`/`updatedAt` 使用 `safeIso` 包装
- [x] `fromNeo4jNodeProps` 的 `createdAt`/`updatedAt` 使用 `safeDate` 包装
- [x] `getFromRedis` 的 `createdAt`/`updatedAt` 使用 `safeDate` 包装
- [x] `updateNode` 中 `existing.createdAt` 使用 `safeDate` 包装
- [x] `toNeo4jRelationProps` 的 `createdAt` 使用 `safeIso` 包装
- [x] `fromNeo4jRelationProps` 的 `createdAt` 使用 `safeDate` 包装
- [x] 单元测试覆盖 undefined / null / 空字符串 / 非法字符串 / 合法字符串 5 种场景
- [x] 单元测试通过：12 个测试全部通过

## 阶段三：pushService BSONError 修复

- [x] `pushService.ts` `getMessageDetail` 移除正则校验直接返回 null 的逻辑
- [x] `getMessageDetail` 采用 try-catch 双格式兼容策略
- [x] `getMessageDetail` 在 ObjectId 查询失败时回退到字符串查询
- [x] `getMessageDetail` 完全失败时返回 null 并记录 warn 日志
- [x] 返回类型从 `Record<string, any>` 改为 `Record<string, unknown>`（禁止 any）
- [x] 单元测试覆盖 24 位 hex 格式 messageId（正常查询路径）
- [x] 单元测试覆盖 UUID 格式 messageId（回退查询路径）
- [x] 单元测试覆盖完全非法的 messageId（返回 null）
- [x] 单元测试通过：6 个测试全部通过

## 阶段四：cacheNotify.ts 延迟校验补齐

- [x] `notifyVisitorCacheClear` 函数内部检查 `INTERNAL_TOKEN` 是否为空
- [x] `notifyWorkspaceCacheClear` 函数内部检查 `INTERNAL_TOKEN` 是否为空
- [x] `notifyAllCacheClear` 函数内部检查 `INTERNAL_TOKEN` 是否为空
- [x] `notifyFeedbackPush` 函数内部检查 `INTERNAL_TOKEN` 是否为空
- [x] 空 token 时跳过 HTTP 请求并记录 warn 日志
- [x] 空 token 时不产生 403 错误日志
- [x] `vitest.config.ts` 添加 `src/services/**` 到 include 配置
- [x] 单元测试覆盖空 token 场景
- [x] 单元测试通过：8 个测试全部通过

## 阶段五：服务器异常排查

- [x] 通过 SSH 查看 PM2 日志 `pm2 logs --lines 200`
- [x] 识别并记录除 Neo4j 和 pushService 之外的其他异常
- [x] 异常清单已评估优先级（立即修复 / 后续修复）

### 排查结果
- Neo4j `RangeError: Invalid time value` — 已修复
- pushService `BSONError` — 已修复
- cacheNotify 403 日志噪音 — 已修复
- admin 后台请求主服务 401（缺少访客标识）— 后续修复
- IP 白名单拦截 127.0.0.1 — 后续修复
- JSON 解析错误 — 后续观察
- MongoDB 未连接警告（启动时序）— 低优先级
- AI 模型配置警告 — 低优先级

## 阶段六：本地验证

- [x] `npx tsc --noEmit` 在 server 目录执行无错误
- [x] `npx tsc --noEmit` 在 admin/server 目录执行无错误
- [x] server 单元测试全部通过（609 个测试，含新增 18 个）
- [x] client 单元测试全部通过（265 个测试）
- [x] admin server 单元测试除 6 个 ipWhitelist 历史遗留外全部通过（360 个测试，含新增 8 个）

## 阶段七：重新部署与监控

- [x] 本地构建 4 个项目全部成功
- [x] 上传到服务器并 PM2 重启成功
- [x] 健康检查通过（两个服务都返回 200）
- [x] 监控 PM2 日志，Neo4j `Invalid time value` 异常不再出现
- [x] 日志去重生效，warn 日志不再洪水式输出（60 秒内相同消息只输出一次）
- [ ] 监控 PM2 日志 5-10 分钟，pushService `BSONError` 异常不再出现（需用户操作触发）
- [ ] 监控 PM2 日志 5-10 分钟，cacheNotify 403 错误日志不再出现（需 admin 操作触发）
- [ ] 验证封禁功能在部署后正常工作
- [ ] 验证节点导出/导入功能正常
- [ ] 验证推送消息详情查询功能正常

## 额外修复

- [x] `deploy_server.py` 修复 Windows 兼容性问题（`shell=os.name == "nt"`）
- [x] `deploy_server.py` 修复 `upload_directory` 路径拼接问题（`relative_path == "."` 处理）
- [x] `deploy_server.py` 上传文件添加 try-catch 错误处理
- [x] `nodeService.ts` 添加 `dedupWarn` 日志去重函数，避免批量处理时日志洪水

## 代码质量

- [x] 所有新增函数、方法添加完整 JSDoc 注释（功能描述、入参、出参、异常处理）
- [x] 所有 TypeScript 代码无 any 类型
- [x] 异步操作添加完整的 try-catch 错误处理
- [x] 代码符合项目 ESLint/Prettier 规则
- [x] 无硬编码敏感信息（密钥、Token 等）

## Git 提交规范

- [ ] 提交说明符合 Conventional Commits 规范（`类型(模块): 描述`）
- [ ] 提交说明清晰说明本次修改内容
- [ ] 修改文件列表完整记录
