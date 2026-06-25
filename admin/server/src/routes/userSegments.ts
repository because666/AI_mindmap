import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { userSegmentService } from '../services/userSegmentService';
import { sanitizePagination } from '../utils/validators';
import { SegmentRule } from '../types';

const router = Router();

/**
 * 获取标签列表
 * 返回所有用户标签，按创建时间升序排列
 */
router.get('/tags', requireAuth, async (_req: Request, res: Response) => {
  try {
    const tags = await userSegmentService.listTags();
    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(500).json({ success: false, error: '获取标签列表失败' });
  }
});

/**
 * 创建标签
 * 请求体需包含 name 和 color，description 可选
 */
router.post('/tags', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, color, description } = req.body as {
      name: string;
      color: string;
      description?: string;
    };

    if (!name || !color) {
      res.status(400).json({ success: false, error: '标签名称和颜色为必填项' });
      return;
    }

    const id = await userSegmentService.createTag(name, color, description);
    if (!id) {
      res.status(500).json({ success: false, error: '创建标签失败' });
      return;
    }

    res.json({ success: true, data: { _id: id, name, color, description } });
  } catch (error) {
    console.error('创建标签失败:', error);
    res.status(500).json({ success: false, error: '创建标签失败' });
  }
});

/**
 * 删除标签
 * 删除标签的同时从所有用户移除该标签引用
 */
router.delete('/tags/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await userSegmentService.deleteTag(id);

    if (!deleted) {
      res.status(404).json({ success: false, error: '标签不存在' });
      return;
    }

    res.json({ success: true, message: '标签已删除' });
  } catch (error) {
    console.error('删除标签失败:', error);
    res.status(500).json({ success: false, error: '删除标签失败' });
  }
});

/**
 * 更新标签
 * 请求体需包含 name 和 color，description 可选
 */
router.put('/tags/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, color, description } = req.body as {
      name: string;
      color: string;
      description?: string;
    };

    if (!name || !color) {
      res.status(400).json({ success: false, error: '标签名称和颜色为必填项' });
      return;
    }

    const updated = await userSegmentService.updateTag(id, name, color, description);
    if (!updated) {
      res.status(404).json({ success: false, error: '标签不存在或更新失败' });
      return;
    }

    res.json({ success: true, data: { _id: id, name, color, description } });
  } catch (error) {
    console.error('更新标签失败:', error);
    res.status(500).json({ success: false, error: '更新标签失败' });
  }
});

/**
 * 给用户添加标签
 */
router.post('/users/:userId/tags/:tagId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, tagId } = req.params;
    const added = await userSegmentService.addTagToUser(userId, tagId);

    if (!added) {
      res.status(400).json({ success: false, error: '添加标签失败，标签不存在或用户不存在' });
      return;
    }

    res.json({ success: true, message: '标签已添加' });
  } catch (error) {
    console.error('添加用户标签失败:', error);
    res.status(500).json({ success: false, error: '添加用户标签失败' });
  }
});

/**
 * 移除用户标签
 */
router.delete('/users/:userId/tags/:tagId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, tagId } = req.params;
    const removed = await userSegmentService.removeTagFromUser(userId, tagId);

    if (!removed) {
      res.status(400).json({ success: false, error: '移除标签失败，用户不存在或未关联该标签' });
      return;
    }

    res.json({ success: true, message: '标签已移除' });
  } catch (error) {
    console.error('移除用户标签失败:', error);
    res.status(500).json({ success: false, error: '移除用户标签失败' });
  }
});

/**
 * 按标签筛选用户
 * 支持分页参数 page 和 limit
 */
router.get('/users/by-tag/:tagId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tagId } = req.params;
    const { page, limit } = sanitizePagination(req.query.page, req.query.limit, 100);

    const result = await userSegmentService.getUsersByTag(tagId, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('按标签筛选用户失败:', error);
    res.status(500).json({ success: false, error: '按标签筛选用户失败' });
  }
});

/**
 * 获取分群列表
 * 返回所有用户分群，按创建时间升序排列
 */
router.get('/segments', requireAuth, async (_req: Request, res: Response) => {
  try {
    const segments = await userSegmentService.listSegments();
    res.json({ success: true, data: segments });
  } catch (error) {
    console.error('获取分群列表失败:', error);
    res.status(500).json({ success: false, error: '获取分群列表失败' });
  }
});

/**
 * 创建分群
 * 请求体需包含 name 和 rule，description 和 autoUpdate 可选
 */
router.post('/segments', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, rule, autoUpdate } = req.body as {
      name: string;
      description?: string;
      rule: SegmentRule;
      autoUpdate?: boolean;
    };

    if (!name || !rule) {
      res.status(400).json({ success: false, error: '分群名称和规则为必填项' });
      return;
    }

    if (!rule.field || !rule.operator || rule.value === undefined) {
      res.status(400).json({ success: false, error: '分群规则必须包含 field、operator 和 value' });
      return;
    }

    const id = await userSegmentService.createSegment(name, description, rule, autoUpdate ?? false);
    if (!id) {
      res.status(500).json({ success: false, error: '创建分群失败' });
      return;
    }

    res.json({ success: true, data: { _id: id, name, description, rule, autoUpdate: autoUpdate ?? false } });
  } catch (error) {
    console.error('创建分群失败:', error);
    res.status(500).json({ success: false, error: '创建分群失败' });
  }
});

/**
 * 删除分群
 */
router.delete('/segments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await userSegmentService.deleteSegment(id);

    if (!deleted) {
      res.status(404).json({ success: false, error: '分群不存在' });
      return;
    }

    res.json({ success: true, message: '分群已删除' });
  } catch (error) {
    console.error('删除分群失败:', error);
    res.status(500).json({ success: false, error: '删除分群失败' });
  }
});

/**
 * 更新分群
 * 请求体需包含 name 和 rule，description 可选
 */
router.put('/segments/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, rule } = req.body as {
      name: string;
      description?: string;
      rule: SegmentRule;
    };

    if (!name || !rule) {
      res.status(400).json({ success: false, error: '分群名称和规则为必填项' });
      return;
    }

    if (!rule.field || !rule.operator || rule.value === undefined) {
      res.status(400).json({ success: false, error: '分群规则必须包含 field、operator 和 value' });
      return;
    }

    const updated = await userSegmentService.updateSegment(id, name, description, rule);
    if (!updated) {
      res.status(404).json({ success: false, error: '分群不存在或更新失败' });
      return;
    }

    res.json({ success: true, data: { _id: id, name, description, rule } });
  } catch (error) {
    console.error('更新分群失败:', error);
    res.status(500).json({ success: false, error: '更新分群失败' });
  }
});

/**
 * 执行分群规则
 * 查询匹配用户并更新分群的 userCount
 */
router.post('/segments/:id/execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const count = await userSegmentService.executeSegmentRule(id);

    if (count < 0) {
      res.status(404).json({ success: false, error: '分群不存在' });
      return;
    }

    res.json({ success: true, data: { userCount: count } });
  } catch (error) {
    console.error('执行分群规则失败:', error);
    res.status(500).json({ success: false, error: '执行分群规则失败' });
  }
});

/**
 * 获取分群内用户
 * 支持分页参数 page 和 limit
 */
router.get('/segments/:id/users', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page, limit } = sanitizePagination(req.query.page, req.query.limit, 100);

    const result = await userSegmentService.getSegmentUsers(id, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取分群用户失败:', error);
    res.status(500).json({ success: false, error: '获取分群用户失败' });
  }
});

export default router;
