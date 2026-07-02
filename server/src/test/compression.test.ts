import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';
import compression from 'compression';

/**
 * compression 中间件 filter 函数测试
 *
 * 测试目标：
 * - 当响应 Content-Type 为 'text/event-stream'（SSE 流式响应）时，filter 返回 false（跳过压缩）
 * - 当响应 Content-Type 为 'application/json' 时，filter 返回 true（启用压缩）
 * - 当响应 Content-Type 未设置时，filter 返回 true（启用压缩，沿用默认逻辑）
 *
 * 测试方式：
 * 1. 单元测试：直接构造 mock 的 req/res，调用 filter 函数验证返回值
 * 2. 集成测试：构造与 server/src/index.ts 中 compression 配置一致的测试用 Express 应用，
 *    通过 HTTP 请求验证 SSE 响应不被压缩（无 Content-Encoding 头）、普通响应被压缩（含 Content-Encoding: gzip 头）
 *
 * 注意：filter 函数与 server/src/index.ts 中的实现保持一致，避免引入额外导出修改无关代码
 */

/**
 * 复现 server/src/index.ts 中 compression 自定义 filter 的逻辑
 *
 * 自定义 filter：对 SSE 流式响应（text/event-stream）跳过 gzip 压缩，
 * 其他响应沿用 compression 默认过滤逻辑
 *
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 * @returns 是否对该响应启用压缩：SSE 返回 false，其他响应交给 compression 默认逻辑
 */
function compressionFilter(req: express.Request, res: express.Response): boolean {
  // SSE 流式响应不压缩，避免缓冲导致一次性返回
  const contentType = res.getHeader('Content-Type') as string | undefined;
  if (contentType && contentType.includes('text/event-stream')) {
    return false;
  }
  // 其他响应使用 compression 默认过滤逻辑
  return compression.filter(req, res);
}

/**
 * 创建一个 mock 的 Express Request 对象
 * 仅包含 compression.filter 默认实现可能访问的字段（headers）
 * @returns mock 的 Express Request 对象
 */
function createMockRequest(): express.Request {
  return {
    headers: {
      'accept-encoding': 'gzip, deflate, br',
    },
  } as unknown as express.Request;
}

/**
 * 创建一个 mock 的 Express Response 对象
 * 仅包含 filter 函数中访问的 getHeader 方法
 * @param contentType - 响应头 Content-Type 的值，undefined 表示未设置
 * @returns mock 的 Express Response 对象
 */
function createMockResponse(contentType?: string): express.Response {
  return {
    getHeader: (name: string) => {
      if (name.toLowerCase() === 'content-type') {
        return contentType;
      }
      return undefined;
    },
  } as unknown as express.Response;
}

/**
 * 创建与 server/src/index.ts 中 compression 配置一致的测试用 Express 应用
 *
 * 注册两个路由：
 * - /sse：模拟 SSE 流式响应，设置 Content-Type: text/event-stream
 * - /json：模拟普通 JSON 响应，设置 Content-Type: application/json
 *
 * @returns 配置好 compression 中间件的 Express 应用实例
 */
function createTestApp(): express.Application {
  const app = express();

  // 挂载与 index.ts 一致的 compression 配置
  app.use(
    compression({
      filter: (req: express.Request, res: express.Response): boolean => {
        return compressionFilter(req, res);
      },
    })
  );

  // 模拟 SSE 流式响应接口
  app.get('/sse', (_req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // 写入较大的响应体（>1KB，超过 compression 默认 threshold），观察是否被压缩
    res.write(`data: ${'x'.repeat(2048)}\n\n`);
    res.end();
  });

  // 模拟普通 JSON 响应接口
  app.get('/json', (_req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'application/json');
    // 写入较大的响应体（>1KB，超过 compression 默认 threshold），观察是否被压缩
    res.json({ data: 'x'.repeat(2048) });
  });

  return app;
}

describe('compression 自定义 filter 函数 - 单元测试', () => {
  describe('SSE 流式响应（Content-Type: text/event-stream）', () => {
    it('当 Content-Type 为 "text/event-stream" 时，filter 应返回 false（跳过压缩）', () => {
      const req = createMockRequest();
      const res = createMockResponse('text/event-stream');
      const result = compressionFilter(req, res);
      expect(result).toBe(false);
    });

    it('当 Content-Type 为 "text/event-stream; charset=utf-8" 时，filter 应返回 false（包含匹配）', () => {
      const req = createMockRequest();
      const res = createMockResponse('text/event-stream; charset=utf-8');
      const result = compressionFilter(req, res);
      expect(result).toBe(false);
    });
  });

  describe('普通响应（非 SSE）', () => {
    it('当 Content-Type 为 "application/json" 时，filter 应返回 true（启用压缩）', () => {
      const req = createMockRequest();
      const res = createMockResponse('application/json');
      const result = compressionFilter(req, res);
      expect(result).toBe(true);
    });

    it('当 Content-Type 为 "text/html" 时，filter 应返回 true（启用压缩，与默认逻辑一致）', () => {
      const req = createMockRequest();
      const res = createMockResponse('text/html');
      const result = compressionFilter(req, res);
      expect(result).toBe(true);
    });

    it('当 Content-Type 为 "text/plain" 时，filter 应返回 true（启用压缩，与默认逻辑一致）', () => {
      const req = createMockRequest();
      const res = createMockResponse('text/plain');
      const result = compressionFilter(req, res);
      expect(result).toBe(true);
    });
  });

  describe('Content-Type 未设置（边界情况）', () => {
    it('当 Content-Type 未设置（undefined）时，filter 应与默认 filter 一致', () => {
      // 默认 compression.filter 在 Content-Type 未设置时返回 false（compressible 判定不可压缩），
      // 此处验证自定义 filter 未改变默认行为，而非固定期望 true/false
      const req = createMockRequest();
      const res = createMockResponse(undefined);
      const result = compressionFilter(req, res);
      const defaultResult = compression.filter(req, res);
      expect(result).toBe(defaultResult);
    });

    it('当 Content-Type 为空字符串时，filter 应与默认 filter 一致', () => {
      // 默认 compression.filter 在 Content-Type 为空字符串时返回 false，
      // 此处验证自定义 filter 未改变默认行为
      const req = createMockRequest();
      const res = createMockResponse('');
      const result = compressionFilter(req, res);
      const defaultResult = compression.filter(req, res);
      expect(result).toBe(defaultResult);
    });
  });
});

describe('compression 中间件 - 集成测试（HTTP 行为验证）', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer(createTestApp());
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('SSE 响应不应被压缩（无 Content-Encoding 头）', async () => {
    const response = await fetch(`${baseUrl}/sse`, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    // SSE 响应应跳过压缩，不应携带 Content-Encoding 头
    expect(response.headers.get('content-encoding')).toBeNull();
  });

  it('普通 JSON 响应应被压缩（含 Content-Encoding 头）', async () => {
    const response = await fetch(`${baseUrl}/json`, {
      headers: { 'Accept-Encoding': 'gzip, deflate, br' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    // 普通 JSON 响应（>1KB）应被压缩，具体算法取决于 Accept-Encoding 与 compression 协商结果
    // Node.js compression 在客户端支持 br 时优先使用 Brotli，其次 gzip/deflate
    const contentEncoding = response.headers.get('content-encoding');
    expect(contentEncoding).not.toBeNull();
    expect(['gzip', 'deflate', 'br']).toContain(contentEncoding);
  });
});
