import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { UserListItem, PaginationResult, TimelineEvent, TimelineEventType, TimelineEventDetail, ActivityTier } from '../types';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { escapeRegex, sanitizePagination } from '../utils/validators';
import { notifyVisitorCacheClear } from '../services/cacheNotify';
import { calculateActivityTier, buildActivityTierFilter, ALLOWED_ACTIVITY_TIERS } from '../utils/activityTier';

const router = Router();

const ALLOWED_SORT_FIELDS = ['createdAt', 'nickname', 'lastSeen', 'loginCount'];

/**
 * 验证危险操作确认码
 * 确认码必须为6位以上字母数字组合
 * @param confirmCode - 确认码
 * @param id - 目标对象ID（用于生成校验）
 * @returns 是否有效
 */
function verifyConfirmCode(confirmCode: unknown, id: string): boolean {
  if (!confirmCode || typeof confirmCode !== 'string') return false;
  if (confirmCode.length < 6) return false;
  if (!/^[a-zA-Z0-9]+$/.test(confirmCode)) return false;
  return confirmCode.includes(id.substring(0, 4));
}

/**
 * 获取用户列表
 * 支持分页、筛选、排序（白名单校验）
 * 支持按 status、search、activityTier 过滤
 * @query page - 页码
 * @query limit - 每页数量
 * @query status - 状态筛选（active/banned）
 * @query search - 昵称或ID搜索
 * @query sort - 排序字段（白名单）
 * @query activityTier - 活跃度分层筛选（new_user/high_active/churn_risk/dormant）
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit, 100);
    const status = req.query.status as string;
    const search = req.query.search as string;
    const rawSort = (req.query.sort as string) || 'createdAt';
    const sort = ALLOWED_SORT_FIELDS.includes(rawSort) ? rawSort : 'createdAt';
    const activityTier = (req.query.activityTier as string) || '';

    // 校验 activityTier 参数
    let tierValue: ActivityTier | null = null;
    if (activityTier) {
      if (!ALLOWED_ACTIVITY_TIERS.includes(activityTier as ActivityTier)) {
        res.status(400).json({ success: false, error: '无效的活跃度分层值' });
        return;
      }
      tierValue = activityTier as ActivityTier;
    }

    const filter: Record<string, unknown> = {};
    if (status === 'banned') {
      filter.isBanned = true;
    } else if (status === 'active') {
      filter.isBanned = { $ne: true };
    }
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { nickname: { $regex: safeSearch, $options: 'i' } },
        { id: { $regex: safeSearch, $options: 'i' } },
      ];
    }
    // 按 activityTier 转换为时间范围 filter，合并到主 filter
    // 注意：filter 是 $and 关系，需要将 $or 之外的子条件包装在 $and 中以避免冲突
    if (tierValue) {
      const tierFilter = buildActivityTierFilter(tierValue);
      if (tierFilter) {
        // 如果 filter 中已有 $or（来自 search），需要使用 $and 包装以避免冲突
        if (filter.$or) {
          const existingOr = filter.$or;
          delete filter.$or;
          filter.$and = [{ $or: existingOr }, tierFilter];
        } else {
          Object.assign(filter, tierFilter);
        }
      }
    }

    const visitors = await adminDB.find('visitors', filter as never, {
      sort: { [sort]: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('visitors', filter as never);

    const items: UserListItem[] = visitors.map((v: Record<string, unknown>) => {
      const visitorId = v.id as string;
      const workspaceCount = (v.workspaces as string[])?.length || 0;
      const createdAtRaw = v.createdAt as string | Date | null | undefined;
      const lastSeenRaw = v.lastSeen as string | Date | null | undefined;
      // 显式处理 lastSeen 类型：Date 转为 ISO 字符串，字符串保留，其他情况为 undefined
      // 避免 `v.lastSeen as string` 的不安全断言导致 Date 对象被错误序列化
      const lastSeenValue = v.lastSeen instanceof Date
        ? v.lastSeen.toISOString()
        : (v.lastSeen as string | undefined);

      return {
        _id: (v._id as { toString(): string }).toString(),
        id: visitorId,
        nickname: (v.nickname as string) || '未知用户',
        createdAt: v.createdAt as string,
        lastActiveAt: lastSeenValue || '',
        status: (v.isBanned as boolean) ? 'banned' : 'active',
        stats: {
          workspaceCount,
          messageCount: 0,
          nodeCount: 0,
        },
        isBanned: (v.isBanned as boolean) || false,
        banReason: v.banReason as string | undefined,
        banExpiresAt: v.banExpiresAt as string | undefined,
        lastIp: v.lastIp as string | undefined,
        ipHistory: v.ipHistory as string[] | undefined,
        // 填充用户标签字段，缺失时返回空数组，避免前端访问 undefined 崩溃
        tags: (v.tags as string[]) || [],
        // 根据用户时间字段计算活跃度分层
        activityTier: calculateActivityTier(createdAtRaw, lastSeenRaw),
      };
    });

    const result: PaginationResult<UserListItem> = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

/**
 * 获取用户详情
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const visitor = await adminDB.findOne('visitors', { id } as never);

    if (!visitor) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const workspaces = await adminDB.find('workspaces', {
      'members.visitorId': id,
    } as never);

    const workspaceList = workspaces.map((w: Record<string, unknown>) => {
      const members = w.members as Array<{ visitorId: string; role: string; joinedAt: Date }>;
      const member = members?.find((m) => m.visitorId === id);
      return {
        id: w.id as string,
        name: w.name as string,
        role: member?.role || 'member',
        joinedAt: member?.joinedAt || w.createdAt,
      };
    });

    res.json({
      success: true,
      data: {
        basic: {
          _id: (visitor._id as { toString(): string }).toString(),
          id: visitor.id,
          nickname: visitor.nickname,
          createdAt: visitor.createdAt,
          lastActiveAt: visitor.lastSeen,
          status: visitor.isBanned ? 'banned' : 'active',
          isBanned: visitor.isBanned || false,
        },
        workspaces: workspaceList,
      },
    });
  } catch (error) {
    console.error('获取用户详情失败:', error);
    res.status(500).json({ success: false, error: '获取用户详情失败' });
  }
});

/**
 * 获取用户消息轨迹时间线
 * 聚合该用户在 nodes（创建事件）、conversations（对话事件）、
 * nodes（结论提炼事件，type=conclusion）、export_tasks（导出事件）中的活动记录
 * 按 createdAt 倒序排列，支持分页
 * @param req.params.id - 用户ID
 * @param req.query.page - 页码，默认1
 * @param req.query.limit - 每页数量，默认20
 * @returns 分页的时间线事件列表
 */
router.get('/:id/timeline', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit, 50);

    const visitor = await adminDB.findOne('visitors', { id } as never);
    if (!visitor) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const allEvents: TimelineEvent[] = [];

    const normalNodes = await adminDB.find('nodes', {
      createdBy: id,
      type: { $ne: 'conclusion' },
    } as never, { sort: { createdAt: -1 }, limit: 500 });

    for (const node of normalNodes) {
      const nodeRecord = node as Record<string, unknown>;
      allEvents.push({
        type: 'node_created' as TimelineEventType,
        timestamp: (nodeRecord.createdAt as Date)?.toISOString() || new Date().toISOString(),
        detail: {
          nodeId: nodeRecord.id as string,
          nodeTitle: nodeRecord.title as string,
        } as TimelineEventDetail,
      });
    }

    const conclusionNodes = await adminDB.find('nodes', {
      createdBy: id,
      type: 'conclusion',
    } as never, { sort: { createdAt: -1 }, limit: 500 });

    for (const node of conclusionNodes) {
      const nodeRecord = node as Record<string, unknown>;
      allEvents.push({
        type: 'conclusion' as TimelineEventType,
        timestamp: (nodeRecord.createdAt as Date)?.toISOString() || new Date().toISOString(),
        detail: {
          nodeId: nodeRecord.id as string,
          nodeTitle: nodeRecord.title as string,
        } as TimelineEventDetail,
      });
    }

    const conversations = await adminDB.find('conversations', {
      createdBy: id,
    } as never, { sort: { createdAt: -1 }, limit: 500 });

    for (const conv of conversations) {
      const convRecord = conv as Record<string, unknown>;
      const messages = (convRecord.messages as Array<{ role: string; content: string }>) || [];
      const firstUserMsg = messages.find((m) => m.role === 'user');
      const preview = firstUserMsg
        ? (firstUserMsg.content.length > 50 ? firstUserMsg.content.substring(0, 50) + '...' : firstUserMsg.content)
        : undefined;
      allEvents.push({
        type: 'conversation' as TimelineEventType,
        timestamp: (convRecord.createdAt as Date)?.toISOString() || new Date().toISOString(),
        detail: {
          messagePreview: preview,
        } as TimelineEventDetail,
      });
    }

    const visitorIps: string[] = [];
    if (visitor.lastIp) {
      visitorIps.push(visitor.lastIp as string);
    }
    if (visitor.ipHistory && Array.isArray(visitor.ipHistory)) {
      for (const ip of visitor.ipHistory as string[]) {
        if (!visitorIps.includes(ip)) {
          visitorIps.push(ip);
        }
      }
    }

    if (visitorIps.length > 0) {
      const exportFilter = {
        createdByIp: { $in: visitorIps },
      };
      const exportTasks = await adminDB.find('export_tasks', exportFilter as never, {
        sort: { createdAt: -1 },
        limit: 500,
      });

      for (const task of exportTasks) {
        const taskRecord = task as Record<string, unknown>;
        allEvents.push({
          type: 'export' as TimelineEventType,
          timestamp: (taskRecord.createdAt as Date)?.toISOString() || new Date().toISOString(),
          detail: {
            exportType: `${taskRecord.type as string}/${taskRecord.format as string}`,
          } as TimelineEventDetail,
        });
      }
    }

    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = allEvents.length;
    const pagedEvents = allEvents.slice(skip, skip + limit);

    const result: PaginationResult<TimelineEvent> = {
      items: pagedEvents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取用户轨迹失败:', error);
    res.status(500).json({ success: false, error: '获取用户轨迹失败' });
  }
});

/**
 * 封禁用户
 */
router.post('/:id/ban', requireAuth, auditLog('BAN_USER', 'user'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason, duration } = req.body;

    if (!reason) {
      res.status(400).json({ success: false, error: '请提供封禁原因' });
      return;
    }

    const updateData: Record<string, unknown> = {
      isBanned: true,
      banReason: reason,
      bannedAt: new Date(),
    };

    if (duration && duration > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration);
      updateData.banExpiresAt = expiresAt;
    }

    const success = await adminDB.updateOne('visitors', { id } as never, {
      $set: updateData,
    });

    if (!success) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    // 异步通知主服务清除缓存，不阻塞封禁接口响应
    void notifyVisitorCacheClear(id);

    res.json({ success: true, message: '用户已封禁' });
  } catch (error) {
    console.error('封禁用户失败:', error);
    res.status(500).json({ success: false, error: '封禁用户失败' });
  }
});

/**
 * 解封用户
 */
router.post('/:id/unban', requireAuth, auditLog('UNBAN_USER', 'user'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const success = await adminDB.updateOne('visitors', { id } as never, {
      $set: {
        isBanned: false,
        banReason: null,
        banExpiresAt: null,
        unbanReason: reason,
        unbannedAt: new Date(),
      },
    });

    if (!success) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    // 异步通知主服务清除缓存，不阻塞解封接口响应
    void notifyVisitorCacheClear(id);

    res.json({ success: true, message: '用户已解封' });
  } catch (error) {
    console.error('解封用户失败:', error);
    res.status(500).json({ success: false, error: '解封用户失败' });
  }
});

/**
 * 删除用户（危险操作）
 * 需要有效的确认码（格式验证）
 */
router.delete('/:id', requireAuth, auditLog('DELETE_USER', 'user'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const confirmCode = req.headers['x-confirm-code'];

    if (!verifyConfirmCode(confirmCode, id)) {
      res.status(400).json({
        success: false,
        error: '危险操作，需要有效的确认码（6位以上字母数字组合）',
        needConfirm: true,
      });
      return;
    }

    const visitor = await adminDB.findOne('visitors', { id } as never);
    if (!visitor) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    await adminDB.deleteOne('visitors', { id } as never);

    res.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ success: false, error: '删除用户失败' });
  }
});

/**
 * 查询同IP的用户列表
 * 根据IP地址查找所有使用过该IP的访客
 */
router.get('/ip/:ip/visitors', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;

    if (!ip) {
      res.status(400).json({ success: false, error: '请提供IP地址' });
      return;
    }

    const visitors = await adminDB.find('visitors', {
      $or: [
        { lastIp: ip },
        { ipHistory: ip },
      ],
    } as never);

    const items = visitors.map((v: Record<string, unknown>) => {
      // 显式处理 lastSeen 类型：Date 转为 ISO 字符串，字符串保留，其他情况为空字符串
      const lastSeenValue = v.lastSeen instanceof Date
        ? v.lastSeen.toISOString()
        : (v.lastSeen as string | undefined);
      return {
        id: v.id as string,
        nickname: (v.nickname as string) || '未知用户',
        lastIp: v.lastIp as string | undefined,
        isBanned: (v.isBanned as boolean) || false,
        banReason: v.banReason as string | undefined,
        createdAt: v.createdAt as string,
        lastSeen: lastSeenValue || '',
      };
    });

    res.json({ success: true, data: { ip, visitors: items, total: items.length } });
  } catch (error) {
    console.error('查询同IP用户失败:', error);
    res.status(500).json({ success: false, error: '查询同IP用户失败' });
  }
});

/**
 * 封禁IP地址
 * 同时封禁该IP下的所有关联账号
 */
router.post('/ip-ban', requireAuth, auditLog('BAN_IP', 'ip'), async (req: Request, res: Response) => {
  try {
    const { ip, reason, duration, autoBanAccounts = true } = req.body;
    const adminReq = req as Request & { adminNickname?: string };

    if (!ip || !reason) {
      res.status(400).json({ success: false, error: '请提供IP地址和封禁原因' });
      return;
    }

    const existingBan = await adminDB.findOne('ip_bans', { ip } as never);
    if (existingBan) {
      res.status(400).json({ success: false, error: '该IP已在封禁列表中' });
      return;
    }

    const visitors = await adminDB.find('visitors', {
      $or: [
        { lastIp: ip },
        { ipHistory: ip },
      ],
    } as never);

    const visitorIds: string[] = visitors.map((v: Record<string, unknown>) => v.id as string);

    const banData: Record<string, unknown> = {
      ip,
      reason,
      bannedAt: new Date(),
      bannedBy: adminReq.adminNickname || 'unknown',
      visitorIds,
      autoBanAccounts,
    };

    if (duration && duration > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration);
      banData.banExpiresAt = expiresAt;
    }

    await adminDB.insertOne('ip_bans', banData);

    if (autoBanAccounts && visitorIds.length > 0) {
      const accountUpdateData: Record<string, unknown> = {
        isBanned: true,
        banReason: `IP封禁关联：${reason}`,
        bannedAt: new Date(),
      };

      if (duration && duration > 0) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + duration);
        accountUpdateData.banExpiresAt = expiresAt;
      }

      for (const visitorId of visitorIds) {
        await adminDB.updateOne('visitors', { id: visitorId } as never, {
          $set: accountUpdateData,
        });
        // 异步通知主服务清除缓存，不阻塞 IP 封禁接口响应
        void notifyVisitorCacheClear(visitorId);
      }
    }

    res.json({
      success: true,
      message: `IP ${ip} 已封禁，关联账号 ${visitorIds.length} 个`,
      data: { ip, bannedVisitors: visitorIds.length },
    });
  } catch (error) {
    console.error('封禁IP失败:', error);
    res.status(500).json({ success: false, error: '封禁IP失败' });
  }
});

export default router;
