/**
 * AI服务提供商类型定义
 */
export type AIProvider = 'zhipu' | 'openai' | 'anthropic';

/**
 * AI模型配置接口
 */
export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  maxTokens: number;
  description: string;
}

/**
 * API配置接口
 */
export interface APIConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
}

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
  joinedAt: string;
}

/**
 * 工作区接口
 */
export interface IWorkspace {
  id: string;
  name: string;
  description?: string;
  type: WorkspaceType;
  inviteCode?: string;
  inviteCodeExpiry?: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

/**
 * 访客接口
 */
export interface IVisitor {
  id: string;
  nickname: string;
  lastSeen: string;
  workspaces: string[];
  createdAt: string;
}

/**
 * 节点类型定义
 */
export type NodeType = 'root' | 'branch' | 'leaf' | 'composite';

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
 * 节点位置接口
 */
export interface NodePosition {
  x: number;
  y: number;
}

/**
 * 节点接口
 */
export interface INode {
  _id: string;
  workspaceId: string;
  type: NodeType;
  title: string;
  summary: string;
  parentIds: string[];
  childrenIds: string[];
  isComposite: boolean;
  compositeChildren?: string[];
  position: NodePosition;
  createdAt: Date;
  updatedAt: Date;
  status: 'active' | 'archived' | 'deleted';
  tags: string[];
}

/**
 * 消息角色类型
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 消息接口
 */
export interface IMessage {
  _id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
  };
}

/**
 * 对话接口
 */
export interface IConversation {
  _id: string;
  nodeId: string;
  workspaceId: string;
  messages: IMessage[];
  contextConfig: {
    includeParentHistory: boolean;
    includeRelatedNodes: string[];
    customContext?: string;
  };
  aiConfig: {
    provider: AIProvider;
    model: string;
    temperature: number;
    maxTokens: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 关系接口
 */
export interface IRelation {
  _id: string;
  workspaceId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: RelationType;
  description?: string;
  createdAt: Date;
}

/**
 * API响应通用接口
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 流式响应事件类型
 */
export type StreamEventType = 'content' | 'done' | 'error';

/**
 * 流式响应数据接口
 */
export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  fullContent?: string;
  error?: string;
}

/**
 * 流式响应回调类型
 */
export type StreamCallback = (event: StreamEvent) => void;

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
