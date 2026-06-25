import { mongoDBService } from '../mongodb/connection';
import { Document } from 'mongodb';

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
 * MongoDB 中存储的向量文档类型
 * @property _id - MongoDB 文档主键
 */
interface VectorDocument extends Document {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 向量搜索结果类型
 * @property id - 向量唯一标识
 * @property score - 余弦相似度得分
 * @property metadata - 向量关联的元数据
 */
interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/** 向量存储集合名称 */
const COLLECTION_NAME = 'vector_embeddings';

/**
 * MongoDB 向量存储服务
 * 负责向量数据在 MongoDB 中的持久化读写操作，
 * 包括插入、搜索、删除、清空和全量加载
 */
export class MongoVectorStore {
  /**
   * 插入一条向量记录到 MongoDB
   * @param id - 向量唯一标识
   * @param vector - 向量数据
   * @param metadata - 向量关联的元数据
   * @throws {Error} MongoDB 操作失败时抛出异常
   */
  async insert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void> {
    const collection = mongoDBService.getCollection<VectorDocument>(COLLECTION_NAME);
    if (!collection) {
      throw new Error('MongoDB 未连接，无法写入向量数据');
    }

    try {
      const doc: Omit<VectorDocument, '_id'> = {
        id,
        vector,
        metadata,
        createdAt: new Date(),
      };
      await collection.replaceOne({ id }, doc, { upsert: true });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`写入向量数据到 MongoDB 失败: ${errorMsg}`);
    }
  }

  /**
   * 从 MongoDB 加载所有向量数据，计算与查询向量的余弦相似度，返回 topK 结果
   * @param queryVector - 查询向量
   * @param topK - 返回的最大结果数量
   * @returns 按相似度降序排列的搜索结果数组
   * @throws {Error} MongoDB 操作失败时抛出异常
   */
  async search(queryVector: number[], topK: number): Promise<SearchResult[]> {
    const collection = mongoDBService.getCollection<VectorDocument>(COLLECTION_NAME);
    if (!collection) {
      throw new Error('MongoDB 未连接，无法搜索向量数据');
    }

    try {
      const allDocs = await collection.find({}).toArray();
      const results: SearchResult[] = [];

      for (const doc of allDocs) {
        const score = MongoVectorStore.cosineSimilarity(queryVector, doc.vector);
        results.push({
          id: doc.id,
          score,
          metadata: doc.metadata,
        });
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`从 MongoDB 搜索向量数据失败: ${errorMsg}`);
    }
  }

  /**
   * 从 MongoDB 删除指定 ID 的向量记录
   * @param id - 要删除的向量唯一标识
   * @throws {Error} MongoDB 操作失败时抛出异常
   */
  async delete(id: string): Promise<void> {
    const collection = mongoDBService.getCollection<VectorDocument>(COLLECTION_NAME);
    if (!collection) {
      throw new Error('MongoDB 未连接，无法删除向量数据');
    }

    try {
      await collection.deleteOne({ id });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`从 MongoDB 删除向量数据失败: ${errorMsg}`);
    }
  }

  /**
   * 清空 MongoDB 中的向量存储集合
   * @throws {Error} MongoDB 操作失败时抛出异常
   */
  async clear(): Promise<void> {
    const collection = mongoDBService.getCollection<VectorDocument>(COLLECTION_NAME);
    if (!collection) {
      throw new Error('MongoDB 未连接，无法清空向量集合');
    }

    try {
      await collection.deleteMany({});
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`清空 MongoDB 向量集合失败: ${errorMsg}`);
    }
  }

  /**
   * 从 MongoDB 加载所有向量数据到内存 Map
   * @returns 以向量 ID 为键、VectorRecord 为值的 Map
   * @throws {Error} MongoDB 操作失败时抛出异常
   */
  async loadAll(): Promise<Map<string, VectorRecord>> {
    const collection = mongoDBService.getCollection<VectorDocument>(COLLECTION_NAME);
    const result = new Map<string, VectorRecord>();

    if (!collection) {
      console.warn('⚠️ MongoDB 未连接，跳过向量数据加载');
      return result;
    }

    try {
      const allDocs = await collection.find({}).toArray();
      for (const doc of allDocs) {
        result.set(doc.id, {
          id: doc.id,
          vector: doc.vector,
          metadata: doc.metadata,
          createdAt: doc.createdAt,
        });
      }
      return result;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`从 MongoDB 加载向量数据失败: ${errorMsg}`);
    }
  }

  /**
   * 返回 MongoDB 中向量记录的总数
   * @returns 向量记录数量，MongoDB 未连接时返回 0
   */
  async count(): Promise<number> {
    const collection = mongoDBService.getCollection<VectorDocument>(COLLECTION_NAME);
    if (!collection) {
      return 0;
    }

    try {
      return await collection.countDocuments();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`统计 MongoDB 向量数量失败: ${errorMsg}`);
      return 0;
    }
  }

  /**
   * 计算两个向量的余弦相似度
   * @param a - 向量 A
   * @param b - 向量 B
   * @returns 余弦相似度值，范围 [-1, 1]；向量长度不一致或范数为零时返回 0
   */
  static cosineSimilarity(a: number[], b: number[]): number {
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
}
