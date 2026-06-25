import { config } from '../../config';
import { MongoVectorStore } from './mongoVectorStore';

/**
 * 向量记录类型定义
 * @property id - 向量唯一标识
 * @property vector - 向量数据
 * @property metadata - 向量关联的元数据
 * @property createdAt - 创建时间
 */
interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 向量数据库服务
 * 管理向量数据的内存缓存与 MongoDB 持久化存储，
 * 搜索操作基于内存 Map 以保证性能，写入和删除操作同步到 MongoDB
 */
class VectorDBService {
  /** 内存中的向量数据缓存 */
  private vectors: Map<string, VectorRecord> = new Map();
  private static instance: VectorDBService;
  /** 向量维度 */
  private dimension: number;
  /** MongoDB 向量存储实例 */
  private mongoStore: MongoVectorStore | null = null;

  private constructor() {
    this.dimension = config.vector.dimension;
  }

  /**
   * 获取 VectorDBService 单例
   * @returns VectorDBService 实例
   */
  static getInstance(): VectorDBService {
    if (!VectorDBService.instance) {
      VectorDBService.instance = new VectorDBService();
    }
    return VectorDBService.instance;
  }

  /**
   * 初始化向量数据库服务
   * 创建 MongoVectorStore 实例，从 MongoDB 加载已有向量数据到内存 Map
   * MongoDB 不可用时仍以纯内存模式运行
   */
  async initialize(): Promise<void> {
    this.mongoStore = new MongoVectorStore();

    try {
      const loadedVectors = await this.mongoStore.loadAll();
      for (const [id, record] of loadedVectors) {
        this.vectors.set(id, record);
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log(`✅ VectorDB initialized, loaded ${this.vectors.size} vectors from MongoDB`);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`❌ 从 MongoDB 加载向量数据失败: ${errorMsg}`);
      console.warn('⚠️ VectorDB 将以纯内存模式运行');
    }
  }

  /**
   * 插入向量数据
   * 先写入内存 Map，再异步写入 MongoDB；MongoDB 写入失败时打印错误但不回滚内存
   * @param id - 向量唯一标识
   * @param vector - 向量数据
   * @param metadata - 向量关联的元数据，默认为空对象
   * @throws {Error} 向量维度不匹配时抛出异常
   */
  async insertVector(id: string, vector: number[], metadata: Record<string, unknown> = {}): Promise<void> {
    if (vector.length !== this.dimension) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimension}, got ${vector.length}`);
    }

    this.vectors.set(id, {
      id,
      vector,
      metadata,
      createdAt: new Date(),
    });

    if (this.mongoStore) {
      try {
        await this.mongoStore.insert(id, vector, metadata);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ 写入向量到 MongoDB 失败 (id=${id}): ${errorMsg}`);
      }
    }
  }

  /**
   * 根据 ID 获取向量记录
   * @param id - 向量唯一标识
   * @returns 向量记录，不存在时返回 null
   */
  async getVector(id: string): Promise<VectorRecord | null> {
    return this.vectors.get(id) || null;
  }

  /**
   * 删除指定 ID 的向量记录
   * 先从内存 Map 删除，再从 MongoDB 删除
   * @param id - 要删除的向量唯一标识
   * @returns 是否成功删除（内存中存在并已删除时返回 true）
   */
  async deleteVector(id: string): Promise<boolean> {
    const deleted = this.vectors.delete(id);

    if (this.mongoStore) {
      try {
        await this.mongoStore.delete(id);
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ 从 MongoDB 删除向量失败 (id=${id}): ${errorMsg}`);
      }
    }

    return deleted;
  }

  /**
   * 搜索与查询向量最相似的向量记录
   * 基于内存 Map 进行余弦相似度计算，保证搜索性能
   * @param queryVector - 查询向量
   * @param topK - 返回的最大结果数量，默认 10
   * @param filter - 元数据过滤条件，仅返回满足所有键值匹配的记录
   * @returns 按相似度降序排列的搜索结果数组
   * @throws {Error} 查询向量维度不匹配时抛出异常
   */
  async searchSimilar(
    queryVector: number[],
    topK: number = 10,
    filter?: Record<string, unknown>
  ): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
    if (queryVector.length !== this.dimension) {
      throw new Error(`Query vector dimension mismatch: expected ${this.dimension}, got ${queryVector.length}`);
    }

    const results: Array<{ id: string; score: number; metadata: Record<string, unknown> }> = [];

    for (const [id, record] of this.vectors) {
      if (filter) {
        const matchesFilter = Object.entries(filter).every(
          ([key, value]) => record.metadata[key] === value
        );
        if (!matchesFilter) continue;
      }

      const score = this.cosineSimilarity(queryVector, record.vector);
      results.push({ id, score, metadata: record.metadata });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * 计算两个向量的余弦相似度
   * @param a - 向量 A
   * @param b - 向量 B
   * @returns 余弦相似度值，范围 [-1, 1]；向量长度不一致或范数为零时返回 0
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * 获取向量数据库统计信息
   * @returns 包含向量总数和维度的统计对象
   */
  async getStats(): Promise<{ totalVectors: number; dimension: number }> {
    return {
      totalVectors: this.vectors.size,
      dimension: this.dimension,
    };
  }

  /**
   * 清空向量数据库
   * 先清空内存 Map，再清空 MongoDB 集合
   */
  async clear(): Promise<void> {
    this.vectors.clear();

    if (this.mongoStore) {
      try {
        await this.mongoStore.clear();
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`❌ 清空 MongoDB 向量集合失败: ${errorMsg}`);
      }
    }
  }
}

export const vectorDBService = VectorDBService.getInstance();
