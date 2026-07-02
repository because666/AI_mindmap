# Checklist

## 后端 SSE compression 修复
- [ ] `server/src/index.ts` 的 `compression()` 已改为 `compression({ filter })`，filter 函数对 `text/event-stream` 返回 false
- [ ] compression filter 单元测试覆盖：`text/event-stream` 跳过、`application/json` 压缩
- [ ] SSE 路由的 `Content-Type: text/event-stream` 头设置时机正确（在 compression filter 判断前已设置）
- [ ] 主服务端 `npx tsc --noEmit` 通过
- [ ] 主服务端 `npx vitest run` 通过

## LaTeX 公式渲染
- [ ] `client/package.json` 已新增 `remark-math`、`rehype-katex`、`katex` 依赖
- [ ] `client/src/components/Chat/MarkdownRenderer.tsx` 已添加 `remarkMath` 到 `remarkPlugins`
- [ ] `client/src/components/Chat/MarkdownRenderer.tsx` 已添加 `rehypeKatex` 到 `rehypePlugins`
- [ ] KaTeX CSS 样式已引入（`katex/dist/katex.min.css`）
- [ ] 行内公式 `$E = mc^2$` 渲染正确
- [ ] 块级公式 `$$\int_0^1 x^2 dx$$` 渲染正确且居中
- [ ] 公式渲染样式与深色主题兼容（颜色、背景、字体大小）
- [ ] 主客户端 `npm run build` 通过

## 前端流式显示流畅度
- [ ] `client/src/components/Chat/ChatPanel.tsx` 的 `flushBufferToDisplay` 每帧字符数限制已提升或移除
- [ ] 后端 chunk 到达后下一帧内内容即显示，无明显积压
- [ ] 光标闪烁动画保留且不阻塞内容显示
- [ ] 快速网络下内容不堆积、慢速网络下无闪烁

## 部署与验证
- [ ] 使用 deploy_server.py 部署到服务器
- [ ] 服务器端 4 个 dist 目录备份验证通过
- [ ] PM2 重启成功（deepmindmap-server + deepmindmap-admin 均 online）
- [ ] 健康检查通过（主服务 HTTP 200、Admin 服务 HTTP 200）
- [ ] 浏览器实测：SSE 流式输出逐字出现，不再一次性返回
- [ ] 浏览器实测：AI 回复中的数学公式正确渲染
