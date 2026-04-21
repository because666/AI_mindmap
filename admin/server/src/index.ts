import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';
import session from 'express-session';
import { config } from './config';
import { adminDB } from './config/database';
import { apiLimiter } from './middleware/rateLimit';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import usersRouter from './routes/users';
import workspacesRouter from './routes/workspaces';
import chatAuditRouter from './routes/chatAudit';
import pushRouter from './routes/push';
import settingsRouter from './routes/settings';
import exportRouter from './routes/export';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('combined'));

app.use('/api', apiLimiter);

app.use(session({
  secret: config.session.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: config.session.maxAge,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}));

app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin/users', usersRouter);
app.use('/api/admin/workspaces', workspacesRouter);
app.use('/api/admin/audit', chatAuditRouter);
app.use('/api/admin/push', pushRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/admin/export', exportRouter);

/**
 * 健康检查端点
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * 404 处理 - 返回 JSON 而不是 HTML
 */
app.use('/api/*', (_req, res) => {
  res.status(404).json({ success: false, error: 'API端点不存在' });
});

async function start() {
  if (!config.session.secret || config.session.secret === 'deepmindmap-admin-session-secret') {
    console.error('❌ 安全警告：SESSION_SECRET未设置或使用默认值，请配置环境变量');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  try {
    await adminDB.connect();
    console.log('✅ 后台系统数据库连接成功');

    app.listen(config.server.port, config.server.host, () => {
      console.log(`🚀 DeepMindMap 后台管理系统已启动`);
      console.log(`   地址: http://${config.server.host}:${config.server.port}`);
      console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ 后台系统启动失败:', error);
    process.exit(1);
  }
}

start();

export default app;
