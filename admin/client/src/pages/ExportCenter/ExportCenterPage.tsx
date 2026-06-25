import React, { useState, useEffect, useCallback } from 'react';
import { exportCenterApi, exportApi } from '../../services/api';
import type { ExportTaskItem, ExportTaskStatus, PaginationResult } from '../../types';
import { Download, RefreshCw, Clock, CheckCircle, XCircle, Loader2, FileDown, Timer } from 'lucide-react';
import { format } from 'date-fns';

/**
 * 导出任务状态标签映射
 * 键为导出任务状态，值为对应的中文标签和 TailwindCSS 样式类名
 */
const STATUS_MAP: Record<ExportTaskStatus, { label: string; className: string; icon: React.ReactNode }> = {
  processing: { label: '处理中', className: 'bg-blue-50 text-blue-600', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: '已完成', className: 'bg-green-50 text-green-600', icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: '失败', className: 'bg-red-50 text-red-600', icon: <XCircle className="w-3 h-3" /> },
};

/**
 * 导出类型中文映射
 */
const TYPE_LABEL_MAP: Record<string, string> = {
  users: '用户数据',
  workspaces: '工作区数据',
  messages: '消息数据',
  audit_logs: '审计日志',
};

/**
 * Toast 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 计算剩余有效时间
 * @param expiredAt - 过期时间字符串
 * @returns 剩余时间描述字符串，已过期返回 null
 */
function getRemainingTime(expiredAt: string): string | null {
  const now = new Date().getTime();
  const expired = new Date(expiredAt).getTime();
  const diff = expired - now;
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}天${hours}小时`;
  if (hours > 0) return `${hours}小时${minutes}分钟`;
  return `${minutes}分钟`;
}

/**
 * 格式化文件大小
 * @param bytes - 文件字节数
 * @returns 格式化后的文件大小字符串
 */
function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 导出中心页面
 * 展示导出任务列表，支持按状态筛选、重试失败任务、有效期倒计时、过期文件禁用下载
 */
const ExportCenterPage: React.FC = () => {
  const [data, setData] = useState<PaginationResult<ExportTaskItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(Date.now());

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
   * 加载导出任务列表
   * 根据当前筛选条件和分页参数异步获取列表
   */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await exportCenterApi.getTasks({
        page,
        limit: pageSize,
        status: statusFilter || undefined,
      });
      setData(res.data.data as PaginationResult<ExportTaskItem>);
    } catch (error) {
      console.error('加载导出任务列表失败:', error);
      showToast('error', '加载导出任务列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * 每分钟刷新当前时间，用于更新倒计时显示
   */
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  /**
   * 处理重试操作
   * 调用重试API，成功后刷新列表
   * @param id - 需要重试的导出任务ID
   */
  const handleRetry = async (id: string) => {
    if (retryingId) return;
    setRetryingId(id);
    try {
      await exportCenterApi.retryTask(id);
      showToast('success', '重试任务已提交');
      loadList();
    } catch (error) {
      console.error('重试导出任务失败:', error);
      showToast('error', '重试失败，请稍后再试');
    } finally {
      setRetryingId(null);
    }
  };

  /**
   * 处理文件下载
   * 下载成功时自动保存文件，失败时显示错误提示
   * @param task - 需要下载的导出任务项
   */
  const handleDownload = async (task: ExportTaskItem) => {
    try {
      const res = await exportApi.download(task.id);
      const blob = new Blob([res.data as BlobPart]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${task.type}_${format(new Date(task.createdAt), 'yyyy-MM-dd')}.${task.format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('下载导出文件失败:', error);
      showToast('error', '下载失败，文件可能已过期');
    }
  };

  /**
   * 判断文件是否已过期
   * @param expiredAt - 过期时间字符串
   * @returns 是否已过期
   */
  const isExpired = (expiredAt: string | undefined): boolean => {
    if (!expiredAt) return false;
    return new Date(expiredAt).getTime() < now;
  };

  /**
   * 渲染过期时间或倒计时
   * @param task - 导出任务项
   * @returns 倒计时或过期状态JSX
   */
  const renderExpiry = (task: ExportTaskItem) => {
    if (task.status !== 'completed') return <span className="text-gray-400">-</span>;
    if (!task.expiredAt) return <span className="text-gray-400">-</span>;

    const expired = isExpired(task.expiredAt);
    if (expired) {
      return (
        <span className="text-red-500 text-xs font-medium">已过期</span>
      );
    }

    const remaining = getRemainingTime(task.expiredAt);
    return (
      <span className="text-orange-500 text-xs flex items-center gap-1">
        <Timer className="w-3 h-3" />
        {remaining}
      </span>
    );
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

      <h1 className="text-2xl font-bold text-gray-800 mb-6">导出中心</h1>

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-4 flex flex-wrap gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="processing">处理中</option>
            <option value="completed">已完成</option>
            <option value="failed">失败</option>
          </select>

          <button
            type="button"
            onClick={() => loadList()}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      {/* 导出任务列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-400">暂无导出任务</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">任务ID</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">类型</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">格式</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">状态</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">创建时间</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">文件大小</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">有效期</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items as ExportTaskItem[]).map((item) => {
                    const expired = isExpired(item.expiredAt);
                    return (
                      <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-800 font-mono text-xs max-w-[120px] truncate" title={item.id}>
                          {item.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-800">
                          {TYPE_LABEL_MAP[item.type] ?? item.type}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-600 uppercase">
                            {item.format}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_MAP[item.status]?.icon}
                            {STATUS_MAP[item.status]?.label ?? item.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">
                          {formatFileSize(item.fileSize)}
                        </td>
                        <td className="py-3 px-4">
                          {renderExpiry(item)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {item.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(item.id)}
                                disabled={retryingId === item.id}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50"
                                title="重试"
                              >
                                {retryingId === item.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                重试
                              </button>
                            )}
                            {item.status === 'completed' && (
                              <button
                                onClick={() => handleDownload(item)}
                                disabled={expired}
                                className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg ${
                                  expired
                                    ? 'text-gray-300 cursor-not-allowed'
                                    : 'text-blue-600 hover:bg-blue-50'
                                }`}
                                title={expired ? '已过期' : '下载'}
                              >
                                <FileDown className="w-3 h-3" />
                                {expired ? '已过期' : '下载'}
                              </button>
                            )}
                            {item.status === 'processing' && (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <Clock className="w-3 h-3" />
                                处理中...
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 移动端列表 */}
            <div className="md:hidden divide-y divide-gray-50">
              {(data.items as ExportTaskItem[]).map((item) => {
                const expired = isExpired(item.expiredAt);
                return (
                  <div key={item._id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-800 text-sm block">
                          {TYPE_LABEL_MAP[item.type] ?? item.type}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">{item.id.slice(0, 8)}...</span>
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_MAP[item.status]?.icon}
                        {STATUS_MAP[item.status]?.label ?? item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 uppercase">{item.format}</span>
                      <span>{format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}</span>
                      <span>{formatFileSize(item.fileSize)}</span>
                    </div>
                    {item.status === 'completed' && item.expiredAt && (
                      <div className="mb-2">
                        {renderExpiry(item)}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {item.status === 'failed' && (
                        <button
                          onClick={() => handleRetry(item.id)}
                          disabled={retryingId === item.id}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 rounded-lg disabled:opacity-50"
                        >
                          {retryingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          重试
                        </button>
                      )}
                      {item.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(item)}
                          disabled={expired}
                          className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg ${
                            expired ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          {expired ? '已过期' : '下载'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 分页 */}
            {data.totalPages > 1 ? (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  共 {data.total} 条记录，第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, data.total)} 条
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    上一页
                  </button>
                  <span className="px-2 py-1 text-sm text-gray-600">
                    {page}/{data.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                    disabled={page === data.totalPages}
                    className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
                  >
                    下一页
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-4 border-t border-gray-100 text-center">
                <span className="text-sm text-gray-500">共 {data.total} 条记录</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExportCenterPage;
