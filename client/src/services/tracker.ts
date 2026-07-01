import { httpClient, getLocalVisitorId, getLocalWorkspaceId } from './api';

/**
 * 页面浏览事件
 */
export const TRACK_EVENT_PAGE_VIEW = 'page_view';

/**
 * 节点创建事件
 */
export const TRACK_EVENT_NODE_CREATED = 'node_created';

/**
 * 分支创建事件（手动点击"+ 分支"）
 */
export const TRACK_EVENT_BRANCH_CREATED = 'branch_created';

/**
 * 延伸方向点击事件（Task 2 使用）
 */
export const TRACK_EVENT_EXTENSION_DIRECTION_CLICK = 'extension_direction_click';

/**
 * 摘要生成事件（Task 3 使用）
 */
export const TRACK_EVENT_SUMMARY_GENERATED = 'summary_generated';

/**
 * 导图创建事件
 */
export const TRACK_EVENT_MAP_CREATED = 'map_created';

/**
 * 分叉提示展示事件
 */
export const TRACK_EVENT_BRANCH_SUGGESTION_SHOWN = 'branch_suggestion_shown';

/**
 * 分叉提示接受事件（用户点击"创建分支"）
 */
export const TRACK_EVENT_BRANCH_SUGGESTION_ACCEPTED = 'branch_suggestion_accepted';

/**
 * 分叉提示忽略事件（用户点击"忽略"或直接发送）
 */
export const TRACK_EVENT_BRANCH_SUGGESTION_DISMISSED = 'branch_suggestion_dismissed';

/**
 * 地图优先大纲生成事件（Task 4 使用）
 * 用户确认"展开成地图"后，AI 成功生成结构化大纲并创建分支节点时上报
 */
export const TRACK_EVENT_MAP_FIRST_OUTLINE_GENERATED = 'map_first_outline_generated';

/**
 * 地图优先提示展示事件（Task 4 使用）
 * 当检测到宽泛问题并展示"是否先展开成地图"提示气泡时上报
 */
export const TRACK_EVENT_MAP_FIRST_PROMPT_SHOWN = 'map_first_prompt_shown';

/**
 * 模板使用事件（用户选择模板创建地图）
 */
export const TRACK_EVENT_TEMPLATE_USED = 'template_used';

/**
 * 地图库面板打开
 */
export const TRACK_EVENT_MAP_LIBRARY_OPENED = 'map_library_opened';

/**
 * 地图库搜索
 */
export const TRACK_EVENT_MAP_LIBRARY_SEARCH = 'map_library_search';

/**
 * 地图库切换地图
 */
export const TRACK_EVENT_MAP_LIBRARY_SWITCH = 'map_library_switch';

/**
 * 埋点事件公共属性接口
 */
export interface TrackerEventCommonProps {
  /** 访客唯一标识 */
  visitorId: string | null;
  /** 当前工作区ID */
  workspaceId: string | null;
  /** 事件触发时间戳（毫秒） */
  timestamp: number;
  /** 当前页面URL */
  url: string;
  /** 浏览器 UserAgent */
  userAgent: string;
}

/**
 * 埋点事件数据接口
 * 采用扁平结构，与服务端 events.ts 的 AnalyticsEvent 接口字段对齐
 */
export interface TrackerEvent {
  /** 事件类型 */
  eventType: string;
  /** 访客唯一标识 */
  visitorId: string | null;
  /** 当前工作区ID */
  workspaceId: string | null;
  /** 事件触发时间戳（毫秒） */
  timestamp: number;
  /** 当前页面URL */
  url: string;
  /** 浏览器 UserAgent */
  userAgent: string;
  /** 事件自定义负载 */
  payload: Record<string, unknown>;
  /** 关联节点ID（与服务端 AnalyticsEvent.nodeId 对齐，可选） */
  nodeId?: string;
  /** 关联地图（工作区）ID（与服务端 AnalyticsEvent.mapId 对齐，可选） */
  mapId?: string;
}

/**
 * 埋点上报配置接口
 */
export interface TrackerConfig {
  /** 批量上报的队列容量阈值，达到该值立即触发上报，默认 10 */
  batchSize: number;
  /** 定时上报间隔（毫秒），默认 5000 */
  flushIntervalMs: number;
  /** 上报失败时的最大重试次数，默认 1 */
  maxRetries: number;
  /** 后端批量接收事件接口路径，默认 /events */
  endpoint: string;
}

/**
 * 待上报队列项接口
 * 用于记录事件原始数据及重试状态
 */
interface PendingEventItem {
  /** 事件类型 */
  eventType: string;
  /** 事件自定义负载 */
  payload: Record<string, unknown>;
  /** 当前重试次数 */
  retryCount: number;
}

/**
 * 默认埋点配置
 */
const DEFAULT_CONFIG: TrackerConfig = {
  batchSize: 10,
  flushIntervalMs: 5000,
  maxRetries: 1,
  endpoint: '/events',
};

/**
 * 判断当前是否处于浏览器环境
 * @returns 是否为浏览器环境
 */
const isBrowser = (): boolean => {
  return typeof window !== 'undefined' && typeof navigator !== 'undefined';
};

/**
 * 获取当前页面URL
 * 非浏览器环境下返回空字符串
 * @returns 当前页面URL
 */
const getCurrentUrl = (): string => {
  if (!isBrowser()) {
    return '';
  }
  return window.location.href;
};

/**
 * 获取当前浏览器 UserAgent
 * 非浏览器环境下返回空字符串
 * @returns 浏览器 UserAgent
 */
const getUserAgent = (): string => {
  if (!isBrowser()) {
    return '';
  }
  return navigator.userAgent;
};

/**
 * 埋点 SDK 类
 * 负责事件采集、批量缓存、定时/定量上报、页面离开前兜底上报
 * 所有上报异常均静默处理，不阻塞用户操作
 */
export class Tracker {
  /** 当前配置 */
  private config: TrackerConfig;

  /** 内存事件队列 */
  private queue: PendingEventItem[] = [];

  /** 定时上报计时器 */
  private flushTimer: number | null = null;

  /** 是否已挂载页面离开监听器 */
  private beforeUnloadBound = false;

  /**
   * 创建 Tracker 实例
   * @param config - 可选自定义配置，未指定字段使用默认值
   */
  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bindBeforeUnload();
  }

  /**
   * 采集并缓存一个埋点事件
   * 当队列达到 batchSize 时立即触发批量上报
   * @param eventType - 事件类型
   * @param payload - 事件自定义负载，可选
   */
  track(eventType: string, payload: Record<string, unknown> = {}): void {
    const item: PendingEventItem = {
      eventType,
      payload: { ...payload },
      retryCount: 0,
    };

    this.queue.push(item);

    if (this.queue.length >= this.config.batchSize) {
      void this.flush();
    } else if (this.flushTimer === null) {
      this.startFlushTimer();
    }
  }

  /**
   * 立即将当前队列中的所有事件批量上报到后端
   * 上报失败时会对失败事件重试一次（默认 maxRetries=1），重试仍失败则丢弃并静默处理
   * @returns Promise，resolve 表示本次上报流程结束（无论成功或失败）
   */
  async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const eventsToFlush = this.queue.splice(0, this.queue.length);
    const events = eventsToFlush.map((item) => this.buildTrackerEvent(item));

    try {
      await this.sendEvents(events);
    } catch (error) {
      const retryableItems = eventsToFlush.filter((item) => item.retryCount < this.config.maxRetries);

      if (retryableItems.length > 0) {
        retryableItems.forEach((item) => {
          item.retryCount += 1;
        });
        this.queue.unshift(...retryableItems);

        try {
          await this.flush();
        } catch (retryError) {
          console.error('[Tracker] 重试上报失败:', retryError);
        }
      } else {
        console.error('[Tracker] 批量上报失败，已达最大重试次数:', error);
      }
    } finally {
      if (this.queue.length === 0 && this.flushTimer !== null) {
        window.clearInterval(this.flushTimer);
        this.flushTimer = null;
      }
    }
  }

  /**
   * 销毁 Tracker 实例
   * 清理定时器并解绑页面离开监听器
   */
  destroy(): void {
    if (this.flushTimer !== null) {
      window.clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.beforeUnloadBound && isBrowser()) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      this.beforeUnloadBound = false;
    }

    this.queue = [];
  }

  /**
   * 构建完整埋点事件对象
   * 自动附加公共属性：visitorId、workspaceId、timestamp、url、userAgent
   * @param item - 待上报队列项
   * @returns 完整埋点事件对象
   */
  private buildTrackerEvent(item: PendingEventItem): TrackerEvent {
    return {
      eventType: item.eventType,
      visitorId: getLocalVisitorId(),
      workspaceId: getLocalWorkspaceId(),
      timestamp: Date.now(),
      url: getCurrentUrl(),
      userAgent: getUserAgent(),
      payload: item.payload,
    };
  }

  /**
   * 通过 axios 客户端发送批量事件
   * 复用 httpClient 可自动注入访客认证请求头
   * @param events - 待上报事件列表
   * @returns Promise，resolve 表示 HTTP 请求成功
   * @throws 当 HTTP 请求非 2xx 或网络异常时抛出错误
   */
  private async sendEvents(events: TrackerEvent[]): Promise<void> {
    const response = (await httpClient.post(this.config.endpoint, {
      events,
    })) as unknown as { success: boolean; error?: string };

    if (typeof response === 'object' && response !== null && response.success === false) {
      throw new Error(response.error || '批量上报接口返回失败状态');
    }
  }

  /**
   * 启动定时上报计时器
   */
  private startFlushTimer(): void {
    if (!isBrowser()) {
      return;
    }

    this.flushTimer = window.setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
  }

  /**
   * 绑定页面离开前兜底上报监听器
   * 优先使用 navigator.sendBeacon 同步发送，不可用时不阻塞地尝试普通 fetch
   */
  private bindBeforeUnload(): void {
    if (!isBrowser() || this.beforeUnloadBound) {
      return;
    }

    window.addEventListener('beforeunload', this.handleBeforeUnload);
    this.beforeUnloadBound = true;
  }

  /**
   * 页面离开前回调
   * 尝试使用 sendBeacon 上报剩余事件，失败则静默丢弃
   */
  private handleBeforeUnload = (): void => {
    if (this.queue.length === 0) {
      return;
    }

    const events = this.queue.map((item) => this.buildTrackerEvent(item));
    const payload = JSON.stringify({ events });
    const apiBaseUrl = this.getApiBaseUrl();
    const url = `${apiBaseUrl}${this.config.endpoint}`;

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        const success = navigator.sendBeacon(url, blob);
        if (success) {
          this.queue = [];
          return;
        }
      }

      void fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch((error: unknown) => {
        console.error('[Tracker] 页面离开前兜底上报失败:', error);
      });
    } catch (error) {
      console.error('[Tracker] 页面离开前 sendBeacon 上报异常:', error);
    }
  };

  /**
   * 获取 API 基础 URL
   * 与 api.ts 中 getApiBaseUrl 逻辑保持一致，用于 sendBeacon 手动拼接完整路径
   * @returns API 基础 URL
   */
  private getApiBaseUrl(): string {
    if (import.meta.env.VITE_API_URL) {
      const envUrl = import.meta.env.VITE_API_URL as string;
      return envUrl;
    }
    if (import.meta.env.PROD) {
      return '/api';
    }
    return 'http://localhost:3001/api';
  }
}

/**
 * 全局 Tracker 单例
 * 使用默认配置，项目各模块统一通过该实例采集事件
 */
export const tracker = new Tracker();

/**
 * 便捷的事件采集函数
 * 等价于 tracker.track(eventType, payload)
 * @param eventType - 事件类型
 * @param payload - 事件自定义负载，可选
 */
export const track = (eventType: string, payload: Record<string, unknown> = {}): void => {
  tracker.track(eventType, payload);
};
