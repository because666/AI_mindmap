import { MongoClient, Db, Collection, Document, Filter, UpdateFilter, FindOptions, OptionalUnlessRequiredId } from 'mongodb';
import { config } from '../../config';

class MongoDBService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private static instance: MongoDBService;

  private constructor() {}

  static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    const uri = config.mongodb.uri;
    const database = config.mongodb.database;

    if (!uri || uri === 'mongodb://localhost:27017') {
      if (process.env.NODE_ENV !== 'production') {
        console.log('⚠️ MongoDB not configured, skipping connection');
      }
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('🔌 Connecting to MongoDB...');
    }

    try {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(database);
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ MongoDB connected successfully');
      }
      await this.ensureIndexes();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('❌ MongoDB connection failed:', errorMsg);
      console.warn('⚠️ Continuing without MongoDB');
      this.client = null;
      this.db = null;
    }
  }

  /**
   * 确保所有集合的索引已创建
   * 索引创建失败时仅输出警告，不影响服务启动
   */
  private async ensureIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.collection('conversations').createIndex({ nodeId: 1 });
      await this.db.collection('conversations').createIndex({ createdAt: -1 });
      await this.db.collection('messages').createIndex({ conversationId: 1 });
      await this.db.collection('messages').createIndex({ createdAt: -1 });
      await this.db.collection('users').createIndex({ email: 1 }, { unique: true });
      await this.db.collection('feedbacks').createIndex({ createdAt: -1 });
      await this.db.collection('feedbacks').createIndex({ status: 1 });
      await this.db.collection('feedbacks').createIndex({ type: 1 });
      await this.db.collection('ai_usage').createIndex({ visitorId: 1, createdAt: -1 });
      await this.db.collection('ai_usage').createIndex({ workspaceId: 1, createdAt: -1 });
      await this.db.collection('ai_usage').createIndex({ model: 1, createdAt: -1 });
      await this.db.collection('ai_usage').createIndex({ createdAt: -1 });
      await this.db.collection('visitors').createIndex({ id: 1 }, { unique: true, background: true });
      await this.db.collection('workspaces').createIndex({ id: 1 }, { unique: true, background: true });
      await this.db.collection('attack_logs').createIndex({ ipAddress: 1 }, { background: true });
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ MongoDB indexes initialized');
      }
    } catch (error) {
      console.warn('Index creation warning:', error);
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

  async insertOne<T extends Document>(collection: string, doc: Omit<T, '_id'>): Promise<string | null> {
    const col = this.getCollection<T>(collection);
    if (!col) return null;

    const result = await col.insertOne(doc as unknown as OptionalUnlessRequiredId<T>);
    return result.insertedId.toString();
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

  isConnected(): boolean {
    return this.client !== null && this.db !== null;
  }
}

export const mongoDBService = MongoDBService.getInstance();
