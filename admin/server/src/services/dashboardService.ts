import { Document } from 'mongodb';
import { adminDB } from '../config/database';
import { getRedisClient } from '../data/redis';
import {
  DashboardStats,
  TrendData,
  RetentionTrendData,
  ConversionFunnelData,
  EventOverviewData,
  EventTrendData,
  EventFunnelData,
  RecentEventItem,
  FeatureAdoptionData,
  FeatureAdoptionItem,
  OnlineStatusData,
  OnlineCurvePoint,
} from '../types';

/**
 * 功能采用矩阵事件映射项
 * 描述事件类型到展示名称的映射关系
 */
interface FeatureEventMapping {
  eventType: string;
  displayName: string;
}

/**
 * 按分钟聚合结果接口
 * 表示单分钟内的独立访客数
 */
interface MinuteAggregationResult {
  _id: string;
  uniqueVisitors: string[];
}

/**
 * 聚合结果条目接口
 * 表示按日聚合后的单条记录
 */
interface AggregationDayResult {
  _id: string;
  count: number;
}

/**
 * 按日去重用户聚合结果接口
 * 表示按日聚合后的用户ID集合
 */
interface AggregationDayUsersResult {
  _id: string;
  userIds: string[];
}

/**
 * 去重用户数聚合结果接口
 * 表示单个去重用户计数值
 */
interface DistinctCountResult {
  _id: null;
  count: number;
}

/**
 * 事件按日聚合结果接口
 * 表示单日内的事件数量
 */
interface EventAggregationDayResult {
  _id: string;
  count: number;
}

/**
 * 缓存条目接口（内存降级用）
 * 包含缓存数据与过期时间戳
 */
interface CacheEntry {
  data: TrendData;
  expireAt: number;
}

/**
 * 数据大盘服务
 * 提供系统运营数据的统计与查询
 * 缓存策略：优先使用 Redis，Redis 不可用时降级为内存 Map
 */
class DashboardService {
  private memoryCache: Map<string, CacheEntry> = new Map();

  private static readonly CACHE_TTL_MS = 60 * 1000;

  private static readonly CACHE_TTL_SECONDS = 60;

  private static readonly CACHE_KEY_PREFIX = 'dashboard_cache';

  private static readonly CACHE_KEY_TRENDS = 'dashboard_trends';

  /**
   * 从缓存中获取数据
   * 优先从 Redis 获取，Redis 不可用时降级到内存缓存
   * @param cacheKey - 缓存键名
   * @returns 缓存的 TrendData 或 null（缓存不存在或已过期）
   */
  private async getCache(cacheKey: string): Promise<TrendData | null> {
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        const cached = await redisClient.get(`${DashboardService.CACHE_KEY_PREFIX}:${cacheKey}`);
        if (cached) {
          return JSON.parse(cached) as TrendData;
        }
        return null;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Redis 读取缓存失败，降级到内存缓存: ${errorMsg}`);
      }
    }

    const memoryCached = this.memoryCache.get(cacheKey);
    if (memoryCached && memoryCached.expireAt > Date.now()) {
      return memoryCached.data;
    }

    return null;
  }

  /**
   * 将数据写入缓存
   * 优先写入 Redis（带 TTL），Redis 不可用时降级到内存缓存
   * @param cacheKey - 缓存键名
   * @param data - 需要缓存的趋势数据
   */
  private async setCache(cacheKey: string, data: TrendData): Promise<void> {
    const redisClient = getRedisClient();
    if (redisClient) {
      try {
        await redisClient.set(
          `${DashboardService.CACHE_KEY_PREFIX}:${cacheKey}`,
          JSON.stringify(data),
          'EX',
          DashboardService.CACHE_TTL_SECONDS
        );
        return;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Redis 写入缓存失败，降级到内存缓存: ${errorMsg}`);
      }
    }

    this.memoryCache.set(cacheKey, {
      data,
      expireAt: Date.now() + DashboardService.CACHE_TTL_MS,
    });
  }

  /**
   * 获取核心统计指标
   * 包括用户、工作区、内容三维度数据
   * 消息统计已从 $unwind 改为直接对 messages 集合查询
   * onlineNow 查询 visitors 集合中 lastSeen >= now-5min 的数量，
   * 与 getOnlineStatus 中的在线判定逻辑保持一致
   * @returns DashboardStats 统计数据
   */
  async getStats(): Promise<DashboardStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const totalVisitors = await adminDB.countDocuments('visitors');
    const todayNewVisitors = await adminDB.countDocuments('visitors', {
      createdAt: { $gte: today },
    } as never);
    const todayActiveVisitors = await adminDB.countDocuments('visitors', {
      lastSeen: { $gte: today },
    } as never);
    const weekActiveVisitors = await adminDB.countDocuments('visitors', {
      lastSeen: { $gte: weekAgo },
    } as never);

    // 当前在线用户数：lastSeen >= now-5min，与 getOnlineStatus 的判定一致
    // 单独 try/catch，失败时降级为 0，不影响其他统计指标
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    let onlineNow = 0;
    try {
      onlineNow = await adminDB.countDocuments('visitors', {
        lastSeen: { $gte: fiveMinutesAgo },
      } as never);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 当前在线用户数统计失败，使用 0: ${errorMsg}`);
      onlineNow = 0;
    }

    const totalWorkspaces = await adminDB.countDocuments('workspaces');
    const activeTodayWorkspaces = await adminDB.countDocuments('workspaces', {
      updatedAt: { $gte: today },
    } as never);
    const publicWorkspaces = await adminDB.countDocuments('workspaces', {
      type: 'public',
    } as never);

    let totalNodes = 0;
    try {
      totalNodes = await adminDB.countDocuments('nodes');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 节点总数统计失败，使用 0: ${errorMsg}`);
      totalNodes = 0;
    }
    const totalConversations = await adminDB.countDocuments('conversations');
    const todayConversations = await adminDB.countDocuments('conversations', {
      createdAt: { $gte: today },
    } as never);

    let totalMessages = 0;
    let todayMessages = 0;
    let aiInteractions = 0;

    try {
      totalMessages = await adminDB.countDocuments('messages');
      todayMessages = await adminDB.countDocuments('messages', {
        timestamp: { $gte: today },
      } as never);
      aiInteractions = await adminDB.countDocuments('messages', {
        role: 'assistant',
      } as never);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 消息统计查询失败，使用估算值: ${errorMsg}`);
      totalMessages = totalConversations * 2;
      todayMessages = todayConversations * 2;
    }

    return {
      users: {
        total: totalVisitors,
        todayNew: todayNewVisitors,
        todayActive: todayActiveVisitors,
        weekActive: weekActiveVisitors,
        onlineNow,
      },
      workspaces: {
        total: totalWorkspaces,
        activeToday: activeTodayWorkspaces,
        publicCount: publicWorkspaces,
      },
      content: {
        totalNodes,
        totalMessages,
        todayMessages,
        aiInteractions,
      },
    };
  }

  /**
   * 对指定集合按日聚合统计文档数量
   * 使用 MongoDB 聚合管道一次查询获取多天数据，避免逐天 countDocuments
   * @param collection - 集合名称
   * @param startDate - 聚合起始日期
   * @param dateField - 日期字段名，默认为 createdAt
   * @returns 按日期字符串索引的计数值对象
   */
  private async aggregateByDay(
    collection: string,
    startDate: Date,
    dateField: string = 'createdAt'
  ): Promise<Record<string, number>> {
    try {
      const pipeline: Document[] = [
        {
          $match: {
            [dateField]: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { _id: 1 },
        },
      ];

      const results = await adminDB.aggregate<AggregationDayResult>(collection, pipeline);

      const map: Record<string, number> = {};
      for (const result of results) {
        map[result._id] = result.count;
      }
      return map;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 按日聚合 "${collection}" 查询失败，返回空映射: ${errorMsg}`);
      return {};
    }
  }

  /**
   * 生成指定天数内的日期字符串数组
   * @param days - 天数
   * @returns 日期字符串数组，从最早到最近排列
   */
  private generateDateRange(days: number): string[] {
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dates.push(date.toISOString().split('T')[0]);
    }
    return dates;
  }

  /**
   * 获取趋势数据
   * 使用 MongoDB 聚合管道一次性查询4个集合的按日统计数据，
   * 替代原有的逐天 countDocuments 方案，将30次查询优化为4次聚合查询。
   * messages 集合使用 timestamp 字段进行聚合。
   * 缓存策略：优先使用 Redis（TTL 1分钟），Redis 不可用时降级为内存 Map 缓存。
   * @param days - 统计天数，默认30天
   * @returns TrendData 包含4个集合的按日趋势数据
   */
  async getTrends(days: number = 30): Promise<TrendData> {
    const cacheKey = `${DashboardService.CACHE_KEY_TRENDS}_${days}`;

    const cached = await this.getCache(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const dates = this.generateDateRange(days);

    const [visitorsMap, workspacesMap, conversationsMap, messagesMap] = await Promise.all([
      this.aggregateByDay('visitors', startDate),
      this.aggregateByDay('workspaces', startDate),
      this.aggregateByDay('conversations', startDate),
      this.aggregateByDay('messages', startDate, 'timestamp'),
    ]);

    const trendData: TrendData = {
      dates,
      visitors: dates.map((date) => visitorsMap[date] || 0),
      workspaces: dates.map((date) => workspacesMap[date] || 0),
      conversations: dates.map((date) => conversationsMap[date] || 0),
      messages: dates.map((date) => messagesMap[date] || 0),
    };

    await this.setCache(cacheKey, trendData);

    return trendData;
  }

  /**
   * 获取留存趋势数据
   * 通过聚合 conversations 集合的 createdBy 字段按日统计活跃用户，
   * 计算 DAU/WAU/MAU 及次日/7日/30日留存率。
   * DAU = 当日有对话消息的独立用户数
   * WAU = 7日内有对话的独立用户数
   * MAU = 30日内有对话的独立用户数
   * 留存率 = 某日活跃用户在后续指定日期仍活跃的占比
   * @param days - 统计天数，默认30天
   * @returns RetentionTrendData 留存趋势数据
   */
  async getRetentionTrends(days: number = 30): Promise<RetentionTrendData> {
    const extendedDays = days + 30;
    const extendedStartDate = new Date();
    extendedStartDate.setDate(extendedStartDate.getDate() - extendedDays + 1);
    extendedStartDate.setHours(0, 0, 0, 0);

    const dates = this.generateDateRange(days);

    let dayUserMap: Map<string, Set<string>> = new Map();
    try {
      const pipeline: Document[] = [
        {
          $match: {
            createdAt: { $gte: extendedStartDate },
            createdBy: { $ne: null, $exists: true },
          },
        },
        {
          $project: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            createdBy: 1,
          },
        },
        {
          $group: {
            _id: { date: '$date', userId: '$createdBy' },
          },
        },
        {
          $group: {
            _id: '$_id.date',
            userIds: { $addToSet: '$_id.userId' },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const results = await adminDB.aggregate<AggregationDayUsersResult>('conversations', pipeline);
      for (const result of results) {
        dayUserMap.set(result._id, new Set(result.userIds));
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 留存趋势查询失败: ${errorMsg}`);
    }

    const dau: number[] = [];
    const wau: number[] = [];
    const mau: number[] = [];
    const nextDayRetention: number[] = [];
    const day7Retention: number[] = [];
    const day30Retention: number[] = [];

    for (let i = 0; i < dates.length; i++) {
      const currentDate = dates[i];

      const currentDayUsers = dayUserMap.get(currentDate) || new Set<string>();
      dau.push(currentDayUsers.size);

      const wauSet = new Set<string>();
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        const dayUsers = dayUserMap.get(dates[j]);
        if (dayUsers) {
          for (const uid of dayUsers) {
            wauSet.add(uid);
          }
        }
      }
      wau.push(wauSet.size);

      const mauSet = new Set<string>();
      for (let j = Math.max(0, i - 29); j <= i; j++) {
        const dayUsers = dayUserMap.get(dates[j]);
        if (dayUsers) {
          for (const uid of dayUsers) {
            mauSet.add(uid);
          }
        }
      }
      mau.push(mauSet.size);

      if (currentDayUsers.size === 0) {
        nextDayRetention.push(0);
        day7Retention.push(0);
        day30Retention.push(0);
        continue;
      }

      const nextDayDate = this.getDateOffset(currentDate, 1);
      const nextDayUsers = dayUserMap.get(nextDayDate) || new Set<string>();
      if (nextDayUsers.size === 0) {
        nextDayRetention.push(0);
      } else {
        let retained = 0;
        for (const uid of currentDayUsers) {
          if (nextDayUsers.has(uid)) retained++;
        }
        nextDayRetention.push(Math.round((retained / currentDayUsers.size) * 10000) / 100);
      }

      const day7Date = this.getDateOffset(currentDate, 7);
      const day7Users = dayUserMap.get(day7Date) || new Set<string>();
      if (day7Users.size === 0) {
        day7Retention.push(0);
      } else {
        let retained7 = 0;
        for (const uid of currentDayUsers) {
          if (day7Users.has(uid)) retained7++;
        }
        day7Retention.push(Math.round((retained7 / currentDayUsers.size) * 10000) / 100);
      }

      const day30Date = this.getDateOffset(currentDate, 30);
      const day30Users = dayUserMap.get(day30Date) || new Set<string>();
      if (day30Users.size === 0) {
        day30Retention.push(0);
      } else {
        let retained30 = 0;
        for (const uid of currentDayUsers) {
          if (day30Users.has(uid)) retained30++;
        }
        day30Retention.push(Math.round((retained30 / currentDayUsers.size) * 10000) / 100);
      }
    }

    return {
      dates,
      dau,
      wau,
      mau,
      nextDayRetention,
      day7Retention,
      day30Retention,
    };
  }

  /**
   * 计算指定日期偏移后的日期字符串
   * @param dateStr - 基准日期字符串，格式 YYYY-MM-DD
   * @param offset - 偏移天数，正数为未来，负数为过去
   * @returns 偏移后的日期字符串
   */
  private getDateOffset(dateStr: string, offset: number): string {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + offset);
    return date.toISOString().split('T')[0];
  }

  /**
   * 获取转化漏斗数据
   * 步骤为：注册用户数 → 首次对话用户数 → 首次结论用户数 → 首次导出用户数
   * 注册用户数：visitors 集合总文档数
   * 首次对话用户数：conversations 集合中 distinct createdBy 的数量
   * 首次结论用户数：nodes 集合中 type='conclusion' 的 distinct createdBy 数量
   * 首次导出用户数：export_tasks 集合中 distinct createdByIp 的数量
   * 转化率 = 各步骤用户数 / 注册用户数 * 100
   * @returns ConversionFunnelData 转化漏斗数据
   */
  async getConversionFunnel(): Promise<ConversionFunnelData> {
    const registeredCount = await adminDB.countDocuments('visitors');

    let conversationUserCount = 0;
    try {
      const convPipeline: Document[] = [
        { $match: { createdBy: { $ne: null, $exists: true } } },
        { $group: { _id: '$createdBy' } },
        { $count: 'count' },
      ];
      const convResult = await adminDB.aggregate<DistinctCountResult>('conversations', convPipeline);
      conversationUserCount = convResult.length > 0 ? convResult[0].count : 0;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 首次对话用户数统计失败，使用 0: ${errorMsg}`);
      conversationUserCount = 0;
    }

    let conclusionUserCount = 0;
    try {
      const nodePipeline: Document[] = [
        { $match: { type: 'conclusion', createdBy: { $ne: null, $exists: true } } },
        { $group: { _id: '$createdBy' } },
        { $count: 'count' },
      ];
      const nodeResult = await adminDB.aggregate<DistinctCountResult>('nodes', nodePipeline);
      conclusionUserCount = nodeResult.length > 0 ? nodeResult[0].count : 0;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 首次结论用户数统计失败，使用 0: ${errorMsg}`);
      conclusionUserCount = 0;
    }

    let exportUserCount = 0;
    try {
      const exportPipeline: Document[] = [
        { $match: { createdByIp: { $ne: null, $exists: true } } },
        { $group: { _id: '$createdByIp' } },
        { $count: 'count' },
      ];
      const exportResult = await adminDB.aggregate<DistinctCountResult>('export_tasks', exportPipeline);
      exportUserCount = exportResult.length > 0 ? exportResult[0].count : 0;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 首次导出用户数统计失败，使用 0: ${errorMsg}`);
      exportUserCount = 0;
    }

    const baseCount = registeredCount || 1;

    const steps = [
      {
        name: '注册用户',
        count: registeredCount,
        rate: Math.round((registeredCount / baseCount) * 10000) / 100,
      },
      {
        name: '首次对话',
        count: conversationUserCount,
        rate: Math.round((conversationUserCount / baseCount) * 10000) / 100,
      },
      {
        name: '首次结论',
        count: conclusionUserCount,
        rate: Math.round((conclusionUserCount / baseCount) * 10000) / 100,
      },
      {
        name: '首次导出',
        count: exportUserCount,
        rate: Math.round((exportUserCount / baseCount) * 10000) / 100,
      },
    ];

    return { steps };
  }

  /**
   * 获取用户行为事件概览数据
   * 统计事件总量、今日事件数及独立访客数
   * 独立访客按 visitorId 去重统计，visitorId 为空时不计入
   * @returns EventOverviewData 事件概览数据
   */
  async getEventOverview(): Promise<EventOverviewData> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const total = await adminDB.countDocuments('events');
    const todayCount = await adminDB.countDocuments('events', {
      timestamp: { $gte: today },
    } as never);

    let uniqueVisitors = 0;
    try {
      const pipeline: Document[] = [
        { $match: { visitorId: { $ne: null, $exists: true } } },
        { $group: { _id: '$visitorId' } },
        { $count: 'count' },
      ];
      const result = await adminDB.aggregate<DistinctCountResult>('events', pipeline);
      uniqueVisitors = result.length > 0 ? result[0].count : 0;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 独立访客统计失败: ${errorMsg}`);
    }

    return {
      total,
      today: todayCount,
      uniqueVisitors,
    };
  }

  /**
   * 获取用户行为事件趋势数据
   * 按日期聚合事件数量，支持按事件类型筛选
   * @param days - 统计天数，默认7天
   * @param eventType - 事件类型筛选，为空时统计全部事件
   * @returns EventTrendData 事件趋势数据
   */
  async getEventTrend(days: number = 7, eventType?: string): Promise<EventTrendData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const dates = this.generateDateRange(days);

    const match: Record<string, unknown> = {
      timestamp: { $gte: startDate },
    };
    if (eventType && eventType.trim().length > 0) {
      match.eventType = eventType.trim();
    }

    let eventMap: Record<string, number> = {};
    try {
      const pipeline: Document[] = [
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ];
      const results = await adminDB.aggregate<EventAggregationDayResult>('events', pipeline);
      eventMap = {};
      for (const result of results) {
        eventMap[result._id] = result.count;
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 事件趋势查询失败: ${errorMsg}`);
    }

    return {
      dates,
      values: dates.map((date) => eventMap[date] || 0),
    };
  }

  /**
   * 获取关键事件漏斗数据
   * 漏斗步骤：注册（page_view）→ 完成引导（node_created）→ 创建地图（map_created）→ 创建分支（branch_created）→ 生成摘要（summary_generated）
   * 每一步统计触发过该事件类型的独立访客数（按 visitorId 去重）
   * 转化率 = 各步骤用户数 / 第一步用户数 * 100
   * @returns EventFunnelData 事件漏斗数据
   */
  async getEventFunnel(): Promise<EventFunnelData> {
    const funnelSteps: Array<{ name: string; eventType: string }> = [
      { name: '注册', eventType: 'page_view' },
      { name: '完成引导', eventType: 'node_created' },
      { name: '创建地图', eventType: 'map_created' },
      { name: '创建分支', eventType: 'branch_created' },
      { name: '生成摘要', eventType: 'summary_generated' },
    ];

    const counts: number[] = [];
    for (const step of funnelSteps) {
      let count = 0;
      try {
        const pipeline: Document[] = [
          {
            $match: {
              eventType: step.eventType,
              visitorId: { $ne: null, $exists: true },
            },
          },
          { $group: { _id: '$visitorId' } },
          { $count: 'count' },
        ];
        const result = await adminDB.aggregate<DistinctCountResult>('events', pipeline);
        count = result.length > 0 ? result[0].count : 0;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ 漏斗步骤 "${step.name}" 统计失败: ${errorMsg}`);
      }
      counts.push(count);
    }

    const baseCount = counts[0] || 1;
    const steps = funnelSteps.map((step, index) => ({
      name: step.name,
      count: counts[index],
      rate: Math.round((counts[index] / baseCount) * 10000) / 100,
    }));

    return { steps };
  }

  /**
   * 获取最近事件列表
   * 按事件发生时间倒序排列，返回指定数量的事件
   * @param limit - 返回数量，默认20条
   * @returns RecentEventItem[] 最近事件列表
   */
  async getRecentEvents(limit: number = 20): Promise<RecentEventItem[]> {
    /**
     * 事件集合原始文档接口
     * 用于最近事件查询，timestamp 为 Date 类型
     */
    interface RawRecentEvent {
      eventType: string;
      visitorId?: string;
      workspaceId?: string;
      nodeId?: string;
      mapId?: string;
      payload?: Record<string, unknown>;
      url?: string;
      userAgent?: string;
      timestamp: Date;
    }

    try {
      const events = await adminDB.find<RawRecentEvent>('events', {}, {
        sort: { timestamp: -1 },
        limit,
      } as never);

      return events.map((event) => ({
        eventType: event.eventType,
        visitorId: event.visitorId,
        workspaceId: event.workspaceId,
        nodeId: event.nodeId,
        mapId: event.mapId,
        payload: event.payload,
        url: event.url,
        userAgent: event.userAgent,
        timestamp: event.timestamp instanceof Date ? event.timestamp.toISOString() : String(event.timestamp),
      }));
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 最近事件查询失败: ${errorMsg}`);
      return [];
    }
  }

  /**
   * 功能采用矩阵事件类型到展示名称的映射
   * 与前端展示保持一致，定义需要统计的功能列表
   */
  private static readonly FEATURE_EVENT_MAPPINGS: FeatureEventMapping[] = [
    { eventType: 'extension_direction_click', displayName: '延伸方向' },
    { eventType: 'branch_created', displayName: '分支创建' },
    { eventType: 'summary_generated', displayName: '节点摘要' },
    { eventType: 'map_created', displayName: '地图创建' },
  ];

  /**
   * 获取功能采用矩阵数据
   * 对每个功能统计最近 N 天内触发过该事件的独立 visitorId 数量，
   * 采用率 = 该数 / 总独立访客数 * 100
   * 总独立访客数：events 集合中最近 N 天有活动的独立 visitorId 数
   * @param days - 统计天数，默认7天，范围 1-90
   * @returns FeatureAdoptionData 功能采用矩阵数据
   */
  async getFeatureAdoptionMatrix(days: number = 7): Promise<FeatureAdoptionData> {
    // 计算 N 天前的起始时间（含今日）
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // 1. 统计最近 N 天的总独立访客数
    let totalUsers = 0;
    try {
      const totalPipeline: Document[] = [
        {
          $match: {
            timestamp: { $gte: startDate },
            visitorId: { $ne: null, $exists: true },
          },
        },
        { $group: { _id: '$visitorId' } },
        { $count: 'count' },
      ];
      const totalResult = await adminDB.aggregate<DistinctCountResult>('events', totalPipeline);
      totalUsers = totalResult.length > 0 ? totalResult[0].count : 0;
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 功能采用矩阵总访客数统计失败: ${errorMsg}`);
    }

    // 2. 对每个功能统计独立访客数
    const features: FeatureAdoptionItem[] = [];
    const baseCount = totalUsers || 1; // 避免除零
    for (const mapping of DashboardService.FEATURE_EVENT_MAPPINGS) {
      let uniqueUsers = 0;
      try {
        const featurePipeline: Document[] = [
          {
            $match: {
              eventType: mapping.eventType,
              timestamp: { $gte: startDate },
              visitorId: { $ne: null, $exists: true },
            },
          },
          { $group: { _id: '$visitorId' } },
          { $count: 'count' },
        ];
        const featureResult = await adminDB.aggregate<DistinctCountResult>('events', featurePipeline);
        uniqueUsers = featureResult.length > 0 ? featureResult[0].count : 0;
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ 功能 "${mapping.displayName}" 统计失败: ${errorMsg}`);
      }

      features.push({
        name: mapping.displayName,
        eventType: mapping.eventType,
        uniqueUsers,
        // 保留两位小数
        adoptionRate: Math.round((uniqueUsers / baseCount) * 10000) / 100,
      });
    }

    return {
      features,
      totalUsers,
    };
  }

  /**
   * 获取实时在线状态数据
   * 当前在线用户数：visitors 集合中 lastSeen >= (now - 5分钟) 的文档数
   * 30 分钟活跃曲线：按分钟聚合 events 集合最近 30 分钟的独立 visitorId 数
   * （每分钟一个点，共 30 个点，时间格式 HH:mm）
   * 注意：聚合管道使用与服务器本地时区一致的偏移量，
   * 以保证返回的时间标签与前端展示的本地时间一致。
   * @returns OnlineStatusData 实时在线状态数据
   */
  async getOnlineStatus(): Promise<OnlineStatusData> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    // 1. 统计当前在线用户数
    let onlineNow = 0;
    try {
      onlineNow = await adminDB.countDocuments('visitors', {
        lastSeen: { $gte: fiveMinutesAgo },
      } as never);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 当前在线用户数统计失败: ${errorMsg}`);
    }

    // 2. 按分钟聚合最近 30 分钟的独立访客数
    // 使用聚合管道按 %H:%M 分组，分组键为分钟字符串
    // 通过 timezone 参数将 UTC 时间转换为服务器本地时间，确保与下方 JS 时间键匹配
    const timezoneOffsetMinutes = -now.getTimezoneOffset(); // UTC+8 返回 480
    const timezoneSign = timezoneOffsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(timezoneOffsetMinutes);
    const timezoneHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const timezoneMinutes = String(absOffset % 60).padStart(2, '0');
    const timezoneStr = `${timezoneSign}${timezoneHours}:${timezoneMinutes}`;

    let minuteMap: Map<string, number> = new Map();
    try {
      const minutePipeline: Document[] = [
        {
          $match: {
            timestamp: { $gte: thirtyMinutesAgo },
            visitorId: { $ne: null, $exists: true },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%H:%M', date: '$timestamp', timezone: timezoneStr },
            },
            uniqueVisitors: { $addToSet: '$visitorId' },
          },
        },
        { $sort: { _id: 1 } },
      ];
      const minuteResults = await adminDB.aggregate<MinuteAggregationResult>('events', minutePipeline);
      minuteMap = new Map<string, number>();
      for (const result of minuteResults) {
        minuteMap.set(result._id, result.uniqueVisitors.length);
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ 30 分钟活跃曲线查询失败: ${errorMsg}`);
    }

    // 3. 生成完整 30 分钟时间序列，对缺失的分钟补 0
    // 时间序列从 (now-30min) 到 (now-1min)，共 30 个点，覆盖完整 30 分钟跨度
    // 使用本地时区时间作为 timeKey，与聚合管道的 timezone 参数保持一致
    const recentActiveCurve: OnlineCurvePoint[] = [];
    for (let i = 30; i >= 1; i--) {
      const pointTime = new Date(now.getTime() - i * 60 * 1000);
      const hours = String(pointTime.getHours()).padStart(2, '0');
      const minutes = String(pointTime.getMinutes()).padStart(2, '0');
      const timeKey = `${hours}:${minutes}`;
      recentActiveCurve.push({
        time: timeKey,
        activeUsers: minuteMap.get(timeKey) || 0,
      });
    }

    return {
      onlineNow,
      recentActiveCurve,
    };
  }
}

export const dashboardService = new DashboardService();
