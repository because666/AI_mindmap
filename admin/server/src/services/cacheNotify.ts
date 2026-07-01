import axios from 'axios';

const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:3001';

// 内部 API 通信令牌，未配置时为空字符串，由各调用函数在调用前延迟校验
// 与主服务 server/src/index.ts 保持一致：未配置时仅告警并跳过内部 API 调用，不阻塞服务启动
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || '';

/**
 * 熔断器状态类型
 * - closed: 关闭状态，请求正常通过
 * - open: 打开/熔断状态，所有请求快速失败
 * - half-open: 半开状态，允许一次试探请求
 */
type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * 熔断器打开时抛出的特定错误
 * 用于标识请求因熔断被快速拒绝，便于调用方区分熔断失败与业务失败
 */
export class CircuitBreakerOpenError extends Error {
  /**
   * 构造熔断器打开错误
   * @param message - 错误描述信息
   */
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/**
 * 熔断器（Circuit Breaker）
 * 实现 closed/open/half-open 三态状态机，保护下游服务免受持续失败请求冲击
 *
 * 状态流转说明：
 * - closed（关闭）：正常状态，请求正常通过。连续失败达到阈值时切换到 open
 * - open（打开/熔断）：熔断状态，所有请求直接快速失败，不发起 HTTP 请求。
 *   熔断时间窗口过后，下一次请求时切换到 half-open
 * - half-open（半开）：允许一次试探请求。成功则切换回 closed，失败则切换回 open
 *
 * 注意事项：
 * - 熔断器实例非线程安全，但 JavaScript 单线程模型下无需加锁
 * - half-open 状态下仅允许一次试探，并发请求可能因状态切换而表现不同
 */
export class CircuitBreaker {
  /** 当前熔断状态 */
  private state: CircuitState = 'closed';
  /** 连续失败计数 */
  private failureCount: number = 0;
  /** 触发熔断的连续失败阈值 */
  private readonly failureThreshold: number;
  /** 熔断时间窗口（毫秒），超过后从 open 切换到 half-open */
  private readonly resetTimeoutMs: number;
  /** 最近一次失败的时间戳（毫秒） */
  private lastFailureTime: number = 0;

  /**
   * 构造熔断器
   * @param failureThreshold - 触发熔断的连续失败阈值，默认 5 次
   * @param resetTimeoutMs - 熔断时间窗口毫秒数，默认 30000ms（30秒）
   */
  constructor(failureThreshold: number = 5, resetTimeoutMs: number = 30000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  /**
   * 在熔断器保护下执行异步操作
   *
   * 状态处理逻辑：
   * - closed 状态：正常执行 fn
   * - open 状态：检查是否超过熔断窗口，超过则切换到 half-open 并执行试探请求，否则快速失败
   * - half-open 状态：执行试探请求，根据结果切换状态
   *
   * @param fn - 要执行的异步函数
   * @returns fn 的返回值
   * @throws CircuitBreakerOpenError 当熔断器处于 open 状态且未到恢复时间时抛出
   * @throws 原 fn 抛出的错误 当 fn 执行失败时透传抛出
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // open 状态下检查是否可以切换到 half-open
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeoutMs) {
        // 熔断窗口已过，切换到半开状态允许试探请求
        this.state = 'half-open';
        console.warn('[熔断器] 状态从 open 切换到 half-open，允许试探请求');
      } else {
        // 仍在熔断窗口内，快速失败不发起实际请求
        throw new CircuitBreakerOpenError('熔断器处于打开状态，请求被快速拒绝');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * 请求成功时的状态处理
   * - half-open 状态下成功：恢复到 closed，重置失败计数
   * - closed 状态下成功：重置失败计数
   */
  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      console.warn('[熔断器] 半开状态试探成功，恢复到 closed');
    }
    this.failureCount = 0;
  }

  /**
   * 请求失败时的状态处理
   * - half-open 状态下失败：重新切换到 open
   * - closed 状态下失败：累加失败计数，达到阈值时切换到 open
   */
  private onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.state = 'open';
      console.warn('[熔断器] 半开状态试探失败，重新切换到 open');
    } else if (this.state === 'closed' && this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      console.warn(
        `[熔断器] 连续失败 ${this.failureCount} 次达到阈值 ${this.failureThreshold}，切换到 open`
      );
    }
  }

  /**
   * 获取当前熔断器状态（供测试与监控使用）
   * @returns 当前状态：'closed' | 'open' | 'half-open'
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * 重置熔断器到初始 closed 状态（供测试使用）
   * 清空失败计数与时间戳
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * 模块级熔断器实例
 * 用于保护所有对主服务端的缓存通知请求
 * 默认配置：连续失败 5 次触发熔断，熔断窗口 30 秒
 */
const circuitBreaker = new CircuitBreaker(5, 30000);

/**
 * 带指数退避的请求重试
 * 在请求失败时自动重试，每次重试的等待时间按指数增长
 * 第1次重试等待1s，第2次2s，第3次4s
 * @param requestFn - 要重试的异步请求函数
 * @param maxRetries - 最大重试次数，默认3次
 * @param baseDelayMs - 基础延迟毫秒数，默认1000ms
 * @returns Promise<void>
 * @throws 当所有重试均失败时，抛出最后一次请求的错误
 */
async function retryRequest(
  requestFn: () => Promise<void>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await requestFn();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        const retryCount = attempt + 1;
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(
          `[重试机制] 第${retryCount}次重试，${delay}ms后重试...`,
          error instanceof Error ? error.message : String(error)
        );
        await new Promise<void>(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error(
    `[重试机制] 已达最大重试次数(${maxRetries})，请求最终失败`,
    lastError instanceof Error ? lastError.message : String(lastError)
  );
  throw lastError;
}

/**
 * 通知主服务端清除指定访客的缓存
 * 在封禁/解封用户后调用，失败时自动重试
 * @param visitorId - 访客ID
 */
export async function notifyVisitorCacheClear(visitorId: string): Promise<void> {
  try {
    await circuitBreaker.execute(() => retryRequest(async () => {
      await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {
        type: 'visitor',
        visitorId,
      }, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
        timeout: 5000,
      });
    }));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('[缓存通知] 通知主服务端清除访客缓存被熔断拒绝:', error.message);
      return;
    }
    console.error('[缓存通知] 通知主服务端清除访客缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端清除指定工作区的缓存
 * 在关闭/开启工作区后调用，失败时自动重试
 * @param workspaceId - 工作区ID
 */
export async function notifyWorkspaceCacheClear(workspaceId: string): Promise<void> {
  try {
    await circuitBreaker.execute(() => retryRequest(async () => {
      await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {
        type: 'workspace',
        workspaceId,
      }, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
        timeout: 5000,
      });
    }));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('[缓存通知] 通知主服务端清除工作区缓存被熔断拒绝:', error.message);
      return;
    }
    console.error('[缓存通知] 通知主服务端清除工作区缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端清除敏感词缓存
 * 在更新敏感词配置后调用，失败时自动重试
 */
export async function notifySensitiveWordCacheClear(): Promise<void> {
  if (!INTERNAL_TOKEN) {
    console.warn('[缓存通知] INTERNAL_API_TOKEN 未配置，跳过敏感词缓存清除通知');
    return;
  }
  try {
    await circuitBreaker.execute(() => retryRequest(async () => {
      await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {
        type: 'sensitive-word',
      }, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
        timeout: 5000,
      });
    }));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('[缓存通知] 通知主服务端清除敏感词缓存被熔断拒绝:', error.message);
      return;
    }
    console.error('[缓存通知] 通知主服务端清除敏感词缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端清除所有缓存
 * 失败时自动重试
 */
export async function notifyAllCacheClear(): Promise<void> {
  try {
    await circuitBreaker.execute(() => retryRequest(async () => {
      await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {}, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
        timeout: 5000,
      });
    }));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('[缓存通知] 通知主服务端清除所有缓存被熔断拒绝:', error.message);
      return;
    }
    console.error('[缓存通知] 通知主服务端清除所有缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端发送反馈处理结果推送
 * 管理员更新反馈状态后调用，失败时自动重试
 * @param visitorId - 反馈提交者的访客ID
 * @param feedbackTitle - 反馈标题
 * @param newStatus - 新的反馈状态
 */
export async function notifyFeedbackPush(
  visitorId: string,
  feedbackTitle: string,
  newStatus: string
): Promise<void> {
  try {
    await circuitBreaker.execute(() => retryRequest(async () => {
      await axios.post(`${MAIN_SERVER_URL}/api/internal/push/feedback-notification`, {
        visitorId,
        feedbackTitle,
        newStatus,
      }, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
        timeout: 5000,
      });
    }));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('[反馈推送] 推送请求被熔断拒绝:', error.message);
      return;
    }
    const err = error as { response?: { status: number; data: unknown }; message?: string };
    if (err.response) {
      const status = err.response.status;
      const data = JSON.stringify(err.response.data);
      if (status === 403) {
        console.error('[反馈推送] 鉴权失败(403): 请检查 INTERNAL_API_TOKEN 配置一致性');
      } else {
        console.error('[反馈推送] HTTP调用失败, status:', status, ', response:', data);
      }
    } else if (err.message) {
      console.error('[反馈推送] 网络请求失败, 无法连接主服务端:', err.message);
    } else {
      console.error('[反馈推送] 未知错误:', error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * 通知主服务端刷新 AI 模型配置
 * 管理员在后台修改模型配置后调用，触发主服务从 MongoDB 重新加载启用配置
 * 失败时仅输出警告，不影响 admin 后台主流程
 */
export async function notifyAIModelsRefresh(): Promise<void> {
  if (!INTERNAL_TOKEN) {
    console.warn('[AI模型] INTERNAL_API_TOKEN 未配置，跳过 AI 模型配置刷新通知');
    return;
  }
  try {
    await circuitBreaker.execute(() => retryRequest(async () => {
      await axios.post(`${MAIN_SERVER_URL}/api/internal/refresh-ai-models`, {}, {
        headers: { 'x-internal-token': INTERNAL_TOKEN },
        timeout: 5000,
      });
    }));
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      console.warn('[AI模型] 刷新通知被熔断拒绝:', error.message);
      return;
    }
    const err = error as { response?: { status: number; data: unknown }; message?: string };
    if (err.response) {
      const status = err.response.status;
      const data = JSON.stringify(err.response.data);
      if (status === 403) {
        console.error('[AI模型] 刷新鉴权失败(403): 请检查 INTERNAL_API_TOKEN 配置一致性');
      } else {
        console.error('[AI模型] 刷新HTTP调用失败, status:', status, ', response:', data);
      }
    } else if (err.message) {
      console.error('[AI模型] 刷新网络请求失败, 无法连接主服务端:', err.message);
    } else {
      console.error('[AI模型] 刷新未知错误:', error instanceof Error ? error.message : String(error));
    }
  }
}
