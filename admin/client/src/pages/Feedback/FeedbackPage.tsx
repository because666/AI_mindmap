import React, { useState, useEffect, useCallback } from 'react';
import { feedbacksApi } from '../../services/api';
import type { FeedbackListItem, FeedbackStats, FeedbackStatus, FeedbackType, PaginationResult } from '../../types';
import { MessageSquare, Clock, CheckCircle, TrendingUp, Search, Download, X, Eye } from 'lucide-react';
import { format } from 'date-fns';

/**
 * 反馈状态标签映射
 * 键为反馈状态，值为对应的中文标签和 TailwindCSS 样式类名
 */
const STATUS_MAP: Record<FeedbackStatus, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'bg-yellow-50 text-yellow-600' },
  processing: { label: '处理中', className: 'bg-blue-50 text-blue-600' },
  resolved: { label: '已解决', className: 'bg-green-50 text-green-600' },
  closed: { label: '已关闭', className: 'bg-gray-100 text-gray-500' },
};

/**
 * 反馈类型标签映射
 * 键为反馈类型，值为对应的 TailwindCSS 样式类名
 */
const TYPE_MAP: Record<FeedbackType, { className: string }> = {
  '功能异常': { className: 'bg-red-50 text-red-600' },
  '界面问题': { className: 'bg-orange-50 text-orange-600' },
  '建议': { className: 'bg-blue-50 text-blue-600' },
  '其他': { className: 'bg-gray-100 text-gray-500' },
};

/**
 * 状态流转顺序定义
 * 用于详情弹窗中的状态下拉选择，控制状态只能按顺序流转
 */
const STATUS_FLOW: FeedbackStatus[] = ['pending', 'processing', 'resolved', 'closed'];

/**
 * Toast 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 反馈详情弹窗状态接口
 */
interface DetailModalState {
  visible: boolean;
  item: FeedbackListItem | null;
  newStatus: FeedbackStatus;
  saving: boolean;
}

/**
 * 反馈管理页面
 * 展示反馈统计数据、筛选条件、反馈列表、分页及详情弹窗
 * 支持按类型/状态/日期范围/关键词筛选，支持导出和修改反馈状态
 */
const FeedbackPage: React.FC = () => {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [data, setData] = useState<PaginationResult<FeedbackListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [keyword, setKeyword] = useState<string>('');

  const [detailModal, setDetailModal] = useState<DetailModalState>({
    visible: false,
    item: null,
    newStatus: 'pending',
    saving: false,
  });

  const [toast, setToast] = useState<ToastMessage | null>(null);

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
   * 加载反馈统计数据
   * 异步获取统计数据，失败时在控制台输出错误信息
   */
  const loadStats = useCallback(async () => {
    try {
      const res = await feedbacksApi.getStats();
      setStats(res.data.data as FeedbackStats);
    } catch (error) {
      console.error('加载反馈统计失败:', error);
    }
  }, []);

  /**
   * 加载反馈列表数据
   * 根据当前筛选条件和分页参数异步获取列表
   * 加载失败时在控制台输出错误信息
   */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await feedbacksApi.getList({
        page,
        pageSize,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        keyword: keyword || undefined,
      });
      setData(res.data.data as PaginationResult<FeedbackListItem>);
    } catch (error) {
      console.error('加载反馈列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, statusFilter, startDate, endDate, keyword]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * 重置所有筛选条件
   * 清空类型、状态、日期范围、关键词筛选，并重置页码为1
   */
  const handleReset = () => {
    setTypeFilter('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setKeyword('');
    setPage(1);
  };

  /**
   * 处理搜索表单提交
   * 阻止默认行为，重置页码为1并重新加载列表
   * @param e - 表单提交事件
   */
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    loadList();
  };

  /**
   * 处理导出操作
   * 根据当前筛选条件导出反馈数据为文件
   * 导出成功时自动下载文件，失败时显示错误提示
   */
  const handleExport = async () => {
    try {
      const res = await feedbacksApi.export({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      const blob = new Blob([res.data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `反馈数据_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast('success', '导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      showToast('error', '导出失败，请重试');
    }
  };

  /**
   * 打开反馈详情弹窗
   * 设置弹窗可见、当前反馈项数据，并初始化状态选择为当前反馈状态
   * @param item - 要查看详情的反馈列表项
   */
  const openDetail = (item: FeedbackListItem) => {
    setDetailModal({
      visible: true,
      item,
      newStatus: item.status,
      saving: false,
    });
  };

  /**
   * 关闭反馈详情弹窗
   * 重置弹窗状态为不可见
   */
  const closeDetail = () => {
    setDetailModal({
      visible: false,
      item: null,
      newStatus: 'pending',
      saving: false,
    });
  };

  /**
   * 保存反馈状态修改
   * 调用API更新反馈状态，成功后刷新列表和统计数据，并关闭弹窗
   * 失败时显示错误提示，保存过程中禁用保存按钮
   */
  const handleSaveStatus = async () => {
    if (!detailModal.item) return;
    if (detailModal.saving) return;
    setDetailModal((prev) => ({ ...prev, saving: true }));
    try {
      await feedbacksApi.updateStatus(detailModal.item._id, detailModal.newStatus);
      showToast('success', '状态更新成功');
      closeDetail();
      // 直接更新本地列表中对应项的状态，实现即时刷新
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item._id === detailModal.item!._id
              ? { ...item, status: detailModal.newStatus }
              : item
          ),
        };
      });
      loadStats();
    } catch (error) {
      console.error('更新状态失败:', error);
      showToast('error', '状态更新失败，请重试');
    } finally {
      setDetailModal((prev) => ({ ...prev, saving: false }));
    }
  };

  /**
   * 渲染统计卡片
   * @param title - 卡片标题
   * @param value - 卡片数值
   * @param icon - 卡片图标组件
   * @param colorClass - 图标背景和文字的 TailwindCSS 样式类名
   */
  const renderStatCard = (
    title: string,
    value: number,
    icon: React.ReactNode,
    colorClass: string
  ) => (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800 mb-6">反馈管理</h1>

      {/* 统计卡片区 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {renderStatCard('总反馈数', stats?.totalCount ?? 0, <MessageSquare className="w-4 h-4" />, 'bg-blue-50 text-blue-600')}
        {renderStatCard('待处理', stats?.pendingCount ?? 0, <Clock className="w-4 h-4" />, 'bg-yellow-50 text-yellow-600')}
        {renderStatCard('已解决', stats?.resolvedCount ?? 0, <CheckCircle className="w-4 h-4" />, 'bg-green-50 text-green-600')}
        {renderStatCard('今日新增', stats?.todayCount ?? 0, <TrendingUp className="w-4 h-4" />, 'bg-purple-50 text-purple-600')}
      </div>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <form onSubmit={handleSearch} className="p-4 flex flex-wrap gap-3 items-center">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部类型</option>
            <option value="功能异常">功能异常</option>
            <option value="界面问题">界面问题</option>
            <option value="建议">建议</option>
            <option value="其他">其他</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processing">处理中</option>
            <option value="resolved">已解决</option>
            <option value="closed">已关闭</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            placeholder="开始日期"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            placeholder="结束日期"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="按标题搜索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            搜索
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            导出
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            重置
          </button>
        </form>
      </div>

      {/* 反馈列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-400">暂无反馈数据</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">标题</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">类型</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">状态</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">联系方式</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">提交IP</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">提交时间</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-800 max-w-[200px] truncate">{item.title}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_MAP[item.type]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_MAP[item.status]?.label ?? item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 max-w-[120px] truncate">{item.contact || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-500 font-mono text-xs">{item.visitorIp || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openDetail(item)}
                          className="p-1 text-gray-400 hover:text-blue-600"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-50">
              {data.items.map((item) => (
                <div key={item._id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-800 text-sm block truncate">{item.title}</span>
                    </div>
                    <button
                      onClick={() => openDetail(item)}
                      className="ml-2 p-1 text-gray-400 hover:text-blue-600 shrink-0"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_MAP[item.type]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.type}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_MAP[item.status]?.label ?? item.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.visitorIp && <span className="font-mono mr-2">IP:{item.visitorIp}</span>}
                    {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
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

      {/* 反馈详情弹窗 */}
      {detailModal.visible && detailModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">反馈详情</h3>
              <button onClick={closeDetail} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div>
                <span className="text-xs font-medium text-gray-500">标题</span>
                <p className="text-sm text-gray-800 mt-0.5">{detailModal.item.title}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500">描述</span>
                <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{detailModal.item.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs font-medium text-gray-500">类型</span>
                  <p className="mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_MAP[detailModal.item.type]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                      {detailModal.item.type}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">联系方式</span>
                  <p className="text-sm text-gray-800 mt-0.5">{detailModal.item.contact || '-'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">提交IP</span>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono">{detailModal.item.visitorIp || '-'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">提交者标识</span>
                  <p className="text-sm text-gray-800 mt-0.5 font-mono">{detailModal.item.visitorId || '-'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-gray-500">提交时间</span>
                  <p className="text-sm text-gray-800 mt-0.5">{format(new Date(detailModal.item.createdAt), 'yyyy-MM-dd HH:mm:ss')}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs font-medium text-gray-500 block mb-1">修改状态</label>
              <select
                value={detailModal.newStatus}
                onChange={(e) => setDetailModal((prev) => ({ ...prev, newStatus: e.target.value as FeedbackStatus }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_FLOW.map((s) => (
                  <option key={s} value={s}>{STATUS_MAP[s].label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button onClick={closeDetail} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50">
                关闭
              </button>
              <button
                onClick={handleSaveStatus}
                disabled={detailModal.saving}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {detailModal.saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackPage;
