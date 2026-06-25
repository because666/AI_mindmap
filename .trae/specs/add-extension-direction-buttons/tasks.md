# Tasks

- [x] Task 1: 实现延伸方向解析工具函数
  - [x] SubTask 1.1: 创建 `client/src/utils/extensionDirections.ts`，实现 `parseExtensionDirections(content: string): { directions: string[]; cleanContent: string }`
  - [x] SubTask 1.2: 支持中文 `🌱 延伸方向：` 与英文 `🌱 Extension Directions:` 两种格式
  - [x] SubTask 1.3: 处理 Markdown 列表项（`- ` 或 `* ` 或 `1. `），过滤空项
  - [x] SubTask 1.4: 编写 `client/src/utils/extensionDirections.test.ts` 覆盖正常、无方向、格式错误、中英文等场景

- [x] Task 2: 添加国际化文案
  - [x] SubTask 2.1: 在 `client/src/locales/chat/zh.json` 添加 `extensionDirectionsTitle`、`exploreDirectionPrompt`、`creatingBranch`、`branchCreateFailed`
  - [x] SubTask 2.2: 在 `client/src/locales/chat/en.json` 添加对应英文翻译

- [x] Task 3: 在 ChatPanel 中渲染延伸方向按钮
  - [x] SubTask 3.1: 在 `client/src/components/Chat/ChatPanel.tsx` 中为每条 assistant 消息调用 `parseExtensionDirections`
  - [x] SubTask 3.2: 渲染 `ExtensionDirectionButtons` 组件，传入方向列表和点击回调
  - [x] SubTask 3.3: 消息正文使用 `cleanContent`，隐藏原始延伸方向文本块
  - [x] SubTask 3.4: 流式消息不渲染按钮

- [x] Task 4: 实现点击按钮的自动分支流程
  - [x] SubTask 4.1: 点击时调用 `createChildNode(currentNodeId, directionText)` 创建子节点
  - [x] SubTask 4.2: 调用 `selectNode(childId)` 切换到新节点
  - [x] SubTask 4.3: 自动生成问题并调用 `sendMessage` 或等效方法向新节点发送
  - [x] SubTask 4.4: 处理加载状态和错误提示

- [x] Task 5: 样式与移动端适配
  - [x] SubTask 5.1: 桌面端按钮水平排列、自动换行
  - [x] SubTask 5.2: 移动端按钮垂直堆叠、全宽或自适应
  - [x] SubTask 5.3: 按钮视觉风格与现有主题一致（primary-400 边框/文字）

- [x] Task 6: 端到端验证
  - [x] SubTask 6.1: 构建产物通过（`npm run build`）
  - [x] SubTask 6.2: 单测覆盖解析、组件渲染、点击回调、移动端布局等核心逻辑
  - [x] SubTask 6.3: 修改文件 ESLint 无新增错误；TypeScript 类型检查通过

# Task Dependencies

- Task 2 依赖 Task 1（需要知道需要哪些文案）
- Task 3 依赖 Task 1 和 Task 2
- Task 4 依赖 Task 3
- Task 5 依赖 Task 3
- Task 6 依赖 Task 4 和 Task 5
