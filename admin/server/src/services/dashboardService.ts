import { adminDB } from '../config/database';
import { DashboardStats } from '../types';

/**
 * 数据大盘服务
 * 提供系统运营数据的统计与查询
 */
class DashboardService {
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

    const totalNodes = await adminDB.countDocuments('nodes');
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
   * 获取趋势数据
   * @param type - 趋势类型（user_growth/active_hours/workspace_activity/message_volume）
   * @param days - 统计天数
   * @returns 日期和对应值的数组
   */
  async getTrends(type: string, days: number): Promise<{ dates: string[]; values: number[] }> {
    const dates: string[] = [];
    const values: number[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      dates.push(date.toISOString().split('T')[0]);

      let count = 0;
      switch (type) {
        case 'user_growth': {
          count = await adminDB.countDocuments('visitors', {
            createdAt: { $gte: date, $lt: nextDate },
          } as never);
          break;
        }
        case 'active_users': {
          count = await adminDB.countDocuments('visitors', {
            lastSeen: { $gte: date, $lt: nextDate },
          } as never);
          break;
        }
        case 'workspace_activity': {
          count = await adminDB.countDocuments('workspaces', {
            updatedAt: { $gte: date, $lt: nextDate },
          } as never);
          break;
        }
        case 'message_volume': {
          count = await adminDB.countDocuments('conversations', {
            createdAt: { $gte: date, $lt: nextDate },
          } as never);
          break;
        }
        default:
          count = 0;
      }

      values.push(count);
    }

    return { dates, values };
  }
}

export const dashboardService = new DashboardService();
