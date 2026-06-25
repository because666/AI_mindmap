import Redis from 'ioredis';
import { config } from '../config';

/**
 * Admin 后台 Redis 连接管理（简化版单例）
 * 负责管理 Redis 客户端的创建、连接和断开
 * 连接失败时不会阻塞服务启动，仅打印警告并标记为不可用
 */
let redisClient: Redis | null = null;

/**
 * 初始化 Redis 连接
 * 从 config.redis 读取连接配置（host、port、password）
 * 连接失败时打印警告但不抛异常，redisClient 保持为 null
 * 注册 error 事件监听（断开时标记不可用）和 reconnect 事件监听（重连成功时标记可用）
 * @returns {Promise<void>} 无返回值
 */
export async function initializeRedis(): Promise<void> {
  if (redisClient) return;

  const { host, port, password } = config.redis;

  console.log(`🔌 后台系统连接 Redis: ${host}:${port}...`);

  try {
    redisClient = new Redis({
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

    redisClient.on('error', (err: Error) => {
      console.warn(`⚠️ 后台系统 Redis 连接错误: ${err.message}`);
    });

    redisClient.on('reconnect', () => {
      console.log('✅ 后台系统 Redis 重连成功');
    });

    redisClient.on('close', () => {
      console.warn('⚠️ 后台系统 Redis 连接已关闭');
    });

    await redisClient.connect();
    console.log('✅ 后台系统 Redis 连接成功');
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️ 后台系统 Redis 连接失败: ${errorMsg}`);
    console.warn('⚠️ 继续运行，Redis 缓存功能不可用，将使用内存缓存降级');
    if (redisClient) {
      try {
        redisClient.disconnect();
      } catch (_cleanupError: unknown) {
        // 断开失败时忽略，客户端将被丢弃
      }
      redisClient = null;
    }
  }
}

/**
 * 获取 Redis 客户端实例
 * 当 Redis 不可用时返回 null，调用方需自行处理降级逻辑
 * @returns {Redis | null} Redis 客户端实例，不可用时返回 null
 */
export function getRedisClient(): Redis | null {
  if (!redisClient) return null;
  if (redisClient.status !== 'ready') return null;
  return redisClient;
}

/**
 * 关闭 Redis 连接
 * 断开连接后重置客户端为 null
 * @returns {Promise<void>} 无返回值
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 后台系统 Redis 断开连接时出错: ${errorMsg}`);
      redisClient.disconnect();
    }
    redisClient = null;
    console.log('✅ 后台系统 Redis 连接已关闭');
  }
}
