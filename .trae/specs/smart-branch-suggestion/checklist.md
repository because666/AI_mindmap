# Checklist

> 对应 spec.md：输入框智能分叉提示

---

## 智能分叉检测

- [x] `branchSuggestion.ts` 中 `detectBranchSuggestion` 函数已实现
- [x] 深入关键词匹配覆盖（详细解释、深入讲解、展开讲讲、具体说说、为什么、怎么回事、实现原理、底层原理、工作原理、常见错误、注意事项、历史背景、最佳实践等）
- [x] 对比类关键词匹配覆盖（有什么区别、有什么不同、对比、优缺点、利弊、适用场景等）
- [x] 语义偏离检测：用户问题核心概念与当前节点标题交集较低时触发
- [x] 子主题提取：从用户输入中提取简短文本用于节点标题和提示文案
- [x] 不命中任何规则时返回 null，不干扰正常对话
- [x] 单元测试覆盖各规则命中/不命中、边界情况

## 分叉提示 UI

- [x] 输入框上方显示提示气泡，不阻塞用户输入
- [x] 提示文案格式为："这个问题更像是在聊'{子主题}'，是否创建一个分支？"
- [x] 提示气泡包含"创建分支"按钮和"忽略"按钮
- [x] 用户输入时实时检测（防抖 500ms）
- [x] 点击"创建分支"后自动创建子节点并切换
- [x] 创建子节点后自动发送用户原始问题给 AI
- [x] 点击"忽略"或直接发送消息时提示消失
- [x] 切换节点后提示频率控制重置

## 提示频率控制优化

- [x] "忽略"仅对当前输入的同一提示生效，不永久禁用当前节点
- [x] 用户清空输入后重新输入可再次触发提示
- [x] 用户发送消息后下一条输入可再次触发提示
- [x] 同一输入内容重复触发时避免反复提示
- [x] 创建分支后重置忽略记录

## 分叉建议埋点

- [x] `tracker.ts` 新增 `branch_suggestion_shown` 事件常量
- [x] `tracker.ts` 新增 `branch_suggestion_accepted` 事件常量
- [x] `tracker.ts` 新增 `branch_suggestion_dismissed` 事件常量
- [x] 提示展示时上报 `branch_suggestion_shown`（含 nodeId、suggestionText、triggerRule）
- [x] 用户接受时上报 `branch_suggestion_accepted`（含 nodeId、childNodeId、suggestionText）
- [x] 用户忽略时上报 `branch_suggestion_dismissed`（含 nodeId、suggestionText）

## i18n

- [x] `zh.json` 新增分叉提示相关文案
- [x] `en.json` 新增对应英文文案

## 代码质量

- [x] 所有新增函数有 JSDoc 中文注释
- [x] 所有 TypeScript 代码无 `any` 类型
- [x] 异步操作有异常捕获与错误处理
- [x] 埋点上报失败时静默处理，不影响用户操作
- [x] `npx tsc --noEmit` 通过
- [x] `npm run build` 通过
- [x] `npm run lint` 通过
- [x] 单元测试全部通过
