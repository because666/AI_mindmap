import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * ConversationService 对话服务单元测试
 * 补充现有 cache/message 测试，覆盖：
 * - 创建/获取/删除对话
 * - 更新上下文配置
 * - 分页查询消息
 * - 异常流程
 * 使用 vi.doMock + 动态导入模拟 mongoDBService 和 redisService
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

/** 模拟的 redisService 方法集合 */
interface MockRedisService {
  cacheGet: ReturnType<typeof vi.fn>;
  cacheSet: ReturnType<typeof vi.fn>;
  cacheDel: ReturnType<typeof vi.fn>;
  isConnected: ReturnType<typeof vi.fn>;
  getClient: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 实例 */
let mockMongoDBService: MockMongoDBService;

/** 模拟的 redisService 实例 */
let mockRedisService: MockRedisService;

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

/** 测试用消息文档结构 */
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

/**
 * 等待所有微任务完成
 * 用于等待 fire-and-forget 的 Redis 异步操作完成
 * @returns Promise，在下一个宏任务中解决
 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve: () => void) => setTimeout(resolve, 0));
}

describe('ConversationService 对话服务', () => {
  beforeEach(() => {
    vi.resetModules();

    mockMongoDBService = {
      isConnected: vi.fn(() => true),
      insertOne: vi.fn().mockResolvedValue('inserted-id'),
      findOne: vi.fn().mockResolvedValue(null),
      find: vi.fn().mockResolvedValue([]),
      updateOne: vi.fn().mockResolvedValue(true),
      deleteOne: vi.fn().mockResolvedValue(true),
      deleteMany: vi.fn().mockResolvedValue(0),
      getCollection: vi.fn(),
    };

    mockRedisService = {
      cacheGet: vi.fn().mockResolvedValue(null),
      cacheSet: vi.fn().mockResolvedValue(undefined),
      cacheDel: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn(() => true),
      getClient: vi.fn(() => ({})),
    };

    vi.doMock('../data/mongodb/connection', () => ({
      mongoDBService: mockMongoDBService,
    }));

    vi.doMock('../data/redis/connection', () => ({
      redisService: mockRedisService,
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

  describe('createConversation - 创建对话', () => {
    it('正常流程：应创建对话并写入数据库和缓存', async () => {
      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1', 'visitor-1');

      expect(conversation.id).toBeDefined();
      expect(conversation.nodeId).toBe('node-1');
      expect(conversation.workspaceId).toBe('ws-1');
      expect(conversation.createdBy).toBe('visitor-1');
      expect(conversation.messages).toEqual([]);
      expect(conversation.contextConfig.includeParentHistory).toBe(true);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledWith('conversations', conversation);
    });

    it('指定 conversationId 时应使用指定的 ID', async () => {
      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1', 'visitor-1', 'custom-id');

      expect(conversation.id).toBe('custom-id');
    });

    it('未提供 createdBy 时应为 undefined', async () => {
      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1');

      expect(conversation.createdBy).toBeUndefined();
    });

    it('MongoDB 未连接时应仅写入内存缓存', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1');

      expect(conversation.id).toBeDefined();
      expect(mockMongoDBService.insertOne).not.toHaveBeenCalled();
    });
  });

  describe('getConversation - 获取对话', () => {
    it('应从数据库获取对话并回填缓存', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      const result = await service.getConversation('conv-1');

      expect(result).toEqual(conversation);
      expect(mockMongoDBService.findOne).toHaveBeenCalledWith('conversations', { id: 'conv-1' });
    });

    it('对话不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.getConversation('non-existent');

      expect(result).toBeNull();
    });

    it('MongoDB 未连接时应返回 null', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const result = await service.getConversation('conv-1');

      expect(result).toBeNull();
    });
  });

  describe('getConversationByNodeId - 通过节点ID获取对话', () => {
    it('应返回匹配节点的对话', async () => {
      const conversation = createTestConversation({ nodeId: 'node-1' });
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      const result = await service.getConversationByNodeId('node-1');

      expect(result).toEqual(conversation);
      expect(mockMongoDBService.findOne).toHaveBeenCalledWith('conversations', { nodeId: 'node-1' });
    });

    it('节点无对话时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.getConversationByNodeId('non-existent');

      expect(result).toBeNull();
    });

    it('MongoDB 未连接时应返回 null', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const result = await service.getConversationByNodeId('node-1');

      expect(result).toBeNull();
    });
  });

  describe('getConversationsByWorkspaceId - 获取工作区所有对话', () => {
    it('应返回指定工作区的所有对话', async () => {
      const conv1 = createTestConversation({ id: 'conv-1' });
      const conv2 = createTestConversation({ id: 'conv-2', nodeId: 'node-2' });
      mockMongoDBService.find.mockResolvedValueOnce([conv1, conv2]);

      const service = await getService();
      const result = await service.getConversationsByWorkspaceId('ws-1');

      expect(result).toHaveLength(2);
      expect(mockMongoDBService.find).toHaveBeenCalledWith('conversations', { workspaceId: 'ws-1' });
    });

    it('工作区无对话时应返回空数组', async () => {
      mockMongoDBService.find.mockResolvedValueOnce([]);

      const service = await getService();
      const result = await service.getConversationsByWorkspaceId('ws-1');

      expect(result).toEqual([]);
    });
  });

  describe('updateContextConfig - 更新上下文配置', () => {
    it('应合并更新上下文配置', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      const result = await service.updateContextConfig('conv-1', {
        includeParentHistory: false,
        includeRelatedNodes: ['node-2', 'node-3'],
      });

      expect(result).toBe(true);
      // 验证 updateOne 调用参数：$set 中包含 contextConfig 对象和 updatedAt
      expect(mockMongoDBService.updateOne).toHaveBeenCalledWith(
        'conversations',
        { id: 'conv-1' },
        expect.objectContaining({
          $set: expect.objectContaining({
            contextConfig: expect.objectContaining({
              includeParentHistory: false,
              includeRelatedNodes: ['node-2', 'node-3'],
            }),
            updatedAt: expect.any(Date),
          }),
        })
      );
    });

    it('部分更新时应保留原有配置', async () => {
      const conversation = createTestConversation({
        contextConfig: { includeParentHistory: true, includeRelatedNodes: ['existing-node'] },
      });
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      const result = await service.updateContextConfig('conv-1', {
        includeParentHistory: false,
      });

      expect(result).toBe(true);
    });

    it('对话不存在时应返回 false', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.updateContextConfig('non-existent', { includeParentHistory: false });

      expect(result).toBe(false);
      expect(mockMongoDBService.updateOne).not.toHaveBeenCalled();
    });

    it('MongoDB 未连接时仅更新内存缓存', async () => {
      // 先在 MongoDB 连接状态下创建对话，使其进入内存缓存
      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1');
      await flushMicrotasks();

      // 之后断开 MongoDB，仅依靠内存缓存
      mockMongoDBService.isConnected.mockReturnValue(false);
      mockMongoDBService.updateOne.mockClear();

      const result = await service.updateContextConfig(conversation.id, { includeParentHistory: false });

      expect(result).toBe(true);
      expect(mockMongoDBService.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('deleteConversation - 删除对话', () => {
    it('正常流程：应删除对话和关联消息并清除缓存', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      const result = await service.deleteConversation('conv-1');

      expect(result).toBe(true);
      expect(mockMongoDBService.deleteOne).toHaveBeenCalledWith('conversations', { id: 'conv-1' });
      expect(mockMongoDBService.deleteMany).toHaveBeenCalledWith('messages', { conversationId: 'conv-1' });
    });

    it('对话不存在时应返回 false', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.deleteConversation('non-existent');

      expect(result).toBe(false);
      expect(mockMongoDBService.deleteOne).not.toHaveBeenCalled();
    });

    it('删除独立消息集合失败时不应影响主流程', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.deleteMany.mockRejectedValueOnce(new Error('删除失败'));

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.deleteConversation('conv-1');

      expect(result).toBe(true);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('MongoDB 未连接时应仅清除内存缓存', async () => {
      // 先在 MongoDB 连接状态下创建对话，使其进入内存缓存
      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1');
      await flushMicrotasks();

      // 之后断开 MongoDB，仅依靠内存缓存
      mockMongoDBService.isConnected.mockReturnValue(false);
      mockMongoDBService.deleteOne.mockClear();
      mockMongoDBService.deleteMany.mockClear();

      const result = await service.deleteConversation(conversation.id);

      expect(result).toBe(true);
      expect(mockMongoDBService.deleteOne).not.toHaveBeenCalled();
    });
  });

  describe('addMessageByNodeId - 通过节点ID添加消息', () => {
    it('对话存在时应成功添加消息', async () => {
      const conversation = createTestConversation({ nodeId: 'node-1' });
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockResolvedValueOnce('msg-id');

      const service = await getService();
      const message = await service.addMessageByNodeId('node-1', {
        role: 'user',
        content: '你好',
      });

      expect(message.content).toBe('你好');
      expect(message.role).toBe('user');
    });

    it('对话不存在时应抛出异常', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      await expect(
        service.addMessageByNodeId('non-existent', { role: 'user', content: '你好' })
      ).rejects.toThrow('对话不存在');
    });
  });

  describe('getMessagesByConversation - 分页查询消息', () => {
    /** 模拟 MongoDB Collection 链式调用 */
    interface MockChain {
      find: ReturnType<typeof vi.fn>;
      sort: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      toArray: ReturnType<typeof vi.fn>;
    }

    let mockChain: MockChain;

    beforeEach(() => {
      mockChain = {
        find: vi.fn().mockReturnThis(),
        sort: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        toArray: vi.fn().mockResolvedValue([]),
      };

      mockMongoDBService.getCollection.mockReturnValue(mockChain);
    });

    it('应按时间降序分页查询消息', async () => {
      const msg1 = createTestMessageDoc({ id: 'msg-1', content: '消息1' });
      const msg2 = createTestMessageDoc({ id: 'msg-2', content: '消息2' });
      mockChain.toArray.mockResolvedValueOnce([msg1, msg2]);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(mockChain.find).toHaveBeenCalledWith({ conversationId: 'conv-1' });
      expect(mockChain.sort).toHaveBeenCalledWith({ timestamp: -1 });
      expect(mockChain.limit).toHaveBeenCalledWith(51); // limit + 1 用于判断 hasMore
    });

    it('结果数超过 limit 时 hasMore 应为 true', async () => {
      // 返回 51 条消息（limit=50 + 1），hasMore 应为 true
      const msgs = Array.from({ length: 51 }, (_, i) =>
        createTestMessageDoc({ id: `msg-${i}`, content: `消息${i}` })
      );
      mockChain.toArray.mockResolvedValueOnce(msgs);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toHaveLength(50);
      expect(result.hasMore).toBe(true);
    });

    it('指定 beforeTimestamp 时应作为游标过滤', async () => {
      const before = new Date('2025-06-15T10:00:00.000Z');
      mockChain.toArray.mockResolvedValueOnce([]);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50, before);

      expect(result.messages).toHaveLength(0);
      expect(mockChain.find).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        timestamp: { $lt: before },
      });
    });

    it('MongoDB 未连接时应返回空结果', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('Collection 不存在时应返回空结果', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
    });

    it('查询异常时应返回空结果并记录错误', async () => {
      mockChain.toArray.mockRejectedValueOnce(new Error('查询失败'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toEqual([]);
      expect(result.hasMore).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('空结果时应返回 hasMore 为 false', async () => {
      mockChain.toArray.mockResolvedValueOnce([]);

      const service = await getService();
      const result = await service.getMessagesByConversation('conv-1', 50);

      expect(result.messages).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('reloadConversation - 强制重新加载对话', () => {
    it('应清除缓存后从数据库重新加载', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      // 先获取一次填充缓存
      await service.getConversation('conv-1');
      await flushMicrotasks();

      // 重新加载
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      const result = await service.reloadConversation('conv-1');

      expect(result).toEqual(conversation);
    });

    it('对话不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.reloadConversation('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('边界情况', () => {
    it('空 conversationId 创建对话应正常生成 UUID', async () => {
      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1');

      expect(conversation.id).toBeDefined();
      expect(conversation.id.length).toBeGreaterThan(0);
    });

    it('超长 content 消息应正常添加', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockResolvedValueOnce('msg-id');

      const service = await getService();
      const longContent = 'A'.repeat(10000);
      const message = await service.addMessage('conv-1', {
        role: 'user',
        content: longContent,
      });

      expect(message.content).toBe(longContent);
    });
  });

  describe('migrateMessages - 历史消息迁移', () => {
    it('MongoDB 未连接时应返回 0', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const result = await service.migrateMessages();

      expect(result).toBe(0);
    });

    it('无历史消息的对话应跳过迁移', async () => {
      const conversation = createTestConversation({ messages: [] });
      mockMongoDBService.find.mockResolvedValueOnce([conversation]);

      const service = await getService();
      const result = await service.migrateMessages();

      expect(result).toBe(0);
      expect(mockMongoDBService.insertOne).not.toHaveBeenCalled();
    });

    it('应将历史消息迁移到独立集合并清空原数组', async () => {
      const conversation = createTestConversation({
        messages: [
          { _id: 'msg-1', role: 'user', content: '消息1', timestamp: new Date('2025-06-15T10:00:00.000Z') },
          { _id: 'msg-2', role: 'assistant', content: '消息2', timestamp: new Date('2025-06-15T10:01:00.000Z') },
        ],
      });
      mockMongoDBService.find.mockResolvedValueOnce([conversation]);
      // 消息不存在，可以迁移
      mockMongoDBService.findOne.mockResolvedValue(null);
      mockMongoDBService.insertOne.mockResolvedValue('inserted-id');
      mockMongoDBService.updateOne.mockResolvedValue(true);

      const service = await getService();
      const result = await service.migrateMessages();

      expect(result).toBe(2);
      expect(mockMongoDBService.insertOne).toHaveBeenCalledTimes(2);
      // 应清空 conversation 文档的 messages 数组
      expect(mockMongoDBService.updateOne).toHaveBeenCalledWith(
        'conversations',
        { id: 'conv-1' },
        { $set: { messages: [] } }
      );
    });

    it('已存在的消息应跳过迁移（按 id 去重）', async () => {
      const conversation = createTestConversation({
        messages: [
          { _id: 'msg-1', role: 'user', content: '消息1', timestamp: new Date('2025-06-15T10:00:00.000Z') },
        ],
      });
      mockMongoDBService.find.mockResolvedValueOnce([conversation]);
      // 消息已存在
      mockMongoDBService.findOne.mockResolvedValue({ id: 'msg-1' });

      const service = await getService();
      const result = await service.migrateMessages();

      expect(result).toBe(0);
      expect(mockMongoDBService.insertOne).not.toHaveBeenCalled();
    });

    it('迁移过程抛出异常时应向上传播', async () => {
      mockMongoDBService.find.mockRejectedValueOnce(new Error('数据库查询失败'));

      const service = await getService();
      await expect(service.migrateMessages()).rejects.toThrow('数据库查询失败');
    });
  });

  describe('getConversationMessages - 从独立集合查询消息', () => {
    it('MongoDB 未连接时应返回空数组', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);

      const service = await getService();
      const result = await service.getConversationMessages('conv-1');

      expect(result).toEqual([]);
    });

    it('应返回指定对话的消息列表（按时间升序）', async () => {
      const msg1 = createTestMessageDoc({
        id: 'msg-1',
        content: '消息1',
        timestamp: new Date('2025-06-15T10:01:00.000Z'),
      });
      const msg2 = createTestMessageDoc({
        id: 'msg-2',
        content: '消息2',
        timestamp: new Date('2025-06-15T10:00:00.000Z'),
      });
      // 返回顺序为 msg1, msg2（时间降序），方法内部应按时间升序排序
      mockMongoDBService.find.mockResolvedValueOnce([msg1, msg2]);

      const service = await getService();
      const result = await service.getConversationMessages('conv-1');

      expect(result).toHaveLength(2);
      // 排序后 msg2（10:00）应在 msg1（10:01）之前
      expect(result[0]._id).toBe('msg-2');
      expect(result[1]._id).toBe('msg-1');
      expect(mockMongoDBService.find).toHaveBeenCalledWith('messages', { conversationId: 'conv-1' });
    });

    it('查询异常时应返回空数组', async () => {
      mockMongoDBService.find.mockRejectedValueOnce(new Error('查询失败'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.getConversationMessages('conv-1');

      expect(result).toEqual([]);
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
