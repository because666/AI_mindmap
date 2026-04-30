import React, { useState, useEffect } from 'react';
import { usersApi } from '../../services/api';
import type { UserListItem, PaginationResult } from '../../types';
import { Search, Ban, Unlock, Trash2, Eye, Globe, X, ShieldBan } from 'lucide-react';

interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

interface IpVisitor {
  id: string;
  nickname: string;
  lastIp?: string;
  isBanned: boolean;
  banReason?: string;
  createdAt: string;
  lastSeen: string;
}

const UsersPage: React.FC = () => {
  const [data, setData] = useState<PaginationResult<UserListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [banModal, setBanModal] = useState<{ id: string; nickname: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState(0);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [ipSidebar, setIpSidebar] = useState<{ ip: string; visitors: IpVisitor[]; loading: boolean } | null>(null);
  const [ipBanModal, setIpBanModal] = useState<{ ip: string; visitorCount: number } | null>(null);
  const [ipBanReason, setIpBanReason] = useState('');
  const [ipBanDuration, setIpBanDuration] = useState(0);
  const [ipBanAutoAccounts, setIpBanAutoAccounts] = useState(true);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadUsers();
  }, [page, statusFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await usersApi.getList({ page, limit: 20, status: statusFilter || undefined, search: search || undefined });
      setData(res.data.data as PaginationResult<UserListItem>);
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadUsers();
  };

  const handleBan = async () => {
    if (!banModal) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await usersApi.ban(banModal.id, banReason, banDuration);
      setBanModal(null);
      setBanReason('');
      setBanDuration(0);
      showToast('success', `用户 ${banModal.nickname} 已封禁`);
      loadUsers();
    } catch (error) {
      console.error('封禁失败:', error);
      showToast('error', '封禁操作失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async (id: string) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await usersApi.unban(id, '管理员解封');
      showToast('success', '用户已解封');
      loadUsers();
    } catch (error) {
      console.error('解封失败:', error);
      showToast('error', '解封操作失败，请重试');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIpClick = async (ip: string) => {
    if (!ip) return;
    setIpSidebar({ ip, visitors: [], loading: true });
    try {
      const res = await usersApi.getIpVisitors(ip);
      const responseData = res.data.data as { ip: string; visitors: IpVisitor[]; total: number };
      setIpSidebar({ ip, visitors: responseData.visitors, loading: false });
    } catch (error) {
      console.error('查询同IP用户失败:', error);
      setIpSidebar(null);
      showToast('error', '查询同IP用户失败');
    }
  };

  const handleIpBan = async () => {
    if (!ipBanModal) return;
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await usersApi.banIp(ipBanModal.ip, ipBanReason, ipBanDuration, ipBanAutoAccounts);
      setIpBanModal(null);
      setIpBanReason('');
      setIpBanDuration(0);
      setIpBanAutoAccounts(true);
      showToast('success', `IP ${ipBanModal.ip} 已封禁`);
      setIpSidebar(null);
      loadUsers();
    } catch (error) {
      console.error('封禁IP失败:', error);
      showToast('error', '封禁IP失败，请重试');
    } finally {
      setActionLoading(false);
    }
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

      <h1 className="text-2xl font-bold text-gray-800 mb-6">用户管理</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="搜索昵称或ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              搜索
            </button>
          </form>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">全部状态</option>
            <option value="active">正常</option>
            <option value="banned">封禁</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-400">暂无用户数据</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">昵称</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">IP地址</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">注册时间</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">状态</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">工作区</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user._id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm">{user.nickname}</td>
                      <td className="py-3 px-4 text-sm">
                        {user.lastIp ? (
                          <button
                            onClick={() => handleIpClick(user.lastIp!)}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                          >
                            {user.lastIp}
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">未记录</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {user.isBanned ? '封禁' : '正常'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{user.stats.workspaceCount}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button className="p-1 text-gray-400 hover:text-blue-600" title="查看">
                            <Eye className="w-4 h-4" />
                          </button>
                          {user.isBanned ? (
                            <button onClick={() => handleUnban(user.id)} className="p-1 text-gray-400 hover:text-green-600" title="解封">
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button onClick={() => setBanModal({ id: user.id, nickname: user.nickname })} className="p-1 text-gray-400 hover:text-red-600" title="封禁">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                          {user.lastIp && (
                            <button onClick={() => handleIpClick(user.lastIp!)} className="p-1 text-gray-400 hover:text-orange-600" title="查看同IP用户">
                              <Globe className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-50">
              {data.items.map((user) => (
                <div key={user._id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-gray-800">{user.nickname}</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {user.isBanned ? '封禁' : '正常'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {user.isBanned ? (
                        <button onClick={() => handleUnban(user.id)} className="text-xs text-green-600">解封</button>
                      ) : (
                        <button onClick={() => setBanModal({ id: user.id, nickname: user.nickname })} className="text-xs text-red-600">封禁</button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {user.lastIp && (
                      <button onClick={() => handleIpClick(user.lastIp!)} className="text-blue-600 hover:underline font-mono mr-2">
                        IP:{user.lastIp}
                      </button>
                    )}
                    注册：{new Date(user.createdAt).toLocaleDateString()} · 工作区：{user.stats.workspaceCount}个
                  </div>
                </div>
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="px-3 py-1 text-sm text-gray-500">
                  {page}/{data.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                  disabled={page === data.totalPages}
                  className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {banModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2">封禁用户</h3>
            <p className="text-sm text-gray-500 mb-4">用户：{banModal.nickname}</p>
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
              <button onClick={() => setBanModal(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button onClick={handleBan} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">确认封禁</button>
            </div>
          </div>
        </div>
      )}

      {ipSidebar && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setIpSidebar(null)}>
          <div className="bg-white w-full max-w-md h-full shadow-xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800">IP: {ipSidebar.ip}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {ipSidebar.loading ? '加载中...' : `关联账号: ${ipSidebar.visitors.length}个`}
                </p>
              </div>
              <button onClick={() => setIpSidebar(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {ipSidebar.loading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : (
              <>
                <div className="p-4">
                  <button
                    onClick={() => {
                      setIpBanModal({ ip: ipSidebar.ip, visitorCount: ipSidebar.visitors.length });
                    }}
                    className="w-full py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <ShieldBan className="w-4 h-4" />
                    封禁此IP及所有关联账号
                  </button>
                </div>

                <div className="divide-y divide-gray-50">
                  {ipSidebar.visitors.map((v) => (
                    <div key={v.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-800 text-sm">{v.nickname}</span>
                          <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            v.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {v.isBanned ? '已封禁' : '正常'}
                          </span>
                        </div>
                        <span className="text-xs text-gray-400">{v.id.substring(0, 8)}...</span>
                      </div>
                      {v.isBanned && v.banReason && (
                        <p className="text-xs text-red-500 mt-1">原因：{v.banReason}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        注册：{new Date(v.createdAt).toLocaleDateString()} · 活跃：{new Date(v.lastSeen).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {ipBanModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-2">封禁IP地址</h3>
            <p className="text-sm text-gray-500 mb-4">
              IP: <span className="font-mono font-medium text-gray-800">{ipBanModal.ip}</span>
              ，关联账号: <span className="font-medium text-gray-800">{ipBanModal.visitorCount}</span>个
            </p>
            <textarea
              placeholder="封禁原因"
              value={ipBanReason}
              onChange={(e) => setIpBanReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3 h-20 resize-none"
            />
            <select
              value={ipBanDuration}
              onChange={(e) => setIpBanDuration(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
            >
              <option value={0}>永久封禁</option>
              <option value={1}>1小时</option>
              <option value={24}>24小时</option>
              <option value={168}>7天</option>
              <option value={720}>30天</option>
            </select>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={ipBanAutoAccounts}
                onChange={(e) => setIpBanAutoAccounts(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">同时封禁该IP下的所有关联账号</span>
            </label>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setIpBanModal(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button onClick={handleIpBan} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700">确认封禁IP</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
