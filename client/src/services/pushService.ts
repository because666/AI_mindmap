import { Capacitor } from '@capacitor/core';
import { JPush } from 'capacitor-plugin-jpush';
import axios from 'axios';

/**
 * 获取 API 基础 URL
 */
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
 * 与主应用api.ts保持一致，确保推送服务使用相同的用户标识
 */
function getLocalVisitorId(): string | null {
  return localStorage.getItem('visitorId');
}

/**
 * 创建带用户标识的axios请求配置
 * @returns 包含X-Visitor-Id头的请求配置
 */
function getAuthConfig(): Record<string, unknown> {
  const visitorId = getLocalVisitorId();
  return {
    headers: visitorId ? { 'X-Visitor-Id': visitorId } : {},
  };
}

interface PushMessage {
  id: string;
  type: string;
  title: string;
  summary: string;
  senderName: string;
  createdAt: string;
  read: boolean;
  forceRead: boolean;
}

interface MessageDetail {
  id: string;
  type: string;
  title: string;
  content: string;
  senderName: string;
  createdAt: string;
  read: boolean;
  readAt?: string;
  forceRead?: boolean;
  forceReadDeadline?: string;
  workspaceInfo?: {
    id: string;
    name: string;
  };
  readStats?: {
    total: number;
    read: number;
    readRate: number;
  };
}

interface UnreadCount {
  total: number;
  broadcast: number;
  workspace: number;
  forceReadPending: number;
}

interface MessageListResponse {
  messages: PushMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

class PushClientService {
  private isInitialized = false;
  private registrationId: string | null = null;

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.isInitialized) {
      return;
    }

    try {
      await JPush.startJPush();
      this.isInitialized = true;
      console.log('[JPush] 初始化成功');

      JPush.addListener('notificationReceived', (data) => {
        console.log('[JPush] 收到通知:', data);
      });

      JPush.addListener('notificationOpened', (data: any) => {
        console.log('[JPush] 用户点击通知:', data);
        const messageId = data?.extras?.messageId || data?.messageId;
        if (messageId) {
          this.handleNotificationClick(messageId);
        }
      });

      const { registrationId } = await JPush.getRegistrationID();
      if (registrationId) {
        this.registrationId = registrationId;
        await this.registerDevice(registrationId);
      }

      JPush.checkPermissions().then(async ({ permission }) => {
        console.log('[JPush] 当前权限状态:', permission);
        if (permission !== 'granted') {
          await JPush.requestPermissions();
        }
      });
    } catch (error) {
      console.error('[JPush] 初始化失败:', error);
    }
  }

  private handleNotificationClick(messageId: string): void {
    window.dispatchEvent(
      new CustomEvent('push-notification-click', { detail: { messageId } })
    );
  }

  async registerDevice(registrationId: string): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/push/register`, {
        registrationId,
        platform: Capacitor.getPlatform(),
      }, getAuthConfig());
      return response.data.success === true;
    } catch (error) {
      console.error('[PushClient] 设备注册失败:', error);
      return false;
    }
  }

  async getMessageList(page: number = 1, limit: number = 20, type: string = 'all'): Promise<MessageListResponse> {
    try {
      const response = await axios.get(`${API_BASE_URL}/push/messages`, {
        params: { page, limit, type },
        ...getAuthConfig(),
      });
      return response.data.data;
    } catch (error) {
      console.error('[PushClient] 获取消息列表失败:', error);
      throw error;
    }
  }

  async getMessageDetail(messageId: string): Promise<MessageDetail> {
    try {
      const response = await axios.get(`${API_BASE_URL}/push/messages/${messageId}`, getAuthConfig());
      return response.data.data;
    } catch (error) {
      console.error('[PushClient] 获取消息详情失败:', error);
      throw error;
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await axios.post(`${API_BASE_URL}/push/messages/${messageId}/read`, {}, getAuthConfig());
      return response.data.success === true;
    } catch (error) {
      console.error('[PushClient] 标记已读失败:', error);
      throw error;
    }
  }

  async markAllAsRead(): Promise<number> {
    try {
      const response = await axios.post(`${API_BASE_URL}/push/messages/read-all`, {}, getAuthConfig());
      return response.data.data?.markedCount || 0;
    } catch (error) {
      console.error('[PushClient] 全部标记已读失败:', error);
      throw error;
    }
  }

  async getUnreadCount(): Promise<UnreadCount> {
    try {
      const response = await axios.get(`${API_BASE_URL}/push/messages/unread-count`, getAuthConfig());
      return response.data.data;
    } catch (error) {
      console.error('[PushClient] 获取未读数量失败:', error);
      return { total: 0, broadcast: 0, workspace: 0, forceReadPending: 0 };
    }
  }

  getRegistrationId(): string | null {
    return this.registrationId;
  }

  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }
}

export const pushClientService = new PushClientService();
export type { PushMessage, MessageDetail, UnreadCount, MessageListResponse };
