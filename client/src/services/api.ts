import axios from 'axios';
import type { IWorkspace, IVisitor, WorkspaceType } from '../types';

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.PROD) {
    return '';
  }
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * 获取本地存储的访客ID
 * @returns 访客ID或null
 */
const getLocalVisitorId = (): string | null => {
  return localStorage.getItem('visitorId');
};

/**
 * 获取本地存储的当前工作区ID
 * @returns 工作区ID或null
 */
const getLocalWorkspaceId = (): string | null => {
  return localStorage.getItem('currentWorkspaceId');
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 请求拦截器：自动添加访客ID和工作区ID请求头
 */
api.interceptors.request.use((config) => {
  const visitorId = getLocalVisitorId();
  if (visitorId) {
    config.headers['X-Visitor-Id'] = visitorId;
  }

  const workspaceId = getLocalWorkspaceId();
  if (workspaceId) {
    config.headers['X-Workspace-Id'] = workspaceId;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API错误:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export interface NodeData {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
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
};

/**
 * 对话API
 */
export const conversationApi = {
  getByNodeId: (nodeId: string, conversationId?: string) =>
    api.get<{ success: boolean; data: ConversationData }>(`/conversations/${nodeId}`, {
      params: conversationId ? { id: conversationId } : undefined,
    }),

  sendMessage: (nodeId: string, content: string, model?: string) =>
    api.post<{ success: boolean; data: { userMessage: string; assistantMessage?: string; error?: string } }>(
      `/conversations/${nodeId}/message`,
      { content, role: 'user', model }
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

export default api;
