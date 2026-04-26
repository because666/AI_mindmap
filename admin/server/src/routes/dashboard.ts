import { Router, Request, Response } from 'express';
import { dashboardService } from '../services/dashboardService';
import { requireAuth } from '../middleware/auth';

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

    const data = await dashboardService.getTrends(type, days);
    res.json({ success: true, data });
  } catch (error) {
    console.error('获取趋势数据失败:', error);
    res.status(500).json({ success: false, error: '获取趋势数据失败' });
  }
});

export default router;
