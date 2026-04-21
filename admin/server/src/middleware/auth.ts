import { Request, Response, NextFunction } from 'express';
import { adminDB } from '../config/database';
import { AdminSession } from '../types';

/**
 * 认证中间件
 * 检查请求是否携带有效的Session
 * Session通过HTTPOnly Cookie传递
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessionId = (req as Request & { session?: { sessionId?: string } }).session?.sessionId;

    if (!sessionId) {
      res.status(401).json({ success: false, error: '未登录，请先登录' });
      return;
    }

    const session = await adminDB.findOne<AdminSession>('admin_sessions', {
      sessionId,
      isActive: true,
    } as never);

    if (!session) {
      res.status(401).json({ success: false, error: '会话已过期，请重新登录' });
      return;
    }

    const now = new Date();
    const lastActivity = new Date(session.lastActivityAt);
    const inactiveMs = now.getTime() - lastActivity.getTime();
    if (inactiveMs > 24 * 60 * 60 * 1000) {
      await adminDB.updateOne('admin_sessions', { sessionId } as never, {
        $set: { isActive: false },
      });
      res.status(401).json({ success: false, error: '会话已过期，请重新登录' });
      return;
    }

    await adminDB.updateOne('admin_sessions', { sessionId } as never, {
      $set: { lastActivityAt: new Date() },
    });

    (req as unknown as Record<string, unknown>).adminIp = session.ipAddress;
    (req as unknown as Record<string, unknown>).adminNickname = session.nickname;
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({ success: false, error: '认证检查失败' });
  }
}
