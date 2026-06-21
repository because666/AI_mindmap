import axios, { type InternalAxiosRequestConfig } from 'axios';
import type { IWorkspace, IVisitor, WorkspaceType } from '../types';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return '/api';
  }
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * 获取本地存储的访客ID
 * @returns 访客ID或null
 */
export const getLocalVisitorId = (): string | null => {
  return localStorage.getItem('visitorId');
};

/**
 * 获取本地存储的访客签名密钥
 * @returns 访客签名密钥或null
 */
export const getLocalVisitorSecret = (): string | null => {
  return localStorage.getItem('visitorSecret');
};

/**
 * 签名生成结果
 */
export interface VisitorTokenResult {
  /** HMAC-SHA256 签名（hex 字符串） */
  token: string;
  /** 当前时间戳（毫秒，字符串形式） */
  ts: string;
}

/**
 * 生成访客请求签名
 * 使用 Web Crypto API（crypto.subtle）计算 HMAC-SHA256 签名
 * 签名内容为 `${visitorId}:${timestamp}`，密钥为 visitorSecret
 * @param visitorId - 访客ID
 * @param secret - 访客签名密钥（服务端注册时返回的 visitorSecret）
 * @returns 签名结果，包含 token（hex 签名）和 ts（时间戳字符串）
 * @throws 当 Web Crypto API 不可用或签名计算失败时抛出异常
 */
export const generateVisitorToken = async (
  visitorId: string,
  secret: string
): Promise<VisitorTokenResult> => {
  const ts = Date.now().toString();
  const message = `${visitorId}:${ts}`;
  const encoder = new TextEncoder();

  // 导入 HMAC 密钥
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // 计算签名
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  );

  // 将 ArrayBuffer 转换为 hex 字符串
  const token = Array.from(new Uint8Array(signatureBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  return { token, ts };
};

/**
 * 获取本地存储的当前工作区ID
 * @returns 工作区ID或null
 */
export const getLocalWorkspaceId = (): string | null => {
  return localStorage.getItem('currentWorkspaceId');
};

/**
 * 获取服务端基础URL（不含 /api 前缀）
 * 用于需要手动拼接 /api 路径的场景（如 fetch 发起的 SSE 流式请求）
 * @returns 服务端基础URL，开发环境为 http://localhost:3001，生产环境为空字符串
 */
export const getServerBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL;
    if (url.endsWith('/api')) {
      return url.slice(0, -4);
    }
    return url;
  }
  if (import.meta.env.PROD) {
    return '';
  }
  return 'http://localhost:3001';
};

/**
 * 构建通用认证请求头（含访客ID、签名和工作区ID）
 * 用于非 axios 的请求（如 fetch SSE 流式请求），确保请求头注入逻辑与 axios 拦截器一致
 * @param acceptSSE - 是否添加 SSE Accept 头
 * @returns Promise，resolve 为请求头对象，包含 Content-Type 和可选的 X-Visitor-Id、X-Visitor-Token、X-Visitor-Ts、X-Workspace-Id
 */
export const buildAuthHeaders = async (acceptSSE: boolean = false): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (acceptSSE) {
    headers['Accept'] = 'text/event-stream';
  }
  const visitorId = getLocalVisitorId();
  if (visitorId) {
    headers['X-Visitor-Id'] = visitorId;
    const secret = getLocalVisitorSecret();
    if (secret) {
      try {
        const { token, ts } = await generateVisitorToken(visitorId, secret);
        headers['X-Visitor-Token'] = token;
        headers['X-Visitor-Ts'] = ts;
      } catch (err) {
        console.error('生成访客签名失败:', err);
      }
    }
  }
  const workspaceId = getLocalWorkspaceId();
  if (workspaceId) {
    headers['X-Workspace-Id'] = workspaceId;
  }
  return headers;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器：自动添加访客ID、签名和工作区ID请求头
 * 签名通过 Web Crypto API 异步生成，拦截器返回 Promise
 */
api.interceptors.request.use(async (config) => {
  const visitorId = getLocalVisitorId();
  if (visitorId) {
    config.headers['X-Visitor-Id'] = visitorId;
    const secret = getLocalVisitorSecret();
    if (secret) {
      try {
        const { token, ts } = await generateVisitorToken(visitorId, secret);
        config.headers['X-Visitor-Token'] = token;
        config.headers['X-Visitor-Ts'] = ts;
      } catch (err) {
        console.error('生成访客签名失败:', err);
      }
    }
  }

  const workspaceId = getLocalWorkspaceId();
  if (workspaceId) {
    config.headers['X-Workspace-Id'] = workspaceId;
  }

  return config;
});

/**
 * 封禁/关闭状态错误接口
 */
export interface BannedError {
  success: false;
  error: string;
  code: 'BANNED' | 'WORKSPACE_CLOSED' | 'IP_BANNED';
}

/**
 * 判断错误是否为封禁/关闭状态错误
 * @param error - 错误对象
 * @returns 是否为封禁/关闭状态错误
 */
export function isBannedOrClosedError(error: unknown): error is { response: { status: number; data: BannedError } } {
  if (!error || typeof error !== 'object') return false;
  const err = error as { response?: { status?: number; data?: { code?: string } } };
  return err?.response?.status === 403 &&
    (err?.response?.data?.code === 'BANNED' || err?.response?.data?.code === 'WORKSPACE_CLOSED' || err?.response?.data?.code === 'IP_BANNED');
}

/**
 * 可重试的请求配置
 * 扩展 axios 配置类型，增加 _retried 标记防止重复重试
 */
interface RetriableRequestConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    // 401 签名过期自动重试：重新生成签名并重试一次
    const originalRequest = error.config as RetriableRequestConfig | undefined;
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retried &&
      error.response?.data?.error === '认证已过期'
    ) {
      originalRequest._retried = true;
      const visitorId = getLocalVisitorId();
      const secret = getLocalVisitorSecret();
      if (visitorId && secret) {
        try {
          const { token, ts } = await generateVisitorToken(visitorId, secret);
          originalRequest.headers['X-Visitor-Token'] = token;
          originalRequest.headers['X-Visitor-Ts'] = ts;
          return api(originalRequest);
        } catch (err) {
          console.error('重试生成签名失败:', err);
        }
      }
    }

    if (error.response?.status === 403) {
      const data = error.response.data as BannedError | undefined;
      if (data?.code === 'BANNED') {
        localStorage.removeItem('visitorId');
        localStorage.removeItem('visitorSecret');
        window.dispatchEvent(new CustomEvent('auth:banned', {
          detail: { error: data.error, code: data.code }
        }));
      } else if (data?.code === 'WORKSPACE_CLOSED') {
        localStorage.removeItem('currentWorkspaceId');
        window.dispatchEvent(new CustomEvent('auth:workspace-closed', {
          detail: { error: data.error, code: data.code }
        }));
      } else if (data?.code === 'IP_BANNED') {
        window.dispatchEvent(new CustomEvent('auth:ip-banned', {
          detail: { error: data.error, code: data.code }
        }));
      }
    }
    console.error('API错误:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface NodeData {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  type: 'default' | 'conclusion';
  isRoot: boolean;
  isComposite: boolean;
  compositeChildren?: string[];
  compositeParent?: string;
  hidden?: boolean;
  expanded?: boolean;
  conversationId?: string | null;
  position: { x: number; y: number };
  tags: string[];
  parentIds: string[];
  childrenIds: string[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RelationData {
  id: string;
  workspaceId: string;
  sourceId: string;
  targetId: string;
  type: string;
  description?: string;
  createdAt: string;
}

export interface ConversationData {
  id: string;
  nodeId: string;
  workspaceId: string;
  messages: MessageData[];
  contextConfig: {
    includeParentHistory: boolean;
    includeRelatedNodes: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface MessageData {
  _id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * 访客API
 */
export const visitorApi = {
  register: (visitorId?: string, nickname?: string) =>
    api.post<{ success: boolean; data: IVisitor }>('/workspaces/visitor/register', { visitorId, nickname }),

  get: (visitorId: string) =>
    api.get<{ success: boolean; data: IVisitor }>(`/workspaces/visitor/${visitorId}`),
};

/**
 * 工作区API
 */
export const workspaceApi = {
  create: (name: string, type: WorkspaceType = 'public', description?: string) =>
    api.post<{ success: boolean; data: IWorkspace }>('/workspaces', { name, type, description }),

  getMine: () =>
    api.get<{ success: boolean; data: IWorkspace[] }>('/workspaces/mine'),

  getPublic: () =>
    api.get<{ success: boolean; data: IWorkspace[] }>('/workspaces/public/list'),

  get: (workspaceId: string) =>
    api.get<{ success: boolean; data: IWorkspace }>(`/workspaces/${workspaceId}`),

  join: (workspaceId: string, inviteCode?: string) =>
    api.post<{ success: boolean; data: IWorkspace }>(`/workspaces/${workspaceId}/join`, { inviteCode }),

  joinByCode: (inviteCode: string) =>
    api.post<{ success: boolean; data: IWorkspace }>('/workspaces/join-by-code', { inviteCode }),

  leave: (workspaceId: string) =>
    api.post<{ success: boolean }>(`/workspaces/${workspaceId}/leave`),

  update: (workspaceId: string, updates: Partial<Pick<IWorkspace, 'name' | 'description' | 'type'>>) =>
    api.put<{ success: boolean; data: IWorkspace }>(`/workspaces/${workspaceId}`, updates),

  refreshInvite: (workspaceId: string) =>
    api.post<{ success: boolean; data: { inviteCode: string } }>(`/workspaces/${workspaceId}/refresh-invite`),

  removeMember: (workspaceId: string, targetVisitorId: string) =>
    api.post<{ success: boolean }>(`/workspaces/${workspaceId}/remove-member`, { targetVisitorId }),

  delete: (workspaceId: string) =>
    api.delete<{ success: boolean }>(`/workspaces/${workspaceId}`),
};

/**
 * 节点API
 */
export const nodeApi = {
  getAll: () => api.get<{ success: boolean; data: { nodes: NodeData[]; relations: RelationData[] } }>('/nodes'),

  getById: (id: string) => api.get<{ success: boolean; data: NodeData }>(`/nodes/${id}`),

  create: (data: Partial<NodeData>) => api.post<{ success: boolean; data: NodeData }>('/nodes', data),

  update: (id: string, data: Partial<NodeData>) =>
    api.put<{ success: boolean; data: NodeData }>(`/nodes/${id}`, data),

  delete: (id: string) => api.delete<{ success: boolean }>(`/nodes/${id}`),

  createChild: (parentId: string, title: string, childData?: { id?: string; position?: { x: number; y: number } }) =>
    api.post<{ success: boolean; data: NodeData }>(`/nodes/${parentId}/child`, { title, ...childData }),

  getRoots: () => api.get<{ success: boolean; data: NodeData[] }>('/nodes/roots/list'),

  createRelation: (data: { id?: string; sourceId: string; targetId: string; type: string; description?: string }) =>
    api.post<{ success: boolean; data: RelationData }>('/nodes/relations', data),

  deleteRelation: (id: string) =>
    api.delete<{ success: boolean }>(`/nodes/relations/${id}`),

  /**
   * 导出工作区数据
   * @param format - 导出格式：json 或 markdown
   * @returns 导出数据（JSON格式返回对象，Markdown格式返回字符串）
   */
  exportData: (format: 'json' | 'markdown' = 'json') => {
    const config = format === 'markdown'
      ? { responseType: 'text' as const, transformResponse: [(data: string) => data] }
      : {};
    return api.get(`/nodes/export`, { params: { format }, ...config });
  },

  /**
   * 批量导入数据到工作区
   * @param format - 导入格式：json 或 markdown
   * @param data - 导入数据字符串
   * @returns 导入结果计数
   */
  importData: (format: 'json' | 'markdown', data: string) =>
    api.post<{ success: boolean; data: { nodes: number; relations: number; conversations: number } }>(
      '/nodes/import',
      { format, data }
    ),
};

/**
 * 对话API
 */
export const conversationApi = {
  getByNodeId: (nodeId: string, conversationId?: string) =>
    api.get<{ success: boolean; data: ConversationData }>(`/conversations/${nodeId}`, {
      params: conversationId ? { id: conversationId } : undefined,
    }),

  sendMessage: (nodeId: string, content: string, model?: string, fileIds?: string[]) =>
    api.post<{ success: boolean; data: { userMessage: string; assistantMessage?: string; error?: string } }>(
      `/conversations/${nodeId}/message`,
      { content, role: 'user', model, fileIds }
    ),

  saveMessage: (nodeId: string, role: string, content: string) =>
    api.post<{ success: boolean; data: { _id: string; role: string; content: string; timestamp: string } }>(
      `/conversations/${nodeId}/save-message`,
      { role, content }
    ),

  clear: (nodeId: string) =>
    api.delete<{ success: boolean }>(`/conversations/${nodeId}`),

  list: () =>
    api.get<{ success: boolean; data: ConversationData[] }>('/conversations/list'),

  /**
   * 生成对话标题
   * 根据对话消息内容调用AI生成精炼标题
   * @param messages - 对话消息列表
   * @param parentNodeTitle - 父节点标题，用于保持语义连贯
   * @returns 生成的标题文本
   */
  generateTitle: async (messages: Array<{ role: string; content: string }>, parentNodeTitle?: string, language?: string): Promise<string> => {
    const body: Record<string, unknown> = { messages, parentNodeTitle };
    if (language) body.language = language;
    const response = await api.post<{ success: boolean; title: string }>('/conversations/generate-title', body);
    return (response as unknown as { success: boolean; title: string }).title;
  },

  /**
   * 提炼对话结论
   * 根据节点对话内容调用AI提炼核心结论
   * @param nodeId - 节点ID
   * @returns 提炼结果，包含成功标志和结论文本
   */
  extractConclusion: async (nodeId: string, language?: string): Promise<{ success: boolean; conclusion: string }> => {
    const body: Record<string, unknown> = { nodeId };
    if (language) body.language = language;
    const response = await api.post<{ success: boolean; conclusion: string }>('/conversations/extract-conclusion', body);
    return (response as unknown as { success: boolean; conclusion: string });
  },

  /**
   * 分页查询对话消息
   * 从独立 messages 集合查询，支持 cursor 分页加载更早的消息
   * @param conversationId - 对话ID
   * @param limit - 每页数量，默认50
   * @param beforeTimestamp - cursor 分页游标，查询此时间之前的消息
   * @returns 分页查询结果，包含消息列表和是否还有更多消息的标志
   */
  getConversationMessages: (conversationId: string, limit?: number, beforeTimestamp?: string) =>
    api.get<{ success: boolean; data: { messages: MessageData[]; hasMore: boolean } }>(
      `/conversations/${conversationId}/messages`,
      {
        params: {
          ...(limit ? { limit } : {}),
          ...(beforeTimestamp ? { beforeTimestamp } : {}),
        },
      }
    ),
};

/**
 * 搜索API
 */
export const searchApi = {
  search: (query: string, type: 'text' | 'semantic' | 'hybrid' = 'text') =>
    api.get<{ success: boolean; data: Array<{ nodeId: string; score: number; matches: string[] }> }>(
      '/search',
      { params: { q: query, type } }
    ),

  searchByTags: (tags: string[]) =>
    api.get<{ success: boolean; data: Array<{ nodeId: string; score: number; matches: string[] }> }>(
      '/search',
      { params: { tags: tags.join(',') } }
    ),

  getRelated: (nodeId: string, depth: number = 2) =>
    api.get<{ success: boolean; data: Array<{ nodeId: string; score: number; matches: string[] }> }>(
      `/search/related/${nodeId}`,
      { params: { depth } }
    ),
};

/**
 * AI API
 */
export const aiApi = {
  chat: (messages: Array<{ role: string; content: string }>, config: {
    model?: string;
    temperature?: number;
    apiKey?: string;
  }) => api.post<{ success: boolean; content?: string; error?: string }>('/ai/chat', {
    messages,
    ...config,
  }),

  getModels: () => api.get<{ success: boolean; data: string[] }>('/ai/models'),
};

/**
 * 文件信息接口
 */
export interface FileInfo {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  workspaceId: string;
  uploadedBy: string;
  createdAt: string;
}

/**
 * 文件API
 */
export const fileApi = {
  /**
   * 上传文件到工作区
   * @param files - 文件列表
   * @returns 上传结果
   */
  upload: (files: File[]) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    return api.post<{
      success: boolean;
      data: {
        uploaded: Array<{ id: string; originalName: string; size: number; mimeType: string }>;
        errors: Array<{ filename: string; error: string }>;
      };
    }>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000,
    });
  },

  /**
   * 获取工作区文件列表
   * @returns 文件列表
   */
  list: () =>
    api.get<{ success: boolean; data: FileInfo[] }>('/files/list'),

  /**
   * 获取单个文件信息
   * @param fileId - 文件ID
   * @returns 文件信息
   */
  getById: (fileId: string) =>
    api.get<{ success: boolean; data: FileInfo }>(`/files/${fileId}`),

  /**
   * 删除文件
   * @param fileId - 文件ID
   * @returns 是否成功
   */
  delete: (fileId: string) =>
    api.delete<{ success: boolean }>(`/files/${fileId}`),
};

/**
 * 功能开关可见性映射接口
 * 键为功能开关键名，值为是否对当前用户可见
 */
export interface FeatureVisibility {
  [key: string]: boolean;
}

/**
 * 功能开关API
 * 从 /api/features 获取当前用户的功能开关状态
 */
export const featuresApi = {
  /**
   * 获取当前用户可见的功能开关列表
   * 根据请求者的 userId/IP/workspaceId 评估灰度规则
   * @returns 功能开关可见性映射
   */
  fetchFeatures: (): Promise<FeatureVisibility> =>
    api.get<{ success: boolean; data: FeatureVisibility }>('/features')
      .then((res) => {
        const data = res as unknown as { success: boolean; data: FeatureVisibility };
        return data.data || {};
      })
      .catch((error: unknown) => {
        console.error('获取功能开关失败:', error);
        return {} as FeatureVisibility;
      }),
};

/**
 * 统一的 HTTP 客户端实例（axios）
 * 已配置 baseURL、请求拦截器（自动注入 X-Visitor-Id、X-Workspace-Id）
 * 和响应拦截器（返回 response.data、处理封禁状态）
 * 其他 service 文件应复用此实例，避免重复配置 baseURL 和请求头注入逻辑
 */
export const httpClient = api;

export default api;
