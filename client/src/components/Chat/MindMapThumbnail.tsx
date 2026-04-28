import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { MapPin, GripVertical, Minimize2, Maximize2 } from 'lucide-react';
import type { NodeData, RelationData } from '../../stores/appStore';

/**
 * 缩略图节点接口
 */
interface ThumbnailNode {
  id: string;
  title: string;
  isRoot: boolean;
  depth: number;
  childIds: string[];
  parentId: string | null;
}

/**
 * 缩略图组件属性接口
 */
interface MindMapThumbnailProps {
  nodes: Map<string, NodeData>;
  relations: RelationData[];
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
}

const STORAGE_KEY = 'deepmindmap-thumbnail-position';
const DEFAULT_POSITION = { x: 16, y: 16 };

/**
 * 从 localStorage 读取缩略图位置
 * @returns 位置坐标
 */
function loadPosition(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return parsed;
      }
    }
  } catch {
    // 静默处理
  }
  return DEFAULT_POSITION;
}

/**
 * 保存缩略图位置到 localStorage
 * @param pos - 位置坐标
 */
function savePosition(pos: { x: number; y: number }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // 静默处理
  }
}

/**
 * 思维导图缩略图组件
 * 在对话面板中展示当前思维导图的整体结构
 * 支持自由拖动、位置持久化、折叠/展开
 * 悬浮显示在界面最上层，不占据文档流空间
 */
const MindMapThumbnail: React.FC<MindMapThumbnailProps> = ({
  nodes,
  relations,
  activeNodeId,
  onNodeClick,
}) => {
  const [position, setPosition] = useState(loadPosition);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 构建树形结构数据
   * 从节点和关系中提取父子层级关系
   */
  const treeData = useMemo(() => {
    const nodeMap = new Map<string, ThumbnailNode>();
    const childParentMap = new Map<string, string>();

    relations.forEach((rel: RelationData) => {
      if (rel.type === 'parent-child') {
        childParentMap.set(rel.targetId, rel.sourceId);
      }
    });

    nodes.forEach((node: NodeData) => {
      if (node.hidden) return;
      const parentId = childParentMap.get(node.id) || null;
      nodeMap.set(node.id, {
        id: node.id,
        title: node.title || '未命名',
        isRoot: node.isRoot,
        depth: 0,
        childIds: [],
        parentId,
      });
    });

    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        if (!parent.childIds.includes(node.id)) {
          parent.childIds.push(node.id);
        }
      }
    });

    const calcDepth = (id: string, depth: number) => {
      const n = nodeMap.get(id);
      if (n) {
        n.depth = depth;
        n.childIds.forEach((cid) => calcDepth(cid, depth + 1));
      }
    };

    nodeMap.forEach((node) => {
      if (node.isRoot || !node.parentId) {
        calcDepth(node.id, 0);
      }
    });

    return nodeMap;
  }, [nodes, relations]);

  /**
   * 生成扁平化的渲染列表（按深度优先遍历排序）
   */
  const renderList = useMemo(() => {
    const list: ThumbnailNode[] = [];
    const visited = new Set<string>();

    const dfs = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      const node = treeData.get(nodeId);
      if (!node) return;
      list.push(node);
      node.childIds.forEach((cid) => dfs(cid));
    };

    const rootNodes = Array.from(treeData.values())
      .filter((n) => n.isRoot || !n.parentId)
      .sort((a, b) => a.title.localeCompare(b.title));

    rootNodes.forEach((root) => dfs(root.id));

    treeData.forEach((node) => {
      if (!visited.has(node.id)) {
        list.push(node);
      }
    });

    return list;
  }, [treeData]);

  /**
   * 处理节点点击
   */
  const handleClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick(nodeId);
  }, [onNodeClick]);

  /**
   * 处理拖动开始（鼠标）
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    e.preventDefault();
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  }, [position]);

  /**
   * 处理拖动开始（触摸）
   */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragOffsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    };
  }, [position]);

  /**
   * 拖动移动和结束事件
   * 使用 useEffect 监听全局事件，确保拖动时鼠标移出组件也能继续
   */
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = Math.max(0, e.clientX - dragOffsetRef.current.x);
      const newY = Math.max(0, e.clientY - dragOffsetRef.current.y);
      setPosition({ x: newX, y: newY });
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      const newX = Math.max(0, touch.clientX - dragOffsetRef.current.x);
      const newY = Math.max(0, touch.clientY - dragOffsetRef.current.y);
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
      setPosition(prev => {
        savePosition(prev);
        return prev;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  if (renderList.length === 0) {
    return null;
  }

  const maxDepth = Math.max(...renderList.map((n) => n.depth), 0);
  const maxWidth = Math.min(280, 120 + maxDepth * 40);

  return (
    <div
      ref={containerRef}
      className={`fixed border border-dark-600 rounded-lg bg-dark-800/95 backdrop-blur-sm shadow-2xl select-none ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        maxWidth: `${maxWidth}px`,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        boxShadow: isDragging
          ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.3)'
          : '0 4px 16px rgba(0,0,0,0.3)',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* 标题栏 - 可拖动区域 */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-dark-700 bg-dark-800 rounded-t-lg">
        <GripVertical className="w-3 h-3 text-dark-500" />
        <MapPin className="w-3 h-3 text-primary-400" />
        <span className="text-[10px] font-medium text-dark-300">思维导图</span>
        <span className="text-[10px] text-dark-500 ml-auto mr-1">{renderList.length} 节点</span>
        <button
          data-no-drag
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-0.5 text-dark-500 hover:text-white transition-colors rounded"
          title={isCollapsed ? '展开' : '折叠'}
        >
          {isCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
        </button>
      </div>

      {/* 节点列表 - 可折叠 */}
      {!isCollapsed && (
        <div className="p-1.5 overflow-y-auto overflow-x-hidden" style={{ maxHeight: '180px' }}>
          {renderList.map((node) => {
            const isActive = node.id === activeNodeId;
            const indentPx = node.depth * 14;

            return (
              <div
                key={node.id}
                data-no-drag
                onClick={(e) => handleClick(node.id, e)}
                className={`flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer transition-colors text-[11px] leading-tight ${
                  isActive
                    ? 'bg-primary-600/30 text-primary-200 border border-primary-500/50'
                    : 'text-dark-300 hover:bg-dark-700 hover:text-white border border-transparent'
                }`}
                style={{ paddingLeft: `${4 + indentPx}px` }}
                title={node.title}
              >
                {node.isRoot ? (
                  <span className="w-2 h-2 rounded-sm bg-primary-500 flex-shrink-0" />
                ) : node.childIds.length > 0 ? (
                  <span className="w-2 h-2 rounded-sm bg-dark-500 flex-shrink-0" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-dark-600 flex-shrink-0" />
                )}
                <span className="truncate">{node.title}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MindMapThumbnail;
