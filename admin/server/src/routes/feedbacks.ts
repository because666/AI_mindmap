import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { Parser } from 'json2csv';
import { adminDB } from '../config/database';
import { FeedbackListItem, FeedbackStatus, FeedbackType } from '../types';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { feedbackService } from '../services/feedbackService';
import { escapeRegex } from '../utils/validators';

const router = Router();

/**
 * 合法的反馈状态值
 */
const VALID_STATUS: FeedbackStatus[] = ['pending', 'processing', 'resolved', 'closed'];

/**
 * 合法的反馈类型值
 */
const VALID_TYPES: FeedbackType[] = ['功能异常', '界面问题', '建议', '其他'];

/**
 * 构建反馈查询筛选条件
 * 根据请求查询参数构建MongoDB筛选器
 * @param query - 请求查询参数对象
 * @returns MongoDB筛选条件对象
 */
function buildFilter(query: Record<string, unknown>): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  const type = query.type as string | undefined;
  if (type && VALID_TYPES.includes(type as FeedbackType)) {
    filter.type = type;
  }

  const status = query.status as string | undefined;
  if (status && VALID_STATUS.includes(status as FeedbackStatus)) {
    filter.status = status;
  }

  const startDate = query.startDate as string | undefined;
  const endDate = query.endDate as string | undefined;
  if (startDate || endDate) {
    const dateFilter: Record<string, unknown> = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }
    filter.createdAt = dateFilter;
  }

  const keyword = query.keyword as string | undefined;
  if (keyword && keyword.trim()) {
    const safeKeyword = escapeRegex(keyword.trim());
    filter.title = { $regex: safeKeyword, $options: 'i' };
  }

  return filter;
}

/**
 * GET /
 * 获取反馈分页列表
 * 查询参数：page、pageSize、type、status、startDate、endDate、keyword
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.max(1, Math.min(Number(req.query.pageSize) || 20, 100));
    const skip = (page - 1) * pageSize;

    const filter = buildFilter(req.query as Record<string, unknown>);

    const feedbacks = await adminDB.find('feedbacks', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit: pageSize,
    });

    const total = await adminDB.countDocuments('feedbacks', filter as never);

    const items: FeedbackListItem[] = feedbacks.map((item: Record<string, unknown>) => ({
      _id: (item._id as { toString(): string }).toString(),
      title: item.title as string,
      description: item.description as string,
      type: item.type as FeedbackType,
      contact: item.contact as string,
      visitorIp: item.visitorIp as string,
      status: item.status as FeedbackStatus,
      createdAt: new Date(item.createdAt as Date).toISOString(),
    }));

    res.json({
      success: true,
      data: {
        items,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('获取反馈列表失败:', error);
    res.status(500).json({ success: false, error: '获取反馈列表失败' });
  }
});

/**
 * GET /stats
 * 获取反馈统计数据
 */
router.get('/stats', requireAuth, async (_req: Request, res: Response) => {
  try {
    const stats = await feedbackService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('获取反馈统计失败:', error);
    res.status(500).json({ success: false, error: '获取反馈统计失败' });
  }
});

/**
 * PATCH /:id/status
 * 更新反馈状态
 * 请求体：{ status: FeedbackStatus }
 * 需要审计日志记录
 */
router.patch(
  '/:id/status',
  requireAuth,
  auditLog('更新反馈状态', 'feedback'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id || !ObjectId.isValid(id)) {
        res.status(400).json({ success: false, error: '无效的反馈ID' });
        return;
      }

      if (!status || !VALID_STATUS.includes(status)) {
        res.status(400).json({
          success: false,
          error: `无效的状态值，必须为：${VALID_STATUS.join('/')}`,
        });
        return;
      }

      const success = await adminDB.updateOne(
        'feedbacks',
        { _id: new ObjectId(id) } as never,
        { $set: { status } }
      );

      if (!success) {
        res.status(404).json({ success: false, error: '反馈不存在' });
        return;
      }

      res.json({ success: true, message: '反馈状态已更新' });
    } catch (error) {
      console.error('更新反馈状态失败:', error);
      res.status(500).json({ success: false, error: '更新反馈状态失败' });
    }
  }
);

/**
 * POST /export
 * 导出反馈数据为CSV格式
 * 查询参数同列表筛选
 */
router.post('/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const filter = buildFilter(req.query as Record<string, unknown>);

    const feedbacks = await adminDB.find('feedbacks', filter as never, {
      sort: { createdAt: -1 },
      limit: 10000,
    });

    const exportData = feedbacks.map((item: Record<string, unknown>) => ({
      ID: (item._id as { toString(): string }).toString(),
      标题: item.title as string,
      描述: item.description as string,
      类型: item.type as string,
      联系方式: item.contact as string,
      访客IP: item.visitorIp as string,
      状态: item.status as string,
      创建时间: new Date(item.createdAt as Date).toISOString(),
    }));

    const fields = ['ID', '标题', '描述', '类型', '联系方式', '访客IP', '状态', '创建时间'];
    const parser = new Parser({ fields });
    const csv = parser.parse(exportData);

    const filename = `feedbacks_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('导出反馈数据失败:', error);
    res.status(500).json({ success: false, error: '导出反馈数据失败' });
  }
});

export default router;
