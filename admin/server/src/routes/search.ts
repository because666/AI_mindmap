import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { escapeRegex } from '../utils/validators';

const router = Router();

/** 搜索结果中用户项接口 */
interface SearchUserItem {
  /** 用户唯一标识 */
  id: string;
  /** 用户昵称 */
  nickname: string;
  /** 用户邮箱 */
  email: string;
}

/** 搜索结果中工作区项接口 */
interface SearchWorkspaceItem {
  /** 工作区唯一标识 */
  id: string;
  /** 工作区名称 */
  name: string;
}

/** 搜索结果聚合接口 */
interface SearchResponse {
  /** 匹配的用户列表 */
  users: SearchUserItem[];
  /** 匹配的工作区列表 */
  workspaces: SearchWorkspaceItem[];
}

/** 每种类型最多返回的结果数量 */
const MAX_RESULTS_PER_TYPE = 5;

/**
 * 全局搜索端点
 * 根据搜索词从 visitors 和 workspaces 集合中模糊匹配
 * visitors 按 nickname 字段匹配，workspaces 按 name 字段匹配
 * @query q - 搜索关键词
 * @returns { users: SearchUserItem[], workspaces: SearchWorkspaceItem[] }
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const rawQuery = req.query.q as string;
    if (!rawQuery || !rawQuery.trim()) {
      res.json({
        success: true,
        data: { users: [], workspaces: [] } as SearchResponse,
      });
      return;
    }

    const safeQuery = escapeRegex(rawQuery.trim());
    const regex = { $regex: safeQuery, $options: 'i' };

    const users: SearchUserItem[] = [];
    const workspaces: SearchWorkspaceItem[] = [];

    try {
      const matchedVisitors = await adminDB.find('visitors', {
        nickname: regex,
      } as never, {
        limit: MAX_RESULTS_PER_TYPE,
        sort: { lastSeen: -1 },
      });

      for (const v of matchedVisitors) {
        const record = v as Record<string, unknown>;
        users.push({
          id: record.id as string,
          nickname: (record.nickname as string) || '未知用户',
          email: (record.email as string) || '',
        });
      }
    } catch (error) {
      console.error('搜索用户失败:', error);
    }

    try {
      const matchedWorkspaces = await adminDB.find('workspaces', {
        name: regex,
      } as never, {
        limit: MAX_RESULTS_PER_TYPE,
        sort: { createdAt: -1 },
      });

      for (const w of matchedWorkspaces) {
        const record = w as Record<string, unknown>;
        workspaces.push({
          id: record.id as string,
          name: (record.name as string) || '未命名工作区',
        });
      }
    } catch (error) {
      console.error('搜索工作区失败:', error);
    }

    const result: SearchResponse = { users, workspaces };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('全局搜索失败:', error);
    res.status(500).json({ success: false, error: '搜索失败' });
  }
});

export default router;
