# Tasks

- [x] Task 1: 修复流式路径上下文截断：在 /api/ai/chat/stream 中添加截断逻辑
  - [x] SubTask 1.1: 将截断逻辑提取为独立的 contextUtils.ts 工具模块
  - [x] SubTask 1.2: 在 ai.ts 流式聊天端点中调用截断逻辑
  - [x] SubTask 1.3: 截断后通过 SSE 事件通知客户端（event: context_truncated）

- [x] Task 2: 实现按节点粒度截断：确保每个保留节点的对话是完整的
  - [x] SubTask 2.1: 识别消息中的节点边界（`[节点: xxx]` system 消息）
  - [x] SubTask 2.2: 将消息按节点分组，整组保留或整组移除
  - [x] SubTask 2.3: 优先保留直接父节点链（parentIds 路径），其次保留关系节点

- [x] Task 3: 被省略节点摘要替代：截断时为被省略节点生成摘要信息
  - [x] SubTask 3.1: 被整体移除的节点组插入摘要替代消息 `[省略的节点: {title} - {summary前50字}]`
  - [x] SubTask 3.2: 无 summary 的节点仅显示 `[省略的节点: {title}]`

- [x] Task 4: Token 估算精度提升：调整估算系数
  - [x] SubTask 4.1: 服务端 estimateTokens 系数从 0.7 改为 1.2
  - [x] SubTask 4.2: 客户端 estimateTokens 系数从 0.7 改为 1.2

- [x] Task 5: 模型映射补全：覆盖所有可用模型
  - [x] SubTask 5.1: 服务端 MODEL_CONTEXT_WINDOWS 新增 11 个模型
  - [x] SubTask 5.2: 客户端 MODEL_CONTEXT_WINDOWS 新增 11 个模型（保持同步）

- [x] Task 6: 深度限制统一和截断阈值调整
  - [x] SubTask 6.1: 客户端 MAX_CONTEXT_DEPTH 从 20 改为 15
  - [x] SubTask 6.2: 服务端深度限制从 10 改为 15
  - [x] SubTask 6.3: 截断阈值从 0.8 改为 0.85

# Task Dependencies

- Task 2 依赖 Task 1 ✅
- Task 3 依赖 Task 2 ✅
- Task 4, 5, 6 独立，已并行完成 ✅
