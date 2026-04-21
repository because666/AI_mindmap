import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IMessage } from '../types';
import { nodeApi, conversationApi } from '../services/api';

/**
 * 关系类型定义
 */
export type RelationType = 
  | 'parent-child'
  | 'supports' 
  | 'contradicts' 
  | 'prerequisite' 
  | 'elaborates' 
  | 'references' 
  | 'conclusion' 
  | 'custom';

/**
 * 关系类型标签映射
 */
export const RELATION_TYPE_LABELS: Record<RelationType, { label: string; color: string; description: string }> = {
  'parent-child': { label: '父子', color: '#475569', description: '默认的父子层级关系' },
  supports: { label: '支持', color: '#22c55e', description: '支持或证明某个观点' },
  contradicts: { label: '矛盾', color: '#ef4444', description: '与某个观点相矛盾' },
  prerequisite: { label: '前提', color: '#f59e0b', description: '是另一个节点的前提条件' },
  elaborates: { label: '细化', color: '#3b82f6', description: '对某个观点的详细阐述' },
  references: { label: '参考', color: '#8b5cf6', description: '引用或参考其他内容' },
  conclusion: { label: '结论', color: '#06b6d4', description: '从某个讨论得出的结论' },
  custom: { label: '自定义', color: '#6b7280', description: '用户自定义关系' }
};

/**
 * 节点数据接口
 */
export interface NodeData {
  id: string;
  title: string;
  summary: string;
  parentIds: string[];
  childrenIds: string[];
  isRoot: boolean;
  isComposite: boolean;
  compositeChildren?: string[];
  compositeParent?: string;
  hidden: boolean;
  conversationId: string | null;
  position: { x: number; y: number };
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  expanded: boolean;
}

/**
 * 关系数据接口
 */
export interface RelationData {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  description?: string;
  createdAt: Date;
}

/**
 * 历史操作类型
 */
export type HistoryActionType = 
  | 'create_node' 
  | 'update_node' 
  | 'delete_node' 
  | 'create_relation' 
  | 'delete_relation'
  | 'move_node'
  | 'update_conversation';

/**
 * 历史记录接口
 */
export interface HistoryRecord {
  id: string;
  actionType: HistoryActionType;
  timestamp: Date;
  beforeState?: any;
  afterState?: any;
  description: string;
}

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
 * 最大历史记录深度
 */
const MAX_CONTEXT_DEPTH = 20;

/**
 * 最大历史记录数量
 */
const MAX_HISTORY_SIZE = 50;

/**
 * 应用状态接口
 */
interface AppState {
  nodes: Map<string, NodeData>;
  relations: RelationData[];
  conversations: Map<string, ConversationData>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  history: HistoryRecord[];
  historyIndex: number;
  searchQuery: string;
  searchResults: { nodeId: string; matches: string[] }[];
  
  // 聊天面板控制
  requestOpenChatForNode: string | null;
  requestOpenChat: (nodeId: string) => void;
  clearChatRequest: () => void;
  
  // 节点操作
  createRootNode: (title?: string) => string;
  createChildNode: (parentId: string, title?: string) => string;
  addNode: (node: Omit<NodeData, 'createdAt' | 'updatedAt'>) => string;
  updateNode: (id: string, updates: Partial<NodeData>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  
  // 关系操作
  addRelation: (relation: Omit<RelationData, 'id' | 'createdAt'>) => string;
  updateRelation: (id: string, updates: Partial<RelationData>) => void;
  deleteRelation: (id: string) => void;
  getRelationsForNode: (nodeId: string) => RelationData[];
  
  // 对话操作
  addConversation: (nodeId: string) => string;
  addMessage: (conversationId: string, message: Omit<IMessage, '_id' | 'timestamp'>) => void;
  clearConversation: (conversationId: string) => void;
  getConversationContext: (nodeId: string) => { role: 'user' | 'assistant' | 'system'; content: string }[];
  
  // 历史操作
  undo: () => void;
  redo: () => void;
  pushHistory: (action: HistoryActionType, description: string, beforeState?: any, afterState?: any) => void;
  
  // 搜索操作
  setSearchQuery: (query: string) => void;
  searchNodes: () => void;
  
  // 复合节点操作
  createCompositeNode: (nodeIds: string[], title: string) => void;
  expandCompositeNode: (nodeId: string) => void;
  
  // 布局操作
  autoLayout: () => void;

  /**
   * 清除所有数据（工作区切换时使用）
   */
  clearAllData: () => void;

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
 * 生成唯一ID
 * @returns 唯一标识符字符串
 */
const generateId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * 计算节点位置
 * @param parentNode - 父节点
 * @param siblingIndex - 兄弟节点索引
 * @param siblingCount - 兄弟节点总数
 * @returns 计算后的位置坐标
 */
const calculateNodePosition = (
  parentNode: NodeData | null,
  siblingIndex: number,
  siblingCount: number
): { x: number; y: number } => {
  if (!parentNode) {
    return { x: 400, y: 100 };
  }
  
  const offsetX = 280;
  const offsetY = 120;
  const spreadAngle = siblingCount > 1 ? 60 : 0;
  const angleStep = spreadAngle / (siblingCount - 1 || 1);
  const startAngle = -spreadAngle / 2;
  
  const angle = (startAngle + angleStep * siblingIndex) * Math.PI / 180;
  
  return {
    x: parentNode.position.x + offsetX,
    y: parentNode.position.y + Math.sin(angle) * offsetY * (siblingCount > 1 ? 1.5 : 0)
  };
};

/**
 * 创建默认节点数据
 * @param id - 节点ID
 * @param title - 节点标题
 * @param position - 节点位置
 * @param isRoot - 是否为根节点
 * @returns 节点数据对象
 */
const createDefaultNode = (
  id: string,
  title: string,
  position: { x: number; y: number },
  isRoot: boolean = false
): NodeData => ({
  id,
  title,
  summary: '',
  parentIds: [],
  childrenIds: [],
  isRoot,
  isComposite: false,
  compositeChildren: undefined,
  compositeParent: undefined,
  hidden: false,
  conversationId: null,
  position,
  createdAt: new Date(),
  updatedAt: new Date(),
  tags: [],
  expanded: true
});

/**
 * 迁移节点数据格式
 * @param node - 原始节点数据
 * @returns 迁移后的节点数据
 */
const migrateNodeData = (node: any): NodeData => {
  return {
    ...node,
    hidden: node.hidden ?? false,
    expanded: node.expanded ?? true,
    compositeParent: node.compositeParent ?? undefined,
    compositeChildren: node.compositeChildren ?? undefined,
    tags: node.tags ?? [],
    summary: node.summary ?? '',
    parentIds: node.parentIds ?? [],
    childrenIds: node.childrenIds ?? []
  };
};

/**
 * 迁移关系数据格式
 * @param relations - 原始关系数据
 * @returns 迁移后的关系数据数组
 */
const migrateRelationsData = (relations: any): RelationData[] => {
  if (!relations) return [];
  
  if (!Array.isArray(relations)) return [];
  
  if (relations.length === 0) return [];
  
  const firstItem = relations[0];
  if (Array.isArray(firstItem) && firstItem.length === 2) {
    return relations
      .map((entry: any) => entry[1])
      .filter((r: any) => r && r.type && r.id && r.sourceId && r.targetId);
  }
  
  return relations.filter((r: any) => r && r.type && r.id && r.sourceId && r.targetId);
};

/**
 * 应用状态管理Store
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      nodes: new Map(),
      relations: [],
      conversations: new Map(),
      selectedNodeId: null,
      hoveredNodeId: null,
      history: [],
      historyIndex: -1,
      searchQuery: '',
      searchResults: [],
      requestOpenChatForNode: null,

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
       * 创建根节点
       * @param title - 节点标题
       * @returns 新创建的节点ID
       */
      createRootNode: (title = '新对话') => {
        const id = generateId();
        const existingRoots = Array.from(get().nodes.values()).filter(n => n.isRoot);
        const position = {
          x: 100 + existingRoots.length * 300,
          y: 100
        };
        
        const newNode = createDefaultNode(id, title, position, true);
        
        set((state) => {
          const newNodes = new Map(state.nodes);
          newNodes.set(id, newNode);
          return { nodes: newNodes, selectedNodeId: id };
        });
        
        get().pushHistory('create_node', `创建根节点: ${title}`);

        nodeApi.create({
          id,
          title,
          position,
          isRoot: true,
          parentIds: [],
          childrenIds: [],
          isComposite: false,
          hidden: false,
          expanded: true,
          tags: [],
          summary: '',
        }).catch((error: unknown) => {
          console.error('[appStore] 同步创建根节点到服务端失败:', error);
        });

        return id;
      },
      
      /**
       * 创建子节点
       * @param parentId - 父节点ID
       * @param title - 节点标题
       * @returns 新创建的节点ID
       */
      createChildNode: (parentId, title = '新分支') => {
        const id = generateId();
        const relationId = generateId();
        const parent = get().nodes.get(parentId);
        
        if (!parent) {
          return '';
        }
        
        const siblingCount = parent.childrenIds.length;
        const position = calculateNodePosition(parent, siblingCount, siblingCount + 1);
        
        const newNode: NodeData = {
          ...createDefaultNode(id, title, position, false),
          parentIds: [parentId]
        };
        
        const newRelation: RelationData = {
          id: relationId,
          sourceId: parentId,
          targetId: id,
          type: 'parent-child',
          createdAt: new Date()
        };
        
        set((state) => {
          const newNodes = new Map(state.nodes);
          
          newNodes.set(id, newNode);
          
          const updatedParent = newNodes.get(parentId);
          if (updatedParent) {
            newNodes.set(parentId, {
              ...updatedParent,
              childrenIds: [...updatedParent.childrenIds, id]
            });
          }
          
          const allChildren = updatedParent?.childrenIds || [];
          allChildren.forEach((childId, idx) => {
            const child = newNodes.get(childId);
            if (child) {
              newNodes.set(childId, {
                ...child,
                position: calculateNodePosition(updatedParent!, idx, allChildren.length)
              });
            }
          });
          
          return { 
            nodes: newNodes, 
            relations: [...state.relations, newRelation],
            selectedNodeId: id 
          };
        });
        
        get().pushHistory('create_node', `创建子节点: ${title}`);

        nodeApi.createChild(parentId, title, { id, position }).catch((error: unknown) => {
          console.error('[appStore] 同步创建子节点到服务端失败:', error);
        });

        return id;
      },
      
      /**
       * 添加节点
       * @param node - 节点数据
       * @returns 节点ID
       */
      addNode: (node) => {
        const id = node.id;
        const newNode: NodeData = {
          ...node,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        set((state) => {
          const newNodes = new Map(state.nodes);
          newNodes.set(id, newNode);
          
          if (node.parentIds.length > 0) {
            node.parentIds.forEach(parentId => {
              const parent = newNodes.get(parentId);
              if (parent && !parent.childrenIds.includes(id)) {
                newNodes.set(parentId, {
                  ...parent,
                  childrenIds: [...parent.childrenIds, id]
                });
              }
            });
          }
          
          return { nodes: newNodes };
        });
        
        get().pushHistory('create_node', `创建节点: ${node.title}`);
        return id;
      },
      
      /**
       * 更新节点
       * @param id - 节点ID
       * @param updates - 更新内容
       */
      updateNode: (id, updates) => {
        set((state) => {
          const newNodes = new Map(state.nodes);
          const node = newNodes.get(id);
          if (node) {
            newNodes.set(id, {
              ...node,
              ...updates,
              updatedAt: new Date()
            });
          }
          return { nodes: newNodes };
        });
        
        get().pushHistory('update_node', `更新节点`);

        const { createdAt, updatedAt, ...apiUpdates } = updates as Record<string, unknown>;
        nodeApi.update(id, apiUpdates as Partial<import('../services/api').NodeData>).catch((error: unknown) => {
          console.error('[appStore] 同步更新节点到服务端失败:', error);
        });
      },
      
      /**
       * 删除节点
       * @param id - 节点ID
       */
      deleteNode: (id) => {
        set((state) => {
          const newNodes = new Map(state.nodes);
          const newConversations = new Map(state.conversations);
          
          const node = newNodes.get(id);
          if (node) {
            /**
             * 递归删除所有子节点
             * @param nodeId - 要删除的节点ID
             */
            const deleteRecursive = (nodeId: string) => {
              const n = newNodes.get(nodeId);
              if (n) {
                n.childrenIds.forEach(deleteRecursive);
                
                if (n.conversationId) {
                  newConversations.delete(n.conversationId);
                }
                
                newNodes.delete(nodeId);
              }
            };
            
            deleteRecursive(id);
            
            node.parentIds.forEach(parentId => {
              const parent = newNodes.get(parentId);
              if (parent) {
                newNodes.set(parentId, {
                  ...parent,
                  childrenIds: parent.childrenIds.filter(cid => cid !== id)
                });
              }
            });
          }
          
          const newRelations = state.relations.filter(
            relation => relation.sourceId !== id && relation.targetId !== id
          );
          
          return {
            nodes: newNodes,
            relations: newRelations,
            conversations: newConversations,
            selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId
          };
        });
        
        get().pushHistory('delete_node', `删除节点`);

        nodeApi.delete(id).catch((error: unknown) => {
          console.error('[appStore] 同步删除节点到服务端失败:', error);
        });
      },
      
      /**
       * 选择节点
       * @param id - 节点ID
       */
      selectNode: (id) => {
        set({ selectedNodeId: id });
      },
      
      /**
       * 悬停节点
       * @param id - 节点ID
       */
      hoverNode: (id) => {
        set({ hoveredNodeId: id });
      },
      
      /**
       * 添加关系
       * @param relation - 关系数据
       * @returns 关系ID
       */
      addRelation: (relation) => {
        const id = generateId();
        const newRelation: RelationData = {
          ...relation,
          id,
          createdAt: new Date()
        };
        
        set((state) => ({
          relations: [...state.relations, newRelation]
        }));
        
        get().pushHistory('create_relation', `创建关系: ${RELATION_TYPE_LABELS[relation.type].label}`);

        nodeApi.createRelation({
          id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          type: relation.type,
          description: relation.description,
        }).catch((error: unknown) => {
          console.error('[appStore] 同步创建关系到服务端失败:', error);
        });

        return id;
      },
      
      /**
       * 更新关系
       * @param id - 关系ID
       * @param updates - 更新内容
       */
      updateRelation: (id, updates) => {
        set((state) => ({
          relations: state.relations.map(relation =>
            relation.id === id ? { ...relation, ...updates } : relation
          )
        }));
      },
      
      /**
       * 删除关系
       * @param id - 关系ID
       */
      deleteRelation: (id) => {
        set((state) => ({
          relations: state.relations.filter(relation => relation.id !== id)
        }));
        
        get().pushHistory('delete_relation', `删除关系`);

        nodeApi.deleteRelation(id).catch((error: unknown) => {
          console.error('[appStore] 同步删除关系到服务端失败:', error);
        });
      },
      
      /**
       * 获取节点相关的所有关系
       * @param nodeId - 节点ID
       * @returns 关系列表
       */
      getRelationsForNode: (nodeId) => {
        return get().relations.filter(
          relation => relation.sourceId === nodeId || relation.targetId === nodeId
        );
      },
      
      /**
       * 添加对话
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
          console.error('[appStore] 同步节点conversationId到服务端失败:', error);
        });

        conversationApi.getByNodeId(nodeId, id).catch((error: unknown) => {
          console.error('[appStore] 同步创建对话到服务端失败:', error);
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
            console.error('[appStore] 同步消息到服务端失败:', error);
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
            console.error('[appStore] 同步清空对话到服务端失败:', error);
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
          
          /**
           * 首先处理所有父节点（通过 parentIds）
           * 这确保了父节点的上下文在子节点之前
           */
          currentNode.parentIds.forEach(parentId => {
            collectNodeOrder(parentId, depth + 1);
          });
          
          /**
           * 然后处理通过关系连接的源节点
           * 包括 supports, prerequisite, elaborates 等类型
           */
          relations.forEach((relation) => {
            if (relation.targetId === currentNodeId) {
              collectNodeOrder(relation.sourceId, depth + 1);
            }
          });
          
          nodeOrder.push(currentNodeId);
        };
        
        collectNodeOrder(nodeId);
        
        /**
         * 按拓扑顺序收集消息
         */
        nodeOrder.forEach(orderedNodeId => {
          const node = nodes.get(orderedNodeId);
          if (!node) return;
          
          if (node.conversationId) {
            const conv = conversations.get(node.conversationId);
            if (conv && conv.messages.length > 0) {
              contextMessages.push({
                role: 'system',
                content: `[节点: ${node.title}]`
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
      
      /**
       * 撤销操作
       */
      undo: () => {
        const { history, historyIndex } = get();
        if (historyIndex >= 0) {
          const record = history[historyIndex];
          if (record.beforeState) {
            set(record.beforeState);
          }
          set({ historyIndex: historyIndex - 1 });
        }
      },
      
      /**
       * 重做操作
       */
      redo: () => {
        const { history, historyIndex } = get();
        if (historyIndex < history.length - 1) {
          const record = history[historyIndex + 1];
          if (record.afterState) {
            set(record.afterState);
          }
          set({ historyIndex: historyIndex + 1 });
        }
      },
      
      /**
       * 推送历史记录
       * @param actionType - 操作类型
       * @param description - 描述
       * @param beforeState - 操作前状态
       * @param afterState - 操作后状态
       */
      pushHistory: (actionType, description, beforeState?, afterState?) => {
        const record: HistoryRecord = {
          id: generateId(),
          actionType,
          timestamp: new Date(),
          beforeState,
          afterState,
          description
        };
        
        set((state) => {
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(record);
          
          if (newHistory.length > MAX_HISTORY_SIZE) {
            newHistory.shift();
          }
          
          return {
            history: newHistory,
            historyIndex: newHistory.length - 1
          };
        });
      },
      
      /**
       * 设置搜索查询
       * @param query - 搜索关键词
       */
      setSearchQuery: (query) => {
        set({ searchQuery: query });
        if (query.trim()) {
          get().searchNodes();
        } else {
          set({ searchResults: [] });
        }
      },
      
      /**
       * 搜索节点
       */
      searchNodes: () => {
        const { nodes, conversations, searchQuery } = get();
        if (!searchQuery.trim()) {
          set({ searchResults: [] });
          return;
        }
        
        const query = searchQuery.toLowerCase();
        const results: { nodeId: string; matches: string[] }[] = [];
        
        nodes.forEach((node, nodeId) => {
          const matches: string[] = [];
          
          if (node.title.toLowerCase().includes(query)) {
            matches.push(`标题: ${node.title}`);
          }
          
          if (node.summary.toLowerCase().includes(query)) {
            matches.push(`摘要: ${node.summary}`);
          }
          
          if (node.conversationId) {
            const conversation = conversations.get(node.conversationId);
            if (conversation) {
              conversation.messages.forEach(msg => {
                if (msg.content.toLowerCase().includes(query)) {
                  matches.push(`对话: ${msg.content.substring(0, 50)}...`);
                }
              });
            }
          }
          
          if (matches.length > 0) {
            results.push({ nodeId, matches });
          }
        });
        
        set({ searchResults: results });
      },
      
      /**
       * 创建复合节点
       * @param nodeIds - 要聚合的节点ID列表
       * @param title - 复合节点标题
       */
      createCompositeNode: (nodeIds, title) => {
        const compositeId = generateId();
        
        set((state) => {
          const newNodes = new Map(state.nodes);
          const nodesToAggregate: NodeData[] = [];
          
          nodeIds.forEach(id => {
            const node = newNodes.get(id);
            if (node) {
              nodesToAggregate.push(node);
            }
          });
          
          if (nodesToAggregate.length === 0) return state;
          
          const centerX = nodesToAggregate.reduce((sum, n) => sum + n.position.x, 0) / nodesToAggregate.length;
          const centerY = nodesToAggregate.reduce((sum, n) => sum + n.position.y, 0) / nodesToAggregate.length;
          
          const compositeNode: NodeData = {
            id: compositeId,
            title,
            summary: `包含 ${nodeIds.length} 个节点`,
            parentIds: [],
            childrenIds: [],
            isRoot: false,
            isComposite: true,
            compositeChildren: nodeIds,
            compositeParent: undefined,
            hidden: false,
            conversationId: null,
            position: { x: centerX, y: centerY },
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [],
            expanded: false
          };
          
          newNodes.set(compositeId, compositeNode);
          
          nodeIds.forEach(id => {
            const node = newNodes.get(id);
            if (node) {
              newNodes.set(id, {
                ...node,
                hidden: true,
                compositeParent: compositeId
              });
            }
          });
          
          return { nodes: newNodes };
        });
        
        get().pushHistory('create_node', `创建复合节点: ${title}`);

        nodeApi.create({
          id: compositeId,
          title,
          summary: `包含 ${nodeIds.length} 个节点`,
          position: get().nodes.get(compositeId)?.position || { x: 0, y: 0 },
          isRoot: false,
          isComposite: true,
          compositeChildren: nodeIds,
          parentIds: [],
          childrenIds: [],
          hidden: false,
          expanded: false,
          tags: [],
        }).catch((error: unknown) => {
          console.error('[appStore] 同步创建复合节点到服务端失败:', error);
        });

        for (const aggregatedId of nodeIds) {
          nodeApi.update(aggregatedId, {
            hidden: true,
            compositeParent: compositeId,
          }).catch((error: unknown) => {
            console.error('[appStore] 同步聚合节点状态到服务端失败:', error);
          });
        }
      },
      
      /**
       * 切换聚合节点的展开/折叠状态
       * 展开时：子节点以扇形分布在聚合节点周围，聚合节点保持可见
       * 折叠时：子节点隐藏，恢复聚合节点状态
       * @param nodeId - 复合节点ID
       */
      expandCompositeNode: (nodeId) => {
        const updatedNodeIds: string[] = [];

        set((state) => {
          const newNodes = new Map(state.nodes);
          const node = newNodes.get(nodeId);
          
          if (node && node.isComposite && node.compositeChildren) {
            const isCurrentlyExpanded = node.expanded;
            
            if (isCurrentlyExpanded) {
              node.compositeChildren.forEach(childId => {
                const child = newNodes.get(childId);
                if (child) {
                  newNodes.set(childId, { 
                    ...child, 
                    hidden: true,
                    compositeParent: nodeId
                  });
                  updatedNodeIds.push(childId);
                }
              });
              
              newNodes.set(nodeId, {
                ...node,
                expanded: false
              });
              updatedNodeIds.push(nodeId);
            } else {
              const childCount = node.compositeChildren.length;
              const centerX = node.position.x;
              const centerY = node.position.y;
              
              const baseRadius = 200;
              const radius = Math.max(baseRadius, baseRadius + (childCount - 3) * 30);
              const spreadAngle = Math.min(180, 60 + childCount * 15);
              const startAngle = -spreadAngle / 2;
              const angleStep = childCount > 1 ? spreadAngle / (childCount - 1) : 0;
              
              node.compositeChildren.forEach((childId, index) => {
                const child = newNodes.get(childId);
                if (child) {
                  const angle = (startAngle + angleStep * index) * Math.PI / 180;
                  const newX = centerX + Math.cos(angle) * radius;
                  const newY = centerY + Math.sin(angle) * radius;
                  
                  newNodes.set(childId, { 
                    ...child, 
                    hidden: false,
                    compositeParent: nodeId,
                    position: { x: newX, y: newY }
                  });
                  updatedNodeIds.push(childId);
                }
              });
              
              newNodes.set(nodeId, {
                ...node,
                expanded: true
              });
              updatedNodeIds.push(nodeId);
            }
          }
          
          return { nodes: newNodes };
        });
        
        get().pushHistory('update_node', `切换复合节点展开状态`);

        for (const updatedId of updatedNodeIds) {
          const updatedNode = get().nodes.get(updatedId);
          if (updatedNode) {
            nodeApi.update(updatedId, {
              hidden: updatedNode.hidden,
              expanded: updatedNode.expanded,
              compositeParent: updatedNode.compositeParent,
              position: updatedNode.position,
            }).catch((error: unknown) => {
              console.error('[appStore] 同步复合节点展开状态到服务端失败:', error);
            });
          }
        }
      },
      
      /**
       * 自动布局所有节点
       */
      autoLayout: () => {
        set((state) => {
          const newNodes = new Map(state.nodes);
          const roots = Array.from(newNodes.values()).filter(n => n.isRoot);
          
          /**
           * 递归布局节点
           * @param node - 当前节点
           * @param x - X坐标
           * @param y - Y坐标
           * @param level - 层级
           */
          const layoutNode = (node: NodeData, x: number, y: number, level: number) => {
            newNodes.set(node.id, { ...node, position: { x, y } });
            
            const children = node.childrenIds.map(id => newNodes.get(id)!).filter(Boolean);
            const childSpacing = 150;
            const startY = y - (children.length - 1) * childSpacing / 2;
            
            children.forEach((child, index) => {
              layoutNode(child, x + 300, startY + index * childSpacing, level + 1);
            });
          };
          
          roots.forEach((root, index) => {
            layoutNode(root, 100, 100 + index * 300, 0);
          });
          
          return { nodes: newNodes };
        });
      },

      /**
       * 清除所有数据（工作区切换时使用）
       * 重置节点、关系、对话、历史记录等所有状态
       */
      clearAllData: () => {
        set({
          nodes: new Map(),
          relations: [],
          conversations: new Map(),
          selectedNodeId: null,
          hoveredNodeId: null,
          history: [],
          historyIndex: -1,
          searchQuery: '',
          searchResults: [],
        });
      },

      /**
       * 从API加载数据（工作区切换后使用）
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
          history: [],
          historyIndex: -1,
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

          newConversations.set(conv.id, {
            ...conv,
            createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
            updatedAt: conv.updatedAt ? new Date(conv.updatedAt) : new Date(),
            messages: (conv.messages || []).map((msg: { _id?: string; role?: string; content?: string; timestamp?: string | Date }) => ({
              _id: msg._id || generateId(),
              role: (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user') as IMessage['role'],
              content: msg.content || '',
              timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            })),
          });

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

              newConversations.set(conv.id, {
                ...conv,
                createdAt: conv.createdAt ? new Date(conv.createdAt) : new Date(),
                updatedAt: conv.updatedAt ? new Date(conv.updatedAt) : new Date(),
                messages: (conv.messages || []).map((msg: { _id?: string; role?: string; content?: string; timestamp?: string | Date }) => ({
                  _id: msg._id || generateId(),
                  role: (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user') as IMessage['role'],
                  content: msg.content || '',
                  timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                })),
              });

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
          console.error('[appStore] 重新加载工作区数据失败:', error);
          return false;
        }
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
        }
      }
    }
  )
);
