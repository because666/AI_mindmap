import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { getClientIp } from '../middleware/ipWhitelist';
import { AttackLog, AdminConfig } from '../types';

const router = Router();

const DEFAULT_QUESTION = process.env.SECRET_QUESTION || '世界上最帅的人是谁';
const DEFAULT_ANSWER = process.env.SECRET_ANSWER || '罗楚瑞';

/**
 * 获取安全配置
 * 优先从数据库读取，如果数据库中没有则使用环境变量默认值
 */
async function getSecurityConfig(): Promise<{ secretQuestion: string; secretAnswer: string; enableHoneypot: boolean }> {
  try {
    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    console.log('[HONEYPOT] 数据库查询结果:', JSON.stringify(adminConfig ? {
      hasSecurity: !!adminConfig.security,
      security: adminConfig.security,
    } : null));

    if (adminConfig?.security?.secretQuestion) {
      return adminConfig.security;
    }
  } catch (error) {
    console.error('[HONEYPOT] 数据库查询失败:', error);
  }

  console.log('[HONEYPOT] 使用环境变量默认值');
  return {
    secretQuestion: DEFAULT_QUESTION,
    secretAnswer: DEFAULT_ANSWER,
    enableHoneypot: true,
  };
}

/**
 * 获取当前攻击者的统计信息
 */
router.get('/my-stats', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const myLog = await adminDB.findOne<AttackLog>('attack_logs', { ipAddress: clientIp } as never);

    const totalAttackers = await adminDB.countDocuments('attack_logs', {});

    let rank = 0;
    if (totalAttackers > 0) {
      const allLogs = await adminDB.find('attack_logs', {} as never, {
        sort: { loginAttempts: -1 },
        limit: 100,
      });
      rank = allLogs.findIndex((log: Record<string, unknown>) => log.ipAddress === clientIp) + 1;
    }

    res.json({
      success: true,
      data: {
        ipAddress: clientIp,
        loginAttempts: myLog?.loginAttempts || 0,
        attemptedPasswords: myLog?.attemptedPasswords || [],
        firstAttemptAt: myLog?.firstAttemptAt || null,
        lastAttemptAt: myLog?.lastAttemptAt || null,
        totalAttackers,
        rank: rank > 0 ? rank : totalAttackers + 1,
      },
    });
  } catch (error) {
    console.error('获取蜜罐统计失败:', error);
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

/**
 * 获取最近攻击日志
 */
router.get('/recent-logs', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

    const logs = await adminDB.find('attack_logs', {} as never, {
      sort: { lastAttemptAt: -1 },
      limit,
    });

    const sanitizedLogs = logs.map((log: Record<string, unknown>) => ({
      ipAddress: maskIp(log.ipAddress as string),
      loginAttempts: log.loginAttempts,
      attemptedPasswords: (log.attemptedPasswords as string[])?.slice(0, 3) || [],
      firstAttemptAt: log.firstAttemptAt,
      lastAttemptAt: log.lastAttemptAt,
    }));

    const totalAttackers = await adminDB.countDocuments('attack_logs', {});
    const totalAttempts = logs.reduce((sum: number, log: Record<string, unknown>) => sum + (log.loginAttempts as number || 0), 0);

    const topPasswords = await getTopPasswords();

    res.json({
      success: true,
      data: {
        logs: sanitizedLogs,
        totalAttackers,
        totalAttempts,
        topPasswords,
      },
    });
  } catch (error) {
    console.error('获取攻击日志失败:', error);
    res.status(500).json({ success: false, error: '获取日志失败' });
  }
});

/**
 * 验证秘密问题答案
 */
router.post('/verify-question', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);
    const { answer } = req.body;

    if (!answer) {
      res.status(400).json({ success: false, error: '请输入答案' });
      return;
    }

    const security = await getSecurityConfig();

    if (answer.trim() !== security.secretAnswer.trim()) {
      res.status(401).json({ success: false, error: '答案错误' });
      return;
    }

    try {
      await adminDB.updateOne('attack_logs', { ipAddress: clientIp } as never, {
        $set: {
          isSolvedQuestion: true,
          questionAnswerAt: new Date(),
        },
      });
    } catch {
      // 记录失败不影响验证结果
    }

    res.json({
      success: true,
      message: '验证通过',
      question: security.secretQuestion,
    });
  } catch (error) {
    console.error('验证问题失败:', error);
    res.status(500).json({ success: false, error: '验证失败' });
  }
});

/**
 * 获取秘密问题
 * 优先从数据库读取，回退到环境变量
 */
router.get('/question', async (_req: Request, res: Response) => {
  try {
    const security = await getSecurityConfig();
    res.json({
      success: true,
      data: {
        question: security.secretQuestion,
        enableHoneypot: security.enableHoneypot,
      },
    });
  } catch (error) {
    console.error('获取问题失败:', error);
    res.json({
      success: true,
      data: {
        question: DEFAULT_QUESTION,
        enableHoneypot: true,
      },
    });
  }
});

/**
 * 调试端点 - 返回数据库原始查询结果
 * 用于排查数据库连接问题
 */
router.get('/debug', async (_req: Request, res: Response) => {
  try {
    const dbStatus = adminDB.isConnected();
    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    const allConfigs = await adminDB.find('admin_configs', {} as never, { limit: 10 });
    const attackLogCount = await adminDB.countDocuments('attack_logs', {});

    res.json({
      success: true,
      data: {
        dbConnected: dbStatus,
        envQuestion: DEFAULT_QUESTION,
        envAnswer: DEFAULT_ANSWER ? '***已设置***' : '未设置',
        configCount: allConfigs.length,
        firstConfig: adminConfig ? {
          hasSecurity: !!adminConfig.security,
          security: adminConfig.security || null,
          hasPasswordHash: !!adminConfig.passwordHash,
        } : null,
        allConfigIds: allConfigs.map((c: Record<string, unknown>) => c._id?.toString()),
        attackLogCount,
      },
    });
  } catch (error) {
    console.error('调试查询失败:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      envQuestion: DEFAULT_QUESTION,
    });
  }
});

/**
 * 获取完整攻击日志（管理员用）
 */
router.get('/admin/attack-logs', async (req: Request, res: Response) => {
  try {
    const sessionId = req.session?.sessionId;
    if (!sessionId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const logs = await adminDB.find('attack_logs', {} as never, {
      sort: { lastAttemptAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('attack_logs', {});

    res.json({
      success: true,
      data: {
        items: logs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('获取攻击日志失败:', error);
    res.status(500).json({ success: false, error: '获取日志失败' });
  }
});

/**
 * 更新安全配置（管理员用）
 */
router.put('/admin/security-config', async (req: Request, res: Response) => {
  try {
    const sessionId = req.session?.sessionId;
    if (!sessionId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const { secretQuestion, secretAnswer, enableHoneypot } = req.body;

    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    const updateFields: Record<string, unknown> = {};
    if (secretQuestion !== undefined) updateFields['security.secretQuestion'] = secretQuestion;
    if (secretAnswer !== undefined) updateFields['security.secretAnswer'] = secretAnswer;
    if (enableHoneypot !== undefined) updateFields['security.enableHoneypot'] = enableHoneypot;

    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $set: updateFields,
    });

    res.json({ success: true, message: '安全配置已更新' });
  } catch (error) {
    console.error('更新安全配置失败:', error);
    res.status(500).json({ success: false, error: '更新配置失败' });
  }
});

/**
 * 删除攻击日志（管理员用）
 */
router.delete('/admin/attack-logs', async (req: Request, res: Response) => {
  try {
    const sessionId = req.session?.sessionId;
    if (!sessionId) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const { ipAddress } = req.body;
    if (ipAddress) {
      await adminDB.deleteOne('attack_logs', { ipAddress } as never);
    } else {
      await adminDB.deleteMany('attack_logs', {} as never);
    }

    res.json({ success: true, message: '日志已删除' });
  } catch (error) {
    console.error('删除攻击日志失败:', error);
    res.status(500).json({ success: false, error: '删除日志失败' });
  }
});

function maskIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*${parts[3].slice(-2)}`;
  }
  if (ip.includes(':')) {
    const ipv6Parts = ip.split(':');
    return `${ipv6Parts[0]}:${ipv6Parts[1]}:****:${ipv6Parts[ipv6Parts.length - 1]}`;
  }
  return '***.***.***.***';
}

async function getTopPasswords(): Promise<Array<{ password: string; count: number }>> {
  const logs = await adminDB.find('attack_logs', {} as never, { limit: 1000 });
  const passwordCount: Record<string, number> = {};

  for (const log of logs) {
    const passwords = (log as Record<string, unknown>).attemptedPasswords as string[] || [];
    for (const pwd of passwords) {
      passwordCount[pwd] = (passwordCount[pwd] || 0) + 1;
    }
  }

  return Object.entries(passwordCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([password, count]) => ({ password, count }));
}

export default router;
