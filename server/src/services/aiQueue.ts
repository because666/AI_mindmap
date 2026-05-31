/**
 * AI请求优先级队列服务
 * 提供基于优先级的请求调度，确保用户对话请求优先于后台任务处理
 */

/** 请求优先级枚举 */
export enum AIPriority {
  /** 用户对话（最高优先级） */
  P0_DIALOG = 0,
  /** 后台任务（标题生成、结论提炼等） */
  P1_BACKGROUND = 1,
}

/** 队列请求项接口 */
interface QueueItem {
  /** 唯一标识 */
  id: string;
  /** 优先级 */
  priority: AIPriority;
  /** 执行函数，返回Promise */
  execute: () => Promise<unknown>;
  /** 成功回调 */
  resolve: (value: unknown) => void;
  /** 失败回调 */
  reject: (error: Error) => void;
  /** 创建时间戳 */
  createdAt: number;
  /** 请求描述 */
  description: string;
}

/** 队列统计信息接口 */
export interface QueueStats {
  /** 当前活跃请求数 */
  activeCount: number;
  /** 最大并发数 */
  maxConcurrency: number;
  /** P0队列长度 */
  p0QueueLength: number;
  /** P1队列长度 */
  p1QueueLength: number;
}

/**
 * AI请求队列服务
 * 管理AI请求的优先级调度和并发控制，P0对话请求优先于P1后台任务
 */
class AIQueueService {
  /** P0优先级队列（用户对话） */
  private p0Queue: QueueItem[] = [];
  /** P1优先级队列（后台任务） */
  private p1Queue: QueueItem[] = [];
  /** 当前活跃请求数 */
  private activeCount: number = 0;
  /** 最大并发数 */
  private maxConcurrency: number;
  /** 是否正在处理队列（防止并发调度） */
  private processing: boolean = false;
  /** ID计数器 */
  private idCounter: number = 0;

  /**
   * 构造函数
   * @param maxConcurrency - 最大并发数，默认5
   */
  constructor(maxConcurrency: number = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  /**
   * 生成唯一队列项ID
   * @returns 队列项ID字符串
   */
  private generateId(): string {
    return `q-${Date.now()}-${++this.idCounter}`;
  }

  /**
   * 将请求加入优先级队列
   * 根据优先级放入对应队列，等待调度执行，返回Promise在请求完成时resolve/reject
   * @param priority - 请求优先级
   * @param execute - 实际执行函数，返回Promise<T>
   * @param description - 请求描述，用于日志和调试
   * @returns Promise<T>，当请求执行完成时resolve，失败时reject
   */
  enqueue<T>(priority: AIPriority, execute: () => Promise<T>, description: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const item: QueueItem = {
        id: this.generateId(),
        priority,
        execute: execute as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        createdAt: Date.now(),
        description,
      };

      if (priority === AIPriority.P0_DIALOG) {
        this.p0Queue.push(item);
      } else {
        this.p1Queue.push(item);
      }

      this.scheduleProcess();
    });
  }

  /**
   * 获取队列执行槽位，用于流式请求场景
   * 返回一个释放函数，调用后释放槽位并触发后续队列处理
   * 适用于AsyncGenerator等需要手动控制生命周期的场景
   * @param priority - 请求优先级
   * @param description - 请求描述
   * @returns 释放函数，调用后释放占用的并发槽位
   */
  async acquireSlot(priority: AIPriority, description: string): Promise<() => void> {
    return new Promise<() => void>((outerResolve) => {
      const item: QueueItem = {
        id: this.generateId(),
        priority,
        execute: async (): Promise<unknown> => {
          return new Promise<unknown>((innerResolve) => {
            outerResolve(() => {
              innerResolve(undefined);
            });
          });
        },
        resolve: () => {},
        reject: () => {},
        createdAt: Date.now(),
        description,
      };

      if (priority === AIPriority.P0_DIALOG) {
        this.p0Queue.push(item);
      } else {
        this.p1Queue.push(item);
      }

      this.scheduleProcess();
    });
  }

  /**
   * 通过microtask调度队列处理
   * 确保入队操作完成后再处理队列，避免同步调用导致的时序问题
   */
  private scheduleProcess(): void {
    queueMicrotask(() => {
      this.processQueue();
    });
  }

  /**
   * 处理优先级队列
   * 从P0队列优先取任务，P0为空时从P1队列取
   * 每次取出任务时activeCount++，任务完成时activeCount--并再次调度处理
   * 使用processing标志防止并发调度
   */
  private processQueue(): void {
    if (this.processing) return;
    this.processing = true;

    while (this.activeCount < this.maxConcurrency) {
      const item = this.p0Queue.shift() || this.p1Queue.shift();
      if (!item) break;

      this.activeCount++;

      item
        .execute()
        .then((result: unknown) => {
          item.resolve(result);
        })
        .catch((error: Error) => {
          item.reject(error);
        })
        .finally(() => {
          this.activeCount--;
          this.processing = false;
          this.scheduleProcess();
        });
    }

    this.processing = false;
  }

  /**
   * 获取队列统计信息
   * @returns 包含活跃数、最大并发数、各队列长度的统计对象
   */
  getStats(): QueueStats {
    return {
      activeCount: this.activeCount,
      maxConcurrency: this.maxConcurrency,
      p0QueueLength: this.p0Queue.length,
      p1QueueLength: this.p1Queue.length,
    };
  }
}

/** AI请求队列单例 */
export const aiQueue = new AIQueueService();
