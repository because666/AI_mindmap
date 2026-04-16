import { ObjectId } from 'mongodb';

/**
 * 工作区类型
 */
export type WorkspaceType = 'public' | 'private';

/**
 * 工作区成员角色
 */
export type MemberRole = 'owner' | 'collaborator';

/**
 * 工作区成员接口
 */
export interface WorkspaceMember {
  visitorId: string;
  nickname: string;
  role: MemberRole;
  joinedAt: Date;
}

/**
 * 工作区数据接口
 */
export interface Workspace {
  _id?: ObjectId;
  id: string;
  name: string;
  description?: string;
  type: WorkspaceType;
  inviteCode?: string;
  inviteCodeExpiry?: Date;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 访客数据接口
 */
export interface Visitor {
  _id?: ObjectId;
  id: string;
  nickname: string;
  lastSeen: Date;
  workspaces: string[];
  createdAt: Date;
}

/**
 * 节点数据接口
 */
export interface Node {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  isRoot: boolean;
  isComposite: boolean;
  compositeChildren?: string[];
  compositeParent?: string;
  hidden: boolean;
  expanded: boolean;
  conversationId?: string;
  position: { x: number; y: number };
  tags: string[];
  parentIds: string[];
  childrenIds: string[];
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 关系类型定义
 */
export type RelationType = 
  | 'parent-child'
  | 'supports'
  | 'contradicts'
  | 'prerequisite'
  | 'elaborates'
  | 'references'
  | 'conclusion'
  | 'custom';

/**
 * 关系数据接口
 */
export interface Relation {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  type: RelationType;
  description?: string;
  createdBy?: string;
  createdAt: Date;
}

/**
 * 对话数据接口
 */
export interface Conversation {
  _id?: ObjectId;
  id: string;
  nodeId: string;
  workspaceId: string;
  messages: Message[];
  contextConfig: {
    includeParentHistory: boolean;
    includeRelatedNodes: string[];
    customContext?: string;
  };
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 消息数据接口
 */
export interface Message {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    model?: string;
    tokens?: number;
    nodeId?: string;
  };
}

/**
 * 用户数据接口
 */
export interface User {
  _id?: ObjectId;
  id: string;
  email: string;
  name: string;
  avatar?: string;
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 用户设置接口
 */
export interface UserSettings {
  defaultModel: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    zhipu?: string;
    deepseek?: string;
    custom?: string;
  };
}

/**
 * 历史记录接口
 */
export interface HistoryRecord {
  id: string;
  workspaceId?: string;
  visitorId?: string;
  action: string;
  description: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  timestamp: Date;
}

/**
 * 搜索结果接口
 */
export interface SearchResult {
  nodeId: string;
  score: number;
  matches: string[];
  highlights?: Record<string, string[]>;
}

/**
 * AI请求接口
 */
export interface AIRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

/**
 * AI响应接口
 */
export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 嵌入请求接口
 */
export interface EmbeddingRequest {
  text: string;
  model?: string;
}

/**
 * 嵌入响应接口
 */
export interface EmbeddingResponse {
  success: boolean;
  embedding?: number[];
  error?: string;
}
