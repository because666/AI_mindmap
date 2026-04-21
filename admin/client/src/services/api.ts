import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

function typedGet<T>(url: string, config?: Record<string, unknown>) {
  return api.get<ApiResponse<T>>(url, config);
}

function typedPost<T>(url: string, data?: unknown, config?: Record<string, unknown>) {
  return api.post<ApiResponse<T>>(url, data, config);
}

function typedPut<T>(url: string, data?: unknown, config?: Record<string, unknown>) {
  return api.put<ApiResponse<T>>(url, data, config);
}

function typedDelete<T>(url: string, config?: Record<string, unknown>) {
  return api.delete<ApiResponse<T>>(url, config);
}

export const authApi = {
  checkIp: () => typedGet<{ allowed: boolean; isFirstVisit: boolean; hasPassword: boolean; nickname?: string }>('/auth/check-ip'),
  init: (password: string, confirmPassword: string) =>
    typedPost<{ ipAddress: string }>('/auth/init', { password, confirmPassword }),
  login: (password: string) =>
    typedPost<{ needNickname: boolean; sessionId?: string; nickname?: string }>('/auth/login', { password }),
  setNickname: (nickname: string) =>
    typedPost<{ sessionId: string }>('/auth/set-nickname', { nickname }),
  logout: () => typedPost<void>('/auth/logout'),
  me: () => typedGet<{ ipAddress: string; nickname: string; loginAt: string }>('/auth/me'),
};

export const dashboardApi = {
  getStats: () => typedGet<unknown>('/dashboard/stats'),
  getTrends: (type: string, days: number) =>
    typedGet<{ dates: string[]; values: number[] }>('/dashboard/trends', { params: { type, days } }),
};

export const usersApi = {
  getList: (params: { page?: number; limit?: number; status?: string; search?: string }) =>
    typedGet<unknown>('/admin/users', { params }),
  getDetail: (id: string) => typedGet<unknown>(`/admin/users/${id}`),
  ban: (id: string, reason: string, duration: number) =>
    typedPost<void>(`/admin/users/${id}/ban`, { reason, duration }),
  unban: (id: string, reason: string) =>
    typedPost<void>(`/admin/users/${id}/unban`, { reason }),
  delete: (id: string, confirmCode: string) =>
    typedDelete<void>(`/admin/users/${id}`, { headers: { 'X-Confirm-Code': confirmCode } }),
};

export const workspacesApi = {
  getList: (params: { page?: number; limit?: number; search?: string }) =>
    typedGet<unknown>('/admin/workspaces', { params }),
  getDetail: (id: string) => typedGet<unknown>(`/admin/workspaces/${id}`),
  getContent: (id: string) => typedGet<unknown>(`/admin/workspaces/${id}/content`),
  close: (id: string, reason: string) =>
    typedPost<void>(`/admin/workspaces/${id}/close`, { reason }),
  notify: (id: string, title: string, content: string) =>
    typedPost<void>(`/admin/workspaces/${id}/notify`, { title, content }),
};

export const auditApi = {
  getConfig: () => typedGet<unknown>('/admin/audit/config'),
  updateConfig: (config: Record<string, unknown>) => typedPut<void>('/admin/audit/config', config),
  getMessages: (params: { page?: number; limit?: number; riskLevel?: string; status?: string }) =>
    typedGet<unknown>('/admin/audit/messages', { params }),
  scan: (startTime: string, endTime: string) =>
    typedPost<unknown>('/admin/audit/scan', { startTime, endTime }),
  markSafe: (id: string, reason: string) =>
    typedPost<void>(`/admin/audit/${id}/mark-safe`, { reason }),
  deleteMessage: (id: string, reason: string) =>
    typedDelete<void>(`/admin/audit/${id}/message`, { data: { reason } }),
};

export const pushApi = {
  broadcast: (data: {
    title: string;
    content: string;
    targetType?: string;
    targetUserIds?: string[];
    forceRead?: boolean;
  }) => typedPost<{ messageId: string }>('/admin/push/broadcast', data),
  getMessages: (params: { page?: number; limit?: number }) =>
    typedGet<unknown>('/admin/push/messages', { params }),
  getStats: (id: string) => typedGet<unknown>(`/admin/push/messages/${id}/stats`),
};

export const settingsApi = {
  getIpWhitelist: () => typedGet<{ whitelist: unknown[]; currentIp: string }>('/admin/settings/ip-whitelist'),
  addIp: (ipAddress: string, nickname: string, description?: string) =>
    typedPost<void>('/admin/settings/ip-whitelist', { ipAddress, nickname, description }),
  removeIp: (ip: string, confirm?: boolean) =>
    typedDelete<void>(`/admin/settings/ip-whitelist/${ip}`, { data: { confirm } }),
  changePassword: (oldPassword: string, newPassword: string, confirmPassword: string) =>
    typedPost<void>('/admin/settings/password', { oldPassword, newPassword, confirmPassword }),
  getFeatures: () => typedGet<unknown>('/admin/settings/features'),
  updateFeatures: (features: Record<string, boolean>) =>
    typedPut<void>('/admin/settings/features', features),
};

export const exportApi = {
  create: (type: string, format: string, filter?: Record<string, unknown>) =>
    typedPost<{ exportId: string; status: string }>('/admin/export', { type, format, filter }),
  getStatus: (id: string) => typedGet<unknown>(`/admin/export/${id}/status`),
  download: (id: string) => api.get(`/admin/export/${id}/download`, { responseType: 'blob' }),
};

export default api;
