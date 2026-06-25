import { Request, Response, NextFunction } from 'express';
import { adminDB } from '../config/database';
import { AdminRole, AdminSession } from '../types';

/**
 * 认证中间件
 * 检查请求是否携带有效的Session
 * Session通过HTTPOnly Cookie传递
 * 同时将管理员IP和昵称挂载到请求对象上
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
    if (session.role) {
      (req as unknown as Record<string, unknown>).adminRole = session.role;
    }
    next();
  } catch (error) {
    console.error('认证中间件错误:', error);
    res.status(500).json({ success: false, error: '认证检查失败' });
  }
}

/**
 * 角色校验中间件工厂函数
 * 从请求对象中读取当前管理员的角色，校验是否在允许的角色列表中
 * 必须在 requireAuth 之后使用，依赖 requireAuth 设置的 adminRole 属性
 * @param roles - 允许访问的角色列表，至少传入一个角色
 * @returns Express 中间件函数
 * @example
 *   router.post('/', requireAuth, requireRole('super_admin'), handler)
 *   router.get('/', requireAuth, requireRole('super_admin', 'operator'), handler)
 */
export function requireRole(...roles: AdminRole[]): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const adminRole = (req as unknown as Record<string, unknown>).adminRole as AdminRole | undefined;

    if (!adminRole) {
      res.status(403).json({ success: false, error: '当前账户未分配角色，无权访问' });
      return;
    }

    if (!roles.includes(adminRole)) {
      res.status(403).json({ success: false, error: '权限不足，无法执行此操作' });
      return;
    }

    next();
  };
}
