# 修复 SSE 流式响应与 LaTeX 公式渲染 Spec

## Why
用户反馈 AI 对话响应是一次性出现而非流式输出，且数学公式无法正确渲染。

经服务器实地排查确认：
1. **SSE 非流式根因**：[server/src/index.ts](file:///d:/study1/DeepMindMap/v2/server/src/index.ts#L75) 全局启用了 `compression()` 中间件，对 SSE 响应（`text/event-stream`）也进行 gzip 压缩，导致数据被缓冲到一定大小才发送，破坏流式传输。已通过服务器本地直连智谱 API 验证：上游 AI 服务本身是真正流式返回的（每个 chunk 独立 `data:` 行），问题完全在 Node.js 服务端。
2. **公式渲染根因**：[client/src/components/Chat/MarkdownRenderer.tsx](file:///d:/study1/DeepMindMap/v2/client/src/components/Chat/MarkdownRenderer.tsx) 只使用了 `react-markdown` + `remark-gfm`，未接入 `remark-math` + `rehype-katex`，无法渲染 `$...$` 和 `$$...$$` 语法的 LaTeX 公式。
3. **前端打字机效果**：[client/src/components/Chat/ChatPanel.tsx](file:///d:/study1/DeepMindMap/v2/client/src/components/Chat/ChatPanel.tsx#L751-L782) 的 `flushBufferToDisplay` 每帧只追加 3 个字符，即使后端流式正常，前端也会人为拖慢显示。用户明确要求"流畅的流式输出"，需要调整。

## What Changes
- **后端**：在 `server/src/index.ts` 中为 SSE 响应路径（`/api/ai/chat/stream`、`/api/conversations/generate-title`、`/api/conversations/extract-conclusion` 等所有 `text/event-stream` 路由）跳过 compression 中间件，或采用 condition compression 策略排除 SSE
- **前端渲染**：在 `client/src/components/Chat/MarkdownRenderer.tsx` 中接入 `remark-math` 和 `rehype-katex`，并引入 KaTeX 的 CSS 样式
- **前端流式显示**：调整 `client/src/components/Chat/ChatPanel.tsx` 的 `flushBufferToDisplay`，提升每帧刷入字符数或改为直接显示，保证流式输出流畅
- **依赖引入**：需新增 `remark-math`、`rehype-katex`、`katex` 三个前端依赖（经用户确认后引入）

## Impact
- 受影响的代码：
  - `server/src/index.ts`（compression 中间件配置）
  - `client/src/components/Chat/MarkdownRenderer.tsx`（公式渲染）
  - `client/src/components/Chat/ChatPanel.tsx`（打字机效果）
  - `client/package.json`（新增依赖）
- 受影响的功能：
  - AI 对话流式响应（所有使用 SSE 的接口）
  - AI 回复内容中的数学公式渲染
  - AI 回复的显示流畅度
- **BREAKING**：无破坏性变更，仅修复 bug 和增强渲染能力

## ADDED Requirements

### Requirement: SSE 响应跳过 compression
The system SHALL skip compression middleware for all SSE (`text/event-stream`) responses to ensure streaming data is sent immediately without buffering.

#### Scenario: SSE 流式响应不被压缩
- **WHEN** 客户端请求 `/api/ai/chat/stream` 等 SSE 接口
- **THEN** 响应头不包含 `Content-Encoding: gzip`
- **AND** 每个 SSE chunk 应立即发送到客户端，不缓冲

### Requirement: LaTeX 数学公式渲染
The system SHALL render LaTeX mathematical formulas in AI responses using KaTeX, supporting both inline (`$...$`) and block (`$$...$$`) formula syntax.

#### Scenario: 行内公式渲染
- **WHEN** AI 回复包含行内公式如 `$E = mc^2$`
- **THEN** 公式应以 KaTeX 渲染的 HTML 形式展示，而非原始文本

#### Scenario: 块级公式渲染
- **WHEN** AI 回复包含块级公式如 `$$\int_0^1 x^2 dx$$`
- **THEN** 公式应以居中的 KaTeX 渲染块展示

### Requirement: 流畅的流式输出显示
The system SHALL display AI streaming responses fluently without artificial character-per-frame throttling that causes noticeable lag.

#### Scenario: 流式内容即时显示
- **WHEN** 后端推送流式内容 chunk
- **THEN** 前端应在下一帧内将内容追加到显示区域
- **AND** 不应有人为的每帧 3 字符限制导致的内容积压

## MODIFIED Requirements

### Requirement: compression 中间件配置
[Complete modified requirement]
`server/src/index.ts` 中的 `app.use(compression())` 应改为条件式压缩，对 `text/event-stream` 类型的响应或 SSE 路径跳过压缩。推荐方案：使用 `compression({ filter })` 自定义过滤函数，当响应头 `Content-Type` 为 `text/event-stream` 时返回 false 跳过压缩。
