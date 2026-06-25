import { Document } from 'mongodb';
import { adminDB } from '../config/database';
import { AuditLog } from '../types';

/**
 * 审计日志列表项接口
 * 用于返回给前端的审计日志数据
 */
export interface AuditLogListItem {
  _id: string;
  timestamp: string;
  adminNickname: string;
  adminIp: string;
  action: string;
  targetType: string;
  targetId?: string;
  details: Record<string, unknown>;
  result: 'success' | 'failed';
  errorMessage?: string;
}

/**
 * 审计日志统计数据接口
 * 包含总数、今日操作数、成功/失败数、操作类型分布、每日趋势
 */
export interface AuditLogStats {
  totalCount: number;
  todayCount: number;
  successCount: number;
  failedCount: number;
  actionDistribution: { action: string; count: number }[];
  dailyTrend: { date: string; count: number }[];
}

/**
 * 审计日志查询筛选参数接口
 */
export interface AuditLogFilter {
  action?: string;
  adminNickname?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * 审计日志服务
 * 提供审计日志的查询、筛选、统计、导出功能
 * 使用 adminDB 单例查询 audit_logs 集合
 */
class AuditLogService {
  /**
   * 查询审计日志列表（分页+筛选）
   * 支持按操作类型、管理员昵称、时间范围筛选
   * @param filter - 筛选条件对象
   * @param page - 页码，从1开始
   * @param limit - 每页数量，最大100
   * @returns 分页结果，包含日志列表、总数、页码信息
   */
  async getLogs(
    filter: AuditLogFilter,
    page: number,
    limit: number
  ): Promise<{
    items: AuditLogListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const query = this.buildFilter(filter);
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const skip = (safePage - 1) * safeLimit;

    const logs = await adminDB.find('audit_logs', query as never, {
      sort: { timestamp: -1 },
      skip,
      limit: safeLimit,
    });

    const total = await adminDB.countDocuments('audit_logs', query as never);
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    const items: AuditLogListItem[] = logs.map((item: Record<string, unknown>) => ({
      _id: (item._id as { toString(): string }).toString(),
      timestamp: new Date(item.timestamp as Date).toISOString(),
      adminNickname: item.adminNickname as string,
      adminIp: item.adminIp as string,
      action: item.action as string,
      targetType: item.targetType as string,
      targetId: item.targetId as string | undefined,
      details: item.details as Record<string, unknown>,
      result: item.result as 'success' | 'failed',
      errorMessage: item.errorMessage as string | undefined,
    }));

    return { items, total, page: safePage, limit: safeLimit, totalPages };
  }

  /**
   * 获取审计日志统计数据
   * 包括总数、今日操作数、成功/失败数、操作类型分布、近30天每日趋势
   * @returns AuditLogStats 统计数据
   */
  async getStats(): Promise<AuditLogStats> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const totalCount = await adminDB.countDocuments('audit_logs');

    const todayCount = await adminDB.countDocuments('audit_logs', {
      timestamp: { $gte: today },
    } as never);

    const successCount = await adminDB.countDocuments('audit_logs', {
      result: 'success',
    } as never);

    const failedCount = await adminDB.countDocuments('audit_logs', {
      result: 'failed',
    } as never);

    const actionPipeline: Document[] = [
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ];

    const actionResults = await adminDB.aggregate<{ _id: string; count: number }>(
      'audit_logs',
      actionPipeline
    );

    const actionDistribution = actionResults.map((item) => ({
      action: item._id,
      count: item.count,
    }));

    const dailyTrendPipeline: Document[] = [
      {
        $match: {
          timestamp: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const dailyResults = await adminDB.aggregate<{ _id: string; count: number }>(
      'audit_logs',
      dailyTrendPipeline
    );

    const dailyTrend = dailyResults.map((item) => ({
      date: item._id,
      count: item.count,
    }));

    return {
      totalCount,
      todayCount,
      successCount,
      failedCount,
      actionDistribution,
      dailyTrend,
    };
  }

  /**
   * 导出审计日志为CSV格式数据
   * 根据筛选条件查询日志并转换为CSV字符串
   * @param filter - 筛选条件对象
   * @returns CSV格式的审计日志数据数组，每项为中文键名的平铺对象
   */
  async exportCSV(filter: AuditLogFilter): Promise<Record<string, string>[]> {
    const query = this.buildFilter(filter);

    const logs = await adminDB.find<AuditLog>('audit_logs', query as never, {
      sort: { timestamp: -1 },
      limit: 10000,
    });

    return logs.map((item) => ({
      时间: new Date(item.timestamp).toISOString(),
      管理员: item.adminNickname,
      管理员IP: item.adminIp,
      操作: item.action,
      目标类型: item.targetType,
      目标ID: item.targetId || '',
      结果: item.result === 'success' ? '成功' : '失败',
      错误信息: item.errorMessage || '',
    }));
  }

  /**
   * 构建MongoDB查询筛选条件
   * 根据操作类型、管理员昵称、时间范围生成查询对象
   * @param filter - 筛选参数对象
   * @returns MongoDB查询条件对象
   */
  private buildFilter(filter: AuditLogFilter): Record<string, unknown> {
    const query: Record<string, unknown> = {};

    if (filter.action && filter.action.trim()) {
      query.action = filter.action.trim();
    }

    if (filter.adminNickname && filter.adminNickname.trim()) {
      query.adminNickname = { $regex: filter.adminNickname.trim(), $options: 'i' };
    }

    if (filter.startDate || filter.endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.startDate) {
        dateFilter.$gte = new Date(filter.startDate);
      }
      if (filter.endDate) {
        dateFilter.$lte = new Date(filter.endDate);
      }
      query.timestamp = dateFilter;
    }

    return query;
  }
}

export const auditLogService = new AuditLogService();
