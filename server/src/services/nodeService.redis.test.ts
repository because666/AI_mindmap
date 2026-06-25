import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Node, Relation } from '../types';

/**
 * Redis缓存集成测试
 * 测试NodeService的Redis二级缓存功能，包括：
 * - Redis读取/保存/删除缓存
 * - 内存→Redis→空缓存的查找顺序
 * - 缓存更新后异步同步到Redis
 * - 缓存失效同时清除内存和Redis
 * - Redis不可用时降级到内存缓存
 */

type MockRedisClient = {
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
};

/**
 * 创建模拟的Redis客户端
 * @param storage - 模拟的Redis存储对象
 * @returns 模拟的Redis客户端实例
 */
function createMockRedisClient(storage: Map<string, string>): MockRedisClient {
  return {
    get: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setex: vi.fn((key: string, ttl: number, value: string) => {
      storage.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (storage.delete(key)) count++;
      }
      return Promise.resolve(count);
    }),
    scan: vi.fn((cursor: string, ..._args: unknown[]) => {
      const allKeys = Array.from(storage.keys());
      const matched = allKeys.filter(k => k.startsWith('workspace_cache:'));
      if (cursor === '0') {
        return Promise.resolve([matched.length > 0 ? '0' : '0', matched]);
      }
      return Promise.resolve(['0', []]);
    }),
  };
}

/**
 * 创建测试用节点数据
 * @param overrides - 覆盖的节点属性
 * @returns 完整的节点数据
 */
function createTestNode(overrides: Partial<Node> = {}): Node {
  return {
    id: 'node-1',
    workspaceId: 'ws-1',
    title: '测试节点',
    summary: '',
    type: 'default',
    isRoot: false,
    isComposite: false,
    compositeChildren: [],
    hidden: false,
    expanded: false,
    position: { x: 100, y: 100 },
    tags: [],
    parentIds: [],
    childrenIds: [],
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

/**
 * 创建测试用关系数据
 * @param overrides - 覆盖的关系属性
 * @returns 完整的关系数据
 */
function createTestRelation(overrides: Partial<Relation> = {}): Relation {
  return {
    id: 'rel-1',
    workspaceId: 'ws-1',
    sourceId: 'node-1',
    targetId: 'node-2',
    type: 'parent-child',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('NodeService Redis缓存集成', () => {
  let mockRedisClient: MockRedisClient;
  let redisStorage: Map<string, string>;
  let mockRedisService: {
    getClient: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
  };
  let mockNeo4jService: {
    isConnected: ReturnType<typeof vi.fn>;
    runQuery: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.resetModules();

    redisStorage = new Map();
    mockRedisClient = createMockRedisClient(redisStorage);

    mockRedisService = {
      getClient: vi.fn(() => mockRedisClient),
      isConnected: vi.fn(() => true),
    };

    mockNeo4jService = {
      isConnected: vi.fn(() => false),
      runQuery: vi.fn(),
    };

    vi.doMock('../data/redis/connection', () => ({
      redisService: mockRedisService,
    }));

    vi.doMock('../data/neo4j/connection', () => ({
      neo4jService: mockNeo4jService,
    }));

    vi.doMock('../data/mongodb/connection', () => ({
      mongoDBService: { isConnected: () => false },
    }));

    vi.doMock('../data/vector/connection', () => ({
      vectorDBService: { isConnected: () => false },
    }));
  });

  /**
   * 动态导入NodeService，确保mock生效
   * 每次测试前重新导入以获取全新的实例
   */
  async function getNodeService() {
    const mod = await import('./nodeService');
    return mod.nodeService;
  }

  describe('getFromRedis - 从Redis读取工作区缓存', () => {
    it('Redis命中时应返回反序列化后的缓存数据', async () => {
      const node = createTestNode();
      const relation = createTestRelation();
      const cacheData = {
        nodes: { 'node-1': { ...node, createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString() } },
        relations: [{ ...relation, createdAt: relation.createdAt.toISOString() }],
        lastAccessTime: Date.now(),
      };
      redisStorage.set('workspace_cache:ws-1', JSON.stringify(cacheData));

      const service = await getNodeService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-1');
      expect(nodes[0].createdAt).toBeInstanceOf(Date);
      expect(mockRedisClient.get).toHaveBeenCalledWith('workspace_cache:ws-1');
    });

    it('Redis未命中时应返回空结果', async () => {
      const service = await getNodeService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(0);
    });

    it('Redis不可用时应降级到内存缓存', async () => {
      mockRedisService.getClient.mockReturnValue(null);

      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(1);
    });

    it('Redis读取异常时应返回null并继续使用内存缓存', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis连接断开'));

      const service = await getNodeService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(0);
    });
  });

  describe('saveToRedis - 保存工作区缓存到Redis', () => {
    it('创建节点后应异步同步到Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1', title: '测试' }, 'ws-1');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedisClient.setex).toHaveBeenCalled();
      const callArgs = mockRedisClient.setex.mock.calls[mockRedisClient.setex.mock.calls.length - 1];
      expect(callArgs[0]).toBe('workspace_cache:ws-1');
      expect(callArgs[1]).toBe(3600);

      const savedData = JSON.parse(callArgs[2]);
      expect(savedData.nodes['node-1']).toBeDefined();
      expect(savedData.nodes['node-1'].title).toBe('测试');
    });

    it('Redis不可用时应静默跳过保存', async () => {
      mockRedisService.getClient.mockReturnValue(null);

      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      expect(mockRedisClient.setex).not.toHaveBeenCalled();
    });

    it('Redis写入失败时应静默跳过不抛异常', async () => {
      mockRedisClient.setex.mockRejectedValueOnce(new Error('写入失败'));

      const service = await getNodeService();
      const node = await service.createNode({ id: 'node-1' }, 'ws-1');

      expect(node).toBeDefined();
      expect(node.id).toBe('node-1');
    });
  });

  describe('removeFromRedis - 从Redis删除工作区缓存', () => {
    it('应删除指定工作区的Redis缓存', async () => {
      redisStorage.set('workspace_cache:ws-1', '{}');

      const service = await getNodeService();
      await service.invalidateWorkspaceCache('ws-1');

      expect(mockRedisClient.del).toHaveBeenCalledWith('workspace_cache:ws-1');
    });

    it('Redis不可用时应静默跳过', async () => {
      mockRedisService.getClient.mockReturnValue(null);

      const service = await getNodeService();
      await service.invalidateWorkspaceCache('ws-1');

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('clearAllRedisCache - 清除所有Redis缓存', () => {
    it('应使用SCAN+DEL模式清除所有workspace_cache前缀的键', async () => {
      redisStorage.set('workspace_cache:ws-1', '{}');
      redisStorage.set('workspace_cache:ws-2', '{}');
      redisStorage.set('other_key', 'value');

      mockRedisClient.scan.mockResolvedValueOnce(['0', ['workspace_cache:ws-1', 'workspace_cache:ws-2']]);

      const service = await getNodeService();
      await service.clearAllRedisCache();

      expect(mockRedisClient.scan).toHaveBeenCalledWith('0', 'MATCH', 'workspace_cache:*', 'COUNT', 100);
      expect(mockRedisClient.del).toHaveBeenCalledWith('workspace_cache:ws-1', 'workspace_cache:ws-2');
    });

    it('没有匹配键时不应调用DEL', async () => {
      mockRedisClient.scan.mockResolvedValueOnce(['0', []]);

      const service = await getNodeService();
      await service.clearAllRedisCache();

      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('SCAN异常时应捕获错误不抛出', async () => {
      mockRedisClient.scan.mockRejectedValueOnce(new Error('SCAN失败'));

      const service = await getNodeService();
      await expect(service.clearAllRedisCache()).resolves.toBeUndefined();
    });
  });

  describe('getOrCreateWorkspaceCache - 三级缓存查找顺序', () => {
    it('内存命中时应直接返回，不查询Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      mockRedisClient.get.mockClear();

      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(1);
      expect(mockRedisClient.get).not.toHaveBeenCalled();
    });

    it('内存未命中Redis命中时应从Redis加载', async () => {
      const node = createTestNode();
      const cacheData = {
        nodes: { 'node-1': { ...node, createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString() } },
        relations: [],
        lastAccessTime: Date.now(),
      };
      redisStorage.set('workspace_cache:ws-1', JSON.stringify(cacheData));

      const service = await getNodeService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('node-1');
      expect(mockRedisClient.get).toHaveBeenCalledWith('workspace_cache:ws-1');
    });

    it('内存和Redis均未命中时应创建空缓存', async () => {
      const service = await getNodeService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(0);
      expect(mockRedisClient.get).toHaveBeenCalledWith('workspace_cache:ws-1');
    });

    it('从Redis加载后应重建nodeToWorkspace索引', async () => {
      const node1 = createTestNode({ id: 'node-1' });
      const node2 = createTestNode({ id: 'node-2' });
      const cacheData = {
        nodes: {
          'node-1': { ...node1, createdAt: node1.createdAt.toISOString(), updatedAt: node1.updatedAt.toISOString() },
          'node-2': { ...node2, createdAt: node2.createdAt.toISOString(), updatedAt: node2.updatedAt.toISOString() },
        },
        relations: [],
        lastAccessTime: Date.now(),
      };
      redisStorage.set('workspace_cache:ws-1', JSON.stringify(cacheData));

      const service = await getNodeService();
      await service.getAllNodes('ws-1');

      const loadedNode = await service.getNode('node-2');

      expect(loadedNode).not.toBeNull();
      expect(loadedNode?.id).toBe('node-2');
    });
  });

  describe('缓存更新后异步同步到Redis', () => {
    it('更新节点后应同步到Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1', title: '原始' }, 'ws-1');

      mockRedisClient.setex.mockClear();

      await service.updateNode('node-1', { title: '更新后' });

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedisClient.setex).toHaveBeenCalled();
      const lastCall = mockRedisClient.setex.mock.calls[mockRedisClient.setex.mock.calls.length - 1];
      const savedData = JSON.parse(lastCall[2]);
      expect(savedData.nodes['node-1'].title).toBe('更新后');
    });

    it('删除节点后应同步到Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      mockRedisClient.setex.mockClear();

      await service.deleteNode('node-1');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedisClient.setex).toHaveBeenCalled();
      const lastCall = mockRedisClient.setex.mock.calls[mockRedisClient.setex.mock.calls.length - 1];
      const savedData = JSON.parse(lastCall[2]);
      expect(savedData.nodes['node-1']).toBeUndefined();
      expect(savedData.nodes['node-2']).toBeDefined();
    });

    it('创建关系后应同步到Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      mockRedisClient.setex.mockClear();

      await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedisClient.setex).toHaveBeenCalled();
      const lastCall = mockRedisClient.setex.mock.calls[mockRedisClient.setex.mock.calls.length - 1];
      const savedData = JSON.parse(lastCall[2]);
      expect(savedData.relations).toHaveLength(1);
      expect(savedData.relations[0].sourceId).toBe('node-1');
    });

    it('删除关系后应同步到Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');
      const relation = await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      mockRedisClient.setex.mockClear();

      await service.deleteRelation(relation.id);

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedisClient.setex).toHaveBeenCalled();
      const lastCall = mockRedisClient.setex.mock.calls[mockRedisClient.setex.mock.calls.length - 1];
      const savedData = JSON.parse(lastCall[2]);
      expect(savedData.relations).toHaveLength(0);
    });
  });

  describe('缓存清除逻辑', () => {
    it('invalidateWorkspaceCache应同时清除内存和Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      await service.invalidateWorkspaceCache('ws-1');

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBe(0);
      expect(mockRedisClient.del).toHaveBeenCalledWith('workspace_cache:ws-1');
    });

    it('clearAllCache应同时清除所有内存和Redis缓存', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-2');

      mockRedisClient.scan.mockResolvedValueOnce(['0', ['workspace_cache:ws-1', 'workspace_cache:ws-2']]);

      await service.clearAllCache();

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBe(0);
      expect(stats.totalNodes).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(mockRedisClient.scan).toHaveBeenCalled();
    });

    it('clearMemoryData仅清除内存不影响Redis', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      service.clearMemoryData();

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBe(0);
      expect(mockRedisClient.scan).not.toHaveBeenCalled();
      expect(mockRedisClient.del).not.toHaveBeenCalledWith('workspace_cache:ws-1');
    });
  });

  describe('Redis不可用时的降级方案', () => {
    it('Redis客户端为null时所有操作应正常使用内存缓存', async () => {
      mockRedisService.getClient.mockReturnValue(null);

      const service = await getNodeService();
      await service.createNode({ id: 'node-1', title: '测试' }, 'ws-1');

      const node = await service.getNode('node-1');
      expect(node).not.toBeNull();
      expect(node?.title).toBe('测试');

      const nodes = await service.getAllNodes('ws-1');
      expect(nodes).toHaveLength(1);
    });

    it('Redis断开后已加载的内存缓存应继续工作', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      mockRedisService.getClient.mockReturnValue(null);

      const node = await service.getNode('node-1');
      expect(node).not.toBeNull();
      expect(node?.id).toBe('node-1');
    });

    it('Redis不可用时LRU淘汰逻辑应正常工作', async () => {
      mockRedisService.getClient.mockReturnValue(null);

      const service = await getNodeService();

      for (let i = 0; i < 55; i++) {
        await service.createNode({ id: `node-${i}` }, `ws-${i}`);
      }

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBeLessThanOrEqual(50);
    });
  });

  describe('Date字段反序列化', () => {
    it('从Redis加载的节点Date字段应为Date实例而非字符串', async () => {
      const node = createTestNode();
      const cacheData = {
        nodes: { 'node-1': { ...node, createdAt: '2025-06-15T10:30:00.000Z', updatedAt: '2025-06-15T10:30:00.000Z' } },
        relations: [],
        lastAccessTime: Date.now(),
      };
      redisStorage.set('workspace_cache:ws-1', JSON.stringify(cacheData));

      const service = await getNodeService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes[0].createdAt).toBeInstanceOf(Date);
      expect(nodes[0].updatedAt).toBeInstanceOf(Date);
      expect(nodes[0].createdAt.toISOString()).toBe('2025-06-15T10:30:00.000Z');
    });

    it('从Redis加载的关系Date字段应为Date实例而非字符串', async () => {
      const relation = createTestRelation();
      const cacheData = {
        nodes: {},
        relations: [{ ...relation, createdAt: '2025-06-15T10:30:00.000Z' }],
        lastAccessTime: Date.now(),
      };
      redisStorage.set('workspace_cache:ws-1', JSON.stringify(cacheData));

      const service = await getNodeService();
      const relations = await service.getRelations('ws-1');

      expect(relations[0].createdAt).toBeInstanceOf(Date);
      expect(relations[0].createdAt.toISOString()).toBe('2025-06-15T10:30:00.000Z');
    });
  });

  describe('TTL设置', () => {
    it('保存到Redis时应设置TTL为3600秒', async () => {
      const service = await getNodeService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockRedisClient.setex).toHaveBeenCalled();
      const callArgs = mockRedisClient.setex.mock.calls[mockRedisClient.setex.mock.calls.length - 1];
      expect(callArgs[1]).toBe(3600);
    });
  });
});
