/**
 * 节点 Store（Slice）
 * 负责节点 CRUD、选择/悬停、搜索、复合节点、结论节点、自动布局等节点相关状态与方法。
 *
 * 说明：本文件采用 zustand 的 Slice 模式，导出 createNodeSlice 用于在 appStore 中组合。
 * 状态最终由聚合 Store（useAppStore）统一持有，跨 Slice 的状态依赖通过 get() 访问。
 */
import type { RelationData } from './relationStore';
import type { ConversationData } from './conversationStore';
import type { AppState } from './appStore';
import { useAppStore } from './appStore';
import { generateId } from './storeUtils';
import { nodeApi, getLocalWorkspaceId } from '../services/api';
import type { NodeData as ApiNodeData } from '../services/api';
import { track, TRACK_EVENT_NODE_CREATED, TRACK_EVENT_TEMPLATE_USED } from '../services/tracker';
import type { TemplateData } from '../data/templates';
import i18n from 'i18next';

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
 * 节点 Slice 状态与方法接口
 */
export interface NodeSlice {
  /** 全部节点（按 id 索引） */
  nodes: Map<string, NodeData>;
  /** 当前选中节点ID */
  selectedNodeId: string | null;
  /** 当前悬停节点ID */
  hoveredNodeId: string | null;
  /** 用户手动维护标题的节点ID集合 */
  manuallyTitledNodeIds: Set<string>;
  /** 搜索关键词 */
  searchQuery: string;
  /** 搜索结果列表 */
  searchResults: { nodeId: string; matches: string[] }[];

  /** 创建根节点 */
  createRootNode: (title?: string) => string;
  /** 创建子节点 */
  createChildNode: (parentId: string, title?: string) => string;
  /** 添加节点 */
  addNode: (node: Omit<NodeData, 'createdAt' | 'updatedAt'>) => string;
  /** 更新节点 */
  updateNode: (id: string, updates: Partial<NodeData>) => void;
  /** 删除节点（递归删除子树） */
  deleteNode: (id: string) => void;
  /** 选择节点 */
  selectNode: (id: string | null) => void;
  /** 悬停节点 */
  hoverNode: (id: string | null) => void;
  /** 设置搜索关键词并触发搜索 */
  setSearchQuery: (query: string) => void;
  /** 执行节点搜索 */
  searchNodes: () => void;
  /** 标记节点标题为用户手动维护 */
  markNodeManuallyTitled: (nodeId: string) => void;
  /** 判断节点标题是否已被用户手动维护 */
  isNodeManuallyTitled: (nodeId: string) => boolean;
  /** 创建复合节点 */
  createCompositeNode: (nodeIds: string[], title: string) => void;
  /** 切换复合节点展开/折叠 */
  expandCompositeNode: (nodeId: string) => void;
  /** 创建结论节点 */
  createConclusionNode: (sourceNodeId: string, conclusion: string) => void;
  /** 自动布局所有节点 */
  autoLayout: () => void;
  /**
   * 从模板创建思维导图
   *
   * 根据传入的模板数据批量生成节点与关系，并选中根节点、上报埋点事件。
   * 失败时通过 console.error 输出错误日志，不抛出异常以避免阻塞用户操作。
   *
   * @param template - 模板数据，包含 nodes 与 relations
   * @returns 新创建的根节点 ID；若模板无根节点或异常时返回空字符串
   */
  createMapFromTemplate: (template: TemplateData) => string;
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
 * 兼容历史持久化数据或服务端返回数据中缺失的可选字段
 * @param node - 原始节点数据，可能缺少部分可选字段
 * @returns 迁移后的节点数据，补全缺失的可选字段
 */
export const migrateNodeData = (node: Partial<NodeData>): NodeData => {
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
  } as NodeData;
};

/**
 * 创建节点 Slice
 * @param set - 聚合 Store 的 set 函数
 * @param get - 聚合 Store 的 get 函数
 * @returns 节点 Slice 的状态与方法
 */
export const createNodeSlice = (set: SliceSet, get: SliceGet): NodeSlice => ({
  nodes: new Map(),
  selectedNodeId: null,
  hoveredNodeId: null,
  manuallyTitledNodeIds: new Set(),
  searchQuery: '',
  searchResults: [],

  /**
   * 创建根节点
   * @param title - 节点标题
   * @returns 新创建的节点ID
   */
  createRootNode: (title?: string) => {
    const nodeTitle = title ?? i18n.t('newConversation', { ns: 'chat' });
    const id = generateId();
    const existingRoots = Array.from(get().nodes.values()).filter(n => n.isRoot);
    const position = {
      x: 100 + existingRoots.length * 300,
      y: 100
    };

    const newNode = createDefaultNode(id, nodeTitle, position, true);
    const capturedNode = { ...newNode };
    const previousSelectedNodeId = get().selectedNodeId;

    set((state) => {
      const newNodes = new Map(state.nodes);
      newNodes.set(id, newNode);
      return { nodes: newNodes, selectedNodeId: id };
    });

    // 上报节点创建事件（根节点）
    track(TRACK_EVENT_NODE_CREATED, {
      nodeId: id,
      workspaceId: getLocalWorkspaceId() || '',
      title: nodeTitle,
    });

    nodeApi.create({
      id,
      title: nodeTitle,
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
      console.error('[nodeStore] 同步创建根节点到服务端失败:', error);
    });

    get().pushCommand({
      id: generateId(),
      description: i18n.t('createNodeAction', { ns: 'history', title: nodeTitle }),
      execute: () => {
        set((state) => {
          const newNodes = new Map(state.nodes);
          newNodes.set(id, capturedNode);
          return { nodes: newNodes, selectedNodeId: id };
        });
        nodeApi.create({
          id,
          title: nodeTitle,
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
          console.error('[nodeStore] 同步创建根节点到服务端失败:', error);
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
          console.error('[nodeStore] 同步删除节点到服务端失败:', error);
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
  createChildNode: (parentId, title?: string) => {
    const nodeTitle = title ?? i18n.t('newBranch', { ns: 'chat' });
    const id = generateId();
    const relationId = generateId();
    const parent = get().nodes.get(parentId);

    if (!parent) {
      return '';
    }

    const siblingCount = parent.childrenIds.length;
    const position = calculateNodePosition(parent, siblingCount, siblingCount + 1);

    const newNode: NodeData = {
      ...createDefaultNode(id, nodeTitle, position, false),
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

    // 上报节点创建事件（子节点/分支）
    track(TRACK_EVENT_NODE_CREATED, {
      nodeId: id,
      workspaceId: getLocalWorkspaceId() || '',
      title: nodeTitle,
    });

    nodeApi.createChild(parentId, nodeTitle, { id, position }).catch((error: unknown) => {
      console.error('[nodeStore] 同步创建子节点到服务端失败:', error);
    });

    get().pushCommand({
      id: generateId(),
      description: i18n.t('createNodeAction', { ns: 'history', title: nodeTitle }),
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
        nodeApi.createChild(parentId, nodeTitle, { id, position }).catch((error: unknown) => {
          console.error('[nodeStore] 同步创建子节点到服务端失败:', error);
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
          console.error('[nodeStore] 同步删除节点到服务端失败:', error);
        });
        nodeApi.deleteRelation(relationId).catch((error: unknown) => {
          console.error('[nodeStore] 同步删除关系到服务端失败:', error);
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
      description: i18n.t('createNodeAction', { ns: 'history', title: node.title }),
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

    const oldValues = { ...updates };
    const updateKeys = Object.keys(updates) as (keyof NodeData)[];
    updateKeys.forEach(key => {
      oldValues[key] = existingNode[key] as never;
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
    nodeApi.update(id, apiUpdates as Partial<ApiNodeData>).catch((error: unknown) => {
      console.error('[nodeStore] 同步更新节点到服务端失败:', error);
    });

    const nodeTitle = existingNode.title;
    get().pushCommand({
      id: generateId(),
      description: i18n.t('updateNodeAction', { ns: 'history', title: nodeTitle }),
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
        nodeApi.update(id, apiUpd as Partial<ApiNodeData>).catch((error: unknown) => {
          console.error('[nodeStore] 同步更新节点到服务端失败:', error);
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
        nodeApi.update(id, apiOldUpd as Partial<ApiNodeData>).catch((error: unknown) => {
          console.error('[nodeStore] 同步恢复节点到服务端失败:', error);
        });
      },
    });
  },

  /**
   * 删除节点
   * 递归删除子树，同时清理相关关系与对话
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
      console.error('[nodeStore] 同步删除节点到服务端失败:', error);
    });

    const nodeTitle = node.title;
    get().pushCommand({
      id: generateId(),
      description: i18n.t('deleteNodeAction', { ns: 'history', title: nodeTitle }),
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
          console.error('[nodeStore] 同步删除节点到服务端失败:', error);
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
          nodeApi.create(apiData as Partial<ApiNodeData>).catch((error: unknown) => {
            console.error('[nodeStore] 同步恢复节点到服务端失败:', error);
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
            console.error('[nodeStore] 同步恢复关系到服务端失败:', error);
          });
        });
        deletedConversations.forEach(c => {
          nodeApi.update(c.nodeId, { conversationId: c.id }).catch((error: unknown) => {
            console.error('[nodeStore] 同步恢复对话到服务端失败:', error);
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
   * 在节点标题、摘要及关联对话消息中匹配关键词
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
   * 标记节点标题为用户手动维护
   * @param nodeId - 被用户手动修改标题的节点ID
   */
  markNodeManuallyTitled: (nodeId) => {
    set((state) => {
      const manuallyTitledNodeIds = new Set(state.manuallyTitledNodeIds);
      manuallyTitledNodeIds.add(nodeId);
      return { manuallyTitledNodeIds };
    });
  },

  /**
   * 判断节点标题是否已被用户手动维护
   * @param nodeId - 待判断的节点ID
   * @returns 已手动维护时返回 true，否则返回 false
   */
  isNodeManuallyTitled: (nodeId) => get().manuallyTitledNodeIds.has(nodeId),

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
        type: 'default',
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

    // 上报节点创建事件（复合节点）
    track(TRACK_EVENT_NODE_CREATED, {
      nodeId: compositeId,
      workspaceId: getLocalWorkspaceId() || '',
      title,
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
      console.error('[nodeStore] 同步创建复合节点到服务端失败:', error);
    });

    for (const aggregatedId of nodeIds) {
      nodeApi.update(aggregatedId, {
        hidden: true,
        compositeParent: compositeId,
      }).catch((error: unknown) => {
        console.error('[nodeStore] 同步聚合节点状态到服务端失败:', error);
      });
    }

    get().pushCommand({
      id: generateId(),
      description: i18n.t('createNodeAction', { ns: 'history', title }),
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
          console.error('[nodeStore] 同步创建复合节点到服务端失败:', error);
        });
        for (const aggregatedId of nodeIds) {
          nodeApi.update(aggregatedId, {
            hidden: true,
            compositeParent: compositeId,
          }).catch((error: unknown) => {
            console.error('[nodeStore] 同步聚合节点状态到服务端失败:', error);
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
          console.error('[nodeStore] 同步删除复合节点到服务端失败:', error);
        });
        for (const aggregatedId of nodeIds) {
          const oldNode = oldNodeStates.get(aggregatedId);
          if (oldNode) {
            nodeApi.update(aggregatedId, {
              hidden: oldNode.hidden,
              compositeParent: oldNode.compositeParent,
            }).catch((error: unknown) => {
              console.error('[nodeStore] 同步恢复聚合节点状态到服务端失败:', error);
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
          console.error('[nodeStore] 同步复合节点展开状态到服务端失败:', error);
        });
      }
    }

    const nodeTitle = compositeNode.title;
    get().pushCommand({
      id: generateId(),
      description: i18n.t('updateNodeAction', { ns: 'history', title: nodeTitle }),
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
              console.error('[nodeStore] 同步复合节点展开状态到服务端失败:', error);
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
              console.error('[nodeStore] 同步复合节点展开状态到服务端失败:', error);
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
      console.error('[nodeStore] 同步创建结论节点到服务端失败:', error);
    });

    nodeApi.createRelation({
      id: relationId,
      sourceId: sourceNodeId,
      targetId: id,
      type: 'conclusion',
    }).catch((error: unknown) => {
      console.error('[nodeStore] 同步创建结论关系到服务端失败:', error);
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
          console.error('[nodeStore] 同步创建结论节点到服务端失败:', error);
        });
        nodeApi.createRelation({
          id: relationId,
          sourceId: sourceNodeId,
          targetId: id,
          type: 'conclusion',
        }).catch((error: unknown) => {
          console.error('[nodeStore] 同步创建结论关系到服务端失败:', error);
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
          console.error('[nodeStore] 同步删除结论节点到服务端失败:', error);
        });
        nodeApi.deleteRelation(relationId).catch((error: unknown) => {
          console.error('[nodeStore] 同步删除结论关系到服务端失败:', error);
        });
      },
    });
  },

  /**
   * 自动布局所有节点
   * 以根节点为起点，按层级递归排列子节点
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
   * 从模板创建思维导图
   *
   * 根据传入的模板数据批量生成节点与关系，并选中根节点、上报埋点事件。
   *
   * 实现流程：
   * 1. 遍历 template.nodes，为每个节点生成新 ID 并构造 NodeData（parentIds/childrenIds 初始为空）
   * 2. 建立 templateNodeIndexToId 映射，将模板节点索引映射到实际节点 ID
   * 3. 遍历 template.relations：通过映射获取 sourceId/targetId，
   *    仅对 parent-child 类型更新内存中节点的 parentIds/childrenIds，并调用 addRelation 创建关系
   * 4. 通过 addNode 将所有节点添加到 store
   * 5. 选中根节点（set({ selectedNodeId: rootId })）
   * 6. 上报 TRACK_EVENT_TEMPLATE_USED 埋点（载荷：templateId、templateName）
   * 7. 返回根节点 ID
   *
   * 异常处理：整体包裹 try-catch，失败时通过 console.error 输出日志并返回空字符串，
   * 不抛出异常以避免阻塞用户操作。
   *
   * @param template - 模板数据，包含 nodes 与 relations
   * @returns 新创建的根节点 ID；若模板无根节点或异常时返回空字符串
   */
  createMapFromTemplate: (template) => {
    try {
      // 待创建节点列表（内存中暂存，后续统一 addNode 到 store）
      const nodesToCreate: NodeData[] = [];
      // 模板节点索引 -> 实际节点 ID 的映射
      const templateNodeIndexToId = new Map<number, string>();
      // 实际节点 ID -> NodeData 的映射，便于后续按 ID 更新 parentIds/childrenIds
      const nodeIdToNode = new Map<string, NodeData>();
      // 根节点 ID（遍历模板节点时确定）
      let rootId = '';

      // 步骤 1：遍历模板节点，构造 NodeData 并建立索引映射
      template.nodes.forEach((templateNode, index) => {
        const nodeId = generateId();
        templateNodeIndexToId.set(index, nodeId);

        // 节点位置：根节点固定 (100, 100)；子节点按层级布局，第一层 x=400, y=100+i*120
        const position = templateNode.isRoot
          ? { x: 100, y: 100 }
          : { x: 400, y: 100 + index * 120 };

        const nodeData: NodeData = {
          id: nodeId,
          title: templateNode.title,
          summary: templateNode.summary ?? '',
          type: 'default',
          parentIds: [],
          childrenIds: [],
          isRoot: templateNode.isRoot,
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

        nodesToCreate.push(nodeData);
        nodeIdToNode.set(nodeId, nodeData);

        // 记录根节点 ID（取第一个 isRoot 为 true 的节点）
        if (templateNode.isRoot && !rootId) {
          rootId = nodeId;
        }
      });

      // 步骤 2：遍历模板关系，更新节点 parentIds/childrenIds 并创建关系
      template.relations.forEach((relation) => {
        const sourceId = templateNodeIndexToId.get(relation.source);
        const targetId = templateNodeIndexToId.get(relation.target);

        // 索引越界保护：跳过无效关系
        if (!sourceId || !targetId) {
          return;
        }

        // 仅 parent-child 类型需要更新父子关系数组
        if (relation.type === 'parent-child') {
          const sourceNode = nodeIdToNode.get(sourceId);
          const targetNode = nodeIdToNode.get(targetId);
          if (sourceNode && targetNode) {
            // 防止重复添加（同一对父子关系只添加一次）
            if (!sourceNode.childrenIds.includes(targetId)) {
              sourceNode.childrenIds.push(targetId);
            }
            if (!targetNode.parentIds.includes(sourceId)) {
              targetNode.parentIds.push(sourceId);
            }
          }
        }

        // 调用聚合 store 的 addRelation 创建关系
        get().addRelation({ sourceId, targetId, type: relation.type });
      });

      // 步骤 3：将所有节点通过 addNode 添加到 store
      nodesToCreate.forEach((node) => {
        get().addNode(node);
      });

      // 步骤 4：选中根节点
      if (rootId) {
        set({ selectedNodeId: rootId });
      }

      // 步骤 5：上报模板使用埋点
      track(TRACK_EVENT_TEMPLATE_USED, {
        templateId: template.id,
        templateName: template.name,
      });

      return rootId;
    } catch (error) {
      console.error('[nodeStore] 从模板创建思维导图失败:', error);
      return '';
    }
  },
});

/**
 * 节点 Slice 便捷 Hook（用于未来逐步迁移组件引用）
 * 注意：本 Hook 基于 useAppStore 选择器实现，调用形式为 useNodeStore(selector)
 *
 * 实现说明：通过 ES Module live binding 引用 useAppStore。
 * 由于 appStore.ts 会导入本文件的 createNodeSlice，形成模块循环；
 * 但 useNodeStore 仅在调用时（运行期）访问 useAppStore，此时 appStore 模块已完成求值，
 * 因此循环依赖是安全的。
 *
 * @param selector - 选择器函数，从节点 Slice 状态中选取所需片段
 * @returns 选择器返回的值
 */
export function useNodeStore<T>(selector: (s: NodeSlice) => T): T {
  return useAppStore(selector as (s: AppState) => T);
}
