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
    zhipuApiKey: process.env.ZHIPU_API_KEY || '86caae47a88e4ca48af7fab4e5991e30.BK5mPaWKGKgALsla',
    defaultProvider: process.env.DEFAULT_PROVIDER || 'zhipu',
    defaultModel: process.env.DEFAULT_MODEL || 'glm-4-flash',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
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

  jpush: {
    appKey: process.env.JPUSH_APPKEY || '',
    masterSecret: process.env.JPUSH_MASTER_SECRET || '',
    forceReadDays: parseInt(process.env.PUSH_FORCE_READ_DAYS || '7', 10),
    messageRetentionDays: parseInt(process.env.PUSH_MESSAGE_RETENTION_DAYS || '30', 10),
    broadcastBatchSize: parseInt(process.env.PUSH_BROADCAST_BATCH_SIZE || '1000', 10),
  },
};

export type Config = typeof config;
