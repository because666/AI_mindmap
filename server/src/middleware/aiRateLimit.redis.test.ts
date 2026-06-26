import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

/**
 * AI 限流 Redis 模式单元测试
 * 测试 createAIRateLimit 中间件的 Redis 限流和内存降级逻辑
 * 使用 vi.doMock + 动态导入模拟 redisService
 * 每个测试使用 vi.resetModules 确保模块级 rateLimitStore 重新初始化
 */

/** 模拟的 Redis 客户端方法集合 */
interface MockRedisClient {
  incr: ReturnType<typeof vi.fn>;
  pexpire: ReturnType<typeof vi.fn>;
  pttl: ReturnType<typeof vi.fn>;
}

/** 模拟的 redisService 方法集合 */
interface MockRedisService {
  getClient: ReturnType<typeof vi.fn>;
  isConnected: ReturnType<typeof vi.fn>;
}

/** 模拟的 redisService 实例 */
let mockRedisService: MockRedisService;

/** 模拟的 Redis 客户端实例 */
let mockClient: MockRedisClient;

/** 创建模拟的 Express Request 对象
 * @param visitorId - 访客ID，undefined 表示无访客
 * @returns 模拟的 Request 对象
 */
function createMockRequest(visitorId?: string): Partial<Request> {
  return {
    visitorId,
  } as Partial<Request>;
}

/** 模拟 Response 状态容器，通过 getter 实现响应式读取 */
interface MockResponseState {
  res: Partial<Response>;
  readonly statusCode: number;
  readonly jsonData: Record<string, unknown> | null;
  readonly headers: Record<string, string>;
}

/** 创建模拟的 Express Response 对象
 * 使用闭包 + getter 确保状态变更后外部可读取最新值
 * @returns 包含响应对象和响应式状态的 MockResponseState
 */
function createMockResponse(): MockResponseState {
  const state = {
    statusCode: 200,
    jsonData: null as Record<string, unknown> | null,
    headers: {} as Record<string, string>,
  };

  const res: Partial<Response> = {
    status: vi.fn((code: number) => {
      state.statusCode = code;
      return res as Response;
    }),
    json: vi.fn((data: Record<string, unknown>) => {
      state.jsonData = data;
      return res as Response;
    }),
    setHeader: vi.fn((name: string, value: string | number | readonly string[]) => {
      state.headers[name] = String(value);
      return res as Response;
    }),
  };

  return {
    res,
    get statusCode() { return state.statusCode; },
    get jsonData() { return state.jsonData; },
    get headers() { return state.headers; },
  };
}

describe('AI 限流 Redis 模式', () => {
  beforeEach(() => {
    vi.resetModules();

    mockClient = {
      incr: vi.fn(),
      pexpire: vi.fn(),
      pttl: vi.fn(),
    };

    mockRedisService = {
      getClient: vi.fn(() => mockClient),
      isConnected: vi.fn(() => true),
    };

    vi.doMock('../data/redis/connection', () => ({
      redisService: mockRedisService,
    }));
  });

  /**
   * 动态导入 createAIRateLimit，确保 mock 生效
   * 每次测试前重新导入以获取全新的模块级 rateLimitStore
   * @returns createAIRateLimit 函数
   */
  async function getRateLimiter() {
    const mod = await import('./aiRateLimit');
    return mod.createAIRateLimit;
  }

  describe('Redis 可用时 - INCR + TTL 限流', () => {
    it('未超过限流次数时应放行请求', async () => {
      mockClient.incr.mockResolvedValueOnce(1);
      mockClient.pexpire.mockResolvedValueOnce(1);

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest('visitor-1');
      const { res } = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(mockClient.incr).toHaveBeenCalledWith('ai_rate_limit:visitor-1');
    });

    it('首次请求时 INCR 返回 1，应设置 TTL', async () => {
      mockClient.incr.mockResolvedValueOnce(1);
      mockClient.pexpire.mockResolvedValueOnce(1);

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest('visitor-1');
      const { res } = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(mockClient.pexpire).toHaveBeenCalledWith('ai_rate_limit:visitor-1', 60000);
    });

    it('非首次请求时不应重新设置 TTL', async () => {
      mockClient.incr.mockResolvedValueOnce(5);

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest('visitor-1');
      const { res } = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(mockClient.pexpire).not.toHaveBeenCalled();
    });

    it('超过限流次数应返回 429', async () => {
      mockClient.incr.mockResolvedValueOnce(11);
      mockClient.pttl.mockResolvedValueOnce(30000);

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest('visitor-1');
      const mockResp = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, mockResp.res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockResp.statusCode).toBe(429);
      expect(mockResp.jsonData).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('频繁'),
          retryAfter: 30,
        })
      );
      expect(mockResp.headers['Retry-After']).toBe('30');
    });

    it('无 visitorId 时应直接放行', async () => {
      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest(undefined);
      const { res } = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(mockClient.incr).not.toHaveBeenCalled();
    });
  });

  describe('Redis 不可用时 - 内存降级', () => {
    it('Redis 不可用时应降级到内存 Map', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockRedisService.getClient.mockReturnValue(null);

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest('visitor-1');
      const { res } = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(mockClient.incr).not.toHaveBeenCalled();
    });

    it('内存模式下超过限流次数应返回 429', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockRedisService.getClient.mockReturnValue(null);

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 3 });

      for (let i = 0; i < 3; i++) {
        const req = createMockRequest('visitor-2');
        const { res } = createMockResponse();
        const next = vi.fn();
        await middleware(req as Request, res as Response, next);
      }

      const req = createMockRequest('visitor-2');
      const mockResp = createMockResponse();
      const next = vi.fn();
      await middleware(req as Request, mockResp.res as Response, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockResp.statusCode).toBe(429);
      expect(mockResp.jsonData).toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('频繁'),
        })
      );
    });
  });

  describe('Redis 操作异常时 - 降级到内存', () => {
    it('Redis 操作异常时应降级到内存 Map', async () => {
      mockClient.incr.mockRejectedValue(new Error('Redis 连接断开'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 10 });
      const req = createMockRequest('visitor-1');
      const { res } = createMockResponse();
      const next = vi.fn();

      await middleware(req as Request, res as Response, next);

      expect(next).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('降级到内存模式'));

      warnSpy.mockRestore();
    });

    it('Redis 异常降级后内存限流应正常工作', async () => {
      mockClient.incr.mockRejectedValue(new Error('Redis 异常'));

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 60000, maxRequests: 1 });

      const req1 = createMockRequest('visitor-3');
      const { res: res1 } = createMockResponse();
      const next1 = vi.fn();
      await middleware(req1 as Request, res1 as Response, next1);
      expect(next1).toHaveBeenCalled();

      const req2 = createMockRequest('visitor-3');
      const mockResp2 = createMockResponse();
      const next2 = vi.fn();
      await middleware(req2 as Request, mockResp2.res as Response, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(mockResp2.statusCode).toBe(429);

      vi.restoreAllMocks();
    });
  });

  describe('限流窗口重置', () => {
    it('内存模式下窗口过期后计数器应归零', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockRedisService.getClient.mockReturnValue(null);

      vi.useFakeTimers();

      const createAIRateLimit = await getRateLimiter();
      const middleware = createAIRateLimit({ windowMs: 1000, maxRequests: 1 });

      const req1 = createMockRequest('visitor-4');
      const { res: res1 } = createMockResponse();
      const next1 = vi.fn();
      await middleware(req1 as Request, res1 as Response, next1);
      expect(next1).toHaveBeenCalled();

      const req2 = createMockRequest('visitor-4');
      const mockResp2 = createMockResponse();
      const next2 = vi.fn();
      await middleware(req2 as Request, mockResp2.res as Response, next2);
      expect(next2).not.toHaveBeenCalled();
      expect(mockResp2.statusCode).toBe(429);

      vi.advanceTimersByTime(1001);

      const req3 = createMockRequest('visitor-4');
      const { res: res3 } = createMockResponse();
      const next3 = vi.fn();
      await middleware(req3 as Request, res3 as Response, next3);
      expect(next3).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});
