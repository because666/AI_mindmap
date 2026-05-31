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
  type: 'default' | 'conclusion';
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
 * 命令接口 - 用于撤销/重做操作
 * 每个命令封装一个可撤销的操作，包含执行和撤销逻辑
 */
export interface Command {
  id: string;
  description: string;
  execute: () => void;
  undo: () => void;
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
 * 最大上下文深度
 */
const MAX_CONTEXT_DEPTH = 15;

/**
 * 最大撤销/重做栈深度
 */
const MAX_STACK_SIZE = 30;

/**
 * 面板类型定义
 */
export type PanelType = 'search' | 'history' | 'settings' | 'files' | null;

/**
 * 应用状态接口
 */
interface AppState {
  nodes: Map<string, NodeData>;
  relations: RelationData[];
  conversations: Map<string, ConversationData>;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;
  searchQuery: string;
  searchResults: { nodeId: string; matches: string[] }[];
  activePanel: PanelType;

  requestOpenChatForNode: string | null;
  requestOpenChat: (nodeId: string) => void;
  clearChatRequest: () => void;

  setActivePanel: (panel: PanelType) => void;

  createRootNode: (title?: string) => string;
  createChildNode: (parentId: string, title?: string) => string;
  addNode: (node: Omit<NodeData, 'createdAt' | 'updatedAt'>) => string;
  updateNode: (id: string, updates: Partial<NodeData>) => void;
  deleteNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;

  addRelation: (relation: Omit<RelationData, 'id' | 'createdAt'>) => string;
  updateRelation: (id: string, updates: Partial<RelationData>) => void;
  deleteRelation: (id: string) => void;
  getRelationsForNode: (nodeId: string) => RelationData[];

  addConversation: (nodeId: string) => string;
  addMessage: (conversationId: string, message: Omit<IMessage, '_id' | 'timestamp'>) => void;
  clearConversation: (conversationId: string) => void;
  getConversationContext: (nodeId: string) => { role: 'user' | 'assistant' | 'system'; content: string }[];

  undo: () => void;
  redo: () => void;
  pushCommand: (command: Command) => void;
  undoTo: (targetIndex: number) => void;

  setSearchQuery: (query: string) => void;
  searchNodes: () => void;

  createCompositeNode: (nodeIds: string[], title: string) => void;
  expandCompositeNode: (nodeId: string) => void;

  /**
   * 创建结论节点
   * 从源节点提炼结论并创建新的结论类型节点，建立 conclusion 关系
   * @param sourceNodeId - 源节点ID
   * @param conclusion - 结论文本内容
   */
  createConclusionNode: (sourceNodeId: string, conclusion: string) => void;

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
  type: 'default',
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
    type: node.type || 'default',
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
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
      searchQuery: '',
      searchResults: [],
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
        const capturedNode = { ...newNode };
        const previousSelectedNodeId = get().selectedNodeId;

        set((state) => {
          const newNodes = new Map(state.nodes);
          newNodes.set(id, newNode);
          return { nodes: newNodes, selectedNodeId: id };
        });

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

        get().pushCommand({
          id: generateId(),
          description: `创建节点: ${title}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.set(id, capturedNode);
              return { nodes: newNodes, selectedNodeId: id };
            });
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
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.delete(id);
              return {
                nodes: newNodes,
                selectedNodeId: state.selectedNodeId === id ? previousSelectedNodeId : state.selectedNodeId,
              };
            });
            nodeApi.delete(id).catch((error: unknown) => {
              console.error('[appStore] 同步删除节点到服务端失败:', error);
            });
          },
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

        const capturedParentChildrenIds = [...parent.childrenIds];
        const oldSiblingPositions: Map<string, { x: number; y: number }> = new Map();
        parent.childrenIds.forEach(childId => {
          const child = get().nodes.get(childId);
          if (child) {
            oldSiblingPositions.set(childId, { ...child.position });
          }
        });
        const previousSelectedNodeId = get().selectedNodeId;

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

        nodeApi.createChild(parentId, title, { id, position }).catch((error: unknown) => {
          console.error('[appStore] 同步创建子节点到服务端失败:', error);
        });

        get().pushCommand({
          id: generateId(),
          description: `创建节点: ${title}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.set(id, { ...newNode });
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
                relations: [...state.relations, { ...newRelation }],
                selectedNodeId: id,
              };
            });
            nodeApi.createChild(parentId, title, { id, position }).catch((error: unknown) => {
              console.error('[appStore] 同步创建子节点到服务端失败:', error);
            });
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.delete(id);
              const updatedParent = newNodes.get(parentId);
              if (updatedParent) {
                newNodes.set(parentId, { ...updatedParent, childrenIds: capturedParentChildrenIds });
              }
              oldSiblingPositions.forEach((pos, childId) => {
                const child = newNodes.get(childId);
                if (child) {
                  newNodes.set(childId, { ...child, position: pos });
                }
              });
              return {
                nodes: newNodes,
                relations: state.relations.filter(r => r.id !== relationId),
                selectedNodeId: state.selectedNodeId === id ? previousSelectedNodeId : state.selectedNodeId,
              };
            });
            nodeApi.delete(id).catch((error: unknown) => {
              console.error('[appStore] 同步删除节点到服务端失败:', error);
            });
            nodeApi.deleteRelation(relationId).catch((error: unknown) => {
              console.error('[appStore] 同步删除关系到服务端失败:', error);
            });
          },
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

        const capturedParentChildrenIds: Map<string, string[]> = new Map();
        node.parentIds.forEach(parentId => {
          const parent = get().nodes.get(parentId);
          if (parent) {
            capturedParentChildrenIds.set(parentId, [...parent.childrenIds]);
          }
        });

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

        get().pushCommand({
          id: generateId(),
          description: `创建节点: ${node.title}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.set(id, { ...newNode });
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
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.delete(id);
              capturedParentChildrenIds.forEach((childrenIds, parentId) => {
                const parent = newNodes.get(parentId);
                if (parent) {
                  newNodes.set(parentId, { ...parent, childrenIds });
                }
              });
              return { nodes: newNodes };
            });
          },
        });

        return id;
      },

      /**
       * 更新节点
       * @param id - 节点ID
       * @param updates - 更新内容
       */
      updateNode: (id, updates) => {
        const existingNode = get().nodes.get(id);
        if (!existingNode) return;

        const oldValues: Partial<NodeData> = {};
        const updateKeys = Object.keys(updates) as (keyof NodeData)[];
        updateKeys.forEach(key => {
          oldValues[key] = existingNode[key];
        });

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

        const apiUpdates: Record<string, unknown> = {};
        Object.entries(updates as Record<string, unknown>).forEach(([key, value]) => {
          if (key !== 'createdAt' && key !== 'updatedAt') {
            apiUpdates[key] = value;
          }
        });
        nodeApi.update(id, apiUpdates as Partial<import('../services/api').NodeData>).catch((error: unknown) => {
          console.error('[appStore] 同步更新节点到服务端失败:', error);
        });

        const nodeTitle = existingNode.title;
        get().pushCommand({
          id: generateId(),
          description: `更新节点: ${nodeTitle}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              const node = newNodes.get(id);
              if (node) {
                newNodes.set(id, { ...node, ...updates, updatedAt: new Date() });
              }
              return { nodes: newNodes };
            });
            const apiUpd: Record<string, unknown> = {};
            Object.entries(updates as Record<string, unknown>).forEach(([key, value]) => {
              if (key !== 'createdAt' && key !== 'updatedAt') {
                apiUpd[key] = value;
              }
            });
            nodeApi.update(id, apiUpd as Partial<import('../services/api').NodeData>).catch((error: unknown) => {
              console.error('[appStore] 同步更新节点到服务端失败:', error);
            });
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              const node = newNodes.get(id);
              if (node) {
                newNodes.set(id, { ...node, ...oldValues, updatedAt: new Date() });
              }
              return { nodes: newNodes };
            });
            const apiOldUpd: Record<string, unknown> = {};
            Object.entries(oldValues as Record<string, unknown>).forEach(([key, value]) => {
              if (key !== 'createdAt' && key !== 'updatedAt') {
                apiOldUpd[key] = value;
              }
            });
            nodeApi.update(id, apiOldUpd as Partial<import('../services/api').NodeData>).catch((error: unknown) => {
              console.error('[appStore] 同步恢复节点到服务端失败:', error);
            });
          },
        });
      },

      /**
       * 删除节点
       * @param id - 节点ID
       */
      deleteNode: (id) => {
        const node = get().nodes.get(id);
        if (!node) return;

        const deletedNodes: NodeData[] = [];
        const collectDeletedNodes = (nodeId: string) => {
          const n = get().nodes.get(nodeId);
          if (n) {
            deletedNodes.push({ ...n });
            n.childrenIds.forEach(collectDeletedNodes);
          }
        };
        collectDeletedNodes(id);

        const deletedRelations = get().relations.filter(
          relation => relation.sourceId === id || relation.targetId === id
        );

        const parentChildrenIdsBackup: Map<string, string[]> = new Map();
        node.parentIds.forEach(parentId => {
          const parent = get().nodes.get(parentId);
          if (parent) {
            parentChildrenIdsBackup.set(parentId, [...parent.childrenIds]);
          }
        });

        const deletedConversations: ConversationData[] = [];
        deletedNodes.forEach(n => {
          if (n.conversationId) {
            const conv = get().conversations.get(n.conversationId);
            if (conv) {
              deletedConversations.push({ ...conv });
            }
          }
        });

        const previousSelectedNodeId = get().selectedNodeId;

        set((state) => {
          const newNodes = new Map(state.nodes);
          const newConversations = new Map(state.conversations);

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

        nodeApi.delete(id).catch((error: unknown) => {
          console.error('[appStore] 同步删除节点到服务端失败:', error);
        });

        const nodeTitle = node.title;
        get().pushCommand({
          id: generateId(),
          description: `删除节点: ${nodeTitle}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              const newConversations = new Map(state.conversations);

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

              const newRelations = state.relations.filter(
                relation => relation.sourceId !== id && relation.targetId !== id
              );

              return {
                nodes: newNodes,
                relations: newRelations,
                conversations: newConversations,
                selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
              };
            });
            nodeApi.delete(id).catch((error: unknown) => {
              console.error('[appStore] 同步删除节点到服务端失败:', error);
            });
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              deletedNodes.forEach(n => newNodes.set(n.id, { ...n }));

              parentChildrenIdsBackup.forEach((childrenIds, parentId) => {
                const parent = newNodes.get(parentId);
                if (parent) {
                  newNodes.set(parentId, { ...parent, childrenIds });
                }
              });

              const newConversations = new Map(state.conversations);
              deletedConversations.forEach(c => newConversations.set(c.id, { ...c }));

              return {
                nodes: newNodes,
                relations: [...state.relations, ...deletedRelations],
                conversations: newConversations,
                selectedNodeId: previousSelectedNodeId,
              };
            });
            deletedNodes.forEach(n => {
              const apiData: Record<string, unknown> = {};
              Object.entries(n).forEach(([key, value]) => {
                if (key !== 'createdAt' && key !== 'updatedAt') {
                  apiData[key] = value;
                }
              });
              nodeApi.create(apiData as Partial<import('../services/api').NodeData>).catch((error: unknown) => {
                console.error('[appStore] 同步恢复节点到服务端失败:', error);
              });
            });
            deletedRelations.forEach(r => {
              nodeApi.createRelation({
                id: r.id,
                sourceId: r.sourceId,
                targetId: r.targetId,
                type: r.type,
                description: r.description,
              }).catch((error: unknown) => {
                console.error('[appStore] 同步恢复关系到服务端失败:', error);
              });
            });
            deletedConversations.forEach(c => {
              conversationApi.getByNodeId(c.nodeId, c.id).catch((error: unknown) => {
                console.error('[appStore] 同步恢复对话到服务端失败:', error);
              });
            });
          },
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

        const sourceNode = get().nodes.get(relation.sourceId);
        const targetNode = get().nodes.get(relation.targetId);
        const sourceTitle = sourceNode?.title ?? relation.sourceId;
        const targetTitle = targetNode?.title ?? relation.targetId;

        set((state) => ({
          relations: [...state.relations, newRelation]
        }));

        nodeApi.createRelation({
          id,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          type: relation.type,
          description: relation.description,
        }).catch((error: unknown) => {
          console.error('[appStore] 同步创建关系到服务端失败:', error);
        });

        get().pushCommand({
          id: generateId(),
          description: `创建关系: ${sourceTitle} → ${targetTitle}`,
          execute: () => {
            set((state) => ({
              relations: [...state.relations, { ...newRelation }]
            }));
            nodeApi.createRelation({
              id,
              sourceId: relation.sourceId,
              targetId: relation.targetId,
              type: relation.type,
              description: relation.description,
            }).catch((error: unknown) => {
              console.error('[appStore] 同步创建关系到服务端失败:', error);
            });
          },
          undo: () => {
            set((state) => ({
              relations: state.relations.filter(r => r.id !== id)
            }));
            nodeApi.deleteRelation(id).catch((error: unknown) => {
              console.error('[appStore] 同步删除关系到服务端失败:', error);
            });
          },
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
        const relation = get().relations.find(r => r.id === id);
        if (!relation) return;

        const sourceNode = get().nodes.get(relation.sourceId);
        const targetNode = get().nodes.get(relation.targetId);
        const sourceTitle = sourceNode?.title ?? relation.sourceId;
        const targetTitle = targetNode?.title ?? relation.targetId;

        const capturedRelation = { ...relation };

        set((state) => ({
          relations: state.relations.filter(r => r.id !== id)
        }));

        nodeApi.deleteRelation(id).catch((error: unknown) => {
          console.error('[appStore] 同步删除关系到服务端失败:', error);
        });

        get().pushCommand({
          id: generateId(),
          description: `删除关系: ${sourceTitle} → ${targetTitle}`,
          execute: () => {
            set((state) => ({
              relations: state.relations.filter(r => r.id !== id)
            }));
            nodeApi.deleteRelation(id).catch((error: unknown) => {
              console.error('[appStore] 同步删除关系到服务端失败:', error);
            });
          },
          undo: () => {
            set((state) => ({
              relations: [...state.relations, capturedRelation]
            }));
            nodeApi.createRelation({
              id: capturedRelation.id,
              sourceId: capturedRelation.sourceId,
              targetId: capturedRelation.targetId,
              type: capturedRelation.type,
              description: capturedRelation.description,
            }).catch((error: unknown) => {
              console.error('[appStore] 同步恢复关系到服务端失败:', error);
            });
          },
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
       * 弹出undoStack顶部Command，调用其undo()，推入redoStack
       */
      undo: () => {
        const { undoStack } = get();
        if (undoStack.length === 0) return;

        const command = undoStack[undoStack.length - 1];
        command.undo();

        set((state) => {
          const newUndoStack = state.undoStack.slice(0, -1);
          const newRedoStack = [...state.redoStack, command];
          return {
            undoStack: newUndoStack,
            redoStack: newRedoStack,
            canUndo: newUndoStack.length > 0,
            canRedo: newRedoStack.length > 0,
          };
        });
      },

      /**
       * 重做操作
       * 弹出redoStack顶部Command，调用其execute()，推入undoStack
       */
      redo: () => {
        const { redoStack } = get();
        if (redoStack.length === 0) return;

        const command = redoStack[redoStack.length - 1];
        command.execute();

        set((state) => {
          const newRedoStack = state.redoStack.slice(0, -1);
          const newUndoStack = [...state.undoStack, command];
          if (newUndoStack.length > MAX_STACK_SIZE) {
            newUndoStack.shift();
          }
          return {
            undoStack: newUndoStack,
            redoStack: newRedoStack,
            canUndo: newUndoStack.length > 0,
            canRedo: newRedoStack.length > 0,
          };
        });
      },

      /**
       * 推送命令到撤销栈
       * 将command推入undoStack，清空redoStack
       * @param command - 要推送的命令对象
       */
      pushCommand: (command: Command) => {
        set((state) => {
          const newUndoStack = [...state.undoStack, command];
          if (newUndoStack.length > MAX_STACK_SIZE) {
            newUndoStack.shift();
          }
          return {
            undoStack: newUndoStack,
            redoStack: [],
            canUndo: newUndoStack.length > 0,
            canRedo: false,
          };
        });
      },

      /**
       * 撤销到指定位置
       * 连续执行undo操作直到undoStack长度等于targetIndex+1
       * @param targetIndex - 目标位置在undoStack中的索引
       */
      undoTo: (targetIndex: number) => {
        const { undoStack } = get();
        const stepsToUndo = undoStack.length - 1 - targetIndex;
        for (let i = 0; i < stepsToUndo; i++) {
          get().undo();
        }
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

        const oldNodeStates: Map<string, NodeData> = new Map();
        nodeIds.forEach(nid => {
          const n = get().nodes.get(nid);
          if (n) {
            oldNodeStates.set(nid, { ...n });
          }
        });

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

        get().pushCommand({
          id: generateId(),
          description: `创建节点: ${title}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              const compositeNode = get().nodes.get(compositeId);
              if (compositeNode) {
                newNodes.set(compositeId, { ...compositeNode });
              }
              nodeIds.forEach(nid => {
                const n = newNodes.get(nid);
                if (n) {
                  newNodes.set(nid, { ...n, hidden: true, compositeParent: compositeId });
                }
              });
              return { nodes: newNodes };
            });
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
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.delete(compositeId);
              oldNodeStates.forEach((oldNode, nid) => {
                newNodes.set(nid, { ...oldNode });
              });
              return { nodes: newNodes };
            });
            nodeApi.delete(compositeId).catch((error: unknown) => {
              console.error('[appStore] 同步删除复合节点到服务端失败:', error);
            });
            for (const aggregatedId of nodeIds) {
              const oldNode = oldNodeStates.get(aggregatedId);
              if (oldNode) {
                nodeApi.update(aggregatedId, {
                  hidden: oldNode.hidden,
                  compositeParent: oldNode.compositeParent,
                }).catch((error: unknown) => {
                  console.error('[appStore] 同步恢复聚合节点状态到服务端失败:', error);
                });
              }
            }
          },
        });
      },

      /**
       * 切换聚合节点的展开/折叠状态
       * 展开时：子节点以扇形分布在聚合节点周围，聚合节点保持可见
       * 折叠时：子节点隐藏，恢复聚合节点状态
       * @param nodeId - 复合节点ID
       */
      expandCompositeNode: (nodeId) => {
        const compositeNode = get().nodes.get(nodeId);
        if (!compositeNode || !compositeNode.isComposite || !compositeNode.compositeChildren) return;

        const wasExpanded = compositeNode.expanded;

        const beforeNodeStates: Map<string, NodeData> = new Map();
        beforeNodeStates.set(nodeId, { ...compositeNode });
        compositeNode.compositeChildren.forEach(childId => {
          const child = get().nodes.get(childId);
          if (child) {
            beforeNodeStates.set(childId, { ...child });
          }
        });

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

        const nodeTitle = compositeNode.title;
        get().pushCommand({
          id: generateId(),
          description: `更新节点: ${nodeTitle}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              const node = newNodes.get(nodeId);
              if (!node || !node.isComposite || !node.compositeChildren) return state;

              if (wasExpanded) {
                node.compositeChildren.forEach(childId => {
                  const child = newNodes.get(childId);
                  if (child) {
                    newNodes.set(childId, { ...child, hidden: true, compositeParent: nodeId });
                  }
                });
                newNodes.set(nodeId, { ...node, expanded: false });
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
                    newNodes.set(childId, { ...child, hidden: false, compositeParent: nodeId, position: { x: newX, y: newY } });
                  }
                });
                newNodes.set(nodeId, { ...node, expanded: true });
              }
              return { nodes: newNodes };
            });
            for (const uid of updatedNodeIds) {
              const un = get().nodes.get(uid);
              if (un) {
                nodeApi.update(uid, {
                  hidden: un.hidden,
                  expanded: un.expanded,
                  compositeParent: un.compositeParent,
                  position: un.position,
                }).catch((error: unknown) => {
                  console.error('[appStore] 同步复合节点展开状态到服务端失败:', error);
                });
              }
            }
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              beforeNodeStates.forEach((oldNode, nid) => {
                newNodes.set(nid, { ...oldNode });
              });
              return { nodes: newNodes };
            });
            for (const uid of updatedNodeIds) {
              const un = get().nodes.get(uid);
              if (un) {
                nodeApi.update(uid, {
                  hidden: un.hidden,
                  expanded: un.expanded,
                  compositeParent: un.compositeParent,
                  position: un.position,
                }).catch((error: unknown) => {
                  console.error('[appStore] 同步复合节点展开状态到服务端失败:', error);
                });
              }
            }
          },
        });
      },

      /**
       * 创建结论节点
       * 从源节点提炼结论并创建新的结论类型节点，建立 conclusion 关系
       * @param sourceNodeId - 源节点ID
       * @param conclusion - 结论文本内容
       */
      createConclusionNode: (sourceNodeId, conclusion) => {
        const sourceNode = get().nodes.get(sourceNodeId);
        if (!sourceNode) return;

        const id = generateId();
        const relationId = generateId();
        const title = conclusion.length > 15 ? conclusion.substring(0, 15) + '...' : conclusion;

        const offsetX = 280;
        const offsetY = 80;
        const position = {
          x: sourceNode.position.x + offsetX,
          y: sourceNode.position.y + offsetY,
        };

        const newNode: NodeData = {
          id,
          title,
          summary: conclusion,
          type: 'conclusion',
          parentIds: [sourceNodeId],
          childrenIds: [],
          isRoot: false,
          isComposite: false,
          compositeChildren: undefined,
          compositeParent: undefined,
          hidden: false,
          conversationId: null,
          position,
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          expanded: true,
        };

        const newRelation: RelationData = {
          id: relationId,
          sourceId: sourceNodeId,
          targetId: id,
          type: 'conclusion',
          createdAt: new Date(),
        };

        const previousSelectedNodeId = get().selectedNodeId;

        set((state) => {
          const newNodes = new Map(state.nodes);
          newNodes.set(id, newNode);

          const updatedSource = newNodes.get(sourceNodeId);
          if (updatedSource) {
            newNodes.set(sourceNodeId, {
              ...updatedSource,
              childrenIds: [...updatedSource.childrenIds, id],
            });
          }

          return {
            nodes: newNodes,
            relations: [...state.relations, newRelation],
            selectedNodeId: id,
          };
        });

        nodeApi.create({
          id,
          title,
          summary: conclusion,
          type: 'conclusion',
          position,
          isRoot: false,
          parentIds: [sourceNodeId],
          childrenIds: [],
          isComposite: false,
          hidden: false,
          expanded: true,
          tags: [],
        }).catch((error: unknown) => {
          console.error('[appStore] 同步创建结论节点到服务端失败:', error);
        });

        nodeApi.createRelation({
          id: relationId,
          sourceId: sourceNodeId,
          targetId: id,
          type: 'conclusion',
        }).catch((error: unknown) => {
          console.error('[appStore] 同步创建结论关系到服务端失败:', error);
        });

        get().pushCommand({
          id: generateId(),
          description: `创建结论节点: ${title}`,
          execute: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.set(id, { ...newNode });
              const updatedSource = newNodes.get(sourceNodeId);
              if (updatedSource) {
                newNodes.set(sourceNodeId, {
                  ...updatedSource,
                  childrenIds: [...updatedSource.childrenIds, id],
                });
              }
              return {
                nodes: newNodes,
                relations: [...state.relations, { ...newRelation }],
                selectedNodeId: id,
              };
            });
            nodeApi.create({
              id,
              title,
              summary: conclusion,
              type: 'conclusion',
              position,
              isRoot: false,
              parentIds: [sourceNodeId],
              childrenIds: [],
              isComposite: false,
              hidden: false,
              expanded: true,
              tags: [],
            }).catch((error: unknown) => {
              console.error('[appStore] 同步创建结论节点到服务端失败:', error);
            });
            nodeApi.createRelation({
              id: relationId,
              sourceId: sourceNodeId,
              targetId: id,
              type: 'conclusion',
            }).catch((error: unknown) => {
              console.error('[appStore] 同步创建结论关系到服务端失败:', error);
            });
          },
          undo: () => {
            set((state) => {
              const newNodes = new Map(state.nodes);
              newNodes.delete(id);
              const updatedSource = newNodes.get(sourceNodeId);
              if (updatedSource) {
                newNodes.set(sourceNodeId, {
                  ...updatedSource,
                  childrenIds: updatedSource.childrenIds.filter(cid => cid !== id),
                });
              }
              return {
                nodes: newNodes,
                relations: state.relations.filter(r => r.id !== relationId),
                selectedNodeId: state.selectedNodeId === id ? previousSelectedNodeId : state.selectedNodeId,
              };
            });
            nodeApi.delete(id).catch((error: unknown) => {
              console.error('[appStore] 同步删除结论节点到服务端失败:', error);
            });
            nodeApi.deleteRelation(relationId).catch((error: unknown) => {
              console.error('[appStore] 同步删除结论关系到服务端失败:', error);
            });
          },
        });
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
       * 重置节点、关系、对话、撤销/重做栈等所有状态
       */
      clearAllData: () => {
        set({
          nodes: new Map(),
          relations: [],
          conversations: new Map(),
          selectedNodeId: null,
          hoveredNodeId: null,
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
          searchQuery: '',
          searchResults: [],
          activePanel: null,
        });
      },

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
