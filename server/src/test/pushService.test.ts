import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PushService 推送服务单元测试
 * 覆盖推送消息的发送、反馈通知、消息索引初始化、推送失败处理等核心流程
 * 使用 vi.doMock + 动态导入模拟 mongoDBService 和 axios
 */

/** 模拟的 MongoDB Collection 链式调用接口 */
interface MockCollection<T = Record<string, unknown>> {
  insertOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
  createIndex: ReturnType<typeof vi.fn>;
  db?: { collection: ReturnType<typeof vi.fn> };
}

/** 模拟的 find 链式调用接口 */
interface MockFindChain<T = Record<string, unknown>> {
  sort: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  toArray: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 实例 */
let mockMongoDBService: {
  isConnected: ReturnType<typeof vi.fn>;
  getCollection: ReturnType<typeof vi.fn>;
};

/** 模拟的 axios 模块 */
interface MockAxios {
  post: ReturnType<typeof vi.fn>;
  default: { post: ReturnType<typeof vi.fn> };
}

let mockAxios: MockAxios;

/** 模拟的 ObjectId 构造函数 */
function mockObjectId(id: string): { toString: () => string } {
  return { toString: () => id };
}

beforeEach(() => {
  vi.resetModules();

  mockMongoDBService = {
    isConnected: vi.fn(() => true),
    getCollection: vi.fn(),
  };

  mockAxios = {
    post: vi.fn().mockResolvedValue({ status: 200, data: { sendno: 'test-sendno' } }),
    default: {
      post: vi.fn().mockResolvedValue({ status: 200, data: { sendno: 'test-sendno' } }),
    },
  };

  vi.doMock('../data/mongodb/connection', () => ({
    mongoDBService: mockMongoDBService,
  }));

  vi.doMock('axios', () => mockAxios);

  vi.doMock('mongodb', () => ({
    ObjectId: mockObjectId,
    Document: {},
  }));
});

describe('PushService 推送服务', () => {
  /**
   * 动态导入 pushService，确保 mock 生效
   * 每次测试前重新导入以获取全新的实例
   * @returns pushService 实例
   */
  async function getService() {
    const mod = await import('../services/pushService');
    return mod.pushService;
  }

  /**
   * 创建模拟的 Collection，支持链式 find 调用
   * @returns 模拟的 Collection 实例
   */
  function createMockCollection(): MockCollection {
    const findChain: MockFindChain = {
      sort: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      toArray: vi.fn().mockResolvedValue([]),
    };

    return {
      insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-inserted-id' }),
      updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockReturnValue(findChain),
      deleteMany: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      countDocuments: vi.fn().mockResolvedValue(0),
      createIndex: vi.fn().mockResolvedValue('index-name'),
    };
  }

  describe('registerDevice - 注册设备', () => {
    it('正常流程：应 upsert 设备记录', async () => {
      const collection = createMockCollection();
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      await service.registerDevice('user-1', 'reg-1', 'android', 'Pixel 7', '1.0.0');

      expect(collection.updateOne).toHaveBeenCalledWith(
        { registrationId: 'reg-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            userId: 'user-1',
            registrationId: 'reg-1',
            platform: 'android',
            isActive: true,
            deviceModel: 'Pixel 7',
            appVersion: '1.0.0',
          }),
        }),
        { upsert: true }
      );
    });

    it('数据库连接不可用时应抛出异常', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      await expect(
        service.registerDevice('user-1', 'reg-1', 'android')
      ).rejects.toThrow('数据库连接不可用');
    });
  });

  describe('getUserDevices - 获取用户设备', () => {
    it('应返回用户所有活跃设备的 registrationId', async () => {
      const findChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { registrationId: 'reg-1' },
          { registrationId: 'reg-2' },
        ]),
      };
      const collection = createMockCollection();
      collection.find.mockReturnValue(findChain);
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const devices = await service.getUserDevices('user-1');

      expect(devices).toEqual(['reg-1', 'reg-2']);
      expect(collection.find).toHaveBeenCalledWith(
        { userId: 'user-1', isActive: true },
        { projection: { registrationId: 1 } }
      );
    });

    it('Collection 不存在时应返回空数组', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const devices = await service.getUserDevices('user-1');

      expect(devices).toEqual([]);
    });
  });

  describe('getUsersDevices - 批量获取用户设备', () => {
    it('应返回去重后的设备列表', async () => {
      const findChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          { registrationId: 'reg-1' },
          { registrationId: 'reg-2' },
          { registrationId: 'reg-1' }, // 重复
        ]),
      };
      const collection = createMockCollection();
      collection.find.mockReturnValue(findChain);
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const devices = await service.getUsersDevices(['user-1', 'user-2']);

      expect(devices).toEqual(['reg-1', 'reg-2']);
    });

    it('空 userIds 列表应返回空数组', async () => {
      const service = await getService();
      const devices = await service.getUsersDevices([]);

      expect(devices).toEqual([]);
    });

    it('Collection 不存在时应返回空数组', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const devices = await service.getUsersDevices(['user-1']);

      expect(devices).toEqual([]);
    });
  });

  describe('sendBroadcast - 发送广播消息', () => {
    it('正常流程：应创建消息记录并发送推送', async () => {
      const userCollection = createMockCollection();
      const userFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
      };
      userCollection.find.mockReturnValue(userFindChain);

      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ registrationId: 'reg-1' }]),
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'users') return userCollection;
        if (name === 'push_messages') return pushCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      const service = await getService();
      const message = await service.sendBroadcast({
        title: '广播标题',
        content: '广播内容',
        targetType: 'all',
      });

      expect(message.title).toBe('广播标题');
      expect(message.content).toBe('广播内容');
      expect(message.type).toBe('broadcast');
      expect(message.targetUserIds).toContain('user-1');
      expect(message.targetUserIds).toContain('user-2');
      expect(pushCollection.insertOne).toHaveBeenCalled();
    });

    it('指定 specific_users 时应仅向指定用户发送', async () => {
      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ registrationId: 'reg-1' }]),
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return pushCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      const service = await getService();
      const message = await service.sendBroadcast({
        title: '指定用户广播',
        content: '内容',
        targetType: 'specific_users',
        targetUserIds: ['user-1', 'user-2'],
      });

      expect(message.targetUserIds).toEqual(['user-1', 'user-2']);
    });

    it('数据库连接不可用时应抛出异常', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      await expect(
        service.sendBroadcast({
          title: '标题',
          content: '内容',
          targetType: 'specific_users',
          targetUserIds: ['user-1'],
        })
      ).rejects.toThrow('数据库连接不可用');
    });

    it('scheduledAt 存在时不应立即发送推送', async () => {
      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return pushCollection;
        return createMockCollection();
      });

      const service = await getService();
      const futureDate = new Date(Date.now() + 86400000);
      const message = await service.sendBroadcast({
        title: '定时广播',
        content: '内容',
        targetType: 'specific_users',
        targetUserIds: ['user-1'],
        scheduledAt: futureDate,
      });

      expect(message.sentAt).toBeNull();
      expect(mockAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('sendFeedbackNotification - 反馈通知推送', () => {
    it('visitorId 为 anonymous 时应跳过推送并返回 null', async () => {
      const service = await getService();
      const result = await service.sendFeedbackNotification('anonymous', '反馈标题', 'processing');

      expect(result).toBeNull();
    });

    it('visitorId 为空时应跳过推送并返回 null', async () => {
      const service = await getService();
      const result = await service.sendFeedbackNotification('', '反馈标题', 'processing');

      expect(result).toBeNull();
    });

    it('有设备时应创建消息记录并发送推送', async () => {
      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ registrationId: 'reg-1' }]),
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return pushCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      const service = await getService();
      const result = await service.sendFeedbackNotification('visitor-1', '反馈标题', 'resolved');

      expect(result).not.toBeNull();
      expect(result!.type).toBe('feedback_notification');
      expect(result!.title).toBe('反馈处理通知');
      expect(result!.content).toContain('已解决');
      expect(result!.sentAt).toBeInstanceOf(Date);
    });

    it('无设备时应创建消息记录但不发送推送', async () => {
      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]), // 无设备
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return pushCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const service = await getService();
      const result = await service.sendFeedbackNotification('visitor-1', '反馈标题', 'processing');

      expect(result).not.toBeNull();
      expect(result!.sentAt).toBeNull();
      expect(mockAxios.post).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('数据库连接不可用时应抛出异常', async () => {
      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ registrationId: 'reg-1' }]),
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'user_devices') return deviceCollection;
        return null; // push_messages 集合不可用
      });

      const service = await getService();
      await expect(
        service.sendFeedbackNotification('visitor-1', '反馈标题', 'processing')
      ).rejects.toThrow('数据库连接不可用');
    });

    it('未知状态时应使用原始状态值作为标签', async () => {
      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ registrationId: 'reg-1' }]),
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return pushCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      const service = await getService();
      const result = await service.sendFeedbackNotification('visitor-1', '反馈标题', 'custom_status');

      expect(result).not.toBeNull();
      expect(result!.content).toContain('custom_status');
    });
  });

  describe('markAsRead - 标记消息已读', () => {
    it('无效的 messageId 应返回 false', async () => {
      const service = await getService();
      const result = await service.markAsRead('invalid-id', 'user-1');

      expect(result).toBe(false);
    });

    it('Collection 不存在时应返回 false', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.markAsRead('507f1f77bcf86cd799439011', 'user-1');

      expect(result).toBe(false);
    });

    it('modifiedCount > 0 时应返回 true', async () => {
      const collection = createMockCollection();
      collection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const result = await service.markAsRead('507f1f77bcf86cd799439011', 'user-1');

      expect(result).toBe(true);
    });

    it('modifiedCount = 0 时应返回 false', async () => {
      const collection = createMockCollection();
      collection.updateOne.mockResolvedValue({ modifiedCount: 0 });
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const result = await service.markAsRead('507f1f77bcf86cd799439011', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('markAllAsRead - 标记所有消息已读', () => {
    it('应返回修改的消息数量', async () => {
      const collection = createMockCollection();
      collection.updateMany.mockResolvedValue({ modifiedCount: 5 });
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(5);
    });

    it('Collection 不存在时应返回 0', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(0);
    });
  });

  describe('getUnreadCount - 获取未读数量', () => {
    it('应正确统计未读消息数量', async () => {
      const collection = createMockCollection();
      const findChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([
          {
            type: 'broadcast',
            recipients: [{ userId: 'user-1', read: false }],
            forceRead: true,
            forceReadDeadline: new Date(Date.now() + 86400000),
          },
          {
            type: 'workspace_manual',
            recipients: [{ userId: 'user-1', read: false }],
            forceRead: false,
          },
          {
            type: 'broadcast',
            recipients: [{ userId: 'user-1', read: true }], // 已读，不计入
          },
        ]),
      };
      collection.find.mockReturnValue(findChain);
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const result = await service.getUnreadCount('user-1');

      expect(result.total).toBe(2);
      expect(result.broadcast).toBe(1);
      expect(result.workspace).toBe(1);
      expect(result.forceReadPending).toBe(1);
    });

    it('Collection 不存在时应返回全 0', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.getUnreadCount('user-1');

      expect(result).toEqual({ total: 0, broadcast: 0, workspace: 0, forceReadPending: 0 });
    });

    it('查询异常时应返回全 0', async () => {
      const collection = createMockCollection();
      collection.find.mockImplementation(() => {
        throw new Error('查询失败');
      });
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.getUnreadCount('user-1');

      expect(result).toEqual({ total: 0, broadcast: 0, workspace: 0, forceReadPending: 0 });
      errorSpy.mockRestore();
    });
  });

  describe('getMessageDetail - 获取消息详情', () => {
    it('无效的 messageId 应返回 null', async () => {
      const service = await getService();
      const result = await service.getMessageDetail('invalid-id');

      expect(result).toBeNull();
    });

    it('Collection 不存在时应返回 null', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.getMessageDetail('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });

    it('消息不存在时应返回 null', async () => {
      const collection = createMockCollection();
      collection.findOne.mockResolvedValue(null);
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const result = await service.getMessageDetail('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });

    it('查询异常时应返回 null', async () => {
      const collection = createMockCollection();
      collection.findOne.mockRejectedValue(new Error('查询失败'));
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.getMessageDetail('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
      errorSpy.mockRestore();
    });
  });

  describe('cleanupExpiredData - 清理过期数据', () => {
    it('应清理过期消息和失活设备', async () => {
      const messageCollection = createMockCollection();
      messageCollection.deleteMany.mockResolvedValue({ deletedCount: 10 });

      const deviceCollection = createMockCollection();
      deviceCollection.updateMany.mockResolvedValue({ modifiedCount: 3 });

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return messageCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      const service = await getService();
      const result = await service.cleanupExpiredData();

      expect(result.cleanedMessages).toBe(10);
      expect(result.deactivatedDevices).toBe(3);
    });

    it('Collection 不存在时应返回全 0', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.cleanupExpiredData();

      expect(result).toEqual({ cleanedMessages: 0, deactivatedDevices: 0 });
    });
  });

  describe('initializeIndexes - 初始化索引', () => {
    it('数据库不可用时应跳过初始化', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      await service.initializeIndexes();

      // 不应抛出异常
      expect(true).toBe(true);
    });

    it('正常流程：应创建所有必要索引', async () => {
      const mockDbCollection = vi.fn().mockReturnValue({
        createIndex: vi.fn().mockResolvedValue('index-name'),
      });
      const collection = createMockCollection();
      collection.db = { collection: mockDbCollection };
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      await service.initializeIndexes();

      // 应为 user_devices 和 push_messages 集合创建索引
      expect(mockDbCollection).toHaveBeenCalled();
    });

    it('索引创建异常时不应抛出', async () => {
      const mockDbCollection = vi.fn().mockReturnValue({
        createIndex: vi.fn().mockRejectedValue(new Error('索引创建失败')),
      });
      const collection = createMockCollection();
      collection.db = { collection: mockDbCollection };
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = await getService();
      await service.initializeIndexes();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('推送失败处理', () => {
    it('axios 请求失败时应抛出异常', async () => {
      const pushCollection = createMockCollection();
      pushCollection.insertOne.mockResolvedValue({ insertedId: 'mock-msg-id' });

      const deviceCollection = createMockCollection();
      const deviceFindChain: MockFindChain = {
        sort: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([{ registrationId: 'reg-1' }]),
      };
      deviceCollection.find.mockReturnValue(deviceFindChain);

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return pushCollection;
        if (name === 'user_devices') return deviceCollection;
        return createMockCollection();
      });

      // 模拟 axios 请求失败（代码使用 import axios from 'axios'，对应 mockAxios.default）
      mockAxios.default.post.mockRejectedValueOnce(new Error('网络错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      await expect(
        service.sendBroadcast({
          title: '标题',
          content: '内容',
          targetType: 'specific_users',
          targetUserIds: ['user-1'],
        })
      ).rejects.toThrow('网络错误');

      errorSpy.mockRestore();
    });
  });

  describe('getMessageStats - 获取消息已读统计', () => {
    it('无效的 messageId 应返回 null', async () => {
      const service = await getService();
      const result = await service.getMessageStats('invalid-id');

      expect(result).toBeNull();
    });

    it('Collection 不存在时应返回 null', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.getMessageStats('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });

    it('消息不存在时应返回 null', async () => {
      const collection = createMockCollection();
      collection.findOne.mockResolvedValue(null);
      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const result = await service.getMessageStats('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });

    it('正常流程：应返回消息统计和未读用户列表', async () => {
      const mockMessage = {
        _id: '507f1f77bcf86cd799439011',
        title: '测试消息',
        recipients: [
          { userId: 'user-1', read: false, delivered: true },
          { userId: 'user-2', read: true, delivered: true },
          { userId: 'user-3', read: false, delivered: false },
        ],
        stats: {
          totalCount: 3,
          deliveredCount: 2,
          readCount: 1,
          readRate: 33,
        },
      };

      const messageCollection = createMockCollection();
      messageCollection.findOne.mockResolvedValue(mockMessage);

      const userCollection = createMockCollection();
      userCollection.findOne.mockImplementation((filter: { id: string }) => {
        if (filter.id === 'user-1') {
          return Promise.resolve({ id: 'user-1', nickname: '用户1' });
        }
        if (filter.id === 'user-3') {
          return Promise.resolve({ id: 'user-3', name: '用户3' });
        }
        return Promise.resolve(null);
      });

      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return messageCollection;
        if (name === 'users') return userCollection;
        return createMockCollection();
      });

      const service = await getService();
      const result = await service.getMessageStats('507f1f77bcf86cd799439011');

      expect(result).not.toBeNull();
      expect(result?.messageId).toBe('507f1f77bcf86cd799439011');
      expect(result?.title).toBe('测试消息');
      // 由于返回类型为 Record<string, unknown>，需要类型断言访问嵌套属性
      const stats = result?.stats as { total: number; delivered: number; read: number; unread: number };
      const unreadUsers = result?.unreadUsers as Array<{ userId: string; nickname: string }>;
      expect(stats.total).toBe(3);
      expect(stats.delivered).toBe(2);
      expect(stats.read).toBe(1);
      expect(stats.unread).toBe(2);
      expect(unreadUsers).toHaveLength(2);
      expect(unreadUsers[0].userId).toBe('user-1');
      expect(unreadUsers[0].nickname).toBe('用户1');
    });

    it('用户集合不存在时应使用"未知用户"作为昵称', async () => {
      const mockMessage = {
        _id: '507f1f77bcf86cd799439011',
        title: '测试消息',
        recipients: [
          { userId: 'user-1', read: false, delivered: true },
        ],
        stats: {
          totalCount: 1,
          deliveredCount: 1,
          readCount: 0,
          readRate: 0,
        },
      };

      const messageCollection = createMockCollection();
      messageCollection.findOne.mockResolvedValue(mockMessage);

      // 第一次返回 messageCollection，第二次返回 null（用户集合不存在）
      mockMongoDBService.getCollection.mockImplementation((name: string) => {
        if (name === 'push_messages') return messageCollection;
        return null;
      });

      const service = await getService();
      const result = await service.getMessageStats('507f1f77bcf86cd799439011');

      expect(result).not.toBeNull();
      // 由于返回类型为 Record<string, unknown>，需要类型断言访问嵌套属性
      const unreadUsers = result?.unreadUsers as Array<{ userId: string; nickname: string }>;
      expect(unreadUsers[0].nickname).toBe('未知用户');
    });
  });

  describe('markAsRead - 触发统计更新', () => {
    it('modifiedCount > 0 时应触发 updateMessageStats 更新统计', async () => {
      const mockMessage = {
        _id: '507f1f77bcf86cd799439011',
        recipients: [
          { userId: 'user-1', read: true, delivered: true },
          { userId: 'user-2', read: false, delivered: true },
        ],
        stats: {
          totalCount: 2,
          deliveredCount: 2,
          readCount: 0,
          readRate: 0,
        },
      };

      const collection = createMockCollection();
      collection.updateOne.mockResolvedValue({ modifiedCount: 1 });
      collection.findOne.mockResolvedValue(mockMessage);

      mockMongoDBService.getCollection.mockReturnValue(collection);

      const service = await getService();
      const result = await service.markAsRead('507f1f77bcf86cd799439011', 'user-1');

      expect(result).toBe(true);
      // updateMessageStats 内部会调用 findOne 查询消息，然后 updateOne 更新统计
      expect(collection.findOne).toHaveBeenCalled();
      expect(collection.updateOne).toHaveBeenCalledTimes(2);
    });
  });
});
