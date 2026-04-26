import { Request } from 'express';

/**
 * 获取客户端真实IP地址
 * 支持代理服务器场景下的IP获取
 * @param req - Express请求对象
 * @returns 客户端IP地址
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}
