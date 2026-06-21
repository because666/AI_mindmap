import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * settings 路由单元测试
 *
 * 测试目标：
 * - IP 白名单 CRUD（查询、添加、删除）
 * - 修改密码
 * - 功能开关读取与更新
 * - 灰度规则评估
 * - AI 服务商配置读取与保存
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
  mockBcryptCompare,
  mockBcryptHash,
  mockGetClientIp,
  mockNotifySensitiveWordCacheClear,
  mockConfig,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFind: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockInsertOne: vi.fn(),
  mockBcryptCompare: vi.fn(),
  mockBcryptHash: vi.fn(),
  mockGetClientIp: vi.fn(),
  mockNotifySensitiveWordCacheClear: vi.fn(),
  mockConfig: {
    security: {
      bcryptRounds: 10,
      loginAttemptsWindow: 300000,
      loginAttemptsMax: 5,
      loginLockDuration: 900000,
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
    updateOne: mockUpdateOne,
    insertOne: mockInsertOne,
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue([]),
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

/**
 * 模拟 bcryptjs 模块
 */
vi.mock('bcryptjs', () => ({
  default: {
    compare: mockBcryptCompare,
    hash: mockBcryptHash,
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
  notifySensitiveWordCacheClear: mockNotifySensitiveWordCacheClear,
  notifyVisitorCacheClear: vi.fn(),
  notifyWorkspaceCacheClear: vi.fn(),
  notifyAllCacheClear: vi.fn(),
  notifyFeedbackPush: vi.fn(),
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
}));

/**
 * 模拟 getClientIp 函数
 */
vi.mock('../middleware/ipWhitelist', async () => {
  const actual = await vi.importActual<typeof import('../middleware/ipWhitelist')>('../middleware/ipWhitelist');
  return {
    ...actual,
    getClientIp: mockGetClientIp,
  };
});

/**
 * 模拟 config 模块
 */
vi.mock('../config', () => ({
  config: mockConfig,
}));

import settingsRouter from '../routes/settings';

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
  body: Record<string, unknown> | unknown[] = {},
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
  const stack = (settingsRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
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

describe('settings 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClientIp.mockReturnValue('127.0.0.1');
    mockBcryptHash.mockResolvedValue('new-hashed-password');
    mockUpdateOne.mockResolvedValue(true);
    mockNotifySensitiveWordCacheClear.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET /ip-whitelist 获取 IP 白名单
   */
  describe('GET /ip-whitelist', () => {
    it('获取 IP 白名单成功', async () => {
      mockFind.mockResolvedValue([
        {
          ipAddress: '192.168.1.1',
          nickname: '管理员A',
          isActive: true,
          createdAt: new Date('2024-01-01'),
        },
      ]);

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/ip-whitelist', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          whitelist: expect.arrayContaining([
            expect.objectContaining({ ipAddress: '192.168.1.1', nickname: '管理员A' }),
          ]),
          currentIp: '127.0.0.1',
        },
      });
    });

    it('数据库异常时返回 500', async () => {
      mockFind.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/ip-whitelist', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取IP白名单失败' });
    });
  });

  /**
   * 测试组：POST /ip-whitelist 添加 IP 到白名单
   */
  describe('POST /ip-whitelist', () => {
    it('添加 IP 到白名单成功', async () => {
      mockFindOne.mockResolvedValue(null); // 不存在
      mockInsertOne.mockResolvedValue('ip-id');

      const req = createMockRequest({
        ipAddress: '192.168.1.100',
        nickname: '新管理员',
        description: '办公室IP',
      });
      const respState = createMockResponse();

      await callRoute('post', '/ip-whitelist', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: 'IP已添加到白名单' });
      expect(mockInsertOne).toHaveBeenCalledWith('admin_ips', expect.objectContaining({
        ipAddress: '192.168.1.100',
        nickname: '新管理员',
        description: '办公室IP',
        isActive: true,
      }));
    });

    it('未提供 IP 或昵称返回 400', async () => {
      const req = createMockRequest({ ipAddress: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('post', '/ip-whitelist', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供IP地址和昵称' });
    });

    it('IP 已在白名单中返回 400', async () => {
      mockFindOne.mockResolvedValue({ ipAddress: '192.168.1.100', isActive: true });

      const req = createMockRequest({ ipAddress: '192.168.1.100', nickname: '管理员' });
      const respState = createMockResponse();

      await callRoute('post', '/ip-whitelist', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '该IP已在白名单中' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ ipAddress: '192.168.1.100', nickname: '管理员' });
      const respState = createMockResponse();

      await callRoute('post', '/ip-whitelist', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '添加IP白名单失败' });
    });
  });

  /**
   * 测试组：DELETE /ip-whitelist/:ip 从白名单删除 IP
   */
  describe('DELETE /ip-whitelist/:ip', () => {
    it('删除其他 IP 成功', async () => {
      mockGetClientIp.mockReturnValue('192.168.1.50');
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({}, { ip: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('delete', '/ip-whitelist/', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: 'IP已从白名单移除' });
      expect(mockUpdateOne).toHaveBeenCalledWith('admin_ips', { ipAddress: '192.168.1.100' }, { $set: { isActive: false } });
    });

    it('删除自己的 IP 需确认', async () => {
      mockGetClientIp.mockReturnValue('192.168.1.100');

      const req = createMockRequest({}, { ip: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('delete', '/ip-whitelist/', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '不能删除自己的IP，如需删除请确认',
        needConfirm: true,
      });
    });

    it('确认后删除自己的 IP 成功', async () => {
      mockGetClientIp.mockReturnValue('192.168.1.100');
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ confirm: true }, { ip: '192.168.1.100' });
      const respState = createMockResponse();

      await callRoute('delete', '/ip-whitelist/', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: 'IP已从白名单移除' });
    });

    it('IP 不存在返回 404', async () => {
      mockGetClientIp.mockReturnValue('192.168.1.50');
      mockUpdateOne.mockResolvedValue(false);

      const req = createMockRequest({}, { ip: '192.168.1.999' });
      const respState = createMockResponse();

      await callRoute('delete', '/ip-whitelist/', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: 'IP不存在' });
    });
  });

  /**
   * 测试组：POST /password 修改密码
   */
  describe('POST /password', () => {
    it('修改密码成功', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        passwordHash: 'old-hashed',
      });
      mockBcryptCompare.mockResolvedValue(true);

      const req = createMockRequest({
        oldPassword: 'old-password',
        newPassword: 'new-password-123',
        confirmPassword: 'new-password-123',
      });
      const respState = createMockResponse();

      await callRoute('post', '/password', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '密码修改成功' });
      expect(mockBcryptHash).toHaveBeenCalledWith('new-password-123', expect.any(Number));
      expect(mockUpdateOne).toHaveBeenCalledWith('admin_configs', { _id: 'config-id' }, expect.objectContaining({
        $set: expect.objectContaining({
          passwordHash: 'new-hashed-password',
          passwordUpdatedAt: expect.any(Date),
        }),
      }));
    });

    it('缺少密码字段返回 400', async () => {
      const req = createMockRequest({
        oldPassword: 'old',
        newPassword: 'new',
      });
      const respState = createMockResponse();

      await callRoute('post', '/password', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请填写所有密码字段' });
    });

    it('新密码与确认密码不一致返回 400', async () => {
      const req = createMockRequest({
        oldPassword: 'old',
        newPassword: 'new-password',
        confirmPassword: 'different',
      });
      const respState = createMockResponse();

      await callRoute('post', '/password', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '新密码与确认密码不一致' });
    });

    it('新密码长度不足6位返回 400', async () => {
      const req = createMockRequest({
        oldPassword: 'old',
        newPassword: '12345',
        confirmPassword: '12345',
      });
      const respState = createMockResponse();

      await callRoute('post', '/password', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '新密码长度不能少于6位' });
    });

    it('系统未初始化返回 400', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({
        oldPassword: 'old',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      });
      const respState = createMockResponse();

      await callRoute('post', '/password', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '系统未初始化' });
    });

    it('原密码错误返回 401', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        passwordHash: 'old-hashed',
      });
      mockBcryptCompare.mockResolvedValue(false);

      const req = createMockRequest({
        oldPassword: 'wrong-old',
        newPassword: 'new-password',
        confirmPassword: 'new-password',
      });
      const respState = createMockResponse();

      await callRoute('post', '/password', req, respState.res);

      expect(respState.statusCode).toBe(401);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '原密码错误' });
    });
  });

  /**
   * 测试组：GET /features 获取功能开关
   */
  describe('GET /features', () => {
    it('获取功能开关成功', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        features: {
          sensitiveWordCheck: true,
          auditLog: false,
          dataExport: true,
        },
      });

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/features', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          sensitiveWordCheck: true,
          auditLog: false,
          dataExport: true,
        },
      });
    });

    it('系统未初始化时返回默认值', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/features', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          sensitiveWordCheck: true,
          auditLog: true,
          dataExport: true,
        },
      });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/features', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取功能开关失败' });
    });
  });

  /**
   * 测试组：PUT /features 更新功能开关
   */
  describe('PUT /features', () => {
    it('更新功能开关成功并触发敏感词缓存清除', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        features: {
          sensitiveWordCheck: false,
          auditLog: true,
          dataExport: true,
        },
      });

      const req = createMockRequest({
        sensitiveWordCheck: true,
        auditLog: true,
        dataExport: true,
      });
      const respState = createMockResponse();

      await callRoute('put', '/features', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '功能开关已更新' });
      expect(mockUpdateOne).toHaveBeenCalledWith('admin_configs', { _id: 'config-id' }, expect.objectContaining({
        $set: expect.objectContaining({
          'features.sensitiveWordCheck': true,
          sensitiveWordEnabled: true,
        }),
      }));
      // sensitiveWordCheck 变更时应触发缓存清除
      expect(mockNotifySensitiveWordCacheClear).toHaveBeenCalled();
    });

    it('系统未初始化返回 400', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({
        sensitiveWordCheck: true,
        auditLog: true,
        dataExport: true,
      });
      const respState = createMockResponse();

      await callRoute('put', '/features', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '系统未初始化' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ sensitiveWordCheck: true });
      const respState = createMockResponse();

      await callRoute('put', '/features', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '更新功能开关失败' });
    });
  });

  /**
   * 测试组：GET /features/:key/evaluate 灰度规则评估
   */
  describe('GET /features/:key/evaluate', () => {
    it('全局开关启用且无灰度规则时返回可见', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        features: {
          sensitiveWordCheck: true,
          auditLog: true,
          dataExport: true,
        },
      });

      const req = createMockRequest({}, { key: 'sensitiveWordCheck' });
      const respState = createMockResponse();

      await callRoute('get', '/features/.*/evaluate', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          key: 'sensitiveWordCheck',
          visible: true,
          reason: 'global',
        },
      });
    });

    it('系统未初始化时返回默认可见', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { key: 'sensitiveWordCheck' });
      const respState = createMockResponse();

      await callRoute('get', '/features/.*/evaluate', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: { visible: true, reason: 'default' },
      });
    });

    it('功能开关不存在返回 404', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        features: {
          sensitiveWordCheck: true,
          auditLog: true,
          dataExport: true,
        },
      });

      const req = createMockRequest({}, { key: 'nonExistentFeature' });
      const respState = createMockResponse();

      await callRoute('get', '/features/.*/evaluate', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: expect.stringContaining('不存在') });
    });

    it('灰度规则匹配时返回可见', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        features: {
          sensitiveWordCheck: false,
          auditLog: true,
          dataExport: true,
          grayRules: {
            sensitiveWordCheck: [
              { field: 'userId', match: 'equals', value: 'special-user' },
            ],
          },
        },
      });

      const req = createMockRequest({}, { key: 'sensitiveWordCheck' }, { userId: 'special-user' });
      const respState = createMockResponse();

      await callRoute('get', '/features/.*/evaluate', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          visible: true,
          reason: 'gray_rule_matched',
        },
      });
    });

    it('灰度规则不匹配时返回不可见', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        features: {
          sensitiveWordCheck: false,
          auditLog: true,
          dataExport: true,
          grayRules: {
            sensitiveWordCheck: [
              { field: 'userId', match: 'equals', value: 'special-user' },
            ],
          },
        },
      });

      const req = createMockRequest({}, { key: 'sensitiveWordCheck' }, { userId: 'other-user' });
      const respState = createMockResponse();

      await callRoute('get', '/features/.*/evaluate', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          visible: false,
          reason: 'gray_rule_not_matched',
        },
      });
    });
  });

  /**
   * 测试组：GET /ai-providers 获取 AI 服务商配置
   */
  describe('GET /ai-providers', () => {
    it('获取 AI 服务商配置成功', async () => {
      mockFindOne.mockResolvedValue({
        _id: 'config-id',
        aiProviders: [
          { id: 'zhipu', name: '智谱GLM', url: 'https://api.zhipu.ai', apiKey: 'key1', model: 'glm-4', priority: 1 },
        ],
      });

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'zhipu', name: '智谱GLM' }),
        ]),
      });
    });

    it('未配置时返回空数组', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, data: [] });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取 AI 服务商配置失败' });
    });
  });

  /**
   * 测试组：PUT /ai-providers 保存 AI 服务商配置
   */
  describe('PUT /ai-providers', () => {
    it('保存 AI 服务商配置成功', async () => {
      mockFindOne.mockResolvedValue({ _id: 'config-id' });

      const req = createMockRequest([
        { id: 'zhipu', name: '智谱GLM', url: 'https://api.zhipu.ai', apiKey: 'key1', model: 'glm-4', priority: 1 },
      ]);
      const respState = createMockResponse();

      await callRoute('put', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: 'AI 服务商配置已保存' });
      expect(mockUpdateOne).toHaveBeenCalledWith('admin_configs', { _id: 'config-id' }, {
        $set: { aiProviders: expect.arrayContaining([expect.objectContaining({ id: 'zhipu' })]) },
      });
    });

    it('请求数据非数组返回 400', async () => {
      const req = createMockRequest({ notArray: true });
      const respState = createMockResponse();

      await callRoute('put', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请求数据必须是数组格式' });
    });

    it('缺少必填字段返回 400', async () => {
      const req = createMockRequest([
        { id: 'zhipu', name: '智谱GLM' }, // 缺少 url、apiKey、model
      ]);
      const respState = createMockResponse();

      await callRoute('put', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: expect.stringContaining('缺少必填字段') });
    });

    it('priority 非数字返回 400', async () => {
      const req = createMockRequest([
        { id: 'zhipu', name: '智谱GLM', url: 'https://api.zhipu.ai', apiKey: 'key1', model: 'glm-4', priority: 'high' as unknown as number },
      ]);
      const respState = createMockResponse();

      await callRoute('put', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: expect.stringContaining('priority 必须为数字') });
    });

    it('服务商 ID 重复返回 400', async () => {
      const req = createMockRequest([
        { id: 'zhipu', name: '智谱GLM', url: 'https://api.zhipu.ai', apiKey: 'key1', model: 'glm-4', priority: 1 },
        { id: 'zhipu', name: '智谱GLM2', url: 'https://api2.zhipu.ai', apiKey: 'key2', model: 'glm-4v', priority: 2 },
      ]);
      const respState = createMockResponse();

      await callRoute('put', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: expect.stringContaining('重复') });
    });

    it('系统未初始化返回 400', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest([
        { id: 'zhipu', name: '智谱GLM', url: 'https://api.zhipu.ai', apiKey: 'key1', model: 'glm-4', priority: 1 },
      ]);
      const respState = createMockResponse();

      await callRoute('put', '/ai-providers', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '系统未初始化' });
    });
  });
});
