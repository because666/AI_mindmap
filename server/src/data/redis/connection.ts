import Redis from 'ioredis';
import { config } from '../../config';

/**
 * Redis 连接管理服务（单例模式）
 * 负责管理 Redis 客户端的创建、连接、断开和健康检查
 * 连接失败时不会阻塞服务启动，仅标记为不可用
 */
class RedisService {
  private client: Redis | null = null;
  private available: boolean = false;
  private static instance: RedisService;

  private constructor() {}

  /**
   * 获取 RedisService 单例实例
   * @returns {RedisService} RedisService 单例
   */
  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * 初始化 Redis 连接
   * 从 config.redis 读取连接配置（host、port、password）
   * 连接失败时打印警告但不抛异常，设置 isAvailable = false
   * 注册 error 事件监听（断开时标记不可用）和 reconnect 事件监听（重连成功时标记可用）
   * @returns {Promise<void>} 无返回值
   */
  async initialize(): Promise<void> {
    if (this.client) return;

    const { host, port, password } = config.redis;

    if (process.env.NODE_ENV !== 'production') {
      console.log(`🔌 Connecting to Redis at ${host}:${port}...`);
    }

    try {
      this.client = new Redis({
        host,
        port,
        password: password || undefined,
        retryStrategy: (times: number) => {
          if (times > 10) {
            console.warn('⚠️ Redis 重连次数超过上限，停止重连');
            return null;
          }
          const delay = Math.min(times * 500, 5000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.client.on('error', (err: Error) => {
        this.available = false;
        console.warn(`⚠️ Redis 连接错误: ${err.message}`);
      });

      this.client.on('reconnect', () => {
        this.available = true;
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Redis 重连成功');
        }
      });

      this.client.on('close', () => {
        this.available = false;
        console.warn('⚠️ Redis 连接已关闭');
      });

      await this.client.connect();
      this.available = true;
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Redis connected successfully');
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Redis 连接失败: ${errorMsg}`);
      console.warn('⚠️ 继续运行，Redis 功能不可用');
      this.available = false;
      if (this.client) {
        try {
          this.client.disconnect();
        } catch (_cleanupError: unknown) {
          // 断开失败时忽略，客户端将被丢弃
        }
        this.client = null;
      }
    }
  }

  /**
   * 获取 Redis 是否可用
   * @returns {boolean} Redis 连接是否可用
   */
  isConnected(): boolean {
    return this.available;
  }

  /**
   * 获取 Redis 客户端实例
   * @returns {Redis | null} Redis 客户端实例，不可用时返回 null
   */
  getClient(): Redis | null {
    return this.available ? this.client : null;
  }

  /**
   * 关闭 Redis 连接
   * 断开连接后重置客户端和可用状态
   * @returns {Promise<void>} 无返回值
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Redis 断开连接时出错: ${errorMsg}`);
        this.client.disconnect();
      }
      this.client = null;
      this.available = false;
      if (process.env.NODE_ENV !== 'production') {
        console.log('✅ Redis disconnected');
      }
    }
  }

  /**
   * 执行 PING 命令检查 Redis 连接状态
   * @returns {Promise<boolean>} 连接正常返回 true，否则返回 false
   */
  async healthCheck(): Promise<boolean> {
    if (!this.client || !this.available) {
      return false;
    }

    try {
      const result = await this.client.ping();
      this.available = result === 'PONG';
      return this.available;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ Redis 健康检查失败: ${errorMsg}`);
      this.available = false;
      return false;
    }
  }

  /** 上次记录降级日志的时间戳（毫秒），用于限流避免日志刷屏 */
  private lastDegradedLogTime: number = 0;

  /** 降级日志限流间隔（毫秒），同一时间窗口内只记录一次降级日志 */
  private readonly DEGRADED_LOG_INTERVAL = 60 * 1000;

  /**
   * 记录 Redis 降级日志（限流，避免日志刷屏）
   * 同一时间窗口（60秒）内只记录一次降级日志，防止 Redis 持续异常时日志刷屏
   * @param operation - 失败的操作名称
   * @param error - 错误信息
   */
  private logDegraded(operation: string, error: string): void {
    const now = Date.now();
    if (now - this.lastDegradedLogTime < this.DEGRADED_LOG_INTERVAL) {
      return;
    }
    this.lastDegradedLogTime = now;
    console.warn(`⚠️ Redis 降级（${operation}失败，降级到无缓存模式）: ${error}`);
  }

  /**
   * 从 Redis 获取缓存值
   * JSON 反序列化后返回，Redis 不可用或 key 不存在返回 null
   * Redis 操作异常时静默降级返回 null，并记录限流后的 warn 日志
   * @param key - Redis 缓存 key
   * @returns 反序列化后的缓存值，不存在或 Redis 不可用时返回 null
   */
  async cacheGet<T>(key: string): Promise<T | null> {
    const client = this.getClient();
    if (!client) {
      return null;
    }

    try {
      const raw = await client.get(key);
      if (raw === null || raw === undefined) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logDegraded('cacheGet', errorMsg);
      return null;
    }
  }

  /**
   * 设置 Redis 缓存
   * 将值 JSON 序列化后存储，可选 TTL（秒）
   * Redis 不可用或操作异常时静默降级，不抛异常
   * @param key - Redis 缓存 key
   * @param value - 缓存值
   * @param ttlSeconds - 可选的过期时间（秒），不传或非正数则不设置过期
   * @returns 无返回值
   */
  async cacheSet<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds !== undefined && ttlSeconds > 0) {
        await client.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await client.set(key, serialized);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logDegraded('cacheSet', errorMsg);
    }
  }

  /**
   * 删除 Redis 缓存 key
   * Redis 不可用或操作异常时静默降级，不抛异常
   * @param key - Redis 缓存 key
   * @returns 无返回值
   */
  async cacheDel(key: string): Promise<void> {
    const client = this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logDegraded('cacheDel', errorMsg);
    }
  }
}

export const redisService = RedisService.getInstance();
