import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import type { AddressInfo } from 'net';

/**
 * JSON body limit 按路由精细化配置测试
 *
 * 测试目标：
 * - 普通接口（如 /api/feedback）限制 1MB，超过返回 413
 * - AI 路由（/api/ai）限制 5MB，超过返回 413
 * - 对话路由（/api/conversations）限制 5MB，超过返回 413
 *
 * 测试方式：
 * 创建与 server/src/index.ts 中 JSON limit 配置一致的测试用 Express 应用，
 * 通过 HTTP 请求验证不同路由的 body 大小限制行为。
 */

/**
 * 创建与 server/src/index.ts 中 JSON limit 配置一致的测试用 Express 应用
 * @returns 配置好 JSON limit 中间件的 Express 应用实例
 */
function createTestApp(): express.Application {
  const app = express();

  /**
   * 全局 JSON body 解析中间件（1MB 限制）
   * 对 /api/ai 和 /api/conversations 路由跳过全局解析，由路由级中间件处理
   */
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api/ai') || req.path.startsWith('/api/conversations')) {
      return next();
    }
    express.json({ limit: '1mb' })(req, res, next);
  });

  /**
   * 路由级 JSON body limit 中间件（5MB）
   * 必须在对应路由注册之前挂载
   */
  app.use('/api/conversations', express.json({ limit: '5mb' }));
  app.use('/api/ai', express.json({ limit: '5mb' }));

  // 测试用路由：普通接口（1MB 限制）
  app.post('/api/feedback', (req: express.Request, res: express.Response) => {
    res.json({ ok: true, receivedBytes: JSON.stringify(req.body).length });
  });

  // 测试用路由：AI 接口（5MB 限制）
  app.post('/api/ai', (req: express.Request, res: express.Response) => {
    res.json({ ok: true, receivedBytes: JSON.stringify(req.body).length });
  });

  // 测试用路由：对话接口（5MB 限制）
  app.post('/api/conversations', (req: express.Request, res: express.Response) => {
    res.json({ ok: true, receivedBytes: JSON.stringify(req.body).length });
  });

  /**
   * 413 Payload Too Large 错误处理中间件
   * 拦截 express.json 超出 limit 抛出的 PayloadTooLargeError
   */
  app.use(
    (
      err: Error & { status?: number },
      req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (err.status === 413) {
        return res.status(413).json({
          success: false,
          error: '请求体过大，请减小请求内容',
        });
      }
      next(err);
    }
  );

  return app;
}

/**
 * 生成指定字节大小的 JSON 字符串
 * 结构为 {"data":"xxx..."}，通过填充 'x' 达到目标大小
 * @param targetBytes - 目标字节大小
 * @returns 符合目标大小的 JSON 字符串
 */
function generatePayload(targetBytes: number): string {
  const prefix = '{"data":"';
  const suffix = '"}';
  const paddingLength = targetBytes - prefix.length - suffix.length;
  if (paddingLength < 0) {
    return prefix + suffix;
  }
  return prefix + 'x'.repeat(paddingLength) + suffix;
}

/**
 * 向指定 URL 发送 POST JSON 请求
 * @param url - 请求地址
 * @param body - 请求体字符串
 * @returns fetch 响应对象
 */
async function postJson(url: string, body: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
}

describe('JSON body limit 按路由精细化配置', () => {
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

  describe('普通接口（/api/feedback）- 1MB 限制', () => {
    it('1MB 以内的 body 应正常通过（发送 500KB body 返回 200）', async () => {
      const payload = generatePayload(500 * 1024); // 500KB
      const response = await postJson(`${baseUrl}/api/feedback`, payload);

      expect(response.status).toBe(200);
      const json = (await response.json()) as { ok: boolean; receivedBytes: number };
      expect(json.ok).toBe(true);
      expect(json.receivedBytes).toBeGreaterThan(0);
    });

    it('超过 1MB 的 body 应被拒绝（返回 413）', async () => {
      const payload = generatePayload(1024 * 1024 + 100); // 1MB + 100 字节
      const response = await postJson(`${baseUrl}/api/feedback`, payload);

      expect(response.status).toBe(413);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toContain('请求体过大');
    });

    it('刚好 1MB 的 body 应正常通过（边界情况）', async () => {
      const payload = generatePayload(1024 * 1024); // 正好 1MB
      const response = await postJson(`${baseUrl}/api/feedback`, payload);

      expect(response.status).toBe(200);
    });
  });

  describe('AI 接口（/api/ai）- 5MB 限制', () => {
    it('5MB 以内的 body 应正常通过（发送 3MB body 返回 200）', async () => {
      const payload = generatePayload(3 * 1024 * 1024); // 3MB
      const response = await postJson(`${baseUrl}/api/ai`, payload);

      expect(response.status).toBe(200);
      const json = (await response.json()) as { ok: boolean; receivedBytes: number };
      expect(json.ok).toBe(true);
      expect(json.receivedBytes).toBeGreaterThan(0);
    });

    it('超过 5MB 的 body 应被拒绝（返回 413）', async () => {
      const payload = generatePayload(5 * 1024 * 1024 + 100); // 5MB + 100 字节
      const response = await postJson(`${baseUrl}/api/ai`, payload);

      expect(response.status).toBe(413);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toContain('请求体过大');
    });

    it('刚好 5MB 的 body 应正常通过（边界情况）', async () => {
      const payload = generatePayload(5 * 1024 * 1024); // 正好 5MB
      const response = await postJson(`${baseUrl}/api/ai`, payload);

      expect(response.status).toBe(200);
    });

    it('1MB 以上但 5MB 以下的 body 应正常通过（验证不受全局 1MB 限制影响）', async () => {
      const payload = generatePayload(2 * 1024 * 1024); // 2MB（超过全局 1MB 但在 AI 路由 5MB 限制内）
      const response = await postJson(`${baseUrl}/api/ai`, payload);

      expect(response.status).toBe(200);
    });
  });

  describe('对话接口（/api/conversations）- 5MB 限制', () => {
    it('5MB 以内的 body 应正常通过（发送 3MB body 返回 200）', async () => {
      const payload = generatePayload(3 * 1024 * 1024); // 3MB
      const response = await postJson(`${baseUrl}/api/conversations`, payload);

      expect(response.status).toBe(200);
      const json = (await response.json()) as { ok: boolean; receivedBytes: number };
      expect(json.ok).toBe(true);
      expect(json.receivedBytes).toBeGreaterThan(0);
    });

    it('超过 5MB 的 body 应被拒绝（返回 413）', async () => {
      const payload = generatePayload(5 * 1024 * 1024 + 100); // 5MB + 100 字节
      const response = await postJson(`${baseUrl}/api/conversations`, payload);

      expect(response.status).toBe(413);
      const json = (await response.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toContain('请求体过大');
    });

    it('1MB 以上但 5MB 以下的 body 应正常通过（验证不受全局 1MB 限制影响）', async () => {
      const payload = generatePayload(2 * 1024 * 1024); // 2MB
      const response = await postJson(`${baseUrl}/api/conversations`, payload);

      expect(response.status).toBe(200);
    });
  });
});
