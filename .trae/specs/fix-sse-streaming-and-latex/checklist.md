# Checklist

## 后端 SSE compression 修复
- [x] `server/src/index.ts` 的 `compression()` 已改为 `compression({ filter })`，filter 函数对 `text/event-stream` 返回 false
- [x] compression filter 单元测试覆盖：`text/event-stream` 跳过、`application/json` 压缩
- [x] SSE 路由的 `Content-Type: text/event-stream` 头设置时机正确（在 compression filter 判断前已设置）
- [x] 主服务端 `npx tsc --noEmit` 通过
- [x] 主服务端 `npx vitest run` 通过（26 文件 618 用例全通过）

## LaTeX 公式渲染
- [x] `client/package.json` 已新增 `remark-math`、`rehype-katex`、`katex`、`@types/katex` 依赖
- [x] `client/src/components/Chat/MarkdownRenderer.tsx` 已添加 `remarkMath` 到 `remarkPlugins`
- [x] `client/src/components/Chat/MarkdownRenderer.tsx` 已添加 `rehypeKatex` 到 `rehypePlugins`
- [x] KaTeX CSS 样式已引入（`main.tsx` 中 `import 'katex/dist/katex.min.css'`）
- [x] 行内公式 `$E = mc^2$` 渲染逻辑已接入（需浏览器实测确认）
- [x] 块级公式 `$$\int_0^1 x^2 dx$$` 渲染逻辑已接入（需浏览器实测确认）
- [x] 公式渲染样式与深色主题兼容（`.katex { color: inherit }` 已添加到 index.css）
- [x] 主客户端 `npm run build` 通过

## 前端流式显示流畅度
- [x] `client/src/components/Chat/ChatPanel.tsx` 的 `flushBufferToDisplay` 每帧字符数限制已移除
- [x] 后端 chunk 到达后下一帧内内容即显示（改为立即刷入全部缓冲区）
- [x] 光标闪烁动画保留且不阻塞内容显示
- [x] 保留 requestAnimationFrame 调度避免渲染抖动

## 部署与验证
- [x] 使用 deploy_server.py 部署到服务器
- [x] 服务器端 4 个 dist 目录备份验证通过（.bak-20260702-123905）
- [x] PM2 重启成功（deepmindmap-server + deepmindmap-admin 均 online）
- [x] 健康检查通过（主服务 HTTP 200、Admin 服务 HTTP 200）
- [ ] 浏览器实测：SSE 流式输出逐字出现，不再一次性返回（需用户验证）
- [ ] 浏览器实测：AI 回复中的数学公式正确渲染（需用户验证）
