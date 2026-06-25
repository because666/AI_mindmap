import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AdminIP } from '../types';

/**
 * 使用 vi.hoisted 定义 mock 函数，确保 vi.mock 工厂函数能访问到
 * vi.mock 会被提升到文件顶部，普通变量在工厂执行时尚未初始化
 */
const { mockFind } = vi.hoisted(() => ({
  mockFind: vi.fn(),
}));

/**
 * 模拟 adminDB 模块，避免真实数据库连接
 * 通过 mockFind 控制每次 find 查询的返回值
 */
vi.mock('../config/database', () => ({
  adminDB: {
    find: mockFind,
  },
}));

import { ipWhitelistMiddleware, getClientIp, resetIpWhitelistCache } from '../middleware/ipWhitelist';

/**
 * 构造模拟的 Express 请求对象
 * @param ip - 客户端 IP（设置到 socket.remoteAddress）
 * @param forwardedFor - 可选的 x-forwarded-for 头部值
 * @returns 模拟的 Request 对象
 */
function createMockRequest(ip: string, forwardedFor?: string): Request {
  const headers: Record<string, string | string[] | undefined> = {};
  if (forwardedFor !== undefined) {
    headers['x-forwarded-for'] = forwardedFor;
  }
  return {
    headers,
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

/**
 * 模拟响应状态对象
 * 通过引用传递，确保中间件调用 status/json 后能读取到最新值
 */
interface MockResponseState {
  res: Response;
  statusCode: number;
  jsonBody: unknown;
}

/**
 * 构造模拟的 Express 响应对象
 * 返回 state 对象引用，中间件调用 status/json 后通过 state 读取最新值
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
 * 返回 state 对象引用，next 被调用后通过 state.called 读取最新值
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
 * 设置 adminDB.find 的返回值
 * @param ips - 白名单 IP 文档列表
 */
function setWhitelistResult(ips: AdminIP[]): void {
  mockFind.mockResolvedValue(ips);
}

describe('ipWhitelistMiddleware', () => {
  beforeEach(() => {
    // 每个测试前重置缓存与 mock 状态
    resetIpWhitelistCache();
    mockFind.mockReset();
    // 默认使用真实定时器
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 测试组：白名单为空时放行所有请求
   */
  it('白名单为空时放行所有请求', async () => {
    setWhitelistResult([]);
    const req = createMockRequest('192.168.1.100');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试组：白名单为空时连续多次请求只查库一次（缓存生效）
   */
  it('白名单为空时连续请求复用缓存，仅查库一次', async () => {
    setWhitelistResult([]);
    const req = createMockRequest('10.0.0.1');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);
    await ipWhitelistMiddleware(req, respState.res, nextState.next);
    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试组：白名单非空时拦截非白名单 IP
   */
  it('白名单非空时拦截非白名单 IP，返回 403', async () => {
    setWhitelistResult([
      { ipAddress: '192.168.1.1', nickname: 'admin', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);
    const req = createMockRequest('10.0.0.999');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(403);
    expect(respState.jsonBody).toEqual({ success: false, error: 'IP不在白名单' });
  });

  /**
   * 测试组：白名单中的 IP 正常放行
   */
  it('白名单中的 IP 正常放行', async () => {
    setWhitelistResult([
      { ipAddress: '192.168.1.50', nickname: 'admin', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);
    const req = createMockRequest('192.168.1.50');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：通过 x-forwarded-for 获取的真实 IP 在白名单中时放行
   */
  it('通过 x-forwarded-for 获取的 IP 在白名单中时放行', async () => {
    setWhitelistResult([
      { ipAddress: '203.0.113.5', nickname: 'office', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);
    const req = createMockRequest('127.0.0.1', '203.0.113.5, 10.0.0.1');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：CIDR 网段匹配 - IP 在网段内放行
   */
  it('CIDR 匹配：IP 在白名单网段内时放行', async () => {
    setWhitelistResult([
      { ipAddress: '192.168.1.0/24', nickname: 'office-subnet', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);
    const req = createMockRequest('192.168.1.100');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：CIDR 网段匹配 - IP 不在网段内拦截
   */
  it('CIDR 匹配：IP 不在白名单网段内时拦截', async () => {
    setWhitelistResult([
      { ipAddress: '192.168.1.0/24', nickname: 'office-subnet', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);
    const req = createMockRequest('192.168.2.100');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(false);
    expect(respState.statusCode).toBe(403);
    expect(respState.jsonBody).toEqual({ success: false, error: 'IP不在白名单' });
  });

  /**
   * 测试组：IPv4 映射的 IPv6 地址（::ffff:1.2.3.4）能匹配 IPv4 白名单
   */
  it('IPv4 映射的 IPv6 地址能匹配 IPv4 白名单条目', async () => {
    setWhitelistResult([
      { ipAddress: '192.168.1.30', nickname: 'admin', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);
    const req = createMockRequest('::ffff:192.168.1.30');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });

  /**
   * 测试组：IP 缓存刷新 - 60 秒后重新查库
   * 使用假定时器模拟时间流逝，验证缓存过期后重新查询数据库
   */
  it('IP 缓存刷新：60秒后重新查库', async () => {
    // 第一次查询返回 IP-A
    setWhitelistResult([
      { ipAddress: '10.0.0.1', nickname: 'first', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);

    const req1 = createMockRequest('10.0.0.1');
    const respState1 = createMockResponse();
    const nextState1 = createMockNext();
    await ipWhitelistMiddleware(req1, respState1.res, nextState1.next);

    expect(mockFind).toHaveBeenCalledTimes(1);

    // 切换到假定时器，推进 61 秒（超过 60 秒缓存有效期）
    vi.useFakeTimers();
    vi.advanceTimersByTime(61 * 1000);

    // 修改 mock 返回值为新的 IP 列表
    setWhitelistResult([
      { ipAddress: '10.0.0.2', nickname: 'second', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);

    // 旧 IP 现在应被拦截，新 IP 应放行
    const reqOld = createMockRequest('10.0.0.1');
    const respStateOld = createMockResponse();
    const nextStateOld = createMockNext();
    await ipWhitelistMiddleware(reqOld, respStateOld.res, nextStateOld.next);

    expect(nextStateOld.called).toBe(false);
    expect(respStateOld.statusCode).toBe(403);
    expect(respStateOld.jsonBody).toEqual({ success: false, error: 'IP不在白名单' });

    const reqNew = createMockRequest('10.0.0.2');
    const respStateNew = createMockResponse();
    const nextStateNew = createMockNext();
    await ipWhitelistMiddleware(reqNew, respStateNew.res, nextStateNew.next);

    expect(nextStateNew.called).toBe(true);
    expect(respStateNew.statusCode).toBe(200);

    // 缓存过期后应触发第二次查库
    expect(mockFind).toHaveBeenCalledTimes(2);
  });

  /**
   * 测试组：缓存有效期内不重复查库
   */
  it('缓存有效期内不重复查库', async () => {
    setWhitelistResult([
      { ipAddress: '10.0.0.1', nickname: 'admin', isActive: true, isFirstAdmin: false, createdAt: new Date(), loginCount: 0 },
    ]);

    const req = createMockRequest('10.0.0.1');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);
    await ipWhitelistMiddleware(req, respState.res, nextState.next);
    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    expect(mockFind).toHaveBeenCalledTimes(1);
  });

  /**
   * 测试组：数据库查询异常时降级放行（避免数据库故障锁死后台）
   * loadWhitelist 内部捕获异常并返回空数组，中间件视为白名单未启用放行所有请求
   */
  it('数据库查询异常时降级放行，返回 200', async () => {
    mockFind.mockRejectedValue(new Error('数据库连接失败'));

    const req = createMockRequest('10.0.0.1');
    const respState = createMockResponse();
    const nextState = createMockNext();

    await ipWhitelistMiddleware(req, respState.res, nextState.next);

    // 数据库异常时降级为空白名单，放行请求避免锁死后台
    expect(nextState.called).toBe(true);
    expect(respState.statusCode).toBe(200);
  });
});

describe('getClientIp', () => {
  /**
   * 测试组：优先使用 x-forwarded-for 头部
   */
  it('优先使用 x-forwarded-for 头部的第一个 IP', () => {
    const req = createMockRequest('127.0.0.1', '203.0.113.1, 10.0.0.1');
    expect(getClientIp(req)).toBe('203.0.113.1');
  });

  /**
   * 测试组：无 x-forwarded-for 时使用 req.ip
   */
  it('无 x-forwarded-for 时使用 req.ip', () => {
    const req = createMockRequest('192.168.0.1');
    expect(getClientIp(req)).toBe('192.168.0.1');
  });

  /**
   * 测试组：x-forwarded-for 头部带空格时正确 trim
   */
  it('x-forwarded-for 头部带空格时正确 trim', () => {
    const req = createMockRequest('127.0.0.1', '  203.0.113.2  , 10.0.0.1');
    expect(getClientIp(req)).toBe('203.0.113.2');
  });
});
