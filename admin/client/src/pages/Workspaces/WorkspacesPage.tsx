import React, { useState, useEffect, useCallback } from 'react';
import { workspacesApi } from '../../services/api';
import type { WorkspaceListItem, PaginationResult, RankingSortBy, WorkspaceRankingItem } from '../../types';
import { Search, Eye, XCircle, Bell, Star, Trophy } from 'lucide-react';

/**
 * 操作反馈提示接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
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
                    {data.items.map((ws) => (
                      <tr key={ws._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium">{ws.name}</td>
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
                            <button className="p-1 text-gray-400 hover:text-blue-600" title="查看"><Eye className="w-4 h-4" /></button>
                            <button onClick={() => handleClose(ws.id)} className="p-1 text-gray-400 hover:text-red-600" title="关闭"><XCircle className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-50">
                {data.items.map((ws) => (
                  <div key={ws._id} className="p-4">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-800">{ws.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        ws.type === 'public' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                      }`}>{ws.type === 'public' ? '公开' : '私有'}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      创建者：{ws.creator.nickname} · 成员：{ws.stats.memberCount} · 节点：{ws.stats.nodeCount}
                    </div>
                  </div>
                ))}
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
    </div>
  );
};

export default WorkspacesPage;
