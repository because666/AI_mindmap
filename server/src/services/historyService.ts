import { v4 as uuidv4 } from 'uuid';
import { mongoDBService } from '../data/mongodb/connection';
import { HistoryRecord } from '../types';

/**
 * 历史记录服务类
 * 提供操作历史的记录和查询功能
 */
class HistoryService {
  private memoryHistory: HistoryRecord[] = [];
  private maxHistorySize = 100;

  /**
   * 记录操作
   * @param action - 操作类型
   * @param description - 操作描述
   * @param beforeState - 操作前状态
   * @param afterState - 操作后状态
   * @param workspaceId - 工作区ID
   * @param visitorId - 访客ID
   * @returns 历史记录
   */
  async recordAction(
    action: string,
    description: string,
    beforeState?: Record<string, unknown> | null,
    afterState?: Record<string, unknown> | null,
    workspaceId?: string,
    visitorId?: string
  ): Promise<HistoryRecord> {
    const record: HistoryRecord = {
      id: uuidv4(),
      workspaceId,
      visitorId,
      action,
      description,
      beforeState,
      afterState,
      timestamp: new Date(),
    };

    if (mongoDBService.isConnected()) {
      await mongoDBService.insertOne('history', record);
    }

    this.memoryHistory.push(record);

    if (this.memoryHistory.length > this.maxHistorySize) {
      this.memoryHistory = this.memoryHistory.slice(-this.maxHistorySize);
    }

    return record;
  }

  /**
   * 获取历史记录
   * @param limit - 返回数量
   * @param workspaceId - 工作区ID
   * @returns 历史记录列表
   */
  async getHistory(limit: number = 50, workspaceId?: string): Promise<HistoryRecord[]> {
    let history = [...this.memoryHistory];

    if (workspaceId) {
      history = history.filter(h => h.workspaceId === workspaceId);
    }

    return history
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * 按操作类型获取历史记录
   * @param action - 操作类型
   * @param workspaceId - 工作区ID
   * @returns 历史记录列表
   */
  async getHistoryByAction(action: string, workspaceId?: string): Promise<HistoryRecord[]> {
    let history = this.memoryHistory.filter(h => h.action === action);

    if (workspaceId) {
      history = history.filter(h => h.workspaceId === workspaceId);
    }

    return history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 清空历史记录
   * @param workspaceId - 工作区ID（可选）
   */
  async clearHistory(workspaceId?: string): Promise<void> {
    if (workspaceId) {
      this.memoryHistory = this.memoryHistory.filter(h => h.workspaceId !== workspaceId);

      if (mongoDBService.isConnected()) {
        await mongoDBService.deleteMany('history', { workspaceId } as never);
      }
    } else {
      this.memoryHistory = [];

      if (mongoDBService.isConnected()) {
        await mongoDBService.deleteMany('history', {} as never);
      }
    }
  }

  /**
   * 撤销最后一次操作
   * @param workspaceId - 工作区ID
   * @returns 操作前后状态
   */
  async undoLastAction(workspaceId?: string): Promise<{ beforeState: Record<string, unknown>; afterState: Record<string, unknown> } | null> {
    const history = await this.getHistory(1, workspaceId);
    if (history.length === 0) return null;

    const lastAction = history[0];
    return {
      beforeState: lastAction.beforeState || {},
      afterState: lastAction.afterState || {},
    };
  }
}

export const historyService = new HistoryService();
