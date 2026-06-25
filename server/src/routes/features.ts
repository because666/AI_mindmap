import { Router, Request, Response } from 'express';
import { mongoDBService } from '../data/mongodb/connection';
import { getClientIp } from '../middleware';

const router = Router();

/**
 * 灰度规则字段类型
 */
type GrayRuleField = 'userId' | 'ip' | 'workspaceId';

/**
 * 灰度规则匹配方式类型
 */
type GrayRuleMatch = 'equals' | 'contains' | 'startsWith' | 'regex';

/**
 * 灰度规则接口
 */
interface GrayRule {
  field: GrayRuleField;
  match: GrayRuleMatch;
  value: string;
}

/**
 * 功能开关集合接口（与 admin 端 AdminFeatures 对应）
 */
interface AdminFeatures {
  sensitiveWordCheck: boolean;
  auditLog: boolean;
  dataExport: boolean;
  grayRules?: Record<string, GrayRule[]>;
}

/**
 * admin_configs 文档接口
 */
interface AdminConfig {
  _id: unknown;
  features: AdminFeatures;
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
 * 获取当前用户可见的功能开关列表
 * 从 admin_configs.features 读取功能开关配置
 * 根据请求者的 userId/IP/workspaceId 评估灰度规则
 * 返回 { [key: string]: boolean } 格式的功能可见性映射
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const visitorId = req.headers['x-visitor-id'] as string | undefined;
    const workspaceId = (req.headers['x-workspace-id'] as string | undefined)
      || req.query.workspaceId as string | undefined;
    const clientIp = getClientIp(req);

    const adminConfig = await mongoDBService.findOne<AdminConfig>('admin_configs', {});

    if (!adminConfig || !adminConfig.features) {
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

    const features = adminConfig.features;
    const context = {
      userId: visitorId,
      ip: clientIp,
      workspaceId,
    };

    const featureKeys = ['sensitiveWordCheck', 'auditLog', 'dataExport'] as const;
    const result: Record<string, boolean> = {};

    for (const key of featureKeys) {
      const globalEnabled = Boolean(features[key]);
      const rules = features.grayRules?.[key];

      if (!rules || rules.length === 0) {
        result[key] = globalEnabled;
      } else {
        const matched = evaluateGrayRules(rules, context);
        result[key] = matched;
      }
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取功能开关失败:', error);
    res.status(500).json({ success: false, error: '获取功能开关失败' });
  }
});

export default router;
