import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * users 路由单元测试
 *
 * 测试目标：
 * - 用户列表查询（分页、筛选）
 * - 封禁用户
 * - 解封用户
 * - 删除用户（危险操作）
 * - IP 封禁
 * - 同 IP 用户查询
 * - 异常流程
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 */
const {
  mockFindOne,
  mockFind,
  mockUpdateOne,
  mockInsertOne,
  mockDeleteOne,
  mockCountDocuments,
  mockNotifyVisitorCacheClear,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFind: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockInsertOne: vi.fn(),
  mockDeleteOne: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockNotifyVisitorCacheClear: vi.fn(),
}));

/**
 * 模拟 adminDB 模块
 */
vi.mock('../config/database', () => ({
  adminDB: {
    findOne: mockFindOne,
    find: mockFind,
    updateOne: mockUpdateOne,
    insertOne: mockInsertOne,
    deleteOne: mockDeleteOne,
    countDocuments: mockCountDocuments,
    aggregate: vi.fn().mockResolvedValue([]),
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

/**
 * 模拟 requireAuth 中间件，直接放行并挂载管理员信息
 */
vi.mock('../middleware/auth', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as Record<string, unknown>).adminIp = '127.0.0.1';
    (req as unknown as Record<string, unknown>).adminNickname = '测试管理员';
    next();
  },
  requireRole: (..._roles: unknown[]) => (req: Request, _res: Response, next: NextFunction) => next(),
}));

/**
 * 模拟 auditLog 中间件，直接放行
 */
vi.mock('../middleware/auditLog', () => ({
  auditLog: (_action: string, _targetType: string) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

/**
 * 模拟 cacheNotify 服务
 */
vi.mock('../services/cacheNotify', () => ({
  notifyVisitorCacheClear: mockNotifyVisitorCacheClear,
  notifyWorkspaceCacheClear: vi.fn(),
  notifySensitiveWordCacheClear: vi.fn(),
  notifyAllCacheClear: vi.fn(),
  notifyFeedbackPush: vi.fn(),
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
}));

import usersRouter from '../routes/users';

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
 */
function createMockRequest(
  body: Record<string, unknown> = {},
  params: Record<string, string> = {},
  query: Record<string, unknown> = {},
  headers: Record<string, string | string[] | undefined> = {},
): Request {
  return {
    body,
    params,
    query,
    headers,
    session: { sessionId: 'test-session-id' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

/**
 * 从路由中提取指定 HTTP 方法和路径的处理函数链
 */
function findRouteHandler(method: string, pathPattern: string): Array<(req: Request, res: Response, next: NextFunction) => void> {
  const stack = (usersRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
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

describe('users 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyVisitorCacheClear.mockResolvedValue(undefined);
    mockUpdateOne.mockResolvedValue(true);
    mockDeleteOne.mockResolvedValue(true);
    mockCountDocuments.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET / 用户列表查询
   */
  describe('GET /', () => {
    it('查询用户列表成功（默认分页）', async () => {
      mockFind.mockResolvedValue([
        {
          _id: { toString: () => 'obj-id-1' },
          id: 'visitor-1',
          nickname: '用户A',
          createdAt: new Date('2024-01-01'),
          lastSeen: new Date('2024-06-01'),
          isBanned: false,
          workspaces: ['ws1', 'ws2'],
        },
      ]);
      mockCountDocuments.mockResolvedValue(1);

      const req = createMockRequest({}, {}, { page: '1', limit: '20' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              id: 'visitor-1',
              nickname: '用户A',
              status: 'active',
              isBanned: false,
            }),
          ]),
          total: 1,
          page: 1,
          limit: 20,
        },
      });
    });

    it('筛选封禁用户列表', async () => {
      mockFind.mockResolvedValue([
        {
          _id: { toString: () => 'obj-id-2' },
          id: 'visitor-2',
          nickname: '被封用户',
          createdAt: new Date('2024-01-01'),
          lastSeen: new Date('2024-06-01'),
          isBanned: true,
          banReason: '违规操作',
          workspaces: [],
        },
      ]);
      mockCountDocuments.mockResolvedValue(1);

      const req = createMockRequest({}, {}, { status: 'banned' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { data: { items: Array<{ status: string; isBanned: boolean }> } };
      expect(body.data.items[0].status).toBe('banned');
      expect(body.data.items[0].isBanned).toBe(true);
    });

    it('按搜索关键词筛选用户', async () => {
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const req = createMockRequest({}, {}, { search: 'test' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockFind).toHaveBeenCalledWith('visitors', expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ nickname: expect.objectContaining({ $regex: 'test' }) }),
        ]),
      }), expect.any(Object));
    });

    it('数据库异常时返回 500', async () => {
      mockFind.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取用户列表失败' });
    });
  });

  /**
   * 测试组：POST /:id/ban 封禁用户
   */
  describe('POST /:id/ban', () => {
    it('封禁用户成功', async () => {
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ reason: '违规操作' }, { id: 'visitor-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '用户已封禁' });
      expect(mockUpdateOne).toHaveBeenCalledWith('visitors', { id: 'visitor-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isBanned: true,
          banReason: '违规操作',
        }),
      }));
      expect(mockNotifyVisitorCacheClear).toHaveBeenCalledWith('visitor-1');
    });

    it('带时长的封禁设置过期时间', async () => {
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ reason: '临时封禁', duration: 24 }, { id: 'visitor-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockUpdateOne).toHaveBeenCalledWith('visitors', { id: 'visitor-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          banExpiresAt: expect.any(Date),
        }),
      }));
    });

    it('未提供封禁原因时返回 400', async () => {
      const req = createMockRequest({}, { id: 'visitor-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供封禁原因' });
    });

    it('用户不存在时返回 404', async () => {
      mockUpdateOne.mockResolvedValue(false);

      const req = createMockRequest({ reason: '违规' }, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '用户不存在' });
    });

    it('数据库异常时返回 500', async () => {
      mockUpdateOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ reason: '违规' }, { id: 'visitor-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '封禁用户失败' });
    });
  });

  /**
   * 测试组：POST /:id/unban 解封用户
   */
  describe('POST /:id/unban', () => {
    it('解封用户成功', async () => {
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ reason: '申诉成功' }, { id: 'visitor-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/unban$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '用户已解封' });
      expect(mockUpdateOne).toHaveBeenCalledWith('visitors', { id: 'visitor-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isBanned: false,
          banReason: null,
          banExpiresAt: null,
        }),
      }));
      expect(mockNotifyVisitorCacheClear).toHaveBeenCalledWith('visitor-1');
    });

    it('用户不存在时返回 404', async () => {
      mockUpdateOne.mockResolvedValue(false);

      const req = createMockRequest({}, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/unban$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '用户不存在' });
    });

    it('数据库异常时返回 500', async () => {
      mockUpdateOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({}, { id: 'visitor-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/unban$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '解封用户失败' });
    });
  });

  /**
   * 测试组：DELETE /:id 删除用户（危险操作）
   */
  describe('DELETE /:id', () => {
    it('有效确认码删除用户成功', async () => {
      mockFindOne.mockResolvedValue({ id: 'abcd1234', nickname: '用户A' });
      mockDeleteOne.mockResolvedValue(true);

      // 确认码需包含 id 的前 4 位字符
      const req = createMockRequest({}, { id: 'abcd1234' }, {}, { 'x-confirm-code': 'abcd123456' });
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '用户已删除' });
      expect(mockDeleteOne).toHaveBeenCalledWith('visitors', { id: 'abcd1234' });
    });

    it('无效确认码返回 400', async () => {
      const req = createMockRequest({}, { id: 'abcd1234' }, {}, { 'x-confirm-code': 'invalid' });
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '危险操作，需要有效的确认码（6位以上字母数字组合）',
        needConfirm: true,
      });
    });

    it('缺少确认码返回 400', async () => {
      const req = createMockRequest({}, { id: 'abcd1234' }, {}, {});
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ needConfirm: true });
    });

    it('用户不存在时返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: 'abcd1234' }, {}, { 'x-confirm-code': 'abcd123456' });
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '用户不存在' });
    });
  });

  /**
   * 测试组：GET /ip/:ip/visitors 同 IP 用户查询
   */
  describe('GET /ip/:ip/visitors', () => {
    it('查询同 IP 用户成功', async () => {
      mockFind.mockResolvedValue([
        {
          id: 'visitor-1',
          nickname: '用户A',
          lastIp: '192.168.1.100',
          isBanned: false,
          createdAt: new Date('2024-01-01'),
          lastSeen: new Date('2024-06-01'),
        },
      ]);

      const req = createMockRequest({}, { ip: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('get', '/ip/.*/visitors', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          ip: '192.168.1.100',
          total: 1,
        },
      });
    });

    it('数据库异常时返回 500', async () => {
      mockFind.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({}, { ip: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('get', '/ip/.*/visitors', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '查询同IP用户失败' });
    });
  });

  /**
   * 测试组：POST /ip-ban 封禁 IP
   */
  describe('POST /ip-ban', () => {
    it('封禁 IP 成功并自动封禁关联账号', async () => {
      mockFindOne.mockResolvedValue(null); // 不存在已有封禁
      mockFind.mockResolvedValue([
        { id: 'visitor-1', nickname: '用户A' },
        { id: 'visitor-2', nickname: '用户B' },
      ]);
      mockInsertOne.mockResolvedValue('ban-id');
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({
        ip: '192.168.1.100',
        reason: '恶意攻击',
        duration: 24,
        autoBanAccounts: true,
      });
      const respState = createMockResponse();

      await callRoute('post', '/ip-ban', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: expect.stringContaining('已封禁'),
      });
      expect(mockInsertOne).toHaveBeenCalledWith('ip_bans', expect.objectContaining({
        ip: '192.168.1.100',
        reason: '恶意攻击',
        visitorIds: ['visitor-1', 'visitor-2'],
      }));
      // 验证关联账号也被封禁
      expect(mockUpdateOne).toHaveBeenCalledWith('visitors', { id: 'visitor-1' }, expect.objectContaining({
        $set: expect.objectContaining({ isBanned: true }),
      }));
    });

    it('未提供 IP 或原因时返回 400', async () => {
      const req = createMockRequest({ ip: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('post', '/ip-ban', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供IP地址和封禁原因' });
    });

    it('IP 已在封禁列表中返回 400', async () => {
      mockFindOne.mockResolvedValue({ ip: '192.168.1.100', reason: '已封禁' });

      const req = createMockRequest({ ip: '192.168.1.100', reason: '再次封禁' });
      const respState = createMockResponse();

      await callRoute('post', '/ip-ban', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '该IP已在封禁列表中' });
    });

    it('autoBanAccounts=false 时不封禁关联账号', async () => {
      mockFindOne.mockResolvedValue(null);
      mockFind.mockResolvedValue([{ id: 'visitor-1', nickname: '用户A' }]);
      mockInsertOne.mockResolvedValue('ban-id');

      const req = createMockRequest({
        ip: '192.168.1.100',
        reason: '仅封IP',
        autoBanAccounts: false,
      });
      const respState = createMockResponse();

      await callRoute('post', '/ip-ban', req, respState.res);

      expect(respState.statusCode).toBe(200);
      // 不应调用 visitors 的 updateOne
      expect(mockUpdateOne).not.toHaveBeenCalledWith('visitors', expect.anything(), expect.anything());
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ ip: '192.168.1.100', reason: '封禁' });
      const respState = createMockResponse();

      await callRoute('post', '/ip-ban', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '封禁IP失败' });
    });
  });
});
