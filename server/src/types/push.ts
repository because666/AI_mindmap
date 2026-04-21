import { ObjectId } from 'mongodb';

/**
 * 用户设备信息接口
 * 用于存储极光推送的设备注册ID与用户关联关系
 */
export interface UserDevice {
  _id?: ObjectId;
  userId: string;
  registrationId: string;
  platform: 'android' | 'ios';
  deviceModel?: string;
  appVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * 推送消息类型
 */
export type PushMessageType = 'broadcast' | 'workspace_auto' | 'workspace_manual';

/**
 * 发送者类型
 */
export type SenderType = 'system' | 'admin' | 'user';

/**
 * 目标类型
 */
export type TargetType = 'all' | 'workspace_admins' | 'workspace_members' | 'specific_users';

/**
 * 消息接收者状态
 */
export interface MessageRecipient {
  userId: string;
  delivered: boolean;
  deliveredAt?: Date;
  read: boolean;
  readAt?: Date;
  forcedRead: boolean;
}

/**
 * 推送消息统计信息
 */
export interface MessageStats {
  totalCount: number;
  deliveredCount: number;
  readCount: number;
  readRate: number;
}

/**
 * 推送消息接口
 * 核心数据模型，存储所有推送消息的完整信息
 */
export interface PushMessage {
  _id?: ObjectId;
  type: PushMessageType;
  title: string;
  content: string;
  summary: string;
  senderType: SenderType;
  senderId?: string;
  senderName?: string;
  targetType: TargetType;
  targetWorkspaceId?: string;
  targetUserIds?: string[];
  createdAt: Date;
  scheduledAt?: Date;
  sentAt?: Date | null;
  expireAt: Date;
  recipients: MessageRecipient[];
  stats: MessageStats;
  forceRead: boolean;
  forceReadDeadline?: Date;
}

/**
 * 推送消息列表项（精简版，用于列表展示）
 */
export interface PushMessageListItem {
  _id?: ObjectId;
  id: string;
  type: PushMessageType;
  title: string;
  summary: string;
  senderName: string;
  createdAt: Date;
  read: boolean;
  forceRead: boolean;
}

/**
 * 用户消息状态接口
 * 用于追踪每个用户对每条消息的已读状态
 */
export interface UserPushStatus {
  _id?: ObjectId;
  userId: string;
  messageId: string;
  delivered: boolean;
  deliveredAt?: Date;
  read: boolean;
  readAt?: Date;
  lastRemindAt?: Date;
  remindCount: number;
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 未读数量统计响应
 */
export interface UnreadCountResponse {
  total: number;
  broadcast: number;
  workspace: number;
  forceReadPending: number;
}

/**
 * 已读统计响应
 */
export interface ReadStatsResponse {
  messageId: string;
  title: string;
  stats: {
    total: number;
    delivered: number;
    read: number;
    unread: number;
    readRate: number;
  };
  unreadUsers: Array<{
    userId: string;
    nickname: string;
  }>;
}

/**
 * 广播消息发送选项
 */
export interface BroadcastOptions {
  title: string;
  content: string;
  summary?: string;
  targetType: TargetType;
  targetUserIds?: string[];
  scheduledAt?: Date;
  forceRead?: boolean;
  forceReadDeadline?: Date;
}

/**
 * 工作区通知发送选项
 */
export interface WorkspaceNotificationOptions {
  workspaceId: string;
  senderId: string;
  title: string;
  content: string;
  importance?: 'normal' | 'high';
}
