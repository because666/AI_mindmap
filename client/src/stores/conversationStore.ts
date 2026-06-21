/**
 * 对话 Store（Slice）
 * 负责节点对话的创建、消息追加、清空及上下文构建。
 *
 * 说明：本文件采用 zustand 的 Slice 模式，导出 createConversationSlice 用于在 appStore 中组合。
 * 状态最终由聚合 Store（useAppStore）统一持有，跨 Slice 的状态依赖通过 get() 访问。
 */
import type { AppState } from './appStore';
import { useAppStore } from './appStore';
import { generateId } from './storeUtils';
import { nodeApi, conversationApi } from '../services/api';
import type { IMessage } from '../types';

/**
 * 对话数据接口
 */
export interface ConversationData {
  id: string;
  nodeId: string;
  messages: IMessage[];
  contextConfig: {
    includeParentHistory: boolean;
    includeRelatedNodes: string[];
    customContext?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 最大上下文深度
 */
const MAX_CONTEXT_DEPTH = 15;

/**
 * 对话 Slice 状态与方法接口
 */
export interface ConversationSlice {
  /** 全部对话（按 id 索引） */
  conversations: Map<string, ConversationData>;
  /** 添加对话 */
  addConversation: (nodeId: string) => string;
  /** 添加消息 */
  addMessage: (conversationId: string, message: Omit<IMessage, '_id' | 'timestamp'>) => void;
  /** 清空对话 */
  clearConversation: (conversationId: string) => void;
  /** 获取节点的对话上下文（包含祖先节点历史） */
  getConversationContext: (nodeId: string) => { role: 'user' | 'assistant' | 'system'; content: string }[];
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
 * 创建对话 Slice
 * @param set - 聚合 Store 的 set 函数
 * @param get - 聚合 Store 的 get 函数
 * @returns 对话 Slice 的状态与方法
 */
export const createConversationSlice = (set: SliceSet, get: SliceGet): ConversationSlice => ({
  conversations: new Map(),

  /**
   * 添加对话
   * 同时将节点 conversationId 指向新对话
   * @param nodeId - 节点ID
   * @returns 对话ID
   */
  addConversation: (nodeId) => {
    const id = generateId();
    const newConversation: ConversationData = {
      id,
      nodeId,
      messages: [],
      contextConfig: {
        includeParentHistory: true,
        includeRelatedNodes: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    set((state) => {
      const newConversations = new Map(state.conversations);
      newConversations.set(id, newConversation);

      const newNodes = new Map(state.nodes);
      const node = newNodes.get(nodeId);
      if (node) {
        newNodes.set(nodeId, { ...node, conversationId: id });
      }

      return { conversations: newConversations, nodes: newNodes };
    });

    nodeApi.update(nodeId, { conversationId: id }).catch((error: unknown) => {
      console.error('[conversationStore] 同步节点conversationId到服务端失败:', error);
    });

    conversationApi.getByNodeId(nodeId, id).catch((error: unknown) => {
      console.error('[conversationStore] 同步创建对话到服务端失败:', error);
    });

    return id;
  },

  /**
   * 添加消息
   * @param conversationId - 对话ID
   * @param message - 消息内容
   */
  addMessage: (conversationId, message) => {
    let nodeId: string | null = null;

    set((state) => {
      const newConversations = new Map(state.conversations);
      const conversation = newConversations.get(conversationId);
      if (conversation) {
        nodeId = conversation.nodeId;
        newConversations.set(conversationId, {
          ...conversation,
          messages: [
            ...conversation.messages,
            {
              ...message,
              _id: generateId(),
              timestamp: new Date()
            }
          ],
          updatedAt: new Date()
        });
      }
      return { conversations: newConversations };
    });

    if (nodeId) {
      conversationApi.saveMessage(nodeId, message.role, message.content).catch((error: unknown) => {
        console.error('[conversationStore] 同步消息到服务端失败:', error);
      });
    }
  },

  /**
   * 清空对话
   * @param conversationId - 对话ID
   */
  clearConversation: (conversationId) => {
    let nodeId: string | null = null;

    set((state) => {
      const newConversations = new Map(state.conversations);
      const conversation = newConversations.get(conversationId);
      if (conversation) {
        nodeId = conversation.nodeId;
        newConversations.set(conversationId, {
          ...conversation,
          messages: [],
          updatedAt: new Date()
        });
      }
      return { conversations: newConversations };
    });

    if (nodeId) {
      conversationApi.clear(nodeId).catch((error: unknown) => {
        console.error('[conversationStore] 同步清空对话到服务端失败:', error);
      });
    }
  },

  /**
   * 获取节点的对话上下文（包含祖先节点历史）
   * 支持多父节点继承，完整追溯所有祖先链
   * @param nodeId - 节点ID
   * @returns 上下文消息列表（按时间顺序排列）
   */
  getConversationContext: (nodeId) => {
    const { nodes, conversations, relations } = get();
    const contextMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [];
    const visitedNodes = new Set<string>();
    const nodeOrder: string[] = [];

    /**
     * 拓扑排序收集节点顺序
     * 确保父节点在子节点之前被处理
     * @param currentNodeId - 当前节点ID
     * @param depth - 递归深度
     */
    const collectNodeOrder = (currentNodeId: string, depth: number = 0) => {
      if (visitedNodes.has(currentNodeId) || depth > MAX_CONTEXT_DEPTH) return;
      visitedNodes.add(currentNodeId);

      const currentNode = nodes.get(currentNodeId);
      if (!currentNode) return;

      currentNode.parentIds.forEach(parentId => {
        collectNodeOrder(parentId, depth + 1);
      });

      relations.forEach((relation) => {
        if (relation.targetId === currentNodeId) {
          collectNodeOrder(relation.sourceId, depth + 1);
        }
      });

      nodeOrder.push(currentNodeId);
    };

    collectNodeOrder(nodeId);

    nodeOrder.forEach(orderedNodeId => {
      const node = nodes.get(orderedNodeId);
      if (!node) return;

      if (node.conversationId) {
        const conv = conversations.get(node.conversationId);
        if (conv && conv.messages.length > 0) {
          contextMessages.push({
            role: 'system',
            content: `[节点: ${node.title}] (ID: ${node.id})`
          });
          conv.messages.forEach(msg => {
            contextMessages.push({
              role: msg.role,
              content: msg.content
            });
          });
        }
      }
    });

    return contextMessages;
  },
});

/**
 * 对话 Slice 便捷 Hook（用于未来逐步迁移组件引用）
 * 调用形式为 useConversationStore(selector)
 *
 * 实现说明：通过 ES Module live binding 引用 useAppStore，循环依赖在运行期安全。
 *
 * @param selector - 选择器函数，从对话 Slice 状态中选取所需片段
 * @returns 选择器返回的值
 */
export function useConversationStore<T>(selector: (s: ConversationSlice) => T): T {
  return useAppStore(selector as (s: AppState) => T);
}
