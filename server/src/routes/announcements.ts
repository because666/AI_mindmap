import { Router, Request, Response } from 'express';
import { mongoDBService } from '../data/mongodb/connection';

const router = Router();

/**
 * 公告文档接口（用于类型标注查询结果）
 */
interface AnnouncementDoc {
  _id: unknown;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  targetGroups?: string[];
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 获取当前生效的公告列表（公开端点，无需认证）
 * 查询条件：isActive=true, startDate<=now, endDate>=now
 * 可选 query 参数 targetGroups（逗号分隔的分组ID）
 * @returns 当前生效的公告列表
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const now = new Date();

    const filter: Record<string, unknown> = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    const announcements = await mongoDBService.find<AnnouncementDoc>(
      'announcements',
      filter as never,
      { sort: { createdAt: -1 } }
    );

    const result = announcements.map((a) => ({
      _id: typeof a._id === 'object' && a._id !== null && 'toString' in a._id ? a._id.toString() : String(a._id),
      title: a.title,
      content: a.content,
      type: a.type,
      startDate: a.startDate,
      endDate: a.endDate,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, error: '获取公告列表失败' });
  }
});

export default router;
