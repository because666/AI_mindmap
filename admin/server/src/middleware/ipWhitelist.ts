import { Request, Response, NextFunction } from 'express';
import { adminDB } from '../config/database';
import { AdminIP } from '../types';

/**
 * 获取客户端真实IP地址
 * 支持代理服务器场景下的IP获取
 * @param req - Express请求对象
 * @returns 客户端IP地址
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * IP白名单检查中间件
 * 请求IP必须在admin_ips集合中才允许访问
 * 非白名单IP直接返回403
 */
export async function ipWhitelist(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientIp = getClientIp(req);
    const adminIp = await adminDB.findOne<AdminIP>('admin_ips', {
      ipAddress: clientIp,
      isActive: true,
    } as never);

    if (!adminIp) {
      res.status(403).json({
        success: false,
        error: 'IP地址不在白名单中',
        ipAddress: clientIp,
      });
      return;
    }

    (req as Request & { adminIp?: string; adminNickname?: string }).adminIp = clientIp;
    (req as Request & { adminIp?: string; adminNickname?: string }).adminNickname = adminIp.nickname;
    next();
  } catch (error) {
    console.error('IP白名单检查失败:', error);
    res.status(500).json({ success: false, error: '白名单检查失败' });
  }
}

/**
 * 仅IP白名单检查（不要求登录Session）
 * 用于登录前的检查接口
 */
export async function ipWhitelistOnly(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clientIp = getClientIp(req);
    const adminIp = await adminDB.findOne<AdminIP>('admin_ips', {
      ipAddress: clientIp,
      isActive: true,
    } as never);

    if (!adminIp) {
      res.status(403).json({
        success: false,
        error: 'IP地址不在白名单中',
        ipAddress: clientIp,
      });
      return;
    }

    (req as Request & { adminIp?: string; adminNickname?: string }).adminIp = clientIp;
    next();
  } catch (error) {
    console.error('IP白名单检查失败:', error);
    res.status(500).json({ success: false, error: '白名单检查失败' });
  }
}

export { getClientIp };
