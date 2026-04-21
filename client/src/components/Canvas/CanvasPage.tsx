import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  ReactFlow, 
  Controls, 
  MiniMap, 
  MarkerType, 
  useNodesState, 
  useEdgesState,
  BaseEdge,
  getSmoothStepPath,
  Handle,
  Position,
  ConnectionLineType
} from '@xyflow/react';
import type { Connection, Node, Edge, NodeProps, EdgeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, MessageSquare, Edit3, Link2, Layers, Trash2, Undo2, Redo2, GitBranch, LayoutGrid, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import { useAppStore, RELATION_TYPE_LABELS } from '../../stores/appStore';
import NodeEditor from '../Node/NodeEditor';
import RelationEditor from '../Node/RelationEditor';
import CompositeNodeCreator from '../Node/CompositeNodeCreator';
import useIsMobile from '../../hooks/useIsMobile';
import { useLongPress } from '../../hooks/useLongPress';

/**
 * 关系类型颜色映射
 */
const RELATION_COLORS: Record<string, string> = {
  'parent-child': '#22c55e',
  'supports': '#22c55e',
  'contradicts': '#ef4444',
  'prerequisite': '#f59e0b',
  'elaborates': '#3b82f6',
  'references': '#a855f7',
  'conclusion': '#06b6d4',
  'custom': '#eab308'
};

interface CustomNodeData extends Record<string, unknown> {
  label: string; 
  summary?: string;
  isRoot?: boolean;
  isComposite?: boolean;
  isExpanded?: boolean;
  childCount?: number;
  conversationId?: string | null;
  messageCount?: number;
  onExpand?: () => void;
  onLongPress?: (nodeId: string) => void;
}

type CustomNodeType = Node<CustomNodeData>;

/**
 * 自定义边组件 - 显示关系标签
 * 使用 smoothstep 路径类型
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
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 16,
  });

  const edgeColor = (style as React.CSSProperties).stroke as string || '#22c55e';
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
 * 连接点样式配置
 */
const handleStyle = {
  width: 12,
  height: 12,
  background: '#1e293b',
  border: '2px solid #22c55e',
  borderRadius: '50%',
  transition: 'all 0.2s ease',
};

/**
 * 自定义节点组件 - 包含连接点
 */
const CustomNodeComponent: React.FC<NodeProps<CustomNodeType>> = ({ id, data, selected }) => {
  const nodeData = data as CustomNodeData;
  
  const longPressHandlers = useLongPress({
    threshold: 500,
    onLongPress: () => {
      nodeData.onLongPress?.(id);
    },
  });
  
  return (
    <div
      className={`px-4 py-3 rounded-xl shadow-lg border-2 min-w-[160px] max-w-[280px] cursor-pointer transition-all ${
        selected
          ? 'bg-primary-600 border-primary-400 shadow-primary-500/20'
          : nodeData.isComposite && nodeData.isExpanded
            ? 'bg-primary-700/80 border-primary-400 shadow-primary-500/30'
            : nodeData.isRoot 
              ? 'bg-dark-700 border-primary-500/50 hover:border-primary-400'
              : 'bg-dark-700 border-dark-600 hover:border-primary-500'
      }`}
      {...longPressHandlers}
    >
      {/* 顶部连接点 - 用于接收父节点连接 */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        style={handleStyle}
      />
      
      {/* 左侧连接点 - 用于接收其他关系连接 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ ...handleStyle, borderColor: '#3b82f6' }}
      />
      
      {/* 右侧连接点 - 用于发出其他关系连接 */}
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        style={{ ...handleStyle, borderColor: '#3b82f6' }}
      />
      
      {/* 底部连接点 - 用于发出子节点连接 */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        style={handleStyle}
      />
      
      <div className="flex items-center gap-2 mb-1">
        {nodeData.isComposite ? (
          <Layers className={`w-4 h-4 ${nodeData.isExpanded ? 'text-primary-300' : 'text-primary-400'}`} />
        ) : nodeData.isRoot ? (
          <GitBranch className="w-4 h-4 text-primary-400" />
        ) : (
          <MessageSquare className="w-4 h-4 text-primary-400" />
        )}
        <span className="text-white font-medium truncate flex-1">{nodeData.label}</span>
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
            {nodeData.isExpanded ? '已展开' : `包含 ${nodeData.childCount} 个节点`}
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
            title={nodeData.isExpanded ? '折叠节点' : '展开节点'}
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
        <p className="text-xs text-primary-400/70 mt-1">根节点</p>
      )}
    </div>
  );
};

/**
 * 思维画布组件
 */
const CanvasPage: React.FC = () => {
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
    history,
    historyIndex,
    expandCompositeNode,
    autoLayout,
    conversations,
    reloadWorkspaceData,
    requestOpenChat
  } = useAppStore();
  
  const nodesArray = useMemo(() => Array.from(storeNodes.values()), [storeNodes]);
  
  const [isNodeEditorOpen, setIsNodeEditorOpen] = useState(false);
  const [isRelationEditorOpen, setIsRelationEditorOpen] = useState(false);
  const [isCompositeCreatorOpen, setIsCompositeCreatorOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [selectedForComposite, setSelectedForComposite] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<{ source: string; target: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const isMobile = useIsMobile();

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
            label: node.title || '未命名节点',
            summary: node.summary,
            isRoot: node.isRoot,
            isComposite: node.isComposite,
            isExpanded: node.expanded,
            childCount: node.compositeChildren?.length || 0,
            conversationId: node.conversationId,
            messageCount: conversation?.messages.length || 0,
            onExpand: node.isComposite ? () => expandCompositeNode(node.id) : undefined,
            onLongPress: (nodeId: string) => {
              selectNode(nodeId);
              requestOpenChat(nodeId);
            }
          }
        };
      });
    console.log('[CanvasPage] flowNodes:', result.length, 'nodes');
    return result;
  }, [nodesArray, conversations, expandCompositeNode, selectNode, requestOpenChat]);

  /**
   * 转换关系为边
   */
  const flowEdges: Edge[] = useMemo(() => {
    const edges: Edge[] = [];
    
    if (!relations || !Array.isArray(relations)) {
      console.log('[CanvasPage] No relations array');
      return edges;
    }
    
    console.log('[CanvasPage] Processing relations:', relations.length);
    
    const visibleNodeIds = new Set(nodesArray.filter(n => !n.hidden).map(n => n.id));
    console.log('[CanvasPage] Visible node IDs:', Array.from(visibleNodeIds));
    
    relations.forEach((relation) => {
      if (!relation || typeof relation !== 'object') {
        console.log('[CanvasPage] Invalid relation object');
        return;
      }
      
      if (!relation.type || !relation.id || !relation.sourceId || !relation.targetId) {
        console.log('[CanvasPage] Missing relation fields:', relation);
        return;
      }
      
      const sourceVisible = visibleNodeIds.has(relation.sourceId);
      const targetVisible = visibleNodeIds.has(relation.targetId);
      
      console.log('[CanvasPage] Relation:', relation.id, 
        'source:', relation.sourceId, sourceVisible ? 'visible' : 'hidden',
        'target:', relation.targetId, targetVisible ? 'visible' : 'hidden');
      
      if (!sourceVisible || !targetVisible) {
        return;
      }
      
      const color = RELATION_COLORS[relation.type] || '#eab308';
      const isParentChild = relation.type === 'parent-child';
      
      const edge: Edge = {
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        type: 'smoothstep',
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
        edge.label = RELATION_TYPE_LABELS[relation.type]?.label || relation.type;
        edge.labelStyle = { fill: '#fff', fontSize: 10, fontWeight: 500 };
        edge.labelBgStyle = { fill: color, fillOpacity: 0.9 };
        edge.labelBgPadding = [4, 2] as [number, number];
        edge.labelBgBorderRadius = 4;
      }
      
      edges.push(edge);
      console.log('[CanvasPage] Created edge:', edge.id, 'from', edge.source, 'to', edge.target);
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
              type: 'smoothstep',
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
    
    console.log('[CanvasPage] Total edges created:', edges.length);
    return edges;
  }, [relations, nodesArray]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  /**
   * 同步store变化到ReactFlow
   */
  useEffect(() => {
    console.log('[CanvasPage] Syncing nodes:', flowNodes.length);
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  useEffect(() => {
    console.log('[CanvasPage] Syncing edges:', flowEdges.length);
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  /**
   * 连接节点 - 创建关系
   */
  const onConnect = useCallback(
    (params: Connection) => {
      console.log('[CanvasPage] onConnect:', params);
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
    const id = createRootNode('新对话');
    setEditingNodeId(id);
    setIsNodeEditorOpen(true);
  }, [createRootNode]);

  /**
   * 创建子节点
   */
  const handleCreateChildNode = useCallback(() => {
    if (!selectedNodeId) {
      return;
    }
    
    const id = createChildNode(selectedNodeId, '新分支');
    setEditingNodeId(id);
    setIsNodeEditorOpen(true);
  }, [selectedNodeId, createChildNode]);

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
   * 节点双击 - 编辑或展开
   */
  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const storeNode = storeNodes.get(node.id);
      if (storeNode?.isComposite) {
        expandCompositeNode(node.id);
      } else {
        setEditingNodeId(node.id);
        setIsNodeEditorOpen(true);
      }
    },
    [storeNodes, expandCompositeNode]
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
    if (selectedNodeId && confirm('确定要删除此节点及其所有子节点吗？')) {
      deleteNode(selectedNodeId);
    }
  }, [selectedNodeId, deleteNode]);

  /**
   * 同步数据 - 从服务端重新加载当前工作区数据
   */
  const handleSyncData = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await reloadWorkspaceData();
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, reloadWorkspaceData]);

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

  const nodeTypes = useMemo(() => ({ custom: CustomNodeComponent }), []);
  const edgeTypes = useMemo(() => ({ 
    smoothstep: RelationEdge,
    relation: RelationEdge 
  }), []);

  return (
    <div className="h-full relative">

      <div className={`absolute z-10 flex gap-1.5 flex-wrap glass rounded-2xl p-2 ${
        isMobile
          ? 'top-2 left-2 right-2 max-h-28 overflow-y-auto'
          : 'top-4 left-4'
      }`}>
        <button
          onClick={handleCreateRootNode}
          className={`btn-primary text-sm ${isMobile ? 'min-h-[44px]' : ''}`}
          title="创建根节点（新对话起点）"
        >
          <Plus className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
          {!isMobile && <span className="text-sm">创建对话</span>}
          {isMobile && <span className="text-xs">创建</span>}
        </button>

        <button
          onClick={handleSyncData}
          disabled={isSyncing}
          className={`btn-icon bg-primary-600/20 border-primary-500/30 ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''} ${isSyncing ? 'text-primary-400' : 'text-primary-300'}`}
          title="同步数据"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>

        {selectedNodeId && (
          <button
            onClick={handleCreateChildNode}
            className={`btn-ghost text-sm ${isMobile ? 'min-h-[44px]' : ''}`}
            title="创建分支节点"
          >
            <GitBranch className={isMobile ? 'w-5 h-5' : 'w-4 h-4'} />
            {!isMobile && <span className="text-sm">创建分支</span>}
            {isMobile && <span className="text-xs">分支</span>}
          </button>
        )}

        <div className="w-px bg-dark-600/50 h-8 self-center mx-0.5" />

        <button
          onClick={undo}
          disabled={!canUndo}
          className={`btn-icon ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''}`}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`btn-icon ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''}`}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="w-px bg-dark-600/50 h-8 self-center mx-0.5" />

        <button
          onClick={openNodeEditor}
          disabled={!selectedNodeId}
          className={`btn-icon ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''}`}
          title="编辑节点"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setIsRelationEditorOpen(true)}
          className={`btn-icon ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''}`}
          title="创建关系"
        >
          <Link2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleDeleteNode}
          disabled={!selectedNodeId}
          className={`btn-icon hover:!text-red-400 hover:!border-red-500/40 hover:!bg-red-900/20 ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''}`}
          title="删除节点"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="w-px bg-dark-600/50 h-8 self-center mx-0.5" />

        <button
          onClick={toggleSelectMode}
          className={`btn-icon ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''} ${isSelectMode ? '!bg-primary-600/20 !text-primary-400 !border-primary-500/40' : ''}`}
          title="多选模式（用于聚合节点）"
        >
          <Layers className="w-4 h-4" />
        </button>
        {isSelectMode && selectedForComposite.length >= 2 && (
          <button
            onClick={handleCreateComposite}
            className={`btn-primary text-sm ${isMobile ? 'min-h-[44px]' : ''}`}
          >
            <Layers className="w-4 h-4" />
            <span className="text-xs">聚合({selectedForComposite.length})</span>
          </button>
        )}

        <button
          onClick={autoLayout}
          className={`btn-icon ${isMobile ? 'min-w-[44px] min-h-[44px]' : ''}`}
          title="自动布局"
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false
        }}
        connectionLineType={ConnectionLineType.SmoothStep}
        panOnDrag={true}
        zoomOnPinch={true}
        panOnScroll={false}
        preventScrolling={!isMobile}
      >
        <Controls className="bg-dark-800 border-dark-700 rounded-xl overflow-hidden [&>button]:bg-dark-700 [&>button]:border-dark-600 [&>button]:text-white [&>button:hover]:bg-dark-600" />
        {!isMobile && (
          <MiniMap
            className="bg-dark-800 border-dark-700 rounded-xl overflow-hidden"
            nodeColor={(node) => {
              const data = node.data as CustomNodeData;
              if (data?.isRoot) return '#0ea5e9';
              if (data?.isComposite) return '#8b5cf6';
              return '#475569';
            }}
            maskColor="rgba(0, 0, 0, 0.8)"
          />
        )}
      </ReactFlow>
      
      {/* 空状态提示 */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center animate-blur-in">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-2xl shadow-primary-600/20"
                 style={{ animation: 'float 4s ease-in-out infinite' }}>
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3 tracking-tight">
              开始构建你的思维网络
            </h2>
            <p className="text-dark-400 mb-6 max-w-md text-sm leading-relaxed">
              创建对话节点，通过分支展开新的讨论方向，<br />
              构建属于你的非线性思维导图
            </p>
            <button
              onClick={handleCreateRootNode}
              className="pointer-events-auto btn-primary px-6 py-3 mx-auto"
            >
              <Plus className="w-5 h-5" />
              <span>创建第一个对话</span>
            </button>
          </div>
        </div>
      )}

      {/* 工具提示 */}
      {!isMobile && (
        <div className="absolute bottom-4 left-4 text-dark-500 text-xs glass-light px-3 py-2 rounded-lg">
          <span className="text-dark-400">点击「创建对话」添加根节点</span>
          <span className="mx-2">•</span>
          <span className="text-dark-400">选中节点后可创建分支</span>
          <span className="mx-2">•</span>
          <span className="text-dark-400">双击节点编辑</span>
          <span className="mx-2">•</span>
          <span className="text-primary-400">长按节点打开对话</span>
          {isSelectMode && <span className="ml-2 text-primary-400">• 多选模式已开启</span>}
        </div>
      )}

      {/* 关系统计 */}
      {relations.length > 0 && (
        <div className={`text-dark-500 text-xs bg-dark-800/80 px-3 py-2 rounded-lg backdrop-blur-sm ${
          isMobile ? 'absolute bottom-2 left-2 right-2 text-center' : 'absolute bottom-4 right-4'
        }`}>
          <span className="text-dark-400">节点: {nodes.length}</span>
          <span className="mx-2">•</span>
          <span className="text-dark-400">关系: {relations.length}</span>
          {!isMobile && (
            <>
              <span className="mx-2">•</span>
              <span className="text-dark-400">边: {edges.length}</span>
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
    </div>
  );
};

export default CanvasPage;
