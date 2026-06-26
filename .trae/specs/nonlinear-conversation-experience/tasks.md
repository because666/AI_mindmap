# Tasks

> 对应 spec.md：非线性对话核心闭环
> 范围：第一阶段 A（埋点 + 延伸方向 + 节点摘要 + 导航树优化）

---

- [x] Task 1: 用户行为埋点基础设施
  - [x] SubTask 1.1: 创建前端埋点 SDK（`client/src/services/tracker.ts`），支持 `track(eventType, payload)` 与批量上报
  - [x] SubTask 1.2: 创建后端事件接收接口（`server/src/routes/events.ts`），`POST /api/events` 写入 admin MongoDB `events` 集合
  - [x] SubTask 1.3: 在 admin Dashboard 新增"用户行为事件"模块，展示事件总量、7 天趋势图、关键漏斗
  - [x] SubTask 1.4: 在前端关键位置接入埋点（页面访问、节点创建、分支创建、地图创建）

- [x] Task 2: 延伸方向按钮
  - [x] SubTask 2.1: 稳定化 `server/src/config/prompts.ts` 中延伸方向输出格式，确保 AI 稳定输出 `🌱 延伸方向：① xxx ② yyy ③ zzz`
  - [x] SubTask 2.2: 创建前端延伸方向解析工具（`client/src/utils/extensionDirections.ts`），从 AI 回答中提取方向列表并返回纯文本正文
  - [x] SubTask 2.3: 在 `ChatPanel.tsx` 中渲染延伸方向按钮，点击后调用 `createChildNode` 创建子节点
  - [x] SubTask 2.4: 点击按钮后自动切换到子节点并发送问题"请详细讲解：{方向文本}"
  - [x] SubTask 2.5: 接入延伸方向点击埋点（`extension_direction_click`）

- [x] Task 3: 节点自动摘要
  - [x] SubTask 3.1: 在 `server/src/services/nodeService.ts` 的 Node 模型中新增 `summary?: string` 字段，确保持久化与读取
  - [x] SubTask 3.2: 在 `server/src/routes/ai.ts` 或 `nodes.ts` 中新增摘要生成接口，复用 `CONCLUSION_EXTRACTION_PROMPT` 调用一次 AI
  - [x] SubTask 3.3: 在 `ChatPanel.tsx` 中新增"生成摘要"按钮，调用摘要接口并更新节点状态
  - [x] SubTask 3.4: 实现支线结束检测逻辑（对话轮数 4-6 + 3 分钟无新消息 + 语义关键词），在 `chatStore` 中管理定时器
  - [x] SubTask 3.5: 在画布节点卡片、导航树、聊天面板展示摘要（可折叠预览）
  - [x] SubTask 3.6: 接入摘要生成埋点（`summary_generated`）

- [x] Task 4: 节点导航树优化
  - [x] SubTask 4.1: 在 `MindMapThumbnail.tsx` 中高亮当前节点到根节点的路径
  - [x] SubTask 4.2: 在导航树标题栏增加"← 回到上一级"按钮，点击选中父节点并切换对话
  - [x] SubTask 4.3: 进入子节点时自动展开并滚动到当前节点
  - [x] SubTask 4.4: 移动端默认展开导航树
  - [x] SubTask 4.5: "回到上一级"时如果子节点有未摘要的新增对话，提示是否生成摘要

---

# Task Dependencies

- Task 1 是前置任务，Task 2 和 Task 3 依赖 Task 1（埋点接入）
- Task 2 和 Task 3 可在 Task 1 完成后并行
- Task 4 可与 Task 2、Task 3 并行（不依赖埋点）
- Task 3 的 SubTask 4.5（回到上一级提示摘要）依赖 Task 3 的摘要功能完成

# Parallelization

- 第一批：Task 1 + Task 4（无依赖，可并行）
- 第二批：Task 2 + Task 3（依赖 Task 1，可并行）
