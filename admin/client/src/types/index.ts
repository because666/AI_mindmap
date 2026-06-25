export interface DashboardStats {
  users: {
    total: number;
    todayNew: number;
    todayActive: number;
    weekActive: number;
    onlineNow: number;
  };
  workspaces: {
    total: number;
    activeToday: number;
    publicCount: number;
  };
  content: {
    totalNodes: number;
    totalMessages: number;
    todayMessages: number;
    aiInteractions: number;
  };
}

export interface UserListItem {
  _id: string;
  id: string;
  nickname: string;
  createdAt: string;
  lastActiveAt: string;
  status: 'active' | 'banned' | 'suspended';
  stats: {
    workspaceCount: number;
    messageCount: number;
    nodeCount: number;
  };
  isBanned: boolean;
  banReason?: string;
  banExpiresAt?: string;
  lastIp?: string;
  ipHistory?: string[];
  tags?: string[];
}

export interface WorkspaceListItem {
  _id: string;
  id: string;
  name: string;
  description: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    nickname: string;
  };
  stats: {
    memberCount: number;
    nodeCount: number;
    messageCount: number;
  };
  isReported: boolean;
  reportCount: number;
}

export interface ChatAuditItem {
  _id: string;
  messageId: string;
  workspaceId: string;
  workspaceName: string;
  sender: {
    id: string;
    nickname: string;
  };
  content: string;
  createdAt: string;
  auditResult: {
    scannedAt: string;
    hasSensitiveWord: boolean;
    matchedWords: string[];
    riskLevel: 'low' | 'medium' | 'high';
    status: 'pending' | 'safe' | 'deleted' | 'ignored';
  };
  action?: {
    adminNickname: string;
    adminIp: string;
    action: 'mark_safe' | 'delete' | 'warn_user';
    reason: string;
    timestamp: string;
  };
}

export interface SensitiveWordConfig {
  enabled: boolean;
  words: string[];
  matchMode: 'exact' | 'fuzzy';
  autoFlag: boolean;
}

export interface AdminIP {
  _id: string;
  ipAddress: string;
  nickname: string;
  description?: string;
  isFirstAdmin: boolean;
  createdAt: string;
  lastLoginAt?: string;
  loginCount: number;
  isActive: boolean;
}

/**
 * 工作区排行排序维度类型
 * nodeCount: 按节点数排序
 * conversationCount: 按对话量排序
 * exportCount: 按导出量排序
 */
export type RankingSortBy = 'nodeCount' | 'conversationCount' | 'exportCount';

/**
 * 工作区排行项接口
 * 聚合查询后返回的排行数据结构
 */
export interface WorkspaceRankingItem {
  workspaceId: string;
  name: string;
  nodeCount: number;
  conversationCount: number;
  exportCount: number;
  starred: boolean;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 灰度规则字段类型
 * userId: 按用户ID匹配
 * ip: 按IP地址匹配
 * workspaceId: 按工作区ID匹配
 */
export type GrayRuleField = 'userId' | 'ip' | 'workspaceId';

/**
 * 灰度规则匹配方式类型
 * equals: 精确匹配
 * contains: 包含匹配
 * startsWith: 前缀匹配
 * regex: 正则表达式匹配
 */
export type GrayRuleMatch = 'equals' | 'contains' | 'startsWith' | 'regex';

/**
 * 灰度规则接口
 * 定义功能开关的灰度发布匹配条件
 */
export interface GrayRule {
  /** 匹配字段，决定按哪个维度进行灰度匹配 */
  field: GrayRuleField;
  /** 匹配方式，决定如何与目标值进行比较 */
  match: GrayRuleMatch;
  /** 匹配值，与请求中的对应字段进行比较 */
  value: string;
}

export interface AdminFeatures {
  sensitiveWordCheck: boolean;
  auditLog: boolean;
  dataExport: boolean;
  /** 各功能开关的灰度规则配置 */
  grayRules?: Record<string, GrayRule[]>;
}

/**
 * 反馈状态类型
 */
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'closed';

/**
 * 反馈类型枚举
 */
export type FeedbackType = '功能异常' | '界面问题' | '建议' | '其他';

/**
 * 内部备注接口（客户端展示用）
 * 管理员对反馈工单添加的内部备注，仅管理员可见
 */
export interface InternalNote {
  /** 备注内容 */
  content: string;
  /** 备注作者（管理员昵称） */
  author: string;
  /** 备注创建时间 */
  createdAt: string;
}

/**
 * 反馈列表项接口
 */
export interface FeedbackListItem {
  _id: string;
  title: string;
  description: string;
  type: FeedbackType;
  contact: string;
  visitorIp: string;
  visitorId: string;
  status: FeedbackStatus;
  createdAt: string;
  /** 分配的管理员昵称 */
  assignee?: string;
  /** 分配时间 */
  assignedAt?: string;
  /** 内部备注列表，仅管理员可见 */
  internalNotes?: InternalNote[];
  /** SLA 截止时间 */
  slaDeadline?: string;
  /** SLA 时长（小时），默认 48 */
  slaHours?: number;
}

/**
 * 导出任务状态类型
 */
export type ExportTaskStatus = 'processing' | 'completed' | 'failed';

/**
 * 导出任务类型枚举
 */
export type ExportTaskType = 'users' | 'workspaces' | 'messages' | 'audit_logs';

/**
 * 导出格式类型枚举
 */
export type ExportFormat = 'csv' | 'json';

/**
 * 导出任务列表项接口
 */
export interface ExportTaskItem {
  _id: string;
  id: string;
  type: ExportTaskType;
  format: ExportFormat;
  status: ExportTaskStatus;
  progress: number;
  fileUrl?: string;
  fileSize?: number;
  createdAt: string;
  completedAt?: string;
  expiredAt?: string;
  createdByIp: string;
}

/**
 * 反馈统计数据接口
 */
export interface FeedbackStats {
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  resolvedCount: number;
  closedCount: number;
  todayCount: number;
  typeDistribution: { type: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
}

/**
 * 审计日志列表项接口
 */
export interface AuditLogListItem {
  _id: string;
  timestamp: string;
  adminNickname: string;
  adminIp: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: Record<string, unknown>;
  result: 'success' | 'failed';
  errorMessage?: string;
}

/**
 * 审计日志统计数据接口
 */
export interface AuditLogStats {
  totalCount: number;
  todayCount: number;
  successCount: number;
  failedCount: number;
  actionDistribution: { action: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
}

/**
 * 留存趋势数据接口
 * 包含按日的活跃用户数和留存率指标
 */
export interface RetentionTrendData {
  /** 日期字符串数组 */
  dates: string[];
  /** 日活跃用户数（当日有对话的独立用户数） */
  dau: number[];
  /** 周活跃用户数（7日内有对话的独立用户数） */
  wau: number[];
  /** 月活跃用户数（30日内有对话的独立用户数） */
  mau: number[];
  /** 次日留存率（百分比） */
  nextDayRetention: number[];
  /** 7日留存率（百分比） */
  day7Retention: number[];
  /** 30日留存率（百分比） */
  day30Retention: number[];
}

/**
 * 漏斗步骤接口
 * 表示转化漏斗中的单个步骤
 */
export interface FunnelStep {
  /** 步骤名称 */
  name: string;
  /** 该步骤的用户数 */
  count: number;
  /** 相对于第一步的转化率（百分比） */
  rate: number;
}

/**
 * 转化漏斗数据接口
 * 包含从注册到导出的完整转化步骤
 */
export interface ConversionFunnelData {
  /** 漏斗步骤列表 */
  steps: FunnelStep[];
}

/**
 * 时间线事件类型枚举
 */
export type TimelineEventType = 'node_created' | 'conversation' | 'conclusion' | 'export';

/**
 * 时间线事件详情接口
 */
export interface TimelineEventDetail {
  nodeId?: string;
  nodeTitle?: string;
  messagePreview?: string;
  exportType?: string;
}

/**
 * 时间线事件接口
 */
export interface TimelineEvent {
  type: TimelineEventType;
  timestamp: string;
  detail: TimelineEventDetail;
}

/**
 * 分群规则字段类型
 * 支持按最后活跃时间、消息数量、是否拥有API密钥进行分群
 */
export type SegmentRuleField = 'lastActiveAt' | 'messageCount' | 'hasOwnApiKey';

/**
 * 分群规则运算符类型
 * gte: 大于等于, lte: 小于等于, eq: 等于
 */
export type SegmentRuleOperator = 'gte' | 'lte' | 'eq';

/**
 * 分群规则接口
 * 定义用户分群的匹配条件
 */
export interface SegmentRule {
  /** 规则字段，决定按哪个用户属性进行筛选 */
  field: SegmentRuleField;
  /** 比较运算符 */
  operator: SegmentRuleOperator;
  /** 比较值，支持数字、字符串、布尔类型 */
  value: number | string | boolean;
}

/**
 * 用户标签接口（客户端展示用）
 */
export interface UserTag {
  /** 标签唯一标识 */
  _id: string;
  /** 标签名称 */
  name: string;
  /** 标签颜色（十六进制色值） */
  color: string;
  /** 标签描述 */
  description?: string;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 用户分群接口（客户端展示用）
 */
export interface UserSegment {
  /** 分群唯一标识 */
  _id: string;
  /** 分群名称 */
  name: string;
  /** 分群描述 */
  description?: string;
  /** 分群规则 */
  rule: SegmentRule;
  /** 匹配用户数量 */
  userCount: number;
  /** 是否自动更新 */
  autoUpdate: boolean;
  /** 创建时间 */
  createdAt: string;
}

/**
 * AI 服务商配置接口
 * 定义单个 AI 服务商的连接信息与优先级
 */
export interface AIProvider {
  /** 服务商唯一标识，如 "zhipu"、"deepseek" */
  id: string;
  /** 服务商显示名称，如 "智谱GLM" */
  name: string;
  /** API 基础 URL */
  url: string;
  /** API 密钥 */
  apiKey: string;
  /** 默认模型名称 */
  model: string;
  /** 优先级，数值越小优先级越高 */
  priority: number;
}
