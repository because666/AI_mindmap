import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Redis 连接管理服务单元测试
 * 测试 RedisService 的连接创建、状态管理、断开连接和健康检查
 * 使用 vi.doMock + 动态导入模拟 ioredis
 */

/** 事件回调映射，用于模拟 error/reconnect/close 事件 */
type EventCallbackMap = Record<string, Array<(...args: unknown[]) => void>>;

/** 模拟 Redis 客户端的方法集合 */
interface MockRedisClient {
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
}

/** 每个测试用例共享的事件回调映射 */
let eventCallbacks: EventCallbackMap;

/** 模拟的 Redis 客户端实例引用，在 beforeEach 中创建 */
let mockClient: MockRedisClient;

/** 创建模拟的 Redis 客户端实例
 * @param callbacks - 事件回调映射，用于模拟 error/reconnect/close 事件
 * @returns 模拟的 Redis 客户端实例
 */
function createMockRedisClient(callbacks: EventCallbackMap): MockRedisClient {
  return {
    on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
      if (!callbacks[event]) {
        callbacks[event] = [];
      }
      callbacks[event].push(callback);
    }),
    connect: vi.fn(() => Promise.resolve()),
    quit: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    ping: vi.fn(() => Promise.resolve('PONG')),
  };
}

describe('RedisService 连接管理', () => {
  beforeEach(() => {
    vi.resetModules();
    eventCallbacks = {};
    mockClient = createMockRedisClient(eventCallbacks);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 动态导入 redisService，确保 mock 生效
   * MockRedis 构造函数复用 beforeEach 中创建的 mockClient
   * @returns redisService 单例
   */
  async function getRedisService() {
    vi.doMock('ioredis', () => ({
      default: class MockRedis {
        on: MockRedisClient['on'];
        connect: MockRedisClient['connect'];
        quit: MockRedisClient['quit'];
        disconnect: MockRedisClient['disconnect'];
        ping: MockRedisClient['ping'];

        constructor() {
          this.on = mockClient.on;
          this.connect = mockClient.connect;
          this.quit = mockClient.quit;
          this.disconnect = mockClient.disconnect;
          this.ping = mockClient.ping;
        }
      },
    }));

    vi.doMock('../../config', () => ({
      config: {
        redis: {
          host: 'localhost',
          port: 6379,
          password: '',
        },
      },
    }));

    const mod = await import('./connection');
    return mod.redisService;
  }

  describe('initialize - 初始化连接', () => {
    it('初始化时创建 ioredis 连接', async () => {
      const service = await getRedisService();
      await service.initialize();

      expect(mockClient.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('reconnect', expect.any(Function));
      expect(mockClient.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockClient.connect).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);
    });

    it('连接失败时设置 available=false，打印警告，不抛异常', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockClient.connect.mockRejectedValueOnce(new Error('连接被拒绝'));

      const service = await getRedisService();
      await service.initialize();

      expect(service.isConnected()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Redis 连接失败'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('继续运行'));

      warnSpy.mockRestore();
    });
  });

  describe('getClient - 获取客户端', () => {
    it('可用时返回客户端实例', async () => {
      const service = await getRedisService();
      await service.initialize();

      const client = service.getClient();
      expect(client).not.toBeNull();
    });

    it('不可用时返回 null', async () => {
      const service = await getRedisService();

      const client = service.getClient();
      expect(client).toBeNull();
    });
  });

  describe('isConnected - 连接状态', () => {
    it('初始化成功后返回 true', async () => {
      const service = await getRedisService();
      await service.initialize();

      expect(service.isConnected()).toBe(true);
    });

    it('未初始化时返回 false', async () => {
      const service = await getRedisService();

      expect(service.isConnected()).toBe(false);
    });

    it('连接失败后返回 false', async () => {
      mockClient.connect.mockRejectedValueOnce(new Error('连接失败'));

      const service = await getRedisService();
      await service.initialize();

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('disconnect - 断开连接', () => {
    it('正确关闭连接并重置状态', async () => {
      const service = await getRedisService();
      await service.initialize();

      expect(service.isConnected()).toBe(true);

      await service.disconnect();

      expect(mockClient.quit).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
      expect(service.getClient()).toBeNull();
    });

    it('未初始化时调用 disconnect 不报错', async () => {
      const service = await getRedisService();
      await expect(service.disconnect()).resolves.toBeUndefined();
    });

    it('quit 失败时调用 disconnect 方法强制断开', async () => {
      mockClient.quit.mockRejectedValueOnce(new Error('quit 失败'));

      const service = await getRedisService();
      await service.initialize();
      await service.disconnect();

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('healthCheck - 健康检查', () => {
    it('连接可用时返回 true', async () => {
      const service = await getRedisService();
      await service.initialize();

      const result = await service.healthCheck();
      expect(result).toBe(true);
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('未连接时返回 false', async () => {
      const service = await getRedisService();

      const result = await service.healthCheck();
      expect(result).toBe(false);
    });

    it('PING 异常时返回 false 并设置不可用', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockClient.ping.mockRejectedValueOnce(new Error('PING 失败'));

      const service = await getRedisService();
      await service.initialize();

      const result = await service.healthCheck();

      expect(result).toBe(false);
      expect(service.isConnected()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('健康检查失败'));

      warnSpy.mockRestore();
    });
  });

  describe('事件监听', () => {
    it('error 事件触发时设置 available=false', async () => {
      const service = await getRedisService();
      await service.initialize();

      expect(service.isConnected()).toBe(true);

      const errorCallbacks = eventCallbacks['error'];
      expect(errorCallbacks).toBeDefined();
      expect(errorCallbacks.length).toBeGreaterThan(0);

      errorCallbacks[0](new Error('连接断开'));
      expect(service.isConnected()).toBe(false);
    });

    it('reconnect 事件触发时设置 available=true', async () => {
      const service = await getRedisService();
      await service.initialize();

      const errorCallbacks = eventCallbacks['error'];
      errorCallbacks[0](new Error('连接断开'));
      expect(service.isConnected()).toBe(false);

      const reconnectCallbacks = eventCallbacks['reconnect'];
      expect(reconnectCallbacks).toBeDefined();
      expect(reconnectCallbacks.length).toBeGreaterThan(0);

      reconnectCallbacks[0]();
      expect(service.isConnected()).toBe(true);
    });

    it('close 事件触发时设置 available=false', async () => {
      const service = await getRedisService();
      await service.initialize();

      expect(service.isConnected()).toBe(true);

      const closeCallbacks = eventCallbacks['close'];
      expect(closeCallbacks).toBeDefined();
      expect(closeCallbacks.length).toBeGreaterThan(0);

      closeCallbacks[0]();
      expect(service.isConnected()).toBe(false);
    });
  });
});
