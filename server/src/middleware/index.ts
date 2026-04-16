import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { workspaceService } from '../services/workspaceService';

export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: '请求过于频繁，请稍后再试',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 访客鉴权中间件
 * 从请求头中获取 X-Visitor-Id，验证访客身份
 * 必须提供有效的 visitorId
 */
export const visitorAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;

  if (!visitorId) {
    return res.status(401).json({
      success: false,
      error: '缺少访客标识，请先注册',
    });
  }

  const visitor = await workspaceService.getVisitor(visitorId);
  if (!visitor) {
    return res.status(401).json({
      success: false,
      error: '访客标识无效，请重新注册',
    });
  }

  req.visitorId = visitorId;
  next();
};

/**
 * 可选访客鉴权中间件
 * 如果提供了 X-Visitor-Id 则验证，否则继续
 */
export const optionalVisitorAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;

  if (visitorId) {
    const visitor = await workspaceService.getVisitor(visitorId);
    if (visitor) {
      req.visitorId = visitorId;
    }
  }

  next();
};

/**
 * 工作区成员鉴权中间件
 * 验证访客是否为指定工作区的成员
 * 需要路由参数中包含 workspaceId 或请求体中包含 workspaceId
 */
export const workspaceMemberAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.headers['x-workspace-id'] as string;

  if (!visitorId) {
    return res.status(401).json({
      success: false,
      error: '缺少访客标识',
    });
  }

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      error: '缺少工作区标识',
    });
  }

  const visitor = await workspaceService.getVisitor(visitorId);
  if (!visitor) {
    return res.status(401).json({
      success: false,
      error: '访客标识无效',
    });
  }

  const isMember = await workspaceService.isMember(workspaceId, visitorId);
  if (!isMember) {
    return res.status(403).json({
      success: false,
      error: '无权访问该工作区',
    });
  }

  req.visitorId = visitorId;
  req.workspaceId = workspaceId;
  next();
};

/**
 * 工作区Owner鉴权中间件
 * 验证访客是否为指定工作区的创建者
 */
export const workspaceOwnerAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.headers['x-workspace-id'] as string;

  if (!visitorId) {
    return res.status(401).json({
      success: false,
      error: '缺少访客标识',
    });
  }

  if (!workspaceId) {
    return res.status(400).json({
      success: false,
      error: '缺少工作区标识',
    });
  }

  const role = await workspaceService.getMemberRole(workspaceId, visitorId);
  if (role !== 'owner') {
    return res.status(403).json({
      success: false,
      error: '只有工作区创建者可以执行此操作',
    });
  }

  req.visitorId = visitorId;
  req.workspaceId = workspaceId;
  next();
};

export const errorHandler = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('错误:', err.message);
  console.error('堆栈:', err.stack);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err.message,
  });
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
};

declare global {
  namespace Express {
    interface Request {
      visitorId?: string;
      workspaceId?: string;
    }
  }
}
