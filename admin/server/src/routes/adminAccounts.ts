import { Router, Request, Response } from 'express';
import { adminAccountService } from '../services/adminAccountService';
import { requireAuth, requireRole } from '../middleware/auth';
import { AdminRole } from '../types';

const router = Router();

/**
 * 合法的角色值列表
 */
const VALID_ROLES: AdminRole[] = ['super_admin', 'operator', 'auditor', 'readonly'];

/**
 * 角色显示名称映射
 */
const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: '超级管理员',
  operator: '运营管理员',
  auditor: '审计员',
  readonly: '只读用户',
};

/**
 * GET /
 * 获取管理员账户分页列表
 * 查询参数：page、limit
 * 需要登录认证
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));

    const result = await adminAccountService.listAccounts(page, limit);

    const items = result.items.map((item) => ({
      _id: (item._id as { toString(): string }).toString(),
      username: item.username,
      nickname: item.nickname,
      role: item.role,
      roleLabel: ROLE_LABELS[item.role],
      isActive: item.isActive,
      createdAt: item.createdAt,
      lastLoginAt: item.lastLoginAt || null,
      createdByIp: item.createdByIp || null,
    }));

    res.json({
      success: true,
      data: {
        items,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    console.error('获取管理员列表失败:', error);
    res.status(500).json({ success: false, error: '获取管理员列表失败' });
  }
});

/**
 * POST /
 * 创建管理员账户
 * 请求体：{ username, password, nickname, role }
 * 仅超级管理员可操作
 */
router.post('/', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { username, password, nickname, role } = req.body as {
      username?: string;
      password?: string;
      nickname?: string;
      role?: string;
    };

    if (!username || !password || !nickname || !role) {
      res.status(400).json({ success: false, error: '用户名、密码、昵称、角色均为必填项' });
      return;
    }

    if (username.length < 3 || username.length > 30) {
      res.status(400).json({ success: false, error: '用户名长度应为3-30个字符' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码长度不能少于6位' });
      return;
    }

    if (nickname.trim().length < 2 || nickname.trim().length > 20) {
      res.status(400).json({ success: false, error: '昵称长度应为2-20个字符' });
      return;
    }

    if (!VALID_ROLES.includes(role as AdminRole)) {
      res.status(400).json({ success: false, error: `无效的角色值，必须为：${VALID_ROLES.join('/')}` });
      return;
    }

    const creatorIp = (req as unknown as Record<string, unknown>).adminIp as string || 'unknown';

    const id = await adminAccountService.createAccount(
      username,
      password,
      nickname.trim(),
      role as AdminRole,
      creatorIp
    );

    if (!id) {
      res.status(409).json({ success: false, error: '用户名已存在' });
      return;
    }

    res.json({
      success: true,
      data: { id },
      message: '管理员创建成功',
    });
  } catch (error) {
    console.error('创建管理员失败:', error);
    res.status(500).json({ success: false, error: '创建管理员失败' });
  }
});

/**
 * PUT /:id
 * 更新管理员账户信息（昵称/角色/启用状态）
 * 请求体：{ nickname?, role?, isActive? }
 * 仅超级管理员可操作
 */
router.put('/:id', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nickname, role, isActive } = req.body as {
      nickname?: string;
      role?: string;
      isActive?: boolean;
    };

    if (!id) {
      res.status(400).json({ success: false, error: '缺少管理员ID' });
      return;
    }

    const updates: { nickname?: string; role?: AdminRole; isActive?: boolean } = {};

    if (nickname !== undefined) {
      if (nickname.trim().length < 2 || nickname.trim().length > 20) {
        res.status(400).json({ success: false, error: '昵称长度应为2-20个字符' });
        return;
      }
      updates.nickname = nickname.trim();
    }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role as AdminRole)) {
        res.status(400).json({ success: false, error: `无效的角色值，必须为：${VALID_ROLES.join('/')}` });
        return;
      }
      updates.role = role as AdminRole;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        res.status(400).json({ success: false, error: 'isActive 必须为布尔值' });
        return;
      }
      updates.isActive = isActive;
    }

    const success = await adminAccountService.updateAccount(id, updates);

    if (!success) {
      res.status(404).json({ success: false, error: '管理员不存在或无更新内容' });
      return;
    }

    res.json({ success: true, message: '管理员信息已更新' });
  } catch (error) {
    console.error('更新管理员失败:', error);
    res.status(500).json({ success: false, error: '更新管理员失败' });
  }
});

/**
 * DELETE /:id
 * 软删除管理员账户（设 isActive=false）
 * 不能删除自己
 * 仅超级管理员可操作
 */
router.delete('/:id', requireAuth, requireRole('super_admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ success: false, error: '缺少管理员ID' });
      return;
    }

    const currentNickname = (req as unknown as Record<string, unknown>).adminNickname as string;
    const account = await adminAccountService.getAccountByUsername(currentNickname);
    if (account && (account._id as { toString(): string }).toString() === id) {
      res.status(400).json({ success: false, error: '不能删除自己的账户' });
      return;
    }

    const success = await adminAccountService.deleteAccount(id);

    if (!success) {
      res.status(404).json({ success: false, error: '管理员不存在' });
      return;
    }

    res.json({ success: true, message: '管理员已删除' });
  } catch (error) {
    console.error('删除管理员失败:', error);
    res.status(500).json({ success: false, error: '删除管理员失败' });
  }
});

export default router;
