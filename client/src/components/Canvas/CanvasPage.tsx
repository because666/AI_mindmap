import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  ReactFlow, 
  ReactFlowProvider,
  Controls, 
  MiniMap, 
  MarkerType, 
  useNodesState, 
  useEdgesState,
  useReactFlow,
  BaseEdge,
  getBezierPath,
  Handle,
  Position,
  ConnectionLineType
} from '@xyflow/react';
import type { Connection, Node, Edge, NodeProps, EdgeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, MessageSquare, MessageSquarePlus, Edit3, Link, Layers, Trash2, Undo2, Redo2, GitBranch, LayoutGrid, Maximize2, Minimize2, RefreshCw, MousePointer2, Combine, MoreHorizontal, Lightbulb } from 'lucide-react';
import { useAppStore, getRelationTypeLabels } from '../../stores/appStore';
import { useToastStore } from '../../stores/toastStore';
import NodeEditor from '../Node/NodeEditor';
import RelationEditor from '../Node/RelationEditor';
import CompositeNodeCreator from '../Node/CompositeNodeCreator';
import ConfirmDialog from '../Common/ConfirmDialog';
import { NodeContextMenu } from './NodeContextMenu';
import useIsMobile from '../../hooks/useIsMobile';
import { useLongPress } from '../../hooks/useLongPress';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';

/**
 * 关系类型颜色映射
 */
const RELATION_COLORS: Record<string, string> = {
  'parent-child': '#2dd4bf',
  'supports': '#34d399',
  'contradicts': '#f87171',
  'prerequisite': '#fbbf24',
  'elaborates': '#0d9488',
  'references': '#c084fc',
  'conclusion': '#22d3ee',
  'custom': '#f59e0b'
};

interface CustomNodeData extends Record<string, unknown> {
  label: string; 
  summary?: string;
  nodeType?: 'default' | 'conclusion';
  isRoot?: boolean;
  isComposite?: boolean;
  isExpanded?: boolean;
  childCount?: number;
  conversationId?: string | null;
  messageCount?: number;
  onExpand?: () => void;
  onLongPress?: (nodeId: string, clientX?: number, clientY?: number) => void;
}

type CustomNodeType = Node<CustomNodeData>;

/**
 * 自定义边组件 - 显示关系标签
 * 使用 bezier 路径类型
 */
const RelationEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeColor = (style as React.CSSProperties).stroke as string || '#2dd4bf';
  const strokeWidth = (style as React.CSSProperties).strokeWidth as number || 2;
  const strokeDasharray = (style as React.CSSProperties).strokeDasharray as string | undefined;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: edgeColor,
          strokeWidth: strokeWidth,
          strokeDasharray: strokeDasharray,
        }}
      />
      {label && (
        <g transform={`translate(${labelX}, ${labelY})`}>
          <rect
            x={-25}
            y={-10}
            width={50}
            height={20}
            rx={4}
            fill={edgeColor}
            opacity={0.9}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#fff"
            fontSize={10}
            fontWeight={500}
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
};

/**
 * 自定义节点组件 - 包含连接点
 */
const CustomNodeComponent: React.FC<NodeProps<CustomNodeType>> = ({ id, data, selected }) => {
  const { t } = useTranslation('canvas');
  const nodeData = data as CustomNodeData;
  const isMobile = useIsMobile();
  const selectedNodeId = useAppStore(state => state.selectedNodeId);
  const isSelected = selectedNodeId === id;
  const isConclusion = nodeData.nodeType === 'conclusion';

  const handleOpacity: number = isMobile ? (isSelected ? 1 : 0.4) : (isSelected ? 1 : 0);
  const handleSize: number = isMobile ? 12 : 8;
  const handlePadding: number = isMobile ? 16 : 0;

  const baseHandleStyle: React.CSSProperties = {
    width: handleSize,
    height: handleSize,
    background: '#292524',
    border: isConclusion ? '2px solid #fbbf24' : '2px solid #2dd4bf',
    borderRadius: '50%',
    opacity: handleOpacity,
    transition: 'opacity 0.2s ease',
    padding: handlePadding,
    boxSizing: 'content-box',
  };

  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: (_e, clientX, clientY) => {
      nodeData.onLongPress?.(id, clientX, clientY);
    },
  });

  return (
    <div
      className={`px-4 py-3 rounded-xl shadow-lg border-2 min-w-[160px] max-w-[280px] cursor-pointer transition-all ${
        isConclusion
          ? selected
            ? 'bg-amber-900/40 border-amber-400 shadow-amber-500/20'
            : 'bg-dark-700 border-amber-400 hover:border-amber-300'
          : selected
            ? 'bg-primary-600 border-primary-400 shadow-primary-500/20'
            : nodeData.isComposite && nodeData.isExpanded
              ? 'bg-primary-700/80 border-primary-400 shadow-primary-500/30'
              : nodeData.isRoot
                ? 'bg-dark-700 border-primary-500/50 hover:border-primary-400'
                : 'bg-dark-700 border-dark-600 hover:border-primary-500'
      }`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none',
      }}
      {...longPressHandlers}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={isSelected ? 'selected' : ''}
        style={baseHandleStyle}
      />

      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={isSelected ? 'selected' : ''}
        style={{ ...baseHandleStyle, borderColor: '#0d9488' }}
      />

      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={isSelected ? 'selected' : ''}
        style={{ ...baseHandleStyle, borderColor: '#0d9488' }}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={isSelected ? 'selected' : ''}
        style={baseHandleStyle}
      />
      
      <div className="flex items-center gap-2 mb-1">
        {isConclusion ? (
          <Lightbulb className="w-4 h-4 text-amber-400" />
        ) : nodeData.isComposite ? (
          <Layers className={`w-4 h-4 ${nodeData.isExpanded ? 'text-primary-300' : 'text-primary-400'}`} />
        ) : nodeData.isRoot ? (
          <GitBranch className="w-4 h-4 text-primary-400" />
        ) : (
          <MessageSquare className="w-4 h-4 text-primary-400" />
        )}
        <span className="text-white font-medium truncate flex-1">{nodeData.label}</span>
        {isConclusion && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/30">
            {t('conclusion')}
          </span>
        )}
        {nodeData.messageCount !== undefined && nodeData.messageCount > 0 && (
          <span className="text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full">
            {nodeData.messageCount}
          </span>
        )}
      </div>
      {nodeData.summary && (
        <p className="text-xs text-dark-300 truncate">{nodeData.summary}</p>
      )}
      {nodeData.isComposite && (
        <div className="flex items-center justify-between mt-2">
          <p className={`text-xs ${nodeData.isExpanded ? 'text-primary-300' : 'text-primary-400'}`}>
            {nodeData.isExpanded ? t('expanded') : t('containsNodes', { count: nodeData.childCount })}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onExpand?.();
            }}
            className={`p-1 rounded transition-colors ${
              nodeData.isExpanded 
                ? 'text-primary-300 hover:text-primary-200 hover:bg-primary-500/20' 
                : 'text-primary-400 hover:text-primary-300 hover:bg-primary-600/20'
            }`}
            title={nodeData.isExpanded ? t('collapseNode') : t('expandNode')}
          >
            {nodeData.isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      )}
      {nodeData.isRoot && (
        <p className="text-xs text-primary-400/70 mt-1">{t('rootNode')}</p>
      )}
    </div>
  );
};

/**
 * 思维画布组件
 */
const CanvasPageInner: React.FC = () => {
  const { t } = useTranslation('canvas');
  const { 
    nodes: storeNodes, 
    relations, 
    createRootNode,
    createChildNode,
    updateNode, 
    deleteNode, 
    selectNode, 
    selectedNodeId,
    undo,
    redo,
    canUndo,
    canRedo,
    expandCompositeNode,
    autoLayout,
    conversations,
    reloadWorkspaceData,
    requestOpenChat,
    activePanel,
    setActivePanel
  } = useAppStore();

  const { fitView } = useReactFlow();
  
  const nodesArray = useMemo(() => Array.from(storeNodes.values()), [storeNodes]);
  
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isRelationEditorOpen, setIsRelationEditorOpen] = useState(false);
  const [isCompositeCreatorOpen, setIsCompositeCreatorOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [selectedForComposite, setSelectedForComposite] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const isMobile = useIsMobile();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  /**
   * 移动端下拉菜单外部点击关闭
   */
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && e.target instanceof globalThis.Node && !mobileMenuRef.current.contains(e.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  /**
   * 转换store节点为ReactFlow节点
   */
  const flowNodes: Node[] = useMemo(() => {
    const result = nodesArray
      .filter((node) => !node.hidden)
      .map((node) => {
        const conversation = node.conversationId ? conversations.get(node.conversationId) : null;
        return {
          id: node.id,
          type: 'custom',
          position: node.position || { x: 100, y: 100 },
          data: {
            label: node.title || t('untitledNode'),
            summary: node.summary,
            nodeType: node.type || 'default',
            isRoot: node.isRoot,
            isComposite: node.isComposite,
            isExpanded: node.expanded,
            childCount: node.compositeChildren?.length || 0,
            conversationId: node.conversationId,
            messageCount: conversation?.messages.length || 0,
            onExpand: node.isComposite ? () => expandCompositeNode(node.id) : undefined,
            onLongPress: (nodeId: string, clientX?: number, clientY?: number) => {
              selectNode(nodeId);
              setContextMenu({
                x: clientX ?? 0,
                y: clientY ?? 0,
                nodeId,
              });
            }
          }
        };
      });
    return result;
  }, [nodesArray, conversations, expandCompositeNode, selectNode, t]);

  /**
   * 转换关系为边
   */
  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    
    if (!relations || !Array.isArray(relations)) {
      return edges;
    }

    const visibleNodeIds = new Set(nodesArray.filter(n => !n.hidden).map(n => n.id));

    relations.forEach((relation) => {
      if (!relation || typeof relation !== 'object') {
        return;
      }

      if (!relation.type || !relation.id || !relation.sourceId || !relation.targetId) {
        return;
      }

      const sourceVisible = visibleNodeIds.has(relation.sourceId);
      const targetVisible = visibleNodeIds.has(relation.targetId);

      if (!sourceVisible || !targetVisible) {
        return;
      }
      
      const color = RELATION_COLORS[relation.type] || '#eab308';
      const isParentChild = relation.type === 'parent-child';
      
      const edge: Edge = {
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        type: 'bezier',
        animated: false,
        style: { 
          stroke: color, 
          strokeWidth: 2 
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: color,
          width: 20,
          height: 20
        },
        sourceHandle: isParentChild ? 'bottom' : 'right',
        targetHandle: isParentChild ? 'top' : 'left',
      };
      
      if (!isParentChild) {
        edge.label = getRelationTypeLabels()[relation.type]?.label || relation.type;
        edge.labelStyle = { fill: '#fff', fontSize: 10, fontWeight: 500 };
        edge.labelBgStyle = { fill: color, fillOpacity: 0.9 };
        edge.labelBgPadding = [4, 2] as [number, number];
        edge.labelBgBorderRadius = 4;
      }
      
      edges.push(edge);
    });
    
    const expandedCompositeNodes = nodesArray.filter(n => n.isComposite && n.expanded && n.compositeChildren);
    
    expandedCompositeNodes.forEach(compositeNode => {
      if (compositeNode.compositeChildren) {
        compositeNode.compositeChildren.forEach(childId => {
          if (visibleNodeIds.has(childId)) {
            edges.push({
              id: `composite-${compositeNode.id}-${childId}`,
              source: compositeNode.id,
              target: childId,
              type: 'bezier',
              sourceHandle: 'bottom',
              targetHandle: 'top',
              style: { 
                stroke: '#8b5cf6', 
                strokeWidth: 2,
                strokeDasharray: '5,5'
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#8b5cf6'
              }
            });
          }
        });
      }
    });
    
    return edges;
  }, [relations, nodesArray]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  /**
   * 同步store变化到ReactFlow
   */
  useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  /**
   * 监听focus-node自定义事件，定位到目标节点并居中显示
   * 搜索面板点击搜索结果时触发此事件
   */
  useEffect(() => {
    const handleFocusNode = (e: Event) => {
      const customEvent = e as CustomEvent<{ nodeId: string }>;
      const nodeId = customEvent.detail?.nodeId;
      if (!nodeId) return;

      selectNode(nodeId);

      requestAnimationFrame(() => {
        fitView({
          nodes: [{ id: nodeId }],
          padding: 0.3,
          duration: 500,
        });
      });
    };

    window.addEventListener('focus-node', handleFocusNode);
    return () => window.removeEventListener('focus-node', handleFocusNode);
  }, [fitView, selectNode]);

  const canUndoValue = canUndo;
  const canRedoValue = canRedo;

  /**
   * 连接节点 - 创建关系
   */
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target) {
        setPendingConnection({ source: params.source, target: params.target });
        setIsRelationEditorOpen(true);
      }
    },
    []
  );

  /**
   * 创建根节点
   */
  const handleCreateRootNode = useCallback(() => {
    const id = createRootNode(t('newConversation'));
    selectNode(id);
    requestOpenChat(id);
  }, [createRootNode, selectNode, requestOpenChat, t]);

  /**
   * 创建子节点
   */
  const handleCreateChildNode = useCallback(() => {
    if (!selectedNodeId) {
      return;
    }
    
    const id = createChildNode(selectedNodeId, t('newBranch'));
    selectNode(id);
    requestOpenChat(id);
  }, [selectedNodeId, createChildNode, selectNode, requestOpenChat, t]);

  /**
   * 节点点击处理
   */
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isSelectMode) {
        setSelectedForComposite(prev => {
          if (prev.includes(node.id)) {
            return prev.filter(id => id !== node.id);
          }
          return [...prev, node.id];
        });
      } else {
        selectNode(node.id);
      }
    },
    [selectNode, isSelectMode]
  );

  /**
   * 节点双击 - 打开对话或展开复合节点
   */
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const storeNode = storeNodes.get(node.id);
      if (storeNode?.isComposite) {
        expandCompositeNode(node.id);
      } else {
        selectNode(node.id);
        requestOpenChat(node.id);
      }
    },
    [storeNodes, expandCompositeNode, selectNode, requestOpenChat]
  );

  /**
   * 节点拖拽结束
   */
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      updateNode(node.id, { position: node.position });
    },
    [updateNode]
  );

  /**
   * 节点右键菜单
   */
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent, node: Node) => {
      event.preventDefault();
      selectNode(node.id);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        nodeId: node.id,
      });
    },
    [selectNode]
  );

  /**
   * 上下文菜单操作：编辑节点
   */
  const handleContextMenuEdit = useCallback((nodeId: string) => {
    setEditingNodeId(nodeId);
    setIsNodeEditorOpen(true);
  }, []);

  /**
   * 上下文菜单操作：创建分支
   */
  const handleContextMenuBranch = useCallback((nodeId: string) => {
    const id = createChildNode(nodeId, t('newBranch'));
    selectNode(id);
    requestOpenChat(id);
  }, [createChildNode, selectNode, requestOpenChat, t]);

  /**
   * 上下文菜单操作：复制节点
   */
  const handleContextMenuCopy = useCallback((nodeId: string) => {
    const storeNode = storeNodes.get(nodeId);
    if (storeNode) {
      const title = storeNode.title || t('untitledNode');
      navigator.clipboard.writeText(title).catch(() => {});
    }
  }, [storeNodes, t]);

  /**
   * 上下文菜单操作：删除节点
   */
  const handleContextMenuDelete = useCallback((nodeId: string) => {
    deleteNode(nodeId);
  }, [deleteNode]);

  /**
   * 切换多选模式
   */
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode(prev => {
      if (prev) {
        setSelectedForComposite([]);
      }
      return !prev;
    });
  }, []);

  /**
   * 创建复合节点
   */
  const handleCreateComposite = useCallback(() => {
    if (selectedForComposite.length >= 2) {
      setIsCompositeCreatorOpen(true);
    }
  }, [selectedForComposite.length]);

  /**
   * 删除选中节点
   */
  const handleDeleteNode = useCallback(() => {
    if (selectedNodeId) {
      setDeleteConfirmOpen(true);
    }
  }, [selectedNodeId]);

  /**
   * 确认删除节点回调
   */
  const handleConfirmDeleteNode = useCallback(() => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
    }
    setDeleteConfirmOpen(false);
  }, [selectedNodeId, deleteNode]);

  /**
   * 取消删除节点回调
   */
  const handleCancelDeleteNode = useCallback(() => {
    setDeleteConfirmOpen(false);
  }, []);

  /**
   * 同步数据 - 优先处理同步队列，再从服务端重新加载当前工作区数据
   */
  const handleSyncData = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const success = await reloadWorkspaceData();
      if (success) {
        useToastStore.getState().addToast('success', t('dataSyncSuccess'));
      } else {
        useToastStore.getState().addToast('error', t('dataSyncFailed'));
      }
    } catch {
      useToastStore.getState().addToast('error', t('dataSyncFailed'));
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, reloadWorkspaceData, t]);

  /**
   * 打开节点编辑器
   */
  const openNodeEditor = useCallback(() => {
    setEditingNodeId(selectedNodeId);
    setIsNodeEditorOpen(true);
  }, [selectedNodeId]);

  /**
   * 关闭节点编辑器
   */
  const closeNodeEditor = useCallback(() => {
    setIsNodeEditorOpen(false);
    setEditingNodeId(null);
  }, []);

  /**
   * 关闭关系编辑器
   */
  const closeRelationEditor = useCallback(() => {
    setIsRelationEditorOpen(false);
    setPendingConnection(null);
  }, []);

  /**
   * 关闭复合节点创建器
   */
  const closeCompositeCreator = useCallback(() => {
    setIsCompositeCreatorOpen(false);
    setSelectedForComposite([]);
    setIsSelectMode(false);
  }, []);

  /**
   * 删除选中节点（快捷键触发）
   */
  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setDeleteConfirmOpen(true);
    }
  }, [selectedNodeId]);

  /**
   * 键盘快捷键处理
   * Ctrl+K: 搜索、Ctrl+Z: 撤销、Ctrl+Y: 重做、Delete: 删除、Ctrl+S: 同步、Escape: 关闭面板/取消选中
   */
  useKeyboardShortcuts({
    onSearch: () => setActivePanel('search'),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onDelete: handleDeleteSelected,
    onSave: handleSyncData,
    onEscape: () => {
      if (activePanel) {
        setActivePanel(null);
      } else if (selectedNodeId) {
        selectNode(null);
      }
    }
  });

  const nodeTypes = useMemo(() => ({ custom: CustomNodeComponent }), []);
  const edgeTypes = useMemo(() => ({ 
    bezier: RelationEdge,
    relation: RelationEdge 
  }), []);

  return (
    <div className="h-full relative">

      {isMobile ? (
        <div className="absolute z-10 top-2 left-2 right-2">
          <div className="flex flex-wrap items-center gap-1 p-2 glass rounded-xl">
            <button
              onClick={handleCreateRootNode}
              className="p-2.5 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors"
              title={t('newConversationTooltip')}
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
            <button
              onClick={handleCreateChildNode}
              disabled={!selectedNodeId}
              className="p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
              title={t('createBranch')}
            >
              <GitBranch className="w-5 h-5" />
            </button>
            <button
              onClick={openNodeEditor}
              disabled={!selectedNodeId}
              className="p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
              title={t('editNode')}
            >
              <Edit3 className="w-5 h-5" />
            </button>
            <button
              onClick={handleDeleteNode}
              disabled={!selectedNodeId}
              className="p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
              title={t('deleteWithShortcut')}
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={handleSyncData}
              disabled={isSyncing}
              className="p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors relative"
              title={t('syncDataWithShortcut')}
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <div className="relative ml-auto" ref={mobileMenuRef}>
              <button
                onClick={() => setIsMobileMenuOpen(prev => !prev)}
                className={`p-2.5 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors ${isMobileMenuOpen ? 'bg-dark-700/50' : ''}`}
                title={t('moreActions')}
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
              {isMobileMenuOpen && (
                <div className="absolute top-full right-0 mt-1 p-1 glass rounded-xl min-w-[160px] animate-scale-in z-50">
                  <button
                    onClick={() => { setIsRelationEditorOpen(true); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors"
                  >
                    <Link className="w-5 h-5" />
                    <span className="text-sm">{t('createRelation')}</span>
                  </button>
                  <button
                    onClick={() => { toggleSelectMode(); setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors ${isSelectMode ? 'bg-primary-600/20 text-primary-400' : ''}`}
                  >
                    <MousePointer2 className="w-5 h-5" />
                    <span className="text-sm">{t('multiSelectMode')}</span>
                  </button>
                  <button
                    onClick={() => { handleCreateComposite(); setIsMobileMenuOpen(false); }}
                    disabled={!isSelectMode || selectedForComposite.length < 2}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                  >
                    <Combine className="w-5 h-5" />
                    <span className="text-sm">{t('aggregate')}{isSelectMode && selectedForComposite.length >= 2 ? `(${selectedForComposite.length})` : ''}</span>
                  </button>
                  <button
                    onClick={() => { autoLayout(); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors"
                  >
                    <LayoutGrid className="w-5 h-5" />
                    <span className="text-sm">{t('autoLayout')}</span>
                  </button>
                  <div className="my-1 h-px bg-dark-700" />
                  <button
                    onClick={() => { undo(); setIsMobileMenuOpen(false); }}
                    disabled={!canUndoValue}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                  >
                    <Undo2 className="w-5 h-5" />
                    <span className="text-sm">{t('undo')}</span>
                  </button>
                  <button
                    onClick={() => { redo(); setIsMobileMenuOpen(false); }}
                    disabled={!canRedoValue}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                  >
                    <Redo2 className="w-5 h-5" />
                    <span className="text-sm">{t('redo')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute z-10 top-4 left-4">
          <div className="flex items-center gap-2 p-2 glass rounded-xl">
            <div className="flex items-center">
              <button
                onClick={handleCreateRootNode}
                className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors"
                title={t('newConversationTooltip')}
              >
                <MessageSquarePlus className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={handleCreateChildNode}
                disabled={!selectedNodeId}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                title={t('createBranch')}
              >
                <GitBranch className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div className="w-px h-6 bg-dark-700" />
            <div className="flex items-center">
              <button
                onClick={openNodeEditor}
                disabled={!selectedNodeId}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                title={t('editNode')}
              >
                <Edit3 className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={() => setIsRelationEditorOpen(true)}
                className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors"
                title={t('createRelation')}
              >
                <Link className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={handleDeleteNode}
                disabled={!selectedNodeId}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                title={t('deleteWithShortcut')}
              >
                <Trash2 className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div className="w-px h-6 bg-dark-700" />
            <div className="flex items-center">
              <button
                onClick={toggleSelectMode}
                className={`p-2 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors ${isSelectMode ? 'bg-primary-600/20 text-primary-400' : ''}`}
                title={t('multiSelectMode')}
              >
                <MousePointer2 className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={handleCreateComposite}
                disabled={!isSelectMode || selectedForComposite.length < 2}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                title={t('aggregate')}
              >
                <Combine className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={autoLayout}
                className="p-2 rounded-lg hover:bg-dark-700/50 text-dark-300 transition-colors"
                title={t('autoLayout')}
              >
                <LayoutGrid className="w-[18px] h-[18px]" />
              </button>
            </div>
            <div className="w-px h-6 bg-dark-700" />
            <div className="flex items-center">
              <button
                onClick={handleSyncData}
                disabled={isSyncing}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors relative"
                title={t('syncDataWithShortcut')}
              >
                <RefreshCw className={`w-[18px] h-[18px] ${isSyncing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={undo}
                disabled={!canUndoValue}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                title={t('undoWithShortcut')}
              >
                <Undo2 className="w-[18px] h-[18px]" />
              </button>
              <button
                onClick={redo}
                disabled={!canRedoValue}
                className="p-2 rounded-lg hover:bg-dark-700/50 disabled:opacity-40 disabled:cursor-not-allowed text-dark-300 transition-colors"
                title={t('redoWithShortcut')}
              >
                <Redo2 className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'bezier',
          animated: false
        }}
        connectionLineType={ConnectionLineType.Bezier}
        panOnDrag={true}
        zoomOnPinch={true}
        panOnScroll={false}
        preventScrolling={!isMobile}
        style={{ background: 'transparent' }}
      >
        <Controls className="bg-dark-800 border-dark-700 rounded-xl overflow-hidden [&>button]:bg-dark-700 [&>button]:border-dark-600 [&>button]:text-white [&>button:hover]:bg-dark-600 !bottom-4 md:!bottom-4" />
        {!isMobile && (
          <MiniMap
            className="bg-dark-800 border-dark-700 rounded-xl overflow-hidden"
            nodeColor={(node) => {
              const data = node.data as CustomNodeData;
              if (data?.nodeType === 'conclusion') return '#fbbf24';
              if (data?.isRoot) return '#14b8a6';
              if (data?.isComposite) return '#8b5cf6';
              return '#57534e';
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
        )}
      </ReactFlow>
      
      {/* 节点右键/长按菜单 */}
      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onEdit={handleContextMenuEdit}
          onCreateBranch={handleContextMenuBranch}
          onCopy={handleContextMenuCopy}
          onDelete={handleContextMenuDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 空状态提示 */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-blur-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-600/20"
                 style={{ animation: 'float 4s ease-in-out infinite' }}>
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
              {t('startBuildingMindNetwork')}
            </h2>
            <p className="text-dark-400 mb-6 max-w-md text-sm leading-relaxed">
              {t('buildMindNetworkDesc')}
            </p>
            <button
              onClick={handleCreateRootNode}
              className="pointer-events-auto btn-primary px-6 py-3 mx-auto"
            >
              <Plus className="w-5 h-5" />
              <span>{t('createFirstConversation')}</span>
            </button>
          </div>
        </div>
      )}

      {/* 工具提示 */}
      {!isMobile && (
        <div className="absolute bottom-4 left-4 text-dark-500 text-xs bg-dark-800/90 px-3 py-2 rounded-lg border border-dark-600/50">
          <span className="text-dark-400">{t('doubleClickToChat')}</span>
          <span className="mx-2">•</span>
          <span className="text-dark-400">{t('rightClickForMore')}</span>
          <span className="mx-2">•</span>
          <span className="text-primary-400">{t('clickToCreateRoot')}</span>
          {isSelectMode && <span className="ml-2 text-primary-400">• {t('multiSelectEnabled')}</span>}
        </div>
      )}

      {/* 关系统计 */}
      {relations.length > 0 && (
        <div className={`text-dark-500 text-xs bg-dark-800 px-3 py-2 rounded-lg border border-dark-600/50 ${
          isMobile ? 'absolute bottom-2 left-2 right-2 text-center' : 'absolute bottom-4 right-4'
        }`}>
          <span className="text-dark-400">{t('nodeCount', { count: nodes.length })}</span>
          <span className="mx-2">•</span>
          <span className="text-dark-400">{t('relationCount', { count: relations.length })}</span>
          {!isMobile && (
            <>
              <span className="mx-2">•</span>
              <span className="text-dark-400">{t('edgeCount', { count: edges.length })}</span>
            </>
          )}
        </div>
      )}

      <NodeEditor
        nodeId={editingNodeId || selectedNodeId}
        isOpen={isNodeEditorOpen}
        onClose={closeNodeEditor}
        allNodes={storeNodes}
      />

      <RelationEditor
        isOpen={isRelationEditorOpen}
        onClose={closeRelationEditor}
        sourceNodeId={pendingConnection?.source}
        targetNodeId={pendingConnection?.target}
        allNodes={storeNodes}
      />

      <CompositeNodeCreator
        isOpen={isCompositeCreatorOpen}
        onClose={closeCompositeCreator}
        selectedNodeIds={selectedForComposite}
        allNodes={storeNodes}
      />

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t('deleteNodeTitle')}
        message={t('deleteNodeMessage')}
        confirmText={t('delete')}
        cancelText={t('cancel')}
        onConfirm={handleConfirmDeleteNode}
        onCancel={handleCancelDeleteNode}
      />
    </div>
  );
};

const CanvasPageWithProvider: React.FC = () => {
  return (
    <ReactFlowProvider>
      <CanvasPageInner />
    </ReactFlowProvider>
  );
};

export default CanvasPageWithProvider;
