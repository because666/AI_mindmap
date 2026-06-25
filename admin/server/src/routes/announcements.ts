import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { announcementService } from '../services/announcementService';
import { AnnouncementType } from '../types';

const router = Router();

/**
 * 合法公告类型白名单
 */
const VALID_TYPES: AnnouncementType[] = ['info', 'warning', 'success', 'error'];

/**
 * 获取公告列表
 * 支持分页、按标题搜索、按类型/状态筛选
 * 全部端点需要 requireAuth 认证
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const search = req.query.search as string | undefined;
    const type = req.query.type as string | undefined;
    const isActive = req.query.isActive as string | undefined;

    const result = await announcementService.listAnnouncements({
      page,
      limit,
      search,
      type,
      isActive,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    res.status(500).json({ success: false, error: '获取公告列表失败' });
  }
});

/**
 * 创建公告
 * 请求体需包含 title, content, type, startDate, endDate
 * createdBy 从认证中间件挂载的 adminNickname 获取
 */
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, content, type, targetGroups, startDate, endDate, isActive } = req.body;

    if (!title || !content || !type || !startDate || !endDate) {
      res.status(400).json({ success: false, error: '缺少必要字段：title, content, type, startDate, endDate' });
      return;
    }

    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ success: false, error: `公告类型无效，允许值：${VALID_TYPES.join(', ')}` });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ success: false, error: '日期格式无效' });
      return;
    }

    if (start >= end) {
      res.status(400).json({ success: false, error: '开始时间必须早于结束时间' });
      return;
    }

    const adminReq = req as Request & { adminNickname?: string };
    const id = await announcementService.createAnnouncement({
      title,
      content,
      type,
      targetGroups: targetGroups || [],
      startDate: start,
      endDate: end,
      isActive: isActive !== false,
      createdBy: adminReq.adminNickname || 'unknown',
    });

    if (!id) {
      res.status(500).json({ success: false, error: '创建公告失败' });
      return;
    }

    res.json({ success: true, data: { id } });
  } catch (error) {
    console.error('创建公告失败:', error);
    res.status(500).json({ success: false, error: '创建公告失败' });
  }
});

/**
 * 更新公告
 * 路径参数 id 为公告的 ObjectId
 * 请求体可包含 title, content, type, targetGroups, startDate, endDate
 */
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, type, targetGroups, startDate, endDate } = req.body;

    if (type && !VALID_TYPES.includes(type)) {
      res.status(400).json({ success: false, error: `公告类型无效，允许值：${VALID_TYPES.join(', ')}` });
      return;
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start >= end) {
        res.status(400).json({ success: false, error: '开始时间必须早于结束时间' });
        return;
      }
    }

    const success = await announcementService.updateAnnouncement(id, {
      title,
      content,
      type,
      targetGroups,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    if (!success) {
      res.status(404).json({ success: false, error: '公告不存在或更新失败' });
      return;
    }

    res.json({ success: true, message: '公告已更新' });
  } catch (error) {
    console.error('更新公告失败:', error);
    res.status(500).json({ success: false, error: '更新公告失败' });
  }
});

/**
 * 删除公告
 * 路径参数 id 为公告的 ObjectId
 */
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = await announcementService.deleteAnnouncement(id);

    if (!success) {
      res.status(404).json({ success: false, error: '公告不存在或删除失败' });
      return;
    }

    res.json({ success: true, message: '公告已删除' });
  } catch (error) {
    console.error('删除公告失败:', error);
    res.status(500).json({ success: false, error: '删除公告失败' });
  }
});

/**
 * 切换公告启用/禁用状态
 * 路径参数 id 为公告的 ObjectId
 * 返回切换后的最新 isActive 状态
 */
router.put('/:id/toggle', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const newActiveState = await announcementService.toggleActive(id);

    if (newActiveState === null) {
      res.status(404).json({ success: false, error: '公告不存在或操作失败' });
      return;
    }

    res.json({ success: true, data: { isActive: newActiveState } });
  } catch (error) {
    console.error('切换公告状态失败:', error);
    res.status(500).json({ success: false, error: '切换公告状态失败' });
  }
});

export default router;
