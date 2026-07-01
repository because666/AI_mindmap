import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config, validateConfig } from './config';
import { 
  rateLimiter, 
  errorHandler, 
  requestLogger 
} from './middleware';
import { neo4jService } from './data/neo4j/connection';
import { mongoDBService } from './data/mongodb/connection';
import { vectorDBService } from './data/vector/connection';
import { redisService } from './data/redis/connection';

import nodesRouter from './routes/nodes';
import conversationsRouter from './routes/conversations';
import searchRouter from './routes/search';
import aiRouter from './routes/ai';
import feedbackRouter from './routes/feedback';
import announcementsRouter from './routes/announcements';
import workspacesRouter from './routes/workspaces';
import pushRouter from './routes/push';
import filesRouter from './routes/files';
import featuresRouter from './routes/features';
import eventsRouter from './routes/events';
import { pushService } from './services/pushService';
import { workspaceService } from './services/workspaceService';
import { fileService } from './services/fileService';
import { conversationService } from './services/conversationService';
import { nodeService } from './services/nodeService';
import { aiService } from './services/aiService';
import { initScheduledJobs } from './jobs/scheduledJobs';

if (process.env.NODE_ENV !== 'production') {
  console.log('='.repeat(50));
  console.log('🚀 DeepMindMap Server Starting...');
  console.log('='.repeat(50));
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Working Directory: ${process.cwd()}`);
  console.log('='.repeat(50));
}

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'https:'],
      mediaSrc: ["'self'", 'data:'],
      frameAncestors: ["'none'"],
    },
  },
}));
const corsOrigins = config.cors.origins
  ? config.cors.origins.split(',').map((origin: string) => origin.trim())
  : ['http://127.0.0.1:3001', 'http://localhost:3001', 'http://127.0.0.1:5173', 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));
app.use(compression());
/**
 * 全局 JSON body 解析中间件
 * 默认限制 1MB，防止内存耗尽攻击
 * /api/ai 和 /api/conversations 路由需要更大的 limit（5MB），此处跳过由路由级中间件处理
 * 注意：若全局 express.json 先解析大 body 会直接返回 413，路由级中间件无法生效，
 *       因此对需要大 limit 的路径跳过全局解析，交由路由级 express.json 处理
 */
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // AI 对话和对话消息可能包含较大上下文，跳过全局 1MB 限制，由路由级中间件处理
  if (req.path.startsWith('/api/ai') || req.path.startsWith('/api/conversations')) {
    return next();
  }
  express.json({ limit: '1mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(requestLogger);
app.use(rateLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      neo4j: neo4jService.isConnected(),
      mongodb: mongoDBService.isConnected(),
      redis: redisService.isConnected(),
      vector: true,
    },
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'DeepMindMap API',
    version: '2.0.0',
    endpoints: {
      workspaces: '/api/workspaces',
      nodes: '/api/nodes',
      conversations: '/api/conversations',
      search: '/api/search',
      ai: '/api/ai',
      events: '/api/events',
    },
  });
});

/**
 * 路由级 JSON body limit 中间件
 * /api/ai 和 /api/conversations 路由需要更大的 payload 限制（5MB）
 * - /api/ai：AI 对话可能包含大上下文
 * - /api/conversations：对话消息可能较大
 * 必须在对应路由注册之前挂载，否则请求无法被正确解析
 * 注意：/api/files 走 multipart/form-data，不受 JSON limit 影响
 */
app.use('/api/conversations', express.json({ limit: '5mb' }));
app.use('/api/ai', express.json({ limit: '5mb' }));

app.use('/api/workspaces', workspacesRouter);
app.use('/api/push', pushRouter);
app.use('/api/files', filesRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/features', featuresRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/events', eventsRouter);

const internalApiToken = process.env.INTERNAL_API_TOKEN;

/**
 * 恒定时间比较内部 API token，防止时序攻击
 * @param inputToken - 请求头中传入的 token
 * @param expectedToken - 环境变量中配置的期望 token
 * @returns 是否匹配（长度不同直接返回 false，长度相同则使用恒定时间比较）
 */
function isTokenValid(
  inputToken: string | string[] | undefined,
  expectedToken: string | undefined
): boolean {
  if (typeof inputToken !== 'string' || typeof expectedToken !== 'string') {
    return false;
  }
  const inputBuffer = Buffer.from(inputToken);
  const expectedBuffer = Buffer.from(expectedToken);
  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

if (!internalApiToken) {
  console.warn('⚠️ INTERNAL_API_TOKEN 环境变量未设置，内部 API 路由已禁用');
} else {
  /**
   * 内部API：清除服务端缓存
   * Admin后台操作（封禁用户、关闭工作区、更新敏感词）后调用
   * 需要提供 x-internal-token 请求头
   */
  app.post('/api/internal/clear-cache', async (req, res) => {
    const internalToken = req.headers['x-internal-token'];
    if (!isTokenValid(internalToken, internalApiToken)) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    const { type, visitorId, workspaceId } = req.body;

    try {
      if (type === 'visitor' && visitorId) {
        workspaceService.clearVisitorCache(visitorId);
      } else if (type === 'workspace' && workspaceId) {
        workspaceService.clearWorkspaceCache(workspaceId);
      } else if (type === 'sensitive-word') {
        const { sensitiveWordService } = await import('./services/sensitiveWordService');
        sensitiveWordService.clearCache();
      } else {
        workspaceService.clearAllCache();
        const { sensitiveWordService } = await import('./services/sensitiveWordService');
        sensitiveWordService.clearCache();
      }

      res.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * 内部API：发送反馈处理结果推送通知
   * Admin后台更新反馈状态后调用
   * 需要提供 x-internal-token 请求头
   */
  app.post('/api/internal/push/feedback-notification', async (req, res) => {
    const internalToken = req.headers['x-internal-token'];
    if (!isTokenValid(internalToken, internalApiToken)) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    const { visitorId, feedbackTitle, newStatus } = req.body;

    if (!visitorId || !feedbackTitle || !newStatus) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    try {
      const result = await pushService.sendFeedbackNotification(visitorId, feedbackTitle, newStatus);
      res.json({ success: true, data: result ? { messageId: result._id?.toString() } : null });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[内部推送] 反馈推送失败:', message);
      res.status(500).json({ success: false, error: message });
    }
  });

  /**
   * 内部API：刷新 AI 模型配置
   * Admin后台修改模型配置后调用，触发主服务从 MongoDB 重新加载启用配置
   * 需要提供 x-internal-token 请求头
   */
  app.post('/api/internal/refresh-ai-models', async (req, res) => {
    const internalToken = req.headers['x-internal-token'];
    if (!isTokenValid(internalToken, internalApiToken)) {
      return res.status(403).json({ success: false, error: '无权访问' });
    }

    try {
      const loadedCount = await aiService.refreshModelConfigs();
      res.json({ success: true, data: { loadedCount } });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AI模型] 刷新配置失败:', message);
      res.status(500).json({ success: false, error: message });
    }
  });
}

/**
 * 413 Payload Too Large 错误处理中间件
 * 拦截 express.json 超出 limit 抛出的 PayloadTooLargeError（err.status === 413）
 * 必须在全局 errorHandler 之前挂载，因为 errorHandler 默认返回 500
 * @param err - 错误对象，可能包含 status 字段
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 * @param next - 下一个中间件函数
 */
app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.status === 413) {
    return res.status(413).json({
      success: false,
      error: '请求体过大，请减小请求内容',
    });
  }
  next(err);
});

app.use(errorHandler);

const clientDistPath = process.env.CLIENT_DIST_PATH || path.join(__dirname, '../../client/dist');
if (process.env.NODE_ENV !== 'production') {
  console.log('📂 Client dist path:', clientDistPath);
  console.log('📂 Client dist exists:', fs.existsSync(clientDistPath));
  console.log('📂 Current __dirname:', __dirname);
}

if (fs.existsSync(clientDistPath)) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('✅ Serving static files from:', clientDistPath);
  }
  app.use(express.static(clientDistPath));
  
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found',
      });
    }
    res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
      if (err) {
        next(err);
      }
    });
  });
} else {
  console.warn('⚠️ Client dist not found at:', clientDistPath);
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found',
      });
    }
    res.status(404).json({
      success: false,
      error: 'Client not built',
    });
  });
}

async function startServer() {
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ 配置校验失败，服务拒绝启动:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('');
      console.log('🔄 Connecting to databases...');
    }

    const dbConnections = await Promise.allSettled([
      neo4jService.connect(),
      mongoDBService.connect(),
      vectorDBService.initialize(),
    ]);

    const failedConnections = dbConnections.filter(r => r.status === 'rejected');
    if (failedConnections.length > 0) {
      console.warn(`⚠️ ${failedConnections.length} database connection(s) failed, continuing with limited functionality`);
      failedConnections.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.warn(`   - Connection ${index + 1}: ${result.reason}`);
        }
      });
    }

    const connectedCount = dbConnections.filter(r => r.status === 'fulfilled').length;
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ ${connectedCount}/3 database services connected`);
    }

    await redisService.initialize();
    if (process.env.NODE_ENV !== 'production') {
      console.log(`✅ Redis ${redisService.isConnected() ? 'connected' : 'not available'}`);
    }

    await pushService.initializeIndexes();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ 推送服务初始化完成');
    }

    await workspaceService.initialize();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ 工作区服务初始化完成');
    }

    await fileService.initialize();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ 文件服务初始化完成');
    }

    try {
      await conversationService.migrateMessages();
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ 消息迁移完成');
      }
    } catch (migrateError) {
      const migrateErrorMsg = migrateError instanceof Error ? migrateError.message : String(migrateError);
      console.error('⚠️ 消息迁移失败，服务继续运行:', migrateErrorMsg);
    }

    // 从数据库加载 AI 模型配置覆盖环境变量默认值（数据库无配置时回退到环境变量）
    try {
      await aiService.loadModelConfigsFromDB();
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ AI 模型配置加载完成');
      }
    } catch (aiModelError) {
      const aiModelErrMsg = aiModelError instanceof Error ? aiModelError.message : String(aiModelError);
      console.error('⚠️ AI 模型配置加载失败，使用环境变量默认值:', aiModelErrMsg);
    }

    try {
      await nodeService.syncNodesToMongoDB();
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ 节点元数据同步到MongoDB完成');
      }
    } catch (syncError) {
      const syncErrorMsg = syncError instanceof Error ? syncError.message : String(syncError);
      console.error('⚠️ 节点元数据同步失败，服务继续运行:', syncErrorMsg);
    }

    initScheduledJobs();

    const port = config.server.port;
    const host = '0.0.0.0';

    const server = app.listen(port, host, () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log('');
        console.log('='.repeat(50));
        console.log('🚀 DeepMindMap Server v2.0 Started Successfully');
        console.log('='.repeat(50));
        console.log(`📍 Address: http://${host}:${port}`);
        console.log(`⏰ Time: ${new Date().toLocaleString('zh-CN')}`);
        console.log('='.repeat(50));
        console.log('');
      }
    });

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🔄 Shutting down gracefully...');
  }
  try {
    await redisService.disconnect();
    await neo4jService.disconnect();
    await mongoDBService.disconnect();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Cleanup completed');
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🔄 Shutting down gracefully...');
  }
  try {
    await redisService.disconnect();
    await neo4jService.disconnect();
    await mongoDBService.disconnect();
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ Cleanup completed');
    }
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
  console.error('⚠️ 生产环境继续运行（uncaughtException）');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
  console.error('⚠️ 生产环境继续运行（unhandledRejection）');
});

startServer();

export default app;
