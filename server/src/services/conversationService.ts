import { v4 as uuidv4 } from 'uuid';
import { mongoDBService } from '../data/mongodb/connection';
import { Conversation, Message } from '../types';

/**
 * 对话服务类
 * 提供对话的CRUD操作
 * 所有数据按工作区隔离
 */
class ConversationService {
  private memoryConversations: Map<string, Conversation> = new Map();

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

    this.memoryConversations.set(conversation.id, conversation);
    return conversation;
  }

  /**
   * 获取对话
   * @param id - 对话ID
   * @returns 对话数据或null
   */
  async getConversation(id: string): Promise<Conversation | null> {
    if (this.memoryConversations.has(id)) {
      return this.memoryConversations.get(id) || null;
    }

    if (mongoDBService.isConnected()) {
      const conv = await mongoDBService.findOne<Conversation>('conversations', { id } as never);
      if (conv) {
        this.memoryConversations.set(id, conv);
        return conv;
      }
    }

    return null;
  }

  /**
   * 通过节点ID获取对话
   * @param nodeId - 节点ID
   * @returns 对话数据或null
   */
  async getConversationByNodeId(nodeId: string): Promise<Conversation | null> {
    for (const conv of this.memoryConversations.values()) {
      if (conv.nodeId === nodeId) return conv;
    }

    if (mongoDBService.isConnected()) {
      const conv = await mongoDBService.findOne<Conversation>('conversations', { nodeId } as never);
      if (conv) {
        this.memoryConversations.set(conv.id, conv);
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

    for (const conv of this.memoryConversations.values()) {
      if (conv.workspaceId === workspaceId) {
        results.push(conv);
      }
    }

    if (mongoDBService.isConnected()) {
      const dbConvs = await mongoDBService.find<Conversation>('conversations', { workspaceId } as never);
      for (const conv of dbConvs) {
        if (!results.find(r => r.id === conv.id)) {
          this.memoryConversations.set(conv.id, conv);
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

    this.memoryConversations.set(conversationId, conversation);
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

    this.memoryConversations.set(conversationId, conversation);
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

    this.memoryConversations.set(conversationId, conversation);
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
}

export const conversationService = new ConversationService();
