import { Router, Request, Response } from 'express';
import { searchService } from '../services/searchService';
import { workspaceMemberAuth } from '../middleware';

const router = Router();

/**
 * 搜索节点
 */
router.get('/', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { q, type = 'text', tags } = req.query;
    const workspaceId = req.workspaceId!;

    if (!q && !tags) {
      return res.status(400).json({
        success: false,
        error: '需要提供搜索关键词 "q" 或标签 "tags"'
      });
    }

    let results;

    if (tags) {
      const tagArray = (tags as string).split(',').map(t => t.trim());
      results = await searchService.searchByTags(tagArray, workspaceId);
    } else if (type === 'semantic') {
      results = await searchService.semanticSearch(q as string, 20);
    } else if (type === 'hybrid') {
      results = await searchService.hybridSearch(q as string, workspaceId);
    } else {
      results = await searchService.searchNodes(q as string, workspaceId);
    }

    res.json({ success: true, data: results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取相关节点
 */
router.get('/related/:nodeId', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { depth = 2 } = req.query;
    const results = await searchService.getRelatedNodes(
      req.params.nodeId,
      parseInt(depth as string, 10)
    );

    res.json({ success: true, data: results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
