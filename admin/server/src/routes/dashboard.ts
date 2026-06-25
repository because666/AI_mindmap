import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboardService';
import { requireAuth } from '../middleware/auth';
import { TrendData } from '../types';

/**
 * 趋势类型到 TrendData 字段的映射
 */
const TREND_TYPE_FIELD_MAP: Record<string, keyof Omit<TrendData, 'dates'>> = {
  user_growth: 'visitors',
  active_users: 'visitors',
  workspace_activity: 'workspaces',
  message_volume: 'conversations',
};

/**
 * 允许查询的事件类型列表
 * 用于趋势图和漏斗等事件统计接口的参数校验
 */
const ALLOWED_EVENT_TYPES: string[] = [
  'page_view',
  'node_created',
  'branch_created',
  'extension_direction_click',
  'summary_generated',
  'map_created',
];

const router = Router();

/**
 * 获取核心统计指标
 */
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await dashboardService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});

/**
 * 获取趋势数据
 * @query type - 趋势类型
 * @query days - 统计天数
 */
router.get('/trends', requireAuth, async (req: Request, res: Response) => {
  try {
    const type = (req.query.type as string) || 'user_growth';
    const days = parseInt(req.query.days as string) || 30;

    if (!['user_growth', 'active_users', 'workspace_activity', 'message_volume'].includes(type)) {
      res.status(400).json({ success: false, error: '无效的趋势类型' });
      return;
    }

    if (days < 1 || days > 90) {
      res.status(400).json({ success: false, error: '天数范围应为1-90' });
      return;
    }

    const data = await dashboardService.getTrends(days);
    const field = TREND_TYPE_FIELD_MAP[type];
    const values = data[field];
    res.json({ success: true, data: { dates: data.dates, values } });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ success: false, error: '获取趋势数据失败' });
  }
});

/**
 * 获取留存趋势数据
 * 返回 DAU/WAU/MAU 及次日/7日/30日留存率
 * @query days - 统计天数，默认30天，范围1-90
 */
router.get('/retention', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;

    if (days < 1 || days > 90) {
      res.status(400).json({ success: false, error: '天数范围应为1-90' });
      return;
    }

    const data = await dashboardService.getRetentionTrends(days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取留存趋势数据失败:', error);
    res.status(500).json({ success: false, error: '获取留存趋势数据失败' });
  }
});

/**
 * 获取转化漏斗数据
 * 返回注册→对话→结论→导出的转化步骤及转化率
 */
router.get('/funnel', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await dashboardService.getConversionFunnel();
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取转化漏斗数据失败:', error);
    res.status(500).json({ success: false, error: '获取转化漏斗数据失败' });
  }
});

/**
 * 获取用户行为事件概览
 * 返回事件总量、今日事件数、独立访客数
 */
router.get('/events/overview', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await dashboardService.getEventOverview();
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取事件概览失败:', error);
    res.status(500).json({ success: false, error: '获取事件概览失败' });
  }
});

/**
 * 获取用户行为事件趋势
 * @query days - 统计天数，默认7天，范围1-90
 * @query eventType - 事件类型筛选，为空时统计全部事件
 */
router.get('/events/trend', requireAuth, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const eventType = (req.query.eventType as string) || '';

    if (days < 1 || days > 90) {
      res.status(400).json({ success: false, error: '天数范围应为1-90' });
      return;
    }

    if (eventType && !ALLOWED_EVENT_TYPES.includes(eventType)) {
      res.status(400).json({ success: false, error: '无效的事件类型' });
      return;
    }

    const data = await dashboardService.getEventTrend(days, eventType);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取事件趋势失败:', error);
    res.status(500).json({ success: false, error: '获取事件趋势失败' });
  }
});

/**
 * 获取关键事件漏斗
 * 返回注册→完成引导→创建地图→创建分支→生成摘要的转化数据
 */
router.get('/events/funnel', requireAuth, async (_req: Request, res: Response) => {
  try {
    const data = await dashboardService.getEventFunnel();
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取事件漏斗失败:', error);
    res.status(500).json({ success: false, error: '获取事件漏斗失败' });
  }
});

/**
 * 获取最近事件列表
 * @query limit - 返回数量，默认20条，范围1-100
 */
router.get('/events/recent', requireAuth, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;

    if (limit < 1 || limit > 100) {
      res.status(400).json({ success: false, error: 'limit范围应为1-100' });
      return;
    }

    const data = await dashboardService.getRecentEvents(limit);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取最近事件失败:', error);
    res.status(500).json({ success: false, error: '获取最近事件失败' });
  }
});

export default router;
