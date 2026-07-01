import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { WorkspaceListItem, PaginationResult, RankingSortBy, WorkspaceRankingItem } from '../types';
import { requireAuth, requireRole } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { escapeRegex, sanitizePagination } from '../utils/validators';
import { notifyWorkspaceCacheClear } from '../services/cacheNotify';

const router = Router();

/**
 * 排行排序维度校验集合
 * 仅允许 nodeCount / conversationCount / exportCount 三种排序维度
 */
const VALID_SORT_BY: ReadonlySet<string> = new Set(['nodeCount', 'conversationCount', 'exportCount']);

/**
 * 获取工作区排行榜
 * 使用 MongoDB 聚合管道从 workspaces 集合关联 nodes/conversations/export_tasks 集合计数
 * 支持按节点数、对话量、导出量排序，特别关注的工作区置顶显示
 * @query sortBy - 排序维度，默认 nodeCount
 * @query limit - 返回数量，默认 20
 * @returns WorkspaceRankingItem[] 排行列表
 */
router.get('/ranking', requireAuth, async (req: Request, res: Response) => {
  try {
    const rawSortBy = (req.query.sortBy as string) || 'nodeCount';
    const sortBy: RankingSortBy = VALID_SORT_BY.has(rawSortBy) ? (rawSortBy as RankingSortBy) : 'nodeCount';
    const rawLimit = parseInt(req.query.limit as string, 10);
    const limit = Number.isNaN(rawLimit) || rawLimit <= 0 ? 20 : Math.min(rawLimit, 100);

    const workspaces = await adminDB.find('workspaces', {} as never, {
      sort: { createdAt: -1 },
      limit: 10000,
    });

    if (workspaces.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const wsIds = workspaces.map((w: Record<string, unknown>) => w.id as string);

    let nodeCountMap = new Map<string, number>();
    try {
      const nodeCounts = await adminDB.aggregate('nodes', [
        { $match: { workspaceId: { $in: wsIds } } },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
      ]);
      for (const nc of nodeCounts) {
        nodeCountMap.set((nc as Record<string, unknown>)._id as string, (nc as Record<string, unknown>).count as number);
      }
    } catch {
      // nodes 集合可能不存在
    }

    let conversationCountMap = new Map<string, number>();
    try {
      const convCounts = await adminDB.aggregate('conversations', [
        { $match: { workspaceId: { $in: wsIds } } },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
      ]);
      for (const cc of convCounts) {
        conversationCountMap.set((cc as Record<string, unknown>)._id as string, (cc as Record<string, unknown>).count as number);
      }
    } catch {
      // conversations 集合可能不存在
    }

    let exportCountMap = new Map<string, number>();
    try {
      const exportCounts = await adminDB.aggregate('export_tasks', [
        { $match: { workspaceId: { $in: wsIds } } },
        { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
      ]);
      for (const ec of exportCounts) {
        exportCountMap.set((ec as Record<string, unknown>)._id as string, (ec as Record<string, unknown>).count as number);
      }
    } catch {
      // export_tasks 集合可能不存在
    }

    const items: WorkspaceRankingItem[] = workspaces.map((w: Record<string, unknown>) => ({
      workspaceId: w.id as string,
      name: (w.name as string) || '未命名工作区',
      nodeCount: nodeCountMap.get(w.id as string) || 0,
      conversationCount: conversationCountMap.get(w.id as string) || 0,
      exportCount: exportCountMap.get(w.id as string) || 0,
      starred: (w.starred as boolean) || false,
    }));

    items.sort((a, b) => {
      if (a.starred !== b.starred) {
        return a.starred ? -1 : 1;
      }
      return (b[sortBy] as number) - (a[sortBy] as number);
    });

    const result = items.slice(0, limit);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取工作区排行失败:', error);
    res.status(500).json({ success: false, error: '获取工作区排行失败' });
  }
});

/**
 * 切换工作区特别关注标记
 * 更新 workspaces 集合文档的 starred 字段
 * @param id - 工作区 ID
 * @body starred - 是否特别关注
 */
router.put('/:id/star', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { starred } = req.body;

    if (typeof starred !== 'boolean') {
      res.status(400).json({ success: false, error: 'starred 参数必须为布尔值' });
      return;
    }

    const workspace = await adminDB.findOne('workspaces', { id } as never);
    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const success = await adminDB.updateOne('workspaces', { id } as never, {
      $set: { starred },
    });

    if (!success) {
      res.status(500).json({ success: false, error: '更新特别关注状态失败' });
      return;
    }

    res.json({ success: true, message: starred ? '已标记为特别关注' : '已取消特别关注' });
  } catch (error) {
    console.error('切换特别关注失败:', error);
    res.status(500).json({ success: false, error: '切换特别关注失败' });
  }
});

/**
 * 置顶工作区
 * 将指定工作区的 isPinned 设为 true，pinnedAt 设为当前时间
 * 置顶后的工作区会出现在客户端"推荐工作区"区域
 * 仅 super_admin / operator 角色可调用
 * @param id - 工作区 ID
 * @returns 成功时返回 success:true 与提示文案；失败返回对应状态码与错误信息
 */
router.post('/:id/pin', requireAuth, requireRole('super_admin', 'operator'), auditLog('PIN_WORKSPACE', 'workspace'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workspace = await adminDB.findOne('workspaces', { id } as never);
    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const now = new Date();
    const success = await adminDB.updateOne('workspaces', { id } as never, {
      $set: {
        isPinned: true,
        pinnedAt: now,
      },
    });

    if (!success) {
      res.status(500).json({ success: false, error: '置顶工作区失败' });
      return;
    }

    // 通知主服务清除该工作区缓存，使置顶状态尽快在公开列表生效
    await notifyWorkspaceCacheClear(id);

    res.json({ success: true, message: '已置顶工作区', data: { isPinned: true, pinnedAt: now.toISOString() } });
  } catch (error) {
    console.error('置顶工作区失败:', error);
    res.status(500).json({ success: false, error: '置顶工作区失败' });
  }
});

/**
 * 取消置顶工作区
 * 将指定工作区的 isPinned 设为 false，并清除 pinnedAt 字段
 * 仅 super_admin / operator 角色可调用
 * @param id - 工作区 ID
 * @returns 成功时返回 success:true 与提示文案；失败返回对应状态码与错误信息
 */
router.delete('/:id/pin', requireAuth, requireRole('super_admin', 'operator'), auditLog('UNPIN_WORKSPACE', 'workspace'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workspace = await adminDB.findOne('workspaces', { id } as never);
    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const success = await adminDB.updateOne('workspaces', { id } as never, {
      $set: {
        isPinned: false,
        pinnedAt: null,
      },
    });

    if (!success) {
      res.status(500).json({ success: false, error: '取消置顶失败' });
      return;
    }

    await notifyWorkspaceCacheClear(id);

    res.json({ success: true, message: '已取消置顶', data: { isPinned: false, pinnedAt: null } });
  } catch (error) {
    console.error('取消置顶工作区失败:', error);
    res.status(500).json({ success: false, error: '取消置顶失败' });
  }
});

/**
 * 获取工作区列表
 * 排序规则：置顶工作区优先（isPinned desc, pinnedAt desc），其后按创建时间倒序
 * 返回项包含 isPinned/pinnedAt 字段，便于前端展示置顶标记
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
      // 置顶工作区排在最前（isPinned desc, pinnedAt desc），然后按创建时间倒序
      sort: { isPinned: -1, pinnedAt: -1, createdAt: -1 },
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
    try {
      if (wsIds.length > 0) {
        const nodeCounts = await adminDB.aggregate('nodes', [
          { $match: { workspaceId: { $in: wsIds } } },
          { $group: { _id: '$workspaceId', count: { $sum: 1 } } },
        ]);
        for (const nc of nodeCounts) {
          nodeCountMap.set((nc as Record<string, unknown>)._id as string, (nc as Record<string, unknown>).count as number);
        }
      }
    } catch {
      // nodes 集合可能不存在（节点数据存储在 Neo4j 中）
    }

    const items: WorkspaceListItem[] = workspaces.map((w: Record<string, unknown>) => {
      const ownerId = w.ownerId as string;
      const pinnedAtRaw = w.pinnedAt;
      // pinnedAt 可能是 Date 或字符串，统一序列化为 ISO 字符串
      const pinnedAtIso = pinnedAtRaw instanceof Date
        ? pinnedAtRaw.toISOString()
        : (typeof pinnedAtRaw === 'string' ? pinnedAtRaw : undefined);
      // banExpiresAt 同样可能是 Date 或字符串，统一序列化为 ISO 字符串
      const banExpiresAtRaw = w.banExpiresAt;
      const banExpiresAtIso = banExpiresAtRaw instanceof Date
        ? banExpiresAtRaw.toISOString()
        : (typeof banExpiresAtRaw === 'string' ? banExpiresAtRaw : undefined);
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
        isPinned: w.isPinned === true,
        pinnedAt: pinnedAtIso,
        isBanned: w.isBanned === true,
        banReason: w.banReason as string | undefined,
        banExpiresAt: banExpiresAtIso,
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

    let nodeCount = 0;
    try {
      nodeCount = await adminDB.countDocuments('nodes', { workspaceId: id } as never);
    } catch {
      nodeCount = 0;
    }
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
    let nodes: unknown[] = [];
    try {
      nodes = await adminDB.find('nodes', { workspaceId: id } as never, { limit: 100 });
    } catch {
      nodes = [];
    }
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

    await notifyWorkspaceCacheClear(id);

    res.json({ success: true, message: '工作区已关闭' });
  } catch (error) {
    console.error('关闭工作区失败:', error);
    res.status(500).json({ success: false, error: '关闭工作区失败' });
  }
});

/**
 * 封禁工作区
 * 将指定工作区标记为封禁状态，记录封禁原因与可选有效期
 * 封禁后主服务端会拦截对该工作区的访问
 * 仅 super_admin / operator 角色可调用
 * @param id - 工作区 ID
 * @body reason - 封禁原因（必填）
 * @body duration - 封禁时长（小时），为 0 或不传表示永久封禁
 * @returns 成功时返回 success:true；失败返回对应状态码与错误信息
 */
router.post('/:id/ban', requireAuth, requireRole('super_admin', 'operator'), auditLog('BAN_WORKSPACE', 'workspace'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, duration } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: '请提供封禁原因' });
      return;
    }

    const workspace = await adminDB.findOne('workspaces', { id } as never);
    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const updateData: Record<string, unknown> = {
      isBanned: true,
      banReason: reason,
      bannedAt: new Date(),
    };

    if (duration && duration > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + Number(duration));
      updateData.banExpiresAt = expiresAt;
    }

    const success = await adminDB.updateOne('workspaces', { id } as never, {
      $set: updateData,
    });

    if (!success) {
      res.status(500).json({ success: false, error: '封禁工作区失败' });
      return;
    }

    await notifyWorkspaceCacheClear(id);

    res.json({ success: true, message: '工作区已封禁' });
  } catch (error) {
    console.error('封禁工作区失败:', error);
    res.status(500).json({ success: false, error: '封禁工作区失败' });
  }
});

/**
 * 解封工作区
 * 清除指定工作区的封禁标记，恢复访问
 * 仅 super_admin / operator 角色可调用
 * @param id - 工作区 ID
 * @returns 成功时返回 success:true；失败返回对应状态码与错误信息
 */
router.post('/:id/unban', requireAuth, requireRole('super_admin', 'operator'), auditLog('UNBAN_WORKSPACE', 'workspace'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workspace = await adminDB.findOne('workspaces', { id } as never);
    if (!workspace) {
      res.status(404).json({ success: false, error: '工作区不存在' });
      return;
    }

    const success = await adminDB.updateOne('workspaces', { id } as never, {
      $set: {
        isBanned: false,
        banReason: null,
        banExpiresAt: null,
        unbannedAt: new Date(),
      },
    });

    if (!success) {
      res.status(500).json({ success: false, error: '解封工作区失败' });
      return;
    }

    await notifyWorkspaceCacheClear(id);

    res.json({ success: true, message: '工作区已解封' });
  } catch (error) {
    console.error('解封工作区失败:', error);
    res.status(500).json({ success: false, error: '解封工作区失败' });
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
