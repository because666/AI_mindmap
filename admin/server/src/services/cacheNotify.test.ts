import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * cacheNotify 模块单元测试
 *
 * 重点验证延迟 token 校验逻辑：
 * - INTERNAL_API_TOKEN 未设置时，4 个目标函数应跳过 HTTP 请求（不调用 axios.post）
 * - INTERNAL_API_TOKEN 设置时，4 个目标函数应正常发起 HTTP 请求
 *
 * 实现说明：
 * INTERNAL_TOKEN 是模块加载时从 process.env.INTERNAL_API_TOKEN 读取的常量，
 * 因此通过 vi.resetModules + 动态 import 重新加载模块，分别测试两种状态。
 * 使用 vi.doMock（而非 vi.mock）以配合动态 import 实现按需 mock。
 */

/**
 * axios 默认导入的 mock 形状
 * cacheNotify.ts 中使用 `import axios from 'axios'`，编译后访问 `axios.default.post`
 * 因此 mock 工厂需返回带 default 字段的对象
 */
interface AxiosMockShape {
  /** 默认导出对象，cacheNotify 中通过 axios.post 访问 */
  default: {
    post: ReturnType<typeof vi.fn>;
  };
  /** 兼容命名导出的 post 方法 */
  post: ReturnType<typeof vi.fn>;
}

/**
 * 创建 axios 模块的 mock 工厂
 * @param postMock - 用于验证调用情况的 post 方法 mock
 * @returns axios 模块 mock 对象
 */
function createAxiosMock(postMock: ReturnType<typeof vi.fn>): AxiosMockShape {
  return {
    default: { post: postMock },
    post: postMock,
  };
}

/**
 * 从 axios.post 调用参数中提取请求配置的类型
 * cacheNotify 中第三个参数为 AxiosRequestConfig，这里仅断言测试关心的字段
 */
interface RequestConfig {
  headers: Record<string, string>;
  timeout: number;
}

describe('cacheNotify - 延迟 token 校验', () => {
  /**
   * 每个测试用例前重置模块缓存与环境变量
   * - vi.resetModules：清空模块缓存，确保动态 import 时重新求值 INTERNAL_TOKEN
   * - 清除 INTERNAL_API_TOKEN：避免上一个测试设置的值污染当前测试
   */
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.INTERNAL_API_TOKEN;
  });

  /**
   * 每个测试用例后恢复 mock 并清理环境变量
   */
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.INTERNAL_API_TOKEN;
  });

  /**
   * 测试组：INTERNAL_API_TOKEN 未设置时
   * 验证 4 个目标函数都跳过 HTTP 请求，并输出告警日志
   */
  describe('INTERNAL_API_TOKEN 未设置时', () => {
    /**
     * 测试用例：notifyVisitorCacheClear 跳过 HTTP 请求
     * 验证未配置 token 时函数提前返回，不调用 axios.post，并打印告警
     */
    it('notifyVisitorCacheClear 跳过 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyVisitorCacheClear } = await import('./cacheNotify');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* 测试中屏蔽告警输出，避免污染测试日志 */
      });

      await notifyVisitorCacheClear('visitor-1');

      // 关键断言：未配置 token 时不应发起任何 HTTP 请求
      expect(postMock).not.toHaveBeenCalled();
      // 验证告警日志包含目标提示信息
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('跳过访客缓存通知')
      );
    });

    /**
     * 测试用例：notifyWorkspaceCacheClear 跳过 HTTP 请求
     * 验证未配置 token 时函数提前返回，不调用 axios.post，并打印告警
     */
    it('notifyWorkspaceCacheClear 跳过 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyWorkspaceCacheClear } = await import('./cacheNotify');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* 测试中屏蔽告警输出，避免污染测试日志 */
      });

      await notifyWorkspaceCacheClear('workspace-1');

      expect(postMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('跳过工作区缓存通知')
      );
    });

    /**
     * 测试用例：notifyAllCacheClear 跳过 HTTP 请求
     * 验证未配置 token 时函数提前返回，不调用 axios.post，并打印告警
     */
    it('notifyAllCacheClear 跳过 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyAllCacheClear } = await import('./cacheNotify');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* 测试中屏蔽告警输出，避免污染测试日志 */
      });

      await notifyAllCacheClear();

      expect(postMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('跳过全量缓存通知')
      );
    });

    /**
     * 测试用例：notifyFeedbackPush 跳过 HTTP 请求
     * 验证未配置 token 时函数提前返回，不调用 axios.post，并打印告警
     */
    it('notifyFeedbackPush 跳过 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyFeedbackPush } = await import('./cacheNotify');
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* 测试中屏蔽告警输出，避免污染测试日志 */
      });

      await notifyFeedbackPush('visitor-1', '反馈标题', '处理中');

      expect(postMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('跳过反馈推送通知')
      );
    });
  });

  /**
   * 测试组：INTERNAL_API_TOKEN 设置时
   * 验证 4 个目标函数都正常发起 HTTP 请求，且请求头携带 token
   */
  describe('INTERNAL_API_TOKEN 设置时', () => {
    /**
     * 每个测试用例前设置环境变量
     * 必须在动态 import 之前设置，模块加载时才会读取到非空 token
     */
    beforeEach(() => {
      process.env.INTERNAL_API_TOKEN = 'test-internal-token';
    });

    /**
     * 测试用例：notifyVisitorCacheClear 发送 HTTP 请求
     * 验证配置 token 后函数发起请求，URL、请求体、请求头均符合预期
     */
    it('notifyVisitorCacheClear 发送 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyVisitorCacheClear } = await import('./cacheNotify');

      await notifyVisitorCacheClear('visitor-1');

      // 关键断言：配置 token 后应发起一次 HTTP 请求
      expect(postMock).toHaveBeenCalledTimes(1);

      const [url, body, config] = postMock.mock.calls[0];
      expect(url).toContain('/api/internal/clear-cache');
      expect(body).toMatchObject({ type: 'visitor', visitorId: 'visitor-1' });
      const cfg = config as RequestConfig;
      expect(cfg.headers['x-internal-token']).toBe('test-internal-token');
    });

    /**
     * 测试用例：notifyWorkspaceCacheClear 发送 HTTP 请求
     * 验证配置 token 后函数发起请求，URL、请求体、请求头均符合预期
     */
    it('notifyWorkspaceCacheClear 发送 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyWorkspaceCacheClear } = await import('./cacheNotify');

      await notifyWorkspaceCacheClear('workspace-1');

      expect(postMock).toHaveBeenCalledTimes(1);

      const [url, body, config] = postMock.mock.calls[0];
      expect(url).toContain('/api/internal/clear-cache');
      expect(body).toMatchObject({ type: 'workspace', workspaceId: 'workspace-1' });
      const cfg = config as RequestConfig;
      expect(cfg.headers['x-internal-token']).toBe('test-internal-token');
    });

    /**
     * 测试用例：notifyAllCacheClear 发送 HTTP 请求
     * 验证配置 token 后函数发起请求，URL、请求头均符合预期
     */
    it('notifyAllCacheClear 发送 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyAllCacheClear } = await import('./cacheNotify');

      await notifyAllCacheClear();

      expect(postMock).toHaveBeenCalledTimes(1);

      const [url, , config] = postMock.mock.calls[0];
      expect(url).toContain('/api/internal/clear-cache');
      const cfg = config as RequestConfig;
      expect(cfg.headers['x-internal-token']).toBe('test-internal-token');
    });

    /**
     * 测试用例：notifyFeedbackPush 发送 HTTP 请求
     * 验证配置 token 后函数发起请求，URL、请求体、请求头均符合预期
     */
    it('notifyFeedbackPush 发送 HTTP 请求', async () => {
      const postMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.doMock('axios', () => createAxiosMock(postMock));

      const { notifyFeedbackPush } = await import('./cacheNotify');

      await notifyFeedbackPush('visitor-1', '反馈标题', '处理中');

      expect(postMock).toHaveBeenCalledTimes(1);

      const [url, body, config] = postMock.mock.calls[0];
      expect(url).toContain('/api/internal/push/feedback-notification');
      expect(body).toMatchObject({
        visitorId: 'visitor-1',
        feedbackTitle: '反馈标题',
        newStatus: '处理中',
      });
      const cfg = config as RequestConfig;
      expect(cfg.headers['x-internal-token']).toBe('test-internal-token');
    });
  });
});
