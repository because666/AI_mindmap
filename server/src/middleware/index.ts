import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { config } from '../config';
import { workspaceService } from '../services/workspaceService';
import { mongoDBService } from '../data/mongodb/connection';

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
 * 获取客户端真实IP地址
 * 支持Nginx反向代理和Cloudflare CDN场景
 * @param req - Express请求对象
 * @returns 客户端IP地址
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'] as string | undefined;
  if (cfIp) return cfIp.trim();

  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }

  const realIp = req.headers['x-real-ip'] as string | undefined;
  if (realIp) return realIp.trim();

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * 检查IP是否被封禁
 * 查询ip_bans集合，检查IP是否在封禁列表中且未过期
 * @param ip - 客户端IP地址
 * @returns 封禁信息或null
 */
async function checkIpBan(ip: string): Promise<{ reason: string; expiresAt?: Date } | null> {
  if (!ip || ip === 'unknown') return null;

  const ban = await mongoDBService.findOne<{ ip: string; reason: string; banExpiresAt?: Date; bannedAt: Date }>('ip_bans', {
    ip,
  } as never);

  if (!ban) return null;

  if (ban.banExpiresAt && new Date(ban.banExpiresAt) < new Date()) {
    await mongoDBService.deleteOne('ip_bans', { ip } as never);
    return null;
  }

  return { reason: ban.reason, expiresAt: ban.banExpiresAt };
}

/**
 * 更新访客IP记录
 * 更新lastIp并将新IP添加到ipHistory（去重，最多10个）
 * @param visitorId - 访客ID
 * @param ip - 客户端IP地址
 */
async function updateVisitorIp(visitorId: string, ip: string): Promise<void> {
  if (!ip || ip === 'unknown') return;

  const visitor = await workspaceService.getVisitor(visitorId);
  if (!visitor) return;

  if (visitor.lastIp === ip) return;

  const ipHistory: string[] = visitor.ipHistory || [];
  const updatedHistory = [ip, ...ipHistory.filter(h => h !== ip)].slice(0, 10);

  await mongoDBService.updateOne('visitors', { id: visitorId } as never, {
    $set: { lastIp: ip, ipHistory: updatedHistory },
  });
  workspaceService.clearVisitorCache(visitorId);
}

/**
 * 访客签名有效期（5分钟）
 * 时间戳与服务器当前时间差超过此值则认为签名过期
 */
const VISITOR_TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * 访客签名校验结果
 */
type VisitorSignatureResult =
  | { valid: true }
  | { valid: false; error: string; code: 'AUTH_FAILED' | 'AUTH_EXPIRED' | 'AUTH_MISSING' };

/**
 * 判断当前是否为开发环境（非生产环境）
 * 开发环境允许无签名请求通过，便于本地调试
 * @returns 是否为开发环境
 */
function isDevEnvironment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * 校验访客请求签名
 * 使用 HMAC-SHA256 算法，以 visitorSecret 为密钥对 `${visitorId}:${timestamp}` 进行签名
 * 校验规则：
 * 1. 开发环境（NODE_ENV !== 'production'）允许无签名请求通过
 * 2. 生产环境强制要求 X-Visitor-Token 和 X-Visitor-Ts
 * 3. 时间戳与服务器时间差超过 5 分钟则认为过期
 * 4. 使用 crypto.timingSafeEqual 防止时序攻击
 * @param visitorId - 访客ID
 * @param visitorSecret - 访客签名密钥
 * @param token - 请求头中的 X-Visitor-Token（HMAC 签名 hex）
 * @param ts - 请求头中的 X-Visitor-Ts（时间戳字符串）
 * @returns 校验结果，valid 为 true 表示通过，否则包含错误信息
 */
function validateVisitorSignature(
  visitorId: string,
  visitorSecret: string,
  token: string | undefined,
  ts: string | undefined
): VisitorSignatureResult {
  // 开发环境无签名时放行，仅校验 visitorId 存在
  if (isDevEnvironment() && (!token || !ts)) {
    return { valid: true };
  }

  // 生产环境强制要求签名信息
  if (!token || !ts) {
    return { valid: false, error: '缺少认证信息', code: 'AUTH_MISSING' };
  }

  // 解析时间戳并校验新鲜度
  const timestamp = parseInt(ts, 10);
  if (Number.isNaN(timestamp)) {
    return { valid: false, error: '缺少认证信息', code: 'AUTH_MISSING' };
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) >= VISITOR_TOKEN_TTL_MS) {
    return { valid: false, error: '认证已过期', code: 'AUTH_EXPIRED' };
  }

  // 使用 HMAC-SHA256 计算期望签名
  const expectedSignature = crypto
    .createHmac('sha256', visitorSecret)
    .update(`${visitorId}:${ts}`)
    .digest('hex');

  // 长度不一致直接失败，避免 timingSafeEqual 抛出异常
  if (expectedSignature.length !== token.length) {
    return { valid: false, error: '认证失败', code: 'AUTH_FAILED' };
  }

  // 使用 timingSafeEqual 防止时序攻击
  try {
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(token);
    if (!crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { valid: false, error: '认证失败', code: 'AUTH_FAILED' };
    }
  } catch {
    return { valid: false, error: '认证失败', code: 'AUTH_FAILED' };
  }

  return { valid: true };
}

/**
 * 访客鉴权中间件
 * 从请求头中获取 X-Visitor-Id，验证访客身份
 * 检查IP封禁状态（优先）和账号封禁状态
 * 更新访客IP记录
 * 生产环境强制校验 HMAC-SHA256 签名（X-Visitor-Token + X-Visitor-Ts）
 */
export const visitorAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;
  const token = req.headers['x-visitor-token'] as string | undefined;
  const ts = req.headers['x-visitor-ts'] as string | undefined;
  const clientIp = getClientIp(req);

  const ipBan = await checkIpBan(clientIp);
  if (ipBan) {
    return res.status(403).json({
      success: false,
      error: ipBan.reason ? `当前IP已被封禁：${ipBan.reason}` : '当前IP已被封禁，如有疑问请联系管理员',
      code: 'IP_BANNED',
    });
  }

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

  if (visitor.isBanned === true) {
    const banReason = visitor.banReason;
    const banExpiresAt = visitor.banExpiresAt;

    if (banExpiresAt && new Date(banExpiresAt) < new Date()) {
      await mongoDBService.updateOne('visitors', { id: visitorId } as never, {
        $set: { isBanned: false, banReason: '', bannedAt: null, banExpiresAt: null },
      });
      workspaceService.clearVisitorCache(visitorId);
    } else {
      return res.status(403).json({
        success: false,
        error: banReason ? `账号已被封禁：${banReason}` : '账号已被封禁，如有疑问请联系管理员',
        code: 'BANNED',
      });
    }
  }

  // 签名校验：需要 visitorSecret，若历史访客缺少密钥则视为无签名
  const visitorSecret = visitor.visitorSecret || '';
  const signatureResult = validateVisitorSignature(visitorId, visitorSecret, token, ts);
  if (!signatureResult.valid) {
    return res.status(401).json({
      success: false,
      error: signatureResult.error,
    });
  }

  req.visitorId = visitorId;
  req.clientIp = clientIp;

  updateVisitorIp(visitorId, clientIp).catch(err => {
    console.error('更新访客IP失败:', err);
  });

  next();
};

/**
 * 可选访客鉴权中间件
 * 如果提供了 X-Visitor-Id 则验证，否则继续
 * 当提供了访客标识时，生产环境同样强制校验签名，签名失败返回 401
 */
export const optionalVisitorAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;
  const token = req.headers['x-visitor-token'] as string | undefined;
  const ts = req.headers['x-visitor-ts'] as string | undefined;
  const clientIp = getClientIp(req);

  const ipBan = await checkIpBan(clientIp);
  if (ipBan) {
    req.visitorId = undefined;
    return next();
  }

  if (visitorId) {
    const visitor = await workspaceService.getVisitor(visitorId);
    if (visitor) {
      if (visitor.isBanned === true) {
        const banExpiresAt = visitor.banExpiresAt;
        if (!banExpiresAt || new Date(banExpiresAt) >= new Date()) {
          req.visitorId = undefined;
          return next();
        }
      }

      // 签名校验：提供了 visitorId 时必须通过签名验证
      const visitorSecret = visitor.visitorSecret || '';
      const signatureResult = validateVisitorSignature(visitorId, visitorSecret, token, ts);
      if (!signatureResult.valid) {
        return res.status(401).json({
          success: false,
          error: signatureResult.error,
        });
      }

      req.visitorId = visitorId;

      updateVisitorIp(visitorId, clientIp).catch(err => {
        console.error('更新访客IP失败:', err);
      });
    }
  }

  req.clientIp = clientIp;
  next();
};

/**
 * 工作区成员鉴权中间件
 * 验证访客是否为指定工作区的成员
 * 检查IP封禁、账号封禁和工作区关闭状态
 */
export const workspaceMemberAuth = async (req: Request, res: Response, next: NextFunction) => {
  const visitorId = req.headers['x-visitor-id'] as string;
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.headers['x-workspace-id'] as string;
  const clientIp = getClientIp(req);

  const ipBan = await checkIpBan(clientIp);
  if (ipBan) {
    return res.status(403).json({
      success: false,
      error: ipBan.reason ? `当前IP已被封禁：${ipBan.reason}` : '当前IP已被封禁，如有疑问请联系管理员',
      code: 'IP_BANNED',
    });
  }

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

  if (visitor.isBanned === true) {
    const banReason = visitor.banReason;
    const banExpiresAt = visitor.banExpiresAt;

    if (banExpiresAt && new Date(banExpiresAt) < new Date()) {
      await mongoDBService.updateOne('visitors', { id: visitorId } as never, {
        $set: { isBanned: false, banReason: '', bannedAt: null, banExpiresAt: null },
      });
      workspaceService.clearVisitorCache(visitorId);
    } else {
      return res.status(403).json({
        success: false,
        error: banReason ? `账号已被封禁：${banReason}` : '账号已被封禁，如有疑问请联系管理员',
        code: 'BANNED',
      });
    }
  }

  const workspace = await workspaceService.getWorkspace(workspaceId);
  if (!workspace) {
    return res.status(404).json({
      success: false,
      error: '工作区不存在',
    });
  }

  if (workspace.isClosed === true) {
    const closeReason = workspace.closeReason;
    return res.status(403).json({
      success: false,
      error: closeReason ? `工作区已关闭：${closeReason}` : '该工作区已被管理员关闭',
      code: 'WORKSPACE_CLOSED',
    });
  }

  if (workspace.isBanned === true) {
    // 检查封禁是否已过期
    const banExpiresAt = workspace.banExpiresAt;
    const isExpired = banExpiresAt && new Date(banExpiresAt as string | Date).getTime() < Date.now();
    if (!isExpired) {
      const banReason = workspace.banReason;
      return res.status(403).json({
        success: false,
        error: banReason ? `该工作区已被封禁：${banReason}` : '该工作区已被封禁',
        code: 'WORKSPACE_BANNED',
      });
    }
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
  req.clientIp = clientIp;

  updateVisitorIp(visitorId, clientIp).catch(err => {
    console.error('更新访客IP失败:', err);
  });

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
    if (process.env.NODE_ENV !== 'production') {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    }
  });

  next();
};

declare global {
  namespace Express {
    interface Request {
      visitorId?: string;
      workspaceId?: string;
      clientIp?: string;
    }
  }
}
