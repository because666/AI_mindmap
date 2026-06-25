import { Router, type Request, type Response } from 'express';
import { mongoDBService } from '../data/mongodb/connection';

const router = Router();

/**
 * 事件文档接口
 * 定义写入 MongoDB events 集合的单条事件结构
 */
interface AnalyticsEvent {
  /** 事件类型，必填，如 page_view、click、node_create */
  eventType: string;
  /** 访客唯一标识，可选 */
  visitorId?: string;
  /** 工作区唯一标识，可选 */
  workspaceId?: string;
  /** 节点唯一标识，可选 */
  nodeId?: string;
  /** 脑图唯一标识，可选 */
  mapId?: string;
  /** 事件附加载荷，可选，必须为普通对象 */
  payload?: Record<string, unknown>;
  /** 事件发生时的页面 URL，可选 */
  url?: string;
  /** 客户端 User-Agent，可选 */
  userAgent?: string;
  /** 事件发生时间（客户端上报），必填 */
  timestamp: Date;
  /** 服务端接收时间，必填 */
  createdAt: Date;
}

/**
 * 批量事件请求体接口
 * @property events 事件对象数组
 */
interface EventsRequestBody {
  events: unknown[];
}

/**
 * 标准化响应体接口
 * @property success 是否成功
 * @property error 错误信息，仅在失败时返回
 */
interface EventsResponseBody {
  success: boolean;
  error?: string;
}

/**
 * 限流记录接口
 * @property count 当前窗口期内请求次数
 * @property firstRequestTime 窗口期起始时间戳（毫秒）
 */
interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

/**
 * 限流时间窗口（毫秒）
 * 可通过 EVENTS_RATE_LIMIT_WINDOW_MS 环境变量配置，默认 1 分钟
 */
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.EVENTS_RATE_LIMIT_WINDOW_MS || '60000', 10);

/**
 * 限流窗口内单 IP 最大事件批次数
 * 可通过 EVENTS_RATE_LIMIT_MAX 环境变量配置，默认 60 次
 */
const RATE_LIMIT_MAX = parseInt(process.env.EVENTS_RATE_LIMIT_MAX || '60', 10);

/**
 * 单批次最大事件数量
 * 防止客户端一次性上报过多事件导致内存和数据库压力过大
 */
const MAX_BATCH_SIZE = 100;

/**
 * 单条 eventType 最大长度
 * 防止异常长字符串占用存储空间
 */
const MAX_EVENT_TYPE_LENGTH = 64;

/**
 * 单条字符串字段最大长度
 * 用于 visitorId、workspaceId、nodeId、mapId、url、userAgent 的截断限制
 */
const MAX_STRING_FIELD_LENGTH = 512;

/**
 * IP 限流存储
 * 键为客户端 IP 地址，值为限流记录
 * 采用内存 Map 实现简单限流，服务重启后记录会丢失
 */
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * 获取客户端 IP 地址
 * 优先使用请求头中的 x-forwarded-for，否则使用 req.ip 或 socket 远程地址
 * @param req - Express 请求对象
 * @returns 客户端 IP 地址
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) {
    const ips = forwarded.split(',').map((ip) => ip.trim());
    if (ips.length > 0 && ips[0]) return ips[0];
  }
  const realIp = req.headers['x-real-ip'] as string | undefined;
  if (realIp) return realIp.trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * 检查 IP 是否超过限流阈值
 * 每 IP 在每个时间窗口内最多允许 RATE_LIMIT_MAX 次请求
 * @param ip - 客户端 IP 地址
 * @returns 超过限流返回 true，未超过返回 false
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, firstRequestTime: now });
    return false;
  }

  const elapsed = now - record.firstRequestTime;
  if (elapsed > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstRequestTime: now });
    return false;
  }

  record.count += 1;
  if (record.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

/**
 * 截断字符串字段
 * 超过最大长度时截断并追加省略标记，避免存储异常长字符串
 * @param value - 原始字符串
 * @param maxLength - 最大允许长度
 * @returns 截断后的字符串
 */
function truncateString(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + '...';
}

/**
 * 解析并校验日期字段
 * 支持 ISO 字符串、数字时间戳或 Date 对象
 * @param value - 待解析的值
 * @returns 解析后的 Date 对象，解析失败返回 null
 */
function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * 校验并标准化单条事件
 * @param rawEvent - 客户端上报的原始事件对象
 * @param defaultVisitorId - 从请求头读取的默认访客 ID
 * @returns 标准化后的事件对象，校验失败返回 null
 */
function validateEvent(rawEvent: unknown, defaultVisitorId: string | undefined): AnalyticsEvent | null {
  if (rawEvent === null || typeof rawEvent !== 'object') {
    return null;
  }

  const event = rawEvent as Record<string, unknown>;

  const eventType = event.eventType;
  if (typeof eventType !== 'string' || eventType.trim().length === 0) {
    return null;
  }
  const normalizedEventType = truncateString(eventType.trim(), MAX_EVENT_TYPE_LENGTH);

  const timestamp = parseDate(event.timestamp);
  if (timestamp === null) {
    return null;
  }

  const createdAt = parseDate(event.createdAt) || new Date();

  let visitorId: string | undefined;
  if (event.visitorId !== undefined && event.visitorId !== null) {
    if (typeof event.visitorId !== 'string') return null;
    visitorId = truncateString(event.visitorId.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }
  if (!visitorId && defaultVisitorId) {
    visitorId = truncateString(defaultVisitorId.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }

  let workspaceId: string | undefined;
  if (event.workspaceId !== undefined && event.workspaceId !== null) {
    if (typeof event.workspaceId !== 'string') return null;
    workspaceId = truncateString(event.workspaceId.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }

  let nodeId: string | undefined;
  if (event.nodeId !== undefined && event.nodeId !== null) {
    if (typeof event.nodeId !== 'string') return null;
    nodeId = truncateString(event.nodeId.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }

  let mapId: string | undefined;
  if (event.mapId !== undefined && event.mapId !== null) {
    if (typeof event.mapId !== 'string') return null;
    mapId = truncateString(event.mapId.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }

  let url: string | undefined;
  if (event.url !== undefined && event.url !== null) {
    if (typeof event.url !== 'string') return null;
    url = truncateString(event.url.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }

  let userAgent: string | undefined;
  if (event.userAgent !== undefined && event.userAgent !== null) {
    if (typeof event.userAgent !== 'string') return null;
    userAgent = truncateString(event.userAgent.trim(), MAX_STRING_FIELD_LENGTH) || undefined;
  }

  let payload: Record<string, unknown> | undefined;
  if (event.payload !== undefined && event.payload !== null) {
    if (typeof event.payload !== 'object' || Array.isArray(event.payload)) return null;
    payload = event.payload as Record<string, unknown>;
  }

  return {
    eventType: normalizedEventType,
    visitorId,
    workspaceId,
    nodeId,
    mapId,
    payload,
    url,
    userAgent,
    timestamp,
    createdAt,
  };
}

/**
 * 批量事件接收接口
 * POST /api/events
 * 接收客户端批量上报的用户行为事件，进行参数校验和限流后写入 MongoDB events 集合
 * 不需要内部 API token 认证，但会读取 X-Visitor-Id 请求头用于识别用户
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const clientIp = getClientIp(req);

    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        success: false,
        error: '事件上报过于频繁，请稍后再试',
      } as EventsResponseBody);
    }

    const { events } = req.body as EventsRequestBody;

    if (!Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: '请求参数错误，events 必须为数组',
      } as EventsResponseBody);
    }

    if (events.length === 0) {
      return res.status(400).json({
        success: false,
        error: '事件数组不能为空',
      } as EventsResponseBody);
    }

    if (events.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        success: false,
        error: `单次最多上报 ${MAX_BATCH_SIZE} 条事件`,
      } as EventsResponseBody);
    }

    const defaultVisitorId = req.headers['x-visitor-id'] as string | undefined;

    const validEvents: AnalyticsEvent[] = [];
    for (let index = 0; index < events.length; index += 1) {
      const validated = validateEvent(events[index], defaultVisitorId);
      if (validated === null) {
        return res.status(400).json({
          success: false,
          error: `第 ${index + 1} 条事件格式不正确：缺少 eventType 或 timestamp，或字段类型不匹配`,
        } as EventsResponseBody);
      }
      validEvents.push(validated);
    }

    const collection = mongoDBService.getCollection<AnalyticsEvent>('events');
    if (!collection) {
      console.error('[Events] 事件写入失败：MongoDB 未连接');
      return res.status(503).json({
        success: false,
        error: '事件存储服务暂不可用',
      } as EventsResponseBody);
    }

    try {
      await collection.insertMany(validEvents);
    } catch (dbError) {
      const errorMsg = dbError instanceof Error ? dbError.message : String(dbError);
      console.error('[Events] 事件批量写入失败:', errorMsg);
      return res.status(500).json({
        success: false,
        error: '事件存储失败，请稍后再试',
      } as EventsResponseBody);
    }

    return res.json({
      success: true,
    } as EventsResponseBody);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[Events] 事件接收异常:', errorMsg);
    return res.status(500).json({
      success: false,
      error: '事件接收失败，请稍后再试',
    } as EventsResponseBody);
  }
});

export default router;
