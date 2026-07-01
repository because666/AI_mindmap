import React, { useState, useEffect, useCallback } from 'react';
import { usersApi, userSegmentsApi } from '../../services/api';
import type { UserListItem, PaginationResult, TimelineEvent, ActivityTier, UserTag } from '../../types';
import { Search, Ban, Unlock, Eye, Globe, X, ShieldBan, PlusCircle, MessageSquare, Lightbulb, Download, ChevronDown, ChevronUp } from 'lucide-react';

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

/** 用户详情弹窗中的标签页类型 */
type DetailTab = 'detail' | 'timeline';

/**
 * 活跃度分层徽章配置映射
 * 定义每个分层对应的展示文本与彩色徽章样式
 * 新用户=蓝、高活跃=绿、流失风险=橙、沉睡=灰
 */
const ACTIVITY_TIER_CONFIG: Record<ActivityTier, { label: string; className: string }> = {
  new_user: { label: '新用户', className: 'bg-blue-50 text-blue-600' },
  high_active: { label: '高活跃', className: 'bg-green-50 text-green-600' },
  churn_risk: { label: '流失风险', className: 'bg-orange-50 text-orange-600' },
  dormant: { label: '沉睡', className: 'bg-gray-100 text-gray-500' },
};

/**
 * 未知活跃度分层的兜底徽章配置
 * 当 user.activityTier 为异常值（undefined/未知字符串）时使用，避免渲染崩溃
 */
const UNKNOWN_TIER_CONFIG: { label: string; className: string } = {
  label: '未知',
  className: 'bg-gray-100 text-gray-500',
};

/**
 * 安全获取指定活跃度分层对应的徽章配置
 * 当 activityTier 未匹配到已知分层时，返回 UNKNOWN_TIER_CONFIG 兜底
 * @param tier - 活跃度分层值（可能为异常值）
 * @returns 徽章配置对象，保证总有 label 与 className
 */
function getTierConfig(tier: ActivityTier | string | undefined | null): { label: string; className: string } {
  if (tier && Object.prototype.hasOwnProperty.call(ACTIVITY_TIER_CONFIG, tier as ActivityTier)) {
    return ACTIVITY_TIER_CONFIG[tier as ActivityTier];
  }
  return UNKNOWN_TIER_CONFIG;
}

/**
 * 活跃度分层下拉选项配置
 * 用于筛选器中的下拉选择
 */
const ACTIVITY_TIER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部活跃度' },
  { value: 'new_user', label: '新用户' },
  { value: 'high_active', label: '高活跃' },
  { value: 'churn_risk', label: '流失风险' },
  { value: 'dormant', label: '沉睡' },
];

/**
 * 时间线事件类型配置映射
 * 定义每种事件类型的图标颜色、标签文本和图标组件
 */
const TIMELINE_EVENT_CONFIG: Record<string, { color: string; bgColor: string; label: string; Icon: React.FC<{ className?: string }> }> = {
  node_created: { color: 'text-blue-600', bgColor: 'bg-blue-50', label: '节点创建', Icon: PlusCircle },
  conversation: { color: 'text-green-600', bgColor: 'bg-green-50', label: '对话', Icon: MessageSquare },
  conclusion: { color: 'text-purple-600', bgColor: 'bg-purple-50', label: '结论提炼', Icon: Lightbulb },
  export: { color: 'text-orange-600', bgColor: 'bg-orange-50', label: '导出', Icon: Download },
};

/**
 * 时间线事件项组件
 * 展示单个时间线事件，支持点击展开查看详情
 * @param event - 时间线事件数据
 */
const TimelineEventItem: React.FC<{ event: TimelineEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  const config = TIMELINE_EVENT_CONFIG[event.type];
  if (!config) return null;

  const { color, bgColor, label, Icon } = config;

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  const hasDetail = event.detail.nodeId || event.detail.messagePreview || event.detail.exportType;

  return (
    <div className="flex gap-3 group">
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="w-px flex-1 bg-gray-200 mt-1" />
      </div>
      <div className="pb-6 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${bgColor} ${color}`}>{label}</span>
          <span className="text-xs text-gray-400">{formatTime(event.timestamp)}</span>
        </div>
        <div className="mt-1">
          {event.type === 'node_created' && event.detail.nodeTitle && (
            <p className="text-sm text-gray-700 truncate">{event.detail.nodeTitle}</p>
          )}
          {event.type === 'conclusion' && event.detail.nodeTitle && (
            <p className="text-sm text-gray-700 truncate">{event.detail.nodeTitle}</p>
          )}
          {event.type === 'conversation' && event.detail.messagePreview && (
            <p className="text-sm text-gray-500 truncate">{event.detail.messagePreview}</p>
          )}
          {event.type === 'export' && event.detail.exportType && (
            <p className="text-sm text-gray-500">格式：{event.detail.exportType}</p>
          )}
        </div>
        {hasDetail && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? '收起详情' : '查看详情'}
          </button>
        )}
        {expanded && hasDetail && (
          <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
            {event.detail.nodeId && (
              <p>节点ID：<span className="font-mono">{event.detail.nodeId}</span></p>
            )}
            {event.detail.nodeTitle && (
              <p>节点标题：<span className="font-medium">{event.detail.nodeTitle}</span></p>
            )}
            {event.detail.messagePreview && (
              <p>消息预览：<span>{event.detail.messagePreview}</span></p>
            )}
            {event.detail.exportType && (
              <p>导出格式：<span>{event.detail.exportType}</span></p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const UsersPage: React.FC = () => {
  const [data, setData] = useState<PaginationResult<UserListItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  /** 活跃度分层筛选值，空字符串表示不筛选 */
  const [activityTier, setActivityTier] = useState<string>('');
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

  /** 用户详情弹窗状态 */
  const [detailModal, setDetailModal] = useState<UserListItem | null>(null);
  /** 详情弹窗当前标签页 */
  const [detailTab, setDetailTab] = useState<DetailTab>('detail');
  /** 时间线事件列表 */
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  /** 时间线加载状态 */
  const [timelineLoading, setTimelineLoading] = useState(false);
  /** 时间线分页信息 */
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineTotalPages, setTimelineTotalPages] = useState(1);
  const [timelineTotal, setTimelineTotal] = useState(0);

  // 标签筛选相关状态
  /** 所有标签列表，用于筛选下拉框与详情弹窗的标签管理 */
  const [tags, setTags] = useState<UserTag[]>([]);
  /** 当前选中的标签筛选 ID，空字符串表示不按标签筛选 */
  const [selectedTagId, setSelectedTagId] = useState<string>('');
  // 用户标签管理状态（详情弹窗中）
  /** 当前详情弹窗用户的标签 ID 列表 */
  const [userTags, setUserTags] = useState<string[]>([]);
  /** 用户标签加载状态 */
  const [userTagsLoading, setUserTagsLoading] = useState(false);
  /** 详情弹窗中"添加标签"下拉框的当前选中值 */
  const [addTagSelectId, setAddTagSelectId] = useState('');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  /**
   * 加载所有标签列表，用于筛选下拉框与详情弹窗
   */
  const loadTags = useCallback(async () => {
    try {
      const res = await userSegmentsApi.listTags();
      setTags(res.data.data as UserTag[]);
    } catch (error) {
      console.error('加载标签列表失败:', error);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, activityTier, selectedTagId]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      // 如果选了标签筛选，走标签筛选接口
      if (selectedTagId) {
        const res = await userSegmentsApi.getUsersByTag(selectedTagId, page, 20);
        setData(res.data.data as PaginationResult<UserListItem>);
      } else {
        const res = await usersApi.getList({
          page,
          limit: 20,
          status: statusFilter || undefined,
          search: search || undefined,
          activityTier: activityTier || undefined,
        });
        setData(res.data.data as PaginationResult<UserListItem>);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载用户时间线数据
   * @param userId - 用户ID
   * @param pageNum - 页码
   */
  const loadTimeline = useCallback(async (userId: string, pageNum: number) => {
    setTimelineLoading(true);
    try {
      const res = await usersApi.getUserTimeline(userId, { page: pageNum, limit: 20 });
      const result = res.data.data;
      if (result) {
        setTimelineEvents(result.items);
        setTimelineTotalPages(result.totalPages);
        setTimelineTotal(result.total);
        setTimelinePage(pageNum);
      }
    } catch (error) {
      console.error('加载用户轨迹失败:', error);
      setTimelineEvents([]);
      showToast('error', '加载用户轨迹失败');
    } finally {
      setTimelineLoading(false);
    }
  }, []);

  /**
   * 打开用户详情弹窗
   * 同时加载该用户的标签列表用于标签管理区域展示
   * @param user - 用户列表项数据
   */
  const openDetailModal = (user: UserListItem) => {
    setDetailModal(user);
    setDetailTab('detail');
    setTimelineEvents([]);
    setTimelinePage(1);
    setTimelineTotalPages(1);
    setTimelineTotal(0);
    setAddTagSelectId('');
    loadUserTags(user.id);
  };

  /** 关闭用户详情弹窗 */
  const closeDetailModal = () => {
    setDetailModal(null);
    setTimelineEvents([]);
    setUserTags([]);
    setAddTagSelectId('');
  };

  /**
   * 加载指定用户的标签列表
   * 从当前用户列表数据中读取对应用户的 tags 字段
   * @param userId - 用户 ID
   */
  const loadUserTags = async (userId: string) => {
    setUserTagsLoading(true);
    try {
      // 从用户数据中读取 tags 字段
      const user = data?.items.find(u => u.id === userId);
      if (user?.tags) {
        setUserTags(user.tags);
      } else {
        setUserTags([]);
      }
    } finally {
      setUserTagsLoading(false);
    }
  };

  /**
   * 为用户添加标签
   * 调用后端接口将标签绑定到用户，成功后更新本地状态并刷新用户列表
   * @param userId - 用户 ID
   * @param tagId - 标签 ID
   */
  const handleAddTag = async (userId: string, tagId: string) => {
    if (!tagId) return;
    try {
      await userSegmentsApi.addTagToUser(userId, tagId);
      setUserTags(prev => [...prev, tagId]);
      setAddTagSelectId('');
      showToast('success', '标签已添加');
      // 刷新用户列表以更新 tags 字段
      loadUsers();
    } catch (error) {
      console.error('添加标签失败:', error);
      showToast('error', '添加标签失败');
    }
  };

  /**
   * 为用户移除标签
   * 调用后端接口解除标签绑定，成功后更新本地状态并刷新用户列表
   * @param userId - 用户 ID
   * @param tagId - 标签 ID
   */
  const handleRemoveTag = async (userId: string, tagId: string) => {
    try {
      await userSegmentsApi.removeTagFromUser(userId, tagId);
      setUserTags(prev => prev.filter(t => t !== tagId));
      showToast('success', '标签已移除');
      loadUsers();
    } catch (error) {
      console.error('移除标签失败:', error);
      showToast('error', '移除标签失败');
    }
  };

  /**
   * 切换详情弹窗标签页
   * 切换到轨迹标签页时自动加载第一页数据
   * @param tab - 目标标签页
   */
  const handleTabChange = (tab: DetailTab) => {
    setDetailTab(tab);
    if (tab === 'timeline' && detailModal) {
      loadTimeline(detailModal.id, 1);
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
    // 封禁原因非空校验，避免无原因封禁
    if (!banReason.trim()) {
      showToast('error', '请填写封禁原因');
      return;
    }
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
          <select
            value={activityTier}
            onChange={(e) => { setActivityTier(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            aria-label="按活跃度筛选"
          >
            {ACTIVITY_TIER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <select
            value={selectedTagId}
            onChange={(e) => { setSelectedTagId(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            aria-label="按标签筛选"
          >
            <option value="">全部用户</option>
            {tags.map((tag) => (
              <option key={tag._id} value={tag._id}>{tag.name}</option>
            ))}
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
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">活跃度</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">工作区</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => {
                    const tierConfig = getTierConfig(user.activityTier);
                    return (
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
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tierConfig.className}`}>
                          {tierConfig.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">{user.stats.workspaceCount}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button onClick={() => openDetailModal(user)} className="p-1 text-gray-400 hover:text-blue-600" title="查看">
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
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-gray-50">
              {data.items.map((user) => {
                const tierConfig = getTierConfig(user.activityTier);
                return (
                <div key={user._id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-medium text-gray-800">{user.nickname}</span>
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {user.isBanned ? '封禁' : '正常'}
                      </span>
                      <span className={`ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tierConfig.className}`}>
                        {tierConfig.label}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openDetailModal(user)} className="text-xs text-blue-600">详情</button>
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
                );
              })}
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

      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={closeDetailModal}>
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{detailModal.nickname}</h3>
                <p className="text-xs text-gray-500 mt-0.5">ID: {detailModal.id}</p>
              </div>
              <button onClick={closeDetailModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="flex border-b border-gray-100 flex-shrink-0">
              <button
                onClick={() => handleTabChange('detail')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === 'detail'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                详情
              </button>
              <button
                onClick={() => handleTabChange('timeline')}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  detailTab === 'timeline'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                轨迹
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {detailTab === 'detail' && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">状态</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        detailModal.isBanned ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                      }`}>
                        {detailModal.isBanned ? '封禁' : '正常'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">注册时间</p>
                      <p className="text-sm text-gray-800">{new Date(detailModal.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">最后活跃</p>
                      <p className="text-sm text-gray-800">{new Date(detailModal.lastActiveAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">IP地址</p>
                      {detailModal.lastIp ? (
                        <button
                          onClick={() => { closeDetailModal(); handleIpClick(detailModal.lastIp!); }}
                          className="text-sm text-blue-600 hover:underline font-mono"
                        >
                          {detailModal.lastIp}
                        </button>
                      ) : (
                        <p className="text-sm text-gray-400">未记录</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">工作区数</p>
                      <p className="text-sm text-gray-800">{detailModal.stats.workspaceCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">节点数</p>
                      <p className="text-sm text-gray-800">{detailModal.stats.nodeCount}</p>
                    </div>
                  </div>
                  {detailModal.isBanned && detailModal.banReason && (
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-red-500 font-medium mb-1">封禁原因</p>
                      <p className="text-sm text-red-700">{detailModal.banReason}</p>
                    </div>
                  )}
                  {/* 标签管理区域 */}
                  <div className="border-t pt-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">用户标签</h4>
                    {userTagsLoading ? (
                      <p className="text-sm text-gray-400">加载中...</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {userTags.length === 0 && <span className="text-sm text-gray-400">暂无标签</span>}
                        {userTags.map((tagId) => {
                          const tag = tags.find(t => t._id === tagId);
                          if (!tag) return null;
                          return (
                            <span key={tagId} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                              {tag.name}
                              <button onClick={() => { if (detailModal) handleRemoveTag(detailModal.id, tagId); }} className="hover:opacity-70">×</button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <select
                        value={addTagSelectId}
                        onChange={(e) => setAddTagSelectId(e.target.value)}
                        className="flex-1 px-2 py-1 border rounded text-sm"
                      >
                        <option value="">选择标签...</option>
                        {tags.filter(t => !userTags.includes(t._id)).map((tag) => (
                          <option key={tag._id} value={tag._id}>{tag.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => { if (detailModal) handleAddTag(detailModal.id, addTagSelectId); }}
                        disabled={!addTagSelectId}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'timeline' && (
                <div className="p-4">
                  {timelineLoading ? (
                    <div className="py-8 text-center text-gray-400">加载轨迹中...</div>
                  ) : timelineEvents.length === 0 ? (
                    <div className="py-8 text-center text-gray-400">暂无轨迹数据</div>
                  ) : (
                    <>
                      <div className="mb-3 text-xs text-gray-500">共 {timelineTotal} 条活动记录</div>
                      <div>
                        {timelineEvents.map((event, index) => (
                          <TimelineEventItem key={`${event.type}-${event.timestamp}-${index}`} event={event} />
                        ))}
                      </div>
                      {timelineTotalPages > 1 && (
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-center gap-2">
                          <button
                            onClick={() => { if (detailModal) loadTimeline(detailModal.id, timelinePage - 1); }}
                            disabled={timelinePage === 1}
                            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                          >
                            上一页
                          </button>
                          <span className="px-3 py-1 text-sm text-gray-500">
                            {timelinePage}/{timelineTotalPages}
                          </span>
                          <button
                            onClick={() => { if (detailModal) loadTimeline(detailModal.id, timelinePage + 1); }}
                            disabled={timelinePage === timelineTotalPages}
                            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50"
                          >
                            下一页
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
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
