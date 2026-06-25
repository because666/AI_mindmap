import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * 用于在 vi.mock 工厂函数中引用，确保 mock 在模块加载前完成
 */
const { mockSendFeedbackEmail, mockInsertOne, mockIsConnected } = vi.hoisted(() => ({
  mockSendFeedbackEmail: vi.fn(),
  mockInsertOne: vi.fn(),
  mockIsConnected: vi.fn(),
}));

/**
 * Mock 邮件服务，避免真实SMTP连接
 */
vi.mock('../services/emailService', () => ({
  emailService: {
    sendFeedbackEmail: mockSendFeedbackEmail,
  },
}));

/**
 * Mock MongoDB 服务，避免真实数据库连接
 */
vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {
    insertOne: mockInsertOne,
    isConnected: mockIsConnected,
  },
}));

import router from '../routes/feedback';

/**
 * Mock请求体接口
 * @property title 反馈标题
 * @property description 反馈描述
 * @property type 反馈类型
 * @property contact 联系方式
 */
interface MockRequestBody {
  title?: string;
  description?: string;
  type?: string;
  contact?: string;
}

/**
 * Mock请求选项接口
 * @property ip 客户端IP地址
 * @property visitorId 访客ID（从请求头读取）
 * @property body 请求体
 */
interface MockRequestOptions {
  ip?: string;
  visitorId?: string;
  body?: MockRequestBody;
}

/**
 * Mock响应结果接口
 * @property statusCode HTTP状态码
 * @property body 响应体
 */
interface MockResponseResult {
  statusCode: number;
  body: unknown;
}

/**
 * 反馈文档接口（用于验证入库数据）
 * @property title 反馈标题
 * @property description 反馈描述
 * @property type 反馈类型
 * @property contact 联系方式
 * @property visitorIp 访客IP
 * @property visitorId 访客ID
 * @property status 反馈状态
 * @property createdAt 创建时间
 */
interface FeedbackDocument {
  title: string;
  description: string;
  type: string;
  contact: string;
  visitorIp: string;
  visitorId: string;
  status: string;
  createdAt: Date;
}

/** IP计数器，用于生成唯一IP避免触发限流（每IP每分钟3次） */
let ipCounter = 0;

/**
 * 创建Mock Express请求对象
 * @param options 请求选项，包含IP、访客ID、请求体
 * @returns 模拟的Express Request对象
 * @description 每次生成唯一IP地址，避免模块级限流映射影响后续测试
 */
function createMockRequest(options: MockRequestOptions): Request {
  ipCounter += 1;
  const ip = options.ip ?? `192.168.1.${ipCounter}`;
  const headers: Record<string, string> = {};
  if (options.visitorId !== undefined) {
    headers['x-visitor-id'] = options.visitorId;
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
 * 创建Mock Express响应对象
 * @returns 包含响应对象和等待响应Promise的对象
 * @description 通过Promise在res.json被调用时resolve，支持异步路由处理器的测试
 */
function createMockResponse(): { res: Response; waitForResponse: () => Promise<MockResponseResult> } {
  const data: MockResponseResult = { statusCode: 200, body: null };
  let resolveFn: ((value: MockResponseResult) => void) | null = null;

  const res = {
    status(code: number) {
      data.statusCode = code;
      return res;
    },
    json(body: unknown) {
      data.body = body;
      if (resolveFn) {
        resolveFn(data);
      }
      return res;
    },
  } as unknown as Response;

  const waitForResponse = (): Promise<MockResponseResult> => {
    return new Promise<MockResponseResult>((resolve) => {
      resolveFn = resolve;
    });
  };

  return { res, waitForResponse };
}

/**
 * 获取 insertOne 调用时传入的文档参数
 * @returns 第一次调用时传入的文档对象
 * @throws 当insertOne未被调用时抛出断言错误
 */
function getInsertedDocument(): FeedbackDocument {
  expect(mockInsertOne).toHaveBeenCalledTimes(1);
  const calls = mockInsertOne.mock.calls as unknown[][];
  const callArgs = calls[0];
  return callArgs[1] as FeedbackDocument;
}

describe('反馈路由 XSS 防护', () => {
  beforeEach(() => {
    mockSendFeedbackEmail.mockReset();
    mockInsertOne.mockReset();
    mockIsConnected.mockReset();
    // 默认邮件发送成功，确保流程进入数据库写入阶段
    mockSendFeedbackEmail.mockResolvedValue(true);
    // 默认数据库插入成功，返回模拟的文档ID
    mockInsertOne.mockResolvedValue('mock-inserted-id');
    mockIsConnected.mockReturnValue(true);
  });

  it('含HTML标签的visitorId应被转义后存储', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      visitorId: '<script>alert(1)</script>',
      body: {
        title: '测试标题',
        description: '测试描述',
        type: '功能异常',
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const doc = getInsertedDocument();
    expect(doc.visitorId).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('含HTML标签的visitorIp应被转义后存储', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      ip: '<script>alert("ip")</script>',
      body: {
        title: '测试标题',
        description: '测试描述',
        type: '功能异常',
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const doc = getInsertedDocument();
    // < > " 均应被转义
    expect(doc.visitorIp).toBe('&lt;script&gt;alert(&quot;ip&quot;)&lt;/script&gt;');
  });

  it('正常的visitorId和visitorIp不应被修改', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      ip: '192.168.1.100',
      visitorId: 'visitor-abc-123',
      body: {
        title: '测试标题',
        description: '测试描述',
        type: '功能异常',
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const doc = getInsertedDocument();
    expect(doc.visitorId).toBe('visitor-abc-123');
    expect(doc.visitorIp).toBe('192.168.1.100');
  });

  it('title/description/contact的HTML转义逻辑应正常工作', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        title: '<script>alert(1)</script>',
        description: '<img src=x onerror=alert(1)>',
        type: '功能异常',
        contact: '<b>contact@test.com</b>',
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const doc = getInsertedDocument();
    expect(doc.title).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(doc.description).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(doc.contact).toBe('&lt;b&gt;contact@test.com&lt;/b&gt;');
  });

  it('未提供visitorId时应使用anonymous默认值且不影响转义逻辑', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        title: '测试标题',
        description: '测试描述',
        type: '功能异常',
      },
    });

    router(req, res, () => {});
    await waitForResponse();

    const doc = getInsertedDocument();
    expect(doc.visitorId).toBe('anonymous');
  });

  it('反馈提交成功应返回success响应', async () => {
    const { res, waitForResponse } = createMockResponse();
    const req = createMockRequest({
      body: {
        title: '测试标题',
        description: '测试描述',
        type: '功能异常',
      },
    });

    router(req, res, () => {});
    const response = await waitForResponse();

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: '反馈提交成功',
    });
  });
});
