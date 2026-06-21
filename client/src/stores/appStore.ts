/**
 * 应用状态聚合 Store（appStore）
 *
 * 本文件是各子 Store（Slice）的聚合入口，采用 zustand 官方推荐的 Slice 模式：
 * - 节点相关逻辑位于 ./nodeStore（createNodeSlice）
 * - 关系相关逻辑位于 ./relationStore（createRelationSlice）
 * - 对话相关逻辑位于 ./conversationStore（createConversationSlice）
 * - 撤销/重做逻辑位于 ./commandStore（createCommandSlice）
 * - 数据加载/同步逻辑位于 ./syncStore（createSyncSlice）
 * - 面板、聊天请求、全量重置等 UI 编排状态由本文件内联的 UI Slice 提供
 *
 * 所有 Slice 的状态最终由 useAppStore 统一持有，跨 Slice 的状态依赖通过 set/get 访问。
 * 这样既保证了单一职责的代码组织，又保留了 useAppStore 的统一访问入口
 * （支持 useAppStore(selector)、useAppStore()、useAppStore.getState()、useAppStore.setState()），
 * 确保历史引用代码不破坏。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createNodeSlice, type NodeSlice } from './nodeStore';
import { createRelationSlice, type RelationSlice } from './relationStore';
import { createConversationSlice, type ConversationSlice } from './conversationStore';
import { createCommandSlice, type CommandSlice } from './commandStore';
import { createSyncSlice, type SyncSlice } from './syncStore';

// 便捷 Hook 透传导出，便于组件按职责逐步迁移引用
export { useNodeStore } from './nodeStore';
export { useRelationStore } from './relationStore';
export { useConversationStore } from './conversationStore';
export { useCommandStore } from './commandStore';
export { useSyncStore } from './syncStore';

// 类型与常量透传导出，保持历史 import { type Xxx } from './appStore' 可用
export type { NodeData } from './nodeStore';
export type { RelationData, RelationType } from './relationStore';
export type { ConversationData } from './conversationStore';
export type { Command } from './commandStore';
export { getRelationTypeLabels, RELATION_TYPE_LABELS } from './relationStore';

/**
 * 面板类型定义
 */
export type PanelType = 'search' | 'history' | 'settings' | 'files' | null;

/**
 * UI 编排 Slice 接口
 * 负责面板切换、聊天打开请求、全量数据重置等跨域编排状态
 */
export interface UISlice {
  /** 当前激活的面板 */
  activePanel: PanelType;
  /** 请求打开聊天的目标节点ID */
  requestOpenChatForNode: string | null;
  /** 设置当前激活的面板 */
  setActivePanel: (panel: PanelType) => void;
  /** 请求打开指定节点的聊天面板 */
  requestOpenChat: (nodeId: string) => void;
  /** 清除聊天面板打开请求 */
  clearChatRequest: () => void;
  /** 清除所有数据（工作区切换时使用） */
  clearAllData: () => void;
}

/**
 * 应用状态接口（聚合各 Slice）
 */
export type AppState = NodeSlice & RelationSlice & ConversationSlice & CommandSlice & SyncSlice & UISlice;

/**
 * 应用状态管理 Store（聚合入口）
 *
 * 通过组合各子 Slice 创建，保留 useAppStore 的统一访问能力：
 * - useAppStore(selector) 选择器用法
 * - useAppStore() 全量解构用法
 * - useAppStore.getState() 非组件内读取
 * - useAppStore.setState() 非组件内写入
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 组合各子 Slice
      ...createNodeSlice(set, get),
      ...createRelationSlice(set, get),
      ...createConversationSlice(set, get),
      ...createCommandSlice(set, get),
      ...createSyncSlice(set, get),

      // UI 编排 Slice（内联）
      activePanel: null,
      requestOpenChatForNode: null,

      /**
       * 设置当前激活的面板
       * @param panel - 面板类型，传入null关闭所有面板
       */
      setActivePanel: (panel: PanelType) => {
        set({ activePanel: panel });
      },

      /**
       * 请求打开指定节点的聊天面板
       * @param nodeId - 目标节点ID
       */
      requestOpenChat: (nodeId: string) => {
        set({ requestOpenChatForNode: nodeId });
      },

      /**
       * 清除聊天面板打开请求
       */
      clearChatRequest: () => {
        set({ requestOpenChatForNode: null });
      },

      /**
       * 清除所有数据（工作区切换时使用）
       * 重置节点、关系、对话、撤销/重做栈、搜索、面板等所有状态
       */
      clearAllData: () => {
        set({
          nodes: new Map(),
          relations: [],
          conversations: new Map(),
          manuallyTitledNodeIds: new Set(),
          selectedNodeId: null,
          hoveredNodeId: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          searchQuery: '',
          searchResults: [],
          activePanel: null,
          requestOpenChatForNode: null,
        });
      },
    }),
    {
      name: 'deep-mind-map-storage',
      partialize: (state) => ({
        selectedNodeId: state.selectedNodeId,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.nodes = new Map();
          state.relations = [];
          state.conversations = new Map();
          state.manuallyTitledNodeIds = new Set();
        }
      }
    }
  )
);
