import dotenv from 'dotenv';

dotenv.config();

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
