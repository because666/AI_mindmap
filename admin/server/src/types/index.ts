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

/**
 * 用户活跃度分层类型
 * new_user: 新用户，createdAt 在最近 24 小时内
 * high_active: 高活跃，lastSeen 在最近 24 小时内（且非新用户）
 * churn_risk: 流失风险，lastSeen 在 7-30 天前
 * dormant: 沉睡，lastSeen 超过 30 天，或 lastSeen 为空
 */
export type ActivityTier = 'new_user' | 'high_active' | 'churn_risk' | 'dormant';

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
  /** 活跃度分层，基于 lastSeen/createdAt 计算 */
  activityTier: ActivityTier;
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
  /**
   * 是否被管理员置顶
   * 为 true 时该工作区会在前端"推荐工作区"区域优先展示
   */
  isPinned?: boolean;
  /**
   * 置顶时间（ISO 字符串）
   * 与 isPinned 配套，用于置顶工作区之间的时间倒序排序
   */
  pinnedAt?: string;
  /** 是否被管理员封禁 */
  isBanned?: boolean;
  /** 封禁原因 */
  banReason?: string;
  /** 封禁过期时间（ISO 字符串），undefined 表示永久封禁 */
  banExpiresAt?: string;
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
 * 仅支持 visitors 集合实际存在的字段：最后活跃时间、注册时间、工作区数量
 */
export type SegmentRuleField = 'lastActiveAt' | 'createdAt' | 'workspaceCount';

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
 * AI 模型提供商类型
 * zhipu: 智谱GLM
 * deepseek: DeepSeek
 * openai: OpenAI
 * custom: 自定义 OpenAI 兼容服务商
 */
export type AIModelProvider = 'zhipu' | 'deepseek' | 'openai' | 'custom';

/**
 * AI 模型配置接口
 * 存储于 ai_model_configs 集合，由后台动态管理
 * 主服务启动时从数据库加载该配置覆盖环境变量默认值
 */
export interface AIModelConfig {
  /** 文档唯一标识 */
  _id?: ObjectId;
  /** 模型配置名称，便于管理员识别，如 "智谱GLM-4-Flash" */
  name: string;
  /** 服务商类型，决定调用哪家 AI 服务商 */
  provider: AIModelProvider;
  /** API 密钥，禁止在前端日志中输出明文 */
  apiKey: string;
  /** API 基础 URL，例如 https://open.bigmodel.cn/api/paas/v4 */
  baseUrl: string;
  /** 模型 ID，例如 glm-4-flash */
  modelId: string;
  /** 采样温度，控制输出随机性，范围 0-2 */
  temperature: number;
  /** 最大输出 token 数 */
  maxTokens: number;
  /** 是否启用，false 时主服务跳过该模型 */
  isActive: boolean;
  /** 是否默认模型，全局仅允许一个为 true */
  isDefault: boolean;
  /** 优先级，数值越小优先级越高，主服务按该字段升序排列作为 fallback 链 */
  priority: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * AI 模型配置列表项接口
 * 用于后台返回模型列表，apiKey 字段做掩码处理，不输出明文
 */
export interface AIModelConfigListItem {
  /** 文档唯一标识字符串 */
  _id: string;
  /** 模型配置名称 */
  name: string;
  /** 服务商类型 */
  provider: AIModelProvider;
  /** API 密钥掩码，如 "sk-***abcd" */
  apiKeyMasked: string;
  /** API 基础 URL */
  baseUrl: string;
  /** 模型 ID */
  modelId: string;
  /** 采样温度 */
  temperature: number;
  /** 最大输出 token 数 */
  maxTokens: number;
  /** 是否启用 */
  isActive: boolean;
  /** 是否默认模型 */
  isDefault: boolean;
  /** 优先级 */
  priority: number;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 模型用量聚合统计接口
 * 用于后台展示各模型的调用量、token 消耗、失败率
 */
export interface AIModelUsageSummaryItem {
  /** 模型 ID */
  model: string;
  /** 服务商名称 */
  provider: string;
  /** 调用总次数 */
  totalCalls: number;
  /** 成功调用次数 */
  successCalls: number;
  /** 失败调用次数 */
  failedCalls: number;
  /** 失败率（百分比，0-100） */
  failureRate: number;
  /** Prompt token 总消耗 */
  promptTokens: number;
  /** Completion token 总消耗 */
  completionTokens: number;
  /** 总 token 消耗 */
  totalTokens: number;
  /** 平均响应时间（毫秒） */
  avgResponseTime: number;
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

/**
 * 功能采用矩阵单项接口
 * 描述单个功能的采用情况：触发该事件的独立访客数与采用率
 */
export interface FeatureAdoptionItem {
  /** 功能显示名称 */
  name: string;
  /** 对应事件类型 */
  eventType: string;
  /** 触发过该事件的独立访客数 */
  uniqueUsers: number;
  /** 采用率（百分比，0-100） */
  adoptionRate: number;
}

/**
 * 功能采用矩阵数据接口
 * 包含各功能采用情况和总独立访客数
 */
export interface FeatureAdoptionData {
  /** 功能采用列表 */
  features: FeatureAdoptionItem[];
  /** 最近 N 天内有活动的独立访客总数 */
  totalUsers: number;
}

/**
 * 实时在线曲线单点接口
 * 描述某一分钟内的活跃独立访客数
 */
export interface OnlineCurvePoint {
  /** 时间字符串，格式 HH:mm */
  time: string;
  /** 该分钟内的独立访客数 */
  activeUsers: number;
}

/**
 * 实时在线状态数据接口
 * 包含当前在线用户数和最近 30 分钟活跃曲线
 */
export interface OnlineStatusData {
  /** 当前在线用户数（lastSeen >= now-5分钟） */
  onlineNow: number;
  /** 最近 30 分钟活跃曲线（每分钟一个点，共 30 个点） */
  recentActiveCurve: OnlineCurvePoint[];
}
