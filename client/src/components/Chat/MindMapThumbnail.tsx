import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { MapPin, GripVertical, Minimize2, Maximize2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { NodeData, RelationData } from '../../stores/appStore';
import { useAppStore } from '../../stores/appStore';
import { useAPIConfigStore } from '../../stores/apiConfigStore';
import { nodeApi } from '../../services/api';

/**
 * 缩略图节点接口
 */
interface ThumbnailNode {
  id: string;
  title: string;
  /** 节点摘要文本，用于 hover title 提示 */
  summary: string;
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
 * 截断文本到指定长度，超出部分以省略号代替
 * 用于"回到上一级"按钮中父节点标题的展示
 * @param text - 原始文本
 * @param maxLen - 允许保留的最大字符数（不含省略号）
 * @returns 截断后的文本；若未超出则返回原文
 */
function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
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
  const { t, i18n } = useTranslation('chat');
  const [position, setPosition] = useState(loadPosition);
  // 移动端（窗口宽度 < 768px）与桌面端均默认展开导航树（false）
  // 确保移动端不会被默认折叠；如需折叠由用户主动点击折叠按钮触发
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
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
        title: node.title || t('unnamed'),
        summary: node.summary || '',
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
  }, [nodes, relations, t]);

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
   * 计算当前激活节点到根节点的路径节点 ID 集合
   * 通过 parentId 链向上追溯，集合中不包含当前激活节点本身
   * 用于在导航树中对路径上的祖先节点应用次级高亮样式
   * @returns 路径节点 ID 集合（不含当前节点）
   */
  const pathNodeIds = useMemo<Set<string>>(() => {
    const path = new Set<string>();
    if (!activeNodeId) return path;
    const startNode = treeData.get(activeNodeId);
    if (!startNode) return path;

    let parentId: string | null = startNode.parentId;
    let guard = 0; // 循环引用保护，防止异常数据导致死循环
    while (parentId && guard < 1000) {
      if (path.has(parentId)) break; // 检测到环，提前退出
      path.add(parentId);
      const parent = treeData.get(parentId);
      if (!parent) break;
      parentId = parent.parentId;
      guard++;
    }
    return path;
  }, [activeNodeId, treeData]);

  // 记录上一次的激活节点 ID，用于在渲染阶段判断 activeNodeId 是否"实际变化"
  const [prevActiveNodeId, setPrevActiveNodeId] = useState<string | null>(activeNodeId);

  // 渲染阶段调整状态：当 activeNodeId 实际变化时，若导航树处于折叠状态则自动展开
  // 采用 React 推荐的"在渲染期间调整状态"模式，避免在 effect 中调用 setState 造成级联渲染
  // 同时保证用户手动折叠后（activeNodeId 未变化）不会被意外展开
  if (activeNodeId !== prevActiveNodeId) {
    setPrevActiveNodeId(activeNodeId);
    if (isCollapsed) {
      setIsCollapsed(false);
    }
  }

  // 用于跳过首次挂载及 activeNodeId 未变化时的滚动
  const prevScrollNodeIdRef = useRef<string | null>(activeNodeId);

  /**
   * 当 activeNodeId 实际变化时，自动将当前激活节点滚动到可视区域
   * 通过 data-attribute 查询节点元素，block: 'nearest' 仅在节点不可见时以最小滚动量滚动
   * 注：此处仅为只读 DOM 操作，不调用 setState，因此放在 effect 中执行
   */
  useEffect(() => {
    if (prevScrollNodeIdRef.current === activeNodeId) return;
    prevScrollNodeIdRef.current = activeNodeId;
    if (!activeNodeId) return;
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-node-id="${activeNodeId}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeNodeId]);

  /**
   * 处理节点点击
   */
  const handleClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeClick(nodeId);
  }, [onNodeClick]);

  /**
   * 处理"回到上一级"按钮点击
   * 在切换到父节点前，检查当前节点是否已生成摘要：
   * - 已有摘要或无对话：直接切换到父节点
   * - 无摘要且有对话：弹出确认框询问是否在离开前生成摘要
   *   - 用户确认：异步调用 generateSummary（不阻塞导航），并切换到父节点
   *   - 用户取消：直接切换到父节点
   * 摘要生成失败时静默处理（仅记录日志），不阻塞导航操作
   * @param parentNodeId - 父节点ID
   * @param e - 鼠标事件对象
   */
  const handleBackToParent = useCallback((parentNodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // 获取当前激活节点的数据
    const currentNode = activeNodeId ? nodes.get(activeNodeId) : undefined;
    const currentNodeId = activeNodeId;

    // 检查是否需要提示生成摘要：节点存在、无摘要、有对话
    const shouldPromptSummary = !!currentNode
      && !currentNode.summary
      && !!currentNode.conversationId;

    if (shouldPromptSummary && currentNodeId) {
      const nodeTitle = currentNode!.title || t('unnamed');
      const confirmed = window.confirm(t('summaryPromptOnBackMessage', { title: nodeTitle }));

      if (confirmed) {
        // 异步生成摘要，不阻塞导航操作
        // 使用 .then()/.catch() 处理结果，避免阻塞切换到父节点
        const activeConfig = useAPIConfigStore.getState().getActiveConfig();
        const configPayload: { model?: string; provider?: string; apiKey?: string; baseUrl?: string } = {};
        if (activeConfig?.modelId) configPayload.model = activeConfig.modelId;
        if (activeConfig?.provider) configPayload.provider = activeConfig.provider;
        if (activeConfig?.apiKey) configPayload.apiKey = activeConfig.apiKey;
        if (activeConfig?.baseUrl) configPayload.baseUrl = activeConfig.baseUrl;
        const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'zh';

        nodeApi.generateSummary(
          currentNodeId,
          Object.keys(configPayload).length > 0 ? configPayload : undefined,
          currentLanguage
        )
          .then((result) => {
            // 摘要生成成功后更新节点状态（此时用户可能已切换到父节点，通过 nodeId 定位更新）
            if (result.success && result.data?.summary) {
              useAppStore.getState().updateNode(currentNodeId, { summary: result.data.summary });
            }
          })
          .catch((error: unknown) => {
            // 摘要生成失败时静默处理，仅记录日志，不阻塞导航
            console.error('[MindMapThumbnail] 离开时生成摘要失败:', error);
          });
      }
    }

    // 无论是否生成摘要，都切换到父节点
    onNodeClick(parentNodeId);
  }, [activeNodeId, nodes, onNodeClick, t, i18n]);

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

  // 当前激活节点与其父节点（用于"回到上一级"按钮显示）
  const activeNode = activeNodeId ? treeData.get(activeNodeId) : undefined;
  const parentNode =
    activeNode && activeNode.parentId ? treeData.get(activeNode.parentId) : undefined;

  return (
    <div
      ref={containerRef}
      className={`fixed border border-dark-600 rounded-lg bg-dark-800 shadow-2xl select-none ${
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
        <span className="text-[10px] font-medium text-dark-300">{t('mindMap')}</span>
        <span className="text-[10px] text-dark-500 ml-auto mr-1">{t('thumbnailNodeCount', { count: renderList.length })}</span>
        {parentNode && (
          <button
            data-no-drag
            onClick={(e) => handleBackToParent(parentNode.id, e)}
            className="flex items-center gap-0.5 min-w-0 px-1 py-0.5 text-[10px] text-dark-300 hover:text-primary-300 hover:bg-dark-700 rounded transition-colors flex-shrink"
            title={t('backToParent', { title: parentNode.title })}
          >
            <ArrowLeft className="w-2.5 h-2.5 flex-shrink-0" />
            <span className="truncate">
              {t('backToParent', { title: truncateText(parentNode.title, 8) })}
            </span>
          </button>
        )}
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
            // 路径上的祖先节点（非当前节点）使用次级高亮，与当前节点的活跃高亮区分
            const isOnPath = !isActive && pathNodeIds.has(node.id);
            const indentPx = node.depth * 14;
            // hover title：节点有摘要时拼接标题与摘要文本，便于在不展开节点的情况下预览摘要内容
            const hoverTitle = node.summary
              ? `${node.title}\n${t('nodeSummaryLabel')}: ${node.summary}`
              : node.title;

            return (
              <div
                key={node.id}
                data-no-drag
                data-node-id={node.id}
                onClick={(e) => handleClick(node.id, e)}
                className={`flex items-center gap-1 px-1.5 py-1 rounded cursor-pointer transition-colors text-[11px] leading-tight border ${
                  isActive
                    ? 'bg-primary-600/30 text-primary-200 border-primary-500/50'
                    : isOnPath
                      ? 'bg-primary-600/10 text-primary-200 border-primary-500/20'
                      : 'text-dark-300 hover:bg-dark-700 hover:text-white border-transparent'
                }`}
                style={{ paddingLeft: `${4 + indentPx}px` }}
                title={hoverTitle}
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

export default React.memo(MindMapThumbnail);
