import { Router, Request, Response } from 'express';
import { aiUsageService } from '../services/aiUsageService';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * 获取AI用量汇总统计
 * @query startDate - 起始日期（可选）
 * @query endDate - 结束日期（可选）
 * @query model - AI模型名称（可选）
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, model } = req.query as Record<string, string | undefined>;
    const stats = await aiUsageService.getStats(startDate, endDate, model);
    res.json({ success: true, data: stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取AI用量统计失败';
    console.error('获取AI用量统计失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取AI用量趋势数据
 * @query startDate - 起始日期（必填）
 * @query endDate - 结束日期（必填）
 * @query granularity - 聚合粒度：day | week | month（默认day）
 * @query model - AI模型名称（可选）
 */
router.get('/trends', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, model } = req.query as Record<string, string | undefined>;
    const granularity = (req.query.granularity as string) || 'day';

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, error: 'startDate和endDate为必填参数' });
      return;
    }

    if (!['day', 'week', 'month'].includes(granularity)) {
      res.status(400).json({ success: false, error: 'granularity仅支持day、week、month' });
      return;
    }

    const trends = await aiUsageService.getTrends(
      startDate,
      endDate,
      granularity as 'day' | 'week' | 'month',
      model
    );
    res.json({ success: true, data: trends });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取AI用量趋势失败';
    console.error('获取AI用量趋势失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取模型分布数据
 * @query startDate - 起始日期（可选）
 * @query endDate - 结束日期（可选）
 */
router.get('/model-distribution', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string | undefined>;
    const distribution = await aiUsageService.getModelDistribution(startDate, endDate);
    res.json({ success: true, data: distribution });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取模型分布失败';
    console.error('获取模型分布失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取队列状态
 * 代理调用主服务的队列状态API
 */
router.get('/queue-status', requireAuth, async (_req: Request, res: Response) => {
  try {
    const queueStatus = await aiUsageService.getQueueStatus();
    res.json({ success: true, data: queueStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取队列状态失败';
    console.error('获取队列状态失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 导出AI用量CSV数据
 * @query startDate - 起始日期（可选）
 * @query endDate - 结束日期（可选）
 * @query model - AI模型名称（可选）
 */
router.get('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, model } = req.query as Record<string, string | undefined>;
    const csv = await aiUsageService.exportCSV(startDate, endDate, model);

    if (!csv) {
      res.status(404).json({ success: false, error: '无数据可导出' });
      return;
    }

    const filename = `ai_usage_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    const message = error instanceof Error ? error.message : '导出CSV失败';
    console.error('导出CSV失败:', error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
