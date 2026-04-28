import { v4 as uuidv4 } from 'uuid';
import { mongoDBService } from '../data/mongodb/connection';
import { Conversation, Message } from '../types';

interface CacheEntry {
  conversation: Conversation;
  loadedAt: number;
}

/**
 * 对话服务类
 * 提供对话的CRUD操作
 * 所有数据按工作区隔离
 * 使用带TTL的内存缓存，确保admin server修改后能及时同步
 */
class ConversationService {
  private memoryConversations: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 30 * 1000; // 30秒缓存过期时间

  /**
   * 创建对话
   * @param nodeId - 节点ID
   * @param workspaceId - 工作区ID
   * @param createdBy - 创建者访客ID
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

    this.memoryConversations.set(conversation.id, { conversation, loadedAt: Date.now() });
    return conversation;
  }

  /**
   * 获取对话
   * 优先从缓存获取，缓存过期或不存在时从数据库重新加载
   * @param id - 对话ID
   * @returns 对话数据或null
   */
  async getConversation(id: string): Promise<Conversation | null> {
    const cached = this.memoryConversations.get(id);
    const now = Date.now();

    // 缓存存在且未过期，直接返回
    if (cached && now - cached.loadedAt < this.CACHE_TTL) {
      return cached.conversation;
    }

    // 缓存不存在或已过期，从数据库重新加载
    if (mongoDBService.isConnected()) {
      const conv = await mongoDBService.findOne<Conversation>('conversations', { id } as never);
      if (conv) {
        this.memoryConversations.set(id, { conversation: conv, loadedAt: now });
        return conv;
      }
    }

    // 数据库未连接且缓存已过期，返回过期缓存（兜底）
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
    // 先检查缓存中是否有未过期的匹配项
    const now = Date.now();
    for (const entry of this.memoryConversations.values()) {
      if (entry.conversation.nodeId === nodeId && now - entry.loadedAt < this.CACHE_TTL) {
        return entry.conversation;
      }
    }

    if (mongoDBService.isConnected()) {
      const conv = await mongoDBService.findOne<Conversation>('conversations', { nodeId } as never);
      if (conv) {
        this.memoryConversations.set(conv.id, { conversation: conv, loadedAt: now });
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
          this.memoryConversations.set(conv.id, { conversation: conv, loadedAt: now });
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
   * @param conversationId - 对话ID
   * @param message - 消息内容
   * @returns 添加的消息
   */
  async addMessage(conversationId: string, message: Omit<Message, '_id' | 'timestamp'>): Promise<Message> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) throw new Error('对话不存在');

    const newMessage: Message = {
      ...message,
      _id: uuidv4(),
      timestamp: new Date(),
    };

    conversation.messages.push(newMessage);
    conversation.updatedAt = new Date();

    if (mongoDBService.isConnected()) {
      await mongoDBService.updateOne('conversations', { id: conversationId } as never, {
        $push: { messages: newMessage },
        $set: { updatedAt: new Date() },
      } as never);
    }

    this.memoryConversations.set(conversationId, { conversation, loadedAt: Date.now() });
    return newMessage;
  }

  /**
   * 清空对话消息
   * @param conversationId - 对话ID
   * @returns 是否成功
   */
  async clearConversation(conversationId: string): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return false;

    conversation.messages = [];
    conversation.updatedAt = new Date();

    if (mongoDBService.isConnected()) {
      await mongoDBService.updateOne('conversations', { id: conversationId } as never, {
        $set: { messages: [], updatedAt: new Date() },
      } as never);
    }

    this.memoryConversations.set(conversationId, { conversation, loadedAt: Date.now() });
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

    this.memoryConversations.set(conversationId, { conversation, loadedAt: Date.now() });
    return true;
  }

  /**
   * 获取对话的所有消息
   * @param conversationId - 对话ID
   * @returns 消息列表
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    const conversation = await this.getConversation(conversationId);
    return conversation?.messages || [];
  }

  /**
   * 删除对话
   * @param conversationId - 对话ID
   * @returns 是否成功
   */
  async deleteConversation(conversationId: string): Promise<boolean> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) return false;

    if (mongoDBService.isConnected()) {
      await mongoDBService.deleteOne('conversations', { id: conversationId } as never);
    }

    this.memoryConversations.delete(conversationId);
    return true;
  }

  /**
   * 从内存缓存中移除指定对话
   * 用于外部（如admin server）修改数据库后，通知主server刷新缓存
   * @param conversationId - 对话ID
   */
  evictFromCache(conversationId: string): void {
    this.memoryConversations.delete(conversationId);
  }

  /**
   * 强制从数据库重新加载对话到缓存
   * @param conversationId - 对话ID
   * @returns 重新加载后的对话或null
   */
  async reloadConversation(conversationId: string): Promise<Conversation | null> {
    this.memoryConversations.delete(conversationId);
    return this.getConversation(conversationId);
  }
}

export const conversationService = new ConversationService();
