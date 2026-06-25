# Tasks

- [x] Task 1: 创建共享工具文件 storeUtils.ts
  - [x] SubTask 1.1: 创建 `client/src/stores/storeUtils.ts`，导出 `generateId` 函数，供各子 Store 共享使用

- [x] Task 2: 拆分节点相关逻辑到 nodeStore.ts
  - [x] SubTask 2.1: 创建 `client/src/stores/nodeStore.ts`，定义 `NodeData` 接口、`NodeSlice` 接口
  - [x] SubTask 2.2: 实现 `createNodeSlice` 函数，包含 createRootNode、createChildNode、addNode、updateNode、deleteNode、selectNode、hoverNode、setSearchQuery、searchNodes、markNodeManuallyTitled、isNodeManuallyTitled、createCompositeNode、expandCompositeNode、createConclusionNode、autoLayout
  - [x] SubTask 2.3: 实现 `migrateNodeData` 数据迁移函数
  - [x] SubTask 2.4: 导出 `useNodeStore` 便捷 Hook，基于 `useAppStore` 选择器

- [x] Task 3: 拆分关系相关逻辑到 relationStore.ts
  - [x] SubTask 3.1: 创建 `client/src/stores/relationStore.ts`，定义 `RelationType`、`RelationData`、`RelationSlice` 接口
  - [x] SubTask 3.2: 实现 `createRelationSlice` 函数，包含关系 CRUD
  - [x] SubTask 3.3: 导出 `RELATION_TYPE_LABELS` 常量、`getRelationTypeLabels` 函数、`migrateRelationsData` 迁移函数
  - [x] SubTask 3.4: 导出 `useRelationStore` 便捷 Hook

- [x] Task 4: 拆分对话相关逻辑到 conversationStore.ts
  - [x] SubTask 4.1: 创建 `client/src/stores/conversationStore.ts`，定义 `ConversationData`、`ConversationSlice` 接口
  - [x] SubTask 4.2: 实现 `createConversationSlice` 函数，包含对话 CRUD、上下文构建，定义 `MAX_CONTEXT_DEPTH = 15`
  - [x] SubTask 4.3: 导出 `useConversationStore` 便捷 Hook

- [x] Task 5: 拆分撤销/重做逻辑到 commandStore.ts
  - [x] SubTask 5.1: 创建 `client/src/stores/commandStore.ts`，定义 `Command`、`CommandSlice` 接口
  - [x] SubTask 5.2: 实现 `createCommandSlice` 函数，包含 undo/redo 栈管理，定义 `MAX_STACK_SIZE = 30`
  - [x] SubTask 5.3: 导出 `useCommandStore` 便捷 Hook

- [x] Task 6: 拆分数据同步逻辑到 syncStore.ts
  - [x] SubTask 6.1: 创建 `client/src/stores/syncStore.ts`，定义 `SyncSlice` 接口
  - [x] SubTask 6.2: 实现 `createSyncSlice` 函数，包含数据加载、归一化、迁移、同步，导入 `migrateNodeData` 和 `migrateRelationsData`
  - [x] SubTask 6.3: 实现 `normalizeConversation` 辅助函数
  - [x] SubTask 6.4: 导出 `useSyncStore` 便捷 Hook

- [x] Task 7: 重写 appStore.ts 为聚合入口
  - [x] SubTask 7.1: 导入所有 Slice creator 与 Slice 类型
  - [x] SubTask 7.2: 定义 `AppState = NodeSlice & RelationSlice & ConversationSlice & CommandSlice & SyncSlice & UISlice`
  - [x] SubTask 7.3: 内联实现 UI 编排 Slice（activePanel、requestOpenChatForNode、setActivePanel、requestOpenChat、clearChatRequest、clearAllData）
  - [x] SubTask 7.4: 通过 `create<AppState>()(persist(...))` 组合所有 Slice，配置 persist 中间件（name、partialize、onRehydrateStorage）
  - [x] SubTask 7.5: 透传导出所有子 Store Hook、类型、常量

- [x] Task 8: 清理预先存在的死代码
  - [x] SubTask 8.1: 移除 `client/src/components/Chat/ChatPanel.tsx` 中未使用的 `SendMessageOptions` 接口，解除构建阻塞

- [x] Task 9: 构建与类型检查验证
  - [x] SubTask 9.1: 运行 `cd client && npx tsc --noEmit -p tsconfig.app.json`，确认零类型错误
  - [x] SubTask 9.2: 运行 `cd client && npm run build`，确认构建成功（tsc -b + vite build 均通过）

- [x] Task 10: 运行现有测试套件
  - [x] SubTask 10.1: 运行 `cd client && npx vitest run`，确认 store 相关测试全部通过
  - [x] SubTask 10.2: 记录预先存在且与本任务无关的失败测试（markdownRenderer.test.ts 的 2 个用例）

# Task Dependencies
- Task 2-6 依赖 Task 1（共享 generateId）
- Task 7 依赖 Task 2-6（聚合各 Slice）
- Task 8 独立，可与 Task 2-6 并行
- Task 9 依赖 Task 7、Task 8
- Task 10 依赖 Task 9
