import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
import { config, AIProvider } from '../config';
import { AIResponse, EmbeddingRequest, EmbeddingResponse } from '../types';
import { vectorDBService } from '../data/vector/connection';
import { mongoDBService } from '../data/mongodb/connection';
import { aiQueue, AIPriority } from './aiQueue';

/**
 * AI 模型配置文档接口（数据库读取用）
 * 与 admin 后台写入 ai_model_configs 集合的结构保持一致
 * _id 使用 mongodb 的 ObjectId 类型，由 Collection<AIModelConfigDocument> 返回时自动填充
 */
interface AIModelConfigDocument {
  /** 文档唯一标识，MongoDB 自动生成 */
  _id: ObjectId;
  /** 模型配置名称 */
  name: string;
  /** 服务商类型 */
  provider: string;
  /** API 密钥 */
  apiKey: string;
  /** API 基础 URL */
  baseUrl: string;
  /** 模型 ID */
  modelId: string;
  /** 采样温度 */
  temperature: number;
  /** 最大输出 token 数 */
  maxTokens: number;
  /** 是否启用 */
  isActive: boolean;
  /** 是否默认模型 */
  isDefault: boolean;
  /** 优先级 */
  priority: number;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * AI用量记录接口
 */
interface AIUsageRecord {
  visitorId: string;
  workspaceId: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  isSuccess: boolean;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * 用量统计接口
 */
interface UsageStats {
  totalTokens: number;
  totalCalls: number;
  avgResponseTime: number;
  modelDistribution: Record<string, number>;
  dailyUsage: Array<{
    date: string;
    totalTokens: number;
    calls: number;
  }>;
}

/** AI 工具调用消息格式 */
interface ChatToolCallMessage {
  /** 工具调用唯一标识 */
  id: string;
  /** 工具名称 */
  name: string;
  /** 工具参数 JSON 字符串 */
  arguments: string;
}

/** AI 对话消息格式 */
interface ChatOptionsMessage {
  /** 消息角色 */
  role: string;
  /** 消息内容 */
  content: string;
  /** tool 消息对应的工具调用 ID */
  tool_call_id?: string;
  /** assistant 消息携带的工具调用列表 */
  tool_calls?: ChatToolCallMessage[];
}

/**
 * 聊天选项接口
 */
interface ChatOptions {
  messages: ChatOptionsMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
  /** 指定 AI 服务商 ID，使用对应 provider 的 url/apiKey/model */
  providerId?: string;
  /** AI 工具定义列表，用于 Function Calling */
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
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
 * 流式聊天结果接口 - 内容片段
 */
interface ContentChunk {
  type: 'content';
  content: string;
}

/**
 * 流式聊天结果接口 - 思考过程片段
 */
interface ThinkingChunk {
  type: 'thinking';
  content: string;
}

/**
 * 流式聊天结果接口 - 降级通知
 */
interface DegradedChunk {
  type: 'degraded';
  provider: string;
  model: string;
}

/**
 * 流式聊天结果接口 - 用量信息
 */
interface UsageChunk {
  type: 'usage';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式聊天结果接口 - 超时通知
 */
interface TimeoutChunk {
  type: 'timeout';
}

/**
 * 流式聊天结果联合类型
 */
type StreamChunk = ContentChunk | ThinkingChunk | DegradedChunk | UsageChunk | TimeoutChunk | ToolCallChunk;

/**
 * AI 工具定义 - OpenAI Function Calling 格式
 * 定义 AI 可调用的所有工具及其参数 Schema
 */
export const AI_TOOLS: Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}> = [
  {
    type: 'function',
    function: {
      name: 'create_node',
      description: '在思维导图中创建新节点。如果不指定父节点ID，则默认在当前对话所在节点下创建子节点。',
      parameters: {
        type: 'object',
        properties: {
          parent_node_id: {
            type: 'string',
            description: '父节点的ID（可选，不传则使用当前对话所在节点）',
          },
          title: {
            type: 'string',
            description: '新节点的标题，应简洁精炼',
          },
          content: {
            type: 'string',
            description: '新节点的详细内容（可选）',
          },
          position: {
            type: 'string',
            description: '新节点相对于父节点的位置',
            enum: ['left', 'right'],
          },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_relation',
      description: '在两个节点之间创建关系连线。关系类型包括：parent-child（父子）、supports（支持）、contradicts（矛盾）、prerequisite（前置）、elaborates（阐述）、references（引用）、conclusion（结论）、custom（自定义）。',
      parameters: {
        type: 'object',
        properties: {
          source_node_id: {
            type: 'string',
            description: '关系起始节点的ID',
          },
          target_node_id: {
            type: 'string',
            description: '关系目标节点的ID',
          },
          relation_type: {
            type: 'string',
            description: '关系类型',
            enum: ['parent-child', 'supports', 'contradicts', 'prerequisite', 'elaborates', 'references', 'conclusion', 'custom'],
          },
          label: {
            type: 'string',
            description: '关系标签说明（可选）',
          },
        },
        required: ['source_node_id', 'target_node_id', 'relation_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_node',
      description: '修改已有节点的标题或内容。至少需要提供 title 或 content 之一。',
      parameters: {
        type: 'object',
        properties: {
          node_id: {
            type: 'string',
            description: '要修改的节点ID',
          },
          title: {
            type: 'string',
            description: '新的节点标题',
          },
          content: {
            type: 'string',
            description: '新的节点详细内容',
          },
        },
        required: ['node_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'expand_node',
      description: '为指定节点自动生成多个子主题节点。direction 决定扩展方向：deepen（深化）、broaden（扩展）、apply（应用）、compare（对比）。',
      parameters: {
        type: 'object',
        properties: {
          node_id: {
            type: 'string',
            description: '要扩展的节点ID（可选，不传则使用当前对话所在节点）',
          },
          direction: {
            type: 'string',
            description: '扩展方向',
            enum: ['deepen', 'broaden', 'apply', 'compare'],
          },
          count: {
            type: 'number',
            description: '生成子节点的数量，默认3个',
          },
        },
        required: ['direction'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mindmap_context',
      description: '获取当前思维导图的结构概览，包括所有节点的ID、标题、类型和层级关系。在执行创建或修改操作前，应先调用此工具了解导图结构。',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_node_detail',
      description: '获取指定节点的详细信息，包括标题、内容、标签、父节点、子节点和关联关系。',
      parameters: {
        type: 'object',
        properties: {
          node_id: {
            type: 'string',
            description: '要查询的节点ID',
          },
        },
        required: ['node_id'],
      },
    },
  },
];

/** 工具调用块 - AI 决定调用工具时返回 */
export interface ToolCallChunk {
  type: 'tool_call';
  /** 工具调用信息 */
  tool_calls: Array<{
    /** 工具调用唯一标识 */
    id: string;
    /** 工具名称 */
    name: string;
    /** 工具调用参数（JSON 字符串） */
    arguments: string;
  }>;
}

/**
 * 流式Delta扩展接口（支持reasoning_content和tool_calls字段）
 */
interface StreamDeltaWithReasoning {
  content?: string | null;
  reasoning_content?: string | null;
  role?: string;
  /** 流式工具调用增量数据 */
  tool_calls?: Array<{
    /** 工具调用在数组中的索引 */
    index: number;
    /** 工具调用唯一标识 */
    id?: string;
    /** 工具函数信息 */
    function?: {
      /** 工具函数名称 */
      name?: string;
      /** 工具函数参数（JSON片段） */
      arguments?: string;
    };
  }>;
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
 * 流式响应超时时间（毫秒）
 */
const STREAM_TIMEOUT_MS = 30000;

/**
 * 最大降级尝试次数
 */
const MAX_FALLBACK_ATTEMPTS = 3;

/**
 * AI服务类
 * 提供与各种AI模型的交互功能，支持Provider降级链和用量追踪
 */
class AIService {
  private openai: OpenAI | null = null;
  private static instance: AIService;
  private keyPools: Map<string, string[]> = new Map();
  private keyIndices: Map<string, number> = new Map();
  /** 多 AI 服务商配置列表，从 config.aiProviders 初始化 */
  private providers: AIProvider[] = [];

  private constructor() {
    this.initializeKeyPools();
    this.initializeProviders();
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
   * 初始化各 Provider 的 Key 池
   * 将同一 Provider 的多个 API Key 收集到池中，支持 Round-Robin 轮询
   * 当前已实现 zhipu 的 Key 池，可按相同模式扩展 openai、deepseek 等 Provider
   */
  private initializeKeyPools(): void {
    const zhipuKeys = [config.ai.zhipuApiKey, config.ai.zhipuApiKey2].filter((k) => k.length > 0);
    if (zhipuKeys.length > 0) {
      this.keyPools.set('zhipu', zhipuKeys);
      this.keyIndices.set('zhipu', 0);
    }

    const deepseekKeys = [config.ai.deepseekApiKey].filter((k) => k.length > 0);
    if (deepseekKeys.length > 0) {
      this.keyPools.set('deepseek', deepseekKeys);
      this.keyIndices.set('deepseek', 0);
    }

    const openaiKeys = [config.ai.openaiApiKey].filter((k) => k.length > 0);
    if (openaiKeys.length > 0) {
      this.keyPools.set('openai', openaiKeys);
      this.keyIndices.set('openai', 0);
    }
  }

  /**
   * 初始化多 AI 服务商配置列表
   * 从 config.aiProviders 加载服务商配置，按 priority 升序排列
   */
  private initializeProviders(): void {
    this.providers = [...config.ai.aiProviders].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 获取 AI 服务商配置
   * 按 ID 查找指定服务商，未指定时按 priority 顺序选择优先级最高的服务商
   * @param providerId - 服务商唯一标识，未指定时返回优先级最高的服务商
   * @returns 匹配的 AIProvider，未找到时返回 undefined
   */
  getProvider(providerId?: string): AIProvider | undefined {
    if (providerId) {
      return this.providers.find((p) => p.id === providerId);
    }
    return this.providers.length > 0 ? this.providers[0] : undefined;
  }

  /**
   * 获取所有已配置的 AI 服务商列表
   * @returns 按 priority 排序的服务商列表（浅拷贝，防止外部修改内部状态）
   */
  getProviders(): AIProvider[] {
    return [...this.providers];
  }

  /**
   * 更新 AI 服务商配置列表（运行时动态更新）
   * 用于 admin 后台保存配置后同步到运行中的 AI 服务实例
   * @param newProviders - 新的服务商配置列表
   */
  updateProviders(newProviders: AIProvider[]): void {
    this.providers = [...newProviders].sort((a, b) => a.priority - b.priority);
  }

  /**
   * 从 MongoDB 加载启用的 AI 模型配置并覆盖内存中的 providers 列表
   * 主服务启动时调用，若数据库存在启用配置则覆盖环境变量默认值
   * 数据库不可用或无配置时保持环境变量配置不变（向后兼容）
   * 异常时仅输出警告，不抛出错误，保证服务可启动
   * @returns 加载到的启用配置数量，未加载或异常返回 0
   */
  async loadModelConfigsFromDB(): Promise<number> {
    try {
      const collectionName = config.ai.aiModelConfigsCollection;
      const collection = mongoDBService.getCollection<AIModelConfigDocument>(collectionName);
      if (!collection) {
        console.warn('[AI模型] MongoDB 未连接，跳过 DB 配置加载，使用环境变量默认值');
        return 0;
      }

      const docs = await collection
        .find({ isActive: true })
        .sort({ priority: 1, createdAt: 1 })
        .toArray();

      if (docs.length === 0) {
        console.log('[AI模型] 数据库未找到启用的模型配置，使用环境变量默认值');
        return 0;
      }

      const providers: AIProvider[] = docs.map((doc) => ({
        // 使用数据库 _id 作为 provider 唯一标识，避免与环境变量配置冲突
        id: doc._id.toString(),
        name: doc.name,
        url: doc.baseUrl || '',
        apiKey: doc.apiKey,
        model: doc.modelId,
        priority: doc.priority,
      }));

      this.updateProviders(providers);
      console.log(`[AI模型] 已从数据库加载 ${providers.length} 个启用的模型配置`);

      // 若存在默认模型，输出日志便于排查（不输出 apiKey 明文）
      const defaultDoc = docs.find((d) => d.isDefault);
      if (defaultDoc) {
        console.log(
          `[AI模型] 默认模型：${defaultDoc.name} (${defaultDoc.provider}/${defaultDoc.modelId})`
        );
      }

      return providers.length;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`[AI模型] 从数据库加载模型配置失败，使用环境变量默认值: ${errorMsg}`);
      return 0;
    }
  }

  /**
   * 刷新 AI 模型配置（重新从数据库加载）
   * 供后台内部 API 调用，管理员在后台修改模型配置后触发主服务刷新内存缓存
   * 异常时仅输出警告，不抛出错误，保证不影响调用方主流程
   * @returns 加载到的启用配置数量
   */
  async refreshModelConfigs(): Promise<number> {
    console.log('[AI模型] 收到刷新请求，重新加载模型配置...');
    return await this.loadModelConfigsFromDB();
  }

  /**
   * 从指定 Provider 的 Key 池中按 Round-Robin 方式获取 Key
   * 每次调用后索引自动递增并取模循环，确保 Key 均匀分配
   * @param provider - 服务提供商名称
   * @returns Key 字符串，Key 池为空时返回 undefined
   */
  private getKeyFromPool(provider: string): string | undefined {
    const pool = this.keyPools.get(provider);
    if (!pool || pool.length === 0) {
      return undefined;
    }
    const index = this.keyIndices.get(provider) ?? 0;
    const key = pool[index];
    this.keyIndices.set(provider, (index + 1) % pool.length);
    return key;
  }

  /**
   * 根据 API Key 反查所属的 Provider
   * 遍历所有 Key 池，查找包含指定 Key 的 Provider
   * @param apiKey - 待查找的 API Key
   * @returns Provider 名称，未找到时返回 undefined
   */
  private getProviderForKey(apiKey: string): string | undefined {
    for (const [provider, pool] of this.keyPools.entries()) {
      if (pool.includes(apiKey)) {
        return provider;
      }
    }
    return undefined;
  }

  /**
   * 获取内置API密钥
   * 从 Key 池中按 Round-Robin 方式获取指定 Provider 的 Key
   * 未指定 Provider 时按 zhipu → deepseek → openai 优先级依次尝试
   * @param provider - 服务提供商名称
   * @returns 内置API密钥或undefined
   */
  private getBuiltInApiKey(provider?: string): string | undefined {
    if (!provider) {
      for (const p of ['zhipu', 'deepseek', 'openai']) {
        const key = this.getKeyFromPool(p);
        if (key) return key;
      }
      return undefined;
    }

    return this.getKeyFromPool(provider);
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
      if (!effectiveProvider && effectiveApiKey) {
        effectiveProvider = this.getProviderForKey(effectiveApiKey);
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
   * 获取有效的降级链
   * 根据请求的Provider确定降级顺序，将请求的Provider放在链首
   * @param requestedProvider - 请求中指定的Provider
   * @returns 降级链数组
   */
  private getEffectiveFallbackChain(requestedProvider?: string): string[] {
    const chain = config.ai.fallbackChain;

    if (!requestedProvider) {
      return chain;
    }

    const index = chain.indexOf(requestedProvider);
    if (index === -1) {
      return [requestedProvider, ...chain];
    }

    return [...chain.slice(index), ...chain.slice(0, index)];
  }

  /**
   * 获取指定Provider的默认模型
   * @param provider - 服务提供商名称
   * @returns 默认模型名称
   */
  private getModelForProvider(provider: string): string {
    return DEFAULT_MODELS[provider] || config.ai.defaultModel;
  }

  /**
   * 判断是否应使用降级链
   * 当用户提供自己的API密钥时不使用降级，仅使用内置密钥时启用降级
   * @param request - 聊天请求选项
   * @returns 是否使用降级链
   */
  private shouldUseFallback(request: ChatOptions): boolean {
    return !request.apiKey;
  }

  /**
   * 发送聊天请求（支持Provider降级）
   * 主Provider失败时自动尝试降级链中的下一个Provider，最多尝试3个
   * 当 providerId 指定时，使用对应 provider 的 url/apiKey/model，跳过降级链
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
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        return {
          success: false,
          error: `Invalid message role: ${msg.role}`,
        };
      }
    }

    if (request.providerId) {
      const provider = this.getProvider(request.providerId);
      if (!provider) {
        return {
          success: false,
          error: `未找到指定的 AI 服务商: ${request.providerId}`,
        };
      }
      const providerRequest: ChatOptions = {
        ...request,
        apiKey: provider.apiKey,
        baseUrl: provider.url,
        model: request.model || provider.model,
        provider: request.providerId,
      };
      return this.chatWithProvider(providerRequest, request.providerId, providerRequest.model);
    }

    if (!this.shouldUseFallback(request)) {
      return this.chatWithProvider(request, request.provider, request.model);
    }

    const fallbackChain = this.getEffectiveFallbackChain(request.provider);
    const maxAttempts = Math.min(MAX_FALLBACK_ATTEMPTS, fallbackChain.length);
    let lastError: string = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentProvider = fallbackChain[attempt];
      const currentModel = attempt === 0
        ? (request.model || this.getModelForProvider(currentProvider))
        : this.getModelForProvider(currentProvider);

      if (attempt > 0) {
        console.warn(`[AI降级] Provider ${fallbackChain[attempt - 1]} 失败，尝试 ${currentProvider} (${currentModel})`);
      }

      const result = await this.chatWithProvider(request, currentProvider, currentModel);
      if (result.success) {
        return result;
      }

      lastError = result.error || '未知错误';
    }

    return {
      success: false,
      error: `所有AI服务提供商均不可用: ${lastError}`,
    };
  }

  /**
   * 使用指定Provider发送聊天请求
   * @param request - 聊天请求选项
   * @param provider - 服务提供商
   * @param model - 模型名称
   * @returns AI响应
   */
  private async chatWithProvider(request: ChatOptions, provider?: string, model?: string): Promise<AIResponse> {
    try {
      const client = this.getOpenAIClient(request.apiKey, request.baseUrl, provider);

      const effectiveModel = model || this.getModelForProvider(provider || 'zhipu');
      const temperature = Math.max(0, Math.min(2, request.temperature ?? 0.7));
      const maxTokens = request.maxTokens ? Math.max(1, Math.min(32000, request.maxTokens)) : undefined;

      // 映射消息格式，处理 tool_calls 和 tool 角色消息
      const mappedMessages = request.messages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            content: m.content.trim(),
            tool_call_id: m.tool_call_id || '',
          };
        }
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
          const trimmedContent = m.content.trim();
          return {
            role: 'assistant' as const,
            ...(trimmedContent ? { content: trimmedContent } : {}),
            tool_calls: m.tool_calls.map(toolCall => ({
              id: toolCall.id,
              type: 'function' as const,
              function: {
                name: toolCall.name,
                arguments: toolCall.arguments,
              },
            })),
          };
        }
        return {
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content.trim(),
        };
      });

      // 记录发送给 API 的消息格式，用于调试
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AI Chat] 发送给API的消息:', JSON.stringify(mappedMessages.map(m => ({
          role: m.role,
          hasContent: !!(m as Record<string, unknown>).content,
          contentType: typeof (m as Record<string, unknown>).content,
          contentPreview: typeof (m as Record<string, unknown>).content === 'string'
            ? String((m as Record<string, unknown>).content).substring(0, 50)
            : (m as Record<string, unknown>).content,
          hasToolCalls: !!(m as Record<string, unknown>).tool_calls,
          toolCallCount: Array.isArray((m as Record<string, unknown>).tool_calls)
            ? ((m as Record<string, unknown>).tool_calls as unknown[]).length
            : 0,
          toolCallId: (m as Record<string, unknown>).tool_call_id || undefined,
        })), null, 2));
      }

      const response = await client.chat.completions.create({
        model: effectiveModel,
        messages: mappedMessages,
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      const errorMessage = this.formatError(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * 流式聊天（支持Provider降级和超时控制）
   * 主Provider失败时自动尝试降级链中的下一个Provider，最多尝试3个
   * 30秒无新数据时自动断开并发送超时通知
   * 当 providerId 指定时，使用对应 provider 的 url/apiKey/model，跳过降级链
   * @param request - 聊天请求选项
   * @yields 响应内容片段（包含内容、思考过程、降级通知、用量信息、超时通知）
   */
  async *chatStream(request: ChatOptions): AsyncGenerator<StreamChunk> {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    for (const msg of request.messages) {
      if (!['system', 'user', 'assistant', 'tool'].includes(msg.role)) {
        throw new Error(`Invalid message role: ${msg.role}`);
      }
      // tool 角色消息：content 必须为字符串，tool_call_id 必须存在
      if (msg.role === 'tool') {
        if (typeof msg.content !== 'string') {
          throw new Error('Invalid message content: tool message content must be a string');
        }
        if (!msg.tool_call_id) {
          throw new Error('Invalid message content: tool message must have tool_call_id');
        }
        continue;
      }
      // assistant + tool_calls 消息：content 可以为空，但 tool_calls 必须存在且非空
      if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
        if (msg.content !== undefined && msg.content !== null && typeof msg.content !== 'string') {
          throw new Error('Invalid message content: assistant+tool_calls message content must be a string or empty');
        }
        continue;
      }
      // system/user/assistant（无tool_calls）消息：content 必须为非空字符串
      if (!msg.content || typeof msg.content !== 'string') {
        throw new Error('Invalid message content');
      }
    }

    if (request.providerId) {
      const provider = this.getProvider(request.providerId);
      if (!provider) {
        throw new Error(`未找到指定的 AI 服务商: ${request.providerId}`);
      }
      const providerRequest: ChatOptions = {
        ...request,
        apiKey: provider.apiKey,
        baseUrl: provider.url,
        model: request.model || provider.model,
        provider: request.providerId,
      };
      yield* this.chatStreamWithProvider(providerRequest, request.providerId, providerRequest.model);
      return;
    }

    if (!this.shouldUseFallback(request)) {
      yield* this.chatStreamWithProvider(request, request.provider, request.model);
      return;
    }

    const fallbackChain = this.getEffectiveFallbackChain(request.provider);
    const maxAttempts = Math.min(MAX_FALLBACK_ATTEMPTS, fallbackChain.length);
    let lastError: string = '';

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const currentProvider = fallbackChain[attempt];
      const currentModel = attempt === 0
        ? (request.model || this.getModelForProvider(currentProvider))
        : this.getModelForProvider(currentProvider);

      if (attempt > 0) {
        console.warn(`[AI降级] Provider ${fallbackChain[attempt - 1]} 失败，尝试 ${currentProvider} (${currentModel})`);
        yield { type: 'degraded', provider: currentProvider, model: currentModel };
      }

      try {
        yield* this.chatStreamWithProvider(request, currentProvider, currentModel);
        return;
      } catch (error: unknown) {
        lastError = this.formatError(error);
        if (attempt >= maxAttempts - 1) {
          throw new Error(`所有AI服务提供商均不可用: ${lastError}`);
        }
      }
    }
  }

  /**
   * 使用指定Provider进行流式聊天
   * 包含30秒超时控制，无新数据时自动断开并发送超时通知
   * @param request - 聊天请求选项
   * @param provider - 服务提供商
   * @param model - 模型名称
   * @yields 响应内容片段
   */
  private async *chatStreamWithProvider(request: ChatOptions, provider?: string, model?: string): AsyncGenerator<StreamChunk> {
    const client = this.getOpenAIClient(request.apiKey, request.baseUrl, provider);

    const effectiveModel = model || this.getModelForProvider(provider || 'zhipu');
    const temperature = Math.max(0, Math.min(2, request.temperature ?? 0.7));
    const maxTokens = request.maxTokens ? Math.max(1, Math.min(32000, request.maxTokens)) : undefined;

    /** 工具调用缓冲区，用于流式组装 tool_calls */
    const toolCallsBuffer: Array<{ id: string; name: string; arguments: string }> = [];
    /** 标记是否已输出工具调用，防止重复 yield */
    let hasEmittedToolCalls = false;

    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const resetTimeout = (): void => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => {
        controller.abort();
      }, STREAM_TIMEOUT_MS);
    };

    resetTimeout();

    try {
      // 映射消息格式，处理 tool_calls 和 tool 角色消息
      const mappedMessages = request.messages.map(m => {
        if (m.role === 'tool') {
          return {
            role: 'tool' as const,
            content: m.content.trim(),
            tool_call_id: m.tool_call_id || '',
          };
        }
        if (m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0) {
          const trimmedContent = m.content.trim();
          return {
            role: 'assistant' as const,
            ...(trimmedContent ? { content: trimmedContent } : {}),
            tool_calls: m.tool_calls.map(toolCall => ({
              id: toolCall.id,
              type: 'function' as const,
              function: {
                name: toolCall.name,
                arguments: toolCall.arguments,
              },
            })),
          };
        }
        return {
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content.trim(),
        };
      });

      // 记录发送给 API 的消息格式，用于调试 Invalid message content 错误
      if (process.env.NODE_ENV !== 'production') {
        console.log('[AI Stream] 发送给API的消息:', JSON.stringify(mappedMessages.map(m => ({
          role: m.role,
          hasContent: !!(m as Record<string, unknown>).content,
          contentType: typeof (m as Record<string, unknown>).content,
          contentPreview: typeof (m as Record<string, unknown>).content === 'string'
            ? String((m as Record<string, unknown>).content).substring(0, 50)
            : (m as Record<string, unknown>).content,
          hasToolCalls: !!(m as Record<string, unknown>).tool_calls,
          toolCallCount: Array.isArray((m as Record<string, unknown>).tool_calls)
            ? ((m as Record<string, unknown>).tool_calls as unknown[]).length
            : 0,
          toolCallId: (m as Record<string, unknown>).tool_call_id || undefined,
        })), null, 2));
      }

      const stream = await client.chat.completions.create({
        model: effectiveModel,
        messages: mappedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true },
        // 如果提供了工具定义，传入 tools 参数
        ...(request.tools && request.tools.length > 0 ? { tools: request.tools } : {}),
      }, { signal: controller.signal });

      for await (const chunk of stream) {
        resetTimeout();

        const delta = chunk.choices[0]?.delta as StreamDeltaWithReasoning | undefined;
        const finishReason = chunk.choices[0]?.finish_reason;

        // 处理工具调用
        if (delta?.tool_calls && delta.tool_calls.length > 0) {
          // 流式组装 tool_calls
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index;
            // 初始化 tool_call 缓冲区
            if (!toolCallsBuffer[index]) {
              toolCallsBuffer[index] = {
                id: toolCallDelta.id || '',
                name: toolCallDelta.function?.name || '',
                arguments: '',
              };
            }
            // 追加 id、name、arguments
            if (toolCallDelta.id) {
              toolCallsBuffer[index].id = toolCallDelta.id;
            }
            if (toolCallDelta.function?.name) {
              toolCallsBuffer[index].name = toolCallDelta.function.name;
            }
            if (toolCallDelta.function?.arguments) {
              toolCallsBuffer[index].arguments += toolCallDelta.function.arguments;
            }
          }
        }

        const reasoningContent = delta?.reasoning_content || '';
        const content = delta?.content || '';

        if (finishReason || (!content && !reasoningContent && !chunk.usage)) {
          console.log('[AI Stream] chunk:', JSON.stringify({
            finishReason,
            hasContent: !!content,
            hasReasoning: !!reasoningContent,
            hasUsage: !!chunk.usage,
            deltaKeys: delta ? Object.keys(delta) : [],
            role: delta?.role,
          }));
        }

        if (reasoningContent) {
          yield { type: 'thinking', content: reasoningContent };
        }

        if (content) {
          yield { type: 'content', content };
        }

        // 当 finishReason 为 tool_calls 时，输出完整的工具调用
        if (finishReason === 'tool_calls' && !hasEmittedToolCalls) {
          const completeToolCalls = toolCallsBuffer.filter(tc => tc && tc.id && tc.name);
          console.log('[AI Stream] 工具调用完成, finishReason=tool_calls, 完整工具调用:', JSON.stringify(completeToolCalls));
          if (completeToolCalls.length > 0) {
            hasEmittedToolCalls = true;
            yield {
              type: 'tool_call' as const,
              tool_calls: completeToolCalls,
            };
          }
        }

        if (chunk.usage) {
          yield {
            type: 'usage',
            usage: {
              promptTokens: chunk.usage.prompt_tokens || 0,
              completionTokens: chunk.usage.completion_tokens || 0,
              totalTokens: chunk.usage.total_tokens || 0,
            },
          };
        }
      }
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        yield { type: 'timeout' };
        return;
      }
      throw error;
    } finally {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    }
  }

  /**
   * 记录AI用量
   * 将用量数据插入MongoDB的ai_usage集合，错误时仅记录日志不影响主流程
   * @param record - AI用量记录
   */
  async recordUsage(record: AIUsageRecord): Promise<void> {
    try {
      await mongoDBService.insertOne<AIUsageRecord>('ai_usage', record);
    } catch (error: unknown) {
      console.error('[AI用量] 记录用量失败:', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 获取AI用量统计
   * 根据时间范围聚合用量数据，返回总Token数、调用次数、平均响应时间、模型分布和每日用量
   * @param startDate - 开始日期
   * @param endDate - 结束日期
   * @returns 用量统计数据
   */
  async getUsageStats(startDate: Date, endDate: Date): Promise<UsageStats> {
    const emptyStats: UsageStats = {
      totalTokens: 0,
      totalCalls: 0,
      avgResponseTime: 0,
      modelDistribution: {},
      dailyUsage: [],
    };

    const collection = mongoDBService.getCollection<AIUsageRecord>('ai_usage');
    if (!collection) {
      return emptyStats;
    }

    try {
      const match = {
        createdAt: { $gte: startDate, $lte: endDate },
      };

      const totalResultArray = await collection.aggregate<{
        _id: null;
        totalTokens: number;
        totalCalls: number;
        avgResponseTime: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$totalTokens' },
            totalCalls: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTimeMs' },
          },
        },
      ]).toArray();

      const totalResult = totalResultArray[0];

      const modelDistributionResult = await collection.aggregate<{
        _id: string;
        count: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: '$model',
            count: { $sum: 1 },
          },
        },
      ]).toArray();

      const dailyUsageResult = await collection.aggregate<{
        _id: string;
        totalTokens: number;
        calls: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            totalTokens: { $sum: '$totalTokens' },
            calls: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray();

      const modelDistribution: Record<string, number> = {};
      for (const item of modelDistributionResult) {
        modelDistribution[item._id] = item.count;
      }

      return {
        totalTokens: totalResult?.totalTokens || 0,
        totalCalls: totalResult?.totalCalls || 0,
        avgResponseTime: Math.round(totalResult?.avgResponseTime || 0),
        modelDistribution,
        dailyUsage: dailyUsageResult.map(item => ({
          date: item._id,
          totalTokens: item.totalTokens,
          calls: item.calls,
        })),
      };
    } catch (error: unknown) {
      console.error('[AI用量] 获取统计数据失败:', error instanceof Error ? error.message : String(error));
      return emptyStats;
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
    } catch (error: unknown) {
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
  async indexNodeContent(nodeId: string, content: string, metadata: Record<string, unknown> = {}): Promise<void> {
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
  async searchSimilarNodes(query: string, topK: number = 10): Promise<Array<{ id: string; score: number; metadata: Record<string, unknown> }>> {
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
   * 通过优先级队列发送聊天请求
   * 请求进入队列等待调度，不改变chat方法的外部接口
   * @param priority - 请求优先级，对话使用P0_DIALOG，后台任务使用P1_BACKGROUND
   * @param request - 聊天请求选项
   * @param description - 请求描述，用于队列日志和调试
   * @returns AI响应
   */
  async chatWithQueue(priority: AIPriority, request: ChatOptions, description: string): Promise<AIResponse> {
    return aiQueue.enqueue<AIResponse>(priority, () => this.chat(request), description);
  }

  /**
   * 通过优先级队列进行流式聊天
   * 先获取队列槽位，再执行流式请求，流式完成后释放槽位
   * 适用于需要保持AsyncGenerator接口的场景（如标题生成、结论提炼）
   * @param priority - 请求优先级，对话使用P0_DIALOG，后台任务使用P1_BACKGROUND
   * @param request - 聊天请求选项
   * @param description - 请求描述，用于队列日志和调试
   * @yields 响应内容片段
   */
  async *chatStreamWithQueue(priority: AIPriority, request: ChatOptions, description: string): AsyncGenerator<StreamChunk> {
    const release = await aiQueue.acquireSlot(priority, description);
    try {
      yield* this.chatStream(request);
    } finally {
      release();
    }
  }

  /**
   * 检查API是否已配置（包括内置密钥）
   * @returns 是否已配置
   */
  isConfigured(): boolean {
    return !!(this.openai || config.ai.zhipuApiKey || config.ai.deepseekApiKey || config.ai.openaiApiKey);
  }

  /**
   * 检查是否有内置API密钥可用
   * @returns 是否有内置密钥
   */
  hasBuiltInApiKey(): boolean {
    return !!(config.ai.zhipuApiKey || config.ai.deepseekApiKey || config.ai.openaiApiKey);
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
  private formatError(error: unknown): string {
    if (typeof error === 'object' && error !== null) {
      const errObj = error as Record<string, unknown>;
      if (typeof errObj.error === 'object' && errObj.error !== null) {
        const inner = errObj.error as Record<string, unknown>;
        if (typeof inner.message === 'string') return inner.message;
      }
      if (typeof errObj.message === 'string') return errObj.message;
    }
    if (typeof error === 'string') return error;
    return 'An unexpected error occurred';
  }
}

export const aiService = AIService.getInstance();
export type { AIUsageRecord, UsageStats, ChatOptions, StreamChunk };





