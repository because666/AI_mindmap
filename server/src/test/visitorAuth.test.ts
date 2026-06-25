import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import type { Request, Response } from 'express';

/**
 * 访客签名认证中间件测试
 *
 * 测试目标：
 * - 合法签名通过（正确的 HMAC 签名 + 有效时间戳）
 * - 签名错误拒绝（错误的 token）
 * - token 过期拒绝（时间戳超过 5 分钟）
 * - 时间戳缺失拒绝（无 X-Visitor-Ts 头）
 * - 开发环境无签名放行（NODE_ENV !== 'production'）
 * - 生产环境无签名拒绝（NODE_ENV === 'production'）
 *
 * 测试方式：
 * 通过 vi.mock 模拟 workspaceService 和 mongoDBService，
 * 创建挂载 visitorAuth 中间件的测试用 Express 应用，
 * 通过 HTTP 请求验证签名校验行为。
 */

/** 测试用访客ID */
const TEST_VISITOR_ID = 'test-visitor-id';
/** 测试用访客密钥（64 字符 hex 字符串，模拟 crypto.randomBytes(32).toString('hex') 输出） */
const TEST_VISITOR_SECRET = 'a'.repeat(64);

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * 用于在 vi.mock 工厂函数中引用，确保 mock 在模块加载前完成
 */
const {
  mockGetVisitor,
  mockClearVisitorCache,
  mockFindOne,
  mockUpdateOne,
  mockDeleteOne,
  mockIsConnected,
} = vi.hoisted(() => ({
  mockGetVisitor: vi.fn(),
  mockClearVisitorCache: vi.fn(),
  mockFindOne: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockDeleteOne: vi.fn(),
  mockIsConnected: vi.fn(),
}));

/**
 * Mock workspaceService，避免真实数据库连接
 * 提供 getVisitor 和 clearVisitorCache 方法
 */
vi.mock('../services/workspaceService', () => ({
  workspaceService: {
    getVisitor: mockGetVisitor,
    clearVisitorCache: mockClearVisitorCache,
  },
}));

/**
 * Mock mongoDBService，避免真实数据库连接
 * 提供 IP 封禁查询和访客更新方法
 */
vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
    deleteOne: mockDeleteOne,
    isConnected: mockIsConnected,
  },
}));

import { visitorAuth } from '../middleware';

/**
 * 生成 HMAC-SHA256 签名
 * 与服务端 validateVisitorSignature 使用相同算法，用于构造测试用合法签名
 * @param visitorId - 访客ID
 * @param secret - 访客签名密钥
 * @param ts - 时间戳字符串
 * @returns hex 格式的签名字符串
 */
function generateSignature(visitorId: string, secret: string, ts: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${visitorId}:${ts}`)
    .digest('hex');
}

/**
 * 创建挂载 visitorAuth 中间件的测试用 Express 应用
 * @returns Express 应用实例，包含 POST /test 测试路由
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(express.json());
  app.post('/test', visitorAuth, (req: Request, res: Response) => {
    res.json({ success: true, visitorId: req.visitorId });
  });
  return app;
}

describe('visitorAuth 签名校验', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    // 重置所有 mock
    mockGetVisitor.mockReset();
    mockClearVisitorCache.mockReset();
    mockFindOne.mockReset();
    mockUpdateOne.mockReset();
    mockDeleteOne.mockReset();
    mockIsConnected.mockReset();

    // 默认 mock 行为：访客存在且未封禁，无 IP 封禁
    mockGetVisitor.mockResolvedValue({
      id: TEST_VISITOR_ID,
      nickname: 'TestVisitor',
      lastSeen: new Date(),
      workspaces: [],
      createdAt: new Date(),
      visitorSecret: TEST_VISITOR_SECRET,
    });
    mockFindOne.mockResolvedValue(null);
    mockUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mockIsConnected.mockReturnValue(false);

    // 创建测试服务器
    const app = createTestApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    vi.unstubAllEnvs();
  });

  describe('生产环境（NODE_ENV=production）', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'production');
    });

    it('合法签名通过（正确的 HMAC 签名 + 有效时间戳）', async () => {
      const ts = Date.now().toString();
      const token = generateSignature(TEST_VISITOR_ID, TEST_VISITOR_SECRET, ts);

      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': TEST_VISITOR_ID,
          'X-Visitor-Token': token,
          'X-Visitor-Ts': ts,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const json = (await response.json()) as { success: boolean; visitorId: string };
      expect(json.success).toBe(true);
      expect(json.visitorId).toBe(TEST_VISITOR_ID);
    });

    it('签名错误拒绝（错误的 token）', async () => {
      const ts = Date.now().toString();
      // 使用全 0 的错误 token，长度与合法签名一致（64 字符）
      const wrongToken = '0'.repeat(64);

      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': TEST_VISITOR_ID,
          'X-Visitor-Token': wrongToken,
          'X-Visitor-Ts': ts,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('认证失败');
    });

    it('token 过期拒绝（时间戳超过 5 分钟）', async () => {
      // 构造 6 分钟前的时间戳，超过 5 分钟有效期
      const expiredTs = (Date.now() - 6 * 60 * 1000).toString();
      const token = generateSignature(TEST_VISITOR_ID, TEST_VISITOR_SECRET, expiredTs);

      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': TEST_VISITOR_ID,
          'X-Visitor-Token': token,
          'X-Visitor-Ts': expiredTs,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('认证已过期');
    });

    it('时间戳缺失拒绝（无 X-Visitor-Ts 头）', async () => {
      const ts = Date.now().toString();
      const token = generateSignature(TEST_VISITOR_ID, TEST_VISITOR_SECRET, ts);

      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': TEST_VISITOR_ID,
          'X-Visitor-Token': token,
          // 故意不发送 X-Visitor-Ts 头
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少认证信息');
    });

    it('生产环境无签名拒绝（无 X-Visitor-Token 和 X-Visitor-Ts）', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': TEST_VISITOR_ID,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe('缺少认证信息');
    });
  });

  describe('开发环境（NODE_ENV !== production）', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'development');
    });

    it('开发环境无签名放行（仅校验 visitorId 存在）', async () => {
      const response = await fetch(`${baseUrl}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Visitor-Id': TEST_VISITOR_ID,
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);
      const json = (await response.json()) as { success: boolean; visitorId: string };
      expect(json.success).toBe(true);
      expect(json.visitorId).toBe(TEST_VISITOR_ID);
    });
  });
});
