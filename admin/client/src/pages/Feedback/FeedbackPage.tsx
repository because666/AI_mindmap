import React, { useState, useEffect, useCallback } from 'react';
import { feedbacksApi, adminAccountsApi } from '../../services/api';
import type { FeedbackListItem, FeedbackStats, FeedbackStatus, FeedbackType, InternalNote, PaginationResult } from '../../types';
import { MessageSquare, Clock, CheckCircle, TrendingUp, Search, Download, X, Eye, UserCheck, AlertTriangle, StickyNote } from 'lucide-react';
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
 * 包含工单分配、内部备注等扩展状态
 */
interface DetailModalState {
  visible: boolean;
  item: FeedbackListItem | null;
  newStatus: FeedbackStatus;
  saving: boolean;
  /** 工单分配 - 被分配人昵称 */
  assigneeInput: string;
  /** 工单分配 - SLA 时长（小时） */
  slaHoursInput: number;
  /** 分配操作进行中 */
  assigning: boolean;
  /** 内部备注列表 */
  notes: InternalNote[];
  /** 新备注内容 */
  newNoteContent: string;
  /** 备注操作进行中 */
  addingNote: boolean;
  /** 备注加载中 */
  notesLoading: boolean;
}

/**
 * 计算 SLA 剩余时间的返回类型
 */
interface SlaRemaining {
  /** 是否已超时 */
  overdue: boolean;
  /** 剩余毫秒数（超时为负数） */
  remainingMs: number;
  /** 格式化的剩余时间字符串 */
  display: string;
}

/**
 * 计算 SLA 剩余时间
 * 根据截止时间与当前时间差值，返回剩余时间信息
 * @param slaDeadline - SLA 截止时间的 ISO 字符串
 * @returns 包含超时状态、剩余毫秒数和格式化显示文本的对象
 */
function computeSlaRemaining(slaDeadline: string): SlaRemaining {
  const deadline = new Date(slaDeadline).getTime();
  const now = Date.now();
  const diff = deadline - now;
  const overdue = diff <= 0;
  const absDiff = Math.abs(diff);
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const display = overdue
    ? `已超时 ${hours}小时${minutes}分钟`
    : `${hours}小时${minutes}分钟`;
  return { overdue, remainingMs: diff, display };
}

/**
 * 反馈管理页面
 * 展示反馈统计数据、筛选条件、反馈列表、分页及详情弹窗
 * 支持按类型/状态/日期范围/关键词/被分配人筛选，支持导出、修改反馈状态
 * 支持工单分配、SLA 倒计时、内部备注功能
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
  /** 被分配人筛选 */
  const [assigneeFilter, setAssigneeFilter] = useState<string>('');

  /** 管理员昵称列表，用于工单分配下拉建议 */
  const [adminNicknames, setAdminNicknames] = useState<string[]>([]);

  const [detailModal, setDetailModal] = useState<DetailModalState>({
    visible: false,
    item: null,
    newStatus: 'pending',
    saving: false,
    assigneeInput: '',
    slaHoursInput: 48,
    assigning: false,
    notes: [],
    newNoteContent: '',
    addingNote: false,
    notesLoading: false,
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
   * 加载管理员昵称列表
   * 从管理员账户接口获取所有活跃管理员的昵称，用于工单分配下拉建议
   * 加载失败时不影响页面主流程
   */
  const loadAdminNicknames = useCallback(async () => {
    try {
      const res = await adminAccountsApi.getAccounts({ page: 1, limit: 100 });
      const responseData = res.data.data as { items: { nickname: string }[] };
      const nicknames = responseData.items.map((item) => item.nickname);
      setAdminNicknames(nicknames);
    } catch (error) {
      console.error('加载管理员昵称列表失败:', error);
    }
  }, []);

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
   * 根据当前筛选条件（含被分配人）和分页参数异步获取列表
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
        assignee: assigneeFilter || undefined,
      });
      setData(res.data.data as PaginationResult<FeedbackListItem>);
    } catch (error) {
      console.error('加载反馈列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, statusFilter, startDate, endDate, keyword, assigneeFilter]);

  useEffect(() => {
    loadStats();
    loadAdminNicknames();
  }, [loadStats, loadAdminNicknames]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  /**
   * 重置所有筛选条件
   * 清空类型、状态、日期范围、关键词、被分配人筛选，并重置页码为1
   */
  const handleReset = () => {
    setTypeFilter('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
    setKeyword('');
    setAssigneeFilter('');
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
   * 设置弹窗可见、当前反馈项数据，初始化状态、分配信息、备注
   * 同时异步加载该工单的内部备注列表
   * @param item - 要查看详情的反馈列表项
   */
  const openDetail = (item: FeedbackListItem) => {
    setDetailModal({
      visible: true,
      item,
      newStatus: item.status,
      saving: false,
      assigneeInput: item.assignee || '',
      slaHoursInput: item.slaHours || 48,
      assigning: false,
      notes: item.internalNotes || [],
      newNoteContent: '',
      addingNote: false,
      notesLoading: true,
    });
    feedbacksApi.getNotes(item._id)
      .then((res) => {
        const notesData = (res.data.data ?? []) as InternalNote[];
        setDetailModal((prev) => ({ ...prev, notes: notesData, notesLoading: false }));
      })
      .catch((error: unknown) => {
        console.error('加载备注失败:', error);
        setDetailModal((prev) => ({ ...prev, notesLoading: false }));
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
      assigneeInput: '',
      slaHoursInput: 48,
      assigning: false,
      notes: [],
      newNoteContent: '',
      addingNote: false,
      notesLoading: false,
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
   * 分配工单给指定管理员
   * 调用 assignFeedback API，成功后更新本地列表数据和弹窗状态
   * 失败时显示错误提示
   */
  const handleAssign = async () => {
    if (!detailModal.item) return;
    if (detailModal.assigning) return;
    if (!detailModal.assigneeInput.trim()) {
      showToast('error', '请输入被分配人昵称');
      return;
    }
    setDetailModal((prev) => ({ ...prev, assigning: true }));
    try {
      const res = await feedbacksApi.assignFeedback(
        detailModal.item._id,
        detailModal.assigneeInput.trim(),
        detailModal.slaHoursInput
      );
      const assignData = res.data.data as { assignee: string; assignedAt: string; slaHours: number; slaDeadline: string };
      showToast('success', '工单已分配');
      setDetailModal((prev) => ({
        ...prev,
        assigning: false,
        item: prev.item
          ? {
              ...prev.item,
              assignee: assignData.assignee,
              assignedAt: assignData.assignedAt,
              slaHours: assignData.slaHours,
              slaDeadline: assignData.slaDeadline,
            }
          : prev.item,
      }));
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((item) =>
            item._id === detailModal.item!._id
              ? {
                  ...item,
                  assignee: assignData.assignee,
                  assignedAt: assignData.assignedAt,
                  slaHours: assignData.slaHours,
                  slaDeadline: assignData.slaDeadline,
                }
              : item
          ),
        };
      });
    } catch (error) {
      console.error('分配工单失败:', error);
      showToast('error', '分配工单失败，请重试');
      setDetailModal((prev) => ({ ...prev, assigning: false }));
    }
  };

  /**
   * 添加内部备注
   * 调用 addNote API，成功后将新备注追加到本地备注列表
   * 失败时显示错误提示
   */
  const handleAddNote = async () => {
    if (!detailModal.item) return;
    if (detailModal.addingNote) return;
    if (!detailModal.newNoteContent.trim()) {
      showToast('error', '备注内容不能为空');
      return;
    }
    setDetailModal((prev) => ({ ...prev, addingNote: true }));
    try {
      const res = await feedbacksApi.addNote(detailModal.item._id, detailModal.newNoteContent.trim());
      const noteData = res.data.data as InternalNote;
      showToast('success', '备注已添加');
      setDetailModal((prev) => ({
        ...prev,
        addingNote: false,
        newNoteContent: '',
        notes: [...prev.notes, noteData],
      }));
    } catch (error) {
      console.error('添加备注失败:', error);
      showToast('error', '添加备注失败，请重试');
      setDetailModal((prev) => ({ ...prev, addingNote: false }));
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
   * 渲染 SLA 倒计时标签
   * 根据 slaDeadline 计算剩余时间，超时显示红色警告
   * @param slaDeadline - SLA 截止时间的 ISO 字符串
   * @returns React 节点
   */
  const renderSlaBadge = (slaDeadline: string | undefined): React.ReactNode => {
    if (!slaDeadline) return null;
    const sla = computeSlaRemaining(slaDeadline);
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
        sla.overdue ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
      }`}>
        {sla.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
        {sla.display}
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

          <div className="relative min-w-[150px]">
            <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="按被分配人筛选"
              value={assigneeFilter}
              onChange={(e) => { setAssigneeFilter(e.target.value); setPage(1); }}
              list="assignee-filter-list"
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="assignee-filter-list">
              {adminNicknames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
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
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">被分配人</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">SLA</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">联系方式</th>
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
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {item.assignee || <span className="text-gray-300">未分配</span>}
                      </td>
                      <td className="py-3 px-4">
                        {renderSlaBadge(item.slaDeadline)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500 max-w-[120px] truncate">{item.contact || '-'}</td>
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_MAP[item.type]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                      {item.type}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_MAP[item.status]?.className ?? 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_MAP[item.status]?.label ?? item.status}
                    </span>
                    {item.assignee && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600">
                        <UserCheck className="w-3 h-3" />
                        {item.assignee}
                      </span>
                    )}
                    {renderSlaBadge(item.slaDeadline)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {item.visitorIp && <span className="font-mono mr-2">IP:{item.visitorIp}</span>}
                    {format(new Date(item.createdAt), 'yyyy-MM-dd HH:mm')}
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

            {/* SLA 倒计时显示 */}
            {detailModal.item.slaDeadline && (
              <div className="border-t border-gray-100 pt-4 mb-4">
                <span className="text-xs font-medium text-gray-500 block mb-1">SLA 倒计时</span>
                <div className="flex items-center gap-2">
                  {renderSlaBadge(detailModal.item.slaDeadline)}
                  {detailModal.item.slaHours && (
                    <span className="text-xs text-gray-400">（限时 {detailModal.item.slaHours} 小时）</span>
                  )}
                </div>
                {detailModal.item.assignedAt && (
                  <p className="text-xs text-gray-400 mt-1">
                    分配时间：{format(new Date(detailModal.item.assignedAt), 'yyyy-MM-dd HH:mm:ss')}
                  </p>
                )}
              </div>
            )}

            {/* 工单分配区域 */}
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center gap-1 mb-2">
                <UserCheck className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">工单分配</span>
                {detailModal.item.assignee && (
                  <span className="text-xs text-indigo-600 ml-1">当前：{detailModal.item.assignee}</span>
                )}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 block mb-1">被分配人昵称</label>
                  <input
                    type="text"
                    value={detailModal.assigneeInput}
                    onChange={(e) => setDetailModal((prev) => ({ ...prev, assigneeInput: e.target.value }))}
                    list="assignee-modal-list"
                    placeholder="输入管理员昵称"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <datalist id="assignee-modal-list">
                    {adminNicknames.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div className="w-24">
                  <label className="text-xs text-gray-400 block mb-1">SLA（小时）</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={detailModal.slaHoursInput}
                    onChange={(e) => setDetailModal((prev) => ({ ...prev, slaHoursInput: Number(e.target.value) || 48 }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleAssign}
                  disabled={detailModal.assigning}
                  className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {detailModal.assigning ? '分配中...' : '分配'}
                </button>
              </div>
            </div>

            {/* 内部备注区域 */}
            <div className="border-t border-gray-100 pt-4 mb-4">
              <div className="flex items-center gap-1 mb-2">
                <StickyNote className="w-4 h-4 text-gray-500" />
                <span className="text-xs font-medium text-gray-500">内部备注</span>
                <span className="text-xs text-red-400 ml-1">（仅管理员可见）</span>
              </div>

              {detailModal.notesLoading ? (
                <div className="text-xs text-gray-400 py-2">加载备注中...</div>
              ) : detailModal.notes.length === 0 ? (
                <div className="text-xs text-gray-400 py-2">暂无备注</div>
              ) : (
                <div className="space-y-2 mb-3 max-h-[200px] overflow-y-auto">
                  {detailModal.notes.map((note, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-indigo-600">{note.author}</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(note.createdAt), 'yyyy-MM-dd HH:mm')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <textarea
                  value={detailModal.newNoteContent}
                  onChange={(e) => setDetailModal((prev) => ({ ...prev, newNoteContent: e.target.value }))}
                  placeholder="输入备注内容..."
                  rows={2}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <button
                  onClick={handleAddNote}
                  disabled={detailModal.addingNote}
                  className="px-4 py-2 text-sm text-white bg-gray-600 rounded-lg hover:bg-gray-700 disabled:opacity-50 whitespace-nowrap self-end"
                >
                  {detailModal.addingNote ? '添加中...' : '添加备注'}
                </button>
              </div>
            </div>

            {/* 修改状态 */}
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
