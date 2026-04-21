import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { ChatAuditItem, SensitiveWordConfig, PaginationResult } from '../types';
import { ipWhitelist } from '../middleware/ipWhitelist';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

/**
 * 获取敏感词配置
 */
router.get('/config', ipWhitelist, requireAuth, async (_req: Request, res: Response) => {
  try {
    let config = await adminDB.findOne<SensitiveWordConfig>('admin_configs', {});
    if (!config) {
      config = {
        enabled: true,
        words: [],
        matchMode: 'exact',
        autoFlag: true,
      };
    }
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('获取敏感词配置失败:', error);
    res.status(500).json({ success: false, error: '获取配置失败' });
  }
});

/**
 * 更新敏感词配置
 */
router.put('/config', ipWhitelist, requireAuth, auditLog('UPDATE_SENSITIVE_WORDS', 'config'), async (req: Request, res: Response) => {
  try {
    const { enabled, words, matchMode, autoFlag } = req.body;

    const adminConfig = await adminDB.findOne('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    await adminDB.updateOne('admin_configs', { _id: adminConfig._id } as never, {
      $set: {
        'features.sensitiveWordCheck': enabled,
        sensitiveWords: words || [],
        sensitiveWordMatchMode: matchMode || 'exact',
        sensitiveWordAutoFlag: autoFlag !== false,
      },
    });

    res.json({ success: true, message: '敏感词配置已更新' });
  } catch (error) {
    console.error('更新敏感词配置失败:', error);
    res.status(500).json({ success: false, error: '更新配置失败' });
  }
});

/**
 * 获取消息审计列表
 */
router.get('/messages', ipWhitelist, requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const riskLevel = req.query.riskLevel as string;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (riskLevel) {
      filter['auditResult.riskLevel'] = riskLevel;
    }
    if (status) {
      filter['auditResult.status'] = status;
    }

    const items = await adminDB.find('chat_audits', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('chat_audits', filter as never);

    const result: PaginationResult<ChatAuditItem> = {
      items: items as unknown as ChatAuditItem[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取审计列表失败:', error);
    res.status(500).json({ success: false, error: '获取审计列表失败' });
  }
});

/**
 * 扫描消息（手动触发敏感词检测）
 */
router.post('/scan', ipWhitelist, requireAuth, auditLog('SCAN_MESSAGES', 'audit'), async (req: Request, res: Response) => {
  try {
    const { startTime, endTime } = req.body;

    const adminConfig = await adminDB.findOne('admin_configs', {});
    const sensitiveWords: string[] = (adminConfig as Record<string, unknown>)?.sensitiveWords as string[] || [];

    if (sensitiveWords.length === 0) {
      res.json({ success: true, message: '未配置敏感词，跳过扫描', scanned: 0, flagged: 0 });
      return;
    }

    const filter: Record<string, unknown> = {};
    if (startTime || endTime) {
      filter.createdAt = {};
      if (startTime) (filter.createdAt as Record<string, unknown>).$gte = new Date(startTime);
      if (endTime) (filter.createdAt as Record<string, unknown>).$lte = new Date(endTime);
    }

    const conversations = await adminDB.find('conversations', filter as never, { limit: 1000 });

    let scanned = 0;
    let flagged = 0;

    for (const conv of conversations) {
      const messages = (conv as Record<string, unknown>).messages as Array<Record<string, unknown>> || [];
      for (const msg of messages) {
        if ((msg.role as string) !== 'user') continue;
        scanned++;

        const content = (msg.content as string) || '';
        const matchedWords = sensitiveWords.filter((word) => content.includes(word));

        if (matchedWords.length > 0) {
          flagged++;
          const riskLevel = matchedWords.length >= 3 ? 'high' : matchedWords.length >= 2 ? 'medium' : 'low';

          await adminDB.insertOne('chat_audits', {
            messageId: msg._id,
            workspaceId: (conv as Record<string, unknown>).workspaceId,
            sender: {
              id: (conv as Record<string, unknown>).createdBy || 'unknown',
              nickname: 'unknown',
            },
            content: content.substring(0, 500),
            createdAt: msg.timestamp || new Date(),
            auditResult: {
              scannedAt: new Date(),
              hasSensitiveWord: true,
              matchedWords,
              riskLevel,
              status: 'pending',
            },
          });
        }
      }
    }

    res.json({ success: true, scanned, flagged });
  } catch (error) {
    console.error('扫描消息失败:', error);
    res.status(500).json({ success: false, error: '扫描消息失败' });
  }
});

/**
 * 标记消息为安全
 */
router.post('/:id/mark-safe', ipWhitelist, requireAuth, auditLog('MARK_SAFE', 'audit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminReq = req as Request & { adminNickname?: string; adminIp?: string };

    const success = await adminDB.updateOne('chat_audits', { _id: id } as never, {
      $set: {
        'auditResult.status': 'safe',
        action: {
          adminNickname: adminReq.adminNickname || 'unknown',
          adminIp: adminReq.adminIp || 'unknown',
          action: 'mark_safe',
          reason,
          timestamp: new Date(),
        },
      },
    });

    if (!success) {
      res.status(404).json({ success: false, error: '审计记录不存在' });
      return;
    }

    res.json({ success: true, message: '已标记为安全' });
  } catch (error) {
    console.error('标记安全失败:', error);
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

/**
 * 删除审计消息
 */
router.delete('/:id/message', ipWhitelist, requireAuth, auditLog('DELETE_AUDIT_MESSAGE', 'audit'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminReq = req as Request & { adminNickname?: string; adminIp?: string };

    const audit = await adminDB.findOne('chat_audits', { _id: id } as never);
    if (!audit) {
      res.status(404).json({ success: false, error: '审计记录不存在' });
      return;
    }

    await adminDB.updateOne('chat_audits', { _id: id } as never, {
      $set: {
        'auditResult.status': 'deleted',
        action: {
          adminNickname: adminReq.adminNickname || 'unknown',
          adminIp: adminReq.adminIp || 'unknown',
          action: 'delete',
          reason,
          timestamp: new Date(),
        },
      },
    });

    res.json({ success: true, message: '消息已删除' });
  } catch (error) {
    console.error('删除消息失败:', error);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

export default router;
