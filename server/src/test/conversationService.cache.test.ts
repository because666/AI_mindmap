import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * 对话服务 Redis + 内存二级缓存单元测试
 * 验证缓存的命中、过期、失效和降级逻辑
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
 * 等待所有微任务完成
 * 用于等待 fire-and-forget 的 Redis 异步操作（void this.updateRedisCache/invalidateRedisCache）完成
 * @returns Promise，在下一个宏任务中解决
 */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve: () => void) => setTimeout(resolve, 0));
}

describe('ConversationService Redis + 内存二级缓存', () => {
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

  afterEach(() => {
    vi.useRealTimers();
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

  describe('内存缓存命中', () => {
    it('第二次 getConversation 不查库也不查 Redis', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      // 第一次获取，内存未命中、Redis 未命中，查库并回填内存和 Redis
      const result1 = await service.getConversation('conv-1');
      expect(result1).toEqual(conversation);

      // 等待异步的 Redis 回填完成
      await flushMicrotasks();

      // 第二次获取，应从内存缓存命中，不查库也不查 Redis
      const result2 = await service.getConversation('conv-1');
      expect(result2).toEqual(conversation);

      // findOne 只被调用一次（第一次查库）
      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(1);
      // cacheGet 只被调用一次（第一次查 Redis 未命中）
      expect(mockRedisService.cacheGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('内存缓存过期后 Redis 命中', () => {
    it('内存 TTL 过期后从 Redis 获取并回填内存', async () => {
      const conversation = createTestConversation();
      // Redis 始终返回对话数据
      mockRedisService.cacheGet.mockResolvedValue(conversation);

      const service = await getService();
      // 第一次获取，内存未命中，Redis 命中，回填内存
      const result1 = await service.getConversation('conv-1');
      expect(result1).toEqual(conversation);

      // 推进时间超过内存 TTL（30秒），使内存缓存过期
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now + 31 * 1000);

      // 第二次获取，内存过期，应从 Redis 命中并回填内存
      const result2 = await service.getConversation('conv-1');
      expect(result2).toEqual(conversation);

      // 不应查库
      expect(mockMongoDBService.findOne).not.toHaveBeenCalled();
      // cacheGet 应被调用两次（第一次和第二次都查 Redis）
      expect(mockRedisService.cacheGet).toHaveBeenCalledTimes(2);
    });
  });

  describe('Redis 和内存都未命中查库', () => {
    it('首次 getConversation 查库并回填内存和 Redis', async () => {
      const conversation = createTestConversation();
      mockRedisService.cacheGet.mockResolvedValue(null);
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      const result = await service.getConversation('conv-1');

      expect(result).toEqual(conversation);
      // 应查 Redis（未命中）
      expect(mockRedisService.cacheGet).toHaveBeenCalledWith('conversation:conv-1');
      // 应查库（命中）
      expect(mockMongoDBService.findOne).toHaveBeenCalledWith('conversations', { id: 'conv-1' });

      // 等待异步的 Redis 回填完成
      await flushMicrotasks();

      // 应回填 Redis
      expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
        'conversation:conv-1',
        conversation,
        60
      );
    });
  });

  describe('缓存失效', () => {
    it('clearConversation 后内存和 Redis 都被清除', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.deleteMany.mockResolvedValueOnce(0);

      const service = await getService();
      // 先获取对话，填充内存和 Redis 缓存
      await service.getConversation('conv-1');
      await flushMicrotasks();

      // 清空对话
      await service.clearConversation('conv-1');
      await flushMicrotasks();

      // 应清除 Redis 缓存
      expect(mockRedisService.cacheDel).toHaveBeenCalledWith('conversation:conv-1');

      // 再次获取，内存应未命中，需要查库
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      await service.getConversation('conv-1');

      // findOne 应被调用两次（第一次填充缓存，第二次清空后重新查库）
      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(2);
    });

    it('deleteConversation 后内存和 Redis 都被清除', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.deleteOne.mockResolvedValueOnce(true);
      mockMongoDBService.deleteMany.mockResolvedValueOnce(0);

      const service = await getService();
      // 先获取对话，填充内存和 Redis 缓存
      await service.getConversation('conv-1');
      await flushMicrotasks();

      // 删除对话
      await service.deleteConversation('conv-1');
      await flushMicrotasks();

      // 应清除 Redis 缓存
      expect(mockRedisService.cacheDel).toHaveBeenCalledWith('conversation:conv-1');
    });

    it('evictFromCache 后内存和 Redis 都被清除', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);

      const service = await getService();
      // 先获取对话，填充内存和 Redis 缓存
      await service.getConversation('conv-1');
      await flushMicrotasks();

      // 调用 evictFromCache（同步方法，内部异步清除 Redis）
      service.evictFromCache('conv-1');
      await flushMicrotasks();

      // 应清除 Redis 缓存
      expect(mockRedisService.cacheDel).toHaveBeenCalledWith('conversation:conv-1');

      // 再次获取，内存应未命中，需要查库
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      await service.getConversation('conv-1');

      // findOne 应被调用两次（第一次填充缓存，第二次清除后重新查库）
      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('Redis 降级', () => {
    it('Redis 不可用时降级到纯内存缓存，服务正常可用', async () => {
      const conversation = createTestConversation();
      // Redis 不可用，所有操作返回 null/undefined
      mockRedisService.cacheGet.mockResolvedValue(null);
      mockRedisService.cacheSet.mockResolvedValue(undefined);
      mockRedisService.cacheDel.mockResolvedValue(undefined);

      const service = await getService();
      // 第一次获取，内存未命中，Redis 不可用（返回 null），查库
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      const result1 = await service.getConversation('conv-1');
      expect(result1).toEqual(conversation);

      await flushMicrotasks();

      // 第二次获取，应从内存缓存命中
      const result2 = await service.getConversation('conv-1');
      expect(result2).toEqual(conversation);

      // findOne 只被调用一次（第一次查库）
      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(1);
    });

    it('Redis cacheSet 抛异常时降级到纯内存缓存，不中断服务', async () => {
      const conversation = createTestConversation();
      // cacheSet 抛异常，模拟 Redis 写入失败
      mockRedisService.cacheSet.mockRejectedValue(new Error('Redis 写入失败'));
      mockRedisService.cacheGet.mockResolvedValue(null);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = await getService();
      // 第一次获取，内存未命中，Redis 不可用，查库
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      const result1 = await service.getConversation('conv-1');
      expect(result1).toEqual(conversation);

      // 等待异步的 Redis 回填完成（会抛异常但被捕获）
      await flushMicrotasks();

      // 第二次获取，应从内存缓存命中（Redis 写入失败不影响内存缓存）
      const result2 = await service.getConversation('conv-1');
      expect(result2).toEqual(conversation);

      // findOne 只被调用一次（第一次查库）
      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(1);

      // 应记录降级 warn 日志
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });

    it('Redis cacheDel 抛异常时降级到纯内存缓存，不中断服务', async () => {
      const conversation = createTestConversation();
      // cacheDel 抛异常，模拟 Redis 删除失败
      mockRedisService.cacheDel.mockRejectedValue(new Error('Redis 删除失败'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = await getService();
      // 先获取对话，填充缓存
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      await service.getConversation('conv-1');
      await flushMicrotasks();

      // 清空对话，Redis 删除会抛异常但不影响主流程
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.deleteMany.mockResolvedValueOnce(0);
      const result = await service.clearConversation('conv-1');
      expect(result).toBe(true);

      await flushMicrotasks();

      // 应记录降级 warn 日志
      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
    });
  });

  describe('createConversation 写入缓存', () => {
    it('创建对话后同时更新内存和 Redis 缓存', async () => {
      mockMongoDBService.insertOne.mockResolvedValueOnce('inserted-id');

      const service = await getService();
      const conversation = await service.createConversation('node-1', 'ws-1', 'visitor-1');

      await flushMicrotasks();

      // 应更新 Redis 缓存
      expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
        `conversation:${conversation.id}`,
        expect.objectContaining({
          id: conversation.id,
          nodeId: 'node-1',
          workspaceId: 'ws-1',
        }),
        60
      );

      // 再次获取应从内存缓存命中，不查库
      const result = await service.getConversation(conversation.id);
      expect(result).toEqual(conversation);
      expect(mockMongoDBService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('addMessage 更新缓存', () => {
    it('添加消息后同时更新内存和 Redis 缓存', async () => {
      const conversation = createTestConversation();
      mockMongoDBService.findOne.mockResolvedValueOnce(conversation);
      mockMongoDBService.updateOne.mockResolvedValueOnce(true);
      mockMongoDBService.insertOne.mockResolvedValueOnce('msg-id');

      const service = await getService();
      // 先获取对话，填充缓存
      await service.getConversation('conv-1');
      await flushMicrotasks();

      // 清除 cacheSet 的调用记录，便于后续断言
      mockRedisService.cacheSet.mockClear();

      // 添加消息
      const message = await service.addMessage('conv-1', { role: 'user', content: '你好' });
      expect(message.content).toBe('你好');

      await flushMicrotasks();

      // 应更新 Redis 缓存
      expect(mockRedisService.cacheSet).toHaveBeenCalledWith(
        'conversation:conv-1',
        expect.objectContaining({
          id: 'conv-1',
        }),
        60
      );
    });
  });
});
