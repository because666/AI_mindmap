# Checklist

- [x] 子 Store 文件按职责拆分
  - [x] `client/src/stores/storeUtils.ts` 存在并导出 `generateId`
  - [x] `client/src/stores/nodeStore.ts` 存在并导出 `createNodeSlice`、`NodeSlice`、`NodeData`、`useNodeStore`、`migrateNodeData`
  - [x] `client/src/stores/relationStore.ts` 存在并导出 `createRelationSlice`、`RelationSlice`、`RelationData`、`RelationType`、`useRelationStore`、`getRelationTypeLabels`、`RELATION_TYPE_LABELS`、`migrateRelationsData`
  - [x] `client/src/stores/conversationStore.ts` 存在并导出 `createConversationSlice`、`ConversationSlice`、`ConversationData`、`useConversationStore`
  - [x] `client/src/stores/commandStore.ts` 存在并导出 `createCommandSlice`、`CommandSlice`、`Command`、`useCommandStore`
  - [x] `client/src/stores/syncStore.ts` 存在并导出 `createSyncSlice`、`SyncSlice`、`useSyncStore`

- [x] 聚合入口保持向后兼容
  - [x] `client/src/stores/appStore.ts` 作为聚合入口，组合所有 Slice
  - [x] `useAppStore` 导出保留，支持 `useAppStore(selector)`、`useAppStore()`、`useAppStore.getState()`、`useAppStore.setState()`
  - [x] `AppState` 类型定义为各 Slice 的交集类型
  - [x] persist 中间件配置保留（name: 'deep-mind-map-storage'、partialize、onRehydrateStorage）
  - [x] UI 编排 Slice 内联保留（activePanel、requestOpenChatForNode、setActivePanel、requestOpenChat、clearChatRequest、clearAllData）

- [x] 透传导出子 Store Hook 与类型
  - [x] 透传导出 `useNodeStore`、`useRelationStore`、`useConversationStore`、`useCommandStore`、`useSyncStore`
  - [x] 透传导出 `NodeData`、`RelationData`、`RelationType`、`ConversationData`、`Command` 类型
  - [x] 透传导出 `PanelType` 类型
  - [x] 透传导出 `getRelationTypeLabels`、`RELATION_TYPE_LABELS` 常量

- [x] 跨 Slice 状态访问正常
  - [x] Slice creator 的 `set`/`get` 类型基于完整 `AppState`
  - [x] `deleteNode` 等跨域方法可正常修改 nodes、relations、conversations 等状态

- [x] 编码规范符合
  - [x] 所有函数、类、方法、Hook 添加完整 JSDoc 中文注释
  - [x] 全程禁止使用 any 类型
  - [x] 完整定义类型、接口，类型语义化
  - [x] 遵循项目已配置的 ESLint、Prettier 规则

- [x] 构建验证通过
  - [x] `cd client && npx tsc --noEmit -p tsconfig.app.json` 零类型错误
  - [x] `cd client && npm run build` 成功（EXIT_CODE=0）

- [x] 测试验证
  - [x] store 相关测试全部通过（apiConfigStore.test.ts、chatService.test.ts、mobileService.test.ts、dataMigration.test.ts 等）
  - [x] 预先存在且与本任务无关的失败测试已记录（markdownRenderer.test.ts 的 2 个用例：headings with extra spaces、nested lists）

- [x] 历史引用代码不破坏
  - [x] 13 个使用 `useAppStore` 的组件文件无需修改
  - [x] `client/src/services/toolExecutor.ts` 使用 `ReturnType<typeof useAppStore.getState>` 类型兼容
  - [x] `client/src/stores/visitorWorkspaceStore.ts` 使用 `useAppStore.getState().clearAllData()` 兼容
  - [x] `client/src/components/Chat/ChatPanel.tsx` 使用 `useAppStore.setState({ conversations })` 兼容

- [x] 临时文件清理
  - [x] `client/test_output.txt` 已不存在
