import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * dashboard 路由单元测试
 *
 * 测试目标：
 * - 核心统计指标接口
 * - 用户行为事件概览、趋势、漏斗、最近事件接口
 * - 参数校验（天数范围、事件类型、limit 范围）
 * - 异常流程
 *
 * 测试方式：
 * 通过 vi.mock 模拟 adminDB、redis、requireAuth 等依赖，直接调用路由处理函数。
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 */
const {
  mockCountDocuments,
  mockAggregate,
  mockFind,
  mockGetRedisClient,
} = vi.hoisted(() => ({
  mockCountDocuments: vi.fn(),
  mockAggregate: vi.fn(),
  mockFind: vi.fn(),
  mockGetRedisClient: vi.fn(),
}));

/**
 * 模拟 adminDB 模块
 */
vi.mock('../config/database', () => ({
  adminDB: {
    countDocuments: mockCountDocuments,
    aggregate: mockAggregate,
    find: mockFind,
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

/**
 * 模拟 Redis 模块
 */
vi.mock('../data/redis', () => ({
  getRedisClient: mockGetRedisClient,
}));

/**
 * 模拟 requireAuth 中间件
 */
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>).adminIp = '127.0.0.1';
    (req as unknown as Record<string, unknown>).adminNickname = '测试管理员';
    next();
  },
}));

import dashboardRouter from '../routes/dashboard';

/**
 * 模拟响应状态对象
 */
interface MockResponseState {
  res: Response;
  statusCode: number;
  jsonBody: unknown;
}

/**
 * 构造模拟的 Express 响应对象
 * @returns 包含响应对象及状态码/json 数据记录的状态对象
 */
function createMockResponse(): MockResponseState {
  const state: MockResponseState = {
    res: null as unknown as Response,
    statusCode: 200,
    jsonBody: null,
  };
  const res = {
    status(code: number) {
      state.statusCode = code;
      return res;
    },
    json(body: unknown) {
      state.jsonBody = body;
      return res;
    },
  } as unknown as Response;
  state.res = res;
  return state;
}

/**
 * 构造模拟的 Express 请求对象
 * @param query - 查询参数
 * @returns 模拟的 Request 对象
 */
function createMockRequest(query: Record<string, string | string[]> = {}): Request {
  return {
    query,
    params: {},
    body: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

/**
 * 从 dashboard 路由中提取指定 HTTP 方法和路径的处理函数
 * @param method - HTTP 方法（小写）
 * @param pathPattern - 路径模式（正则字符串）
 * @returns 路由处理函数数组
 */
function findRouteHandler(method: string, pathPattern: string): Array<(req: Request, res: Response, next: NextFunction) => void> {
  const stack = (dashboardRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
  for (const layer of stack) {
    if (!layer.route) continue;
    if (layer.route.methods[method] && (new RegExp(pathPattern)).test(layer.route.path)) {
      return layer.route.stack.map((s) => s.handle);
    }
  }
  throw new Error(`未找到路由: ${method.toUpperCase()} ${pathPattern}`);
}

/**
 * 调用指定路由的处理函数链
 * @param method - HTTP 方法
 * @param pathPattern - 路径模式
 * @param req - 请求对象
 * @param res - 响应对象
 */
async function callRoute(method: string, pathPattern: string, req: Request, res: Response): Promise<void> {
  const handlers = findRouteHandler(method, pathPattern);
  const pendingPromises: Array<Promise<unknown>> = [];
  let index = 0;
  const next: NextFunction = ((err?: unknown) => {
    if (err) {
      throw err;
    }
    index += 1;
    if (index < handlers.length) {
      pendingPromises.push(Promise.resolve(handlers[index](req, res, next)));
    }
  }) as NextFunction;
  if (handlers.length > 0) {
    pendingPromises.push(Promise.resolve(handlers[0](req, res, next)));
  }
  await Promise.all(pendingPromises);
}

/**
 * 构造按日聚合的 mock 结果
 * @param date - 日期字符串
 * @param count - 事件数量
 * @returns 聚合结果项
 */
function createDayAggregationResult(date: string, count: number): { _id: string; count: number } {
  return { _id: date, count };
}

describe('dashboard 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedisClient.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET /stats 核心统计指标
   */
  describe('GET /stats', () => {
    it('返回核心统计指标成功', async () => {
      mockCountDocuments.mockResolvedValue(0);
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/stats', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true });
    });
  });

  /**
   * 测试组：GET /events/overview 事件概览
   */
  describe('GET /events/overview', () => {
    it('返回事件概览数据成功', async () => {
      mockCountDocuments.mockResolvedValueOnce(100).mockResolvedValueOnce(10);
      mockAggregate.mockResolvedValueOnce([{ _id: null, count: 50 }]);
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/events/overview', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          total: 100,
          today: 10,
          uniqueVisitors: 50,
        },
      });
    });

    it('数据库异常时返回 500', async () => {
      mockCountDocuments.mockRejectedValue(new Error('数据库异常'));
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/events/overview', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取事件概览失败' });
    });
  });

  /**
   * 测试组：GET /events/trend 事件趋势
   */
  describe('GET /events/trend', () => {
    it('默认返回近7天全部事件趋势', async () => {
      mockAggregate.mockResolvedValueOnce([
        createDayAggregationResult('2026-06-20', 5),
        createDayAggregationResult('2026-06-21', 8),
      ]);
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/events/trend', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { success: boolean; data: { dates: string[]; values: number[] } };
      expect(body.success).toBe(true);
      expect(body.data.dates.length).toBe(7);
      expect(body.data.values.length).toBe(7);
    });

    it('按指定事件类型筛选返回趋势', async () => {
      mockAggregate.mockResolvedValueOnce([
        createDayAggregationResult('2026-06-20', 1),
        createDayAggregationResult('2026-06-21', 2),
      ]);
      const req = createMockRequest({ eventType: 'map_created' });
      const respState = createMockResponse();

      await callRoute('get', '/events/trend', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { success: boolean; data: { dates: string[]; values: number[] } };
      expect(body.success).toBe(true);
      expect(body.data.dates.length).toBe(7);
    });

    it('天数超出范围返回 400', async () => {
      const req = createMockRequest({ days: '100' });
      const respState = createMockResponse();

      await callRoute('get', '/events/trend', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '天数范围应为1-90' });
    });

    it('无效事件类型返回 400', async () => {
      const req = createMockRequest({ eventType: 'invalid_event' });
      const respState = createMockResponse();

      await callRoute('get', '/events/trend', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '无效的事件类型' });
    });
  });

  /**
   * 测试组：GET /events/funnel 事件漏斗
   */
  describe('GET /events/funnel', () => {
    it('返回关键事件漏斗数据成功', async () => {
      mockAggregate
        .mockResolvedValueOnce([{ _id: null, count: 100 }])
        .mockResolvedValueOnce([{ _id: null, count: 80 }])
        .mockResolvedValueOnce([{ _id: null, count: 60 }])
        .mockResolvedValueOnce([{ _id: null, count: 40 }])
        .mockResolvedValueOnce([{ _id: null, count: 20 }]);
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/events/funnel', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { success: boolean; data: { steps: Array<{ name: string; count: number; rate: number }> } };
      expect(body.success).toBe(true);
      expect(body.data.steps.length).toBe(5);
      expect(body.data.steps[0].name).toBe('注册');
      expect(body.data.steps[4].name).toBe('生成摘要');
      expect(body.data.steps[0].rate).toBe(100);
    });

    it('数据库异常时降级返回空漏斗数据', async () => {
      mockAggregate.mockRejectedValue(new Error('数据库异常'));
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/events/funnel', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { success: boolean; data: { steps: Array<{ name: string; count: number }> } };
      expect(body.success).toBe(true);
      expect(body.data.steps.length).toBe(5);
      expect(body.data.steps.every((step) => step.count === 0)).toBe(true);
    });
  });

  /**
   * 测试组：GET /events/recent 最近事件
   */
  describe('GET /events/recent', () => {
    it('默认返回最近20条事件', async () => {
      mockFind.mockResolvedValueOnce([
        { eventType: 'page_view', visitorId: 'v1', timestamp: new Date('2026-06-26T10:00:00Z') },
        { eventType: 'map_created', visitorId: 'v2', timestamp: new Date('2026-06-26T09:00:00Z') },
      ]);
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/events/recent', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { success: boolean; data: Array<{ eventType: string; visitorId?: string }> };
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.data[0].eventType).toBe('page_view');
    });

    it('支持自定义 limit 参数', async () => {
      mockFind.mockResolvedValueOnce([
        { eventType: 'page_view', visitorId: 'v1', timestamp: new Date() },
      ]);
      const req = createMockRequest({ limit: '5' });
      const respState = createMockResponse();

      await callRoute('get', '/events/recent', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(1);
    });

    it('limit 超出范围返回 400', async () => {
      const req = createMockRequest({ limit: '200' });
      const respState = createMockResponse();

      await callRoute('get', '/events/recent', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: 'limit范围应为1-100' });
    });
  });
});
