import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * AI 模型管理路由单元测试
 *
 * 测试目标：
 * - GET /    获取列表
 * - POST /   创建配置
 * - PUT /:id 更新配置
 * - DELETE /:id 删除配置
 * - PUT /:id/default 设置默认
 * - PUT /:id/toggle 切换启用状态
 *
 * 同时验证变更端点调用 notifyAIModelsRefresh
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * aiModelService 所有方法均 mock，使路由测试与 service 解耦
 */
const {
  mockGetAll,
  mockCreate,
  mockUpdate,
  mockDelete,
  mockSetDefault,
  mockNotifyAIModelsRefresh,
} = vi.hoisted(() => ({
  mockGetAll: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockSetDefault: vi.fn(),
  mockNotifyAIModelsRefresh: vi.fn(),
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
  requireRole: (..._roles: unknown[]) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

/**
 * 模拟 auditLog 中间件，直接放行（路由文件未使用但保留兼容）
 */
vi.mock('../middleware/auditLog', () => ({
  auditLog: (_action: string, _targetType: string) => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

/**
 * 模拟 aiModelService
 */
vi.mock('../services/aiModelService', () => ({
  aiModelService: {
    getAll: mockGetAll,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
    setDefault: mockSetDefault,
  },
}));

/**
 * 模拟 cacheNotify 服务
 * 仅 mock 路由实际使用的 notifyAIModelsRefresh
 */
vi.mock('../services/cacheNotify', () => ({
  notifyAIModelsRefresh: mockNotifyAIModelsRefresh,
  notifyVisitorCacheClear: vi.fn(),
  notifyWorkspaceCacheClear: vi.fn(),
  notifySensitiveWordCacheClear: vi.fn(),
  notifyAllCacheClear: vi.fn(),
  notifyFeedbackPush: vi.fn(),
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
}));

import aiModelsRouter from '../routes/aiModels';

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
): Request {
  return {
    body,
    params,
    query: {},
    headers: {},
    session: { sessionId: 'test-session-id' },
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

/**
 * 从路由中提取指定 HTTP 方法和路径的处理函数链
 */
function findRouteHandler(
  method: string,
  pathPattern: string,
): Array<(req: Request, res: Response, next: NextFunction) => void> {
  const stack = (
    aiModelsRouter as unknown as {
      stack: Array<{
        route: {
          methods: Record<string, boolean>;
          path: string;
          stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }>;
        };
      }>;
    }
  ).stack;
  for (const layer of stack) {
    if (!layer.route) continue;
    if (layer.route.methods[method] && new RegExp(pathPattern).test(layer.route.path)) {
      return layer.route.stack.map((s) => s.handle);
    }
  }
  throw new Error(`未找到路由: ${method.toUpperCase()} ${pathPattern}`);
}

/**
 * 调用指定路由的处理函数链
 * 模拟 Express 中间件链式调用
 */
async function callRoute(
  method: string,
  pathPattern: string,
  req: Request,
  res: Response,
): Promise<void> {
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

describe('AI 模型管理路由 aiModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyAIModelsRefresh.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET / 获取列表
   */
  describe('GET /', () => {
    it('正常返回模型列表', async () => {
      const list = [
        {
          _id: 'id-1',
          name: '智谱GLM',
          provider: 'zhipu',
          apiKeyMasked: 'sk-***4567',
          baseUrl: 'https://open.bigmodel.cn',
          modelId: 'glm-4-flash',
          temperature: 0.7,
          maxTokens: 2048,
          isActive: true,
          isDefault: true,
          priority: 1,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-06-01T00:00:00.000Z',
        },
      ];
      mockGetAll.mockResolvedValue(list);

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: list,
      });
      expect(mockGetAll).toHaveBeenCalledTimes(1);
      // GET 不应触发刷新通知
      expect(mockNotifyAIModelsRefresh).not.toHaveBeenCalled();
    });

    it('service 抛错时返回 500', async () => {
      mockGetAll.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '数据库异常',
      });
    });
  });

  /**
   * 测试组：POST / 创建配置
   */
  describe('POST /', () => {
    it('正常创建时应返回 200 与新 id，并调用 notifyAIModelsRefresh', async () => {
      mockCreate.mockResolvedValue('new-id-123');

      const req = createMockRequest({
        name: '智谱GLM',
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
        baseUrl: 'https://open.bigmodel.cn',
        temperature: 0.7,
        maxTokens: 2048,
        isActive: true,
        isDefault: false,
        priority: 1,
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: { id: 'new-id-123' },
        message: 'AI 模型配置已创建',
      });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockNotifyAIModelsRefresh).toHaveBeenCalledTimes(1);
    });

    it('name 缺失时返回 400', async () => {
      const req = createMockRequest({
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '模型名称不能为空',
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('name 仅含空白字符时返回 400', async () => {
      const req = createMockRequest({
        name: '   ',
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(400);
    });

    it('provider 非法时返回 400', async () => {
      const req = createMockRequest({
        name: '测试模型',
        provider: 'claude',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: expect.stringContaining('服务商类型无效'),
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('apiKey 缺失时返回 400', async () => {
      const req = createMockRequest({
        name: '测试模型',
        provider: 'zhipu',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: 'API Key 不能为空',
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('apiKey 仅含空白字符时返回 400', async () => {
      const req = createMockRequest({
        name: '测试模型',
        provider: 'zhipu',
        apiKey: '   ',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(400);
    });

    it('modelId 缺失时返回 400', async () => {
      const req = createMockRequest({
        name: '测试模型',
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '模型 ID 不能为空',
      });
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('service.create 返回 null 时返回 500', async () => {
      mockCreate.mockResolvedValue(null);

      const req = createMockRequest({
        name: '测试模型',
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '创建 AI 模型配置失败',
      });
      expect(mockNotifyAIModelsRefresh).not.toHaveBeenCalled();
    });

    it('service.create 抛错时返回 500', async () => {
      mockCreate.mockRejectedValue(new Error('数据库写入失败'));

      const req = createMockRequest({
        name: '测试模型',
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '数据库写入失败',
      });
    });

    it('未传 temperature/maxTokens/priority 时应使用默认值传给 service', async () => {
      mockCreate.mockResolvedValue('new-id');

      const req = createMockRequest({
        name: '测试模型',
        provider: 'zhipu',
        apiKey: 'sk-key-1234567',
        modelId: 'glm-4-flash',
      });
      const respState = createMockResponse();

      await callRoute('post', '^/$', req, respState.res);

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.7,
        maxTokens: 2048,
        priority: 99,
        isActive: true,
        isDefault: false,
        baseUrl: '',
      }));
    });
  });

  /**
   * 测试组：PUT /:id 更新配置
   */
  describe('PUT /:id', () => {
    it('正常更新时应返回 200 并调用 notifyAIModelsRefresh', async () => {
      mockUpdate.mockResolvedValue(true);

      const req = createMockRequest(
        { name: '新名称', baseUrl: 'https://new.url' },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: 'AI 模型配置已更新',
      });
      expect(mockUpdate).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        expect.objectContaining({ name: '新名称', baseUrl: 'https://new.url' })
      );
      expect(mockNotifyAIModelsRefresh).toHaveBeenCalledTimes(1);
    });

    it('provider 非法时返回 400', async () => {
      const req = createMockRequest(
        { provider: 'claude' },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: expect.stringContaining('服务商类型无效'),
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('service.update 返回 false 时返回 404', async () => {
      mockUpdate.mockResolvedValue(false);

      const req = createMockRequest(
        { name: '新名称' },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '模型配置不存在或无更新内容',
      });
      expect(mockNotifyAIModelsRefresh).not.toHaveBeenCalled();
    });

    it('service.update 抛错时返回 500', async () => {
      mockUpdate.mockRejectedValue(new Error('更新失败'));

      const req = createMockRequest(
        { name: '新名称' },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '更新失败',
      });
    });
  });

  /**
   * 测试组：DELETE /:id 删除配置
   */
  describe('DELETE /:id', () => {
    it('正常删除时应返回 200 并调用 notifyAIModelsRefresh', async () => {
      mockDelete.mockResolvedValue(true);

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: 'AI 模型配置已删除',
      });
      expect(mockDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockNotifyAIModelsRefresh).toHaveBeenCalledTimes(1);
    });

    it('service.delete 返回 false 时返回 404', async () => {
      mockDelete.mockResolvedValue(false);

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '模型配置不存在或删除失败',
      });
      expect(mockNotifyAIModelsRefresh).not.toHaveBeenCalled();
    });

    it('service.delete 抛错时返回 500', async () => {
      mockDelete.mockRejectedValue(new Error('删除失败'));

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('delete', '/[^/]+$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '删除失败',
      });
    });
  });

  /**
   * 测试组：PUT /:id/default 设置默认模型
   */
  describe('PUT /:id/default', () => {
    it('正常设置时应返回 200 并调用 notifyAIModelsRefresh', async () => {
      mockSetDefault.mockResolvedValue(true);

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/default$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: '已设置为默认模型',
      });
      expect(mockSetDefault).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(mockNotifyAIModelsRefresh).toHaveBeenCalledTimes(1);
    });

    it('service.setDefault 返回 false 时返回 404', async () => {
      mockSetDefault.mockResolvedValue(false);

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/default$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '模型配置不存在或设置默认失败',
      });
      expect(mockNotifyAIModelsRefresh).not.toHaveBeenCalled();
    });

    it('service.setDefault 抛错时返回 500', async () => {
      mockSetDefault.mockRejectedValue(new Error('设置失败'));

      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/default$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '设置失败',
      });
    });
  });

  /**
   * 测试组：PUT /:id/toggle 切换启用状态
   */
  describe('PUT /:id/toggle', () => {
    it('正常切换为 true 时应返回 200 并调用 notifyAIModelsRefresh', async () => {
      mockUpdate.mockResolvedValue(true);

      const req = createMockRequest(
        { isActive: true },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: { isActive: true },
        message: '模型状态已切换',
      });
      expect(mockUpdate).toHaveBeenCalledWith('507f1f77bcf86cd799439011', { isActive: true });
      expect(mockNotifyAIModelsRefresh).toHaveBeenCalledTimes(1);
    });

    it('正常切换为 false 时应返回 200', async () => {
      mockUpdate.mockResolvedValue(true);

      const req = createMockRequest(
        { isActive: false },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: { isActive: false },
      });
    });

    it('isActive 非布尔值时返回 400', async () => {
      const req = createMockRequest(
        { isActive: 'true' },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: 'isActive 必须为布尔值',
      });
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('isActive 缺失时返回 400', async () => {
      const req = createMockRequest({}, { id: '507f1f77bcf86cd799439011' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(400);
    });

    it('isActive 为数字时返回 400', async () => {
      const req = createMockRequest(
        { isActive: 1 },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(400);
    });

    it('service.update 返回 false 时返回 404', async () => {
      mockUpdate.mockResolvedValue(false);

      const req = createMockRequest(
        { isActive: true },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '模型配置不存在或更新失败',
      });
      expect(mockNotifyAIModelsRefresh).not.toHaveBeenCalled();
    });

    it('service.update 抛错时返回 500', async () => {
      mockUpdate.mockRejectedValue(new Error('切换失败'));

      const req = createMockRequest(
        { isActive: true },
        { id: '507f1f77bcf86cd799439011' },
      );
      const respState = createMockResponse();

      await callRoute('put', '/.*/toggle$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({
        success: false,
        error: '切换失败',
      });
    });
  });
});
