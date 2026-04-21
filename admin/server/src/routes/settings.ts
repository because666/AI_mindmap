import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { adminDB } from '../config/database';
import { config } from '../config';
import { AdminIP, AdminConfig } from '../types';
import { ipWhitelist, getClientIp } from '../middleware/ipWhitelist';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

/**
 * 获取IP白名单列表
 */
router.get('/ip-whitelist', ipWhitelist, requireAuth, async (req: Request, res: Response) => {
  try {
    const currentIp = getClientIp(req);
    const whitelist = await adminDB.find('admin_ips', { isActive: true } as never, {
      sort: { createdAt: 1 },
    });

    res.json({
      success: true,
      data: {
        whitelist,
        currentIp,
      },
    });
  } catch (error) {
    console.error('获取IP白名单失败:', error);
    res.status(500).json({ success: false, error: '获取IP白名单失败' });
  }
});

/**
 * 添加IP到白名单
 */
router.post('/ip-whitelist', ipWhitelist, requireAuth, auditLog('ADD_IP_WHITELIST', 'settings'), async (req: Request, res: Response) => {
  try {
    const { ipAddress, nickname, description } = req.body;

    if (!ipAddress || !nickname) {
      res.status(400).json({ success: false, error: '请提供IP地址和昵称' });
      return;
    }

    const existing = await adminDB.findOne<AdminIP>('admin_ips', {
      ipAddress,
      isActive: true,
    } as never);

    if (existing) {
      res.status(400).json({ success: false, error: '该IP已在白名单中' });
      return;
    }

    await adminDB.insertOne('admin_ips', {
      ipAddress,
      nickname,
      description,
      isFirstAdmin: false,
      createdAt: new Date(),
      createdBy: getClientIp(req),
      loginCount: 0,
      isActive: true,
    });

    res.json({ success: true, message: 'IP已添加到白名单' });
  } catch (error) {
    console.error('添加IP白名单失败:', error);
    res.status(500).json({ success: false, error: '添加IP白名单失败' });
  }
});

/**
 * 从白名单删除IP
 */
router.delete('/ip-whitelist/:ip', ipWhitelist, requireAuth, auditLog('REMOVE_IP_WHITELIST', 'settings'), async (req: Request, res: Response) => {
  try {
    const { ip } = req.params;
    const { confirm } = req.body;
    const currentIp = getClientIp(req);

    if (ip === currentIp && !confirm) {
      res.status(400).json({
        success: false,
        error: '不能删除自己的IP，如需删除请确认',
        needConfirm: true,
      });
      return;
    }

    const success = await adminDB.updateOne('admin_ips', { ipAddress: ip } as never, {
      $set: { isActive: false },
    });

    if (!success) {
      res.status(404).json({ success: false, error: 'IP不存在' });
      return;
    }

    res.json({ success: true, message: 'IP已从白名单移除' });
  } catch (error) {
    console.error('删除IP白名单失败:', error);
    res.status(500).json({ success: false, error: '删除IP白名单失败' });
  }
});

/**
 * 修改密码
 */
router.post('/password', ipWhitelist, requireAuth, auditLog('CHANGE_PASSWORD', 'settings'), async (req: Request, res: Response) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      res.status(400).json({ success: false, error: '请填写所有密码字段' });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ success: false, error: '新密码与确认密码不一致' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, error: '新密码长度不能少于6位' });
      return;
    }

    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    const passwordMatch = await bcryptjs.compare(oldPassword, adminConfig.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ success: false, error: '原密码错误' });
      return;
    }

    const newPasswordHash = await bcryptjs.hash(newPassword, config.security.bcryptRounds);
    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $set: {
        passwordHash: newPasswordHash,
        passwordUpdatedAt: new Date(),
      },
    });

    res.json({ success: true, message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码失败:', error);
    res.status(500).json({ success: false, error: '修改密码失败' });
  }
});

/**
 * 获取功能开关
 */
router.get('/features', ipWhitelist, requireAuth, async (_req: Request, res: Response) => {
  try {
    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    if (!adminConfig) {
      res.json({
        success: true,
        data: {
          sensitiveWordCheck: true,
          auditLog: true,
          dataExport: true,
        },
      });
      return;
    }

    res.json({ success: true, data: adminConfig.features });
  } catch (error) {
    console.error('获取功能开关失败:', error);
    res.status(500).json({ success: false, error: '获取功能开关失败' });
  }
});

/**
 * 更新功能开关
 */
router.put('/features', ipWhitelist, requireAuth, auditLog('UPDATE_FEATURES', 'settings'), async (req: Request, res: Response) => {
  try {
    const { sensitiveWordCheck, auditLog, dataExport } = req.body;

    const adminConfig = await adminDB.findOne('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $set: {
        'features.sensitiveWordCheck': sensitiveWordCheck,
        'features.auditLog': auditLog,
        'features.dataExport': dataExport,
      },
    });

    res.json({ success: true, message: '功能开关已更新' });
  } catch (error) {
    console.error('更新功能开关失败:', error);
    res.status(500).json({ success: false, error: '更新功能开关失败' });
  }
});

export default router;
