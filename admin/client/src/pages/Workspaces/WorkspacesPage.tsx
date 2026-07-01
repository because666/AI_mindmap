import React, { useState, useEffect, useCallback } from 'react';
import { workspacesApi } from '../../services/api';
import type { WorkspaceListItem, PaginationResult, RankingSortBy, WorkspaceRankingItem } from '../../types';
import { Search, Eye, XCircle, Bell, Star, Trophy, Pin, PinOff, Ban, Unlock, X } from 'lucide-react';

/**
 * 操作反馈提示接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 工作区详情数据接口
 * 用于详情弹窗展示完整的工作区信息
 * 对应后端 GET /api/admin/workspaces/:id 的返回结构
 */
interface WorkspaceDetail {
  /** 工作区 ID */
  id: string;
  /** 工作区名称 */
  name: string;
  /** 工作区描述 */
  description?: string;
  /** 工作区类型，public 为公开，其他为私有 */
  type: string;
  /** 创建时间（ISO 字符串） */
  createdAt: string;
  /** 更新时间（ISO 字符串） */
  updatedAt: string;
  /** 所有者 ID */
  ownerId: string;
  /** 工作区统计数据 */
  stats: {
    /** 成员数量 */
    memberCount: number;
    /** 节点数量 */
    nodeCount: number;
  };
}

/**
 * 标签页类型定义
 * list: 工作区列表视图
 * ranking: 排行榜视图
 */
type TabKey = 'list' | 'ranking';

/**
 * 排序维度标签配置
 * 定义每个排序维度的键名和显示文本
 */
const SORT_TABS: ReadonlyArray<{ key: RankingSortBy; label: string }> = [
  { key: 'nodeCount', label: '节点数' },
  { key: 'conversationCount', label: '对话量' },
  { key: 'exportCount', label: '导出量' },
];

const WorkspacesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [data, setData] = useState<PaginationResult<WorkspaceListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [rankingData, setRankingData] = useState<WorkspaceRankingItem[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingSortBy, setRankingSortBy] = useState<RankingSortBy>('nodeCount');
  const [starTogglingIds, setStarTogglingIds] = useState<Set<string>>(new Set());
  // 置顶/取消置顶操作中的工作区 ID 集合，用于按钮禁用与加载态展示
  const [pinTogglingIds, setPinTogglingIds] = useState<Set<string>>(new Set());
  // 封禁/解封操作中的工作区 ID 集合，用于按钮禁用与加载态展示
  const [banTogglingIds, setBanTogglingIds] = useState<Set<string>>(new Set());
  // 封禁弹窗状态
  const [banModal, setBanModal] = useState<{ id: string; name: string } | null>(null);
  // 封禁原因输入
  const [banReason, setBanReason] = useState('');
  // 封禁时长（小时），0 表示永久
  const [banDuration, setBanDuration] = useState(0);
  // 工作区详情弹窗状态：id 非空时展示弹窗，loading 表示加载中，data 为详情数据
  const [detailModal, setDetailModal] = useState<{ id: string; loading: boolean; data: WorkspaceDetail | null }>({ id: '', loading: false, data: null });

  /**
   * 显示操作反馈提示
   * @param type - 提示类型
   * @param text - 提示文本
   */
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 加载工作区列表数据
   */
  const loadWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workspacesApi.getList({ page, limit: 20, search: search || undefined });
      setData(res.data.data as PaginationResult<WorkspaceListItem>);
    } catch (error) {
      console.error('加载工作区失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  /**
   * 加载工作区排行榜数据
   * 根据当前排序维度请求排行数据
   */
  const loadRanking = useCallback(async () => {
    setRankingLoading(true);
    try {
      const res = await workspacesApi.getRanking({ sortBy: rankingSortBy, limit: 20 });
      setRankingData((res.data.data as WorkspaceRankingItem[]) || []);
    } catch (error) {
      console.error('加载排行榜失败:', error);
      setRankingData([]);
    } finally {
      setRankingLoading(false);
    }
  }, [rankingSortBy]);

  useEffect(() => { loadWorkspaces(); }, [loadWorkspaces]);
  useEffect(() => { if (activeTab === 'ranking') { loadRanking(); } }, [activeTab, loadRanking]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadWorkspaces();
  };

  /**
   * 关闭工作区操作
   * @param id - 工作区 ID
   */
  const handleClose = async (id: string) => {
    const reason = prompt('请输入关闭原因：');
    if (!reason) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await workspacesApi.close(id, reason);
      showToast('success', '工作区已关闭');
      loadWorkspaces();
    } catch (error) {
      console.error('关闭工作区失败:', error);
      showToast('error', '关闭工作区失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 切换工作区特别关注状态
   * @param workspaceId - 工作区 ID
   * @param currentStarred - 当前特别关注状态
   */
  const handleToggleStar = async (workspaceId: string, currentStarred: boolean) => {
    if (starTogglingIds.has(workspaceId)) return;
    setStarTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(workspaceId);
      return next;
    });
    try {
      await workspacesApi.toggleStar(workspaceId, !currentStarred);
      showToast('success', !currentStarred ? '已标记为特别关注' : '已取消特别关注');
      setRankingData((prev) =>
        prev.map((item) =>
          item.workspaceId === workspaceId ? { ...item, starred: !currentStarred } : item
        )
      );
    } catch (error) {
      console.error('切换特别关注失败:', error);
      showToast('error', '切换特别关注失败，请重试');
    } finally {
      setStarTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
    }
  };

  /**
   * 切换工作区置顶状态
   * 调用 pin/unpin 接口，并就地更新列表中的 isPinned/pinnedAt 字段
   * @param workspace - 当前工作区列表项
   */
  const handleTogglePin = async (workspace: WorkspaceListItem) => {
    const workspaceId = workspace.id;
    if (pinTogglingIds.has(workspaceId)) return;
    const currentPinned = workspace.isPinned === true;
    setPinTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(workspaceId);
      return next;
    });
    try {
      if (currentPinned) {
        await workspacesApi.unpinWorkspace(workspaceId);
        showToast('success', '已取消置顶');
      } else {
        await workspacesApi.pinWorkspace(workspaceId);
        showToast('success', '已置顶工作区');
      }
      // 就地更新当前页数据，避免重新请求造成跳页
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === workspaceId
              ? {
                  ...item,
                  isPinned: !currentPinned,
                  pinnedAt: !currentPinned ? new Date().toISOString() : undefined,
                }
              : item
          ),
        };
      });
    } catch (error) {
      console.error('切换置顶状态失败:', error);
      showToast('error', '切换置顶状态失败，请重试');
    } finally {
      setPinTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
    }
  };

  /**
   * 确认封禁工作区
   * 调用 banWorkspace 接口，成功后就地更新列表中的 isBanned 字段
   */
  const handleBan = async () => {
    if (!banModal) return;
    if (actionLoading) return;
    if (!banReason.trim()) {
      showToast('error', '请填写封禁原因');
      return;
    }
    setActionLoading(true);
    try {
      await workspacesApi.banWorkspace(banModal.id, banReason, banDuration);
      // 就地更新列表中的封禁状态
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === banModal.id
              ? {
                  ...item,
                  isBanned: true,
                  banReason: banReason,
                  banExpiresAt: banDuration > 0
                    ? new Date(Date.now() + banDuration * 60 * 60 * 1000).toISOString()
                    : undefined,
                }
              : item
          ),
        };
      });
      setBanModal(null);
      setBanReason('');
      setBanDuration(0);
      showToast('success', `工作区 ${banModal.name} 已封禁`);
    } catch (error) {
      console.error('封禁工作区失败:', error);
      showToast('error', '封禁工作区失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 解封工作区
   * @param workspace - 当前工作区列表项
   */
  const handleUnban = async (workspace: WorkspaceListItem) => {
    const workspaceId = workspace.id;
    if (banTogglingIds.has(workspaceId)) return;
    setBanTogglingIds((prev) => {
      const next = new Set(prev);
      next.add(workspaceId);
      return next;
    });
    try {
      await workspacesApi.unbanWorkspace(workspaceId);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.id === workspaceId
              ? {
                  ...item,
                  isBanned: false,
                  banReason: undefined,
                  banExpiresAt: undefined,
                }
              : item
          ),
        };
      });
      showToast('success', '工作区已解封');
    } catch (error) {
      console.error('解封工作区失败:', error);
      showToast('error', '解封工作区失败，请重试');
    } finally {
      setBanTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(workspaceId);
        return next;
      });
    }
  };

  /**
   * 打开工作区详情弹窗
   * 调用后端详情接口获取完整工作区数据并展示在弹窗中
   * @param workspace - 当前工作区列表项
   */
  const handleView = async (workspace: WorkspaceListItem) => {
    setDetailModal({ id: workspace.id, loading: true, data: null });
    try {
      const res = await workspacesApi.getDetail(workspace.id);
      setDetailModal({ id: workspace.id, loading: false, data: res.data.data as WorkspaceDetail });
    } catch (error) {
      console.error('加载工作区详情失败:', error);
      showToast('error', '加载工作区详情失败');
      setDetailModal({ id: '', loading: false, data: null });
    }
  };

  /**
   * 获取排名对应的样式类名
   * 前三名使用金银铜色高亮
   * @param rank - 排名序号（从 1 开始）
   * @returns 样式类名字符串
   */
  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'bg-yellow-400 text-yellow-900';
    if (rank === 2) return 'bg-gray-300 text-gray-700';
    if (rank === 3) return 'bg-amber-600 text-white';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800 mb-6">工作区管理</h1>

      {/* 标签页切换 */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          工作区列表
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === 'ranking' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Trophy className="w-4 h-4" />
          排行榜
        </button>
      </div>

      {activeTab === 'list' ? (
        /* 工作区列表视图 */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="搜索工作区" value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">搜索</button>
            </form>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">加载中...</div>
          ) : !data?.items.length ? (
            <div className="p-8 text-center text-gray-400">暂无工作区</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">名称</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">创建者</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">类型</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">成员</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">节点</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((ws) => {
                      const isPinned = ws.isPinned === true;
                      const pinLoading = pinTogglingIds.has(ws.id);
                      const isBanned = ws.isBanned === true;
                      const banLoading = banTogglingIds.has(ws.id);
                      return (
                        <tr key={ws._id} className={`border-b border-gray-50 hover:bg-gray-50 ${isPinned ? 'bg-blue-50/40' : ''}`}>
                          <td className="py-3 px-4 text-sm font-medium">
                            <div className="flex items-center gap-1.5">
                              {isPinned && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                                  <Pin className="w-3 h-3" />
                                  置顶
                                </span>
                              )}
                              {isBanned && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                                  <Ban className="w-3 h-3" />
                                  封禁
                                </span>
                              )}
                              <span>{ws.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">{ws.creator.nickname}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              ws.type === 'public' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                            }`}>{ws.type === 'public' ? '公开' : '私有'}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">{ws.stats.memberCount}</td>
                          <td className="py-3 px-4 text-sm text-gray-500">{ws.stats.nodeCount}</td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button onClick={() => handleView(ws)} className="p-1 text-gray-400 hover:text-blue-600" title="查看"><Eye className="w-4 h-4" /></button>
                              <button
                                onClick={() => handleTogglePin(ws)}
                                disabled={pinLoading}
                                className={`p-1 transition-colors ${
                                  isPinned
                                    ? 'text-blue-600 hover:text-blue-700'
                                    : 'text-gray-400 hover:text-blue-600'
                                } ${pinLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                title={isPinned ? '取消置顶' : '置顶为推荐工作区'}
                              >
                                {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                              </button>
                              <button onClick={() => handleClose(ws.id)} className="p-1 text-gray-400 hover:text-red-600" title="关闭"><XCircle className="w-4 h-4" /></button>
                              {isBanned ? (
                                <button
                                  onClick={() => handleUnban(ws)}
                                  disabled={banLoading}
                                  className={`p-1 text-gray-400 hover:text-green-600 ${banLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  title="解封"
                                >
                                  <Unlock className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setBanModal({ id: ws.id, name: ws.name })}
                                  className="p-1 text-gray-400 hover:text-red-600"
                                  title="封禁"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-50">
                {data.items.map((ws) => {
                  const isPinned = ws.isPinned === true;
                  const pinLoading = pinTogglingIds.has(ws.id);
                  const isBanned = ws.isBanned === true;
                  const banLoading = banTogglingIds.has(ws.id);
                  return (
                    <div key={ws._id} className={`p-4 ${isPinned ? 'bg-blue-50/40' : ''}`}>
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isPinned && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 flex-shrink-0">
                              <Pin className="w-3 h-3" />
                              置顶
                            </span>
                          )}
                          {isBanned && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 flex-shrink-0">
                              <Ban className="w-3 h-3" />
                              封禁
                            </span>
                          )}
                          <span className="font-medium text-gray-800 truncate">{ws.name}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          ws.type === 'public' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                        }`}>{ws.type === 'public' ? '公开' : '私有'}</span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center justify-between">
                        <span>
                          创建者：{ws.creator.nickname} · 成员：{ws.stats.memberCount} · 节点：{ws.stats.nodeCount}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleView(ws)}
                            className="p-1 text-gray-300 hover:text-blue-600"
                            title="查看"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleTogglePin(ws)}
                            disabled={pinLoading}
                            className={`p-1 transition-colors ${
                              isPinned ? 'text-blue-600' : 'text-gray-300'
                            } ${pinLoading ? 'opacity-50' : ''}`}
                            title={isPinned ? '取消置顶' : '置顶为推荐工作区'}
                          >
                            {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                          </button>
                          {isBanned ? (
                            <button
                              onClick={() => handleUnban(ws)}
                              disabled={banLoading}
                              className={`p-1 text-gray-400 hover:text-green-600 ${banLoading ? 'opacity-50' : ''}`}
                              title="解封"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setBanModal({ id: ws.id, name: ws.name })}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="封禁"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {data.totalPages > 1 && (
                <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                  <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">上一页</button>
                  <span className="px-3 py-1 text-sm text-gray-500">{page}/{data.totalPages}</span>
                  <button onClick={() => setPage(Math.min(data.totalPages, page + 1))} disabled={page === data.totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50">下一页</button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* 排行榜视图 */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* 排序维度切换 */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex gap-1 bg-gray-50 rounded-lg p-1 w-fit">
              {SORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setRankingSortBy(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    rankingSortBy === tab.key ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {rankingLoading ? (
            <div className="p-8 text-center text-gray-400">加载中...</div>
          ) : rankingData.length === 0 ? (
            <div className="p-8 text-center text-gray-400">暂无排行数据</div>
          ) : (
            <>
              {/* 桌面端排行表格 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-16">排名</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">名称</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">节点数</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">对话量</th>
                      <th className="text-right py-3 px-4 text-xs font-medium text-gray-500">导出量</th>
                      <th className="text-center py-3 px-4 text-xs font-medium text-gray-500 w-28">特别关注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingData.map((item, index) => {
                      const rank = index + 1;
                      return (
                        <tr
                          key={item.workspaceId}
                          className={`border-b border-gray-50 hover:bg-gray-50 ${
                            item.starred ? 'bg-yellow-50/50' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${getRankBadgeClass(rank)}`}>
                              {rank}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {item.starred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                              <span className="text-sm font-medium">{item.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">{item.nodeCount}</td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">{item.conversationCount}</td>
                          <td className="py-3 px-4 text-right text-sm text-gray-600">{item.exportCount}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleToggleStar(item.workspaceId, item.starred)}
                              disabled={starTogglingIds.has(item.workspaceId)}
                              className={`p-1.5 rounded-full transition-colors ${
                                item.starred
                                  ? 'text-yellow-500 hover:text-yellow-600'
                                  : 'text-gray-300 hover:text-yellow-400'
                              } ${starTogglingIds.has(item.workspaceId) ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title={item.starred ? '取消特别关注' : '标记为特别关注'}
                            >
                              <Star className={`w-5 h-5 ${item.starred ? 'fill-yellow-500' : ''}`} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 移动端排行列表 */}
              <div className="md:hidden divide-y divide-gray-50">
                {rankingData.map((item, index) => {
                  const rank = index + 1;
                  return (
                    <div key={item.workspaceId} className={`p-4 ${item.starred ? 'bg-yellow-50/50' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${getRankBadgeClass(rank)}`}>
                            {rank}
                          </span>
                          <span className="font-medium text-gray-800">{item.name}</span>
                          {item.starred && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />}
                        </div>
                        <button
                          onClick={() => handleToggleStar(item.workspaceId, item.starred)}
                          disabled={starTogglingIds.has(item.workspaceId)}
                          className={`p-1 rounded-full transition-colors ${
                            item.starred ? 'text-yellow-500' : 'text-gray-300'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${item.starred ? 'fill-yellow-500' : ''}`} />
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 flex gap-3">
                        <span>节点：{item.nodeCount}</span>
                        <span>对话：{item.conversationCount}</span>
                        <span>导出：{item.exportCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {banModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2">封禁工作区</h3>
            <p className="text-sm text-gray-500 mb-4">工作区：{banModal.name}</p>
            <textarea
              placeholder="封禁原因"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3 h-20 resize-none"
            />
            <select
              value={banDuration}
              onChange={(e) => setBanDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-4"
            >
              <option value={0}>永久封禁</option>
              <option value={1}>1小时</option>
              <option value={24}>24小时</option>
              <option value={168}>7天</option>
              <option value={720}>30天</option>
            </select>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setBanModal(null); setBanReason(''); setBanDuration(0); }}
                className="px-4 py-2 text-sm text-gray-600 border rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleBan}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                确认封禁
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 工作区详情弹窗 */}
      {detailModal.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
            {detailModal.loading ? (
              <div className="py-8 text-center text-gray-400">加载中...</div>
            ) : detailModal.data ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">工作区详情</h3>
                  <button onClick={() => setDetailModal({ id: '', loading: false, data: null })} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-500">名称</span>
                    <p className="text-sm font-medium text-gray-800">{detailModal.data.name}</p>
                  </div>
                  {detailModal.data.description && (
                    <div>
                      <span className="text-sm text-gray-500">描述</span>
                      <p className="text-sm text-gray-800">{detailModal.data.description}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">类型</span>
                      <p className="text-sm text-gray-800">{detailModal.data.type === 'public' ? '公开' : '私有'}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">成员数</span>
                      <p className="text-sm text-gray-800">{detailModal.data.stats.memberCount}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">节点数</span>
                      <p className="text-sm text-gray-800">{detailModal.data.stats.nodeCount}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">创建时间</span>
                      <p className="text-sm text-gray-800">{new Date(detailModal.data.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspacesPage;
