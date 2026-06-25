import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * 用于在 vi.mock 工厂函数中引用，确保 mock 在模块加载前完成
 */
const { mockGetCollection, mockInsertMany } = vi.hoisted(() => ({
  mockGetCollection: vi.fn(),
  mockInsertMany: vi.fn(),
}));

/**
 * Mock MongoDB 服务，避免真实数据库连接
 */
vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {
    getCollection: mockGetCollection,
  },
}));

import router from '../routes/events';

/**
 * 事件请求体接口
 * @property events 事件对象数组
 */
interface EventsRequestBody {
  events?: unknown[];
}

/**
 * Mock 请求选项接口
 * @property ip 客户端 IP 地址
 * @property visitorId 访客 ID（从请求头读取）
 * @property body 请求体
 * @property forwardedFor 反向代理透传 IP
 */
interface MockRequestOptions {
  ip?: string;
  visitorId?: string;
  body?: EventsRequestBody;
  forwardedFor?: string;
}

/**
 * Mock 响应结果接口
 * @property statusCode HTTP 状态码
 * @property body 响应体
 */
interface MockResponseResult {
  statusCode: number;
  body: { success: boolean; error?: string } | null;
}

/**
 * 事件文档接口（用于验证入库数据）
 */
interface AnalyticsEvent {
  eventType: string;
  visitorId?: string;
  workspaceId?: string;
  nodeId?: string;
  mapId?: string;
  payload?: Record<string, unknown>;
  url?: string;
  userAgent?: string;
  timestamp: Date;
  createdAt: Date;
}

/** IP 计数器，用于生成唯一 IP 避免触发限流 */
let ipCounter = 0;

/**
 * 创建 Mock Express 请求对象
 * @param options 请求选项
 * @returns 模拟的 Express Request 对象
 */
function createMockRequest(options: MockRequestOptions): Request {
  ipCounter += 1;
  const ip = options.ip ?? `192.168.1.${ipCounter}`;
  const headers: Record<string, string> = {};
  if (options.visitorId !== undefined) {
    headers['x-visitor-id'] = options.visitorId;
  }
  if (options.forwardedFor !== undefined) {
    headers['x-forwarded-for'] = options.forwardedFor;
  }
  return {
    method: 'POST',
    url: '/',
    originalUrl: '/',
    ip,
    headers,
    body: options.body ?? {},
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

/**
 * 创建 Mock Express 响应对象
 * @returns 包含响应对象和等待响应 Promise 的对象
 */
function createMockResponse(): { res: Response; waitForResponse: () => Promise<MockResponseResult> } {
  const data: MockResponseResult = { statusCode: 200, body: null };
  let resolveFn: ((value: MockResponseResult) => void) | null = null;
  let hasResolved = false;

  const res = {
    status(code: number) {
      data.statusCode = code;
      return res;
    },
    json(body: unknown) {
      data.body = body as MockResponseResult['body'];
      if (!hasResolved) {
        hasResolved = true;
        if (resolveFn) {
          resolveFn(data);
        }
      }
      return res;
    },
  } as unknown as Response;

  const waitForResponse = (): Promise<MockResponseResult> => {
    return new Promise<MockResponseResult>((resolve) => {
      if (hasResolved) {
        resolve(data);
      } else {
        resolveFn = resolve;
      }
    });
  };

  return { res, waitForResponse };
}

/**
 * 获取 insertMany 调用时传入的文档参数
 * @returns 第一次调用时传入的文档数组
 * @throws 当 insertMany 未被调用时抛出断言错误
 */
function getInsertedDocuments(): AnalyticsEvent[] {
  expect(mockInsertMany).toHaveBeenCalledTimes(1);
  const calls = mockInsertMany.mock.calls as unknown[][];
  return calls[0][0] as AnalyticsEvent[];
}

describe('事件路由 /api/events', () => {
  beforeEach(() => {
    mockGetCollection.mockReset();
    mockInsertMany.mockReset();
    mockInsertMany.mockResolvedValue({ insertedCount: 1, insertedIds: {} });
    mockGetCollection.mockReturnValue({
      insertMany: mockInsertMany,
    });
  });

  it('单条有效事件应成功写入并返回 success', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      visitorId: 'visitor-001',
      body: {
        events: [
          {
            eventType: 'page_view',
            timestamp: '2026-06-26T10:00:00.000Z',
            payload: { path: '/home' },
          },
        ],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true });

    const docs = getInsertedDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].eventType).toBe('page_view');
    expect(docs[0].visitorId).toBe('visitor-001');
    expect(docs[0].timestamp.toISOString()).toBe('2026-06-26T10:00:00.000Z');
    expect(docs[0].createdAt).toBeInstanceOf(Date);
  });

  it('多条有效事件应批量写入', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        events: [
          { eventType: 'click', timestamp: Date.now() },
          { eventType: 'scroll', timestamp: new Date().toISOString() },
        ],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true });

    const docs = getInsertedDocuments();
    expect(docs).toHaveLength(2);
    expect(docs[0].eventType).toBe('click');
    expect(docs[1].eventType).toBe('scroll');
  });

  it('请求体缺少 events 字段应返回 400', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({ body: {} });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(400);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('events 必须为数组');
  });

  it('events 为空数组应返回 400', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({ body: { events: [] } });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(400);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('事件数组不能为空');
  });

  it('事件缺少 eventType 应返回 400', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        events: [{ timestamp: new Date().toISOString() }],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(400);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('eventType');
  });

  it('事件 timestamp 格式无效应返回 400', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        events: [{ eventType: 'click', timestamp: 'invalid-date' }],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(400);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('timestamp');
  });

  it('payload 为数组时应返回 400', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        events: [{ eventType: 'click', timestamp: new Date().toISOString(), payload: [1, 2] }],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(400);
    expect(response.body?.success).toBe(false);
  });

  it('字符串字段超长应被截断后入库', async () => {
    const { res, waitForResponse } = createMockResponse();
    const longEventType = 'a'.repeat(100);
    const longVisitorId = 'b'.repeat(600);
    const req = createMockRequest({
      body: {
        events: [
          {
            eventType: longEventType,
            visitorId: longVisitorId,
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const docs = getInsertedDocuments();
    expect(docs[0].eventType).toHaveLength(64);
    expect(docs[0].eventType.endsWith('...')).toBe(true);
    expect(docs[0].visitorId).toHaveLength(512);
    expect(docs[0].visitorId?.endsWith('...')).toBe(true);
  });

  it('未提供 visitorId 但请求头存在时应使用请求头值', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      visitorId: 'header-visitor',
      body: {
        events: [{ eventType: 'click', timestamp: new Date().toISOString() }],
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const docs = getInsertedDocuments();
    expect(docs[0].visitorId).toBe('header-visitor');
  });

  it('事件体已提供 visitorId 时应优先使用事件体值', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      visitorId: 'header-visitor',
      body: {
        events: [{ eventType: 'click', timestamp: new Date().toISOString(), visitorId: 'event-visitor' }],
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const docs = getInsertedDocuments();
    expect(docs[0].visitorId).toBe('event-visitor');
  });

  it('超过单批次最大数量应返回 400', async () => {
    const { res, waitForResponse } = createMockResponse();
    const events = Array.from({ length: 101 }, (_, index) => ({
      eventType: `event_${index}`,
      timestamp: new Date().toISOString(),
    }));
    const req = createMockRequest({ body: { events } });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(400);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('100');
  });

  it('MongoDB 未连接时应返回 503', async () => {
    mockGetCollection.mockReturnValue(null);
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        events: [{ eventType: 'click', timestamp: new Date().toISOString() }],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(503);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('暂不可用');
  });

  it('数据库写入异常时应返回 500', async () => {
    mockInsertMany.mockRejectedValue(new Error('写入失败'));
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        events: [{ eventType: 'click', timestamp: new Date().toISOString() }],
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(500);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('存储失败');
  });

  it('同一 IP 超过限流阈值应返回 429', async () => {
    const ip = '192.168.100.100';
    for (let index = 0; index < 60; index += 1) {
      const { res, waitForResponse } = createMockResponse();
      const req = createMockRequest({
        ip,
        body: {
          events: [{ eventType: 'heartbeat', timestamp: new Date().toISOString() }],
        },
      });
      router(req, res, () => {});
      await waitForResponse();
    }

    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      ip,
      body: {
        events: [{ eventType: 'heartbeat', timestamp: new Date().toISOString() }],
      },
    });
    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(429);
    expect(response.body?.success).toBe(false);
    expect(response.body?.error).toContain('过于频繁');
  });

  it('应从 x-forwarded-for 请求头读取真实客户端 IP', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      forwardedFor: '203.0.113.1, 10.0.0.1',
      body: {
        events: [{ eventType: 'click', timestamp: new Date().toISOString() }],
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const docs = getInsertedDocuments();
    expect(docs).toHaveLength(1);
  });
});
