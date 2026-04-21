import { ObjectId } from 'mongodb';

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

export interface AdminFeatures {
  sensitiveWordCheck: boolean;
  auditLog: boolean;
  dataExport: boolean;
}

export interface AdminConfig {
  _id?: ObjectId;
  passwordHash: string;
  passwordUpdatedAt: Date;
  loginAttempts: LoginAttempt[];
  features: AdminFeatures;
  updatedAt: Date;
}

export interface AdminSession {
  _id?: ObjectId;
  sessionId: string;
  ipAddress: string;
  nickname: string;
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

export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
