import { Document } from 'mongodb';
import { adminDB } from '../config/database';
import { DashboardStats, TrendData } from '../types';

/**
 * 聚合结果条目接口
 * 表示按日聚合后的单条记录
 */
interface AggregationDayResult {
  _id: string;
  count: number;
}

/**
 * 缓存条目接口
 * 包含缓存数据与过期时间戳
 */
interface CacheEntry {
  data: TrendData;
  expireAt: number;
}

/**
 * 数据大盘服务
 * 提供系统运营数据的统计与查询
 */
class DashboardService {
  private cache: Map<string, CacheEntry> = new Map();

  private static readonly CACHE_TTL = 5 * 60 * 1000;

  private static readonly CACHE_KEY = 'dashboard_trends';

  /**
   * 获取核心统计指标
   * 包括用户、工作区、内容三维度数据
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
    } catch {
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
      const messageStats = await adminDB.aggregate('conversations', [
        { $unwind: '$messages' },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            today: {
              $sum: {
                $cond: [{ $gte: ['$messages.timestamp', today] }, 1, 0],
              },
            },
            aiCount: {
              $sum: {
                $cond: [{ $eq: ['$messages.role', 'assistant'] }, 1, 0],
              },
            },
          },
        },
      ]);

      if (messageStats.length > 0) {
        totalMessages = (messageStats[0] as Record<string, number>).total || 0;
        todayMessages = (messageStats[0] as Record<string, number>).today || 0;
        aiInteractions = (messageStats[0] as Record<string, number>).aiCount || 0;
      }
    } catch {
      totalMessages = totalConversations * 2;
      todayMessages = todayConversations * 2;
    }

    return {
      users: {
        total: totalVisitors,
        todayNew: todayNewVisitors,
        todayActive: todayActiveVisitors,
        weekActive: weekActiveVisitors,
        onlineNow: 0,
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
   * @returns 按日期字符串索引的计数值对象
   */
  private async aggregateByDay(
    collection: string,
    startDate: Date
  ): Promise<Record<string, number>> {
    try {
      const pipeline: Document[] = [
        {
          $match: {
            createdAt: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
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
    } catch {
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
   * 结果使用内存缓存，TTL 为5分钟，缓存命中时直接返回。
   * @param days - 统计天数，默认30天
   * @returns TrendData 包含4个集合的按日趋势数据
   */
  async getTrends(days: number = 30): Promise<TrendData> {
    const cacheKey = `${DashboardService.CACHE_KEY}_${days}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expireAt > Date.now()) {
      return cached.data;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const dates = this.generateDateRange(days);

    const [visitorsMap, workspacesMap, conversationsMap, messagesMap] = await Promise.all([
      this.aggregateByDay('visitors', startDate),
      this.aggregateByDay('workspaces', startDate),
      this.aggregateByDay('conversations', startDate),
      this.aggregateByDay('messages', startDate),
    ]);

    const trendData: TrendData = {
      dates,
      visitors: dates.map((date) => visitorsMap[date] || 0),
      workspaces: dates.map((date) => workspacesMap[date] || 0),
      conversations: dates.map((date) => conversationsMap[date] || 0),
      messages: dates.map((date) => messagesMap[date] || 0),
    };

    this.cache.set(cacheKey, {
      data: trendData,
      expireAt: Date.now() + DashboardService.CACHE_TTL,
    });

    return trendData;
  }
}

export const dashboardService = new DashboardService();
