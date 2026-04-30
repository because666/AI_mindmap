import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { IpBanListItem, PaginationResult } from '../types';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { sanitizePagination } from '../utils/validators';

const router = Router();

/**
 * 获取IP封禁列表
 * 支持分页和搜索
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit, 20);
    const search = req.query.search as string;

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.ip = { $regex: search, $options: 'i' };
    }

    const bans = await adminDB.find('ip_bans', filter as never, {
      sort: { bannedAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('ip_bans', filter as never);

    const items: IpBanListItem[] = bans.map((ban: Record<string, unknown>) => {
      const visitorIds = (ban.visitorIds as string[]) || [];
      return {
        _id: (ban._id as { toString(): string }).toString(),
        ip: ban.ip as string,
        reason: ban.reason as string,
        bannedAt: ban.bannedAt as string,
        banExpiresAt: ban.banExpiresAt as string | undefined,
        bannedBy: ban.bannedBy as string,
        visitorIds,
        autoBanAccounts: (ban.autoBanAccounts as boolean) || false,
        associatedVisitorCount: visitorIds.length,
      };
    });

    const result: PaginationResult<IpBanListItem> = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取IP封禁列表失败:', error);
    res.status(500).json({ success: false, error: '获取IP封禁列表失败' });
  }
});

/**
 * 获取IP封禁详情（包含关联访客列表）
 */
router.get('/:ip', requireAuth, async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;

    const ban = await adminDB.findOne('ip_bans', { ip } as never);
    if (!ban) {
      res.status(404).json({ success: false, error: 'IP封禁记录不存在' });
      return;
    }

    const visitorIds = (ban.visitorIds as string[]) || [];
    const visitors = await adminDB.find('visitors', {
      id: { $in: visitorIds },
    } as never);

    const visitorDetails = visitors.map((v: Record<string, unknown>) => ({
      id: v.id as string,
      nickname: (v.nickname as string) || '未知用户',
      isBanned: (v.isBanned as boolean) || false,
      banReason: v.banReason as string | undefined,
      lastSeen: v.lastSeen as string,
    }));

    res.json({
      success: true,
      data: {
        ip: ban.ip,
        reason: ban.reason,
        bannedAt: ban.bannedAt,
        banExpiresAt: ban.banExpiresAt,
        bannedBy: ban.bannedBy,
        autoBanAccounts: ban.autoBanAccounts,
        visitors: visitorDetails,
      },
    });
  } catch (error) {
    console.error('获取IP封禁详情失败:', error);
    res.status(500).json({ success: false, error: '获取IP封禁详情失败' });
  }
});

/**
 * 解封IP地址
 * 仅删除IP封禁记录，不自动解封关联账号
 */
router.post('/:ip/unban', requireAuth, auditLog('UNBAN_IP', 'ip'), async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;
    const { reason } = req.body;

    const ban = await adminDB.findOne('ip_bans', { ip } as never);
    if (!ban) {
      res.status(404).json({ success: false, error: 'IP封禁记录不存在' });
      return;
    }

    await adminDB.deleteOne('ip_bans', { ip } as never);

    res.json({
      success: true,
      message: `IP ${ip} 已解封${reason ? `，原因：${reason}` : ''}。注意：关联账号未自动解封，如需解封请单独操作。`,
    });
  } catch (error) {
    console.error('解封IP失败:', error);
    res.status(500).json({ success: false, error: '解封IP失败' });
  }
});

export default router;
