import { Router, Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { adminDB } from '../config/database';
import { config } from '../config';
import { AdminConfig, AdminIP, GrayRule, AIProvider } from '../types';
import { getClientIp } from '../middleware/ipWhitelist';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { notifySensitiveWordCacheClear } from '../services/cacheNotify';

const router = Router();

/**
 * 获取IP白名单列表
 */
router.get('/ip-whitelist', requireAuth, async (req: Request, res: Response) => {
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
router.post('/ip-whitelist', requireAuth, auditLog('ADD_IP_WHITELIST', 'settings'), async (req: Request, res: Response) => {
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
router.delete('/ip-whitelist/:ip', requireAuth, auditLog('REMOVE_IP_WHITELIST', 'settings'), async (req: Request, res: Response) => {
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
router.post('/password', requireAuth, auditLog('CHANGE_PASSWORD', 'settings'), async (req: Request, res: Response) => {
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
router.get('/features', requireAuth, async (_req: Request, res: Response) => {
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
 * 支持保存灰度规则配置
 */
router.put('/features', requireAuth, auditLog('UPDATE_FEATURES', 'settings'), async (req: Request, res: Response) => {
  try {
    const { sensitiveWordCheck, auditLog, dataExport, grayRules } = req.body;

    const adminConfig = await adminDB.findOne('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    const updateFields: Record<string, unknown> = {
      'features.sensitiveWordCheck': sensitiveWordCheck,
      'features.auditLog': auditLog,
      'features.dataExport': dataExport,
      sensitiveWordEnabled: sensitiveWordCheck,
    };

    if (grayRules !== undefined) {
      updateFields['features.grayRules'] = grayRules;
    }

    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $set: updateFields,
    });

    if (sensitiveWordCheck !== undefined) {
      await notifySensitiveWordCacheClear();
    }

    res.json({ success: true, message: '功能开关已更新' });
  } catch (error) {
    console.error('更新功能开关失败:', error);
    res.status(500).json({ success: false, error: '更新功能开关失败' });
  }
});

/**
 * 根据灰度规则评估指定功能对特定用户的可见性
 * @param key - 功能开关的键名
 * @param userId - 用户ID（查询参数）
 * @param ip - 用户IP地址（查询参数）
 * @param workspaceId - 工作区ID（查询参数）
 * @returns 该功能对该用户是否可见
 */
router.get('/features/:key/evaluate', requireAuth, async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const userId = req.query.userId as string | undefined;
    const ip = req.query.ip as string | undefined;
    const workspaceId = req.query.workspaceId as string | undefined;

    const adminConfig = await adminDB.findOne<AdminConfig>('admin_configs', {});
    if (!adminConfig) {
      res.json({ success: true, data: { key, visible: true, reason: 'default' } });
      return;
    }

    const features = adminConfig.features;
    const featureValue = features[key as keyof typeof features];

    if (typeof featureValue === 'undefined') {
      res.status(404).json({ success: false, error: `功能开关 "${key}" 不存在` });
      return;
    }

    const globalEnabled = Boolean(featureValue);

    const grayRules = features.grayRules?.[key];
    if (!grayRules || grayRules.length === 0) {
      res.json({ success: true, data: { key, visible: globalEnabled, reason: 'global' } });
      return;
    }

    const matched = evaluateGrayRules(grayRules, { userId, ip, workspaceId });
    res.json({
      success: true,
      data: {
        key,
        visible: matched,
        reason: matched ? 'gray_rule_matched' : 'gray_rule_not_matched',
      },
    });
  } catch (error) {
    console.error('评估灰度规则失败:', error);
    res.status(500).json({ success: false, error: '评估灰度规则失败' });
  }
});

/**
 * 根据灰度规则列表评估是否匹配
 * 规则为"或"关系：任一规则匹配即视为可见
 * @param rules - 灰度规则列表
 * @param context - 评估上下文，包含用户ID、IP、工作区ID
 * @returns 是否匹配灰度规则
 */
function evaluateGrayRules(
  rules: GrayRule[],
  context: { userId?: string; ip?: string; workspaceId?: string }
): boolean {
  for (const rule of rules) {
    const targetValue = context[rule.field];
    if (targetValue === undefined || targetValue === null) {
      continue;
    }

    if (matchRule(targetValue, rule)) {
      return true;
    }
  }
  return false;
}

/**
 * 根据单条灰度规则匹配目标值
 * @param targetValue - 请求中对应的字段值
 * @param rule - 灰度规则
 * @returns 是否匹配
 */
function matchRule(targetValue: string, rule: GrayRule): boolean {
  try {
    switch (rule.match) {
      case 'equals':
        return targetValue === rule.value;
      case 'contains':
        return targetValue.includes(rule.value);
      case 'startsWith':
        return targetValue.startsWith(rule.value);
      case 'regex':
        return new RegExp(rule.value).test(targetValue);
      default:
        return false;
    }
  } catch (error) {
    console.error('灰度规则匹配异常:', error);
    return false;
  }
}

/**
 * 获取 AI 服务商配置列表
 * 从 admin_configs 集合读取 aiProviders 字段，未配置时返回空数组
 */
router.get('/ai-providers', requireAuth, async (_req: Request, res: Response) => {
  try {
    const adminConfig = await adminDB.findOne<AdminConfig & { aiProviders?: AIProvider[] }>('admin_configs', {});
    const aiProviders = adminConfig?.aiProviders || [];
    res.json({ success: true, data: aiProviders });
  } catch (error) {
    console.error('获取 AI 服务商配置失败:', error);
    res.status(500).json({ success: false, error: '获取 AI 服务商配置失败' });
  }
});

/**
 * 保存 AI 服务商配置
 * 将服务商配置列表保存到 admin_configs 集合的 aiProviders 字段
 * 保存前校验每个 provider 的必填字段（id、name、url、apiKey、model）
 */
router.put('/ai-providers', requireAuth, auditLog('UPDATE_AI_PROVIDERS', 'settings'), async (req: Request, res: Response) => {
  try {
    const providers = req.body as AIProvider[];

    if (!Array.isArray(providers)) {
      res.status(400).json({ success: false, error: '请求数据必须是数组格式' });
      return;
    }

    for (const provider of providers) {
      if (!provider.id || !provider.name || !provider.url || !provider.apiKey || !provider.model) {
        res.status(400).json({
          success: false,
          error: `服务商 "${provider.name || provider.id || '未知'}" 缺少必填字段（id、name、url、apiKey、model）`,
        });
        return;
      }
      if (typeof provider.priority !== 'number') {
        res.status(400).json({
          success: false,
          error: `服务商 "${provider.name}" 的 priority 必须为数字`,
        });
        return;
      }
    }

    const idSet = new Set<string>();
    for (const provider of providers) {
      if (idSet.has(provider.id)) {
        res.status(400).json({
          success: false,
          error: `服务商 ID "${provider.id}" 重复，每个服务商的 ID 必须唯一`,
        });
        return;
      }
      idSet.add(provider.id);
    }

    const adminConfig = await adminDB.findOne('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $set: { aiProviders: providers },
    });

    res.json({ success: true, message: 'AI 服务商配置已保存' });
  } catch (error) {
    console.error('保存 AI 服务商配置失败:', error);
    res.status(500).json({ success: false, error: '保存 AI 服务商配置失败' });
  }
});

export default router;
