import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FileText, CheckCircle, XCircle, TrendingUp, Search, Download } from 'lucide-react';
import { format } from 'date-fns';
import { auditLogsApi } from '../../services/api';
import type { AuditLogListItem, AuditLogStats, PaginationResult } from '../../types';

/**
 * 操作结果标签映射
 * 键为操作结果，值为对应的中文标签和 TailwindCSS 样式类名
 */
const RESULT_MAP: Record<string, { label: string; className: string }> = {
  success: { label: '成功', className: 'bg-green-50 text-green-600' },
  failed: { label: '失败', className: 'bg-red-50 text-red-600' },
};

/**
 * 常见操作类型选项
 * 用于筛选器下拉框
 */
const ACTION_OPTIONS = [
  '登录系统',
  '退出登录',
  '封禁用户',
  '解封用户',
  '删除用户',
  '关闭工作区',
  '推送消息',
  '更新反馈状态',
  '更新敏感词配置',
  '更新功能开关',
  '添加IP白名单',
  '删除IP白名单',
  '封禁IP',
  '解封IP',
  '导出数据',
  '扫描对话',
  '标记安全',
  '删除消息',
];

/**
 * Toast 提示消息接口
 */
interface ToastMessage {
  type: 'success' | 'error';
  text: string;
}

/**
 * 审计日志页面
 * 展示审计日志统计数据、操作趋势图、筛选条件、日志列表、分页及导出功能
 * 支持按操作类型/管理员昵称/时间范围筛选，支持CSV导出
 */
const AuditLogsPage: React.FC = () => {
  const [stats, setStats] = useState<AuditLogStats | null>(null);
  const [data, setData] = useState<PaginationResult<AuditLogListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [actionFilter, setActionFilter] = useState<string>('');
  const [adminNickname, setAdminNickname] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

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
   * 加载审计日志统计数据
   * 异步获取统计数据，失败时在控制台输出错误信息
   */
  const loadStats = useCallback(async () => {
    try {
      const res = await auditLogsApi.getStats();
      setStats(res.data.data as AuditLogStats);
    } catch (error) {
      console.error('加载审计日志统计失败:', error);
    }
  }, []);

  /**
   * 加载审计日志列表数据
   * 根据当前筛选条件和分页参数异步获取列表
   * 加载失败时在控制台输出错误信息
   */
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditLogsApi.getLogs({
        page,
        pageSize,
        action: actionFilter || undefined,
        adminNickname: adminNickname || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setData(res.data.data as PaginationResult<AuditLogListItem>);
    } catch (error) {
      console.error('加载审计日志列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, actionFilter, adminNickname, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * 重置所有筛选条件
   * 清空操作类型、管理员昵称、时间范围筛选，并重置页码为1
   */
  const handleReset = () => {
    setActionFilter('');
    setAdminNickname('');
    setStartDate('');
    setEndDate('');
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
  };

  /**
   * 处理导出操作
   * 根据当前筛选条件导出审计日志为CSV文件
   * 导出成功时自动下载文件，失败时显示错误提示
   */
  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (actionFilter) params.set('action', actionFilter);
      if (adminNickname) params.set('adminNickname', adminNickname);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await auditLogsApi.exportCSV(params.toString());
      const blob = new Blob([res.data as BlobPart], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `审计日志_${format(new Date(), 'yyyy-MM-dd')}.csv`;
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

  /**
   * 获取趋势图数据
   * 将统计数据中的每日趋势转换为 Recharts 可用的格式
   */
  const chartData = stats?.dailyTrend.map((item) => ({
    date: item.date.slice(5),
    操作数: item.count,
  })) ?? [];

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.text}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-800 mb-6">审计日志</h1>

      {/* 统计卡片区 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {renderStatCard('总操作数', stats?.totalCount ?? 0, <FileText className="w-4 h-4" />, 'bg-blue-50 text-blue-600')}
        {renderStatCard('今日操作', stats?.todayCount ?? 0, <TrendingUp className="w-4 h-4" />, 'bg-purple-50 text-purple-600')}
        {renderStatCard('成功操作', stats?.successCount ?? 0, <CheckCircle className="w-4 h-4" />, 'bg-green-50 text-green-600')}
        {renderStatCard('失败操作', stats?.failedCount ?? 0, <XCircle className="w-4 h-4" />, 'bg-red-50 text-red-600')}
      </div>

      {/* 操作趋势图 */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-4">近30天操作趋势</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                formatter={(value: number) => [value, '操作数']}
              />
              <Bar dataKey="操作数" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 筛选栏 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <form onSubmit={handleSearch} className="p-4 flex flex-wrap gap-3 items-center">
          <select
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部操作</option>
            {ACTION_OPTIONS.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="按管理员昵称搜索"
              value={adminNickname}
              onChange={(e) => setAdminNickname(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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

      {/* 审计日志列表 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-400">暂无审计日志数据</div>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">时间</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">管理员</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">目标</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">结果</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-500 whitespace-nowrap">
                        {format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800">
                        <div>{item.adminNickname}</div>
                        <div className="text-xs text-gray-400 font-mono">{item.adminIp}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-800">{item.action}</td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        <div>{item.targetType}{item.targetId ? ` / ${item.targetId}` : ''}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_MAP[item.result]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                          {RESULT_MAP[item.result]?.label ?? item.result}
                        </span>
                        {item.result === 'failed' && item.errorMessage && (
                          <div className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={item.errorMessage}>
                            {item.errorMessage}
                          </div>
                        )}
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
                      <span className="font-medium text-gray-800 text-sm block">{item.action}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${RESULT_MAP[item.result]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                      {RESULT_MAP[item.result]?.label ?? item.result}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex items-center gap-2">
                      <span>{item.adminNickname}</span>
                      <span className="font-mono text-gray-400">{item.adminIp}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>{item.targetType}{item.targetId ? ` / ${item.targetId}` : ''}</span>
                    </div>
                    {item.result === 'failed' && item.errorMessage && (
                      <div className="text-red-400 truncate">{item.errorMessage}</div>
                    )}
                    <div className="text-gray-400">
                      {format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

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

export default AuditLogsPage;
