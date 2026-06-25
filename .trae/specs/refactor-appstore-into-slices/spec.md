# 拆分 appStore 为职责单一的子 Store Spec

## Why
原 `client/src/stores/appStore.ts` 是一个 2142 行的巨型单文件，违反单一职责原则，导致维护困难、协作冲突频繁、单元测试难以按职责隔离。需要将其按领域职责拆分为多个子 Store 文件，同时保持 `useAppStore` 的统一访问入口不破坏历史引用代码。

## What Changes
- 新建 `client/src/stores/storeUtils.ts`：提供跨 Slice 共享的 `generateId` 工具函数，避免重复定义
- 新建 `client/src/stores/nodeStore.ts`：节点 CRUD、选择、悬停、搜索、复合节点、结论节点、自动布局等逻辑的 NodeSlice
- 新建 `client/src/stores/relationStore.ts`：关系类型定义、关系 CRUD、关系迁移的 RelationSlice
- 新建 `client/src/stores/conversationStore.ts`：对话 CRUD、上下文构建的 ConversationSlice
- 新建 `client/src/stores/commandStore.ts`：撤销/重做栈管理的 CommandSlice
- 新建 `client/src/stores/syncStore.ts`：数据加载、归一化、迁移、同步的 SyncSlice
- 重写 `client/src/stores/appStore.ts`：作为聚合入口，组合所有 Slice，内联保留 UI 编排 Slice（activePanel、requestOpenChat、clearAllData 等）
- 修改 `client/src/components/Chat/ChatPanel.tsx`：移除预先存在的未使用 `SendMessageOptions` 接口死代码，解除构建阻塞
- 保持 `useAppStore`、`useAppStore(selector)`、`useAppStore.getState()`、`useAppStore.setState()` 全部向后兼容
- 透传导出 `useNodeStore`、`useRelationStore`、`useConversationStore`、`useCommandStore`、`useSyncStore` 便捷 Hook
- 透传导出 `NodeData`、`RelationData`、`RelationType`、`ConversationData`、`Command`、`PanelType`、`getRelationTypeLabels`、`RELATION_TYPE_LABELS` 类型与常量

## Impact
- Affected specs: 无直接影响其他 spec，本任务为代码结构重构
- Affected code:
  - `client/src/stores/appStore.ts`（重写为聚合入口）
  - `client/src/stores/nodeStore.ts`、`relationStore.ts`、`conversationStore.ts`、`commandStore.ts`、`syncStore.ts`、`storeUtils.ts`（新建）
  - `client/src/components/Chat/ChatPanel.tsx`（移除死代码）
  - 13 个使用 `useAppStore` 的组件文件（无需修改，向后兼容）
  - `client/src/services/toolExecutor.ts`（使用 `ReturnType<typeof useAppStore.getState>` 类型，兼容）
  - `client/src/stores/visitorWorkspaceStore.ts`（使用 `useAppStore.getState().clearAllData()`，兼容）

## ADDED Requirements

### Requirement: 子 Store 文件按职责拆分
系统 SHALL 将原 appStore.ts 的状态与方法按领域职责拆分到 5 个子 Store 文件，每个文件仅包含单一职责的逻辑。

#### Scenario: 节点相关逻辑位于 nodeStore
- **WHEN** 开发者需要修改节点 CRUD、选择、悬停、搜索、复合节点、结论节点、自动布局逻辑
- **THEN** 应在 `client/src/stores/nodeStore.ts` 中进行修改

#### Scenario: 关系相关逻辑位于 relationStore
- **WHEN** 开发者需要修改关系类型、关系 CRUD、关系迁移逻辑
- **THEN** 应在 `client/src/stores/relationStore.ts` 中进行修改

#### Scenario: 对话相关逻辑位于 conversationStore
- **WHEN** 开发者需要修改对话 CRUD、上下文构建逻辑
- **THEN** 应在 `client/src/stores/conversationStore.ts` 中进行修改

#### Scenario: 撤销/重做逻辑位于 commandStore
- **WHEN** 开发者需要修改撤销/重做栈管理逻辑
- **THEN** 应在 `client/src/stores/commandStore.ts` 中进行修改

#### Scenario: 数据同步逻辑位于 syncStore
- **WHEN** 开发者需要修改数据加载、归一化、迁移、同步逻辑
- **THEN** 应在 `client/src/stores/syncStore.ts` 中进行修改

### Requirement: 聚合入口保持向后兼容
系统 SHALL 保留 `appStore.ts` 作为聚合入口，组合所有 Slice 创建统一的 `useAppStore`，确保历史引用代码无需修改。

#### Scenario: useAppStore 选择器用法兼容
- **WHEN** 组件使用 `useAppStore(selector)` 选择特定状态
- **THEN** 应正常工作，返回选择的状态切片

#### Scenario: useAppStore 全量解构用法兼容
- **WHEN** 组件使用 `useAppStore()` 解构全部状态
- **THEN** 应正常工作，返回包含所有 Slice 状态的完整对象

#### Scenario: useAppStore.getState 非组件内读取兼容
- **WHEN** 非组件代码使用 `useAppStore.getState()` 读取状态
- **THEN** 应正常工作，返回完整状态对象

#### Scenario: useAppStore.setState 非组件内写入兼容
- **WHEN** 非组件代码使用 `useAppStore.setState(partial)` 写入状态
- **THEN** 应正常工作，更新对应状态字段

### Requirement: 跨 Slice 状态访问
系统 SHALL 通过基于完整 `AppState` 类型的 `set`/`get` 参数，支持 Slice 之间的跨域状态读写。

#### Scenario: deleteNode 跨域修改状态
- **WHEN** 调用 `deleteNode` 删除节点
- **THEN** 应同时修改 nodes、relations、conversations、manuallyTitledNodeIds 等跨 Slice 状态

### Requirement: 便捷 Hook 透传导出
系统 SHALL 从 appStore 透传导出各子 Store 的便捷 Hook，便于组件按职责逐步迁移引用。

#### Scenario: 组件按职责引用子 Store Hook
- **WHEN** 组件仅需节点相关状态
- **THEN** 可使用 `useNodeStore(selector)` 替代 `useAppStore(selector)`，语义更清晰

## MODIFIED Requirements

### Requirement: appStore 文件职责
原 `appStore.ts` 持有全部状态与方法，现修改为聚合入口，仅负责组合各 Slice、提供 UI 编排 Slice、配置 persist 中间件、透传导出子 Store Hook 与类型。

## REMOVED Requirements
无移除项。所有原 appStore 的功能均保留，仅做文件组织结构调整。
