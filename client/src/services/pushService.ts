import { Capacitor } from '@capacitor/core';
import { JPush, type ReceiveNotificationData } from 'capacitor-plugin-jpush';
import { httpClient } from './api';

interface PushMessage {
  id: string;
  type: string;
  title: string;
  summary: string;
  senderName: string;
  createdAt: string;
  read: boolean;
  forceRead: boolean;
  forceReadDeadline?: string;
  displayType?: 'banner' | 'dot';
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
  displayType?: 'banner' | 'dot';
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

/**
 * 通知点击事件的扩展数据类型
 * 在 ReceiveNotificationData 基础上增加业务用于定位消息的 messageId 字段
 */
interface NotificationOpenedData extends ReceiveNotificationData {
  /** 消息唯一标识，可能直接位于数据根节点 */
  messageId?: string;
  /** 扩展信息，部分场景下 messageId 会放在 extras 中 */
  extras?: {
    messageId?: string;
  };
}

class PushClientService {
  private isInitialized = false;
  private registrationId: string | null = null;

  /**
   * 初始化极光推送服务
   * 仅在原生平台执行，依次为：启动服务、注册监听器、获取注册 ID、检查/申请通知权限
   * 每个步骤独立捕获异常，避免单点失败导致后续逻辑中断
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.isInitialized) {
      return;
    }

    try {
      await JPush.startJPush();
      this.isInitialized = true;
    } catch (error) {
      console.error('[JPush] 启动失败:', error);
      return;
    }

    try {
      await JPush.addListener('notificationReceived', () => {
      });
    } catch (error) {
      console.warn('[JPush] 注册通知接收监听器失败:', error);
    }

    try {
      await JPush.addListener('notificationOpened', (data: NotificationOpenedData) => {
        const messageId = data?.extras?.messageId || data?.messageId;
        if (messageId) {
          this.handleNotificationClick(messageId);
        }
      });
    } catch (error) {
      console.warn('[JPush] 注册通知点击监听器失败:', error);
    }

    try {
      const { registrationId } = await JPush.getRegistrationID();
      if (registrationId) {
        this.registrationId = registrationId;
        await this.registerDevice(registrationId);
      }
    } catch (error) {
      console.warn('[JPush] 获取注册 ID 或上报设备失败:', error);
    }

    try {
      const { permission } = await JPush.checkPermissions();
      if (permission !== 'granted') {
        await JPush.requestPermissions();
      }
    } catch (error) {
      console.warn('[JPush] 检查或申请通知权限失败:', error);
    }
  }

  private handleNotificationClick(messageId: string): void {
    window.dispatchEvent(
      new CustomEvent('push-notification-click', { detail: { messageId } })
    );
  }

  async registerDevice(registrationId: string): Promise<boolean> {
    try {
      const response = await httpClient.post('/push/register', {
        registrationId,
        platform: Capacitor.getPlatform(),
      }) as unknown as { success: boolean };
      return response.success === true;
    } catch (error) {
      console.error('[PushClient] 设备注册失败:', error);
      return false;
    }
  }

  async getMessageList(page: number = 1, limit: number = 20, type: string = 'all'): Promise<MessageListResponse> {
    try {
      const response = await httpClient.get('/push/messages', {
        params: { page, limit, type },
      }) as unknown as { success: boolean; data: MessageListResponse };
      return response.data;
    } catch (error) {
      console.error('[PushClient] 获取消息列表失败:', error);
      throw error;
    }
  }

  async getMessageDetail(messageId: string): Promise<MessageDetail> {
    try {
      const response = await httpClient.get(`/push/messages/${messageId}`) as unknown as { success: boolean; data: MessageDetail };
      return response.data;
    } catch (error) {
      console.error('[PushClient] 获取消息详情失败:', error);
      throw error;
    }
  }

  async markAsRead(messageId: string): Promise<boolean> {
    try {
      const response = await httpClient.post(`/push/messages/${messageId}/read`) as unknown as { success: boolean };
      return response.success === true;
    } catch (error) {
      console.error('[PushClient] 标记已读失败:', error);
      throw error;
    }
  }

  async markAllAsRead(): Promise<number> {
    try {
      const response = await httpClient.post('/push/messages/read-all') as unknown as { success: boolean; data: { markedCount?: number } };
      return response.data?.markedCount || 0;
    } catch (error) {
      console.error('[PushClient] 全部标记已读失败:', error);
      throw error;
    }
  }

  async getUnreadCount(): Promise<UnreadCount> {
    try {
      const response = await httpClient.get('/push/messages/unread-count') as unknown as { success: boolean; data: UnreadCount };
      return response.data;
    } catch (error) {
      console.error('[PushClient] 获取未读数量失败:', error);
      return { total: 0, broadcast: 0, workspace: 0, forceReadPending: 0 };
    }
  }

  /**
   * 获取 banner 类型的未读消息列表
   * 调用 GET /api/push/messages 接口，筛选 displayType='banner' 且未读的消息
   * @returns banner 类型的未读消息列表
   */
  async getBannerMessages(): Promise<PushMessage[]> {
    try {
      const response = await httpClient.get('/push/messages', {
        params: { page: 1, limit: 10, type: 'broadcast' },
      }) as unknown as { success: boolean; data: MessageListResponse };
      const data = response.data;
      const messages = data?.messages || [];
      return messages.filter((msg) => msg.displayType === 'banner' && !msg.read);
    } catch (error) {
      console.error('[PushClient] 获取 banner 消息失败:', error);
      return [];
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
