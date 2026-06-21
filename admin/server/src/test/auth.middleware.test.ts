import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

/**
 * auth 中间件单元测试
 *
 * 测试目标：
 * - requireAuth 已认证 session 放行
 * - requireAuth 未认证请求拒绝（返回 401）
 * - requireAuth session 过期处理（超过 24 小时不活动）
 * - requireAuth 异常流程
 * - requireRole 角色校验通过
 * - requireRole 角色不匹配拒绝（返回 403）
 * - requireRole 未分配角色拒绝（返回 403）
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 */
const { mockFindOne, mockUpdateOne } = vi.hoisted(() => ({
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
}));

/**
 * 模拟 adminDB 模块
 */
vi.mock('../config/database', () => ({
  adminDB: {
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
    find: vi.fn().mockResolvedValue([]),
    insertOne: vi.fn().mockResolvedValue('id'),
    countDocuments: vi.fn().mockResolvedValue(0),
    aggregate: vi.fn().mockResolvedValue([]),
    isConnected: vi.fn().mockReturnValue(true),
  },
}));

import { requireAuth, requireRole } from '../middleware/auth';
import { AdminRole } from '../types';

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
 * 模拟 next 函数状态对象
 */
interface MockNextState {
  next: NextFunction;
  called: boolean;
  callCount: number;
}

/**
 * 构造模拟的 next 函数
 * @returns 包含 next 函数及调用状态的状态对象
 */
function createMockNext(): MockNextState {
  const state: MockNextState = {
    next: null as unknown as NextFunction,
    called: false,
    callCount: 0,
  };
  const next = (() => {
    state.called = true;
    state.callCount += 1;
  }) as NextFunction;
  state.next = next;
  return state;
}

/**
 * 构造模拟的 Express 请求对象
 * @param sessionId - session 中的 sessionId（undefined 表示未登录）
 * @param adminRole - 已挂载的管理员角色（用于 requireRole 测试）
 * @returns 模拟的 Request 对象
 */
function createMockRequest(sessionId?: string, adminRole?: AdminRole): Request {
  const req = {
    session: sessionId ? { sessionId } : undefined,
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
  if (adminRole !== undefined) {
    (req as unknown as Record<string, unknown>).adminRole = adminRole;
  }
  return req;
}

describe('requireAuth 中间件', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateOne.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：已认证 session 放行
   */
  it('已认证 session 放行，挂载管理员信息到请求对象', async () => {
    const recentTime = new Date();
    mockFindOne.mockResolvedValue({
      sessionId: 'valid-session-id',
      ipAddress: '192.168.1.100',
      nickname: '管理员小明',
      role: 'super_admin' as AdminRole,
      lastActivityAt: recentTime,
      isActive: true,
    });

    const req = createMockRequest('valid-session-id');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
    // 验证管理员信息已挂载到请求对象
    expect((req as unknown as Record<string, unknown>).adminIp).toBe('192.168.1.100');
    expect((req as unknown as Record<string, unknown>).adminNickname).toBe('管理员小明');
    expect((req as unknown as Record<string, unknown>).adminRole).toBe('super_admin');
    // 验证更新了最后活动时间
    expect(mockUpdateOne).toHaveBeenCalledWith('admin_sessions', { sessionId: 'valid-session-id' }, expect.objectContaining({
      $set: expect.objectContaining({ lastActivityAt: expect.any(Date) }),
    }));
  });

  /**
   * 测试组：未携带 sessionId 拒绝（返回 401）
   */
  it('未携带 sessionId 拒绝，返回 401', async () => {
    const req = createMockRequest(undefined);
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(401);
    expect(respState.jsonBody).toMatchObject({ success: false, error: '未登录，请先登录' });
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  /**
   * 测试组：session 不存在或已失效拒绝（返回 401）
   */
  it('session 不存在或已失效拒绝，返回 401', async () => {
    mockFindOne.mockResolvedValue(null);

    const req = createMockRequest('invalid-session-id');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(401);
    expect(respState.jsonBody).toMatchObject({ success: false, error: '会话已过期，请重新登录' });
  });

  /**
   * 测试组：session 不活跃超过 24 小时拒绝（返回 401）
   */
  it('session 超过 24 小时不活动拒绝，返回 401 并标记为非活跃', async () => {
    // 模拟 25 小时前的最后活动时间
    const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    mockFindOne.mockResolvedValue({
      sessionId: 'expired-session',
      ipAddress: '192.168.1.100',
      nickname: '管理员',
      lastActivityAt: expiredTime,
      isActive: true,
    });

    const req = createMockRequest('expired-session');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(401);
    expect(respState.jsonBody).toMatchObject({ success: false, error: '会话已过期，请重新登录' });
    // 验证已将 session 标记为非活跃
    expect(mockUpdateOne).toHaveBeenCalledWith('admin_sessions', { sessionId: 'expired-session' }, { $set: { isActive: false } });
  });

  /**
   * 测试组：session 不活跃刚好 24 小时内放行（边界情况）
   */
  it('session 不活跃刚好 23 小时放行（边界情况）', async () => {
    const recentTime = new Date(Date.now() - 23 * 60 * 60 * 1000);
    mockFindOne.mockResolvedValue({
      sessionId: 'valid-session',
      ipAddress: '192.168.1.100',
      nickname: '管理员',
      lastActivityAt: recentTime,
      isActive: true,
    });

    const req = createMockRequest('valid-session');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：数据库异常时返回 500
   */
  it('数据库异常时返回 500', async () => {
    mockFindOne.mockRejectedValue(new Error('数据库连接失败'));

    const req = createMockRequest('valid-session');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(500);
    expect(respState.jsonBody).toMatchObject({ success: false, error: '认证检查失败' });
  });

  /**
   * 测试组：session 无 role 字段时不挂载 adminRole
   */
  it('session 无 role 字段时不挂载 adminRole', async () => {
    const recentTime = new Date();
    mockFindOne.mockResolvedValue({
      sessionId: 'valid-session',
      ipAddress: '192.168.1.100',
      nickname: '管理员',
      // 无 role 字段
      lastActivityAt: recentTime,
      isActive: true,
    });

    const req = createMockRequest('valid-session');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await requireAuth(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect((req as unknown as Record<string, unknown>).adminRole).toBeUndefined();
  });
});

describe('requireRole 中间件', () => {
  /**
   * 测试组：角色匹配时放行
   */
  it('角色匹配时放行', () => {
    const req = createMockRequest('session-id', 'super_admin');
    const respState = createMockResponse();
    const nextState = createMockNext();

    const middleware = requireRole('super_admin');
    middleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：角色在允许列表中放行（多角色场景）
   */
  it('角色在允许列表中放行（多角色场景）', () => {
    const req = createMockRequest('session-id', 'operator');
    const respState = createMockResponse();
    const nextState = createMockNext();

    const middleware = requireRole('super_admin', 'operator', 'auditor');
    middleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：角色不匹配时拒绝（返回 403）
   */
  it('角色不匹配时拒绝，返回 403', () => {
    const req = createMockRequest('session-id', 'readonly');
    const respState = createMockResponse();
    const nextState = createMockNext();

    const middleware = requireRole('super_admin', 'operator');
    middleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(403);
    expect(respState.jsonBody).toMatchObject({ success: false, error: '权限不足，无法执行此操作' });
  });

  /**
   * 测试组：未分配角色时拒绝（返回 403）
   */
  it('未分配角色时拒绝，返回 403', () => {
    const req = createMockRequest('session-id');
    const respState = createMockResponse();
    const nextState = createMockNext();

    const middleware = requireRole('super_admin');
    middleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(403);
    expect(respState.jsonBody).toMatchObject({ success: false, error: '当前账户未分配角色，无权访问' });
  });
});
