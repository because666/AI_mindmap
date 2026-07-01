# Tasks

- [x] Task 1: 新建预设答案数据文件 `templateAnswers.ts`
  - [x] SubTask 1.1: 定义 `PresetAnswer` 接口（`{ zh: string; en: string }`）和 `TemplateAnswerMap` 类型
  - [x] SubTask 1.2: 定义 `BUILTIN_TEMPLATE_ANSWERS` 常量，按 templateId 组织各节点答案（先留空字符串占位，后续填充）
  - [x] SubTask 1.3: 实现 `getPresetAnswer(templateId, nodeIndex, lang)` 工具函数，支持按语言查询，无答案返回 null

- [x] Task 2: 扩展 `TemplateNode` 类型
  - [x] SubTask 2.1: 在 `templates.ts` 的 `TemplateNode` 接口新增 `presetAnswer?: PresetAnswer` 可选字段（从 `templateAnswers.ts` 导入类型）
  - [x] SubTask 2.2: 更新 `templates.test.ts` 验证类型扩展不破坏现有测试

- [x] Task 3: 重构 `createPresetConversationsForTemplate` 方法
  - [x] SubTask 3.1: 移除 `conversationApi.sendMessage` 调用
  - [x] SubTask 3.2: 改为循环调用 `conversationApi.saveMessage` 写入 user 消息（预置问题）和 assistant 消息（预设答案）
  - [x] SubTask 3.3: 根据 i18n 当前语言选择对应答案（通过 `i18n.language` 或 `i18next.language` 获取）
  - [x] SubTask 3.4: 答案缺失时跳过该节点并输出 `console.warn` 警告
  - [x] SubTask 3.5: 保留 `onProgress` 和 `shouldContinue` 参数签名（兼容），但不再实际使用
  - [x] SubTask 3.6: 写入完成后仍更新节点 `conversationId` 和 `summary`

- [x] Task 4: 移除 `TemplateLibrary.tsx` 进度弹窗
  - [x] SubTask 4.1: 移除 `isCreating`、`progress`、`cancelRef` 状态
  - [x] SubTask 4.2: 移除 `handleCancel` 函数
  - [x] SubTask 4.3: 移除进度覆盖层 JSX（`isCreating && (...)` 块）
  - [x] SubTask 4.4: 简化 `handleSelectTemplate`：调用 `createMapFromTemplate` + `createPresetConversationsForTemplate`（不await或await后直接关闭弹窗）
  - [x] SubTask 4.5: 移除遮罩点击中 `isCreating` 的判断

- [x] Task 5: 编写预设答案内容（中文）
  - [x] SubTask 5.1: 编写 DeepMindMap 使用指南模板 4 个节点的中文答案
  - [x] SubTask 5.2: 编写 Python 入门模板 5 个节点的中文答案
  - [x] SubTask 5.3: 编写机器学习模板 5 个节点的中文答案
  - [x] SubTask 5.4: 编写产品分析模板 5 个节点的中文答案
  - [x] SubTask 5.5: 编写创业验证模板 5 个节点的中文答案

- [x] Task 6: 编写预设答案内容（英文）
  - [x] SubTask 6.1: 编写 DeepMindMap 使用指南模板 4 个节点的英文答案
  - [x] SubTask 6.2: 编写 Python 入门模板 5 个节点的英文答案
  - [x] SubTask 6.3: 编写机器学习模板 5 个节点的英文答案
  - [x] SubTask 6.4: 编写产品分析模板 5 个节点的英文答案
  - [x] SubTask 6.5: 编写创业验证模板 5 个节点的英文答案

- [x] Task 7: 单元测试与验证
  - [x] SubTask 7.1: 为 `getPresetAnswer` 函数编写单元测试（正常查询、语言切换、无答案返回 null）
  - [x] SubTask 7.2: 更新 `templates.test.ts` 验证 `presetAnswer` 字段（presetAnswer 为可选字段，现有测试不破坏）
  - [x] SubTask 7.3: TypeScript 编译通过（`tsc -b` 无错误）
  - [x] SubTask 7.4: 客户端构建通过（`npm run build`）
  - [x] SubTask 7.5: 现有测试全部通过（nodeStore.test.ts 32/32 通过）

- [x] Task 8: 修复预设问答未出现在对话面板的问题
  - [x] SubTask 8.1: 在 `createPresetConversationsForTemplate` 写入预设问答后，将对话及消息同步到前端 `conversations` Map Store
  - [x] SubTask 8.2: 补充单元测试验证 Store 中 `conversations` 已包含预设问答消息
  - [x] SubTask 8.3: TypeScript 编译通过（`tsc -b` 无错误）
  - [x] SubTask 8.4: 客户端构建通过（`npm run build`）
  - [x] SubTask 8.5: 现有测试全部通过（nodeStore.test.ts）

# Task Dependencies
- Task 2 依赖 Task 1（需要导入 PresetAnswer 类型）
- Task 3 依赖 Task 1 和 Task 2（需要 getPresetAnswer 函数和 presetAnswer 字段）
- Task 4 依赖 Task 3（createPresetConversationsForTemplate 不再阻塞）
- Task 5 和 Task 6 可并行，依赖 Task 1（数据结构定义）
- Task 7 依赖 Task 1-4 完成
- Task 8 依赖 Task 3（在 createPresetConversationsForTemplate 逻辑基础上补充 Store 同步）
