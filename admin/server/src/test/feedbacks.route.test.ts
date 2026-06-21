import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * feedbacks 路由单元测试
 *
 * 测试目标：
 * - 反馈列表查询（分页、筛选）
 * - 反馈统计数据
 * - 更新反馈状态（推送通知触发）
 * - 分配反馈工单
 * - 添加内部备注
 * - 获取内部备注列表
 * - 导出反馈数据
 * - 异常流程
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 */
const {
  mockFindOne,
  mockFind,
  mockUpdateOne,
  mockCountDocuments,
  mockAggregate,
  mockNotifyFeedbackPush,
  mockFeedbackServiceGetStats,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFind: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockAggregate: vi.fn(),
  mockNotifyFeedbackPush: vi.fn(),
  mockFeedbackServiceGetStats: vi.fn(),
}));

/**
 * 模拟 adminDB 模块
 */
vi.mock('../config/database', () => ({
  adminDB: {
    findOne: mockFindOne,
    find: mockFind,
    updateOne: mockUpdateOne,
    insertOne: vi.fn().mockResolvedValue('id'),
    deleteOne: vi.fn().mockResolvedValue(true),
    countDocuments: mockCountDocuments,
    aggregate: mockAggregate,
    isConnected: vi.fn().mockReturnValue(true),
  },
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
  requireRole: (..._roles: unknown[]) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

/**
 * 模拟 auditLog 中间件
 */
vi.mock('../middleware/auditLog', () => ({
  auditLog: (_action: string, _targetType: string) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

/**
 * 模拟 cacheNotify 服务
 */
vi.mock('../services/cacheNotify', () => ({
  notifyFeedbackPush: mockNotifyFeedbackPush,
  notifyVisitorCacheClear: vi.fn(),
  notifyWorkspaceCacheClear: vi.fn(),
  notifySensitiveWordCacheClear: vi.fn(),
  notifyAllCacheClear: vi.fn(),
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
}));

/**
 * 模拟 feedbackService
 */
vi.mock('../services/feedbackService', () => ({
  feedbackService: {
    getStats: mockFeedbackServiceGetStats,
  },
}));

import feedbacksRouter from '../routes/feedbacks';

/**
 * 模拟响应状态对象
 */
interface MockResponseState {
  res: Response;
  statusCode: number;
  jsonBody: unknown;
  sentData: unknown;
  headers: Record<string, string>;
}

function createMockResponse(): MockResponseState {
  const state: MockResponseState = {
    res: null as unknown as Response,
    statusCode: 200,
    jsonBody: null,
    sentData: null,
    headers: {},
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
    send(data: unknown) {
      state.sentData = data;
      return res;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return res;
    },
  } as unknown as Response;
  state.res = res;
  return state;
}

function createMockRequest(
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  query: Record<string, unknown> = {},
): Request {
  return {
    body,
    params,
    query,
    headers: {},
    session: { sessionId: 'test-session-id' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

/**
 * 从路由中提取指定 HTTP 方法和路径的处理函数链
 */
function findRouteHandler(method: string, pathPattern: string): Array<(req: Request, res: Response, next: NextFunction) => void> {
  const stack = (feedbacksRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
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
 */
async function callRoute(method: string, pathPattern: string, req: Request, res: Response): Promise<void> {
  const handlers = findRouteHandler(method, pathPattern);
  const pendingPromises: Array<Promise<unknown>> = [];
  let index = 0;
  const next: NextFunction = ((err?: unknown) => {
    if (err) throw err;
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

describe('feedbacks 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateOne.mockResolvedValue(true);
    mockCountDocuments.mockResolvedValue(0);
    mockNotifyFeedbackPush.mockResolvedValue(undefined);
    mockFeedbackServiceGetStats.mockResolvedValue({
      totalCount: 0,
      pendingCount: 0,
      processingCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      todayCount: 0,
      typeDistribution: [],
      dailyTrend: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET / 反馈列表查询
   */
  describe('GET /', () => {
    it('查询反馈列表成功', async () => {
      mockFind.mockResolvedValue([
        {
          _id: { toString: () => 'obj-id-1' },
          title: '反馈A',
          description: '描述',
          type: '功能异常',
          contact: 'user@test.com',
          visitorIp: '127.0.0.1',
          visitorId: 'visitor-1',
          status: 'pending',
          createdAt: new Date('2024-01-01'),
        },
      ]);
      mockCountDocuments.mockResolvedValue(1);

      const req = createMockRequest({}, {}, { page: '1', pageSize: '20' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              title: '反馈A',
              type: '功能异常',
              status: 'pending',
            }),
          ]),
          total: 1,
          page: 1,
          pageSize: 20,
        },
      });
    });

    it('按状态筛选反馈', async () => {
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const req = createMockRequest({}, {}, { status: 'pending' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockFind).toHaveBeenCalledWith('feedbacks', expect.objectContaining({
        status: 'pending',
      }), expect.any(Object));
    });

    it('按类型筛选反馈', async () => {
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const req = createMockRequest({}, {}, { type: '功能异常' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockFind).toHaveBeenCalledWith('feedbacks', expect.objectContaining({
        type: '功能异常',
      }), expect.any(Object));
    });

    it('数据库异常时返回 500', async () => {
      mockFind.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取反馈列表失败' });
    });
  });

  /**
   * 测试组：GET /stats 反馈统计
   */
  describe('GET /stats', () => {
    it('获取反馈统计成功', async () => {
      const mockStats = {
        totalCount: 100,
        pendingCount: 30,
        processingCount: 20,
        resolvedCount: 40,
        closedCount: 10,
        todayCount: 5,
        typeDistribution: [{ type: '功能异常', count: 50 }],
        dailyTrend: [{ date: '2024-06-01', count: 10 }],
      };
      mockFeedbackServiceGetStats.mockResolvedValue(mockStats);

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/stats', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: mockStats,
      });
    });

    it('feedbackService 异常时返回 500', async () => {
      mockFeedbackServiceGetStats.mockRejectedValue(new Error('服务异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/stats', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取反馈统计失败' });
    });
  });

  /**
   * 测试组：PATCH /:id/status 更新反馈状态
   */
  describe('PATCH /:id/status', () => {
    it('更新反馈状态成功并触发推送通知', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        title: '反馈A',
        visitorId: 'visitor-1',
        status: 'pending',
      });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ status: 'processing' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: '反馈状态已更新',
        data: { status: 'processing' },
      });
      expect(mockUpdateOne).toHaveBeenCalledWith('feedbacks', expect.any(Object), { $set: { status: 'processing' } });
      // 验证推送通知被触发（状态从 pending 变为非 pending，且有 visitorId）
      expect(mockNotifyFeedbackPush).toHaveBeenCalledWith('visitor-1', '反馈A', 'processing');
    });

    it('无效的反馈ID返回 400', async () => {
      const req = createMockRequest({ status: 'processing' }, { id: 'invalid-id' });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '无效的反馈ID' });
    });

    it('无效的状态值返回 400', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const req = createMockRequest({ status: 'invalid_status' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: expect.stringContaining('无效的状态值') });
    });

    it('反馈不存在返回 404', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({ status: 'resolved' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '反馈不存在' });
    });

    it('状态为 pending 时不触发推送通知', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        title: '反馈A',
        visitorId: 'visitor-1',
        status: 'processing',
      });

      const req = createMockRequest({ status: 'pending' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockNotifyFeedbackPush).not.toHaveBeenCalled();
    });

    it('匿名反馈不触发推送通知', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        title: '匿名反馈',
        visitorId: 'anonymous',
        status: 'pending',
      });

      const req = createMockRequest({ status: 'resolved' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockNotifyFeedbackPush).not.toHaveBeenCalled();
    });

    it('数据库异常时返回 500', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ status: 'resolved' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('patch', '/.*/status$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '更新反馈状态失败' });
    });
  });

  /**
   * 测试组：PUT /:id/assign 分配反馈工单
   */
  describe('PUT /:id/assign', () => {
    it('分配工单成功（默认 SLA 48 小时）', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        title: '反馈A',
        status: 'pending',
      });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ assignee: '管理员A' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('put', '/.*/assign$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: '工单已分配',
        data: {
          assignee: '管理员A',
          slaHours: 48,
        },
      });
    });

    it('自定义 SLA 时长', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        title: '反馈A',
        status: 'pending',
      });

      const req = createMockRequest({ assignee: '管理员A', slaHours: 24 }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('put', '/.*/assign$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        data: { slaHours: 24 },
      });
    });

    it('无效的反馈ID返回 400', async () => {
      const req = createMockRequest({ assignee: '管理员A' }, { id: 'invalid' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/assign$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '无效的反馈ID' });
    });

    it('被分配人为空返回 400', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const req = createMockRequest({ assignee: '' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('put', '/.*/assign$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '被分配人昵称不能为空' });
    });

    it('反馈不存在返回 404', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({ assignee: '管理员A' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('put', '/.*/assign$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '反馈不存在' });
    });
  });

  /**
   * 测试组：POST /:id/notes 添加内部备注
   */
  describe('POST /:id/notes', () => {
    it('添加内部备注成功', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        title: '反馈A',
      });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ content: '这是一条备注' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: '备注已添加',
        data: {
          content: '这是一条备注',
          author: '测试管理员',
        },
      });
    });

    it('无效的反馈ID返回 400', async () => {
      const req = createMockRequest({ content: '备注' }, { id: 'invalid' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '无效的反馈ID' });
    });

    it('备注内容为空返回 400', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      const req = createMockRequest({ content: '' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '备注内容不能为空' });
    });

    it('反馈不存在返回 404', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({ content: '备注' }, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '反馈不存在' });
    });
  });

  /**
   * 测试组：GET /:id/notes 获取内部备注列表
   */
  describe('GET /:id/notes', () => {
    it('获取内部备注列表成功', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue({
        _id: validObjectId,
        internalNotes: [
          { content: '备注1', author: '管理员A', createdAt: new Date('2024-01-01') },
          { content: '备注2', author: '管理员B', createdAt: new Date('2024-01-02') },
        ],
      });

      const req = createMockRequest({}, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('get', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ content: '备注1', author: '管理员A' }),
          expect.objectContaining({ content: '备注2', author: '管理员B' }),
        ]),
      });
    });

    it('无效的反馈ID返回 400', async () => {
      const req = createMockRequest({}, { id: 'invalid' });
      const respState = createMockResponse();

      await callRoute('get', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '无效的反馈ID' });
    });

    it('反馈不存在返回 404', async () => {
      const validObjectId = '507f1f77bcf86cd799439011';
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: validObjectId });
      const respState = createMockResponse();

      await callRoute('get', '/.*/notes$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '反馈不存在' });
    });
  });
});
