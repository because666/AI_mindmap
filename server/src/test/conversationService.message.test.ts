import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * 对话消息独立集合完全迁移单元测试
 * 验证消息的写入、查询、清空和迁移均仅操作独立 messages 集合
 * 不再双写到 conversation 文档的 messages 数组
 * 使用 vi.doMock + 动态导入模拟 mongoDBService
 */

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

/** 测试用对话数据结构 */
interface TestConversation {
  id: string;
  nodeId: string;
  workspaceId: string;
  messages: Array<{ _id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }>;
  contextConfig: { includeParentHistory: boolean; includeRelatedNodes: string[] };
  createdAt: Date;
  updatedAt: Date;
}

/** 测试用独立消息文档结构 */
interface TestMessageDocument {
  id: string;
  conversationId: string;
  nodeId: string;
  workspaceId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * 创建测试用对话数据
 * @param overrides - 覆盖的对话属性
 * @returns 完整的测试对话数据
 */
function createTestConversation(overrides: Partial<TestConversation> = {}): TestConversation {
  return {
    id: 'conv-1',
    nodeId: 'node-1',
    workspaceId: 'ws-1',
    messages: [],
    contextConfig: { includeParentHistory: true, includeRelatedNodes: [] },
    createdAt: new Date('2025-06-15T10:00:00.000Z'),
    updatedAt: new Date('2025-06-15T10:00:00.000Z'),
    ...overrides,
  };
}

/**
 * 创建测试用消息文档
 * @param overrides - 覆盖的消息属性
 * @returns 完整的测试消息文档
 */
function createTestMessageDoc(overrides: Partial<TestMessageDocument> = {}): TestMessageDocument {
  return {
    id: 'msg-' + Math.random().toString(36).substring(2, 8),
    conversationId: 'conv-1',
    nodeId: 'node-1',
    workspaceId: 'ws-1',
    role: 'user',
    content: '测试消息',
    timestamp: new Date('2025-06-15T10:00:00.000Z'),
    ...overrides,
  };
}

describe('ConversationService 消息独立集合完全迁移', () => {
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
    const mod = await import('../services/conversationService');
    return mod.conversationService;
  }

  describe('addMessage - 新增消息仅写入独立集合', () => {
    it('应仅写入 messages 集合，不更新 conversation 文档的 messages 数组', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockResolvedValueOnce('msg-id');

      const service = await getService();
      const message = await service.addMessage('conv-1', {
        role: 'user',
        content: '你好',
      });

      // 验证返回的消息结构正确
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

      // 确保 updateOne 的参数中不包含 $push messages 操作
      const updateCall = mockMongoDBService.updateOne.mock.calls[0];
      const updateArg = updateCall[2] as Record<string, unknown>;
      expect(updateArg.$push).toBeUndefined();
      // 确保 $set 中不包含 messages 字段
      const setArg = updateArg.$set as Record<string, unknown>;
      expect(setArg.messages).toBeUndefined();

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

    it('不应向 conversation 文档的 messages 数组写入数据', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockResolvedValueOnce('msg-id');

      const service = await getService();
      await service.addMessage('conv-1', { role: 'user', content: '测试' });

      // 验证 updateOne 调用次数为 1（仅更新 updatedAt）
      expect(mockMongoDBService.updateOne).toHaveBeenCalledTimes(1);

      // 验证 insertOne 调用次数为 1（仅写入独立集合）
      expect(mockMongoDBService.insertOne).toHaveBeenCalledTimes(1);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith(
        'messages',
        expect.any(Object)
      );
    });

    it('对话不存在时应抛出异常', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      await expect(
        service.addMessage('non-existent', { role: 'user', content: '你好' })
      ).rejects.toThrow('对话不存在');

      // 确保未执行任何写入操作
      expect(mockMongoDBService.updateOne).not.toHaveBeenCalled();
      expect(mockMongoDBService.insertOne).not.toHaveBeenCalled();
    });

    it('独立集合写入失败时记录错误但不影响主流程', async () => {
      const conversation = createTestConversation();
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
  });

  describe('getConversationMessages - 查询消息从独立集合读取', () => {
    it('应从 messages 集合按 conversationId 查询消息', async () => {
      const messageDocs = [
        createTestMessageDoc({ id: 'msg-1', content: '消息1' }),
        createTestMessageDoc({ id: 'msg-2', content: '消息2', role: 'assistant' }),
      ];

      mockMongoDBService.find.mockResolvedValueOnce(messageDocs);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(2);
      expect(messages[0]._id).toBe('msg-1');
      expect(messages[0].content).toBe('消息1');
      expect(messages[1]._id).toBe('msg-2');
      expect(messages[1].content).toBe('消息2');

      // 验证查询的是 messages 集合
      expect(mockMongoDBService.find).toHaveBeenCalledWith('messages', { conversationId: 'conv-1' });
    });

    it('不应回退到 conversation 文档的 messages 数组', async () => {
      // 独立集合返回空数组
      mockMongoDBService.find.mockResolvedValueOnce([]);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(0);
      // 确保没有查询 conversation 文档作为回退
      expect(mockMongoDBService.findOne).not.toHaveBeenCalledWith('conversations', { id: 'conv-1' });
    });

    it('查询异常时返回空数组，不回退到 conversation 文档', async () => {
      mockMongoDBService.find.mockRejectedValueOnce(new Error('查询失败'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalled();
      // 确保没有查询 conversation 文档作为回退
      expect(mockMongoDBService.findOne).not.toHaveBeenCalledWith('conversations', { id: 'conv-1' });

      errorSpy.mockRestore();
    });

    it('MongoDB 未连接时返回空数组', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toEqual([]);
      expect(mockMongoDBService.find).not.toHaveBeenCalled();
    });

    it('应按时间升序排列消息', async () => {
      const messageDocs = [
        createTestMessageDoc({
          id: 'msg-2',
          content: '后一条消息',
          timestamp: new Date('2025-06-15T10:01:00.000Z'),
        }),
        createTestMessageDoc({
          id: 'msg-1',
          content: '前一条消息',
          timestamp: new Date('2025-06-15T10:00:00.000Z'),
        }),
      ];

      mockMongoDBService.find.mockResolvedValueOnce(messageDocs);

      const service = await getService();
      const messages = await service.getConversationMessages('conv-1');

      expect(messages).toHaveLength(2);
      expect(messages[0]._id).toBe('msg-1');
      expect(messages[1]._id).toBe('msg-2');
    });
  });

  describe('clearConversation - 清空对话仅清空独立集合', () => {
    it('应仅执行 deleteMany 清空 messages 集合', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.deleteMany.mockResolvedValueOnce(5);

      const service = await getService();
      const result = await service.clearConversation('conv-1');

      expect(result).toBe(true);

      // 验证执行了 deleteMany 清空 messages 集合
      expect(mockMongoDBService.deleteMany).toHaveBeenCalledWith('messages', { conversationId: 'conv-1' });
    });

    it('不应执行 $set messages 数组操作清空 conversation 文档', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.deleteMany.mockResolvedValueOnce(3);

      const service = await getService();
      await service.clearConversation('conv-1');

      // 验证 conversation 文档仅更新 updatedAt
      expect(mockMongoDBService.updateOne).toHaveBeenCalledWith(
        'conversations',
        { id: 'conv-1' },
        expect.objectContaining({
          $set: expect.objectContaining({ updatedAt: expect.any(Date) }),
        })
      );

      // 确保 $set 中不包含 messages 字段
      const updateCall = mockMongoDBService.updateOne.mock.calls[0];
      const updateArg = updateCall[2] as Record<string, unknown>;
      const setArg = updateArg.$set as Record<string, unknown>;
      expect(setArg.messages).toBeUndefined();
    });

    it('对话不存在时返回 false', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.clearConversation('non-existent');

      expect(result).toBe(false);
      expect(mockMongoDBService.deleteMany).not.toHaveBeenCalled();
      expect(mockMongoDBService.updateOne).not.toHaveBeenCalled();
    });

    it('清空独立集合失败时记录错误但不影响主流程', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.deleteMany.mockRejectedValueOnce(new Error('清空失败'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.clearConversation('conv-1');

      expect(result).toBe(true);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('清空独立messages集合失败'),
        expect.any(String)
      );

      errorSpy.mockRestore();
    });
  });

  describe('migrateMessages - 历史数据迁移后 conversation 文档 messages 为空', () => {
    it('应将历史 messages 数组迁移到独立集合', async () => {
      const msg1 = { _id: 'msg-1', role: 'user' as const, content: '消息1', timestamp: new Date('2025-06-15T10:00:00.000Z') };
      const msg2 = { _id: 'msg-2', role: 'assistant' as const, content: '消息2', timestamp: new Date('2025-06-15T10:01:00.000Z') };

      const conversations = [
        createTestConversation({ messages: [msg1, msg2] }),
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

    it('迁移后应将 conversation 文档的 messages 数组置空', async () => {
      const msg1 = { _id: 'msg-1', role: 'user' as const, content: '消息1', timestamp: new Date() };

      const conversations = [
        createTestConversation({ messages: [msg1] }),
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);
      mockMongoDBService.findOne.mockResolvedValue(null);
      mockMongoDBService.insertOne.mockResolvedValue('inserted-id');
      mockMongoDBService.updateOne.mockResolvedValue(true);

      const service = await getService();
      await service.migrateMessages();

      // 验证迁移后将 conversation 文档的 messages 数组置空
      expect(mockMongoDBService.updateOne).toHaveBeenCalledWith(
        'conversations',
        { id: 'conv-1' },
        { $set: { messages: [] } }
      );
    });

    it('应跳过已存在的消息（按 id 去重）', async () => {
      const msg1 = { _id: 'msg-1', role: 'user' as const, content: '消息1', timestamp: new Date() };
      const msg2 = { _id: 'msg-2', role: 'user' as const, content: '消息2', timestamp: new Date() };

      const conversations = [
        createTestConversation({ messages: [msg1, msg2] }),
      ];

      mockMongoDBService.find.mockResolvedValueOnce(conversations);
      // msg-1 已存在，msg-2 不存在
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

    it('空 messages 数组时跳过迁移', async () => {
      const conversations = [createTestConversation({ messages: [] })];
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
      const msg1 = { _id: 'msg-1', role: 'user' as const, content: '消息1', timestamp: new Date() };
      const msg2 = { _id: 'msg-2', role: 'user' as const, content: '消息2', timestamp: new Date() };

      const conversations = [
        createTestConversation({ messages: [msg1, msg2] }),
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

  describe('getMessages - 统一从独立集合查询', () => {
    it('应委托给 getConversationMessages 从独立集合查询', async () => {
      const messageDocs = [
        createTestMessageDoc({ id: 'msg-1', content: '消息1' }),
      ];

      mockMongoDBService.find.mockResolvedValueOnce(messageDocs);

      const service = await getService();
      const messages = await service.getMessages('conv-1');

      expect(messages).toHaveLength(1);
      expect(messages[0]._id).toBe('msg-1');
      // 验证查询的是 messages 集合
      expect(mockMongoDBService.find).toHaveBeenCalledWith('messages', { conversationId: 'conv-1' });
    });

    it('不应从 conversation 文档的 messages 数组读取', async () => {
      mockMongoDBService.find.mockResolvedValueOnce([]);

      const service = await getService();
      const messages = await service.getMessages('conv-1');

      expect(messages).toHaveLength(0);
      // 确保没有查询 conversation 文档
      expect(mockMongoDBService.findOne).not.toHaveBeenCalledWith('conversations', { id: 'conv-1' });
    });
  });
});
