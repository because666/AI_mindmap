import { Request, Response, NextFunction } from 'express'

/** 每用户限流配置 */
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

/** 每用户限流记录 */
interface UserRateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, UserRateLimitRecord>()

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore) {
    if (now >= record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, CLEANUP_INTERVAL_MS)

/**
 * 创建每用户 AI 限流中间件
 * 基于访客ID（req.visitorId）进行请求频率限制，窗口期内超过最大请求数时返回429状态码
 * 使用内存Map存储限流记录，每5分钟自动清理过期记录
 * @param config - 限流配置，windowMs为时间窗口（毫秒），maxRequests为窗口内最大请求数
 * @returns Express中间件函数，无visitorId时直接放行
 */
export function createAIRateLimit(config: RateLimitConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const visitorId = req.visitorId

    if (!visitorId) {
      return next()
    }

    const now = Date.now()
    const record = rateLimitStore.get(visitorId)

    if (!record || now >= record.resetTime) {
      rateLimitStore.set(visitorId, {
        count: 1,
        resetTime: now + config.windowMs,
      })
      return next()
    }

    record.count++

    if (record.count > config.maxRequests) {
      const retryAfterMs = record.resetTime - now
      const retryAfterSec = Math.ceil(retryAfterMs / 1000)

      res.setHeader('Retry-After', String(retryAfterSec))
      res.status(429).json({
        success: false,
        error: 'AI请求过于频繁，请稍后再试',
        retryAfter: retryAfterSec,
      })
      return
    }

    next()
  }
}
