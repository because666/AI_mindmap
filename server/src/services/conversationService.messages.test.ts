import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 对话消息独立集合存储单元测试
 * 测试 ConversationService 的消息独立集合写入、分页查询、迁移和读取功能
 * 使用 vi.doMock + 动态导入模拟 mongoDBService
 */

/** 模拟的 MongoDB 集合方法（用于分页查询） */
interface MockCollection {
  find: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 方法集合 */
interface MockMongoDBService {
  isConnected: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  getCollection: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 实例 */
let mockMongoDBService: MockMongoDBService;

/** 创建模拟的 find 链式调用对象
 * @param docs - 查询返回的文档数组
 * @returns 包含 sort/limit/toArray 方法的链式调用对象
 */
function createFindChain(docs: Record<string, unknown>[] = []) {
  return {
    sort: vi.fn(() => ({
      limit: vi.fn(() => ({
        toArray: vi.fn(() => Promise.resolve(docs)),
      })),
    })),
    toArray: vi.fn(() => Promise.resolve(docs)),
  };
}

describe('ConversationService 消息独立集合存储', () => {
  beforeEach(() => {
    vi.resetModules();

    mockMongoDBService = {
      isConnected: vi.fn(() => true),
      insertOne: vi.fn(),
      findOne: vi.fn(),
      find: vi.fn(),
      updateOne: vi.fn(),
      deleteOne: vi.fn(),
      deleteMany: vi.fn(),
      getCollection: vi.fn(),
    };

    vi.doMock('../data/mongodb/connection', () => ({
      mongoDBService: mockMongoDBService,
    }));

    vi.doMock('uuid', () => ({
      v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2, 8)),
    }));
  });

  /**
   * 动态导入 conversationService，确保 mock 生效
   * 每次测试前重新导入以获取全新的实例
   * @returns conversationService 实例
   */
  async function getService() {
    const mod = await import('./conversationService');
    return mod.conversationService;
  }

  /** 创建测试用消息数据
   * @param overrides - 覆盖的消息属性
   * @returns 完整的消息数据
   */
  function createTestMessage(overrides: { _id?: string; role?: 'user' | 'assistant' | 'system'; content?: string; timestamp?: Date } = {}): { _id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date } {
    return {
      _id: 'msg-' + Math.random().toString(36).substring(2, 8),
      role: 'user',
      content: '测试消息',
      timestamp: new Date('2025-06-15T10:00:00.000Z'),
      ...overrides,
    };
  }

  describe('addMessage - 添加消息', () => {
    it('应仅写入独立 messages 集合，不更新 conversation 文档的 messages 数组', async () => {
      const conversation = {
        id: 'conv-1',
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        messages: [],
        contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockResolvedValueOnce('msg-id');

      const service = await getService();
      const message = await service.addMessage('conv-1', {
        role: 'user',
        content: '你好',
      });

      expect(message._id).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('你好');
      expect(message.timestamp).toBeInstanceOf(Date);

      // 验证 conversation 文档仅更新 updatedAt，不再 $push 到 messages 数组
      expect(mockMongoDBService.updateOne).toHaveBeenCalledWith(
        'conversations',
        { id: 'conv-1' },
        expect.objectContaining({
          $set: expect.objectContaining({ updatedAt: expect.any(Date) }),
        })
      );
      // 确保 updateOne 的参数中不包含 $push messages
      const updateCall = mockMongoDBService.updateOne.mock.calls[0];
      const updateArg = updateCall[2] as Record<string, unknown>;
      expect(updateArg.$push).toBeUndefined();

      // 验证写入独立 messages 集合
      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({
          conversationId: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          role: 'user',
          content: '你好',
        })
      );
    });

    it('独立集合写入失败时不应影响主流程', async () => {
      const conversation = {
        id: 'conv-1',
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        messages: [],
        contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockRejectedValueOnce(new Error('写入失败'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const message = await service.addMessage('conv-1', {
        role: 'user',
        content: '你好',
      });

      expect(message).toBeDefined();
      expect(message.content).toBe('你好');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('写入独立messages集合失败'),
        expect.any(String)
      );

      errorSpy.mockRestore();
    });

    it('对话不存在时应抛出异常', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      await expect(
        service.addMessage('non-existent', { role: 'user', content: '你好' })
      ).rejects.toThrow('对话不存在');
    });
  });

  describe('getMessagesByConversation - 分页查询', () => {
    /** 创建模拟的 MongoDB 集合（用于分页查询） */
    let mockCollection: MockCollection;

    beforeEach(() => {
      mockCollection = {
        find: vi.fn(),
      };
      mockMongoDBService.getCollection.mockReturnValue(mockCollection);
    });

    it('默认返回50条消息', async () => {
      const docs = Array.from({ length: 51 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv-1',
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        role: 'user' as const,
        content: `消息${i}`,
        timestamp: new Date(`2025-06-15T10:${String(i % 60).padStart(2, '0')}:00.000Z`),
      }));

      const chain = createFindChain(docs);
      mockCollection.find.mockReturnValue(chain);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1');

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });

    it('支持自定义 limit', async () => {
      const docs = Array.from({ length: 6 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv-1',
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        role: 'user' as const,
        content: `消息${i}`,
        timestamp: new Date(),
      }));

      const chain = createFindChain(docs);
      mockCollection.find.mockReturnValue(chain);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 5);

      expect(result.messages).toHaveLength(5);
      expect(result.hasMore).toBe(true);
    });

    it('hasMore 在结果数不超过 limit 时为 false', async () => {
      const docs = Array.from({ length: 3 }, (_, i) => ({
        id: `msg-${i}`,
        conversationId: 'conv-1',
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        role: 'user' as const,
        content: `消息${i}`,
        timestamp: new Date(),
      }));

      const chain = createFindChain(docs);
      mockCollection.find.mockReturnValue(chain);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toHaveLength(3);
      expect(result.hasMore).toBe(false);
    });

    it('支持 cursor 分页（beforeTimestamp）', async () => {
      const beforeTime = new Date('2025-06-15T10:30:00.000Z');
      const chain = createFindChain([]);
      mockCollection.find.mockReturnValue(chain);

      const service = await getService();
      await service.getMessagesByConversation('conv-1', 10, beforeTime);

      expect(mockCollection.find).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        timestamp: { $lt: beforeTime },
      });
    });

    it('MongoDB 未连接时返回空结果', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1');

      expect(result.messages).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('集合为 null 时返回空结果', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1');

      expect(result.messages).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it('查询异常时返回空结果不抛异常', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('查询失败');
      });

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1');

      expect(result.messages).toHaveLength(0);
      expect(result.hasMore).toBe(false);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('migrateMessages - 迁移消息', () => {
    it('应将嵌套消息迁移到独立集合', async () => {
      const msg1 = createTestMessage({ _id: 'msg-1', content: '消息1' });
      const msg2 = createTestMessage({ _id: 'msg-2', content: '消息2' });

      const conversations = [
        {
          id: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          messages: [msg1, msg2],
          contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);
      mockMongoDBService.findOne.mockResolvedValue(null);
      mockMongoDBService.insertOne.mockResolvedValue('inserted-id');
      mockMongoDBService.updateOne.mockResolvedValue(true);

      const service = await getService();
      const count = await service.migrateMessages();

      expect(count).toBe(2);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledTimes(2);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({ id: 'msg-1', conversationId: 'conv-1' })
      );
      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({ id: 'msg-2', conversationId: 'conv-1' })
      );
    });

    it('应跳过已存在的消息（按 id 去重）', async () => {
      const msg1 = createTestMessage({ _id: 'msg-1' });
      const msg2 = createTestMessage({ _id: 'msg-2' });

      const conversations = [
        {
          id: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          messages: [msg1, msg2],
          contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);
      mockMongoDBService.findOne
        .mockResolvedValueOnce({ id: 'msg-1' })
        .mockResolvedValueOnce(null);
      mockMongoDBService.insertOne.mockResolvedValue('inserted-id');
      mockMongoDBService.updateOne.mockResolvedValue(true);

      const service = await getService();
      const count = await service.migrateMessages();

      expect(count).toBe(1);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledTimes(1);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith(
        'messages',
        expect.objectContaining({ id: 'msg-2' })
      );
    });

    it('迁移后应清空 conversation 文档的 messages 数组', async () => {
      const msg1 = createTestMessage({ _id: 'msg-1' });

      const conversations = [
        {
          id: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          messages: [msg1],
          contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);
      mockMongoDBService.findOne.mockResolvedValue(null);
      mockMongoDBService.insertOne.mockResolvedValue('inserted-id');
      mockMongoDBService.updateOne.mockResolvedValue(true);

      const service = await getService();
      await service.migrateMessages();

      expect(mockMongoDBService.updateOne).toHaveBeenCalledWith(
        'conversations',
        { id: 'conv-1' },
        { $set: { messages: [] } }
      );
    });

    it('空消息数组时跳过迁移', async () => {
      const conversations = [
        {
          id: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          messages: [],
          contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);

      const service = await getService();
      const count = await service.migrateMessages();

      expect(count).toBe(0);
      expect(mockMongoDBService.insertOne).not.toHaveBeenCalled();
    });

    it('MongoDB 未连接时返回 0', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const count = await service.migrateMessages();

      expect(count).toBe(0);
    });

    it('单条消息迁移失败时继续处理下一条', async () => {
      const msg1 = createTestMessage({ _id: 'msg-1' });
      const msg2 = createTestMessage({ _id: 'msg-2' });

      const conversations = [
        {
          id: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          messages: [msg1, msg2],
          contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);
      mockMongoDBService.findOne.mockResolvedValue(null);
      mockMongoDBService.insertOne
        .mockRejectedValueOnce(new Error('写入失败'))
        .mockResolvedValueOnce('inserted-id');
      mockMongoDBService.updateOne.mockResolvedValue(true);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const count = await service.migrateMessages();

      expect(count).toBe(1);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('getConversationMessages - 独立集合读取', () => {
    it('应从独立 messages 集合查询消息', async () => {
      const messageDocs = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          role: 'user',
          content: '独立集合消息',
          timestamp: new Date('2025-06-15T10:00:00.000Z'),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(messageDocs);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(1);
      expect(messages[0]._id).toBe('msg-1');
      expect(messages[0].content).toBe('独立集合消息');
      expect(mockMongoDBService.find).toHaveBeenCalledWith('messages', { conversationId: 'conv-1' });
    });

    it('独立集合无数据时返回空数组，不回退到 conversation 文档', async () => {
      mockMongoDBService.find.mockResolvedValueOnce([]);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(0);
      // 确保不查询 conversation 文档
      expect(mockMongoDBService.findOne).not.toHaveBeenCalledWith('conversations', { id: 'conv-1' });
    });

    it('独立集合查询异常时返回空数组，不回退到 conversation 文档', async () => {
      mockMongoDBService.find.mockRejectedValueOnce(new Error('查询失败'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalled();
      // 确保不查询 conversation 文档
      expect(mockMongoDBService.findOne).not.toHaveBeenCalledWith('conversations', { id: 'conv-1' });

      errorSpy.mockRestore();
    });

    it('MongoDB 未连接时返回空数组', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toEqual([]);
    });

    it('应按时间升序排列消息', async () => {
      const messageDocs = [
        {
          id: 'msg-2',
          conversationId: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          role: 'assistant',
          content: '后一条消息',
          timestamp: new Date('2025-06-15T10:01:00.000Z'),
        },
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          nodeId: 'node-1',
          workspaceId: 'ws-1',
          role: 'user',
          content: '前一条消息',
          timestamp: new Date('2025-06-15T10:00:00.000Z'),
        },
      ];

      mockMongoDBService.find.mockResolvedValueOnce(messageDocs);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(2);
      expect(messages[0]._id).toBe('msg-1');
      expect(messages[1]._id).toBe('msg-2');
    });
  });
});
