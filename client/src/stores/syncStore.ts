/**
 * 同步 Store（Slice）
 * 负责从服务端加载节点、关系、对话数据，以及工作区数据重载。
 *
 * 说明：本文件采用 zustand 的 Slice 模式，导出 createSyncSlice 用于在 appStore 中组合。
 * 状态最终由聚合 Store（useAppStore）统一持有，跨 Slice 的状态依赖通过 get() 访问。
 */
import type { AppState } from './appStore';
import { useAppStore } from './appStore';
import { generateId } from './storeUtils';
import { nodeApi, conversationApi } from '../services/api';
import { migrateNodeData, type NodeData } from './nodeStore';
import { migrateRelationsData, type RelationData } from './relationStore';
import type { ConversationData } from './conversationStore';
import type { IMessage } from '../types';

/**
 * 同步 Slice 状态与方法接口
 */
export interface SyncSlice {
  /**
   * 从API加载数据（工作区切换后使用）
   * @param data - 包含nodes和relations的API响应数据
   */
  loadNodesFromApi: (data: { nodes: unknown[]; relations: unknown[] }) => void;
  /**
   * 从API加载对话数据
   * @param conversations - 服务端返回的对话列表
   */
  loadConversationsFromApi: (conversations: unknown[]) => void;
  /**
   * 从服务端重新加载当前工作区的全部数据
   * 用于手动同步、网络恢复后同步、App恢复前台后同步等场景
   * @returns 是否同步成功
   */
  reloadWorkspaceData: () => Promise<boolean>;
}

/**
 * Slice 的 set 函数类型（操作聚合 Store 的全量状态）
 */
type SliceSet = (
  partial: AppState | Partial<AppState> | ((state: AppState) => AppState | Partial<AppState>)
) => void;

/**
 * Slice 的 get 函数类型（返回聚合 Store 的全量状态）
 */
type SliceGet = () => AppState;

/**
 * 将服务端返回的原始对话数据规范化为 ConversationData
 * @param conv - 原始对话数据
 * @returns 规范化后的 ConversationData
 */
const normalizeConversation = (conv: ConversationData): ConversationData => {
  return {
    ...conv,
    createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
    updatedAt: conv.updatedAt ? new Date(conv.updatedAt) : new Date(),
    messages: (conv.messages || []).map((msg: { _id?: string; role?: string; content?: string; timestamp?: string | Date }) => ({
      _id: msg._id || generateId(),
      role: (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user') as IMessage['role'],
      content: msg.content || '',
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    })),
  };
};

/**
 * 创建同步 Slice
 * @param set - 聚合 Store 的 set 函数
 * @param get - 聚合 Store 的 get 函数
 * @returns 同步 Slice 的状态与方法
 */
export const createSyncSlice = (set: SliceSet, get: SliceGet): SyncSlice => ({
  /**
   * 从API加载数据（工作区切换后使用）
   * @param data - 包含nodes和relations的API响应数据
   */
  loadNodesFromApi: (data: { nodes: unknown[]; relations: unknown[] }) => {
    const newNodes = new Map<string, NodeData>();
    for (const node of data.nodes as NodeData[]) {
      const migratedNode = migrateNodeData(node);
      newNodes.set(node.id, migratedNode);
    }

    const newRelations = migrateRelationsData(data.relations as RelationData[]);

    set({
      nodes: newNodes,
      relations: newRelations,
      selectedNodeId: null,
      hoveredNodeId: null,
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    });
  },

  /**
   * 从API加载对话数据（工作区切换后使用）
   * @param conversations - 服务端返回的对话列表
   */
  loadConversationsFromApi: (conversations: unknown[]) => {
    const newConversations = new Map<string, ConversationData>();
    const newNodes = new Map(get().nodes);

    for (const conv of conversations as ConversationData[]) {
      if (!conv || !conv.id || !conv.nodeId) continue;

      newConversations.set(conv.id, normalizeConversation(conv));

      const node = newNodes.get(conv.nodeId);
      if (node && node.conversationId !== conv.id) {
        newNodes.set(conv.nodeId, { ...node, conversationId: conv.id });
      }
    }

    set({
      conversations: newConversations,
      nodes: newNodes,
    });
  },

  /**
   * 从服务端重新加载当前工作区的全部数据
   * 用于手动同步、网络恢复后同步、App恢复前台后同步等场景
   * @returns 是否同步成功
   */
  reloadWorkspaceData: async (): Promise<boolean> => {
    try {
      const result = await nodeApi.getAll() as unknown as {
        success: boolean;
        data: { nodes: unknown[]; relations: unknown[] };
      };

      if (result.success && result.data) {
        const newNodes = new Map<string, NodeData>();
        for (const node of result.data.nodes as NodeData[]) {
          const migratedNode = migrateNodeData(node);
          newNodes.set(node.id, migratedNode);
        }
        const newRelations = migrateRelationsData(result.data.relations as RelationData[]);

        set({
          nodes: newNodes,
          relations: newRelations,
        });
      }

      const convResult = await conversationApi.list() as unknown as {
        success: boolean;
        data: unknown[];
      };

      if (convResult.success && convResult.data) {
        const newConversations = new Map<string, ConversationData>();
        const currentNodes = new Map(get().nodes);

        for (const conv of convResult.data as ConversationData[]) {
          if (!conv || !conv.id || !conv.nodeId) continue;

          newConversations.set(conv.id, normalizeConversation(conv));

          const node = currentNodes.get(conv.nodeId);
          if (node && node.conversationId !== conv.id) {
            currentNodes.set(conv.nodeId, { ...node, conversationId: conv.id });
          }
        }

        set({
          conversations: newConversations,
          nodes: currentNodes,
        });
      }

      return true;
    } catch (error) {
      console.error('[syncStore] 重新加载工作区数据失败:', error);
      return false;
    }
  },
});

/**
 * 同步 Slice 便捷 Hook（用于未来逐步迁移组件引用）
 * 调用形式为 useSyncStore(selector)
 *
 * 实现说明：通过 ES Module live binding 引用 useAppStore，循环依赖在运行期安全。
 *
 * @param selector - 选择器函数，从同步 Slice 状态中选取所需片段
 * @returns 选择器返回的值
 */
export function useSyncStore<T>(selector: (s: SyncSlice) => T): T {
  return useAppStore(selector as (s: AppState) => T);
}
