import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { UserListItem, PaginationResult } from '../types';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { escapeRegex, sanitizePagination } from '../utils/validators';
import { notifyVisitorCacheClear } from '../services/cacheNotify';

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
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit, 100);
    const status = req.query.status as string;
    const search = req.query.search as string;
    const rawSort = (req.query.sort as string) || 'createdAt';
    const sort = ALLOWED_SORT_FIELDS.includes(rawSort) ? rawSort : 'createdAt';

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

    const visitors = await adminDB.find('visitors', filter as never, {
      sort: { [sort]: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('visitors', filter as never);

    const items: UserListItem[] = visitors.map((v: Record<string, unknown>) => {
      const visitorId = v.id as string;
      const workspaceCount = (v.workspaces as string[])?.length || 0;

      return {
        _id: (v._id as { toString(): string }).toString(),
        id: visitorId,
        nickname: (v.nickname as string) || '未知用户',
        createdAt: v.createdAt as string,
        lastActiveAt: v.lastSeen as string,
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

    await notifyVisitorCacheClear(id);

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

    await notifyVisitorCacheClear(id);

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

    const items = visitors.map((v: Record<string, unknown>) => ({
      id: v.id as string,
      nickname: (v.nickname as string) || '未知用户',
      lastIp: v.lastIp as string | undefined,
      isBanned: (v.isBanned as boolean) || false,
      banReason: v.banReason as string | undefined,
      createdAt: v.createdAt as string,
      lastSeen: v.lastSeen as string,
    }));

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
        await notifyVisitorCacheClear(visitorId);
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
