# Tasks

> 对应 spec.md：输入框智能分叉提示
> 范围：规则匹配检测 + 提示 UI + 自动创建分支 + 埋点

---

- [x] Task 1: 智能分叉检测工具
  - [x] SubTask 1.1: 创建 `client/src/utils/branchSuggestion.ts`，实现规则匹配检测函数 `detectBranchSuggestion(input, currentNodeTitle, recentMessages)`
  - [x] SubTask 1.2: 实现深入关键词匹配（详细解释、深入讲解、展开讲讲、具体说说、为什么、怎么回事、实现原理、底层原理、工作原理等）
  - [x] SubTask 1.3: 实现对比类关键词匹配（有什么区别、有什么不同、对比、优缺点、利弊等）
  - [x] SubTask 1.4: 实现语义偏离检测（提取用户问题中的名词概念，与当前节点标题计算交集）
  - [x] SubTask 1.5: 实现子主题提取（从用户输入中提取简短子主题用于节点标题和提示文案）
  - [x] SubTask 1.6: 编写单元测试 `client/src/utils/branchSuggestion.test.ts`，覆盖各规则命中/不命中、边界情况

- [x] Task 2: 分叉提示 UI 与交互
  - [x] SubTask 2.1: 在 `ChatPanel.tsx` 输入框上方新增提示气泡组件，展示分叉建议文案 + "创建分支"按钮 + "忽略"按钮
  - [x] SubTask 2.2: 用户输入时实时调用 `detectBranchSuggestion` 检测（防抖 500ms）
  - [x] SubTask 2.3: 点击"创建分支"后调用 `createChildNode` 创建子节点，自动切换并发送用户原始问题
  - [x] SubTask 2.4: 点击"忽略"或直接发送消息时关闭提示
  - [x] SubTask 2.5: 提示频率控制：当前节点忽略一次后不再触发，切换节点后重置

- [x] Task 5: 优化提示频率控制
  - [x] SubTask 5.1: 修改 `ChatPanel.tsx`，将"忽略"从"当前节点永久禁用"改为"仅对当前输入内容生效"
  - [x] SubTask 5.2: 用户忽略提示后清空当前输入内容时，重新检测新输入
  - [x] SubTask 5.3: 用户发送消息后，允许下一条输入继续触发提示
  - [x] SubTask 5.4: 只有当同一输入内容重复触发时，才避免重复提示
  - [x] SubTask 5.5: 构建与回归测试通过

- [x] Task 3: 分叉建议埋点
  - [x] SubTask 3.1: 在 `client/src/services/tracker.ts` 新增 3 个事件常量：`branch_suggestion_shown`、`branch_suggestion_accepted`、`branch_suggestion_dismissed`
  - [x] SubTask 3.2: 提示展示时上报 `branch_suggestion_shown`（载荷：nodeId、suggestionText、triggerRule）
  - [x] SubTask 3.3: 用户接受时上报 `branch_suggestion_accepted`（载荷：nodeId、childNodeId、suggestionText）
  - [x] SubTask 3.4: 用户忽略时上报 `branch_suggestion_dismissed`（载荷：nodeId、suggestionText）

- [x] Task 4: i18n 与构建验证
  - [x] SubTask 4.1: 在 `client/src/locales/chat/zh.json` 和 `en.json` 中新增分叉提示相关文案
  - [x] SubTask 4.2: TypeScript 编译通过、ESLint 通过、构建通过、单元测试通过

---

# Task Dependencies

- Task 1 是前置，Task 2 和 Task 3 依赖 Task 1
- Task 2 和 Task 3 可并行
- Task 4 依赖 Task 1-3 完成

# Parallelization

- 第一批：Task 1（检测工具 + 测试）
- 第二批：Task 2 + Task 3（UI 交互 + 埋点，可并行）
- 第三批：Task 4（i18n + 全量验证）
