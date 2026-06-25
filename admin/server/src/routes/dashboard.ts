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

export default router;
