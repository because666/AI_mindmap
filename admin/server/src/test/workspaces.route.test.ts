import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * workspaces 路由单元测试
 *
 * 测试目标：
 * - 工作区列表查询（分页、搜索）
 * - 工作区详情查询
 * - 关闭工作区（缓存清除通知触发）
 * - 工作区排行
 * - 切换特别关注
 * - 工作区通知
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
  mockCountDocuments,
  mockAggregate,
  mockNotifyWorkspaceCacheClear,
} = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockFind: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockInsertOne: vi.fn(),
  mockCountDocuments: vi.fn(),
  mockAggregate: vi.fn(),
  mockNotifyWorkspaceCacheClear: vi.fn(),
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
  notifyWorkspaceCacheClear: mockNotifyWorkspaceCacheClear,
  notifyVisitorCacheClear: vi.fn(),
  notifySensitiveWordCacheClear: vi.fn(),
  notifyAllCacheClear: vi.fn(),
  notifyFeedbackPush: vi.fn(),
  CircuitBreakerOpenError: class CircuitBreakerOpenError extends Error {},
}));

import workspacesRouter from '../routes/workspaces';

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
  const stack = (workspacesRouter as unknown as { stack: Array<{ route: { methods: Record<string, boolean>; path: string; stack: Array<{ handle: (req: Request, res: Response, next: NextFunction) => void }> } }> }).stack;
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

describe('workspaces 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifyWorkspaceCacheClear.mockResolvedValue(undefined);
    mockUpdateOne.mockResolvedValue(true);
    mockCountDocuments.mockResolvedValue(0);
    mockAggregate.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：GET / 工作区列表查询
   */
  describe('GET /', () => {
    it('查询工作区列表成功', async () => {
      mockFind.mockImplementation(async (_collection: string, _filter: unknown) => {
        // 第二次调用是查询 visitors（owner 信息）
        return [
          {
            _id: { toString: () => 'obj-id-1' },
            id: 'ws-1',
            name: '工作区A',
            description: '描述',
            type: 'public',
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-06-01'),
            ownerId: 'visitor-1',
            members: [{ visitorId: 'visitor-1', role: 'owner' }],
          },
        ];
      });
      mockCountDocuments.mockResolvedValue(1);
      mockAggregate.mockResolvedValue([{ _id: 'ws-1', count: 5 }]);

      const req = createMockRequest({}, {}, { page: '1', limit: '20' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          items: expect.arrayContaining([
            expect.objectContaining({
              id: 'ws-1',
              name: '工作区A',
            }),
          ]),
          total: 1,
        },
      });
    });

    it('按搜索关键词筛选工作区', async () => {
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const req = createMockRequest({}, {}, { search: '测试' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockFind).toHaveBeenCalledWith('workspaces', expect.objectContaining({
        $or: expect.arrayContaining([
          expect.objectContaining({ name: expect.objectContaining({ $regex: '测试' }) }),
        ]),
      }), expect.any(Object));
    });

    it('数据库异常时返回 500', async () => {
      mockFind.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '获取工作区列表失败' });
    });
  });

  /**
   * 测试组：GET /:id 工作区详情
   */
  describe('GET /:id', () => {
    it('查询工作区详情成功', async () => {
      mockFindOne.mockResolvedValue({
        id: 'ws-1',
        name: '工作区A',
        description: '描述',
        type: 'public',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1' }, { visitorId: 'visitor-2' }],
      });
      mockCountDocuments.mockResolvedValue(10);

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('get', '^/:id$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        data: {
          id: 'ws-1',
          name: '工作区A',
          stats: {
            memberCount: 2,
            nodeCount: 10,
          },
        },
      });
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('get', '^/:id$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });
  });

  /**
   * 测试组：POST /:id/close 关闭工作区
   */
  describe('POST /:id/close', () => {
    it('关闭工作区成功并触发缓存清除通知', async () => {
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ reason: '违规内容' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/close$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '工作区已关闭' });
      expect(mockUpdateOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isClosed: true,
          closeReason: '违规内容',
        }),
      }));
      // 验证缓存清除通知被触发
      expect(mockNotifyWorkspaceCacheClear).toHaveBeenCalledWith('ws-1');
    });

    it('未提供关闭原因返回 400', async () => {
      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/close$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供关闭原因' });
    });

    it('工作区不存在返回 404', async () => {
      mockUpdateOne.mockResolvedValue(false);

      const req = createMockRequest({ reason: '关闭' }, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/close$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });

    it('数据库异常时返回 500', async () => {
      mockUpdateOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ reason: '关闭' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/close$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '关闭工作区失败' });
    });
  });

  /**
   * 测试组：GET /ranking 工作区排行
   */
  describe('GET /ranking', () => {
    it('查询工作区排行成功', async () => {
      mockFind.mockResolvedValue([
        {
          id: 'ws-1',
          name: '工作区A',
          starred: true,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'ws-2',
          name: '工作区B',
          starred: false,
          createdAt: new Date('2024-01-02'),
        },
      ]);
      mockAggregate.mockResolvedValue([{ _id: 'ws-1', count: 10 }]);

      const req = createMockRequest({}, {}, { sortBy: 'nodeCount', limit: '10' });
      const respState = createMockResponse();

      await callRoute('get', '/ranking', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { data: Array<{ workspaceId: string; starred: boolean }> };
      expect(body.data).toHaveLength(2);
      // 特别关注的应排在前面
      expect(body.data[0].workspaceId).toBe('ws-1');
    });

    it('无工作区时返回空数组', async () => {
      mockFind.mockResolvedValue([]);

      const req = createMockRequest();
      const respState = createMockResponse();

      await callRoute('get', '/ranking', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, data: [] });
    });

    it('无效的排序维度默认使用 nodeCount', async () => {
      mockFind.mockResolvedValue([
        { id: 'ws-1', name: '工作区A', starred: false, createdAt: new Date() },
      ]);
      mockAggregate.mockResolvedValue([]);

      const req = createMockRequest({}, {}, { sortBy: 'invalid' });
      const respState = createMockResponse();

      await callRoute('get', '/ranking', req, respState.res);

      expect(respState.statusCode).toBe(200);
    });
  });

  /**
   * 测试组：PUT /:id/star 切换特别关注
   */
  describe('PUT /:id/star', () => {
    it('标记特别关注成功', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ starred: true }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/star$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '已标记为特别关注' });
    });

    it('取消特别关注成功', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ starred: false }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/star$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '已取消特别关注' });
    });

    it('starred 参数非布尔值返回 400', async () => {
      const req = createMockRequest({ starred: 'yes' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/star$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: 'starred 参数必须为布尔值' });
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({ starred: true }, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('put', '/.*/star$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });
  });

  /**
   * 测试组：POST /:id/notify 工作区通知
   */
  describe('POST /:id/notify', () => {
    it('向工作区成员发送通知成功', async () => {
      mockFindOne.mockResolvedValue({
        id: 'ws-1',
        name: '工作区A',
        members: [
          { visitorId: 'visitor-1' },
          { visitorId: 'visitor-2' },
        ],
      });
      mockInsertOne.mockResolvedValue('message-id');

      const req = createMockRequest({ title: '通知标题', content: '通知内容' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notify$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({
        success: true,
        message: '通知已发送',
        memberCount: 2,
      });
      expect(mockInsertOne).toHaveBeenCalledWith('push_messages', expect.objectContaining({
        type: 'workspace_notification',
        title: '通知标题',
        targetUserIds: ['visitor-1', 'visitor-2'],
      }));
    });

    it('未提供标题或内容返回 400', async () => {
      const req = createMockRequest({ title: '只有标题' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notify$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供标题和内容' });
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({ title: '标题', content: '内容' }, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/notify$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });
  });

  /**
   * 测试组：POST /:id/pin 置顶工作区
   */
  describe('POST /:id/pin', () => {
    it('置顶工作区成功，应更新 isPinned 与 pinnedAt 并触发缓存清除通知', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '已置顶工作区' });
      // 验证 isPinned=true 与 pinnedAt 已被设置
      expect(mockUpdateOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isPinned: true,
          pinnedAt: expect.any(Date),
        }),
      }));
      // 验证缓存清除通知被触发
      expect(mockNotifyWorkspaceCacheClear).toHaveBeenCalledWith('ws-1');
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('数据库更新失败返回 500', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(false);

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '置顶工作区失败' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '置顶工作区失败' });
    });
  });

  /**
   * 测试组：DELETE /:id/pin 取消置顶
   */
  describe('DELETE /:id/pin', () => {
    it('取消置顶成功，应将 isPinned 设为 false 并清空 pinnedAt', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A', isPinned: true, pinnedAt: new Date() });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('delete', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '已取消置顶' });
      expect(mockUpdateOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isPinned: false,
          pinnedAt: null,
        }),
      }));
      expect(mockNotifyWorkspaceCacheClear).toHaveBeenCalledWith('ws-1');
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('delete', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });

    it('数据库更新失败返回 500', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(false);

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('delete', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '取消置顶失败' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('delete', '/.*/pin$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '取消置顶失败' });
    });
  });

  /**
   * 测试组：GET / 列表返回 isPinned/pinnedAt 字段
   */
  describe('GET / 置顶字段', () => {
    it('置顶工作区应返回 isPinned=true 与 pinnedAt 字符串', async () => {
      const pinnedAt = new Date('2025-06-15T10:00:00.000Z');
      mockFind.mockImplementation(async () => [
        {
          _id: { toString: () => 'obj-id-1' },
          id: 'ws-1',
          name: '置顶工作区',
          description: '',
          type: 'public',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-06-01'),
          ownerId: 'visitor-1',
          members: [{ visitorId: 'visitor-1', role: 'owner' }],
          isPinned: true,
          pinnedAt,
        },
      ]);
      mockCountDocuments.mockResolvedValue(1);
      mockAggregate.mockResolvedValue([]);

      const req = createMockRequest({}, {}, { page: '1', limit: '20' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { data: { items: Array<{ isPinned?: boolean; pinnedAt?: string }> } };
      expect(body.data.items[0].isPinned).toBe(true);
      // pinnedAt 应被序列化为 ISO 字符串
      expect(typeof body.data.items[0].pinnedAt).toBe('string');
      expect(body.data.items[0].pinnedAt).toBe(pinnedAt.toISOString());
    });

    it('未置顶工作区应返回 isPinned=false', async () => {
      mockFind.mockImplementation(async () => [
        {
          _id: { toString: () => 'obj-id-2' },
          id: 'ws-2',
          name: '普通工作区',
          description: '',
          type: 'public',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-06-01'),
          ownerId: 'visitor-1',
          members: [],
          // 不设置 isPinned/pinnedAt，模拟未置顶状态
        },
      ]);
      mockCountDocuments.mockResolvedValue(1);
      mockAggregate.mockResolvedValue([]);

      const req = createMockRequest({}, {}, { page: '1', limit: '20' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      const body = respState.jsonBody as { data: { items: Array<{ isPinned?: boolean; pinnedAt?: string }> } };
      expect(body.data.items[0].isPinned).toBe(false);
      expect(body.data.items[0].pinnedAt).toBeUndefined();
    });

    it('列表查询排序参数应包含 isPinned 与 pinnedAt', async () => {
      mockFind.mockResolvedValue([]);
      mockCountDocuments.mockResolvedValue(0);

      const req = createMockRequest({}, {}, { page: '1', limit: '20' });
      const respState = createMockResponse();

      await callRoute('get', '^/$', req, respState.res);

      // 验证 find 调用时第三参数 sort 字段包含 isPinned/pinnedAt/createdAt
      expect(mockFind).toHaveBeenCalledWith('workspaces', expect.any(Object), expect.objectContaining({
        sort: expect.objectContaining({
          isPinned: -1,
          pinnedAt: -1,
          createdAt: -1,
        }),
      }));
    });
  });

  /**
   * 测试组：POST /:id/ban 封禁工作区
   */
  describe('POST /:id/ban', () => {
    it('封禁工作区成功（永久封禁）', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ reason: '违规内容' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '工作区已封禁' });
      expect(mockUpdateOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isBanned: true,
          banReason: '违规内容',
          bannedAt: expect.any(Date),
        }),
      }));
      expect(mockNotifyWorkspaceCacheClear).toHaveBeenCalledWith('ws-1');
    });

    it('封禁工作区成功（带有效期）', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A' });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({ reason: '临时违规', duration: 24 }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(mockUpdateOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isBanned: true,
          banReason: '临时违规',
          banExpiresAt: expect.any(Date),
        }),
      }));
    });

    it('未提供封禁原因返回 400', async () => {
      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(400);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '请提供封禁原因' });
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({ reason: '违规' }, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({ reason: '违规' }, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/ban$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '封禁工作区失败' });
    });
  });

  /**
   * 测试组：POST /:id/unban 解封工作区
   */
  describe('POST /:id/unban', () => {
    it('解封工作区成功', async () => {
      mockFindOne.mockResolvedValue({ id: 'ws-1', name: '工作区A', isBanned: true });
      mockUpdateOne.mockResolvedValue(true);

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/unban$', req, respState.res);

      expect(respState.statusCode).toBe(200);
      expect(respState.jsonBody).toMatchObject({ success: true, message: '工作区已解封' });
      expect(mockUpdateOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' }, expect.objectContaining({
        $set: expect.objectContaining({
          isBanned: false,
          banReason: null,
          banExpiresAt: null,
          unbannedAt: expect.any(Date),
        }),
      }));
      expect(mockNotifyWorkspaceCacheClear).toHaveBeenCalledWith('ws-1');
    });

    it('工作区不存在返回 404', async () => {
      mockFindOne.mockResolvedValue(null);

      const req = createMockRequest({}, { id: 'nonexistent' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/unban$', req, respState.res);

      expect(respState.statusCode).toBe(404);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '工作区不存在' });
    });

    it('数据库异常时返回 500', async () => {
      mockFindOne.mockRejectedValue(new Error('数据库异常'));

      const req = createMockRequest({}, { id: 'ws-1' });
      const respState = createMockResponse();

      await callRoute('post', '/.*/unban$', req, respState.res);

      expect(respState.statusCode).toBe(500);
      expect(respState.jsonBody).toMatchObject({ success: false, error: '解封工作区失败' });
    });
  });
});
