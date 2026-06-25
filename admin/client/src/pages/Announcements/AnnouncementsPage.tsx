import React, { useState, useEffect, useCallback } from 'react';
import { announcementsApi } from '../../services/api';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  X,
  Info,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * 公告类型定义
 */
type AnnouncementType = 'info' | 'warning' | 'success' | 'error';

/**
 * 公告列表项接口
 */
interface AnnouncementItem {
  _id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  targetGroups?: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 分页结果接口
 */
interface PaginationResult {
  items: AnnouncementItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Toast 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 编辑弹窗表单数据接口
 */
interface FormData {
  title: string;
  content: string;
  type: AnnouncementType;
  targetGroups: string[];
  startDate: string;
  endDate: string;
  isActive: boolean;
}

/**
 * 公告类型标签映射
 * 键为公告类型，值为对应的中文标签和 TailwindCSS 样式类名
 */
const TYPE_MAP: Record<AnnouncementType, { label: string; className: string; icon: React.FC<{ className?: string }> }> = {
  info: { label: '信息', className: 'bg-blue-50 text-blue-600', icon: Info },
  warning: { label: '警告', className: 'bg-yellow-50 text-yellow-600', icon: AlertTriangle },
  success: { label: '成功', className: 'bg-green-50 text-green-600', icon: CheckCircle },
  error: { label: '错误', className: 'bg-red-50 text-red-600', icon: XCircle },
};

/**
 * 空表单初始值
 */
const EMPTY_FORM: FormData = {
  title: '',
  content: '',
  type: 'info',
  targetGroups: [],
  startDate: '',
  endDate: '',
  isActive: true,
};

/**
 * 公告管理页面
 * 展示公告列表（标题/类型/状态/生效时间/操作），创建/编辑弹窗，启用/禁用开关，删除确认
 */
const AnnouncementsPage: React.FC = () => {
  const [data, setData] = useState<PaginationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [targetGroupInput, setTargetGroupInput] = useState('');

  /**
   * 显示 Toast 提示
   * @param type - 提示类型：success 或 error
   * @param text - 提示文本内容
   */
  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 加载公告列表数据
   */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await announcementsApi.getList({
        page,
        limit: 20,
        search: search || undefined,
        type: typeFilter || undefined,
        isActive: statusFilter || undefined,
      });
      const result = res.data.data as PaginationResult;
      setData(result);
    } catch (error) {
      console.error('加载公告列表失败:', error);
      showToast('error', '加载公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * 打开创建弹窗
   */
  const handleCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setTargetGroupInput('');
    setShowModal(true);
  };

  /**
   * 打开编辑弹窗
   * @param item - 待编辑的公告项
   */
  const handleEdit = (item: AnnouncementItem) => {
    setEditingId(item._id);
    setForm({
      title: item.title,
      content: item.content,
      type: item.type,
      targetGroups: item.targetGroups || [],
      startDate: item.startDate ? format(new Date(item.startDate), "yyyy-MM-dd'T'HH:mm") : '',
      endDate: item.endDate ? format(new Date(item.endDate), "yyyy-MM-dd'T'HH:mm") : '',
      isActive: item.isActive,
    });
    setTargetGroupInput('');
    setShowModal(true);
  };

  /**
   * 提交表单（创建或更新公告）
   */
  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim() || !form.startDate || !form.endDate) {
      showToast('error', '请填写必要字段：标题、内容、起止时间');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await announcementsApi.update(editingId, {
          title: form.title,
          content: form.content,
          type: form.type,
          targetGroups: form.targetGroups,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
        });
        showToast('success', '公告已更新');
      } else {
        await announcementsApi.create({
          title: form.title,
          content: form.content,
          type: form.type,
          targetGroups: form.targetGroups,
          startDate: new Date(form.startDate).toISOString(),
          endDate: new Date(form.endDate).toISOString(),
          isActive: form.isActive,
        });
        showToast('success', '公告已创建');
      }
      setShowModal(false);
      loadList();
    } catch (error) {
      console.error('保存公告失败:', error);
      showToast('error', '保存公告失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 切换公告启用/禁用状态
   * @param id - 公告ID
   */
  const handleToggle = async (id: string) => {
    try {
      await announcementsApi.toggle(id);
      showToast('success', '状态已切换');
      loadList();
    } catch (error) {
      console.error('切换状态失败:', error);
      showToast('error', '切换状态失败');
    }
  };

  /**
   * 确认删除公告
   */
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    setDeleting(true);
    try {
      await announcementsApi.delete(deleteConfirmId);
      showToast('success', '公告已删除');
      setDeleteConfirmId(null);
      loadList();
    } catch (error) {
      console.error('删除公告失败:', error);
      showToast('error', '删除公告失败');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 添加目标分组
   * 将输入框中的分组ID添加到目标分组列表
   */
  const addTargetGroup = () => {
    const trimmed = targetGroupInput.trim();
    if (trimmed && !form.targetGroups.includes(trimmed)) {
      setForm({ ...form, targetGroups: [...form.targetGroups, trimmed] });
    }
    setTargetGroupInput('');
  };

  /**
   * 移除目标分组
   * @param group - 需要移除的分组ID
   */
  const removeTargetGroup = (group: string) => {
    setForm({ ...form, targetGroups: form.targetGroups.filter((g) => g !== group) });
  };

  /**
   * 格式化日期显示
   * @param dateStr - ISO 日期字符串
   * @returns 格式化后的日期字符串
   */
  const formatDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题与操作 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">公告管理</h1>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建公告
        </button>
      </div>

      {/* 筛选条件 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">搜索标题</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索公告标题..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="info">信息</option>
              <option value="warning">警告</option>
              <option value="success">成功</option>
              <option value="error">错误</option>
            </select>
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="true">已启用</option>
              <option value="false">已禁用</option>
            </select>
          </div>
          <button
            onClick={() => { setPage(1); loadList(); }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            搜索
          </button>
        </div>
      </div>

      {/* 公告列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-400">暂无公告数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">标题</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">类型</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">状态</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">生效时间</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">创建人</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((item) => {
                  const typeInfo = TYPE_MAP[item.type];
                  return (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[240px]" title={item.title}>
                          {item.title}
                        </div>
                        <div className="text-gray-400 text-xs truncate max-w-[240px]" title={item.content}>
                          {item.content}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.className}`}>
                          {React.createElement(typeInfo.icon, { className: 'w-3 h-3' })}
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(item._id)}
                          className="flex items-center gap-1"
                          title={item.isActive ? '点击禁用' : '点击启用'}
                        >
                          {item.isActive ? (
                            <ToggleRight className="w-6 h-6 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-gray-400" />
                          )}
                          <span className={`text-xs ${item.isActive ? 'text-green-600' : 'text-gray-400'}`}>
                            {item.isActive ? '启用' : '禁用'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        <div>{formatDate(item.startDate)}</div>
                        <div className="text-gray-400">至 {formatDate(item.endDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{item.createdBy}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="编辑"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(item._id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <span className="text-sm text-gray-500">
              共 {data.total} 条，第 {data.page}/{data.totalPages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 创建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId ? '编辑公告' : '新建公告'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  标题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="请输入公告标题"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  内容 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="请输入公告内容"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  类型 <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as AnnouncementType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="info">信息</option>
                  <option value="warning">警告</option>
                  <option value="success">成功</option>
                  <option value="error">错误</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目标分组</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetGroupInput}
                    onChange={(e) => setTargetGroupInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTargetGroup();
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="输入分组ID后回车添加"
                  />
                  <button
                    type="button"
                    onClick={addTargetGroup}
                    className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
                  >
                    添加
                  </button>
                </div>
                {form.targetGroups.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.targetGroups.map((group) => (
                      <span
                        key={group}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs"
                      >
                        {group}
                        <button
                          type="button"
                          onClick={() => removeTargetGroup(group)}
                          className="hover:text-blue-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-1">留空则面向全部用户</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    开始时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    结束时间 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              {!editingId && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">创建后立即启用</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className="flex items-center"
                  >
                    {form.isActive ? (
                      <ToggleRight className="w-6 h-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-400" />
                    )}
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30" onClick={() => setDeleteConfirmId(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-sm text-gray-600 mb-6">确定要删除此公告吗？此操作不可撤销。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsPage;
