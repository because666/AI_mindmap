import { MongoClient, Db, Collection, Document, Filter, UpdateFilter, FindOptions, OptionalUnlessRequiredId } from 'mongodb';
import { config } from '../config';

class AdminDBService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private static instance: AdminDBService;

  private constructor() {}

  static getInstance(): AdminDBService {
    if (!AdminDBService.instance) {
      AdminDBService.instance = new AdminDBService();
    }
    return AdminDBService.instance;
  }

  /**
   * 连接MongoDB数据库
   * 复用主应用的数据库连接
   */
  async connect(): Promise<void> {
    if (this.client) return;

    const uri = config.mongodb.uri;
    const database = config.mongodb.database;

    console.log(`🔌 后台系统连接MongoDB: ${uri}/${database}...`);

    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(database);
      console.log('✅ 后台系统MongoDB连接成功');
      await this.initializeIndexes();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ 后台系统MongoDB连接失败:', errorMsg);
      throw error;
    }
  }

  /**
   * 初始化后台系统所需的索引
   */
  private async initializeIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.collection('admin_ips').createIndex({ ipAddress: 1 }, { unique: true });
      await this.db.collection('admin_sessions').createIndex({ sessionId: 1 }, { unique: true });
      await this.db.collection('admin_sessions').createIndex({ lastActivityAt: 1 });
      await this.db.collection('audit_logs').createIndex({ timestamp: -1 });
      await this.db.collection('audit_logs').createIndex({ action: 1 });
      await this.db.collection('export_tasks').createIndex({ id: 1 }, { unique: true });
      await this.db.collection('chat_audits').createIndex({ 'auditResult.status': 1 });
      await this.db.collection('chat_audits').createIndex({ 'auditResult.riskLevel': 1 });
      console.log('✅ 后台系统索引初始化完成');
    } catch (error) {
      console.warn('后台系统索引创建警告:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }

  getCollection<T extends Document>(name: string): Collection<T> | null {
    return this.db?.collection<T>(name) || null;
  }

  async findOne<T extends Document>(collection: string, filter: Filter<T>): Promise<T | null> {
    const col = this.getCollection<T>(collection);
    if (!col) return null;
    return await col.findOne(filter) as T | null;
  }

  async find<T extends Document>(
    collection: string,
    filter: Filter<T>,
    options?: FindOptions
  ): Promise<T[]> {
    const col = this.getCollection<T>(collection);
    if (!col) return [];
    return await col.find(filter, options).toArray() as T[];
  }

  async insertOne<T extends Document>(collection: string, doc: Omit<T, '_id'>): Promise<string | null> {
    const col = this.getCollection<T>(collection);
    if (!col) return null;
    const result = await col.insertOne(doc as OptionalUnlessRequiredId<T>);
    return result.insertedId.toString();
  }

  async updateOne<T extends Document>(
    collection: string,
    filter: Filter<T>,
    update: UpdateFilter<T>
  ): Promise<boolean> {
    const col = this.getCollection<T>(collection);
    if (!col) return false;
    const result = await col.updateOne(filter, update);
    return result.modifiedCount > 0;
  }

  async deleteOne<T extends Document>(collection: string, filter: Filter<T>): Promise<boolean> {
    const col = this.getCollection<T>(collection);
    if (!col) return false;
    const result = await col.deleteOne(filter);
    return result.deletedCount > 0;
  }

  async deleteMany<T extends Document>(collection: string, filter: Filter<T>): Promise<number> {
    const col = this.getCollection<T>(collection);
    if (!col) return 0;
    const result = await col.deleteMany(filter);
    return result.deletedCount;
  }

  async countDocuments<T extends Document>(collection: string, filter?: Filter<T>): Promise<number> {
    const col = this.getCollection<T>(collection);
    if (!col) return 0;
    return await col.countDocuments(filter || {});
  }

  async aggregate<T extends Document>(collection: string, pipeline: Document[]): Promise<T[]> {
    const col = this.getCollection<T>(collection);
    if (!col) return [];
    return await col.aggregate(pipeline).toArray() as T[];
  }

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }
}

export const adminDB = AdminDBService.getInstance();
