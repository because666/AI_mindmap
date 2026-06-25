# Tasks

- [x] Task 1: 实现流式输出缓冲与节流渲染机制
  - [x] 1.1 在 ChatPanel.tsx 中新增 `streamBufferRef`（useRef<string>）用于缓冲SSE内容片段
  - [x] 1.2 新增 `displayedContentRef`（useRef<string>）记录已显示的内容
  - [x] 1.3 新增 `animationFrameRef`（useRef<number>）管理 requestAnimationFrame ID
  - [x] 1.4 修改 `handleStream` 回调：移除 `flushSync`，改为将 `event.content` 追加到 `streamBufferRef`
  - [x] 1.5 实现 `flushBufferToDisplay` 函数：每帧从 `streamBufferRef` 取出缓冲内容，逐字符追加到 `displayedContentRef`，然后调用 `setStreamingContent` 更新状态
  - [x] 1.6 在流式开始时启动 requestAnimationFrame 循环，流式结束时取消循环
  - [x] 1.7 处理 thinking 内容的流式回调，同样移除 `flushSync`，采用相同的缓冲节流策略

- [x] Task 2: 优化 StreamingMessage 组件渲染策略
  - [x] 2.1 为 StreamingMessage 组件新增 `isStreaming` 属性，区分流式阶段和完成阶段
  - [x] 2.2 流式阶段（isStreaming=true）：使用纯文本渲染（`whitespace-pre-wrap break-words`），不经过 Markdown 解析
  - [x] 2.3 流式阶段保留闪烁光标动画
  - [x] 2.4 流式结束（isStreaming=false）：切换为 `MarkdownRenderer` 完整渲染

- [x] Task 3: 修复对话面板消息布局对齐
  - [x] 3.1 修改历史消息行容器：AI 消息添加 `justify-start`，用户消息添加 `justify-end`（替换 `flex-row-reverse` 方案）
  - [x] 3.2 用户消息行内部调整：头像和气泡的顺序改为头像在前、气泡在后，通过 `justify-end` + `flex-row-reverse` 实现右对齐
  - [x] 3.3 修改流式消息行容器：添加 `justify-start`，与历史 AI 消息布局一致
  - [x] 3.4 修改加载中（"正在思考"）消息行容器：添加 `justify-start`，与 AI 消息布局一致
  - [x] 3.5 确保所有消息行容器占满宽度（无需额外 w-full，flex 默认 stretch）

- [x] Task 4: 编译验证与部署
  - [x] 4.1 客户端 TypeScript 编译通过
  - [x] 4.2 上传修改文件到服务器
  - [x] 4.3 服务器重新构建客户端
  - [x] 4.4 重启 PM2 服务并验证

# Task Dependencies

- Task 1 和 Task 2 有依赖：Task 2 的 `isStreaming` 属性需要 Task 1 的流式状态判断
- Task 3 独立于 Task 1/2，可并行开发
- Task 4 依赖 Task 1、2、3 全部完成
