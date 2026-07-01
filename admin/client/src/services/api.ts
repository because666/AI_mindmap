import axios from 'axios';
import type {
  SegmentRule,
  GrayRule,
  AIProvider,
  AIModelConfig,
  AIModelConfigInput,
  AIModelUsageSummaryItem,
  EventOverviewData,
  EventTrendData,
  EventFunnelData,
  RecentEventItem,
  FeatureAdoptionData,
  OnlineStatusData,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    return Promise.reject(error);
  }
);

function typedGet<T>(url: string, config?: Record<string, unknown>) {
  return api.get<ApiResponse<T>>(url, config);
}

function typedPost<T>(url: string, data?: unknown, config?: Record<string, unknown>) {
  return api.post<ApiResponse<T>>(url, data, config);
}

function typedPut<T>(url: string, data?: unknown, config?: Record<string, unknown>) {
  return api.put<ApiResponse<T>>(url, data, config);
}

function typedDelete<T>(url: string, config?: Record<string, unknown>) {
  return api.delete<ApiResponse<T>>(url, config);
}

function typedPatch<T>(url: string, data?: unknown, config?: Record<string, unknown>) {
  return api.patch<ApiResponse<T>>(url, data, config);
}

export const authApi = {
  checkIp: () => typedGet<{ allowed: boolean; isFirstVisit: boolean; hasPassword: boolean; enableHoneypot: boolean; nickname?: string }>('/auth/check-ip'),
  init: (password: string, confirmPassword: string) =>
    typedPost<{ ipAddress: string }>('/auth/init', { password, confirmPassword }),
  login: (password: string) =>
    typedPost<{ needNickname: boolean; isHoneypot?: boolean; sessionId?: string; nickname?: string }>('/auth/login', { password }),
  realLogin: (password: string) =>
    typedPost<{ needNickname: boolean; sessionId?: string; nickname?: string }>('/auth/real-login', { password }),
  setNickname: (nickname: string) =>
    typedPost<{ sessionId: string }>('/auth/set-nickname', { nickname }),
  logout: () => typedPost<void>('/auth/logout'),
  me: () => typedGet<{ ipAddress: string; nickname: string; loginAt: string }>('/auth/me'),
};

export const honeypotApi = {
  myStats: () => typedGet<{
    ipAddress: string;
    loginAttempts: number;
    attemptedPasswords: string[];
    firstAttemptAt: string | null;
    lastAttemptAt: string | null;
    totalAttackers: number;
    rank: number;
  }>('/honeypot/my-stats'),
  recentLogs: (limit?: number) => typedGet<{
    logs: Array<{
      ipAddress: string;
      loginAttempts: number;
      attemptedPasswords: string[];
      firstAttemptAt: string;
      lastAttemptAt: string;
    }>;
    totalAttackers: number;
    totalAttempts: number;
    topPasswords: Array<{ password: string; count: number }>;
  }>('/honeypot/recent-logs', { params: { limit } }),
  verifyQuestion: (answer: string) =>
    typedPost<{ question: string }>('/honeypot/verify-question', { answer }),
  getQuestion: () => typedGet<{ question: string; enableHoneypot: boolean }>('/honeypot/question'),
  getAttackLogs: (params: { page?: number; limit?: number }) =>
    typedGet<{
      items: unknown[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/honeypot/admin/attack-logs', { params }),
  updateSecurityConfig: (data: { secretQuestion?: string; secretAnswer?: string; enableHoneypot?: boolean }) =>
    typedPut<void>('/honeypot/admin/security-config', data),
  deleteAttackLogs: (ipAddress?: string) =>
    typedDelete<void>('/honeypot/admin/attack-logs', { data: { ipAddress } }),
};

export const dashboardApi = {
  getStats: () => typedGet<unknown>('/dashboard/stats'),
  getTrends: (type: string, days: number) =>
    typedGet<{ dates: string[]; values: number[] }>('/dashboard/trends', { params: { type, days } }),
  getRetentionTrends: (days: number = 30) =>
    typedGet<{
      dates: string[];
      dau: number[];
      wau: number[];
      mau: number[];
      nextDayRetention: number[];
      day7Retention: number[];
      day30Retention: number[];
    }>('/dashboard/retention', { params: { days } }),
  getConversionFunnel: () =>
    typedGet<{
      steps: Array<{ name: string; count: number; rate: number }>;
    }>('/dashboard/funnel'),
  /**
   * 获取用户行为事件概览
   * @returns 事件总量、今日事件数、独立访客数
   */
  getEventOverview: () => typedGet<EventOverviewData>('/dashboard/events/overview'),
  /**
   * 获取用户行为事件趋势
   * @param days - 统计天数，默认7天
   * @param eventType - 事件类型筛选，为空时统计全部事件
   * @returns 按日聚合的事件趋势数据
   */
  getEventTrend: (days: number = 7, eventType: string = '') =>
    typedGet<EventTrendData>('/dashboard/events/trend', { params: { days, eventType } }),
  /**
   * 获取关键事件漏斗
   * @returns 注册→完成引导→创建地图→创建分支→生成摘要的转化数据
   */
  getEventFunnel: () => typedGet<EventFunnelData>('/dashboard/events/funnel'),
  /**
   * 获取最近事件列表
   * @param limit - 返回数量，默认20条
   * @returns 最近事件列表
   */
  getRecentEvents: (limit: number = 20) =>
    typedGet<RecentEventItem[]>('/dashboard/events/recent', { params: { limit } }),
  /**
   * 获取功能采用矩阵数据
   * @param days - 统计天数，默认7天，范围1-90
   * @returns 各功能采用率与总独立访客数
   */
  getFeatureAdoption: (days: number = 7) =>
    typedGet<FeatureAdoptionData>('/dashboard/feature-adoption', { params: { days } }),
  /**
   * 获取实时在线状态数据
   * @returns 当前在线用户数和最近 30 分钟活跃曲线
   */
  getOnlineStatus: () =>
    typedGet<OnlineStatusData>('/dashboard/online-status'),
};

export const usersApi = {
  getList: (params: { page?: number; limit?: number; status?: string; search?: string; activityTier?: string }) =>
    typedGet<unknown>('/admin/users', { params }),
  getDetail: (id: string) => typedGet<unknown>(`/admin/users/${id}`),
  /**
   * 获取用户消息轨迹时间线
   * @param id - 用户ID
   * @param params - 分页参数
   * @returns 分页的时间线事件列表
   */
  getUserTimeline: (id: string, params: { page?: number; limit?: number }) =>
    typedGet<{
      items: Array<{
        type: 'node_created' | 'conversation' | 'conclusion' | 'export';
        timestamp: string;
        detail: {
          nodeId?: string;
          nodeTitle?: string;
          messagePreview?: string;
          exportType?: string;
        };
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/admin/users/${id}/timeline`, { params }),
  ban: (id: string, reason: string, duration: number) =>
    typedPost<void>(`/admin/users/${id}/ban`, { reason, duration }),
  unban: (id: string, reason: string) =>
    typedPost<void>(`/admin/users/${id}/unban`, { reason }),
  delete: (id: string, confirmCode: string) =>
    typedDelete<void>(`/admin/users/${id}`, { headers: { 'X-Confirm-Code': confirmCode } }),
  getIpVisitors: (ip: string) =>
    typedGet<{ ip: string; visitors: unknown[]; total: number }>(`/admin/users/ip/${ip}/visitors`),
  banIp: (ip: string, reason: string, duration: number, autoBanAccounts: boolean) =>
    typedPost<{ ip: string; bannedVisitors: number }>('/admin/users/ip-ban', { ip, reason, duration, autoBanAccounts }),
};

export const ipBansApi = {
  getList: (params: { page?: number; limit?: number; search?: string }) =>
    typedGet<unknown>('/admin/ip-bans', { params }),
  getDetail: (ip: string) => typedGet<unknown>(`/admin/ip-bans/${ip}`),
  unban: (ip: string, reason?: string) =>
    typedPost<void>(`/admin/ip-bans/${ip}/unban`, { reason }),
};

export const workspacesApi = {
  getList: (params: { page?: number; limit?: number; search?: string }) =>
    typedGet<unknown>('/admin/workspaces', { params }),
  getDetail: (id: string) => typedGet<unknown>(`/admin/workspaces/${id}`),
  getContent: (id: string) => typedGet<unknown>(`/admin/workspaces/${id}/content`),
  close: (id: string, reason: string) =>
    typedPost<void>(`/admin/workspaces/${id}/close`, { reason }),
  notify: (id: string, title: string, content: string) =>
    typedPost<void>(`/admin/workspaces/${id}/notify`, { title, content }),
  /**
   * 获取工作区排行榜数据
   * @param params.sortBy - 排序维度，默认 nodeCount
   * @param params.limit - 返回数量，默认 20
   * @returns WorkspaceRankingItem[] 排行列表
   */
  getRanking: (params: { sortBy?: string; limit?: number }) =>
    typedGet<unknown>('/admin/workspaces/ranking', { params }),
  /**
   * 切换工作区特别关注标记
   * @param id - 工作区 ID
   * @param starred - 是否特别关注
   */
  toggleStar: (id: string, starred: boolean) =>
    typedPut<void>(`/admin/workspaces/${id}/star`, { starred }),
  /**
   * 置顶工作区
   * 将指定工作区标记为推荐工作区，使其在客户端"推荐工作区"区域优先展示
   * @param id - 工作区 ID
   * @returns 成功时返回最新 isPinned/pinnedAt 状态
   */
  pinWorkspace: (id: string) =>
    typedPost<{ isPinned: boolean; pinnedAt: string }>(`/admin/workspaces/${id}/pin`),
  /**
   * 取消置顶工作区
   * 清除指定工作区的推荐标记，使其不再在客户端"推荐工作区"区域展示
   * @param id - 工作区 ID
   * @returns 成功时返回 isPinned:false 与 pinnedAt:null
   */
  unpinWorkspace: (id: string) =>
    typedDelete<{ isPinned: boolean; pinnedAt: null }>(`/admin/workspaces/${id}/pin`),
  /**
   * 封禁工作区
   * 将指定工作区标记为封禁状态，主服务端将拦截对该工作区的访问
   * @param id - 工作区 ID
   * @param reason - 封禁原因
   * @param duration - 封禁时长（小时），0 表示永久封禁
   */
  banWorkspace: (id: string, reason: string, duration: number) =>
    typedPost<void>(`/admin/workspaces/${id}/ban`, { reason, duration }),
  /**
   * 解封工作区
   * 清除指定工作区的封禁标记，恢复访问
   * @param id - 工作区 ID
   */
  unbanWorkspace: (id: string) =>
    typedPost<void>(`/admin/workspaces/${id}/unban`),
};

export const auditApi = {
  getConfig: () => typedGet<unknown>('/admin/audit/config'),
  updateConfig: (config: Record<string, unknown>) => typedPut<void>('/admin/audit/config', config),
  getMessages: (params: { page?: number; limit?: number; riskLevel?: string; status?: string }) =>
    typedGet<unknown>('/admin/audit/messages', { params }),
  scan: (startTime: string, endTime: string) =>
    typedPost<unknown>('/admin/audit/scan', { startTime, endTime }),
  markSafe: (id: string, reason: string) =>
    typedPost<void>(`/admin/audit/${id}/mark-safe`, { reason }),
  deleteMessage: (id: string, reason: string) =>
    typedDelete<void>(`/admin/audit/${id}/message`, { data: { reason } }),
  getConversations: (params: { page?: number; limit?: number; search?: string; workspaceId?: string }) =>
    typedGet<unknown>('/admin/audit/conversations', { params }),
  getConversationDetail: (id: string) =>
    typedGet<unknown>(`/admin/audit/conversations/${id}`),
  /**
   * 删除指定消息（按消息 ID 删除，迁移后不再依赖对话 ID 与数组索引）
   * @param messageId - 消息 UUID
   * @param reason - 删除原因
   */
  deleteConversationMessage: (messageId: string, reason: string) =>
    typedDelete<void>(`/admin/audit/messages/${messageId}`, { data: { reason } }),
};

export const pushApi = {
  broadcast: (data: {
    title: string;
    content: string;
    targetType?: string;
    targetUserIds?: string[];
    forceRead?: boolean;
    displayType?: 'banner' | 'dot';
  }) => typedPost<{ messageId: string }>('/admin/push/broadcast', data),
  getMessages: (params: { page?: number; limit?: number }) =>
    typedGet<unknown>('/admin/push/messages', { params }),
  getStats: (id: string) => typedGet<unknown>(`/admin/push/messages/${id}/stats`),
};

export const settingsApi = {
  getIpWhitelist: () => typedGet<{ whitelist: unknown[]; currentIp: string }>('/admin/settings/ip-whitelist'),
  addIp: (ipAddress: string, nickname: string, description?: string) =>
    typedPost<void>('/admin/settings/ip-whitelist', { ipAddress, nickname, description }),
  removeIp: (ip: string, confirm?: boolean) =>
    typedDelete<void>(`/admin/settings/ip-whitelist/${ip}`, { data: { confirm } }),
  changePassword: (oldPassword: string, newPassword: string, confirmPassword: string) =>
    typedPost<void>('/admin/settings/password', { oldPassword, newPassword, confirmPassword }),
  getFeatures: () => typedGet<unknown>('/admin/settings/features'),
  /**
   * 更新功能开关（含灰度规则）
   * @param features - 功能开关数据，包含 enabled 状态和 grayRules
   */
  updateFeatures: (features: Record<string, unknown>) =>
    typedPut<void>('/admin/settings/features', features),
  /**
   * 评估指定功能对特定用户的可见性
   * @param key - 功能开关键名
   * @param params - 评估参数，包含 userId/ip/workspaceId
   * @returns 评估结果，包含 visible 和 reason
   */
  evaluateFeature: (key: string, params: { userId?: string; ip?: string; workspaceId?: string }) =>
    typedGet<{ key: string; visible: boolean; reason: string }>(`/admin/settings/features/${key}/evaluate`, { params }),
  /**
   * 获取 AI 服务商配置列表
   * @returns AIProvider 数组
   */
  getAIProviders: () =>
    typedGet<AIProvider[]>('/admin/settings/ai-providers'),
  /**
   * 保存 AI 服务商配置
   * @param providers - AI 服务商配置列表
   */
  updateAIProviders: (providers: AIProvider[]) =>
    typedPut<void>('/admin/settings/ai-providers', providers),
};

export const feedbacksApi = {
  getList: (params: { page?: number; pageSize?: number; type?: string; status?: string; startDate?: string; endDate?: string; keyword?: string; assignee?: string }) =>
    typedGet<unknown>('/admin/feedbacks', { params }),
  getStats: () =>
    typedGet<unknown>('/admin/feedbacks/stats'),
  updateStatus: (id: string, status: string) =>
    typedPatch<void>(`/admin/feedbacks/${id}/status`, { status }),
  export: (params: { type?: string; status?: string; startDate?: string; endDate?: string }) =>
    api.post('/admin/feedbacks/export', params, { responseType: 'blob' }),
  /**
   * 分配反馈工单给指定管理员
   * @param id - 反馈ID
   * @param assignee - 被分配人昵称
   * @param slaHours - SLA 时长（小时），默认 48
   * @returns 分配结果，包含 assignee、assignedAt、slaHours、slaDeadline
   */
  assignFeedback: (id: string, assignee: string, slaHours?: number) =>
    typedPut<{ assignee: string; assignedAt: string; slaHours: number; slaDeadline: string }>(`/admin/feedbacks/${id}/assign`, { assignee, slaHours }),
  /**
   * 添加内部备注
   * @param id - 反馈ID
   * @param content - 备注内容
   * @returns 新增的备注数据，包含 content、author、createdAt
   */
  addNote: (id: string, content: string) =>
    typedPost<{ content: string; author: string; createdAt: string }>(`/admin/feedbacks/${id}/notes`, { content }),
  /**
   * 获取内部备注列表
   * @param id - 反馈ID
   * @returns 备注列表
   */
  getNotes: (id: string) =>
    typedGet<unknown>(`/admin/feedbacks/${id}/notes`),
};

export const aiUsageApi = {
  getStats: (params?: { startDate?: string; endDate?: string; model?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.model) query.set('model', params.model);
    return typedGet<unknown>(`/admin/ai-usage/stats?${query.toString()}`);
  },
  getTrends: (params: { startDate: string; endDate: string; granularity: string; model?: string }) => {
    const query = new URLSearchParams();
    query.set('startDate', params.startDate);
    query.set('endDate', params.endDate);
    query.set('granularity', params.granularity);
    if (params.model) query.set('model', params.model);
    return typedGet<unknown>(`/admin/ai-usage/trends?${query.toString()}`);
  },
  getModelDistribution: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return typedGet<unknown>(`/admin/ai-usage/model-distribution?${query.toString()}`);
  },
  /**
   * 获取模型用量汇总
   * 按模型维度聚合统计调用量、token 消耗、失败率
   * @param params - 起始/结束日期，可选
   * @returns AIModelUsageSummaryItem 数组
   */
  getModelSummary: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    return typedGet<AIModelUsageSummaryItem[]>(`/admin/ai-usage/model-summary?${query.toString()}`);
  },
  getQueueStatus: () => typedGet<unknown>('/admin/ai-usage/queue-status'),
  exportCSV: (params?: { startDate?: string; endDate?: string; model?: string }) => {
    const query = new URLSearchParams();
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.model) query.set('model', params.model);
    return api.get(`/admin/ai-usage/export?${query.toString()}`, { responseType: 'blob' });
  },
};

/**
 * AI 模型管理 API
 * 提供模型配置的增删改查与默认模型设置
 */
export const aiModelApi = {
  /**
   * 获取所有模型配置列表
   * 返回数据中 apiKey 已做掩码处理
   */
  getAll: () => typedGet<AIModelConfig[]>('/admin/ai-models'),
  /**
   * 创建新的模型配置
   * @param data - 模型配置数据
   * @returns 新创建的模型 ID
   */
  create: (data: AIModelConfigInput) =>
    typedPost<{ id: string }>('/admin/ai-models', data),
  /**
   * 更新指定模型配置
   * @param id - 模型 ID
   * @param data - 待更新的字段
   */
  update: (id: string, data: Partial<AIModelConfigInput>) =>
    typedPut<void>(`/admin/ai-models/${id}`, data),
  /**
   * 删除指定模型配置
   * @param id - 模型 ID
   */
  delete: (id: string) => typedDelete<void>(`/admin/ai-models/${id}`),
  /**
   * 将指定模型设置为默认模型
   * @param id - 模型 ID
   */
  setDefault: (id: string) =>
    typedPut<void>(`/admin/ai-models/${id}/default`),
  /**
   * 切换模型启用/禁用状态
   * @param id - 模型 ID
   * @param isActive - 目标启用状态
   */
  toggle: (id: string, isActive: boolean) =>
    typedPut<{ isActive: boolean }>(`/admin/ai-models/${id}/toggle`, { isActive }),
};

export const exportApi = {
  create: (type: string, format: string, filter?: Record<string, unknown>) =>
    typedPost<{ exportId: string; status: string }>('/admin/export', { type, format, filter }),
  getStatus: (id: string) => typedGet<unknown>(`/admin/export/${id}/status`),
  download: (id: string) => api.get(`/admin/export/${id}/download`, { responseType: 'blob' }),
};

export const exportCenterApi = {
  getTasks: (params: { status?: string; page?: number; limit?: number }) =>
    typedGet<{
      items: unknown[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/admin/export', { params }),
  retryTask: (id: string) =>
    typedPost<{ exportId: string; status: string }>(`/admin/export/${id}/retry`),
};

export const auditLogsApi = {
  getLogs: (params: { page?: number; pageSize?: number; action?: string; adminNickname?: string; startDate?: string; endDate?: string }) =>
    typedGet<unknown>('/admin/audit-logs', { params }),
  getStats: () =>
    typedGet<unknown>('/admin/audit-logs/stats'),
  exportCSV: (queryString: string) =>
    api.get(`/admin/audit-logs/export?${queryString}`, { responseType: 'blob' }),
};

export const adminAccountsApi = {
  getAccounts: (params: { page?: number; limit?: number }) =>
    typedGet<{
      items: unknown[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/admin/admin-accounts', { params }),
  createAccount: (data: { username: string; password: string; nickname: string; role: string }) =>
    typedPost<{ id: string }>('/admin/admin-accounts', data),
  updateAccount: (id: string, data: { nickname?: string; role?: string; isActive?: boolean }) =>
    typedPut<void>(`/admin/admin-accounts/${id}`, data),
  deleteAccount: (id: string) =>
    typedDelete<void>(`/admin/admin-accounts/${id}`),
};

export const userSegmentsApi = {
  listTags: () =>
    typedGet<unknown>('/admin/user-segments/tags'),
  createTag: (name: string, color: string, description?: string) =>
    typedPost<unknown>('/admin/user-segments/tags', { name, color, description }),
  updateTag: (id: string, name: string, color: string, description?: string) =>
    typedPut<unknown>(`/admin/user-segments/tags/${id}`, { name, color, description }),
  deleteTag: (id: string) =>
    typedDelete<void>(`/admin/user-segments/tags/${id}`),
  addTagToUser: (userId: string, tagId: string) =>
    typedPost<void>(`/admin/user-segments/users/${userId}/tags/${tagId}`),
  removeTagFromUser: (userId: string, tagId: string) =>
    typedDelete<void>(`/admin/user-segments/users/${userId}/tags/${tagId}`),
  getUsersByTag: (tagId: string, page: number, limit: number) =>
    typedGet<unknown>(`/admin/user-segments/users/by-tag/${tagId}`, { params: { page, limit } }),
  listSegments: () =>
    typedGet<unknown>('/admin/user-segments/segments'),
  createSegment: (name: string, description: string | undefined, rule: SegmentRule, autoUpdate: boolean) =>
    typedPost<unknown>('/admin/user-segments/segments', { name, description, rule, autoUpdate }),
  updateSegment: (id: string, name: string, description: string | undefined, rule: SegmentRule) =>
    typedPut<unknown>(`/admin/user-segments/segments/${id}`, { name, description, rule }),
  deleteSegment: (id: string) =>
    typedDelete<void>(`/admin/user-segments/segments/${id}`),
  executeSegment: (id: string) =>
    typedPost<unknown>(`/admin/user-segments/segments/${id}/execute`),
  getSegmentUsers: (segmentId: string, page: number, limit: number) =>
    typedGet<unknown>(`/admin/user-segments/segments/${segmentId}/users`, { params: { page, limit } }),
};

export const searchApi = {
  /**
   * 全局搜索接口
   * 根据搜索词查询用户和工作区
   * @param q - 搜索关键词
   * @returns 包含 users 和 workspaces 的搜索结果
   */
  search: (q: string) =>
    typedGet<{
      users: Array<{ id: string; nickname: string; email: string }>;
      workspaces: Array<{ id: string; name: string }>;
    }>('/admin/search', { params: { q } }),
};

export const announcementsApi = {
  /**
   * 获取公告列表（分页+筛选）
   * @param params - 分页与筛选参数
   * @returns 分页的公告列表
   */
  getList: (params: { page?: number; limit?: number; search?: string; type?: string; isActive?: string }) =>
    typedGet<{
      items: Array<{
        _id: string;
        title: string;
        content: string;
        type: 'info' | 'warning' | 'success' | 'error';
        targetGroups?: string[];
        startDate: string;
        endDate: string;
        isActive: boolean;
        createdBy: string;
        createdAt: string;
        updatedAt: string;
      }>;
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/admin/announcements', { params }),
  /**
   * 创建公告
   * @param data - 公告数据
   * @returns 创建结果，包含新公告ID
   */
  create: (data: {
    title: string;
    content: string;
    type: 'info' | 'warning' | 'success' | 'error';
    targetGroups?: string[];
    startDate: string;
    endDate: string;
    isActive: boolean;
  }) => typedPost<{ id: string }>('/admin/announcements', data),
  /**
   * 更新公告
   * @param id - 公告ID
   * @param data - 更新字段
   */
  update: (id: string, data: {
    title?: string;
    content?: string;
    type?: 'info' | 'warning' | 'success' | 'error';
    targetGroups?: string[];
    startDate?: string;
    endDate?: string;
  }) => typedPut<void>(`/admin/announcements/${id}`, data),
  /**
   * 删除公告
   * @param id - 公告ID
   */
  delete: (id: string) =>
    typedDelete<void>(`/admin/announcements/${id}`),
  /**
   * 切换公告启用/禁用状态
   * @param id - 公告ID
   * @returns 切换后的最新状态
   */
  toggle: (id: string) =>
    typedPut<{ isActive: boolean }>(`/admin/announcements/${id}/toggle`),
};

export default api;
