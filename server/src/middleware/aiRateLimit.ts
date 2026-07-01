import { Request, Response, NextFunction } from 'express'
import { redisService } from '../data/redis/connection'

/** 每用户限流配置 */
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

/** 每用户限流记录（内存降级模式使用） */
interface UserRateLimitRecord {
  count: number
  resetTime: number
}

/** 内存限流存储（Redis 不可用时的降级方案） */
const rateLimitStore = new Map<string, UserRateLimitRecord>()

/** 内存清理间隔（毫秒） */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

/** 标记内存清理定时器是否已启动，避免重复创建 */
let memoryCleanupStarted = false

/**
 * 启动内存限流记录的定时清理任务
 * 仅在 Redis 不可用、降级到内存模式时才启动
 * 每5分钟清理一次已过期的限流记录，防止内存泄漏
 */
function startMemoryCleanup(): void {
  if (memoryCleanupStarted) return
  memoryCleanupStarted = true
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore) {
      if (now >= record.resetTime) {
        rateLimitStore.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)
}

/**
 * 基于 Redis 的限流检查
 * 使用 INCR 命令原子递增计数器，首次创建 key 时设置 TTL
 * @param client - Redis 客户端实例
 * @param visitorId - 访客唯一标识
 * @param config - 限流配置
 * @returns 限流结果，limited 为 true 表示已被限流，retryAfterSec 为剩余等待秒数
 */
async function checkRedisRateLimit(
  client: NonNullable<ReturnType<typeof redisService.getClient>>,
  visitorId: string,
  config: RateLimitConfig
): Promise<{ limited: boolean; retryAfterSec: number }> {
  const key = `ai_rate_limit:${visitorId}`
  const count = await client.incr(key)

  if (count === 1) {
    await client.pexpire(key, config.windowMs)
  }

  if (count > config.maxRequests) {
    const ttlMs = await client.pttl(key)
    const retryAfterSec = Math.ceil(Math.max(ttlMs, 0) / 1000)
    return { limited: true, retryAfterSec }
  }

  return { limited: false, retryAfterSec: 0 }
}

/**
 * 基于内存 Map 的限流检查（降级方案）
 * 当 Redis 不可用时使用内存 Map 存储限流记录
 * @param visitorId - 访客唯一标识
 * @param config - 限流配置
 * @returns 限流结果，limited 为 true 表示已被限流，retryAfterSec 为剩余等待秒数
 */
function checkMemoryRateLimit(
  visitorId: string,
  config: RateLimitConfig
): { limited: boolean; retryAfterSec: number } {
  startMemoryCleanup()

  const now = Date.now()
  const record = rateLimitStore.get(visitorId)

  if (!record || now >= record.resetTime) {
    rateLimitStore.set(visitorId, {
      count: 1,
      resetTime: now + config.windowMs,
    })
    return { limited: false, retryAfterSec: 0 }
  }

  record.count++

  if (record.count > config.maxRequests) {
    const retryAfterMs = record.resetTime - now
    const retryAfterSec = Math.ceil(retryAfterMs / 1000)
    return { limited: true, retryAfterSec }
  }

  return { limited: false, retryAfterSec: 0 }
}

/**
 * 创建每用户 AI 限流中间件
 * 优先使用 Redis 存储限流计数（INCR + TTL 自动过期），Redis 不可用时降级到内存 Map
 * 基于访客ID（req.visitorId）进行请求频率限制，窗口期内超过最大请求数时返回429状态码
 * @param config - 限流配置，windowMs为时间窗口（毫秒），maxRequests为窗口内最大请求数
 * @returns Express 异步中间件函数，无 visitorId 时直接放行
 * @throws Redis 操作异常时自动降级到内存模式，不会抛出未捕获异常
 */
export function createAIRateLimit(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const visitorId = req.visitorId

    if (!visitorId) {
      return next()
    }

    const client = redisService.getClient()

    if (redisService.isConnected() && client !== null) {
      try {
        const result = await checkRedisRateLimit(client, visitorId, config)

        if (result.limited) {
          res.setHeader('Retry-After', String(result.retryAfterSec))
          res.status(429).json({
            success: false,
            error: 'AI请求过于频繁，请稍后再试',
            retryAfter: result.retryAfterSec,
          })
          return
        }

        return next()
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.warn(`⚠️ Redis 限流操作失败，降级到内存模式: ${errorMsg}`)
      }
    }

    const result = checkMemoryRateLimit(visitorId, config)

    if (result.limited) {
      res.setHeader('Retry-After', String(result.retryAfterSec))
      res.status(429).json({
        success: false,
        error: 'AI请求过于频繁，请稍后再试',
        retryAfter: result.retryAfterSec,
      })
      return
    }

    next()
  }
}

/**
 * 创建地图大纲生成的独立限流中间件（5 次/分钟）
 *
 * 与对话限流策略（aiChatRateLimit）独立计数，避免大纲生成请求与对话流式请求
 * 共享同一限流窗口导致相互影响（如大纲生成耗尽配额后阻塞对话）。
 *
 * 设计说明：
 * - 时间窗口：1 分钟（60 * 1000 ms）
 * - 最大请求数：5 次/分钟，大纲生成为低频重操作，5 次足够满足正常使用
 * - 复用 createAIRateLimit 的 Redis/内存双通道实现，保证降级一致性
 *
 * @returns Express 异步限流中间件，限流维度为访客ID
 */
export function createMapOutlineRateLimit() {
  return createAIRateLimit({ windowMs: 60 * 1000, maxRequests: 5 })
}
