import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import helmet from 'helmet';
import session from 'express-session';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';
import { config } from './config';
import { adminDB } from './config/database';
import { initializeRedis, disconnectRedis } from './data/redis';
import { apiLimiter } from './middleware/rateLimit';
import { ipWhitelistMiddleware } from './middleware/ipWhitelist';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import usersRouter from './routes/users';
import workspacesRouter from './routes/workspaces';
import chatAuditRouter from './routes/chatAudit';
import pushRouter from './routes/push';
import settingsRouter from './routes/settings';
import exportRouter from './routes/export';
import honeypotRouter from './routes/honeypot';
import ipBansRouter from './routes/ipBans';
import feedbacksRouter from './routes/feedbacks';
import aiUsageRouter from './routes/aiUsage';
import aiModelsRouter from './routes/aiModels';
import auditLogsRouter from './routes/auditLogs';
import adminAccountsRouter from './routes/adminAccounts';
import userSegmentsRouter from './routes/userSegments';
import searchRouter from './routes/search';
import announcementsRouter from './routes/announcements';

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

/**
 * 健康检查端点
 * 放在 IP 白名单中间件之前，确保健康检查不受白名单限制
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 认证相关路由（登录、初始化、检查 IP 等）不受 IP 白名单限制
// 否则首次初始化或管理员更换 IP 后将无法登录后台
app.use('/api/auth', authRouter);

// IP 白名单中间件：在认证路由之后注册，仅保护管理后台 API
app.use('/api/admin', ipWhitelistMiddleware);
app.use('/api/dashboard', ipWhitelistMiddleware);
app.use('/api/honeypot', honeypotRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin/users', usersRouter);
app.use('/api/admin/workspaces', workspacesRouter);
app.use('/api/admin/audit', chatAuditRouter);
app.use('/api/admin/push', pushRouter);
app.use('/api/admin/settings', settingsRouter);
app.use('/api/admin/export', exportRouter);
app.use('/api/admin/ip-bans', ipBansRouter);
app.use('/api/admin/feedbacks', feedbacksRouter);
app.use('/api/admin/ai-usage', aiUsageRouter);
app.use('/api/admin/ai-models', aiModelsRouter);
app.use('/api/admin/audit-logs', auditLogsRouter);
app.use('/api/admin/admin-accounts', adminAccountsRouter);
app.use('/api/admin/user-segments', userSegmentsRouter);
app.use('/api/admin/announcements', announcementsRouter);
app.use('/api/admin/search', searchRouter);

/**
 * 404 处理 - 返回 JSON 而不是 HTML
 */
app.use('/api/*', (_req, res) => {
  res.status(404).json({ success: false, error: 'API端点不存在' });
});

async function start() {
  if (!process.env.SESSION_SECRET) {
    console.warn('⚠️ 安全警告：SESSION_SECRET环境变量未设置，已使用随机密钥（重启后已登录用户session将失效），建议配置SESSION_SECRET环境变量');
  }

  try {
    await adminDB.connect();
    console.log('✅ 后台系统数据库连接成功');

    await initializeRedis();

    await autoInitAdmin();

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

process.on('SIGINT', async () => {
  console.log('🔄 正在关闭后台系统...');
  await disconnectRedis();
  await adminDB.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🔄 正在关闭后台系统...');
  await disconnectRedis();
  await adminDB.disconnect();
  process.exit(0);
});

async function autoInitAdmin() {
  try {
    const existingConfig = await adminDB.findOne('admin_configs', {});
    if (existingConfig) return;

    // 读取管理员初始密码：未配置环境变量时生成随机临时密码（仅用于首次启动），避免使用弱默认密码
    const envPassword = process.env.ADMIN_INIT_PASSWORD;
    let defaultPassword: string;
    if (envPassword) {
      defaultPassword = envPassword;
    } else {
      console.error('❌ 安全警告：ADMIN_INIT_PASSWORD环境变量未配置，已生成随机临时密码，请登录后立即修改！');
      defaultPassword = crypto.randomBytes(16).toString('hex');
    }
    const passwordHash = await bcryptjs.hash(defaultPassword, config.security.bcryptRounds);

    await adminDB.insertOne('admin_configs', {
      passwordHash,
      passwordUpdatedAt: new Date(),
      loginAttempts: [],
      features: {
        sensitiveWordCheck: true,
        auditLog: true,
        dataExport: true,
      },
      security: {
        secretQuestion: process.env.SECRET_QUESTION || '世界上最帅的人是谁',
        secretAnswer: process.env.SECURITY_ANSWER || '',
        enableHoneypot: true,
      },
      updatedAt: new Date(),
    });

    console.log('✅ 首次启动自动初始化完成');
    console.log(`   管理员密码: ${defaultPassword}`);
    console.log(`   安全问题: ${process.env.SECRET_QUESTION || '世界上最帅的人是谁'}`);
    console.log('   请登录后在设置中修改安全问题');
  } catch (error) {
    console.warn('⚠️ 自动初始化跳过:', error);
  }
}

start();

export default app;
