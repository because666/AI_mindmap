import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';

/**
 * auth 路由单元测试
 *
 * 测试目标：
 * - 登录成功（正确密码）
 * - 登录失败（错误密码）
 * - 密码连续错误触发锁定
 * - 登出
 * - 安全问题验证（honeypot 路由的 verify-question）
 * - 异常流程
 *
 * 测试方式：
 * 通过 vi.mock 模拟 adminDB、bcryptjs、uuid、getClientIp、loginLimiter 等依赖，
 * 直接调用路由处理函数验证业务逻辑。
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * 确保在 vi.mock 工厂函数执行时能引用到这些函数
 */
const {
  mockFindOne,
  mockInsertOne,
  mockUpdateOne,
  mockFind,
  mockBcryptCompare,
  mockBcryptHash,
  mockUuidV4,
  mockGetClientIp,
  mockSessionDestroy,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockInsertOne: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockFind: vi.fn(),
  mockBcryptCompare: vi.fn(),
  mockBcryptHash: vi.fn(),
  mockUuidV4: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockSessionDestroy: vi.fn(),
}));

/**
 * 模拟 adminDB 模块，避免真实数据库连接
 */
vi.mock('../config/database', () => ({
  adminDB: {
    findOne: mockFindOne,
    insertOne: mockInsertOne,
    updateOne: mockUpdateOne,
    find: mockFind,
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue([]),
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

/**
 * 模拟 bcryptjs 模块，避免真实加密计算
 */
vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
  },
}));

/**
 * 模拟 uuid 模块，返回固定 sessionId
 */
vi.mock('uuid', () => ({
  v4: mockUuidV4,
}));

/**
 * 模拟 getClientIp 函数，返回固定 IP
 */
vi.mock('../middleware/ipWhitelist', async () => {
  const actual = await vi.importActual<typeof import('../middleware/ipWhitelist')>('../middleware/ipWhitelist');
  return {
    ...actual,
    getClientIp: mockGetClientIp,
  };
});

/**
 * 模拟 loginLimiter 中间件，直接放行
 */
vi.mock('../middleware/rateLimit', () => ({
  loginLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
  apiLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import authRouter from '../routes/auth';

/**
 * 模拟响应状态对象
 * 通过引用传递，确保中间件调用 status/json 后能读取到最新值
 */
interface MockResponseState {
  res: Response;
  statusCode: number;
  jsonBody: unknown;
  headers: Record<string, string>;
  sentData: unknown;
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
    headers: {},
    sentData: null,
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
    setHeader(name: string, value: string) {
      state.headers[name] = value;
      return res;
    },
    send(data: unknown) {
      state.sentData = data;
      return res;
    },
  } as unknown as Response;
  state.res = res;
  return state;
}

/**
 * 模拟 session 对象
 */
interface MockSession {
  sessionId?: string;
  destroy: (cb: (err?: Error) => void) => void;
}

/**
 * 构造模拟的 Express 请求对象
 * @param body - 请求体
 * @param session - session 对象
 * @param headers - 请求头
 * @returns 模拟的 Request 对象
 */
function createMockRequest(
  body: Record<string, unknown> = {},
  session: MockSession = { destroy: mockSessionDestroy },
  headers: Record<string, string | string[] | undefined> = {},
  params: Record<string, string> = {},
): Request {
  return {
    body,
    headers,
    params,
    query: {},
    session: session as unknown as Request['session'],
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

/**
 * 从 auth 路由中提取指定 HTTP 方法和路径的处理函数
 * @param method - HTTP 方法（小写）
 * @param pathPattern - 路径模式（正则字符串）
 * @returns 路由处理函数数组
 */
function findRouteHandler(method: string, pathPattern: string): Array<(req: Request, res: Response, next: NextFunction) => void> {
  const stack = (authRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
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
 * 注意：路由处理函数可能是 async 函数，需要正确 await 所有 handler 完成
 * @param method - HTTP 方法
 * @param pathPattern - 路径模式
 * @param req - 请求对象
 * @param res - 响应对象
 */
async function callRoute(method: string, pathPattern: string, req: Request, res: Response): Promise<void> {
  const handlers = findRouteHandler(method, pathPattern);
  // 收集所有 handler 执行产生的 Promise，确保全部 await 完成
  const pendingPromises: Array<Promise<unknown>> = [];
  let index = 0;
  const next: NextFunction = ((err?: unknown) => {
    if (err) {
      throw err;
    }
    index += 1;
    if (index < handlers.length) {
      // 收集 async handler 的 Promise
      pendingPromises.push(Promise.resolve(handlers[index](req, res, next)));
    }
  }) as NextFunction;
  if (handlers.length > 0) {
    pendingPromises.push(Promise.resolve(handlers[0](req, res, next)));
  }
  // 等待所有 handler 完成（包括通过 next() 链式调用的）
  await Promise.all(pendingPromises);
}

describe('auth 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockUuidV4.mockReturnValue('test-session-id');
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockSessionDestroy.mockImplementation((cb: (err?: Error) => void) => cb());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET /check-ip 检查系统状态
   */
  describe('GET /check-ip', () => {
    it('首次访问（无配置）返回 isFirstVisit=true', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/check-ip', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          allowed: true,
          isFirstVisit: true,
          hasPassword: false,
          enableHoneypot: true,
        },
      });
    });

    it('已初始化系统返回 hasPassword=true', async () => {
      mockFindOne.mockResolvedValue({
        passwordHash: 'hashed',
        security: { enableHoneypot: false, secretQuestion: 'q', secretAnswer: 'a' },
      });
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/check-ip', req, respState.res);

      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          isFirstVisit: false,
          hasPassword: true,
          enableHoneypot: false,
        },
      });
    });

    it('数据库异常时降级返回默认值', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库连接失败'));
      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/check-ip', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          allowed: true,
          isFirstVisit: true,
          hasPassword: false,
        },
      });
    });
  });

  /**
   * 测试组：POST /init 初始化管理员
   */
  describe('POST /init', () => {
    it('首次初始化成功', async () => {
      mockFindOne.mockResolvedValue(null);
      mockInsertOne.mockResolvedValue('inserted-id');
      const req = createMockRequest({ password: 'password123', confirmPassword: 'password123' });
      const respState = createMockResponse();

      await callRoute('post', '/init', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true });
      expect(mockBcryptHash).toHaveBeenCalledWith('password123', expect.any(Number));
      expect(mockInsertOne).toHaveBeenCalledWith('admin_configs', expect.objectContaining({
        passwordHash: 'hashed-password',
      }));
    });

    it('系统已初始化时拒绝重复初始化', async () => {
      mockFindOne.mockResolvedValue({ passwordHash: 'existing' });
      const req = createMockRequest({ password: 'password123', confirmPassword: 'password123' });
      const respState = createMockResponse();

      await callRoute('post', '/init', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '系统已初始化，不可重复初始化' });
    });

    it('缺少密码时返回 400', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = createMockRequest({ password: '', confirmPassword: '' });
      const respState = createMockResponse();

      await callRoute('post', '/init', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请输入密码和确认密码' });
    });

    it('两次密码不一致时返回 400', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = createMockRequest({ password: 'password123', confirmPassword: 'different' });
      const respState = createMockResponse();

      await callRoute('post', '/init', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '两次密码不一致' });
    });

    it('密码长度不足6位时返回 400', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = createMockRequest({ password: '12345', confirmPassword: '12345' });
      const respState = createMockResponse();

      await callRoute('post', '/init', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '密码长度不能少于6位' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));
      const req = createMockRequest({ password: 'password123', confirmPassword: 'password123' });
      const respState = createMockResponse();

      await callRoute('post', '/init', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '初始化失败' });
    });
  });

  /**
   * 测试组：POST /login 蜜罐登录
   */
  describe('POST /login (蜜罐)', () => {
    it('蜜罐登录返回成功并记录攻击日志', async () => {
      mockFindOne.mockResolvedValue(null);
      mockInsertOne.mockResolvedValue('attack-log-id');
      const req = createMockRequest(
        { password: 'attacker-password' },
        { destroy: mockSessionDestroy },
        { 'user-agent': 'evil-browser' },
      );
      const respState = createMockResponse();

      await callRoute('post', '^/login$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          isHoneypot: true,
          nickname: '管理员',
        },
      });
      expect(mockInsertOne).toHaveBeenCalled();
    });

    it('未提供密码时返回 400', async () => {
      const req = createMockRequest({});
      const respState = createMockResponse();

      await callRoute('post', '^/login$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请输入密码' });
    });

    it('记录攻击日志异常时仍返回成功（蜜罐不暴露错误）', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));
      const req = createMockRequest({ password: 'any-password' });
      const respState = createMockResponse();

      await callRoute('post', '^/login$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, data: { isHoneypot: true } });
    });
  });

  /**
   * 测试组：POST /real-login 真实登录
   */
  describe('POST /real-login', () => {
    it('正确密码登录成功', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        passwordHash: 'hashed',
        loginAttempts: [],
      });
      mockBcryptCompare.mockResolvedValue(true);
      mockInsertOne.mockResolvedValue('session-id');
      const session: MockSession = { destroy: mockSessionDestroy };
      const req = createMockRequest({ password: 'correct-password' }, session);
      const respState = createMockResponse();

      await callRoute('post', '/real-login', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: { sessionId: 'test-session-id', nickname: '管理员' },
      });
      expect(mockInsertOne).toHaveBeenCalledWith('admin_sessions', expect.objectContaining({
        sessionId: 'test-session-id',
        ipAddress: '127.0.0.1',
      }));
      expect(session.sessionId).toBe('test-session-id');
    });

    it('未提供密码时返回 400', async () => {
      const req = createMockRequest({});
      const respState = createMockResponse();

      await callRoute('post', '/real-login', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请输入密码' });
    });

    it('系统未初始化时返回 400', async () => {
      mockFindOne.mockResolvedValue(null);
      const req = createMockRequest({ password: 'any' });
      const respState = createMockResponse();

      await callRoute('post', '/real-login', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '系统未初始化' });
    });

    it('错误密码返回 401 并记录失败', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        passwordHash: 'hashed',
        loginAttempts: [],
      });
      mockBcryptCompare.mockResolvedValue(false);
      mockUpdateOne.mockResolvedValue(true);
      const req = createMockRequest({ password: 'wrong-password' });
      const respState = createMockResponse();

      await callRoute('post', '/real-login', req, respState.res);

      expect(respState.statusCode).toBe(401);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '密码错误' });
      expect(mockUpdateOne).toHaveBeenCalled();
    });

    it('IP 已被锁定时返回 429', async () => {
      const futureTime = new Date(Date.now() + 1000 * 60 * 30);
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        passwordHash: 'hashed',
        loginAttempts: [{
          ipAddress: '127.0.0.1',
          attempts: 5,
          lastAttemptAt: new Date(),
          lockedUntil: futureTime,
        }],
      });
      const req = createMockRequest({ password: 'any' });
      const respState = createMockResponse();

      await callRoute('post', '/real-login', req, respState.res);

      expect(respState.statusCode).toBe(429);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '登录失败次数过多，请稍后再试' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));
      const req = createMockRequest({ password: 'any' });
      const respState = createMockResponse();

      await callRoute('post', '/real-login', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '登录失败' });
    });
  });

  /**
   * 测试组：POST /logout 登出
   */
  describe('POST /logout', () => {
    it('已登录用户登出成功', async () => {
      mockUpdateOne.mockResolvedValue(true);
      const session: MockSession = { sessionId: 'test-session-id', destroy: mockSessionDestroy };
      const req = createMockRequest({}, session);
      const respState = createMockResponse();

      await callRoute('post', '/logout', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true });
      expect(mockUpdateOne).toHaveBeenCalledWith('admin_sessions', { sessionId: 'test-session-id' }, { $set: { isActive: false } });
      expect(mockSessionDestroy).toHaveBeenCalled();
    });

    it('未登录用户登出也返回成功', async () => {
      const session: MockSession = { destroy: mockSessionDestroy };
      const req = createMockRequest({}, session);
      const respState = createMockResponse();

      await callRoute('post', '/logout', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true });
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('数据库异常时返回 500', async () => {
      mockUpdateOne.mockRejectedValue(new Error('数据库异常'));
      const session: MockSession = { sessionId: 'test-session-id', destroy: mockSessionDestroy };
      const req = createMockRequest({}, session);
      const respState = createMockResponse();

      await callRoute('post', '/logout', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '登出失败' });
    });
  });

  /**
   * 测试组：POST /set-nickname 设置昵称
   */
  describe('POST /set-nickname', () => {
    it('合法昵称设置成功', async () => {
      mockUpdateOne.mockResolvedValue(true);
      const session: MockSession = { sessionId: 'test-session-id', destroy: mockSessionDestroy };
      const req = createMockRequest({ nickname: '管理员小明' }, session);
      const respState = createMockResponse();

      await callRoute('post', '/set-nickname', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, data: { nickname: '管理员小明' } });
    });

    it('昵称长度不足2位时返回 400', async () => {
      const session: MockSession = { sessionId: 'test-session-id', destroy: mockSessionDestroy };
      const req = createMockRequest({ nickname: 'a' }, session);
      const respState = createMockResponse();

      await callRoute('post', '/set-nickname', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '昵称长度应为2-20个字符' });
    });

    it('昵称长度超过20位时返回 400', async () => {
      const session: MockSession = { sessionId: 'test-session-id', destroy: mockSessionDestroy };
      const req = createMockRequest({ nickname: 'a'.repeat(21) }, session);
      const respState = createMockResponse();

      await callRoute('post', '/set-nickname', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '昵称长度应为2-20个字符' });
    });

    it('未登录时返回 401', async () => {
      const session: MockSession = { destroy: mockSessionDestroy };
      const req = createMockRequest({ nickname: '管理员' }, session);
      const respState = createMockResponse();

      await callRoute('post', '/set-nickname', req, respState.res);

      expect(respState.statusCode).toBe(401);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '未登录' });
    });
  });

  /**
   * 测试组：GET /me 获取当前管理员信息
   */
  describe('GET /me', () => {
    it('已登录用户返回管理员信息', async () => {
      mockFindOne.mockResolvedValue({
        sessionId: 'test-session-id',
        ipAddress: '127.0.0.1',
        nickname: '管理员',
        createdAt: new Date('2024-01-01'),
        isActive: true,
      });
      const session: MockSession = { sessionId: 'test-session-id', destroy: mockSessionDestroy };
      const req = createMockRequest({}, session);
      const respState = createMockResponse();

      await callRoute('get', '/me', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          ipAddress: '127.0.0.1',
          nickname: '管理员',
        },
      });
    });

    it('未登录时返回 401', async () => {
      const session: MockSession = { destroy: mockSessionDestroy };
      const req = createMockRequest({}, session);
      const respState = createMockResponse();

      await callRoute('get', '/me', req, respState.res);

      expect(respState.statusCode).toBe(401);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '未登录' });
    });

    it('会话已失效时返回 401', async () => {
      mockFindOne.mockResolvedValue(null);
      const session: MockSession = { sessionId: 'expired-session', destroy: mockSessionDestroy };
      const req = createMockRequest({}, session);
      const respState = createMockResponse();

      await callRoute('get', '/me', req, respState.res);

      expect(respState.statusCode).toBe(401);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '会话已过期' });
    });
  });
});
