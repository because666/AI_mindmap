import { ObjectId } from 'mongodb';

/**
 * 管理员角色类型
 * super_admin: 超级管理员，拥有全部权限
 * operator: 运营管理员，可管理用户/工作区/内容
 * auditor: 审计员，可查看审计日志和内容审核
 * readonly: 只读用户，仅可查看数据大盘
 */
export type AdminRole = 'super_admin' | 'operator' | 'auditor' | 'readonly';

/**
 * 管理员账户接口
 * 存储于 admin_accounts 集合
 */
export interface AdminAccount {
  _id?: ObjectId;
  username: string;
  passwordHash: string;
  nickname: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  createdByIp?: string;
}

export interface AdminIP {
  _id?: ObjectId;
  ipAddress: string;
  nickname: string;
  description?: string;
  isFirstAdmin: boolean;
  createdAt: Date;
  createdBy?: string;
  lastLoginAt?: Date;
  loginCount: number;
  isActive: boolean;
}

export interface LoginAttempt {
  ipAddress: string;
  attempts: number;
  lastAttemptAt: Date;
  lockedUntil?: Date;
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

/**
 * 带灰度规则的功能开关项接口
 * 每个功能开关除了布尔值外，可附带灰度规则
 */
export interface FeatureFlag {
  /** 功能是否全局启用 */
  enabled: boolean;
  /** 灰度规则列表，存在规则时按规则判断可见性；无规则时按 enabled 全局生效 */
  grayRules?: GrayRule[];
}

/**
 * 功能开关集合接口
 * 存储于 admin_configs.features 中
 */
export interface AdminFeatures {
  sensitiveWordCheck: boolean;
  auditLog: boolean;
  dataExport: boolean;
  /** 各功能开关的灰度规则配置 */
  grayRules?: Record<string, GrayRule[]>;
}

export interface AdminConfig {
  _id?: ObjectId;
  passwordHash: string;
  passwordUpdatedAt: Date;
  loginAttempts: LoginAttempt[];
  features: AdminFeatures;
  security?: SecurityConfig;
  updatedAt: Date;
}

export interface SecurityConfig {
  secretQuestion: string;
  secretAnswer: string;
  enableHoneypot: boolean;
}

export interface AttackLog {
  _id?: ObjectId;
  ipAddress: string;
  userAgent: string;
  attemptedPasswords: string[];
  loginAttempts: number;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
  honeypotTrappedAt?: Date;
  isSolvedQuestion: boolean;
  questionAnswerAt?: Date;
}

export interface AdminSession {
  _id?: ObjectId;
  sessionId: string;
  ipAddress: string;
  nickname: string;
  role?: AdminRole;
  userAgent: string;
  createdAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface AuditLog {
  _id?: ObjectId;
  timestamp: Date;
  adminNickname: string;
  adminIp: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: Record<string, unknown>;
  result: 'success' | 'failed';
  errorMessage?: string;
}

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

/**
 * 趋势数据接口
 * 包含多集合按日聚合的统计值
 */
export interface TrendData {
  dates: string[];
  visitors: number[];
  workspaces: number[];
  conversations: number[];
  messages: number[];
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

export interface IpBan {
  _id?: ObjectId;
  ip: string;
  reason: string;
  bannedAt: Date;
  banExpiresAt?: Date;
  bannedBy: string;
  visitorIds: string[];
  autoBanAccounts: boolean;
}

export interface IpBanListItem {
  _id: string;
  ip: string;
  reason: string;
  bannedAt: string;
  banExpiresAt?: string;
  bannedBy: string;
  visitorIds: string[];
  autoBanAccounts: boolean;
  associatedVisitorCount: number;
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

export interface SensitiveWordConfig {
  enabled: boolean;
  words: string[];
  matchMode: 'exact' | 'fuzzy';
  autoFlag: boolean;
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

export interface ExportTask {
  _id?: ObjectId;
  id: string;
  type: 'users' | 'workspaces' | 'messages' | 'audit_logs';
  format: 'csv' | 'json';
  filter?: {
    startDate?: string;
    endDate?: string;
    workspaceId?: string;
    userId?: string;
  };
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  fileUrl?: string;
  fileSize?: number;
  createdAt: Date;
  completedAt?: Date;
  expiredAt?: Date;
  createdByIp: string;
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
 * 反馈状态类型
 */
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'closed';

/**
 * 反馈类型枚举
 */
export type FeedbackType = '功能异常' | '界面问题' | '建议' | '其他';

/**
 * 内部备注接口
 * 管理员对反馈工单添加的内部备注，仅管理员可见
 */
export interface InternalNote {
  /** 备注内容 */
  content: string;
  /** 备注作者（管理员昵称） */
  author: string;
  /** 备注创建时间 */
  createdAt: Date;
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
 * 用户标签接口
 * 存储于 user_tags 集合
 */
export interface UserTag {
  /** 标签唯一标识 */
  _id?: ObjectId;
  /** 标签名称 */
  name: string;
  /** 标签颜色（十六进制色值，如 #FF5733） */
  color: string;
  /** 标签描述 */
  description?: string;
  /** 创建时间 */
  createdAt: Date;
}

/**
 * 用户分群接口
 * 存储于 user_segments 集合
 */
export interface UserSegment {
  /** 分群唯一标识 */
  _id?: ObjectId;
  /** 分群名称 */
  name: string;
  /** 分群描述 */
  description?: string;
  /** 分群规则，定义匹配用户的条件 */
  rule: SegmentRule;
  /** 匹配用户数量（执行规则后更新） */
  userCount: number;
  /** 是否自动更新（暂预留，当前手动触发执行） */
  autoUpdate: boolean;
  /** 创建时间 */
  createdAt: Date;
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
 * node_created: 节点创建事件
 * conversation: 对话事件
 * conclusion: 结论提炼事件
 * export: 导出事件
 */
export type TimelineEventType = 'node_created' | 'conversation' | 'conclusion' | 'export';

/**
 * 时间线事件详情接口
 * 不同事件类型携带不同的详情字段
 */
export interface TimelineEventDetail {
  /** 节点ID（节点创建/结论提炼事件） */
  nodeId?: string;
  /** 节点标题（节点创建/结论提炼事件） */
  nodeTitle?: string;
  /** 消息预览（对话事件，取第一条用户消息截断） */
  messagePreview?: string;
  /** 导出类型（导出事件，如 csv/json） */
  exportType?: string;
}

/**
 * 时间线事件接口
 * 聚合用户在多个集合中的活动记录
 */
/**
 * 公告类型枚举
 * info: 信息提示, warning: 警告, success: 成功, error: 错误
 */
export type AnnouncementType = 'info' | 'warning' | 'success' | 'error';

/**
 * 站内公告接口
 * 存储于 announcements 集合
 */
export interface Announcement {
  /** 公告唯一标识 */
  _id?: ObjectId;
  /** 公告标题 */
  title: string;
  /** 公告内容 */
  content: string;
  /** 公告类型，决定横幅展示颜色 */
  type: AnnouncementType;
  /** 目标分组ID列表，为空则面向全部用户 */
  targetGroups?: string[];
  /** 生效开始时间 */
  startDate: Date;
  /** 生效结束时间 */
  endDate: Date;
  /** 是否启用 */
  isActive: boolean;
  /** 创建人昵称 */
  createdBy: string;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

export interface TimelineEvent {
  /** 事件类型 */
  type: TimelineEventType;
  /** 事件时间戳 */
  timestamp: string;
  /** 事件详情 */
  detail: TimelineEventDetail;
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

/**
 * 用户行为事件文档接口
 * 与主服务 /api/events 写入的 events 集合结构保持一致
 */
export interface AnalyticsEvent {
  /** 事件类型，如 page_view、node_created */
  eventType: string;
  /** 访客唯一标识 */
  visitorId?: string;
  /** 工作区唯一标识 */
  workspaceId?: string;
  /** 节点唯一标识 */
  nodeId?: string;
  /** 脑图唯一标识 */
  mapId?: string;
  /** 事件附加载荷 */
  payload?: Record<string, unknown>;
  /** 事件发生时的页面 URL */
  url?: string;
  /** 客户端 User-Agent */
  userAgent?: string;
  /** 事件发生时间（客户端上报） */
  timestamp: Date;
  /** 服务端接收时间 */
  createdAt: Date;
}

/**
 * 事件统计概览数据接口
 */
export interface EventOverviewData {
  /** 事件总数量 */
  total: number;
  /** 今日事件数量 */
  today: number;
  /** 独立访客数量（按 visitorId 去重） */
  uniqueVisitors: number;
}

/**
 * 事件趋势数据接口
 */
export interface EventTrendData {
  /** 日期字符串数组，格式 YYYY-MM-DD */
  dates: string[];
  /** 每日事件数量数组，与 dates 一一对应 */
  values: number[];
}

/**
 * 事件漏斗步骤接口
 */
export interface EventFunnelStep {
  /** 步骤名称 */
  name: string;
  /** 该步骤触发的独立访客数 */
  count: number;
  /** 相对于第一步的转化率（百分比） */
  rate: number;
}

/**
 * 事件漏斗数据接口
 */
export interface EventFunnelData {
  /** 漏斗步骤列表 */
  steps: EventFunnelStep[];
}

/**
 * 最近事件列表项接口
 */
export interface RecentEventItem {
  /** 事件类型 */
  eventType: string;
  /** 访客唯一标识 */
  visitorId?: string;
  /** 工作区唯一标识 */
  workspaceId?: string;
  /** 节点唯一标识 */
  nodeId?: string;
  /** 脑图唯一标识 */
  mapId?: string;
  /** 事件附加载荷 */
  payload?: Record<string, unknown>;
  /** 事件发生时的页面 URL */
  url?: string;
  /** 客户端 User-Agent */
  userAgent?: string;
  /** 事件发生时间 */
  timestamp: string;
}
