# Tasks

- [x] Task 1: 修复后端 SSE 响应被 compression 缓冲的问题
  - [ ] SubTask 1.1: 修改 `server/src/index.ts` 的 `app.use(compression())`，改为使用 `compression({ filter })` 自定义过滤函数，当响应 `Content-Type` 包含 `text/event-stream` 时跳过压缩
  - [ ] SubTask 1.2: 在 SSE 路由（`server/src/routes/ai.ts` 的 `/chat/stream`、`server/src/routes/conversations.ts` 的 `/generate-title` 和 `/extract-conclusion`）中，确保设置 `Content-Type: text/event-stream` 头的时机在 compression filter 判断之前（当前实现已满足，需验证）
  - [ ] SubTask 1.3: 编写单元测试验证 SSE 响应不被压缩（mock res.headers，验证 compression filter 对 `text/event-stream` 返回 false）

- [x] Task 2: 接入 LaTeX 数学公式渲染
  - [ ] SubTask 2.1: 在 `client` 项目中安装依赖 `remark-math`、`rehype-katex`、`katex`（需用户确认依赖名称和版本）
  - [ ] SubTask 2.2: 修改 `client/src/components/Chat/MarkdownRenderer.tsx`，在 `ReactMarkdown` 的 `remarkPlugins` 中添加 `remarkGfm` + `remarkMath`，在 `rehypePlugins` 中添加 `rehypeKatex`
  - [ ] SubTask 2.3: 在 `client/src/main.tsx` 或 `client/src/index.css` 中引入 KaTeX 的 CSS 样式（`katex/dist/katex.min.css`），或使用 CDN 链接
  - [ ] SubTask 2.4: 验证行内公式 `$E = mc^2$` 和块级公式 `$$\int_0^1 x^2 dx$$` 均能正确渲染
  - [ ] SubTask 2.5: 确认 KaTeX 渲染样式与现有深色主题兼容（公式颜色、背景、字体大小）

- [x] Task 3: 优化前端流式显示流畅度
  - [ ] SubTask 3.1: 修改 `client/src/components/Chat/ChatPanel.tsx` 的 `flushBufferToDisplay` 函数，移除或大幅提升每帧字符数限制（当前 3 字符/帧过慢）
  - [ ] SubTask 3.2: 推荐方案：将每帧刷入字符数改为动态值（如 `Math.min(buffer.length, 30)` 或直接 `buffer.length`），保证后端 chunk 到达后下一帧即完整显示
  - [ ] SubTask 3.3: 保留光标闪烁动画效果，但不应阻塞内容显示
  - [ ] SubTask 3.4: 验证流式输出在不同网络速度下均流畅（快速到达不堆积、慢速到达无闪烁）

- [ ] Task 4: 构建测试与部署
  - [ ] SubTask 4.1: 主服务端 `npx tsc --noEmit` 通过
  - [ ] SubTask 4.2: 主服务端 `npx vitest run` 通过（含新增的 compression filter 测试）
  - [ ] SubTask 4.3: 主客户端 `npm run build` 通过
  - [ ] SubTask 4.4: 使用 deploy_server.py 部署到服务器（含备份验证）
  - [ ] SubTask 4.5: 服务器健康检查通过，浏览器实测 SSE 流式输出正常、公式渲染正常

# Task Dependencies
- Task 1、Task 2、Task 3 可并行（分别改后端 compression、前端渲染、前端流式显示）
- Task 4 依赖 Task 1-3 完成
