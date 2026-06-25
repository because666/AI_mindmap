import React, { useState, useEffect, useCallback } from 'react';
import { adminAccountsApi } from '../../services/api';
import { UserCog, Plus, Pencil, Trash2, X } from 'lucide-react';

/**
 * 管理员角色类型
 */
type AdminRole = 'super_admin' | 'operator' | 'auditor' | 'readonly';

/**
 * 角色显示名称映射
 */
const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: '超级管理员',
  operator: '运营管理员',
  auditor: '审计员',
  readonly: '只读用户',
};

/**
 * 角色选项列表（用于下拉选择）
 */
const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: 'super_admin', label: '超级管理员' },
  { value: 'operator', label: '运营管理员' },
  { value: 'auditor', label: '审计员' },
  { value: 'readonly', label: '只读用户' },
];

/**
 * 管理员列表项接口
 */
interface AdminAccountItem {
  _id: string;
  username: string;
  nickname: string;
  role: AdminRole;
  roleLabel: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  createdByIp: string | null;
}

/**
 * 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 创建/编辑管理员弹窗表单数据
 */
interface AccountFormData {
  username: string;
  password: string;
  nickname: string;
  role: AdminRole;
}

/**
 * 管理员账户管理页面
 * 展示管理员列表，支持创建、编辑角色/启用状态、软删除操作
 * 仅超级管理员可见
 */
const AdminAccountsPage: React.FC = () => {
  const [items, setItems] = useState<AdminAccountItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<AccountFormData>({
    username: '',
    password: '',
    nickname: '',
    role: 'operator',
  });

  const [editModal, setEditModal] = useState<AdminAccountItem | null>(null);
  const [editRole, setEditRole] = useState<AdminRole>('operator');
  const [editIsActive, setEditIsActive] = useState(true);

  const [deleteConfirm, setDeleteConfirm] = useState<AdminAccountItem | null>(null);

  /**
   * 显示提示消息
   * @param type - 消息类型：success 或 error
   * @param text - 消息文本
   */
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 加载管理员列表数据
   */
  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAccountsApi.getAccounts({ page, limit: 20 });
      const data = res.data.data as { items: AdminAccountItem[]; total: number; page: number; totalPages: number };
      setItems(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error('加载管理员列表失败:', error);
      showToast('error', '加载管理员列表失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /**
   * 创建管理员账户
   */
  const handleCreate = async () => {
    if (actionLoading) return;
    if (!createForm.username || !createForm.password || !createForm.nickname) {
      showToast('error', '用户名、密码、昵称均为必填项');
      return;
    }
    setActionLoading(true);
    try {
      await adminAccountsApi.createAccount({
        username: createForm.username,
        password: createForm.password,
        nickname: createForm.nickname,
        role: createForm.role,
      });
      showToast('success', '管理员创建成功');
      setShowCreateModal(false);
      setCreateForm({ username: '', password: '', nickname: '', role: 'operator' });
      loadAccounts();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showToast('error', err.response?.data?.error || '创建管理员失败');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 更新管理员角色和启用状态
   */
  const handleEdit = async () => {
    if (actionLoading || !editModal) return;
    setActionLoading(true);
    try {
      await adminAccountsApi.updateAccount(editModal._id, {
        role: editRole,
        isActive: editIsActive,
      });
      showToast('success', '管理员信息已更新');
      setEditModal(null);
      loadAccounts();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showToast('error', err.response?.data?.error || '更新管理员失败');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 软删除管理员账户
   */
  const handleDelete = async () => {
    if (actionLoading || !deleteConfirm) return;
    setActionLoading(true);
    try {
      await adminAccountsApi.deleteAccount(deleteConfirm._id);
      showToast('success', '管理员已删除');
      setDeleteConfirm(null);
      loadAccounts();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      showToast('error', err.response?.data?.error || '删除管理员失败');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 打开编辑弹窗，初始化编辑表单
   * @param item - 要编辑的管理员信息
   */
  const openEditModal = (item: AdminAccountItem) => {
    setEditModal(item);
    setEditRole(item.role);
    setEditIsActive(item.isActive);
  };

  /**
   * 格式化日期时间显示
   * @param dateStr - ISO 日期字符串
   * @returns 格式化后的日期时间字符串
   */
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN');
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
        <div className="flex items-center gap-3">
          <UserCog className="w-7 h-7 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">管理员管理</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">共 {total} 位管理员</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            创建管理员
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !items.length ? (
          <div className="p-8 text-center text-gray-400">暂无管理员账户</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">用户名</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">昵称</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">角色</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">状态</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">创建时间</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">最后登录</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm font-mono font-medium text-gray-800">{item.username}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{item.nickname}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.role === 'super_admin' ? 'bg-purple-50 text-purple-700' :
                          item.role === 'operator' ? 'bg-blue-50 text-blue-700' :
                          item.role === 'auditor' ? 'bg-yellow-50 text-yellow-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {item.roleLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {item.isActive ? '启用' : '禁用'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatDateTime(item.createdAt)}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">{formatDateTime(item.lastLoginAt)}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => openEditModal(item)} className="p-1 text-gray-400 hover:text-blue-600" title="编辑">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteConfirm(item)} className="p-1 text-gray-400 hover:text-red-600" title="删除">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item._id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-mono font-medium text-gray-800 text-sm">{item.username}</span>
                      <span className="ml-2 text-sm text-gray-500">{item.nickname}</span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(item)} className="p-1 text-gray-400 hover:text-blue-600">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteConfirm(item)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                      item.role === 'super_admin' ? 'bg-purple-50 text-purple-700' :
                      item.role === 'operator' ? 'bg-blue-50 text-blue-700' :
                      item.role === 'auditor' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-gray-50 text-gray-600'
                    }`}>
                      {item.roleLabel}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${
                      item.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                    }`}>
                      {item.isActive ? '启用' : '禁用'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    创建: {formatDateTime(item.createdAt)} · 最后登录: {formatDateTime(item.lastLoginAt)}
                  </p>
                </div>
              ))}
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">创建管理员</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="3-30个字符"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="至少6位"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  type="text"
                  value={createForm.nickname}
                  onChange={(e) => setCreateForm({ ...createForm, nickname: e.target.value })}
                  placeholder="2-20个字符"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as AdminRole })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">编辑管理员</h3>
              <button onClick={() => setEditModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">用户名</span>
                <span className="text-sm text-gray-800 font-mono">{editModal.username}</span>
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">昵称</span>
                <span className="text-sm text-gray-800">{editModal.nickname}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as AdminRole)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">启用状态</label>
                <select
                  value={editIsActive ? 'true' : 'false'}
                  onChange={(e) => setEditIsActive(e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">启用</option>
                  <option value="false">禁用</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex gap-3 justify-end">
              <button onClick={() => setEditModal(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={handleEdit}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {actionLoading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">确认删除</h3>
            <p className="text-sm text-gray-600 mb-6">
              确定要删除管理员 <span className="font-medium text-gray-800">{deleteConfirm.nickname}</span>（{deleteConfirm.username}）吗？此操作将禁用该账户。
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAccountsPage;
