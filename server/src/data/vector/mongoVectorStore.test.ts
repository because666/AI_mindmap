import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MongoDB 向量存储服务单元测试
 * 测试 MongoVectorStore 的 CRUD 操作、相似度搜索和余弦相似度计算
 * 使用 vi.mock 模拟 mongoDBService
 */

/** 模拟的 MongoDB 集合方法 */
interface MockCollection {
  replaceOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 方法集合 */
interface MockMongoDBService {
  getCollection: ReturnType<typeof vi.fn>;
}

const { mockMongoDBService } = vi.hoisted(() => {
  const service: MockMongoDBService = {
    getCollection: vi.fn(),
  };
  return { mockMongoDBService: service };
});

vi.mock('../mongodb/connection', () => ({
  mongoDBService: mockMongoDBService,
}));

import { MongoVectorStore } from './mongoVectorStore';

describe('MongoVectorStore 向量存储', () => {
  let store: MongoVectorStore;
  let mockCollection: MockCollection;

  /** 创建模拟的 find 链式调用对象
   * @param docs - find 查询返回的文档数组
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

  beforeEach(() => {
    vi.clearAllMocks();

    mockCollection = {
      replaceOne: vi.fn(() => Promise.resolve({ upsertedId: 'mock-id' })),
      find: vi.fn(() => createFindChain()),
      deleteOne: vi.fn(() => Promise.resolve({ deletedCount: 1 })),
      deleteMany: vi.fn(() => Promise.resolve({ deletedCount: 3 })),
      countDocuments: vi.fn(() => Promise.resolve(3)),
    };

    mockMongoDBService.getCollection.mockReturnValue(mockCollection);

    store = new MongoVectorStore();
  });

  describe('insert - 写入向量', () => {
    it('应将向量数据写入 MongoDB', async () => {
      await store.insert('vec-1', [0.1, 0.2, 0.3], { source: 'test' });

      expect(mockMongoDBService.getCollection).toHaveBeenCalledWith('vector_embeddings');
      expect(mockCollection.replaceOne).toHaveBeenCalledWith(
        { id: 'vec-1' },
        expect.objectContaining({
          id: 'vec-1',
          vector: [0.1, 0.2, 0.3],
          metadata: { source: 'test' },
        }),
        { upsert: true }
      );
    });

    it('MongoDB 未连接时应抛出异常', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      await expect(store.insert('vec-1', [0.1], {})).rejects.toThrow('MongoDB 未连接');
    });

    it('写入操作失败时应抛出包含错误信息的异常', async () => {
      mockCollection.replaceOne.mockRejectedValueOnce(new Error('写入超时'));

      await expect(store.insert('vec-1', [0.1], {})).rejects.toThrow('写入向量数据到 MongoDB 失败');
    });
  });

  describe('search - 搜索向量', () => {
    it('应从 MongoDB 加载向量并计算相似度', async () => {
      const docs = [
        { id: 'vec-1', vector: [1, 0, 0], metadata: { source: 'a' }, createdAt: new Date() },
        { id: 'vec-2', vector: [0, 1, 0], metadata: { source: 'b' }, createdAt: new Date() },
        { id: 'vec-3', vector: [0.8, 0.6, 0], metadata: { source: 'c' }, createdAt: new Date() },
      ];

      mockCollection.find.mockReturnValue(createFindChain(docs));

      const results = await store.search([1, 0, 0], 2);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('vec-1');
      expect(results[0].score).toBeCloseTo(1, 5);
      expect(results[1].id).toBe('vec-3');
      expect(results[1].score).toBeCloseTo(0.8, 5);
    });

    it('MongoDB 未连接时应抛出异常', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      await expect(store.search([0.1], 5)).rejects.toThrow('MongoDB 未连接');
    });

    it('搜索操作失败时应抛出包含错误信息的异常', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('查询超时');
      });

      await expect(store.search([0.1], 5)).rejects.toThrow('从 MongoDB 搜索向量数据失败');
    });
  });

  describe('delete - 删除向量', () => {
    it('应从 MongoDB 删除指定 ID 的向量', async () => {
      await store.delete('vec-1');

      expect(mockCollection.deleteOne).toHaveBeenCalledWith({ id: 'vec-1' });
    });

    it('MongoDB 未连接时应抛出异常', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      await expect(store.delete('vec-1')).rejects.toThrow('MongoDB 未连接');
    });

    it('删除操作失败时应抛出包含错误信息的异常', async () => {
      mockCollection.deleteOne.mockRejectedValueOnce(new Error('删除超时'));

      await expect(store.delete('vec-1')).rejects.toThrow('从 MongoDB 删除向量数据失败');
    });
  });

  describe('clear - 清空集合', () => {
    it('应清空 MongoDB 中的向量集合', async () => {
      await store.clear();

      expect(mockCollection.deleteMany).toHaveBeenCalledWith({});
    });

    it('MongoDB 未连接时应抛出异常', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      await expect(store.clear()).rejects.toThrow('MongoDB 未连接');
    });

    it('清空操作失败时应抛出包含错误信息的异常', async () => {
      mockCollection.deleteMany.mockRejectedValueOnce(new Error('清空超时'));

      await expect(store.clear()).rejects.toThrow('清空 MongoDB 向量集合失败');
    });
  });

  describe('loadAll - 加载所有向量', () => {
    it('应加载所有向量到内存 Map', async () => {
      const docs = [
        { id: 'vec-1', vector: [0.1, 0.2], metadata: { source: 'a' }, createdAt: new Date('2025-01-01') },
        { id: 'vec-2', vector: [0.3, 0.4], metadata: { source: 'b' }, createdAt: new Date('2025-01-02') },
      ];

      mockCollection.find.mockReturnValue(createFindChain(docs));

      const result = await store.loadAll();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('vec-1')).toEqual({
        id: 'vec-1',
        vector: [0.1, 0.2],
        metadata: { source: 'a' },
        createdAt: new Date('2025-01-01'),
      });
      expect(result.get('vec-2')).toEqual({
        id: 'vec-2',
        vector: [0.3, 0.4],
        metadata: { source: 'b' },
        createdAt: new Date('2025-01-02'),
      });
    });

    it('MongoDB 未连接时应返回空 Map', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const result = await store.loadAll();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    it('加载操作失败时应抛出包含错误信息的异常', async () => {
      mockCollection.find.mockImplementation(() => {
        throw new Error('加载超时');
      });

      await expect(store.loadAll()).rejects.toThrow('从 MongoDB 加载向量数据失败');
    });
  });

  describe('count - 统计向量总数', () => {
    it('应返回向量记录总数', async () => {
      mockCollection.countDocuments.mockResolvedValueOnce(5);

      const result = await store.count();

      expect(result).toBe(5);
      expect(mockCollection.countDocuments).toHaveBeenCalled();
    });

    it('MongoDB 未连接时应返回 0', async () => {
      mockMongoDBService.getCollection.mockReturnValue(null);

      const result = await store.count();

      expect(result).toBe(0);
    });

    it('统计操作失败时应返回 0', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockCollection.countDocuments.mockRejectedValueOnce(new Error('统计超时'));

      const result = await store.count();

      expect(result).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('统计 MongoDB 向量数量失败'));

      errorSpy.mockRestore();
    });
  });

  describe('cosineSimilarity - 余弦相似度计算', () => {
    it('相同向量应返回 1', () => {
      const result = MongoVectorStore.cosineSimilarity([1, 0, 0], [1, 0, 0]);
      expect(result).toBeCloseTo(1, 5);
    });

    it('正交向量应返回 0', () => {
      const result = MongoVectorStore.cosineSimilarity([1, 0, 0], [0, 1, 0]);
      expect(result).toBeCloseTo(0, 5);
    });

    it('相反向量应返回 -1', () => {
      const result = MongoVectorStore.cosineSimilarity([1, 0, 0], [-1, 0, 0]);
      expect(result).toBeCloseTo(-1, 5);
    });

    it('零向量应返回 0', () => {
      const result = MongoVectorStore.cosineSimilarity([0, 0, 0], [1, 0, 0]);
      expect(result).toBe(0);
    });

    it('长度不一致的向量应返回 0', () => {
      const result = MongoVectorStore.cosineSimilarity([1, 0], [1, 0, 0]);
      expect(result).toBe(0);
    });

    it('应正确计算非单位向量的余弦相似度', () => {
      const result = MongoVectorStore.cosineSimilarity([3, 4], [6, 8]);
      expect(result).toBeCloseTo(1, 5);
    });

    it('应正确计算部分相似向量', () => {
      const result = MongoVectorStore.cosineSimilarity([1, 2, 3], [4, 5, 6]);
      const expected = (4 + 10 + 18) / (Math.sqrt(14) * Math.sqrt(77));
      expect(result).toBeCloseTo(expected, 5);
    });
  });
});
