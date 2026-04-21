import React, { useMemo, useCallback } from 'react';
import { MapPin } from 'lucide-react';
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

/**
 * 思维导图缩略图组件
 * 在对话面板中展示当前思维导图的整体结构
 * 支持点击节点快速切换对话、当前活跃节点高亮标识
 */
const MindMapThumbnail: React.FC<MindMapThumbnailProps> = ({
  nodes,
  relations,
  activeNodeId,
  onNodeClick,
}) => {
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

  if (renderList.length === 0) {
    return null;
  }

  const maxDepth = Math.max(...renderList.map((n) => n.depth), 0);
  const maxWidth = Math.min(280, 120 + maxDepth * 40);

  return (
    <div
      className="border border-dark-600 rounded-lg bg-dark-800/80 overflow-hidden"
      style={{ maxWidth: `${maxWidth}px` }}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-dark-700 bg-dark-800">
        <MapPin className="w-3 h-3 text-primary-400" />
        <span className="text-[10px] font-medium text-dark-300">思维导图</span>
        <span className="text-[10px] text-dark-500 ml-auto">{renderList.length} 节点</span>
      </div>
      <div className="p-1.5 overflow-y-auto overflow-x-hidden" style={{ maxHeight: '180px' }}>
        {renderList.map((node) => {
          const isActive = node.id === activeNodeId;
          const indentPx = node.depth * 14;

          return (
            <div
              key={node.id}
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
    </div>
  );
};

export default MindMapThumbnail;
