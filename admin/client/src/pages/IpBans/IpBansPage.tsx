import React, { useState, useEffect } from 'react';
import { ipBansApi } from '../../services/api';
import { Search, Unlock, Eye, ShieldBan, X } from 'lucide-react';

interface IpBanItem {
  _id: string;
  ip: string;
  reason: string;
  bannedAt: string;
  banExpiresAt?: string;
  bannedBy: string;
  visitorIds: string[];
  autoBanAccounts: boolean;
  associatedVisitorCount: number;
}

interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

const IpBansPage: React.FC = () => {
  const [items, setItems] = useState<IpBanItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [detailModal, setDetailModal] = useState<IpBanItem | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadBans();
  }, [page]);

  const loadBans = async () => {
    setLoading(true);
    try {
      const res = await ipBansApi.getList({ page, limit: 20, search: search || undefined });
      const data = res.data.data as { items: IpBanItem[]; total: number; page: number; totalPages: number };
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('加载IP封禁列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadBans();
  };

  const handleUnban = async (ip: string) => {
    if (actionLoading) return;
    const reason = prompt('请输入解封原因（可选）：');
    setActionLoading(true);
    try {
      await ipBansApi.unban(ip, reason || undefined);
      showToast('success', `IP ${ip} 已解封`);
      loadBans();
    } catch (error) {
      console.error('解封IP失败:', error);
      showToast('error', '解封IP失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const isExpired = (expiresAt?: string) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const formatDuration = (bannedAt: string, expiresAt?: string) => {
    if (!expiresAt) return '永久';
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) return '已过期';
    const hours = Math.floor(remaining / 3600000);
    if (hours < 24) return `${hours}小时`;
    const days = Math.floor(hours / 24);
    return `${days}天`;
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

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">IP封禁管理</h1>
        <span className="text-sm text-gray-500">共 {total} 条封禁记录</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索IP地址"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              搜索
            </button>
          </form>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !items.length ? (
          <div className="p-8 text-center text-gray-400">暂无IP封禁记录</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">IP地址</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">封禁原因</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">时长</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">关联账号</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">封禁时间</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作人</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const expired = isExpired(item.banExpiresAt);
                    return (
                      <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-mono">{item.ip}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-[200px] truncate">{item.reason}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            expired ? 'bg-gray-50 text-gray-400' : !item.banExpiresAt ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                          }`}>
                            {formatDuration(item.bannedAt, item.banExpiresAt)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">{item.associatedVisitorCount}个</td>
                        <td className="py-3 px-4 text-sm text-gray-500">{new Date(item.bannedAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-sm text-gray-500">{item.bannedBy}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button onClick={() => setDetailModal(item)} className="p-1 text-gray-400 hover:text-blue-600" title="查看详情">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleUnban(item.ip)} className="p-1 text-gray-400 hover:text-green-600" title="解封">
                              <Unlock className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-50">
              {items.map((item) => {
                const expired = isExpired(item.banExpiresAt);
                return (
                  <div key={item._id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-mono font-medium text-gray-800 text-sm">{item.ip}</span>
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          expired ? 'bg-gray-50 text-gray-400' : !item.banExpiresAt ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                          {formatDuration(item.bannedAt, item.banExpiresAt)}
                        </span>
                      </div>
                      <button onClick={() => handleUnban(item.ip)} className="text-xs text-green-600">解封</button>
                    </div>
                    <p className="text-xs text-gray-500 mb-1">原因：{item.reason}</p>
                    <p className="text-xs text-gray-400">
                      关联{item.associatedVisitorCount}个账号 · {new Date(item.bannedAt).toLocaleDateString()} · {item.bannedBy}
                    </p>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-3 py-1 text-sm text-gray-500">{page}/{totalPages}</span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDetailModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">IP封禁详情</h3>
              <button onClick={() => setDetailModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">IP地址</span>
                <span className="font-mono font-medium">{detailModal.ip}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">封禁原因</span>
                <span>{detailModal.reason}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">时长</span>
                <span>{formatDuration(detailModal.bannedAt, detailModal.banExpiresAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">封禁时间</span>
                <span>{new Date(detailModal.bannedAt).toLocaleString()}</span>
              </div>
              {detailModal.banExpiresAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">到期时间</span>
                  <span>{new Date(detailModal.banExpiresAt).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">操作人</span>
                <span>{detailModal.bannedBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">关联账号</span>
                <span>{detailModal.associatedVisitorCount}个</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">同时封禁账号</span>
                <span>{detailModal.autoBanAccounts ? '是' : '否'}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-3 justify-end">
              <button onClick={() => setDetailModal(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">关闭</button>
              <button onClick={() => { setDetailModal(null); handleUnban(detailModal.ip); }} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">
                解封此IP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IpBansPage;
