/**
 * AI服务提供商类型定义
 */
export type AIProvider = 'zhipu' | 'openai' | 'anthropic' | 'deepseek';

/**
 * AI模型配置接口
 */
export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  maxTokens: number;
  description: string;
  isMultimodal?: boolean;
  isPreset?: boolean;
  apiFormat?: 'openai' | 'zhipu' | 'anthropic' | 'deepseek';
  temperature?: number;
  isCustom?: boolean;
}

/**
 * API配置接口
 */
export interface APIConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
}

/**
 * 模型配置接口（完整持久化的模型配置项）
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: AIProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  apiFormat?: 'openai' | 'zhipu' | 'anthropic' | 'deepseek';
  isCustom?: boolean;
  description?: string;
  isMultimodal?: boolean;
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
  /**
   * 访客签名密钥
   * 由服务端注册接口返回，客户端存入 localStorage 用于生成 HMAC-SHA256 签名
   * 查询接口不返回此字段
   */
  visitorSecret?: string;
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
export type StreamEventType = 'content' | 'thinking' | 'done' | 'error' | 'tool_call' | 'tool_result';

/**
 * 流式响应数据接口
 */
export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  fullContent?: string;
  thinkingContent?: string;
  fullThinkingContent?: string;
  error?: string;
  /** 工具调用信息（type 为 tool_call 时存在） */
  tool_calls?: ToolCall[];
  /** 工具执行结果（type 为 tool_result 时存在） */
  tool_results?: ToolResult[];
  /** 工具调用会话ID（type 为 tool_call 时存在，客户端驱动模式下不再用于回传） */
  session_id?: string;
  /** 当 type 为 done 时，标记是否有待处理的工具调用（客户端需发起新请求） */
  toolCallPending?: boolean;
}

/**
 * 流式响应回调类型（同步回调，不再需要异步等待工具执行结果）
 */
export type StreamCallback = (event: StreamEvent) => void;

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  /** assistant 消息中的工具调用（AI 决定调用工具时） */
  tool_calls?: ToolCall[];
  /** tool 消息对应的 tool_call ID */
  tool_call_id?: string;
}

/** 含工具调用的助手消息 */
export interface AssistantToolMessage {
  role: 'assistant';
  content: string;
  tool_calls: ToolCall[];
}

/** 工具消息 */
export interface ToolChatMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

export type ConversationMessage = ChatMessage | AssistantToolMessage | ToolChatMessage;

/** AI 工具调用信息 */
export interface ToolCall {
  /** 工具调用唯一标识 */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具调用参数（JSON 字符串） */
  arguments: string;
}

/** 工具执行结果 */
export interface ToolResult {
  /** 对应的 tool_call ID */
  tool_call_id: string;
  /** 工具执行结果（JSON 字符串） */
  content: string;
}

/** 工具调用流式事件 */
export interface ToolCallStreamEvent {
  type: 'tool_call';
  /** 工具调用信息 */
  tool_calls: ToolCall[];
}

/** 工具结果流式事件 */
export interface ToolResultStreamEvent {
  type: 'tool_result';
  /** 工具执行结果 */
  results: ToolResult[];
}
