import { v4 as uuidv4 } from 'uuid';
import { mongoDBService } from '../data/mongodb/connection';
import { redisService } from '../data/redis/connection';
import { Conversation, Message } from '../types';

interface CacheEntry {
  conversation: Conversation;
  loadedAt: number;
}

/**
 * 独立消息集合的文档结构
 * 从 conversation 文档的 messages 数组拆分而来
 */
interface MessageDocument {
  id: string;
  conversationId: string;
  nodeId: string;
  workspaceId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * 分页查询结果接口
 */
interface PaginatedMessagesResult {
  messages: Message[];
  hasMore: boolean;
}

/**
 * 对话服务类
 * 提供对话的CRUD操作
 * 所有数据按工作区隔离
 * 使用 Redis + 内存二级缓存，确保多实例部署时缓存共享
 * 内存缓存 TTL 30秒，Redis 缓存作为二级缓存兜底
 * Redis 不可用时降级到纯内存缓存，不影响服务可用性
 */
class ConversationService {
  private memoryConversations: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 30 * 1000;
  /** Redis 缓存 key 前缀 */
  private readonly REDIS_KEY_PREFIX = 'conversation:';
  /** Redis 缓存 TTL（秒），设置为内存缓存 TTL 的 2 倍以提供更好的兜底 */
  private readonly REDIS_CACHE_TTL = 60;

  /**
   * 生成 Redis 缓存 key
   * @param conversationId - 对话ID
   * @returns Redis 缓存 key
   */
  private getRedisKey(conversationId: string): string {
    return `${this.REDIS_KEY_PREFIX}${conversationId}`;
  }

  /**
   * 异步更新 Redis 缓存
   * 将对话数据写入 Redis，设置 TTL
   * Redis 不可用或操作失败时静默降级，不影响主流程
   * @param conversation - 对话数据
   * @returns Promise，用于测试等待异步操作完成
   */
  private async updateRedisCache(conversation: Conversation): Promise<void> {
    try {
      await redisService.cacheSet(this.getRedisKey(conversation.id), conversation, this.REDIS_CACHE_TTL);
    } catch (error: unknown) {
      // cacheSet 内部已处理异常，这里兜底防止意外错误影响主流程
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[对话缓存] 更新Redis缓存失败，conversationId=${conversation.id}: ${errorMsg}`);
    }
  }

  /**
   * 删除 Redis 缓存
   * Redis 不可用或操作失败时静默降级，不影响主流程
   * @param conversationId - 对话ID
   * @returns Promise，用于测试等待异步操作完成
   */
  private async invalidateRedisCache(conversationId: string): Promise<void> {
    try {
      await redisService.cacheDel(this.getRedisKey(conversationId));
    } catch (error: unknown) {
      // cacheDel 内部已处理异常，这里兜底防止意外错误影响主流程
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[对话缓存] 删除Redis缓存失败，conversationId=${conversationId}: ${errorMsg}`);
    }
  }

  /**
   * 创建对话
   * @param nodeId - 节点ID
   * @param workspaceId - 工作区ID
   * @param createdBy - 创建者访客ID
   * @param conversationId - 可选的对话ID，用于外部指定
   * @returns 创建的对话
   */
  async createConversation(nodeId: string, workspaceId: string, createdBy?: string, conversationId?: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: conversationId || uuidv4(),
      nodeId,
      workspaceId,
      messages: [],
      contextConfig: {
        includeParentHistory: true,
        includeRelatedNodes: [],
      },
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (mongoDBService.isConnected()) {
      await mongoDBService.insertOne('conversations', conversation);
    }

    // 先更新内存缓存，再异步更新 Redis
    this.memoryConversations.set(conversation.id, { conversation, loadedAt: Date.now() });
    void this.updateRedisCache(conversation);
    return conversation;
  }

  /**
   * 获取对话
   * 缓存优先级：内存缓存（TTL 30秒） > Redis 缓存 > 数据库
   * Redis 命中时回填内存缓存，数据库命中时回填内存和 Redis 缓存
   * Redis 不可用时降级到纯内存缓存，不影响服务可用性
   * @param id - 对话ID
   * @returns 对话数据或null
   */
  async getConversation(id: string): Promise<Conversation | null> {
    const cached = this.memoryConversations.get(id);
    const now = Date.now();

    // 1. 优先查内存缓存（TTL 30秒）
    if (cached && now - cached.loadedAt < this.CACHE_TTL) {
      return cached.conversation;
    }

    // 2. 内存未命中，查 Redis 缓存（Redis 不可用时返回 null，降级到查库）
    const redisConversation = await redisService.cacheGet<Conversation>(this.getRedisKey(id));
    if (redisConversation) {
      // Redis 命中，回填内存缓存
      this.memoryConversations.set(id, { conversation: redisConversation, loadedAt: now });
      return redisConversation;
    }

    // 3. Redis 也未命中，查数据库
    if (mongoDBService.isConnected()) {
      const conv = await mongoDBService.findOne<Conversation>('conversations', { id } as never);
      if (conv) {
        // 数据库命中，回填内存和 Redis 缓存
        this.memoryConversations.set(id, { conversation: conv, loadedAt: now });
        void this.updateRedisCache(conv);
        return conv;
      }
    }

    // 4. 都未命中，兜底返回内存中的过期数据（如果存在）
    if (cached) {
      return cached.conversation;
    }

    return null;
  }

  /**
   * 通过节点ID获取对话
   * @param nodeId - 节点ID
   * @returns 对话数据或null
   */
  async getConversationByNodeId(nodeId: string): Promise<Conversation | null> {
    const now = Date.now();
    for (const entry of this.memoryConversations.values()) {
      if (entry.conversation.nodeId === nodeId && now - entry.loadedAt < this.CACHE_TTL) {
        return entry.conversation;
      }
    }

    if (mongoDBService.isConnected()) {
      const conv = await mongoDBService.findOne<Conversation>('conversations', { nodeId } as never);
      if (conv) {
        // 数据库命中，回填内存和 Redis 缓存
        this.memoryConversations.set(conv.id, { conversation: conv, loadedAt: now });
        void this.updateRedisCache(conv);
        return conv;
      }
    }

    return null;
  }

  /**
   * 获取工作区所有对话
   * @param workspaceId - 工作区ID
   * @returns 对话列表
   */
  async getConversationsByWorkspaceId(workspaceId: string): Promise<Conversation[]> {
    const results: Conversation[] = [];
    const now = Date.now();

    for (const entry of this.memoryConversations.values()) {
      if (entry.conversation.workspaceId === workspaceId && now - entry.loadedAt < this.CACHE_TTL) {
        results.push(entry.conversation);
      }
    }

    if (mongoDBService.isConnected()) {
      const dbConvs = await mongoDBService.find<Conversation>('conversations', { workspaceId } as never);
      for (const conv of dbConvs) {
        if (!results.find(r => r.id === conv.id)) {
          // 数据库命中，回填内存和 Redis 缓存
          this.memoryConversations.set(conv.id, { conversation: conv, loadedAt: now });
          void this.updateRedisCache(conv);
          results.push(conv);
        }
      }
    }

    return results;
  }

  /**
   * 通过节点ID添加消息（不触发AI回复）
   * @param nodeId - 节点ID
   * @param message - 消息内容
   * @returns 添加的消息
   */
  async addMessageByNodeId(nodeId: string, message: Omit<Message, '_id' | 'timestamp'>): Promise<Message> {
    let conversation = await this.getConversationByNodeId(nodeId);
    if (!conversation) {
      throw new Error('对话不存在');
    }
    return this.addMessage(conversation.id, message);
  }

  /**
   * 添加消息
   * 仅写入独立 messages 集合，不再双写到 conversation 文档的 messages 数组
   * 保留内存缓存的 updatedAt 更新和 conversation 文档的 updatedAt 更新
   * @param conversationId - 对话ID
   * @param message - 消息内容
   * @returns 添加的消息
   * @throws 当对话不存在时抛出异常
   * @throws 当数据库写入失败时抛出异常
   */
  async addMessage(conversationId: string, message: Omit<Message, '_id' | 'timestamp'>): Promise<Message> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) throw new Error('对话不存在');

    const newMessage: Message = {
      ...message,
      _id: uuidv4(),
      timestamp: new Date(),
    };

    // 仅更新内存缓存的 updatedAt，不再维护 messages 数组
    conversation.updatedAt = new Date();

    if (mongoDBService.isConnected()) {
      // 仅更新 conversation 文档的 updatedAt，不再 $push 到 messages 数组
      await mongoDBService.updateOne('conversations', { id: conversationId } as never, {
        $set: { updatedAt: new Date() },
      } as never);

      try {
        const messageDoc: MessageDocument = {
          id: newMessage._id,
          conversationId,
          nodeId: conversation.nodeId,
          workspaceId: conversation.workspaceId,
          role: newMessage.role,
          content: newMessage.content,
          timestamp: newMessage.timestamp,
        };
        await mongoDBService.insertOne('messages', messageDoc);
      } catch (insertError: unknown) {
        const errorMsg = insertError instanceof Error ? insertError.message : String(insertError);
        console.error(`[消息服务] 写入独立messages集合失败，conversationId=${conversationId}:`, errorMsg);
      }
    }

    // 先更新内存缓存，再异步更新 Redis
    this.memoryConversations.set(conversationId, { conversation, loadedAt: Date.now() });
    void this.updateRedisCache(conversation);
    return newMessage;
  }

  /**
   * 清空对话消息
   * 仅清空独立 messages 集合，不再双清 conversation 文档的 messages 数组
   * 保留 conversation 文档本身的 updatedAt 更新
   * 同时清除内存和 Redis 缓存，下次读取时从数据库重新加载
   * @param conversationId - 对话ID
   * @returns 是否成功，对话不存在时返回 false
   */
  async clearConversation(conversationId: string): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return false;

    // 清理内存缓存中可能残留的 messages 数组（兼容历史数据）
    conversation.messages = [];
    conversation.updatedAt = new Date();

    if (mongoDBService.isConnected()) {
      // 仅更新 conversation 文档的 updatedAt，不再 $set messages 数组
      await mongoDBService.updateOne('conversations', { id: conversationId } as never, {
        $set: { updatedAt: new Date() },
      } as never);

      try {
        await mongoDBService.deleteMany('messages', { conversationId } as never);
      } catch (deleteError: unknown) {
        const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
        console.error(`[消息服务] 清空独立messages集合失败，conversationId=${conversationId}:`, errorMsg);
      }
    }

    // 同时清除内存和 Redis 缓存，下次读取时从数据库重新加载
    this.memoryConversations.delete(conversationId);
    void this.invalidateRedisCache(conversationId);
    return true;
  }

  /**
   * 更新上下文配置
   * @param conversationId - 对话ID
   * @param config - 配置更新
   * @returns 是否成功
   */
  async updateContextConfig(
    conversationId: string,
    config: Partial<Conversation['contextConfig']>
  ): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return false;

    conversation.contextConfig = {
      ...conversation.contextConfig,
      ...config,
    };
    conversation.updatedAt = new Date();

    if (mongoDBService.isConnected()) {
      await mongoDBService.updateOne('conversations', { id: conversationId } as never, {
        $set: { contextConfig: conversation.contextConfig, updatedAt: new Date() },
      } as never);
    }

    // 先更新内存缓存，再异步更新 Redis
    this.memoryConversations.set(conversationId, { conversation, loadedAt: Date.now() });
    void this.updateRedisCache(conversation);
    return true;
  }

  /**
   * 获取对话的所有消息
   * 统一从独立 messages 集合按 conversationId 查询，不再从 conversation 文档读取
   * @param conversationId - 对话ID
   * @returns 消息列表，按时间升序排列
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    return this.getConversationMessages(conversationId);
  }

  /**
   * 从独立 messages 集合分页查询消息
   * 按 timestamp 降序排列，支持 cursor 分页
   * @param conversationId - 对话ID
   * @param limit - 每页数量，默认50
   * @param beforeTimestamp - cursor 分页游标，查询此时间之前的消息
   * @returns 分页查询结果，包含消息列表和是否还有更多消息的标志
   */
  async getMessagesByConversation(
    conversationId: string,
    limit: number = 50,
    beforeTimestamp?: Date
  ): Promise<PaginatedMessagesResult> {
    if (!mongoDBService.isConnected()) {
      return { messages: [], hasMore: false };
    }

    try {
      const filter: Record<string, unknown> = { conversationId };
      if (beforeTimestamp) {
        filter.timestamp = { $lt: beforeTimestamp };
      }

      const collection = mongoDBService.getCollection('messages');
      if (!collection) {
        return { messages: [], hasMore: false };
      }

      const messageDocs = await collection
        .find(filter as never)
        .sort({ timestamp: -1 })
        .limit(limit + 1)
        .toArray();

      const hasMore = messageDocs.length > limit;
      const docs = hasMore ? messageDocs.slice(0, limit) : messageDocs;

      const messages: Message[] = docs.map((doc: Record<string, unknown>) => ({
        _id: doc.id as string,
        role: doc.role as 'user' | 'assistant' | 'system',
        content: doc.content as string,
        timestamp: doc.timestamp as Date,
      }));

      return { messages, hasMore };
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[消息服务] 分页查询消息失败，conversationId=${conversationId}:`, errorMsg);
      return { messages: [], hasMore: false };
    }
  }

  /**
   * 迁移历史消息到独立 messages 集合
   * 检测 conversation 文档中是否有嵌套的 messages 数组，将其迁移到独立集合
   * 按 id 去重跳过已存在的消息，迁移完成后将 conversation 文档的 messages 数组设为空
   * @returns 迁移的消息总数
   */
  async migrateMessages(): Promise<number> {
    if (!mongoDBService.isConnected()) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[消息迁移] MongoDB未连接，跳过迁移');
      }
      return 0;
    }

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[消息迁移] 开始迁移历史消息到独立messages集合...');
      }

      const conversations = await mongoDBService.find<Conversation>('conversations', {} as never);
      let totalMigrated = 0;

      for (const conv of conversations) {
        if (!conv.messages || conv.messages.length === 0) {
          continue;
        }

        if (process.env.NODE_ENV !== 'production') {
          console.log(`[消息迁移] 处理对话 ${conv.id}，共 ${conv.messages.length} 条消息`);
        }

        let migratedCount = 0;
        for (const msg of conv.messages) {
          try {
            const existing = await mongoDBService.findOne<MessageDocument>('messages', { id: msg._id } as never);
            if (existing) {
              continue;
            }

            const messageDoc: MessageDocument = {
              id: msg._id,
              conversationId: conv.id,
              nodeId: conv.nodeId,
              workspaceId: conv.workspaceId,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
            };
            await mongoDBService.insertOne('messages', messageDoc);
            migratedCount++;
          } catch (insertError: unknown) {
            const errorMsg = insertError instanceof Error ? insertError.message : String(insertError);
            console.error(`[消息迁移] 迁移消息失败，msgId=${msg._id}:`, errorMsg);
          }
        }

        if (migratedCount > 0) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[消息迁移] 对话 ${conv.id} 迁移了 ${migratedCount} 条消息`);
          }
        }

        try {
          await mongoDBService.updateOne('conversations', { id: conv.id } as never, {
            $set: { messages: [] },
          } as never);
        } catch (updateError: unknown) {
          const errorMsg = updateError instanceof Error ? updateError.message : String(updateError);
          console.error(`[消息迁移] 清空对话messages数组失败，conversationId=${conv.id}:`, errorMsg);
        }

        totalMigrated += migratedCount;
      }

      if (process.env.NODE_ENV !== 'production') {
        console.log(`[消息迁移] 迁移完成，共迁移 ${totalMigrated} 条消息`);
      }
      return totalMigrated;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[消息迁移] 迁移过程发生错误:', errorMsg);
      throw error;
    }
  }

  /**
   * 获取对话消息
   * 统一从独立 messages 集合按 conversationId 查询，不再回退到 conversation 文档的 messages 数组
   * @param conversationId - 对话ID
   * @returns 消息列表，按时间升序排列；MongoDB 未连接或查询异常时返回空数组
   */
  async getConversationMessages(conversationId: string): Promise<Message[]> {
    if (!mongoDBService.isConnected()) {
      return [];
    }

    try {
      const messageDocs = await mongoDBService.find<MessageDocument>(
        'messages',
        { conversationId } as never
      );

      const sortedDocs = messageDocs.sort(
        (a: MessageDocument, b: MessageDocument) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return sortedDocs.map((doc: MessageDocument) => ({
        _id: doc.id,
        role: doc.role,
        content: doc.content,
        timestamp: doc.timestamp,
      }));
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[消息服务] 从独立集合查询消息失败，conversationId=${conversationId}:`, errorMsg);
      return [];
    }
  }

  /**
   * 删除对话
   * 同时删除 conversation 文档和独立 messages 集合中的相关消息
   * 同时清除内存和 Redis 缓存
   * @param conversationId - 对话ID
   * @returns 是否成功
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return false;

    if (mongoDBService.isConnected()) {
      await mongoDBService.deleteOne('conversations', { id: conversationId } as never);

      try {
        await mongoDBService.deleteMany('messages', { conversationId } as never);
      } catch (deleteError: unknown) {
        const errorMsg = deleteError instanceof Error ? deleteError.message : String(deleteError);
        console.error(`[消息服务] 删除独立messages集合失败，conversationId=${conversationId}:`, errorMsg);
      }
    }

    // 同时清除内存和 Redis 缓存
    this.memoryConversations.delete(conversationId);
    void this.invalidateRedisCache(conversationId);
    return true;
  }

  /**
   * 从内存缓存中移除指定对话
   * 用于外部（如admin server）修改数据库后，通知主server刷新缓存
   * 同时异步清除 Redis 缓存（保持方法同步签名，不等待 Redis 操作完成）
   * @param conversationId - 对话ID
   */
  evictFromCache(conversationId: string): void {
    this.memoryConversations.delete(conversationId);
    // 异步清除 Redis 缓存，不等待结果（保持方法同步签名）
    void this.invalidateRedisCache(conversationId);
  }

  /**
   * 强制从数据库重新加载对话到缓存
   * 先清除内存和 Redis 缓存，再重新从数据库加载
   * @param conversationId - 对话ID
   * @returns 重新加载后的对话或null
   */
  async reloadConversation(conversationId: string): Promise<Conversation | null> {
    this.memoryConversations.delete(conversationId);
    await this.invalidateRedisCache(conversationId);
    return this.getConversation(conversationId);
  }
}

export const conversationService = new ConversationService();
