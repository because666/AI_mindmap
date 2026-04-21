import { Request, Response, NextFunction } from 'express';
import { adminDB } from '../config/database';
import { AuditLog } from '../types';

/**
 * 审计日志中间件
 * 记录所有管理操作的审计日志
 * @param action - 操作类型
 * @param targetType - 目标类型
 */
export function auditLog(action: string, targetType: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      const logEntry: Omit<AuditLog, '_id'> = {
        timestamp: new Date(),
        adminNickname: (req as Request & { adminNickname?: string }).adminNickname || 'unknown',
        adminIp: (req as Request & { adminIp?: string }).adminIp || 'unknown',
        action,
        targetType,
        targetId: req.params.id || req.params.ip,
        details: {
          method: req.method,
          path: req.originalUrl,
          body: req.body ? sanitizeBody(req.body) : undefined,
        },
        result: body && typeof body === 'object' && 'success' in (body as Record<string, unknown>)
          ? ((body as Record<string, unknown>).success ? 'success' : 'failed')
          : 'success',
      };

      adminDB.insertOne('audit_logs', logEntry).catch((err) => {
        console.error('审计日志写入失败:', err);
      });

      return originalJson(body);
    };

    next();
  };
}

/**
 * 清理请求体中的敏感字段
 * @param body - 请求体
 * @returns 清理后的请求体
 */
function sanitizeBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized = { ...body };
  const sensitiveKeys = ['password', 'oldPassword', 'newPassword', 'confirmPassword', 'token', 'secret'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '******';
    }
  }
  return sanitized;
}
