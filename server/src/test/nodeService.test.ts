import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Node, Relation } from '../types';

/**
 * NodeService 节点服务单元测试
 * 覆盖节点的 CRUD、关系管理、Neo4j 操作（mock）、缓存管理等核心流程
 * 使用 vi.doMock + 动态导入模拟 neo4jService、mongoDBService、redisService、vectorDBService
 */

/** 模拟的 neo4jService 方法集合 */
interface MockNeo4jService {
  isConnected: ReturnType<typeof vi.fn>;
  runQuery: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 方法集合 */
interface MockMongoDBService {
  isConnected: ReturnType<typeof vi.fn>;
  getCollection: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
}

/** 模拟的 redisService 方法集合 */
interface MockRedisService {
  getClient: ReturnType<typeof vi.fn>;
  isConnected: ReturnType<typeof vi.fn>;
}

/** 模拟的 MockRedisClient */
interface MockRedisClient {
  get: ReturnType<typeof vi.fn>;
  setex: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  scan: ReturnType<typeof vi.fn>;
}

/** 模拟的 MongoDB Collection */
interface MockCollection {
  updateOne: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
}

let mockNeo4jService: MockNeo4jService;
let mockMongoDBService: MockMongoDBService;
let mockRedisService: MockRedisService;
let mockRedisClient: MockRedisClient;

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
    summary: '测试摘要',
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

describe('NodeService 节点服务', () => {
  beforeEach(() => {
    vi.resetModules();

    mockRedisClient = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      scan: vi.fn().mockResolvedValue(['0', []]),
    };

    mockNeo4jService = {
      isConnected: vi.fn(() => false),
      runQuery: vi.fn().mockResolvedValue([]),
    };

    mockMongoDBService = {
      isConnected: vi.fn(() => false),
      getCollection: vi.fn().mockReturnValue(null),
      deleteOne: vi.fn().mockResolvedValue(true),
    };

    mockRedisService = {
      getClient: vi.fn(() => mockRedisClient),
      isConnected: vi.fn(() => true),
    };

    vi.doMock('../data/neo4j/connection', () => ({
      neo4jService: mockNeo4jService,
    }));

    vi.doMock('../data/mongodb/connection', () => ({
      mongoDBService: mockMongoDBService,
    }));

    vi.doMock('../data/redis/connection', () => ({
      redisService: mockRedisService,
    }));

    vi.doMock('../data/vector/connection', () => ({
      vectorDBService: { isConnected: () => false },
    }));

    vi.doMock('uuid', () => ({
      v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2, 8)),
    }));
  });

  /**
   * 动态导入 nodeService，确保 mock 生效
   * 每次测试前重新导入以获取全新的实例
   * @returns nodeService 实例
   */
  async function getService() {
    const mod = await import('../services/nodeService');
    return mod.nodeService;
  }

  describe('createNode - 创建节点', () => {
    it('正常流程：应创建节点并写入缓存', async () => {
      const service = await getService();
      const node = await service.createNode({ title: '新节点' }, 'ws-1');

      expect(node.id).toBeDefined();
      expect(node.title).toBe('新节点');
      expect(node.workspaceId).toBe('ws-1');
      expect(node.type).toBe('default');
      expect(node.createdAt).toBeInstanceOf(Date);
    });

    it('应使用默认值填充未提供的字段', async () => {
      const service = await getService();
      const node = await service.createNode({}, 'ws-1');

      expect(node.title).toBe('新节点');
      expect(node.summary).toBe('');
      expect(node.isRoot).toBe(false);
      expect(node.hidden).toBe(false);
      expect(node.tags).toEqual([]);
      expect(node.parentIds).toEqual([]);
      expect(node.childrenIds).toEqual([]);
      expect(node.position).toEqual({ x: 100, y: 100 });
    });

    it('应 trim 标题和摘要', async () => {
      const service = await getService();
      const node = await service.createNode(
        { title: '  带空格的标题  ', summary: '  带空格的摘要  ' },
        'ws-1'
      );

      expect(node.title).toBe('带空格的标题');
      expect(node.summary).toBe('带空格的摘要');
    });

    it('空标题时应使用默认标题"新节点"', async () => {
      const service = await getService();
      const node = await service.createNode({ title: '   ' }, 'ws-1');

      expect(node.title).toBe('新节点');
    });

    it('重复 ID 应抛出异常', async () => {
      const service = await getService();
      await service.createNode({ id: 'duplicate-id' }, 'ws-1');

      await expect(
        service.createNode({ id: 'duplicate-id' }, 'ws-1')
      ).rejects.toThrow('节点 duplicate-id 已存在');
    });

    it('Neo4j 连接时应同步写入 Neo4j', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);

      const service = await getService();
      await service.createNode({ title: '测试' }, 'ws-1');

      expect(mockNeo4jService.runQuery).toHaveBeenCalledWith(
        'CREATE (n:Node $props)',
        expect.objectContaining({ props: expect.any(Object) })
      );
    });

    it('Neo4j 写入失败时不应影响主流程', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);
      mockNeo4jService.runQuery.mockRejectedValueOnce(new Error('Neo4j 错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const node = await service.createNode({ title: '测试' }, 'ws-1');

      expect(node).toBeDefined();
      expect(node.title).toBe('测试');
      errorSpy.mockRestore();
    });

    it('指定 createdBy 时应记录创建者', async () => {
      const service = await getService();
      const node = await service.createNode({ title: '测试' }, 'ws-1', 'visitor-1');

      expect(node.createdBy).toBe('visitor-1');
    });
  });

  describe('getNode - 获取节点', () => {
    it('应从缓存中获取节点', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1', title: '测试' }, 'ws-1');

      const node = await service.getNode('node-1');

      expect(node).not.toBeNull();
      expect(node!.id).toBe('node-1');
      expect(node!.title).toBe('测试');
    });

    it('空 ID 应返回 null', async () => {
      const service = await getService();
      const node = await service.getNode('');

      expect(node).toBeNull();
    });

    it('非字符串 ID 应返回 null', async () => {
      const service = await getService();
      const node = await service.getNode(null as unknown as string);

      expect(node).toBeNull();
    });

    it('不存在的节点应返回 null', async () => {
      const service = await getService();
      const node = await service.getNode('non-existent');

      expect(node).toBeNull();
    });

    it('Neo4j 连接时应从 Neo4j 加载节点', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);
      const neo4jNode = {
        id: 'neo4j-node',
        workspaceId: 'ws-1',
        title: 'Neo4j 节点',
        summary: '',
        type: 'default',
        isRoot: false,
        isComposite: false,
        hidden: false,
        expanded: false,
        positionJson: JSON.stringify({ x: 200, y: 200 }),
        tags: [],
        parentIds: [],
        childrenIds: [],
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };
      mockNeo4jService.runQuery.mockResolvedValueOnce([{ n: neo4jNode }]);

      const service = await getService();
      const node = await service.getNode('neo4j-node');

      expect(node).not.toBeNull();
      expect(node!.id).toBe('neo4j-node');
      expect(node!.title).toBe('Neo4j 节点');
      expect(node!.position).toEqual({ x: 200, y: 200 });
    });

    it('Neo4j 查询失败时应返回 null', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);
      mockNeo4jService.runQuery.mockRejectedValueOnce(new Error('Neo4j 错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const node = await service.getNode('non-existent');

      expect(node).toBeNull();
      errorSpy.mockRestore();
    });
  });

  describe('updateNode - 更新节点', () => {
    it('应更新节点属性', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1', title: '原标题' }, 'ws-1');

      const updated = await service.updateNode('node-1', { title: '新标题' });

      expect(updated).not.toBeNull();
      expect(updated!.title).toBe('新标题');
    });

    it('应 trim 标题和摘要', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      const updated = await service.updateNode('node-1', {
        title: '  新标题  ',
        summary: '  新摘要  ',
      });

      expect(updated!.title).toBe('新标题');
      expect(updated!.summary).toBe('新摘要');
    });

    it('空标题时应保留原标题', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1', title: '原标题' }, 'ws-1');

      const updated = await service.updateNode('node-1', { title: '   ' });

      expect(updated!.title).toBe('原标题');
    });

    it('应保留不可变属性（id、workspaceId、createdAt）', async () => {
      const service = await getService();
      const original = await service.createNode({ id: 'node-1', title: '原' }, 'ws-1');

      const updated = await service.updateNode('node-1', {
        id: 'new-id',
        workspaceId: 'new-ws',
        createdAt: new Date('2020-01-01'),
        title: '新',
      } as Partial<Node>);

      expect(updated!.id).toBe('node-1');
      expect(updated!.workspaceId).toBe('ws-1');
      expect(updated!.createdAt).toEqual(original.createdAt);
    });

    it('空 ID 应返回 null', async () => {
      const service = await getService();
      const result = await service.updateNode('', { title: '新' });

      expect(result).toBeNull();
    });

    it('不存在的节点应返回 null', async () => {
      const service = await getService();
      const result = await service.updateNode('non-existent', { title: '新' });

      expect(result).toBeNull();
    });
  });

  describe('deleteNode - 删除节点', () => {
    it('应删除节点', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      const result = await service.deleteNode('node-1');

      expect(result).toBe(true);
      const node = await service.getNode('node-1');
      expect(node).toBeNull();
    });

    it('空 ID 应返回 false', async () => {
      const service = await getService();
      const result = await service.deleteNode('');

      expect(result).toBe(false);
    });

    it('不存在的节点应返回 false', async () => {
      const service = await getService();
      const result = await service.deleteNode('non-existent');

      expect(result).toBe(false);
    });

    it('应同时删除子节点', async () => {
      const service = await getService();
      await service.createNode({ id: 'parent', childrenIds: ['child'] }, 'ws-1');
      await service.createNode({ id: 'child', parentIds: ['parent'] }, 'ws-1');

      await service.deleteNode('parent');

      expect(await service.getNode('parent')).toBeNull();
      expect(await service.getNode('child')).toBeNull();
    });
  });

  describe('getAllNodes - 获取工作区所有节点', () => {
    it('应返回工作区内所有节点', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(2);
    });

    it('空工作区应返回空数组', async () => {
      const service = await getService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toEqual([]);
    });

    it('Neo4j 连接时应从 Neo4j 加载节点', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);
      const neo4jNode = {
        id: 'neo4j-node',
        workspaceId: 'ws-1',
        title: 'Neo4j',
        summary: '',
        type: 'default',
        isRoot: false,
        isComposite: false,
        hidden: false,
        expanded: false,
        positionJson: JSON.stringify({ x: 100, y: 100 }),
        tags: [],
        parentIds: [],
        childrenIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      mockNeo4jService.runQuery.mockResolvedValueOnce([{ n: neo4jNode }]);

      const service = await getService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toHaveLength(1);
      expect(nodes[0].id).toBe('neo4j-node');
    });
  });

  describe('getRootNodes - 获取根节点', () => {
    it('应仅返回 isRoot 且未隐藏的节点', async () => {
      const service = await getService();
      await service.createNode({ id: 'root-1', isRoot: true, hidden: false }, 'ws-1');
      await service.createNode({ id: 'root-2', isRoot: true, hidden: true }, 'ws-1');
      await service.createNode({ id: 'normal', isRoot: false }, 'ws-1');

      const roots = await service.getRootNodes('ws-1');

      expect(roots).toHaveLength(1);
      expect(roots[0].id).toBe('root-1');
    });
  });

  describe('createChildNode - 创建子节点', () => {
    it('应创建子节点并建立父子关系', async () => {
      const service = await getService();
      await service.createNode({ id: 'parent' }, 'ws-1');

      const child = await service.createChildNode('parent', '子节点', 'ws-1');

      expect(child.title).toBe('子节点');
      expect(child.parentIds).toContain('parent');

      const parent = await service.getNode('parent');
      expect(parent!.childrenIds).toContain(child.id);
    });

    it('父节点不存在时应抛出异常', async () => {
      const service = await getService();
      await expect(
        service.createChildNode('non-existent', '子节点', 'ws-1')
      ).rejects.toThrow('父节点不存在');
    });

    it('空标题时应使用默认标题"新分支"', async () => {
      const service = await getService();
      await service.createNode({ id: 'parent' }, 'ws-1');

      const child = await service.createChildNode('parent', '   ', 'ws-1');

      expect(child.title).toBe('新分支');
    });
  });

  describe('createRelation - 创建关系', () => {
    it('应创建节点间的关系', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      const relation = await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      expect(relation.id).toBeDefined();
      expect(relation.sourceId).toBe('node-1');
      expect(relation.targetId).toBe('node-2');
      expect(relation.type).toBe('parent-child');
    });

    it('源节点或目标节点 ID 为空时应抛出异常', async () => {
      const service = await getService();
      await expect(
        service.createRelation({ sourceId: '', targetId: 'node-2', type: 'parent-child' }, 'ws-1')
      ).rejects.toThrow('源节点和目标节点ID不能为空');
    });

    it('源节点或目标节点不存在时应抛出异常', async () => {
      const service = await getService();
      await expect(
        service.createRelation({
          sourceId: 'non-existent',
          targetId: 'also-non-existent',
          type: 'parent-child',
        }, 'ws-1')
      ).rejects.toThrow('源节点或目标节点不存在');
    });

    it('重复关系应返回已存在的关系', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      const rel1 = await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      const rel2 = await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      expect(rel1.id).toBe(rel2.id);
    });
  });

  describe('getRelations - 获取关系', () => {
    it('应返回工作区内的所有关系', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');
      await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      const relations = await service.getRelations('ws-1');

      expect(relations).toHaveLength(1);
    });

    it('空工作区应返回空数组', async () => {
      const service = await getService();
      const relations = await service.getRelations('ws-1');

      expect(relations).toEqual([]);
    });
  });

  describe('getRelationsForNode - 获取节点相关关系', () => {
    it('应返回与指定节点相关的所有关系', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');
      await service.createNode({ id: 'node-3' }, 'ws-1');
      await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');
      await service.createRelation({
        sourceId: 'node-3',
        targetId: 'node-1',
        type: 'references',
      }, 'ws-1');

      const relations = await service.getRelationsForNode('node-1');

      expect(relations).toHaveLength(2);
    });

    it('空 nodeId 应返回空数组', async () => {
      const service = await getService();
      const relations = await service.getRelationsForNode('');

      expect(relations).toEqual([]);
    });
  });

  describe('deleteRelation - 删除关系', () => {
    it('应删除指定关系', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');
      const relation = await service.createRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      }, 'ws-1');

      const result = await service.deleteRelation(relation.id);

      expect(result).toBe(true);
      const relations = await service.getRelations('ws-1');
      expect(relations).toHaveLength(0);
    });

    it('空 ID 应返回 false', async () => {
      const service = await getService();
      const result = await service.deleteRelation('');

      expect(result).toBe(false);
    });

    it('不存在的关系应返回 false', async () => {
      const service = await getService();
      const result = await service.deleteRelation('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('createCompositeNode - 创建复合节点', () => {
    it('应创建复合节点并隐藏子节点', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      const composite = await service.createCompositeNode(['node-1', 'node-2'], '复合节点', 'ws-1');

      expect(composite.isComposite).toBe(true);
      expect(composite.compositeChildren).toEqual(['node-1', 'node-2']);
      expect(composite.title).toBe('复合节点');

      const node1 = await service.getNode('node-1');
      expect(node1!.hidden).toBe(true);
      expect(node1!.compositeParent).toBe(composite.id);
    });

    it('节点数量不足时应抛出异常', async () => {
      const service = await getService();
      await expect(
        service.createCompositeNode(['node-1'], '复合节点', 'ws-1')
      ).rejects.toThrow('至少需要2个节点才能创建复合节点');
    });

    it('有效节点不足时应抛出异常', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      await expect(
        service.createCompositeNode(['node-1', 'non-existent'], '复合节点', 'ws-1')
      ).rejects.toThrow('至少需要2个有效节点');
    });

    it('空标题时应使用默认标题"复合节点"', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      const composite = await service.createCompositeNode(['node-1', 'node-2'], '   ', 'ws-1');

      expect(composite.title).toBe('复合节点');
    });
  });

  describe('缓存管理', () => {
    it('getCacheStats 应返回缓存统计信息', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      await service.createNode({ id: 'node-2' }, 'ws-1');

      const stats = service.getCacheStats();

      expect(stats.totalWorkspaces).toBe(1);
      expect(stats.totalNodes).toBe(2);
      expect(stats.totalRelations).toBe(0);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });

    it('clearAllCache 应清除所有缓存', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      await service.clearAllCache();

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBe(0);
      expect(stats.totalNodes).toBe(0);
    });

    it('clearMemoryData 应清空内存数据', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      service.clearMemoryData();

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBe(0);
      expect(stats.totalNodes).toBe(0);
    });

    it('invalidateWorkspaceCache 应使指定工作区缓存失效', async () => {
      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');

      await service.invalidateWorkspaceCache('ws-1');

      const stats = service.getCacheStats();
      expect(stats.totalWorkspaces).toBe(0);
    });
  });

  describe('Neo4j 操作', () => {
    it('Neo4j 连接时创建节点应执行 CREATE 语句', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);

      const service = await getService();
      await service.createNode({ id: 'node-1', title: '测试' }, 'ws-1');

      expect(mockNeo4jService.runQuery).toHaveBeenCalledWith(
        'CREATE (n:Node $props)',
        expect.objectContaining({
          props: expect.objectContaining({
            id: 'node-1',
            title: '测试',
            workspaceId: 'ws-1',
          }),
        })
      );
    });

    it('Neo4j 连接时更新节点应执行 SET 语句', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);

      const service = await getService();
      await service.createNode({ id: 'node-1', title: '原' }, 'ws-1');
      mockNeo4jService.runQuery.mockClear();

      await service.updateNode('node-1', { title: '新' });

      expect(mockNeo4jService.runQuery).toHaveBeenCalledWith(
        'MATCH (n:Node {id: $id}) SET n += $props',
        expect.objectContaining({ id: 'node-1' })
      );
    });

    it('Neo4j 连接时删除节点应执行 DETACH DELETE 语句', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);

      const service = await getService();
      await service.createNode({ id: 'node-1' }, 'ws-1');
      mockNeo4jService.runQuery.mockClear();

      await service.deleteNode('node-1');

      expect(mockNeo4jService.runQuery).toHaveBeenCalledWith(
        'MATCH (n:Node {id: $id}) DETACH DELETE n',
        { id: 'node-1' }
      );
    });
  });

  describe('异常处理', () => {
    it('Neo4j 创建节点失败时不应抛出异常', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);
      mockNeo4jService.runQuery.mockRejectedValueOnce(new Error('Neo4j 错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const node = await service.createNode({ title: '测试' }, 'ws-1');

      expect(node).toBeDefined();
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('Neo4j 获取节点失败时应返回 null', async () => {
      mockNeo4jService.isConnected.mockReturnValue(true);
      mockNeo4jService.runQuery.mockRejectedValueOnce(new Error('Neo4j 错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const node = await service.getNode('non-existent');

      expect(node).toBeNull();
      errorSpy.mockRestore();
    });

    it('Redis 读取失败时应降级到内存缓存', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis 错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const nodes = await service.getAllNodes('ws-1');

      expect(nodes).toEqual([]);
      errorSpy.mockRestore();
    });
  });

  describe('getAllDescendants - 获取所有后代节点', () => {
    it('应递归获取所有后代节点', async () => {
      const service = await getService();
      // 先创建父节点
      const parent = await service.createNode(
        { title: '父节点', isRoot: true },
        'ws-1'
      );
      // 使用 createChildNode 创建子节点（会自动更新父节点的 childrenIds）
      const child1 = await service.createChildNode(
        parent.id,
        '子节点1',
        'ws-1'
      );
      await service.createChildNode(
        child1.id,
        '子节点2',
        'ws-1'
      );

      const descendants = await service.getAllDescendants(parent.id);
      expect(descendants).toHaveLength(2);
    });

    it('无后代的节点应返回空数组', async () => {
      const service = await getService();
      const node = await service.createNode(
        { title: '叶节点', isRoot: true },
        'ws-1'
      );

      const descendants = await service.getAllDescendants(node.id);
      expect(descendants).toEqual([]);
    });

    it('不存在的节点应返回空数组', async () => {
      const service = await getService();
      const descendants = await service.getAllDescendants('non-existent');
      expect(descendants).toEqual([]);
    });
  });

  describe('expandCompositeNode - 展开/折叠复合节点', () => {
    it('非复合节点应返回 null', async () => {
      const service = await getService();
      const node = await service.createNode(
        { title: '普通节点', isRoot: true },
        'ws-1'
      );

      const result = await service.expandCompositeNode(node.id);
      expect(result).toBeNull();
    });

    it('不存在的节点应返回 null', async () => {
      const service = await getService();
      const result = await service.expandCompositeNode('non-existent');
      expect(result).toBeNull();
    });

    it('折叠状态的复合节点应展开并显示子节点', async () => {
      const service = await getService();
      // 创建复合节点
      const node1 = await service.createNode(
        { title: '节点1', isRoot: true },
        'ws-1'
      );
      const node2 = await service.createNode(
        { title: '节点2', isRoot: true },
        'ws-1'
      );
      const composite = await service.createCompositeNode(
        [node1.id, node2.id],
        '复合节点',
        'ws-1'
      );

      // 展开复合节点
      const result = await service.expandCompositeNode(composite.id);
      expect(result).not.toBeNull();
      expect(result?.expanded).toBe(true);

      // 子节点应不再隐藏
      const child1 = await service.getNode(node1.id);
      expect(child1?.hidden).toBe(false);
    });

    it('展开状态的复合节点应折叠并隐藏子节点', async () => {
      const service = await getService();
      const node1 = await service.createNode(
        { title: '节点1', isRoot: true },
        'ws-1'
      );
      const node2 = await service.createNode(
        { title: '节点2', isRoot: true },
        'ws-1'
      );
      const composite = await service.createCompositeNode(
        [node1.id, node2.id],
        '复合节点',
        'ws-1'
      );

      // 先展开
      await service.expandCompositeNode(composite.id);
      // 再折叠
      const result = await service.expandCompositeNode(composite.id);
      expect(result).not.toBeNull();
      expect(result?.expanded).toBe(false);

      // 子节点应被隐藏
      const child1 = await service.getNode(node1.id);
      expect(child1?.hidden).toBe(true);
    });
  });

  describe('clearWorkspaceData - 清空工作区数据', () => {
    it('应清除指定工作区的所有缓存', async () => {
      const service = await getService();
      // 先创建一些节点
      await service.createNode({ title: '节点1', isRoot: true }, 'ws-1');
      await service.createNode({ title: '节点2', isRoot: true }, 'ws-1');

      // 清空工作区数据
      await service.clearWorkspaceData('ws-1');

      // 缓存应被清除
      const nodes = await service.getAllNodes('ws-1');
      expect(nodes).toEqual([]);
    });
  });
});

describe('Input Validation', () => {
  it('should validate API key format', () => {
    const validateApiKey = (key: string): boolean => {
      return !!(key && typeof key === 'string' && key.trim().length >= 10);
    };

    expect(validateApiKey('')).toBe(false);
    expect(validateApiKey('short')).toBe(false);
    expect(validateApiKey('valid-api-key-123')).toBe(true);
  });

  it('should validate temperature range', () => {
    const validateTemperature = (temp: number): number => {
      return Math.max(0, Math.min(2, temp));
    };

    expect(validateTemperature(-1)).toBe(0);
    expect(validateTemperature(0.5)).toBe(0.5);
    expect(validateTemperature(1)).toBe(1);
    expect(validateTemperature(3)).toBe(2);
  });

  it('should validate maxTokens range', () => {
    const validateMaxTokens = (tokens: number | undefined): number | undefined => {
      if (!tokens) return undefined;
      return Math.max(1, Math.min(32000, tokens));
    };

    // 0 为 falsy 值，视为未提供，返回 undefined
    expect(validateMaxTokens(0)).toBeUndefined();
    expect(validateMaxTokens(1000)).toBe(1000);
    expect(validateMaxTokens(50000)).toBe(32000);
    expect(validateMaxTokens(undefined)).toBeUndefined();
  });
});
