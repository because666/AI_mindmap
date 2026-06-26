# Checklist

## 构建验证（第一轮）
- [x] client tsc --noEmit 通过
- [x] client npm run build 通过
- [x] server tsc --noEmit 通过
- [x] server npm run build 通过
- [x] admin/server tsc --noEmit 通过
- [x] admin/server npm run build 通过
- [x] admin/client npm run build 通过

## 单元测试（第一轮）
- [x] client 所有测试通过（206/206）
- [x] server 所有测试通过（526/526）

## 安全审计（第一轮）
- [x] 无硬编码 API Key
- [x] 无硬编码数据库密码
- [x] .env 被 .gitignore 排除
- [x] client ESLint 无 error
- [x] 新增文件无 any 类型

## 修复的问题（第一轮）
- [x] markdownRenderer 嵌套列表缩进丢失已修复
- [x] markdownRenderer 标题多余空格归一化已修复
- [x] aiRateLimit.redis.test.ts mock setHeader 已修复
- [x] aiService.test.ts mock aiProviders 已修复

## 部署（第一轮）
- [x] deploy_server.py 文件列表包含所有新增文件
- [x] 22 个文件上传成功
- [x] 服务器 server 构建成功
- [x] 服务器 admin/server 构建成功
- [x] 服务器 client 构建成功（2309 模块）
- [x] 服务器 admin/client 构建成功（2713 模块）
- [x] PM2 deepmindmap-server 重启成功
- [x] PM2 deepmindmap-admin 重启成功
- [x] 健康检查 3001/health 返回 200
- [x] 健康检查 3002/api/health 返回 200

## 第二轮 — 回归测试
- [x] client tsc --noEmit 通过（无新类型错误）
- [x] client vitest 全部通过（数量 ≥ 206，实测 206/206）
- [x] server tsc --noEmit 通过（无新类型错误）
- [x] server vitest 全部通过（数量 ≥ 526，实测 526/526）

## 第二轮 — 集成测试
- [x] GET /health 返回 200（响应体含 neo4j/mongodb/redis/vector 全部 true）
- [x] GET /api/health 返回 200
- [x] 对话接口可用（实际为 GET /api/conversations/:nodeId，按节点维度创建/获取，非 POST /api/conversations）
- [x] POST /api/nodes 接口可用（访客注册→HMAC 签名→创建工作区→创建节点 全链路打通）
- [x] AI 限流中间件触发后返回 429（连续 11 次调用后触发，含 success:false 和 retryAfter）

## 第二轮 — 兼容性验证
- [x] 桌面端 viewport 下模板库入口可见（template_btn_count=2，桌面工具栏 + 空状态按钮各 1 个）
- [x] 桌面端 viewport 下 ChatPanel / CanvasPage 可用（canvas_visible=True，chat_panel_triggered_visible=True，通过 \"AI 对话\" 标题与 \"选择节点开始对话\" 空状态文案复合验证）
- [x] 移动端 viewport 下模板库入口可见（template_btn_count=2，移动工具栏 + 空状态按钮各 1 个）
- [x] 移动端 viewport 下 ChatPanel / CanvasPage 可用（canvas_visible=True，chat_panel_triggered_visible=True，复合验证通过）
- [x] 首次进入触发模板库逻辑（localStorage）在两端均生效（首次进入 template_modal_auto_open=True 两端一致；静态审查确认 TEMPLATE_LIBRARY_DISMISSED_KEY 为共享 key，无 viewport 前缀；useEffect 依赖 nodes.length 而非 viewport）

## 第二轮 — 依赖安全扫描
- [x] server npm audit 报告已生成（npm-audit-server.json，13 漏洞）
- [x] client npm audit 报告已生成（npm-audit-client.json，9 漏洞）
- [x] 高危漏洞（若有）已评估处置方案（xlsx 替换、axios/nodemailer/uuid 升级、react-router 修复等）

## 第二轮 — 重新部署
- [ ] deploy_server.py 执行成功
- [ ] 22 个文件上传成功
- [ ] 服务器 4 个子项目构建成功
- [ ] PM2 deepmindmap-server 重启成功
- [ ] PM2 deepmindmap-admin 重启成功
- [ ] 部署备份标签已创建

## 第二轮 — 线上服务状态核验
- [ ] pm2 list 显示两个进程状态为 online
- [ ] curl 3001/health 返回 200
- [ ] curl 3002/api/health 返回 200
- [ ] pm2 logs --lines 100 --nostream 无未捕获异常
