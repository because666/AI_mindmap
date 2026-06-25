import { Collection, Document } from 'mongodb';
import axios from 'axios';
import { Parser } from 'json2csv';
import { adminDB } from '../config/database';

/**
 * AI用量汇总统计接口
 */
export interface AIUsageStats {
  totalTokens: number;
  totalCalls: number;
  avgResponseTime: number;
  successRate: number;
  todayTokens: number;
  todayCalls: number;
  changes: {
    totalTokens: number;
    totalCalls: number;
    avgResponseTime: number;
    successRate: number;
  };
}

/**
 * AI用量趋势数据接口
 */
export interface AIUsageTrend {
  date: string;
  tokens: number;
  calls: number;
  avgResponseTime: number;
}

/**
 * 模型分布数据接口
 */
export interface ModelDistribution {
  model: string;
  count: number;
  tokens: number;
  percentage: number;
}

/**
 * 队列状态接口
 */
export interface QueueStatus {
  activeCount: number;
  maxConcurrency: number;
  p0QueueLength: number;
  p1QueueLength: number;
}

/**
 * AI用量记录文档接口
 */
interface AIUsageDocument extends Document {
  visitorId: string;
  workspaceId: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  responseTimeMs: number;
  isSuccess: boolean;
  errorMessage?: string;
  createdAt: Date;
}

/**
 * 汇总聚合结果接口
 */
interface StatsAggregationResult {
  _id: null;
  totalTokens: number;
  totalCalls: number;
  avgResponseTime: number;
  successCount: number;
}

/**
 * 趋势聚合结果接口
 */
interface TrendAggregationResult {
  _id: string;
  tokens: number;
  calls: number;
  avgResponseTime: number;
}

/**
 * 模型分布聚合结果接口
 */
interface ModelDistAggregationResult {
  _id: string;
  count: number;
  tokens: number;
}

/**
 * AI用量统计服务
 * 提供AI调用的汇总统计、趋势分析、模型分布、队列状态查询及数据导出功能
 */
class AIUsageService {
  /**
   * 获取ai_usage集合实例
   * @returns MongoDB Collection 实例，数据库未连接时返回null
   */
  private getCollection(): Collection<AIUsageDocument> | null {
    return adminDB.getCollection<AIUsageDocument>('ai_usage');
  }

  /**
   * 构建时间范围与模型的MongoDB筛选条件
   * @param startDate - 起始日期字符串（可选）
   * @param endDate - 结束日期字符串（可选）
   * @param model - AI模型名称（可选）
   * @returns MongoDB筛选条件对象
   */
  private buildMatchFilter(startDate?: string, endDate?: string, model?: string): Document {
    const filter: Document = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    if (model) {
      filter.model = model;
    }
    return filter;
  }

  /**
   * 获取汇总统计数据
   * 使用MongoDB聚合管道计算总Token数、调用次数、平均响应时间、成功率，
   * 并额外查询今日的Token数和调用次数
   * @param startDate - 起始日期字符串（可选）
   * @param endDate - 结束日期字符串（可选）
   * @param model - AI模型名称（可选）
   * @returns AIUsageStats 汇总统计数据，集合为空时返回零值
   */
  async getStats(startDate?: string, endDate?: string, model?: string): Promise<AIUsageStats> {
    const collection = this.getCollection();
    const defaultChanges = { totalTokens: 0, totalCalls: 0, avgResponseTime: 0, successRate: 0 };
    if (!collection) {
      return {
        totalTokens: 0,
        totalCalls: 0,
        avgResponseTime: 0,
        successRate: 0,
        todayTokens: 0,
        todayCalls: 0,
        changes: defaultChanges,
      };
    }

    const matchFilter = this.buildMatchFilter(startDate, endDate, model);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    try {
      const pipeline: Document[] = [
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$totalTokens' },
            totalCalls: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTimeMs' },
            successCount: { $sum: { $cond: ['$isSuccess', 1, 0] } },
          },
        },
      ];

      const results = await collection.aggregate<StatsAggregationResult>(pipeline).toArray();

      const todayPipeline: Document[] = [
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: null,
            todayTokens: { $sum: '$totalTokens' },
            todayCalls: { $sum: 1 },
          },
        },
      ];

      const todayResults = await collection.aggregate<{ _id: null; todayTokens: number; todayCalls: number }>(todayPipeline).toArray();

      const yesterdayPipeline: Document[] = [
        { $match: { createdAt: { $gte: yesterday, $lt: today } } },
        {
          $group: {
            _id: null,
            totalTokens: { $sum: '$totalTokens' },
            totalCalls: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTimeMs' },
            successCount: { $sum: { $cond: ['$isSuccess', 1, 0] } },
          },
        },
      ];

      const yesterdayResults = await collection.aggregate<StatsAggregationResult>(yesterdayPipeline).toArray();

      const todayTokens = todayResults.length > 0 ? todayResults[0].todayTokens : 0;
      const todayCalls = todayResults.length > 0 ? todayResults[0].todayCalls : 0;

      if (results.length === 0) {
        return {
          totalTokens: 0,
          totalCalls: 0,
          avgResponseTime: 0,
          successRate: 0,
          todayTokens,
          todayCalls,
          changes: defaultChanges,
        };
      }

      const stat = results[0];
      const currentTotalTokens = stat.totalTokens || 0;
      const currentTotalCalls = stat.totalCalls || 0;
      const currentAvgResponseTime = Math.round(stat.avgResponseTime || 0);
      const currentSuccessRate = stat.totalCalls > 0 ? Math.round((stat.successCount / stat.totalCalls) * 10000) / 100 : 0;

      const changes = this.computeChanges(yesterdayResults, {
        totalTokens: currentTotalTokens,
        totalCalls: currentTotalCalls,
        avgResponseTime: currentAvgResponseTime,
        successRate: currentSuccessRate,
      });

      return {
        totalTokens: currentTotalTokens,
        totalCalls: currentTotalCalls,
        avgResponseTime: currentAvgResponseTime,
        successRate: currentSuccessRate,
        todayTokens,
        todayCalls,
        changes,
      };
    } catch (error) {
      console.error('获取AI用量统计失败:', error);
      return {
        totalTokens: 0,
        totalCalls: 0,
        avgResponseTime: 0,
        successRate: 0,
        todayTokens: 0,
        todayCalls: 0,
        changes: defaultChanges,
      };
    }
  }

  /**
   * 计算当前周期与昨日数据的百分比变化
   * @param yesterdayResults - 昨日聚合结果
   * @param current - 当前周期数据
   * @returns 各指标的百分比变化值
   */
  private computeChanges(
    yesterdayResults: StatsAggregationResult[],
    current: { totalTokens: number; totalCalls: number; avgResponseTime: number; successRate: number }
  ): { totalTokens: number; totalCalls: number; avgResponseTime: number; successRate: number } {
    if (yesterdayResults.length === 0) {
      return { totalTokens: 0, totalCalls: 0, avgResponseTime: 0, successRate: 0 };
    }

    const y = yesterdayResults[0];
    const yTokens = y.totalTokens || 0;
    const yCalls = y.totalCalls || 0;
    const yAvgTime = Math.round(y.avgResponseTime || 0);
    const ySuccessRate = y.totalCalls > 0 ? Math.round((y.successCount / y.totalCalls) * 10000) / 100 : 0;

    return {
      totalTokens: yTokens > 0 ? Math.round(((current.totalTokens - yTokens) / yTokens) * 10000) / 100 : 0,
      totalCalls: yCalls > 0 ? Math.round(((current.totalCalls - yCalls) / yCalls) * 10000) / 100 : 0,
      avgResponseTime: yAvgTime > 0 ? Math.round(((current.avgResponseTime - yAvgTime) / yAvgTime) * 10000) / 100 : 0,
      successRate: ySuccessRate > 0 ? Math.round(((current.successRate - ySuccessRate) / ySuccessRate) * 10000) / 100 : 0,
    };
  }

  /**
   * 获取趋势数据
   * 使用MongoDB聚合管道按指定粒度（日/周/月）分组统计Token数、调用次数、平均响应时间，
   * 并填充缺失日期的零值数据
   * @param startDate - 起始日期字符串
   * @param endDate - 结束日期字符串
   * @param granularity - 聚合粒度：day（按日）、week（按周）、month（按月）
   * @param model - AI模型名称（可选）
   * @returns AIUsageTrend[] 趋势数据数组
   */
  async getTrends(
    startDate: string,
    endDate: string,
    granularity: 'day' | 'week' | 'month',
    model?: string
  ): Promise<AIUsageTrend[]> {
    const collection = this.getCollection();
    if (!collection) {
      return [];
    }

    const matchFilter = this.buildMatchFilter(startDate, endDate, model);

    const dateFormatMap: Record<string, string> = {
      day: '%Y-%m-%d',
      week: '%Y-W%V',
      month: '%Y-%m',
    };
    const dateFormat = dateFormatMap[granularity];

    try {
      const pipeline: Document[] = [
        { $match: matchFilter },
        {
          $group: {
            _id: {
              $dateToString: { format: dateFormat, date: '$createdAt' },
            },
            tokens: { $sum: '$totalTokens' },
            calls: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTimeMs' },
          },
        },
        { $sort: { _id: 1 } },
      ];

      const results = await collection.aggregate<TrendAggregationResult>(pipeline).toArray();

      const trendMap = new Map<string, AIUsageTrend>();
      for (const result of results) {
        trendMap.set(result._id, {
          date: result._id,
          tokens: result.tokens || 0,
          calls: result.calls || 0,
          avgResponseTime: Math.round(result.avgResponseTime || 0),
        });
      }

      if (granularity === 'day') {
        return this.fillMissingDays(startDate, endDate, trendMap);
      }

      return Array.from(trendMap.values());
    } catch (error) {
      console.error('获取AI用量趋势失败:', error);
      return [];
    }
  }

  /**
   * 填充缺失日期的零值数据
   * 遍历起始日期到结束日期之间的每一天，对缺失的日期填充零值
   * @param startDate - 起始日期字符串
   * @param endDate - 结束日期字符串
   * @param trendMap - 已有趋势数据的Map
   * @returns 完整的AIUsageTrend数组
   */
  private fillMissingDays(
    startDate: string,
    endDate: string,
    trendMap: Map<string, AIUsageTrend>
  ): AIUsageTrend[] {
    const result: AIUsageTrend[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      const existing = trendMap.get(dateStr);
      result.push(existing || {
        date: dateStr,
        tokens: 0,
        calls: 0,
        avgResponseTime: 0,
      });
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  /**
   * 获取模型分布数据
   * 使用MongoDB聚合管道按模型分组统计调用次数和Token数，
   * 并计算各模型占总调用次数的百分比
   * @param startDate - 起始日期字符串（可选）
   * @param endDate - 结束日期字符串（可选）
   * @returns ModelDistribution[] 模型分布数据数组
   */
  async getModelDistribution(startDate?: string, endDate?: string): Promise<ModelDistribution[]> {
    const collection = this.getCollection();
    if (!collection) {
      return [];
    }

    const matchFilter = this.buildMatchFilter(startDate, endDate);

    try {
      const pipeline: Document[] = [
        { $match: matchFilter },
        {
          $group: {
            _id: '$model',
            count: { $sum: 1 },
            tokens: { $sum: '$totalTokens' },
          },
        },
        { $sort: { count: -1 } },
      ];

      const results = await collection.aggregate<ModelDistAggregationResult>(pipeline).toArray();

      const totalCount = results.reduce((sum, r) => sum + r.count, 0);

      return results.map((r) => ({
        model: r._id,
        count: r.count,
        tokens: r.tokens || 0,
        percentage: totalCount > 0 ? Math.round((r.count / totalCount) * 10000) / 100 : 0,
      }));
    } catch (error) {
      console.error('获取模型分布失败:', error);
      return [];
    }
  }

  /**
   * 获取队列状态
   * 通过axios调用主服务的队列状态API，主服务不可达时返回默认零值
   * @returns QueueStatus 队列状态数据
   */
  async getQueueStatus(): Promise<QueueStatus> {
    const defaultStatus: QueueStatus = {
      activeCount: 0,
      maxConcurrency: 5,
      p0QueueLength: 0,
      p1QueueLength: 0,
    };

    try {
      const response = await axios.get<{ success: boolean; data?: QueueStatus }>(
        'http://127.0.0.1:3001/api/ai/queue/stats',
        { timeout: 3000 }
      );

      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      return defaultStatus;
    } catch (error) {
      console.error('获取队列状态失败:', error);
      return defaultStatus;
    }
  }

  /**
   * 导出CSV数据
   * 查询ai_usage集合中符合条件的数据，使用json2csv转换为CSV字符串
   * @param startDate - 起始日期字符串（可选）
   * @param endDate - 结束日期字符串（可选）
   * @param model - AI模型名称（可选）
   * @returns CSV格式字符串
   */
  async exportCSV(startDate?: string, endDate?: string, model?: string): Promise<string> {
    const collection = this.getCollection();
    if (!collection) {
      return '';
    }

    const matchFilter = this.buildMatchFilter(startDate, endDate, model);

    try {
      const docs = await collection.find(matchFilter).sort({ createdAt: -1 }).toArray();

      if (docs.length === 0) {
        return '';
      }

      const csvData = docs.map((doc) => ({
        visitorId: doc.visitorId,
        workspaceId: doc.workspaceId,
        model: doc.model,
        provider: doc.provider,
        promptTokens: doc.promptTokens,
        completionTokens: doc.completionTokens,
        totalTokens: doc.totalTokens,
        responseTimeMs: doc.responseTimeMs,
        isSuccess: doc.isSuccess,
        errorMessage: doc.errorMessage || '',
        createdAt: doc.createdAt.toISOString(),
      }));

      const parser = new Parser({
        fields: [
          'visitorId',
          'workspaceId',
          'model',
          'provider',
          'promptTokens',
          'completionTokens',
          'totalTokens',
          'responseTimeMs',
          'isSuccess',
          'errorMessage',
          'createdAt',
        ],
      });

      return parser.parse(csvData);
    } catch (error) {
      console.error('导出CSV失败:', error);
      throw new Error('导出CSV数据失败');
    }
  }
}

export const aiUsageService = new AIUsageService();
