import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { adminDB } from '../config/database';
import { config } from '../config';
import { AdminConfig, AdminSession } from '../types';
import { getClientIp } from '../middleware/ipWhitelist';
import { loginLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * 检查系统状态
 * 返回是否需要初始化、是否已设置密码
 */
router.get('/check-ip', async (_req: Request, res: Response) => {
  try {
    const hasPwd = await hasPasswordSet();
    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    const isFirstVisit = !adminConfig;

    res.json({
      allowed: true,
      isFirstVisit,
      hasPassword: hasPwd,
      nickname: '',
      message: isFirstVisit ? '首次访问，请初始化管理员系统' : '请输入密码登录',
    });
  } catch (error) {
    console.error('检查系统状态失败:', error);
    res.json({
      allowed: true,
      isFirstVisit: true,
      hasPassword: false,
    });
  }
});

/**
 * 初始化第一个管理员
 * 当admin_configs集合为空时，允许设置密码
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    const existingConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    if (existingConfig) {
      res.status(400).json({ success: false, error: '系统已初始化，不可重复初始化' });
      return;
    }

    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) {
      res.status(400).json({ success: false, error: '请输入密码和确认密码' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ success: false, error: '两次密码不一致' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码长度不能少于6位' });
      return;
    }

    const passwordHash = await bcryptjs.hash(password, config.security.bcryptRounds);
    await adminDB.insertOne('admin_configs', {
      passwordHash,
      passwordUpdatedAt: new Date(),
      loginAttempts: [],
      features: {
        sensitiveWordCheck: true,
        auditLog: true,
        dataExport: true,
      },
      updatedAt: new Date(),
    });

    res.json({
      success: true,
      message: '管理员系统初始化成功',
    });
  } catch (error) {
    console.error('初始化管理员失败:', error);
    res.status(500).json({ success: false, error: '初始化失败' });
  }
});

/**
 * 登录
 * 使用原子操作记录登录失败，避免竞态条件
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, error: '请输入密码' });
      return;
    }

    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    const isLocked = await checkLoginLock(clientIp, adminConfig);
    if (isLocked) {
      res.status(429).json({ success: false, error: '登录失败次数过多，请稍后再试' });
      return;
    }

    const passwordMatch = await bcryptjs.compare(password, adminConfig.passwordHash);
    if (!passwordMatch) {
      await recordLoginFailureAtomic(clientIp);
      res.status(401).json({ success: false, error: '密码错误' });
      return;
    }

    await clearLoginFailuresAtomic(clientIp);

    const sessionId = uuidv4();
    await adminDB.insertOne('admin_sessions', {
      sessionId,
      ipAddress: clientIp,
      nickname: '管理员',
      userAgent: req.headers['user-agent'] || '',
      createdAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    });

    if (req.session) {
      req.session.sessionId = sessionId;
    }

    res.json({
      success: true,
      needNickname: false,
      sessionId,
      nickname: '管理员',
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

/**
 * 设置昵称
 */
router.post('/set-nickname', async (req: Request, res: Response) => {
  try {
    const { nickname } = req.body;

    if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 20) {
      res.status(400).json({ success: false, error: '昵称长度应为2-20个字符' });
      return;
    }

    const sessionId = req.session?.sessionId;
    if (!sessionId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    await adminDB.updateOne('admin_sessions', { sessionId } as never, {
      $set: { nickname: nickname.trim() },
    });

    res.json({ success: true, nickname: nickname.trim() });
  } catch (error) {
    console.error('设置昵称失败:', error);
    res.status(500).json({ success: false, error: '设置昵称失败' });
  }
});

/**
 * 登出
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const sessionId = req.session?.sessionId;
    if (sessionId) {
      await adminDB.updateOne('admin_sessions', { sessionId } as never, {
        $set: { isActive: false },
      });
      req.session?.destroy((err) => {
        if (err) console.error('Session销毁失败:', err);
      });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('登出失败:', error);
    res.status(500).json({ success: false, error: '登出失败' });
  }
});

/**
 * 获取当前管理员信息
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const sessionId = req.session?.sessionId;
    if (!sessionId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const session = await adminDB.findOne<AdminSession>('admin_sessions', {
      sessionId,
      isActive: true,
    } as never);

    if (!session) {
      res.status(401).json({ success: false, error: '会话已过期' });
      return;
    }

    res.json({
      ipAddress: session.ipAddress,
      nickname: session.nickname,
      loginAt: session.createdAt,
    });
  } catch (error) {
    console.error('获取管理员信息失败:', error);
    res.status(500).json({ success: false, error: '获取信息失败' });
  }
});

async function hasPasswordSet(): Promise<boolean> {
  const cfg = await adminDB.findOne<AdminConfig>('admin_configs', {});
  return !!cfg?.passwordHash;
}

async function checkLoginLock(ip: string, adminConfig: AdminConfig): Promise<boolean> {
  const attempt = adminConfig.loginAttempts.find((a) => a.ipAddress === ip);
  if (!attempt) return false;
  if (attempt.lockedUntil && new Date(attempt.lockedUntil) > new Date()) return true;
  return false;
}

/**
 * 原子操作记录登录失败
 * 使用$inc和$push避免先读后写的竞态条件
 */
async function recordLoginFailureAtomic(ip: string): Promise<void> {
  const now = new Date();
  const lockUntil = new Date(now.getTime() + config.security.loginLockDuration);

  const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
  if (!adminConfig) return;

  const existing = adminConfig.loginAttempts.find((a) => a.ipAddress === ip);
  if (existing) {
    const windowStart = new Date(now.getTime() - config.security.loginAttemptsWindow);
    const isInWindow = new Date(existing.lastAttemptAt) >= windowStart;
    const newAttempts = isInWindow ? existing.attempts + 1 : 1;

    const updateFields: Record<string, unknown> = {
      'loginAttempts.$.lastAttemptAt': now,
      'loginAttempts.$.attempts': newAttempts,
    };

    if (newAttempts >= config.security.loginAttemptsMax) {
      updateFields['loginAttempts.$.lockedUntil'] = lockUntil;
    }

    await adminDB.updateOne('admin_configs', {
      _id: adminConfig._id,
      'loginAttempts.ipAddress': ip,
    } as never, {
      $set: updateFields,
    });
  } else {
    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $push: {
        loginAttempts: {
          ipAddress: ip,
          attempts: 1,
          lastAttemptAt: now,
        },
      } as never,
    });
  }
}

/**
 * 原子操作清除登录失败记录
 * 使用$pull避免先读后写的竞态条件
 */
async function clearLoginFailuresAtomic(ip: string): Promise<void> {
  const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
  if (!adminConfig) return;

  await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
    $pull: { loginAttempts: { ipAddress: ip } } as never,
  });
}

export default router;
