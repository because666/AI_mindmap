import OpenAI from 'openai';
import { config } from '../config';
import { AIRequest, AIResponse, EmbeddingRequest, EmbeddingResponse } from '../types';
import { vectorDBService } from '../data/vector/connection';

/**
 * 聊天选项接口
 */
interface ChatOptions {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * 连接测试选项接口
 */
interface TestOptions {
  provider?: string;
  model?: string;
  apiKey: string;
  baseUrl?: string;
}

/**
 * 流式聊天结果接口
 */
interface StreamChunk {
  type: 'content' | 'thinking';
  content: string;
}

/**
 * 默认模型配置
 */
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-3.5-turbo',
  zhipu: 'glm-4-flash',
  deepseek: 'deepseek-chat',
  anthropic: 'claude-3-haiku-20240307',
};

/**
 * API 基础URL配置
 */
const API_BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com/v1',
};

/**
 * AI服务类
 * 提供与各种AI模型的交互功能
 */
class AIService {
  private openai: OpenAI | null = null;
  private static instance: AIService;

  private constructor() {
    if (config.ai.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.ai.openaiApiKey });
    }
  }

  /**
   * 获取AI服务单例
   * @returns AIService实例
   */
  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * 获取内置API密钥
   * @param provider - 服务提供商
   * @returns 内置API密钥或undefined
   */
  private getBuiltInApiKey(provider?: string): string | undefined {
    if (!provider) {
      if (config.ai.zhipuApiKey) return config.ai.zhipuApiKey;
      if (config.ai.openaiApiKey) return config.ai.openaiApiKey;
      return undefined;
    }

    switch (provider) {
      case 'zhipu':
        return config.ai.zhipuApiKey;
      case 'openai':
        return config.ai.openaiApiKey;
      default:
        return undefined;
    }
  }

  /**
   * 获取OpenAI客户端
   * @param apiKey - API密钥
   * @param baseUrl - API基础URL
   * @param provider - 服务提供商
   * @returns OpenAI客户端实例
   */
  private getOpenAIClient(apiKey?: string, baseUrl?: string, provider?: string): OpenAI {
    let effectiveApiKey = apiKey;
    let effectiveProvider = provider;

    if (!effectiveApiKey) {
      effectiveApiKey = this.getBuiltInApiKey(provider);
      if (!effectiveProvider && effectiveApiKey === config.ai.zhipuApiKey) {
        effectiveProvider = 'zhipu';
      }
    }

    if (!effectiveApiKey) {
      throw new Error('API key not configured. Please provide an API key in settings or configure a built-in API key on the server.');
    }

    let effectiveBaseUrl = baseUrl;
    if (!effectiveBaseUrl && effectiveProvider && API_BASE_URLS[effectiveProvider]) {
      effectiveBaseUrl = API_BASE_URLS[effectiveProvider];
    }

    return new OpenAI({
      apiKey: effectiveApiKey,
      baseURL: effectiveBaseUrl || 'https://api.openai.com/v1',
      timeout: 60000,
      maxRetries: 2,
    });
  }

  /**
   * 发送聊天请求
   * @param request - 聊天请求选项
   * @returns AI响应
   */
  async chat(request: ChatOptions): Promise<AIResponse> {
    if (!request.messages || request.messages.length === 0) {
      return {
        success: false,
        error: 'Messages array cannot be empty',
      };
    }

    for (const msg of request.messages) {
      if (!msg.content || typeof msg.content !== 'string') {
        return {
          success: false,
          error: 'Invalid message content',
        };
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        return {
          success: false,
          error: `Invalid message role: ${msg.role}`,
        };
      }
    }

    try {
      const client = this.getOpenAIClient(request.apiKey, request.baseUrl, request.provider);
      
      let model = request.model;
      if (!model) {
        if (request.provider && DEFAULT_MODELS[request.provider]) {
          model = DEFAULT_MODELS[request.provider];
        } else {
          model = config.ai.defaultModel;
        }
      }

      const temperature = Math.max(0, Math.min(2, request.temperature ?? 0.7));
      const maxTokens = request.maxTokens ? Math.max(1, Math.min(32000, request.maxTokens)) : undefined;

      const response = await client.chat.completions.create({
        model,
        messages: request.messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content.trim(),
        })),
        temperature,
        max_tokens: maxTokens,
        stream: false,
      });

      const choice = response.choices[0];
      if (!choice || !choice.message) {
        return {
          success: false,
          error: 'No response from AI model',
        };
      }

      return {
        success: true,
        content: choice.message.content || '',
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      const errorMessage = this.formatError(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 测试API连接
   * @param options - 测试选项
   * @returns 测试结果
   */
  async testConnection(options: TestOptions): Promise<{ success: boolean; message?: string; error?: string }> {
    if (!options.apiKey || typeof options.apiKey !== 'string') {
      return { success: false, error: 'API Key is required' };
    }

    if (options.apiKey.trim().length < 10) {
      return { success: false, error: 'Invalid API Key format' };
    }

    try {
      const client = this.getOpenAIClient(options.apiKey, options.baseUrl, options.provider);
      
      let model = options.model;
      if (!model) {
        if (options.provider && DEFAULT_MODELS[options.provider]) {
          model = DEFAULT_MODELS[options.provider];
        } else {
          model = 'gpt-3.5-turbo';
        }
      }

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      });

      if (response.choices && response.choices.length > 0) {
        return { success: true, message: 'API连接成功' };
      }

      return { success: false, error: 'API返回了意外的响应' };
    } catch (error: any) {
      const errorMessage = this.formatError(error);
      return { 
        success: false, 
        error: errorMessage,
      };
    }
  }

  /**
   * 流式聊天
   * @param request - 聊天请求选项
   * @yields 响应内容片段（包含内容和思考过程）
   */
  async *chatStream(request: ChatOptions): AsyncGenerator<StreamChunk> {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const msg of request.messages) {
      if (!msg.content || typeof msg.content !== 'string') {
        throw new Error('Invalid message content');
      }
      if (!['system', 'user', 'assistant'].includes(msg.role)) {
        throw new Error(`Invalid message role: ${msg.role}`);
      }
    }

    const client = this.getOpenAIClient(request.apiKey, request.baseUrl, request.provider);
    
    let model = request.model;
    if (!model) {
      if (request.provider && DEFAULT_MODELS[request.provider]) {
        model = DEFAULT_MODELS[request.provider];
      } else {
        model = config.ai.defaultModel;
      }
    }

    const temperature = Math.max(0, Math.min(2, request.temperature ?? 0.7));
    const maxTokens = request.maxTokens ? Math.max(1, Math.min(32000, request.maxTokens)) : undefined;

    try {
      const stream = await client.chat.completions.create({
        model,
        messages: request.messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content.trim(),
        })),
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta as any;
        
        const reasoningContent = delta?.reasoning_content || '';
        const content = delta?.content || '';
        
        if (reasoningContent) {
          yield {
            type: 'thinking',
            content: reasoningContent
          };
        }
        
        if (content) {
          yield {
            type: 'content',
            content: content
          };
        }
      }
    } catch (error: any) {
      throw new Error(this.formatError(error));
    }
  }

  /**
   * 获取文本嵌入向量
   * @param request - 嵌入请求
   * @returns 嵌入响应
   */
  async getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (!request.text || typeof request.text !== 'string') {
      return {
        success: false,
        error: 'Text is required for embedding',
      };
    }

    if (request.text.trim().length === 0) {
      return {
        success: false,
        error: 'Text cannot be empty',
      };
    }

    if (!this.openai) {
      return {
        success: false,
        error: 'OpenAI API key not configured',
      };
    }

    try {
      const model = request.model || config.ai.embeddingModel;
      const truncatedText = request.text.length > 8000 
        ? request.text.substring(0, 8000) 
        : request.text;

      const response = await this.openai.embeddings.create({
        model,
        input: truncatedText,
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        return {
          success: false,
          error: 'Failed to generate embedding',
        };
      }

      return {
        success: true,
        embedding,
      };
    } catch (error: any) {
      return {
        success: false,
        error: this.formatError(error),
      };
    }
  }

  /**
   * 索引节点内容
   * @param nodeId - 节点ID
   * @param content - 内容文本
   * @param metadata - 元数据
   */
  async indexNodeContent(nodeId: string, content: string, metadata: Record<string, any> = {}): Promise<void> {
    if (!nodeId || !content) {
      return;
    }

    const embeddingResponse = await this.getEmbedding({ text: content });
    
    if (embeddingResponse.success && embeddingResponse.embedding) {
      try {
        await vectorDBService.insertVector(nodeId, embeddingResponse.embedding, {
          ...metadata,
          content: content.substring(0, 500),
          indexedAt: new Date(),
        });
      } catch (error) {
        console.error('Failed to index node content:', error);
      }
    }
  }

  /**
   * 搜索相似节点
   * @param query - 搜索查询
   * @param topK - 返回数量
   * @returns 相似节点列表
   */
  async searchSimilarNodes(query: string, topK: number = 10): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
    if (!query || typeof query !== 'string') {
      return [];
    }

    const embeddingResponse = await this.getEmbedding({ text: query });
    
    if (!embeddingResponse.success || !embeddingResponse.embedding) {
      return [];
    }

    try {
      return await vectorDBService.searchSimilar(embeddingResponse.embedding, Math.max(1, Math.min(100, topK)));
    } catch (error) {
      console.error('Failed to search similar nodes:', error);
      return [];
    }
  }

  /**
   * 检查API是否已配置（包括内置密钥）
   * @returns 是否已配置
   */
  isConfigured(): boolean {
    return !!(this.openai || config.ai.zhipuApiKey || config.ai.openaiApiKey);
  }

  /**
   * 检查是否有内置API密钥可用
   * @returns 是否有内置密钥
   */
  hasBuiltInApiKey(): boolean {
    return !!(config.ai.zhipuApiKey || config.ai.openaiApiKey);
  }

  /**
   * 获取默认提供商（基于内置密钥）
   * @returns 默认提供商
   */
  getDefaultProvider(): string {
    return config.ai.defaultProvider || 'zhipu';
  }

  /**
   * 格式化错误信息
   * @param error - 错误对象
   * @returns 格式化后的错误信息
   */
  private formatError(error: any): string {
    if (error?.error?.message) {
      return error.error.message;
    }
    if (error?.message) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unexpected error occurred';
  }
}

export const aiService = AIService.getInstance();
