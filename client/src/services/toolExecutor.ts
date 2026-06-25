/**
 * AI 工具执行器
 * 负责在客户端执行 AI 调用的工具，操作 Zustand Store 中的思维导图数据
 */

import { useAppStore } from '../stores/appStore';
import type { RelationType } from '../stores/appStore';
import type { ToolCall, ToolResult } from '../types';

/** 有效的关系类型列表，用于运行时校验 AI 返回的 relation_type */
const VALID_RELATION_TYPES: readonly string[] = [
  'parent-child', 'supports', 'contradicts', 'prerequisite',
  'elaborates', 'references', 'conclusion', 'custom',
];

/**
 * 解析节点ID：如果传入的不是UUID格式，则按标题查找匹配的节点
 * UUID格式通常包含连字符，如 "mqd77etk-8zqna2x"
 * @param store - Zustand Store 状态
 * @param nodeIdOrTitle - 节点ID或节点标题
 * @returns 匹配的节点ID，未找到返回 null
 */
function resolveNodeId(
  store: ReturnType<typeof useAppStore.getState>,
  nodeIdOrTitle: string
): string | null {
  // 先按ID查找
  if (store.nodes.get(nodeIdOrTitle)) {
    return nodeIdOrTitle;
  }
  // 按标题查找（精确匹配）
  const matchedNode = Array.from(store.nodes.values()).find(
    (n) => n.title === nodeIdOrTitle
  );
  if (matchedNode) {
    return matchedNode.id;
  }
  // 按标题查找（包含匹配）
  const partialMatchedNode = Array.from(store.nodes.values()).find(
    (n) => n.title.includes(nodeIdOrTitle) || nodeIdOrTitle.includes(n.title)
  );
  return partialMatchedNode?.id || null;
}

/** 工具执行结果的详细数据 */
interface ToolExecutionData {
  [key: string]: unknown;
}

/** 工具执行返回类型 */
interface ToolExecutionResult {
  /** 是否执行成功 */
  success: boolean;
  /** 结果描述 */
  message: string;
  /** 详细数据 */
  data?: ToolExecutionData;
}

/**
 * 执行单个工具调用
 * @param toolCall - 工具调用信息
 * @returns 工具执行结果
 */
export async function executeTool(toolCall: ToolCall): Promise<ToolExecutionResult> {
  const store = useAppStore.getState();

  try {
    // 解析工具参数
    const args = JSON.parse(toolCall.arguments) as Record<string, unknown>;

    switch (toolCall.name) {
      case 'create_node':
        return await executeCreateNode(store, args);

      case 'create_relation':
        return await executeCreateRelation(store, args);

      case 'update_node':
        return await executeUpdateNode(store, args);

      case 'expand_node':
        return await executeExpandNode(store, args);

      case 'get_mindmap_context':
        return await executeGetMindmapContext(store);

      case 'get_node_detail':
        return await executeGetNodeDetail(store, args);

      default:
        return {
          success: false,
          message: `未知工具: ${toolCall.name}`,
        };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return {
      success: false,
      message: `工具执行失败: ${errorMessage}`,
    };
  }
}

/**
 * 执行多个工具调用
 * @param toolCalls - 工具调用列表
 * @returns 工具执行结果列表（用于回传服务端）
 */
export async function executeTools(toolCalls: ToolCall[]): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall);
    results.push({
      tool_call_id: toolCall.id,
      content: JSON.stringify({
        success: result.success,
        message: result.message,
        data: result.data,
      }),
    });
  }

  return results;
}

/**
 * 执行创建节点工具
 * @param store - Zustand Store 状态
 * @param args - 工具参数，包含 parent_node_id、title、可选 content
 * @returns 工具执行结果，成功时 data 中包含 node_id
 */
async function executeCreateNode(
  store: ReturnType<typeof useAppStore.getState>,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const parentNodeIdRaw = args.parent_node_id as string | undefined;
  const title = args.title as string;
  const content = args.content as string | undefined;

  // 解析父节点ID：优先使用传入的ID/标题，否则使用当前选中节点
  let parentNodeId: string | null = null;

  if (parentNodeIdRaw) {
    parentNodeId = resolveNodeId(store, parentNodeIdRaw);
  }

  // 如果传入的ID无效，回退到当前选中节点
  if (!parentNodeId && store.selectedNodeId) {
    parentNodeId = store.selectedNodeId;
  }

  // 如果仍然没有父节点，尝试使用根节点
  if (!parentNodeId) {
    const rootNode = Array.from(store.nodes.values()).find((n) => n.isRoot);
    parentNodeId = rootNode?.id || null;
  }

  if (!parentNodeId) {
    return {
      success: false,
      message: `无法确定父节点。请使用 get_mindmap_context 获取正确的节点ID，或先选中一个节点`,
    };
  }

  // 创建子节点，createChildNode 返回新节点ID，失败时返回空字符串
  const newNodeId = store.createChildNode(parentNodeId, title);

  if (!newNodeId) {
    return {
      success: false,
      message: `创建节点失败: ${title}`,
    };
  }

  // 如果有内容，更新节点摘要
  if (content) {
    store.updateNode(newNodeId, { summary: content });
  }

  store.selectNode(newNodeId);
  store.autoLayout();

  return {
    success: true,
    message: `已创建节点: ${title}`,
    data: { node_id: newNodeId },
  };
}

/**
 * 执行创建关系工具
 * @param store - Zustand Store 状态
 * @param args - 工具参数，包含 source_node_id、target_node_id、relation_type、可选 label
 * @returns 工具执行结果，成功时 data 中包含 relation_id
 */
async function executeCreateRelation(
  store: ReturnType<typeof useAppStore.getState>,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const sourceNodeIdRaw = args.source_node_id as string;
  const targetNodeIdRaw = args.target_node_id as string;
  const relationType = args.relation_type as string;
  const label = args.label as string | undefined;

  // 解析节点ID（支持传入标题自动查找）
  const sourceNodeId = resolveNodeId(store, sourceNodeIdRaw);
  const targetNodeId = resolveNodeId(store, targetNodeIdRaw);

  if (!sourceNodeId) {
    return {
      success: false,
      message: `起始节点不存在: ${sourceNodeIdRaw}（请使用 get_mindmap_context 获取正确的节点ID）`,
    };
  }

  if (!targetNodeId) {
    return {
      success: false,
      message: `目标节点不存在: ${targetNodeIdRaw}（请使用 get_mindmap_context 获取正确的节点ID）`,
    };
  }

  // 创建关系，addRelation 参数为 Omit<RelationData, 'id' | 'createdAt'>
  const relationId = store.addRelation({
    sourceId: sourceNodeId,
    targetId: targetNodeId,
    type: VALID_RELATION_TYPES.includes(relationType) ? (relationType as RelationType) : 'custom',
    description: label,
  });

  return {
    success: true,
    message: `已创建关系: ${relationType}`,
    data: { relation_id: relationId },
  };
}

/**
 * 执行更新节点工具
 * @param store - Zustand Store 状态
 * @param args - 工具参数，包含 node_id、可选 title、可选 content
 * @returns 工具执行结果
 */
async function executeUpdateNode(
  store: ReturnType<typeof useAppStore.getState>,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const nodeIdRaw = args.node_id as string;
  const title = args.title as string | undefined;
  const content = args.content as string | undefined;

  // 解析节点ID（支持传入标题自动查找）
  const nodeId = resolveNodeId(store, nodeIdRaw);
  if (!nodeId) {
    return {
      success: false,
      message: `节点不存在: ${nodeIdRaw}（请使用 get_mindmap_context 获取正确的节点ID）`,
    };
  }

  const node = store.nodes.get(nodeId)!;
  // 至少需要提供 title 或 content
  if (!title && !content) {
    return {
      success: false,
      message: '至少需要提供 title 或 content 参数',
    };
  }

  // 更新节点，updateNode 参数为 Partial<NodeData>
  // 工具参数 content 对应 NodeData 的 summary 字段
  const updates: Partial<import('../stores/appStore').NodeData> = {};
  if (title) {
    updates.title = title;
  }
  if (content) {
    updates.summary = content;
  }

  store.updateNode(nodeId, updates);

  return {
    success: true,
    message: `已更新节点: ${title || node.title}`,
  };
}

/**
 * 执行扩展节点工具
 * 根据指定方向为节点创建多个子主题
 * @param store - Zustand Store 状态
 * @param args - 工具参数，包含 node_id、direction、可选 count
 * @returns 工具执行结果，成功时 data 中包含 created_node_ids
 */
async function executeExpandNode(
  store: ReturnType<typeof useAppStore.getState>,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const nodeIdRaw = args.node_id as string | undefined;
  const direction = args.direction as string;
  const count = (args.count as number) || 3;

  // 解析节点ID：优先使用传入的ID/标题，否则使用当前选中节点
  let nodeId: string | null = null;

  if (nodeIdRaw) {
    nodeId = resolveNodeId(store, nodeIdRaw);
  }

  if (!nodeId && store.selectedNodeId) {
    nodeId = store.selectedNodeId;
  }

  if (!nodeId) {
    const rootNode = Array.from(store.nodes.values()).find((n) => n.isRoot);
    nodeId = rootNode?.id || null;
  }

  if (!nodeId) {
    return {
      success: false,
      message: `无法确定目标节点。请使用 get_mindmap_context 获取正确的节点ID，或先选中一个节点`,
    };
  }

  const node = store.nodes.get(nodeId)!;
  // 根据扩展方向生成子主题标题
  const directionLabels: Record<string, string> = {
    deepen: '深入',
    broaden: '扩展',
    apply: '应用',
    compare: '对比',
  };

  const directionLabel = directionLabels[direction] || '扩展';
  const createdNodeIds: string[] = [];

  // 创建子节点
  for (let i = 0; i < count; i++) {
    const childTitle = `${directionLabel}方向 ${i + 1}`;
    const newNodeId = store.createChildNode(nodeId, childTitle);
    if (newNodeId) {
      createdNodeIds.push(newNodeId);
    }
  }

  // 自动布局
  store.autoLayout();

  return {
    success: true,
    message: `已为节点"${node.title}"创建 ${createdNodeIds.length} 个${directionLabel}子主题`,
    data: { created_node_ids: createdNodeIds },
  };
}

/**
 * 执行获取思维导图上下文工具
 * 返回所有可见节点的精简信息，供 AI 了解当前导图结构
 * @param store - Zustand Store 状态
 * @returns 工具执行结果，data 中包含 nodes 列表和 root_node_id
 */
async function executeGetMindmapContext(
  store: ReturnType<typeof useAppStore.getState>
): Promise<ToolExecutionResult> {
  // 获取所有可见节点的精简信息（nodes 为 Map 类型，需转换为数组）
  const visibleNodes = Array.from(store.nodes.values())
    .filter((n) => !n.hidden)
    .map((n) => ({
      id: n.id,
      title: n.title,
      type: n.type,
      isRoot: n.isRoot,
      parentIds: n.parentIds,
      childrenIds: n.childrenIds,
    }));

  // 找到根节点
  const rootNode = Array.from(store.nodes.values()).find((n) => n.isRoot);

  return {
    success: true,
    message: `当前导图共 ${visibleNodes.length} 个节点`,
    data: {
      nodes: visibleNodes,
      root_node_id: rootNode?.id || null,
    },
  };
}

/**
 * 执行获取节点详情工具
 * 返回节点的完整信息，包括关联关系
 * @param store - Zustand Store 状态
 * @param args - 工具参数，包含 node_id
 * @returns 工具执行结果，data 中包含节点详情和关联关系
 */
async function executeGetNodeDetail(
  store: ReturnType<typeof useAppStore.getState>,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const nodeIdRaw = args.node_id as string;

  // 解析节点ID（支持传入标题自动查找）
  const nodeId = resolveNodeId(store, nodeIdRaw);
  if (!nodeId) {
    return {
      success: false,
      message: `节点不存在: ${nodeIdRaw}（请使用 get_mindmap_context 获取正确的节点ID）`,
    };
  }

  // 查找节点（nodes 为 Map 类型，使用 get 方法）
  const node = store.nodes.get(nodeId)!;
  // 获取节点关联的关系
  const relations = store.relations
    .filter((r) => r.sourceId === nodeId || r.targetId === nodeId)
    .map((r) => ({
      id: r.id,
      type: r.type,
      targetId: r.sourceId === nodeId ? r.targetId : r.sourceId,
      description: r.description,
    }));

  return {
    success: true,
    message: `节点详情: ${node.title}`,
    data: {
      id: node.id,
      title: node.title,
      content: node.summary,
      type: node.type,
      tags: node.tags,
      parentIds: node.parentIds,
      childrenIds: node.childrenIds,
      relations,
    },
  };
}
