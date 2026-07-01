import dotenv from 'dotenv';

dotenv.config();

/**
 * AI 服务商配置接口
 * 定义单个 AI 服务商的连接信息与优先级
 */
export interface AIProvider {
  /** 服务商唯一标识，如 "zhipu"、"deepseek" */
  id: string;
  /** 服务商显示名称，如 "智谱GLM" */
  name: string;
  /** API 基础 URL */
  url: string;
  /** API 密钥 */
  apiKey: string;
  /** 默认模型名称 */
  model: string;
  /** 优先级，数值越小优先级越高 */
  priority: number;
}

/**
 * 解析 AI_PROVIDERS 环境变量
 * 环境变量格式为 JSON 字符串数组，如：[{"id":"zhipu","name":"智谱GLM","url":"...","apiKey":"...","model":"glm-4-flash","priority":0}]
 * 如果环境变量未设置，则基于现有 ZHIPU_API_KEY 构造默认 provider
 * @returns AIProvider 数组
 */
function parseAIProviders(): AIProvider[] {
  const envValue = process.env.AI_PROVIDERS;
  if (envValue) {
    try {
      const parsed = JSON.parse(envValue) as AIProvider[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (error: unknown) {
      console.warn('⚠️ AI_PROVIDERS 环境变量解析失败，将使用默认配置:', error instanceof Error ? error.message : String(error));
    }
  }

  const zhipuApiKey = process.env.ZHIPU_API_KEY || '';
  if (zhipuApiKey) {
    return [{
      id: 'zhipu',
      name: '智谱GLM',
      url: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey: zhipuApiKey,
      model: process.env.DEFAULT_MODEL || 'glm-4-flash',
      priority: 0,
    }];
  }

  return [];
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    host: process.env.HOST || 'localhost',
  },
  
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    database: process.env.MONGODB_DATABASE || 'deepmindmap',
  },
  
  vector: {
    provider: process.env.VECTOR_PROVIDER || 'memory',
    dimension: parseInt(process.env.VECTOR_DIMENSION || '1536', 10),
    indexName: process.env.VECTOR_INDEX || 'deepmindmap_vectors',
  },
  
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    zhipuApiKey: process.env.ZHIPU_API_KEY || '',
    zhipuApiKey2: process.env.ZHIPU_API_KEY_2 || '',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
    defaultProvider: process.env.DEFAULT_PROVIDER || 'zhipu',
    defaultModel: process.env.DEFAULT_MODEL || 'glm-4-flash',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    systemPrompt: process.env.SYSTEM_PROMPT || '',
    fallbackChain: (process.env.AI_FALLBACK_CHAIN || 'zhipu,deepseek,openai').split(',').map(s => s.trim()).filter(s => s.length > 0),
    aiProviders: parseAIProviders(),
    /**
     * AI 模型配置集合名称
     * 主服务启动时从该集合加载启用的模型配置覆盖环境变量默认值
     * 默认值与 admin 后台写入的集合名保持一致
     */
    aiModelConfigsCollection: process.env.AI_MODEL_CONFIGS_COLLECTION || 'ai_model_configs',
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  cors: {
    origins: process.env.CORS_ORIGINS || '',
  },

  jpush: {
    appKey: process.env.JPUSH_APPKEY || '',
    masterSecret: process.env.JPUSH_MASTER_SECRET || '',
    forceReadDays: parseInt(process.env.PUSH_FORCE_READ_DAYS || '7', 10),
    messageRetentionDays: parseInt(process.env.PUSH_MESSAGE_RETENTION_DAYS || '30', 10),
    broadcastBatchSize: parseInt(process.env.PUSH_BROADCAST_BATCH_SIZE || '1000', 10),
  },
};

export type Config = typeof config;

/**
 * 校验服务端配置的安全性与完整性
 * 生产环境下关键配置未设置时拒绝启动，非关键配置未设置时输出警告
 * @throws {Error} 生产环境下关键配置缺失时抛出错误
 */
export function validateConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your-secret-key') {
    if (isProduction) {
      errors.push('JWT_SECRET 未设置或为默认值，生产环境必须设置安全的密钥');
    } else {
      warnings.push('JWT_SECRET 未设置或为默认值，建议设置安全的密钥');
    }
  }

  const internalApiToken = process.env.INTERNAL_API_TOKEN;
  if (!internalApiToken) {
    if (isProduction) {
      errors.push('INTERNAL_API_TOKEN 未设置，生产环境必须配置内部 API 通信令牌');
    } else {
      warnings.push('INTERNAL_API_TOKEN 未设置，内部 API 路由已禁用');
    }
  }

  const neo4jPassword = process.env.NEO4J_PASSWORD;
  if (!neo4jPassword || neo4jPassword === 'password') {
    warnings.push('NEO4J_PASSWORD 为默认值，建议设置安全的数据库密码');
  }

  const hasAiApiKey = process.env.OPENAI_API_KEY || process.env.ZHIPU_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!hasAiApiKey) {
    warnings.push('所有 AI API Key 均未设置，AI 相关功能将不可用');
  }

  warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));

  if (errors.length > 0) {
    errors.forEach((error) => console.error(`❌ ${error}`));
    throw new Error(`生产环境配置校验失败:\n${errors.join('\n')}`);
  }
}
