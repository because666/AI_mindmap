import { adminDB } from '../config/database';
import { FeedbackStats } from '../types';

/**
 * 反馈管理服务
 * 提供反馈数据的统计与查询功能
 */
class FeedbackService {
  /**
   * 获取反馈统计数据
   * 包括总数、各状态数量、今日新增、类型分布、近30天提交趋势
   * @returns FeedbackStats 反馈统计数据
   */
  async getStats(): Promise<FeedbackStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const statusPipeline = [
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ];

    const statusResults = await adminDB.aggregate<{ _id: string; count: number }>(
      'feedbacks',
      statusPipeline
    );

    const statusMap: Record<string, number> = {};
    for (const item of statusResults) {
      statusMap[item._id] = item.count;
    }

    const totalCount = await adminDB.countDocuments('feedbacks');

    const todayCount = await adminDB.countDocuments('feedbacks', {
      createdAt: { $gte: today },
    } as never);

    const typePipeline = [
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ];

    const typeResults = await adminDB.aggregate<{ _id: string; count: number }>(
      'feedbacks',
      typePipeline
    );

    const typeDistribution = typeResults.map((item) => ({
      type: item._id,
      count: item.count,
    }));

    const dailyTrendPipeline = [
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: '$createdAt',
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ];

    const dailyResults = await adminDB.aggregate<{ _id: string; count: number }>(
      'feedbacks',
      dailyTrendPipeline
    );

    const dailyTrend = dailyResults.map((item) => ({
      date: item._id,
      count: item.count,
    }));

    return {
      totalCount,
      pendingCount: statusMap['pending'] || 0,
      processingCount: statusMap['processing'] || 0,
      resolvedCount: statusMap['resolved'] || 0,
      closedCount: statusMap['closed'] || 0,
      todayCount,
      typeDistribution,
      dailyTrend,
    };
  }
}

export const feedbackService = new FeedbackService();
