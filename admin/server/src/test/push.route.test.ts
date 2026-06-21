import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * push 路由单元测试
 *
 * 测试目标：
 * - 发送广播推送（成功/极光推送失败/配置缺失）
 * - 推送历史查询（分页）
 * - 推送消息已读统计
 * - 异常流程
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 */
const {
  mockFindOne,
  mockFind,
  mockInsertOne,
  mockCountDocuments,
  mockAxiosPost,
  mockConfig,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFind: vi.fn(),
  mockInsertOne: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockAxiosPost: vi.fn(),
  mockConfig: {
    jpush: {
      appKey: 'test-app-key',
      masterSecret: 'test-master-secret',
    },
  },
}));

/**
 * 模拟 adminDB 模块
 */
vi.mock('../config/database', () => ({
  adminDB: {
    findOne: mockFindOne,
    find: mockFind,
    updateOne: vi.fn().mockResolvedValue(true),
    insertOne: mockInsertOne,
    countDocuments: mockCountDocuments,
    aggregate: vi.fn().mockResolvedValue([]),
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
 * 模拟 axios 模块
 */
vi.mock('axios', () => ({
  default: {
    post: mockAxiosPost,
  },
}));

/**
 * 模拟 config 模块
 */
vi.mock('../config', () => ({
  config: mockConfig,
}));

import pushRouter from '../routes/push';

/**
 * 模拟响应状态对象
 */
interface MockResponseState {
  res: Response;
  statusCode: number;
  jsonBody: unknown;
}

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
  const stack = (pushRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
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

describe('push 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertOne.mockResolvedValue('message-id');
    mockCountDocuments.mockResolvedValue(0);
    mockAxiosPost.mockResolvedValue({ status: 200, data: { sendno: '12345' } });
    // 重置极光推送配置
    mockConfig.jpush.appKey = 'test-app-key';
    mockConfig.jpush.masterSecret = 'test-master-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：POST /broadcast 发送广播推送
   */
  describe('POST /broadcast', () => {
    it('广播推送成功', async () => {
      mockInsertOne.mockResolvedValue('message-id-1');
      mockAxiosPost.mockResolvedValue({ status: 200 });

      const req = createMockRequest({
        title: '广播标题',
        content: '广播内容',
        targetType: 'all',
      });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: { messageId: 'message-id-1' },
        message: '广播消息已发送',
      });
      expect(mockInsertOne).toHaveBeenCalledWith('push_messages', expect.objectContaining({
        type: 'broadcast',
        title: '广播标题',
        content: '广播内容',
      }));
      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://api.jpush.cn/v3/push',
        expect.objectContaining({
          platform: 'android',
          audience: 'all',
        }),
        expect.objectContaining({
          auth: { username: 'test-app-key', password: 'test-master-secret' },
        }),
      );
    });

    it('指定用户的广播推送', async () => {
      mockInsertOne.mockResolvedValue('message-id-2');

      const req = createMockRequest({
        title: '定向推送',
        content: '内容',
        targetType: 'specific_users',
        targetUserIds: ['user1', 'user2'],
      });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockAxiosPost).toHaveBeenCalledWith(
        'https://api.jpush.cn/v3/push',
        expect.objectContaining({
          audience: { registration_id: ['user1', 'user2'] },
        }),
        expect.any(Object),
      );
    });

    it('未提供标题或内容返回 400', async () => {
      const req = createMockRequest({ title: '只有标题' });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供标题和内容' });
    });

    it('极光推送未配置返回 500', async () => {
      mockConfig.jpush.appKey = '';
      mockConfig.jpush.masterSecret = '';

      const req = createMockRequest({ title: '标题', content: '内容' });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '极光推送未配置' });
    });

    it('消息存储失败返回 500', async () => {
      mockInsertOne.mockResolvedValue(null);

      const req = createMockRequest({ title: '标题', content: '内容' });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '消息存储失败，数据库连接不可用',
      });
    });

    it('极光推送发送失败时返回 pushWarning', async () => {
      mockInsertOne.mockResolvedValue('message-id-3');
      mockAxiosPost.mockRejectedValue(new Error('极光推送服务不可用'));

      const req = createMockRequest({ title: '标题', content: '内容' });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        pushWarning: true,
        message: expect.stringContaining('推送发送失败'),
      });
    });

    it('数据库异常时返回 500', async () => {
      mockInsertOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ title: '标题', content: '内容' });
      const respState = createMockResponse();

      await callRoute('post', '/broadcast', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '发送广播失败' });
    });
  });

  /**
   * 测试组：GET /messages 推送历史查询
   */
  describe('GET /messages', () => {
    it('查询推送历史成功（默认分页）', async () => {
      mockFind.mockResolvedValue([
        {
          _id: 'msg-1',
          type: 'broadcast',
          title: '消息A',
          content: '内容A',
          createdAt: new Date('2024-01-01'),
        },
      ]);
      mockCountDocuments.mockResolvedValue(1);

      const req = createMockRequest({}, {}, { page: '1', limit: '20' });
      const respState = createMockResponse();

      await callRoute('get', '/messages', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          messages: expect.arrayContaining([
            expect.objectContaining({ title: '消息A' }),
          ]),
          pagination: {
            total: 1,
            page: 1,
            limit: 20,
            totalPages: 1,
          },
        },
      });
    });

    it('自定义分页参数', async () => {
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(50);

      const req = createMockRequest({}, {}, { page: '3', limit: '10' });
      const respState = createMockResponse();

      await callRoute('get', '/messages', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { data: { pagination: { page: number; limit: number; totalPages: number } } };
      expect(body.data.pagination.page).toBe(3);
      expect(body.data.pagination.limit).toBe(10);
      expect(body.data.pagination.totalPages).toBe(5);
    });

    it('数据库异常时返回 500', async () => {
      mockFind.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/messages', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取推送记录失败' });
    });
  });

  /**
   * 测试组：GET /messages/:id/stats 推送消息已读统计
   */
  describe('GET /messages/:id/stats', () => {
    it('查询消息统计成功', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'msg-1',
        title: '消息A',
        stats: {
          totalCount: 100,
          deliveredCount: 80,
          readCount: 60,
        },
      });

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('get', '/messages/.*/stats', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          stats: {
            total: 100,
            delivered: 80,
            read: 60,
            readRate: 60,
          },
          unreadUsers: [],
        },
      });
    });

    it('消息不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('get', '/messages/.*/stats', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '消息不存在' });
    });

    it('无统计数据时返回默认值', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'msg-2',
        title: '无统计消息',
        // 无 stats 字段
      });

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('get', '/messages/.*/stats', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          stats: {
            total: 0,
            delivered: 0,
            read: 0,
            readRate: 0,
          },
        },
      });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('get', '/messages/.*/stats', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取统计失败' });
    });
  });
});
