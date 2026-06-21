import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Node, Relation, SearchResult } from '../types';

/**
 * SearchService 搜索服务单元测试
 * 覆盖语义搜索、关键词搜索、标签搜索、相关节点查询等核心流程
 * 使用 vi.doMock + 动态导入模拟 nodeService 和 aiService
 */

/** 测试用节点数据结构 */
interface TestNode extends Node {}

/** 模拟的 nodeService 方法集合 */
interface MockNodeService {
  getAllNodes: ReturnType<typeof vi.fn>;
  getNode: ReturnType<typeof vi.fn>;
  getRelationsForNode: ReturnType<typeof vi.fn>;
}

/** 模拟的 aiService 方法集合 */
interface MockAIService {
  isConfigured: ReturnType<typeof vi.fn>;
  searchSimilarNodes: ReturnType<typeof vi.fn>;
}

/** 模拟的 nodeService 实例 */
let mockNodeService: MockNodeService;

/** 模拟的 aiService 实例 */
let mockAIService: MockAIService;

/**
 * 创建测试用节点数据
 * @param overrides - 覆盖的节点属性
 * @returns 完整的节点数据
 */
function createTestNode(overrides: Partial<TestNode> = {}): TestNode {
  return {
    id: 'node-1',
    workspaceId: 'ws-1',
    title: '测试节点',
    summary: '这是测试节点的摘要',
    type: 'default',
    isRoot: false,
    isComposite: false,
    compositeChildren: [],
    hidden: false,
    expanded: false,
    position: { x: 100, y: 100 },
    tags: ['测试', '节点'],
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

describe('SearchService 搜索服务', () => {
  beforeEach(() => {
    vi.resetModules();

    mockNodeService = {
      getAllNodes: vi.fn().mockResolvedValue([]),
      getNode: vi.fn().mockResolvedValue(null),
      getRelationsForNode: vi.fn().mockResolvedValue([]),
    };

    mockAIService = {
      isConfigured: vi.fn().mockReturnValue(false),
      searchSimilarNodes: vi.fn().mockResolvedValue([]),
    };

    vi.doMock('../services/nodeService', () => ({
      nodeService: mockNodeService,
    }));

    vi.doMock('../services/aiService', () => ({
      aiService: mockAIService,
    }));
  });

  /**
   * 动态导入 searchService，确保 mock 生效
   * 每次测试前重新导入以获取全新的实例
   * @returns searchService 实例
   */
  async function getService() {
    const mod = await import('../services/searchService');
    return mod.searchService;
  }

  describe('searchNodes - 关键词搜索', () => {
    it('应按标题匹配返回搜索结果', async () => {
      const node1 = createTestNode({ id: 'node-1', title: 'JavaScript 入门' });
      const node2 = createTestNode({ id: 'node-2', title: 'Python 入门' });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node1, node2]);

      const service = await getService();
      const results = await service.searchNodes('javascript', 'ws-1');

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('node-1');
      expect(results[0].matches).toContain('title');
      expect(results[0].score).toBe(10); // 标题匹配得 10 分
    });

    it('应按摘要匹配返回搜索结果', async () => {
      const node = createTestNode({
        id: 'node-1',
        title: '测试',
        summary: '包含 JavaScript 的摘要',
      });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchNodes('javascript', 'ws-1');

      expect(results).toHaveLength(1);
      expect(results[0].matches).toContain('summary');
      expect(results[0].score).toBe(5); // 摘要匹配得 5 分
    });

    it('应按标签匹配返回搜索结果', async () => {
      const node = createTestNode({
        id: 'node-1',
        title: '测试',
        summary: '',
        tags: ['javascript', '前端'],
      });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchNodes('javascript', 'ws-1');

      expect(results).toHaveLength(1);
      expect(results[0].matches).toContain('tags');
      expect(results[0].score).toBe(3); // 单个标签匹配得 3 分
    });

    it('应按相关性得分降序排列', async () => {
      const node1 = createTestNode({ id: 'node-1', title: 'test', summary: '', tags: [] });
      const node2 = createTestNode({
        id: 'node-2',
        title: 'test',
        summary: 'test',
        tags: ['test'],
      });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node1, node2]);

      const service = await getService();
      const results = await service.searchNodes('test', 'ws-1');

      expect(results).toHaveLength(2);
      // node2 同时匹配标题、摘要、标签，得分更高
      expect(results[0].nodeId).toBe('node-2');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('无匹配时应返回空数组', async () => {
      const node = createTestNode({ title: '不相关的内容' });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchNodes('nonexistent', 'ws-1');

      expect(results).toEqual([]);
    });

    it('空节点列表时应返回空数组', async () => {
      mockNodeService.getAllNodes.mockResolvedValueOnce([]);

      const service = await getService();
      const results = await service.searchNodes('test', 'ws-1');

      expect(results).toEqual([]);
    });

    it('大小写不敏感匹配', async () => {
      const node = createTestNode({ title: 'JAVASCRIPT' });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchNodes('javascript', 'ws-1');

      expect(results).toHaveLength(1);
    });
  });

  describe('semanticSearch - 语义搜索', () => {
    it('AI 服务未配置时应回退到文本搜索', async () => {
      mockAIService.isConfigured.mockReturnValue(false);
      const node = createTestNode({ title: 'test' });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const service = await getService();
      const results = await service.semanticSearch('test', 10);

      expect(results).toHaveLength(1);
      expect(warnSpy).toHaveBeenCalledWith('AI服务未配置，回退到文本搜索');
      warnSpy.mockRestore();
    });

    it('AI 服务已配置时应返回语义搜索结果', async () => {
      mockAIService.isConfigured.mockReturnValue(true);
      mockAIService.searchSimilarNodes.mockResolvedValueOnce([
        { id: 'node-1', score: 0.95, metadata: { content: '相关内容' } },
        { id: 'node-2', score: 0.85, metadata: {} },
      ]);

      const service = await getService();
      const results = await service.semanticSearch('查询内容', 10);

      expect(results).toHaveLength(2);
      expect(results[0].nodeId).toBe('node-1');
      expect(results[0].score).toBe(0.95);
      expect(results[0].matches).toContain('semantic');
    });

    it('应正确处理 metadata.content 为数组的情况', async () => {
      mockAIService.isConfigured.mockReturnValue(true);
      mockAIService.searchSimilarNodes.mockResolvedValueOnce([
        {
          id: 'node-1',
          score: 0.9,
          metadata: { content: ['片段1', '片段2'] },
        },
      ]);

      const service = await getService();
      const results = await service.semanticSearch('查询', 10);

      expect(results).toHaveLength(1);
      expect(results[0].highlights).toBeDefined();
      expect(results[0].highlights!.content).toEqual(['片段1', '片段2']);
    });

    it('应正确处理 metadata.content 为字符串的情况', async () => {
      mockAIService.isConfigured.mockReturnValue(true);
      mockAIService.searchSimilarNodes.mockResolvedValueOnce([
        {
          id: 'node-1',
          score: 0.9,
          metadata: { content: '字符串内容' },
        },
      ]);

      const service = await getService();
      const results = await service.semanticSearch('查询', 10);

      expect(results).toHaveLength(1);
      expect(results[0].highlights).toBeDefined();
      expect(results[0].highlights!.content).toEqual(['字符串内容']);
    });

    it('无匹配结果时应返回空数组', async () => {
      mockAIService.isConfigured.mockReturnValue(true);
      mockAIService.searchSimilarNodes.mockResolvedValueOnce([]);

      const service = await getService();
      const results = await service.semanticSearch('查询', 10);

      expect(results).toEqual([]);
    });
  });

  describe('hybridSearch - 混合搜索', () => {
    it('应合并文本搜索和语义搜索结果', async () => {
      const node = createTestNode({ id: 'node-1', title: 'test' });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);
      mockAIService.isConfigured.mockReturnValue(true);
      mockAIService.searchSimilarNodes.mockResolvedValueOnce([
        { id: 'node-1', score: 0.9, metadata: {} },
        { id: 'node-2', score: 0.8, metadata: {} },
      ]);

      const service = await getService();
      const results = await service.hybridSearch('test', 'ws-1');

      // node-1 同时出现在文本和语义搜索中，应合并得分
      expect(results).toHaveLength(2);
      const node1Result = results.find((r: SearchResult) => r.nodeId === 'node-1');
      expect(node1Result).toBeDefined();
      // 文本搜索 10 分 + 语义搜索 0.9 * 0.5 = 10.45
      expect(node1Result!.score).toBeGreaterThan(10);
    });

    it('AI 服务未配置时应仅返回文本搜索结果', async () => {
      mockAIService.isConfigured.mockReturnValue(false);
      const node = createTestNode({ id: 'node-1', title: 'test' });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.hybridSearch('test', 'ws-1');

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('node-1');
    });

    it('结果应按得分降序排列并限制为 20 条', async () => {
      // 创建 25 个匹配节点
      const nodes = Array.from({ length: 25 }, (_, i) =>
        createTestNode({ id: `node-${i}`, title: `test-${i}` })
      );
      mockNodeService.getAllNodes.mockResolvedValueOnce(nodes);
      mockAIService.isConfigured.mockReturnValue(false);

      const service = await getService();
      const results = await service.hybridSearch('test', 'ws-1');

      expect(results).toHaveLength(20);
      // 第一个结果得分应 >= 最后一个结果得分
      expect(results[0].score).toBeGreaterThanOrEqual(results[19].score);
    });
  });

  describe('searchByTags - 标签搜索', () => {
    it('应返回匹配标签的节点', async () => {
      const node1 = createTestNode({ id: 'node-1', tags: ['javascript', '前端'] });
      const node2 = createTestNode({ id: 'node-2', tags: ['python', '后端'] });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node1, node2]);

      const service = await getService();
      const results = await service.searchByTags(['javascript'], 'ws-1');

      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('node-1');
      expect(results[0].matches).toContain('tags');
      expect(results[0].highlights!.tags).toContain('javascript');
    });

    it('多标签匹配时应提高得分', async () => {
      const node = createTestNode({
        id: 'node-1',
        tags: ['javascript', '前端', 'react'],
      });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchByTags(['javascript', '前端', 'react'], 'ws-1');

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(3); // 匹配 3 个标签
    });

    it('无匹配标签时应返回空数组', async () => {
      const node = createTestNode({ tags: ['其他标签'] });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchByTags(['javascript'], 'ws-1');

      expect(results).toEqual([]);
    });

    it('空标签列表时应返回空数组', async () => {
      mockNodeService.getAllNodes.mockResolvedValueOnce([createTestNode()]);

      const service = await getService();
      const results = await service.searchByTags([], 'ws-1');

      expect(results).toEqual([]);
    });

    it('标签大小写不敏感匹配', async () => {
      const node = createTestNode({ tags: ['JavaScript'] });
      mockNodeService.getAllNodes.mockResolvedValueOnce([node]);

      const service = await getService();
      const results = await service.searchByTags(['javascript'], 'ws-1');

      expect(results).toHaveLength(1);
    });
  });

  describe('getRelatedNodes - 获取相关节点', () => {
    it('应返回通过关系连接的相关节点', async () => {
      const relation1 = createTestRelation({
        id: 'rel-1',
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      });
      const relation2 = createTestRelation({
        id: 'rel-2',
        sourceId: 'node-1',
        targetId: 'node-3',
        type: 'references',
      });

      mockNodeService.getRelationsForNode.mockResolvedValueOnce([relation1, relation2]);
      mockNodeService.getNode
        .mockResolvedValueOnce(createTestNode({ id: 'node-2', title: '子节点' }))
        .mockResolvedValueOnce(createTestNode({ id: 'node-3', title: '引用节点' }));

      const service = await getService();
      const results = await service.getRelatedNodes('node-1', 2);

      expect(results).toHaveLength(2);
      expect(results[0].nodeId).toBe('node-2');
      expect(results[0].matches).toContain('parent-child');
    });

    it('深度为 1 时应仅返回直接相关节点', async () => {
      const relation = createTestRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
        type: 'parent-child',
      });

      mockNodeService.getRelationsForNode.mockResolvedValueOnce([relation]);
      mockNodeService.getNode.mockResolvedValueOnce(createTestNode({ id: 'node-2' }));

      const service = await getService();
      const results = await service.getRelatedNodes('node-1', 1);

      expect(results).toHaveLength(1);
    });

    it('无关系时应返回空数组', async () => {
      mockNodeService.getRelationsForNode.mockResolvedValueOnce([]);

      const service = await getService();
      const results = await service.getRelatedNodes('node-1', 2);

      expect(results).toEqual([]);
    });

    it('应避免重复访问同一节点', async () => {
      // 创建循环引用：node-1 -> node-2 -> node-1
      const rel1 = createTestRelation({ sourceId: 'node-1', targetId: 'node-2' });
      const rel2 = createTestRelation({ sourceId: 'node-2', targetId: 'node-1' });

      mockNodeService.getRelationsForNode
        .mockResolvedValueOnce([rel1]) // node-1 的关系
        .mockResolvedValueOnce([rel2]); // node-2 的关系

      mockNodeService.getNode
        .mockResolvedValueOnce(createTestNode({ id: 'node-2' }));

      const service = await getService();
      const results = await service.getRelatedNodes('node-1', 3);

      // 不应重复包含 node-2
      expect(results).toHaveLength(1);
      expect(results[0].nodeId).toBe('node-2');
    });

    it('相关节点不存在时应跳过', async () => {
      const relation = createTestRelation({
        sourceId: 'node-1',
        targetId: 'node-2',
      });

      mockNodeService.getRelationsForNode.mockResolvedValueOnce([relation]);
      mockNodeService.getNode.mockResolvedValueOnce(null); // 节点不存在

      const service = await getService();
      const results = await service.getRelatedNodes('node-1', 2);

      expect(results).toEqual([]);
    });
  });

  describe('异常流程', () => {
    it('getAllNodes 抛出异常时应传播', async () => {
      mockNodeService.getAllNodes.mockRejectedValueOnce(new Error('数据库错误'));

      const service = await getService();
      await expect(service.searchNodes('test', 'ws-1')).rejects.toThrow('数据库错误');
    });

    it('searchSimilarNodes 抛出异常时应传播', async () => {
      mockAIService.isConfigured.mockReturnValue(true);
      mockAIService.searchSimilarNodes.mockRejectedValueOnce(new Error('AI 服务错误'));

      const service = await getService();
      await expect(service.semanticSearch('test', 10)).rejects.toThrow('AI 服务错误');
    });
  });
});
