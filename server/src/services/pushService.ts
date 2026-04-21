import axios from 'axios';
import { ObjectId } from 'mongodb';
import { config } from '../config';
import { mongoDBService } from '../data/mongodb/connection';
import {
  UserDevice,
  PushMessage,
  PushMessageType,
  MessageRecipient,
  MessageStats,
  BroadcastOptions,
  WorkspaceNotificationOptions,
} from '../types/push';

const JPUSH_API_URL = 'https://api.jpush.cn/v3/push';
const JPUSH_REPORT_URL = 'https://report.jpush.cn/v3';

class PushService {
  private appKey: string;
  private masterSecret: string;
  private base64Auth: string;

  constructor() {
    this.appKey = process.env.JPUSH_APPKEY || '';
    this.masterSecret = process.env.JPUSH_MASTER_SECRET || '';
    this.base64Auth = Buffer.from(`${this.appKey}:${this.masterSecret}`).toString('base64');
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Basic ${this.base64Auth}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * 提取消息摘要，取前100个字符
   */
  private extractSummary(content: string, maxLength: number = 100): string {
    const plainText = content.replace(/[#*_`~\[\]()]/g, '').trim();
    if (plainText.length <= maxLength) {
      return plainText;
    }
    return plainText.substring(0, maxLength) + '...';
  }

  /**
   * 注册设备信息，将极光Registration ID与用户关联
   * @param userId 用户ID
   * @param registrationId 极光SDK返回的设备标识
   * @param platform 设备平台
   * @param deviceModel 设备型号（可选）
   * @param appVersion App版本（可选）
   */
  async registerDevice(
    userId: string,
    registrationId: string,
    platform: 'android' | 'ios',
    deviceModel?: string,
    appVersion?: string
  ): Promise<void> {
    const collection = mongoDBService.getCollection<UserDevice>('user_devices');
    if (!collection) {
      throw new Error('数据库连接不可用');
    }

    const now = new Date();
    await collection.updateOne(
      { registrationId },
      {
        $set: {
          userId,
          registrationId,
          platform,
          isActive: true,
          updatedAt: now,
          ...(deviceModel && { deviceModel }),
          ...(appVersion && { appVersion }),
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );
  }

  /**
   * 获取用户的所有活跃设备
   * @param userId 用户ID
   * @returns 设备注册ID列表
   */
  async getUserDevices(userId: string): Promise<string[]> {
    const collection = mongoDBService.getCollection<UserDevice>('user_devices');
    if (!collection) {
      return [];
    }

    const devices = await collection.find(
      { userId, isActive: true },
      { projection: { registrationId: 1 } }
    ).toArray();

    return devices.map((d) => d.registrationId);
  }

  /**
   * 获取多个用户的所有活跃设备（去重）
   * @param userIds 用户ID列表
   * @returns 设备注册ID列表
   */
  async getUsersDevices(userIds: string[]): Promise<string[]> {
    const collection = mongoDBService.getCollection<UserDevice>('user_devices');
    if (!collection || userIds.length === 0) {
      return [];
    }

    const devices = await collection.find(
      { userId: { $in: userIds }, isActive: true },
      { projection: { registrationId: 1 } }
    ).toArray();

    const uniqueIds = new Set<string>();
    devices.forEach((d) => uniqueIds.add(d.registrationId));
    return Array.from(uniqueIds);
  }

  /**
   * 发送广播消息（场景A - 超级广播）
   * @param options 广播选项
   * @returns 创建的消息记录
   */
  async sendBroadcast(options: BroadcastOptions): Promise<PushMessage> {
    const {
      title,
      content,
      summary,
      targetType,
      targetUserIds,
      scheduledAt,
      forceRead = true,
      forceReadDeadline,
    } = options;

    let targetUsers: string[] = [];

    if (targetType === 'all' || targetType === 'active_users' as string) {
      const userCollection = mongoDBService.getCollection<any>('users');
      if (userCollection) {
        const users = await userCollection.find({}).toArray();
        targetUsers = users.map((u) => u.id?.toString() || u._id?.toString());
      }
      
      if (targetUsers.length === 0) {
        targetUsers = ['all-users'];
      }
    } else if (targetType === 'specific_users' && targetUserIds) {
      targetUsers = targetUserIds;
    }

    const messageRecipients: MessageRecipient[] = targetUsers.map((userId) => ({
      userId,
      delivered: false,
      read: false,
      forcedRead: forceRead,
    }));

    const now = new Date();
    const expireAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const deadline = forceReadDeadline || (forceRead ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) : undefined);

    const messageData: Omit<PushMessage, '_id'> = {
      type: 'broadcast',
      title,
      content,
      summary: summary || this.extractSummary(content),
      senderType: 'admin',
      targetType,
      targetUserIds: targetUsers,
      createdAt: now,
      scheduledAt,
      sentAt: null,
      expireAt,
      recipients: messageRecipients,
      stats: {
        totalCount: targetUsers.length,
        deliveredCount: 0,
        readCount: 0,
        readRate: 0,
      },
      forceRead,
      forceReadDeadline: deadline,
    };

    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) {
      throw new Error('数据库连接不可用');
    }

    const result = await collection.insertOne(messageData as any);
    const messageId = result.insertedId.toString();
    const message = { ...messageData, _id: result.insertedId } as PushMessage;

    if (!scheduledAt) {
      await this.sendPushNotification(messageId, title, content, targetUsers);
      await collection.updateOne(
        { _id: result.insertedId },
        { $set: { sentAt: now } }
      );
      message.sentAt = now;
    }

    return message;
  }

  /**
   * 发送工作区通知（场景C - 工作区通知）
   * @param options 工作区通知选项
   * @returns 创建的消息记录
   */
  async sendWorkspaceNotification(options: WorkspaceNotificationOptions): Promise<PushMessage> {
    const { workspaceId, senderId, title, content, importance = 'normal' } = options;

    const memberCollection = mongoDBService.getCollection<any>('workspace_members');
    if (!memberCollection) {
      throw new Error('数据库连接不可用');
    }

    const members = await memberCollection.find({
      workspaceId,
      userId: { $ne: senderId },
    }).toArray();

    const targetUserIds = members.map((m) => m.visitorId || m.userId);

    const userCollection = mongoDBService.getCollection<any>('users');
    let senderName = '未知用户';
    if (userCollection && senderId) {
      const sender = await userCollection.findOne({ id: senderId });
      if (sender) {
        senderName = sender.nickname || sender.name || '未知用户';
      }
    }

    const now = new Date();
    const expireAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const messageRecipients: MessageRecipient[] = targetUserIds.map((userId) => ({
      userId,
      delivered: false,
      read: false,
      forcedRead: true,
    }));

    const messageData: Omit<PushMessage, '_id'> = {
      type: 'workspace_manual',
      title,
      content,
      summary: this.extractSummary(content),
      senderType: 'user',
      senderId,
      senderName,
      targetType: 'workspace_members',
      targetWorkspaceId: workspaceId,
      targetUserIds,
      createdAt: now,
      sentAt: null,
      expireAt,
      recipients: messageRecipients,
      stats: {
        totalCount: targetUserIds.length,
        deliveredCount: 0,
        readCount: 0,
        readRate: 0,
      },
      forceRead: true,
      forceReadDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    };

    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) {
      throw new Error('数据库连接不可用');
    }

    const result = await collection.insertOne(messageData as any);
    const messageId = result.insertedId.toString();
    const message = { ...messageData, _id: result.insertedId } as PushMessage;

    if (importance === 'high') {
      await this.sendPushNotification(messageId, title, content, targetUserIds);
      await collection.updateOne(
        { _id: result.insertedId },
        { $set: { sentAt: now } }
      );
      message.sentAt = now;
    }

    return message;
  }

  /**
   * 发送工作区自动运营数据推送（场景B）
   * @param workspaceId 工作区ID
   * @param title 推送标题
   * @param content 推送内容（Markdown格式）
   * @param targetUserIds 目标用户ID列表
   */
  async sendWorkspaceAutoNotification(
    workspaceId: string,
    title: string,
    content: string,
    targetUserIds: string[]
  ): Promise<PushMessage> {
    const now = new Date();
    const expireAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const messageRecipients: MessageRecipient[] = targetUserIds.map((userId) => ({
      userId,
      delivered: false,
      read: false,
      forcedRead: true,
    }));

    const messageData: Omit<PushMessage, '_id'> = {
      type: 'workspace_auto',
      title,
      content,
      summary: this.extractSummary(content),
      senderType: 'system',
      targetType: 'workspace_admins',
      targetWorkspaceId: workspaceId,
      targetUserIds,
      createdAt: now,
      sentAt: now,
      expireAt,
      recipients: messageRecipients,
      stats: {
        totalCount: targetUserIds.length,
        deliveredCount: 0,
        readCount: 0,
        readRate: 0,
      },
      forceRead: true,
      forceReadDeadline: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    };

    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) {
      throw new Error('数据库连接不可用');
    }

    const result = await collection.insertOne(messageData as any);
    const message = { ...messageData, _id: result.insertedId } as PushMessage;

    await this.sendPushNotification(result.insertedId.toString(), title, content, targetUserIds);

    return message;
  }

  /**
   * 调用极光REST API发送推送通知
   * @param messageId 消息ID（附加在extras中）
   * @param title 通知标题
   * @param content 通知内容
   * @param targetUserIds 目标用户ID列表
   */
  private async sendPushNotification(
    messageId: string,
    title: string,
    content: string,
    targetUserIds: string[]
  ): Promise<void> {
    try {
      const registrationIds = await this.getUsersDevices(targetUserIds);

      if (registrationIds.length === 0) {
        console.log(`[Push] 无可用设备，消息 ${messageId} 已保存但未发送`);
        return;
      }

      const batchSize = parseInt(process.env.PUSH_BROADCAST_BATCH_SIZE || '1000', 10);

      for (let i = 0; i < registrationIds.length; i += batchSize) {
        const batch = registrationIds.slice(i, i + batchSize);

        const payload = {
          platform: 'android',
          audience: {
            registration_id: batch,
          },
          notification: {
            alert: title,
            android: {
              title,
              alert: content.substring(0, 50),
              extras: {
                messageId,
                type: 'push_message',
              },
            },
          },
          options: {
            time_to_live: 86400,
            apns_production: process.env.NODE_ENV === 'production',
          },
        };

        await axios.post(JPUSH_API_URL, payload, {
          headers: this.getAuthHeaders(),
          timeout: 30000,
        });

        if (i + batchSize < registrationIds.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(`[Push] 消息 ${messageId} 发送成功，目标设备数: ${registrationIds.length}`);
    } catch (error: any) {
      console.error(`[Push] 消息 ${messageId} 发送失败:`, error.message);
      throw error;
    }
  }

  /**
   * 处理送达回执回调
   * @param messageId 消息ID
   * @param registrationId 设备注册ID
   */
  async handleDeliveryReceipt(messageId: string, registrationId: string): Promise<void> {
    const deviceCollection = mongoDBService.getCollection<UserDevice>('user_devices');
    if (!deviceCollection) return;

    const device = await deviceCollection.findOne({ registrationId });
    if (!device) return;

    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) return;

    const now = new Date();
    await collection.updateOne(
      { _id: new ObjectId(messageId), 'recipients.userId': device.userId },
      {
        $set: {
          'recipients.$.delivered': true,
          'recipients.$.deliveredAt': now,
        },
      }
    );

    await this.updateMessageStats(messageId);
  }

  /**
   * 标记消息为已读
   * @param messageId 消息ID
   * @param userId 用户ID
   */
  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) return false;

    const now = new Date();
    const result = await collection.updateOne(
      { _id: new ObjectId(messageId), 'recipients.userId': userId },
      {
        $set: {
          'recipients.$.read': true,
          'recipients.$.readAt': now,
        },
      }
    );

    if (result.modifiedCount > 0) {
      await this.updateMessageStats(messageId);
      return true;
    }

    return false;
  }

  /**
   * 标记所有消息为已读
   * @param userId 用户ID
   * @returns 标记为已读的消息数量
   */
  async markAllAsRead(userId: string): Promise<number> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) return 0;

    const now = new Date();
    const result = await collection.updateMany(
      {
        'recipients.userId': userId,
        'recipients.read': false,
      },
      {
        $set: {
          'recipients.$[elem].read': true,
          'recipients.$[elem].readAt': now,
        },
      },
      {
        arrayFilters: [{ 'elem.userId': userId, 'elem.read': false }],
      }
    );

    return result.modifiedCount;
  }

  /**
   * 获取用户的未读消息数量
   * @param userId 用户ID
   * @returns 未读数量统计
   */
  async getUnreadCount(userId: string): Promise<{
    total: number;
    broadcast: number;
    workspace: number;
    forceReadPending: number;
  }> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) {
      return { total: 0, broadcast: 0, workspace: 0, forceReadPending: 0 };
    }

    try {
      const messages = await collection
        .find({
          $or: [
            { 'recipients.userId': userId },
            { type: 'broadcast', 'recipients.userId': { $exists: false } },
            { type: 'broadcast', recipients: { $size: 0 } },
          ],
        })
        .toArray();

      let total = 0;
      let broadcast = 0;
      let workspace = 0;
      let forceReadPending = 0;
      const now = new Date();

      for (const msg of messages) {
        const recipient = msg.recipients?.find((r) => r.userId === userId);
        const isUnread = !recipient || !recipient.read;

        if (!isUnread) continue;

        total++;

        if (msg.type === 'broadcast') {
          broadcast++;
        } else {
          workspace++;
        }

        if (
          msg.forceRead &&
          (!msg.forceReadDeadline || msg.forceReadDeadline > now)
        ) {
          forceReadPending++;
        }
      }

      return { total, broadcast, workspace, forceReadPending };
    } catch (error) {
      console.error('[Push] 获取未读数量失败:', error);
      return { total: 0, broadcast: 0, workspace: 0, forceReadPending: 0 };
    }
  }

  /**
   * 获取用户的消息列表
   * @param userId 用户ID
   * @param page 页码
   * @param limit 每页条数
   * @param type 消息类型过滤
   * @returns 消息列表和分页信息
   */
  async getMessageList(
    userId: string,
    page: number = 1,
    limit: number = 20,
    type?: string
  ): Promise<{
    messages: Array<{
      id: string;
      type: PushMessageType;
      title: string;
      summary: string;
      senderName: string;
      createdAt: Date;
      read: boolean;
      forceRead: boolean;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
    unreadCount: number;
  }> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) {
      return {
        messages: [],
        pagination: { page, limit, total: 0, hasMore: false },
        unreadCount: 0,
      };
    }

    const skip = (page - 1) * limit;
    const filter: Record<string, any> = {
      $or: [
        { 'recipients.userId': userId },
        { type: 'broadcast' },
      ],
    };

    if (type && type !== 'all') {
      if (type === 'broadcast') {
        filter.type = 'broadcast';
      } else if (type === 'workspace') {
        filter.type = { $in: ['workspace_auto', 'workspace_manual'] };
      }
    }

    const total = await collection.countDocuments(filter);
    const messages = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const messageList = messages.map((msg) => {
      const recipient = msg.recipients.find((r) => r.userId === userId);
      return {
        id: msg._id?.toString() || '',
        type: msg.type,
        title: msg.title,
        summary: msg.summary,
        senderName: msg.senderName || '系统通知',
        createdAt: msg.createdAt,
        read: recipient?.read || false,
        forceRead: msg.forceRead,
      };
    });

    const unreadCountResult = await this.getUnreadCount(userId);

    return {
      messages: messageList,
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + limit < total,
      },
      unreadCount: unreadCountResult.total,
    };
  }

  /**
   * 获取消息详情
   * @param messageId 消息ID
   * @param userId 用户ID
   * @returns 消息详情
   */
  async getMessageDetail(messageId: string, userId?: string): Promise<Record<string, any> | null> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) return null;

    try {
      const message = await collection.findOne({ _id: new ObjectId(messageId) });
      if (!message) return null;

    const recipient = userId ? message.recipients.find((r) => r.userId === userId) : null;

    const detail: Record<string, any> = {
      id: message._id?.toString(),
      type: message.type,
      title: message.title,
      content: message.content,
      senderName: message.senderName || '系统通知',
      createdAt: message.createdAt,
      read: recipient?.read || false,
      readAt: recipient?.readAt,
    };

    if (message.targetWorkspaceId) {
      detail.workspaceInfo = {
        id: message.targetWorkspaceId,
      };
    }

    detail.readStats = {
      total: message.stats.totalCount,
      read: message.stats.readCount,
      readRate: message.stats.readRate,
    };

    return detail;
    } catch (error) {
      console.error('[Push] 获取消息详情失败:', error);
      return null;
    }
  }

  /**
   * 获取消息的已读统计（管理员用）
   * @param messageId 消息ID
   * @returns 已读统计详情
   */
  async getMessageStats(messageId: string): Promise<Record<string, any> | null> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) return null;

    const message = await collection.findOne({ _id: new ObjectId(messageId) });
    if (!message) return null;

    const unreadRecipients = message.recipients.filter((r) => !r.read);

    const userCollection = mongoDBService.getCollection<any>('users');
    const unreadUsers = [];

    for (const recipient of unreadRecipients.slice(0, 50)) {
      let nickname = '未知用户';
      if (userCollection) {
        const user = await userCollection.findOne({ id: recipient.userId });
        if (user) {
          nickname = user.nickname || user.name || '未知用户';
        }
      }
      unreadUsers.push({
        userId: recipient.userId,
        nickname,
      });
    }

    return {
      messageId: message._id?.toString(),
      title: message.title,
      stats: {
        total: message.stats.totalCount,
        delivered: message.stats.deliveredCount,
        read: message.stats.readCount,
        unread: unreadRecipients.length,
        readRate: message.stats.readRate,
      },
      unreadUsers,
    };
  }

  /**
   * 更新消息统计信息
   * @param messageId 消息ID
   */
  private async updateMessageStats(messageId: string): Promise<void> {
    const collection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (!collection) return;

    const message = await collection.findOne({ _id: new ObjectId(messageId) });
    if (!message) return;

    const deliveredCount = message.recipients.filter((r) => r.delivered).length;
    const readCount = message.recipients.filter((r) => r.read).length;
    const readRate =
      message.stats.totalCount > 0
        ? Math.round((readCount / message.stats.totalCount) * 100)
        : 0;

    await collection.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          'stats.deliveredCount': deliveredCount,
          'stats.readCount': readCount,
          'stats.readRate': readRate,
        },
      }
    );
  }

  /**
   * 清理过期数据和无效设备
   * 应由定时任务调用
   */
  async cleanupExpiredData(): Promise<{ cleanedMessages: number; deactivatedDevices: number }> {
    let cleanedMessages = 0;
    let deactivatedDevices = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const messageCollection = mongoDBService.getCollection<PushMessage>('push_messages');
    if (messageCollection) {
      const deleteResult = await messageCollection.deleteMany({
        expireAt: { $lt: now },
      });
      cleanedMessages = deleteResult.deletedCount;
    }

    const deviceCollection = mongoDBService.getCollection<UserDevice>('user_devices');
    if (deviceCollection) {
      const updateResult = await deviceCollection.updateMany(
        {
          updatedAt: { $lt: thirtyDaysAgo },
          isActive: true,
        },
        { $set: { isActive: false } }
      );
      deactivatedDevices = updateResult.modifiedCount;
    }

    return { cleanedMessages, deactivatedDevices };
  }

  /**
   * 初始化数据库索引
   */
  async initializeIndexes(): Promise<void> {
    const db = mongoDBService.getCollection<UserDevice>('user_devices')?.db;
    if (!db) return;

    try {
      await db.collection('user_devices').createIndex({ userId: 1 });
      await db.collection('user_devices').createIndex({ registrationId: 1 }, { unique: true });

      await db.collection('push_messages').createIndex({ type: 1, createdAt: -1 });
      await db.collection('push_messages').createIndex({ targetWorkspaceId: 1 });
      await db.collection('push_messages').createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });

      await db.collection('user_push_status').createIndex({ userId: 1, read: 1, archived: 1 });
      await db.collection('user_push_status').createIndex({ userId: 1, createdAt: -1 });

      console.log('✅ 推送模块索引初始化完成');
    } catch (error) {
      console.warn('⚠️ 推送模块索引创建警告:', error);
    }
  }
}

export const pushService = new PushService();
