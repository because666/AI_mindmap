import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { WorkspaceListItem, PaginationResult } from '../types';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { escapeRegex, sanitizePagination } from '../utils/validators';

const router = Router();

/**
 * 获取工作区列表
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit, 100);
    const search = req.query.search as string;

    const filter: Record<string, unknown> = {};
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const workspaces = await adminDB.find('workspaces', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('workspaces', filter as never);

    const ownerIds = [...new Set(workspaces.map((w: Record<string, unknown>) => w.ownerId as string))];
    const ownerMap = new Map<string, string>();
    if (ownerIds.length > 0) {
      const owners = await adminDB.find('visitors', {
        id: { $in: ownerIds },
      } as never, { limit: ownerIds.length });
      for (const o of owners) {
        ownerMap.set((o as Record<string, unknown>).id as string, (o as Record<string, unknown>).nickname as string || '未知用户');
      }
    }

    const wsIds = workspaces.map((w: Record<string, unknown>) => w.id as string);
    const nodeCountMap = new Map<string, number>();
    if (wsIds.length > 0) {
      const nodeCounts = await adminDB.aggregate('nodes', [
        { $match: { workspaceId: { $in: wsIds } } },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
      ]);
      for (const nc of nodeCounts) {
        nodeCountMap.set((nc as Record<string, unknown>)._id as string, (nc as Record<string, unknown>).count as number);
      }
    }

    const items: WorkspaceListItem[] = workspaces.map((w: Record<string, unknown>) => {
      const ownerId = w.ownerId as string;
      return {
        _id: (w._id as { toString(): string }).toString(),
        id: w.id as string,
        name: w.name as string,
        description: (w.description as string) || '',
        type: (w.type as string) || 'public',
        createdAt: w.createdAt as string,
        updatedAt: w.updatedAt as string,
        creator: {
          id: ownerId,
          nickname: ownerMap.get(ownerId) || '未知用户',
        },
        stats: {
          memberCount: (w.members as unknown[])?.length || 0,
          nodeCount: nodeCountMap.get(w.id as string) || 0,
          messageCount: 0,
        },
        isReported: false,
        reportCount: 0,
      };
    });

    const result: PaginationResult<WorkspaceListItem> = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取工作区列表失败:', error);
    res.status(500).json({ success: false, error: '获取工作区列表失败' });
  }
});

/**
 * 获取工作区详情
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workspace = await adminDB.findOne('workspaces', { id } as never);

    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const nodeCount = await adminDB.countDocuments('nodes', { workspaceId: id } as never);
    const memberCount = (workspace.members as unknown[])?.length || 0;

    res.json({
      success: true,
      data: {
        id: (workspace as Record<string, unknown>).id,
        name: (workspace as Record<string, unknown>).name,
        description: (workspace as Record<string, unknown>).description,
        type: (workspace as Record<string, unknown>).type,
        createdAt: (workspace as Record<string, unknown>).createdAt,
        updatedAt: (workspace as Record<string, unknown>).updatedAt,
        ownerId: (workspace as Record<string, unknown>).ownerId,
        stats: {
          memberCount,
          nodeCount,
        },
      },
    });
  } catch (error) {
    console.error('获取工作区详情失败:', error);
    res.status(500).json({ success: false, error: '获取工作区详情失败' });
  }
});

/**
 * 获取工作区内容
 */
router.get('/:id/content', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const nodes = await adminDB.find('nodes', { workspaceId: id } as never, { limit: 100 });
    const conversations = await adminDB.find('conversations', { workspaceId: id } as never, {
      sort: { createdAt: -1 },
      limit: 50,
    });

    res.json({
      success: true,
      data: { nodes, messages: conversations },
    });
  } catch (error) {
    console.error('获取工作区内容失败:', error);
    res.status(500).json({ success: false, error: '获取工作区内容失败' });
  }
});

/**
 * 强制关闭工作区
 */
router.post('/:id/close', requireAuth, auditLog('CLOSE_WORKSPACE', 'workspace'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: '请提供关闭原因' });
      return;
    }

    const success = await adminDB.updateOne('workspaces', { id } as never, {
      $set: {
        isClosed: true,
        closeReason: reason,
        closedAt: new Date(),
      },
    });

    if (!success) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    res.json({ success: true, message: '工作区已关闭' });
  } catch (error) {
    console.error('关闭工作区失败:', error);
    res.status(500).json({ success: false, error: '关闭工作区失败' });
  }
});

/**
 * 向工作区成员发送通知
 * 通过极光推送发送通知给工作区成员
 */
router.post('/:id/notify', requireAuth, auditLog('NOTIFY_WORKSPACE', 'workspace'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      res.status(400).json({ success: false, error: '请提供标题和内容' });
      return;
    }

    const workspace = await adminDB.findOne('workspaces', { id } as never);
    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const members = (workspace as Record<string, unknown>).members as Array<{ visitorId: string }> || [];
    const memberIds = members.map((m) => m.visitorId);

    const pushMessage = {
      type: 'workspace_notification',
      title,
      content,
      summary: content.substring(0, 100),
      senderType: 'admin',
      senderName: (req as unknown as Record<string, unknown>).adminNickname as string || '管理员',
      targetType: 'workspace_members',
      targetWorkspaceId: id,
      targetUserIds: memberIds,
      createdAt: new Date(),
      sentAt: new Date(),
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      recipients: [],
      stats: { totalCount: 0, deliveredCount: 0, readCount: 0, readRate: 0 },
      forceRead: false,
    };

    await adminDB.insertOne('push_messages', pushMessage);

    res.json({ success: true, message: '通知已发送', memberCount: memberIds.length });
  } catch (error) {
    console.error('发送工作区通知失败:', error);
    res.status(500).json({ success: false, error: '发送通知失败' });
  }
});

export default router;
