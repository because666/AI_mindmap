import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { 
  rateLimiter, 
  errorHandler, 
  requestLogger 
} from './middleware';
import { neo4jService } from './data/neo4j/connection';
import { mongoDBService } from './data/mongodb/connection';
import { vectorDBService } from './data/vector/connection';

import nodesRouter from './routes/nodes';
import conversationsRouter from './routes/conversations';
import searchRouter from './routes/search';
import aiRouter from './routes/ai';
import workspacesRouter from './routes/workspaces';
import pushRouter from './routes/push';
import filesRouter from './routes/files';
import { pushService } from './services/pushService';
import { workspaceService } from './services/workspaceService';
import { fileService } from './services/fileService';
import { initScheduledJobs } from './jobs/scheduledJobs';

console.log('='.repeat(50));
console.log('🚀 DeepMindMap Server Starting...');
console.log('='.repeat(50));
console.log(`📅 Time: ${new Date().toISOString()}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`📁 Working Directory: ${process.cwd()}`);
console.log('='.repeat(50));

const app = express();

app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(requestLogger);
app.use(rateLimiter);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      neo4j: neo4jService.isConnected(),
      mongodb: mongoDBService.isConnected(),
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
    },
  });
});

app.use('/api/workspaces', workspacesRouter);
app.use('/api/push', pushRouter);
app.use('/api/files', filesRouter);
app.use('/api/nodes', nodesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/search', searchRouter);
app.use('/api/ai', aiRouter);

/**
 * 内部API：清除服务端缓存
 * Admin后台操作（封禁用户、关闭工作区、更新敏感词）后调用
 * 需要提供 x-internal-token 请求头
 */
app.post('/api/internal/clear-cache', async (req, res) => {
  const internalToken = req.headers['x-internal-token'];
  if (internalToken !== process.env.INTERNAL_API_TOKEN) {
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

app.use(errorHandler);

const clientDistPath = process.env.CLIENT_DIST_PATH || path.join(__dirname, '../../client/dist');
console.log('📂 Client dist path:', clientDistPath);
console.log('📂 Client dist exists:', fs.existsSync(clientDistPath));
console.log('📂 Current __dirname:', __dirname);

if (fs.existsSync(clientDistPath)) {
  console.log('✅ Serving static files from:', clientDistPath);
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
    console.log('');
    console.log('🔄 Connecting to databases...');
    
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
    console.log(`✅ ${connectedCount}/3 database services connected`);
    
    await pushService.initializeIndexes();
    console.log('✅ 推送服务初始化完成');
    
    await workspaceService.initialize();
    console.log('✅ 工作区服务初始化完成');
    
    await fileService.initialize();
    console.log('✅ 文件服务初始化完成');
    
    initScheduledJobs();
    
    const port = config.server.port;
    const host = '0.0.0.0';
    
    const server = app.listen(port, host, () => {
      console.log('');
      console.log('='.repeat(50));
      console.log('🚀 DeepMindMap Server v2.0 Started Successfully');
      console.log('='.repeat(50));
      console.log(`📍 Address: http://${host}:${port}`);
      console.log(`⏰ Time: ${new Date().toLocaleString('zh-CN')}`);
      console.log('='.repeat(50));
      console.log('');
    });

    server.on('error', (error: any) => {
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
  console.log('\n🔄 Shutting down gracefully...');
  try {
    await neo4jService.disconnect();
    await mongoDBService.disconnect();
    console.log('✅ Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Shutting down gracefully...');
  try {
    await neo4jService.disconnect();
    await mongoDBService.disconnect();
    console.log('✅ Cleanup completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();

export default app;
