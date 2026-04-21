import React, { useState, useEffect } from 'react';
import { workspacesApi } from '../../services/api';
import type { WorkspaceListItem, PaginationResult } from '../../types';
import { Search, Eye, XCircle, Bell } from 'lucide-react';

const WorkspacesPage: React.FC = () => {
  const [data, setData] = useState<PaginationResult<WorkspaceListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { loadWorkspaces(); }, [page]);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const res = await workspacesApi.getList({ page, limit: 20, search: search || undefined });
      setData(res.data.data as PaginationResult<WorkspaceListItem>);
    } catch (error) {
      console.error('加载工作区失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadWorkspaces();
  };

  const handleClose = async (id: string) => {
    const reason = prompt('请输入关闭原因：');
    if (!reason) return;
    try {
      await workspacesApi.close(id, reason);
      loadWorkspaces();
    } catch (error) {
      console.error('关闭工作区失败:', error);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">工作区管理</h1>
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
    </div>
  );
};

export default WorkspacesPage;
