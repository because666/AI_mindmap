import { Router, Request, Response } from 'express';
import { adminDB } from '../config/database';
import { ChatAuditItem, SensitiveWordConfig, PaginationResult } from '../types';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { sanitizePagination } from '../utils/validators';
import { notifySensitiveWordCacheClear } from '../services/cacheNotify';

const router = Router();

/**
 * 获取敏感词配置
 * 从 admin_configs 中提取敏感词相关字段，统一返回格式
 */
router.get('/config', requireAuth, async (_req: Request, res: Response) => {
  try {
    const adminConfig = await adminDB.findOne('admin_configs', {}) as Record<string, unknown> | null;

    if (!adminConfig) {
      const defaultConfig: SensitiveWordConfig = {
        enabled: true,
        words: [],
        matchMode: 'exact',
        autoFlag: true,
      };
      res.json({ success: true, data: defaultConfig });
      return;
    }

    const features = adminConfig.features as Record<string, unknown> | undefined;
    const config: SensitiveWordConfig = {
      enabled: (adminConfig.sensitiveWordEnabled as boolean) ?? (features?.sensitiveWordCheck as boolean) ?? true,
      words: (adminConfig.sensitiveWords as string[]) || [],
      matchMode: (adminConfig.sensitiveWordMatchMode as 'exact' | 'fuzzy') || 'exact',
      autoFlag: (adminConfig.sensitiveWordAutoFlag as boolean) ?? true,
    };

    res.json({ success: true, data: config });
  } catch (error) {
    console.error('获取敏感词配置失败:', error);
    res.status(500).json({ success: false, error: '获取配置失败' });
  }
});

/**
 * 更新敏感词配置
 * 将前端字段映射到数据库字段，确保读写一致
 */
router.put('/config', requireAuth, auditLog('UPDATE_SENSITIVE_WORDS', 'config'), async (req: Request, res: Response) => {
  try {
    const { enabled, words, matchMode, autoFlag } = req.body;

    const adminConfig = await adminDB.findOne('admin_configs', {});
    if (!adminConfig) {
      res.status(400).json({ success: false, error: '系统未初始化' });
      return;
    }

    await adminDB.updateOne('admin_configs', { _id: (adminConfig as Record<string, unknown>)._id } as never, {
      $set: {
        sensitiveWordEnabled: enabled ?? true,
        sensitiveWords: words || [],
        sensitiveWordMatchMode: matchMode || 'exact',
        sensitiveWordAutoFlag: autoFlag !== false,
      },
    });

    await notifySensitiveWordCacheClear();

    res.json({ success: true, message: '敏感词配置已更新' });
  } catch (error) {
    console.error('更新敏感词配置失败:', error);
    res.status(500).json({ success: false, error: '更新配置失败' });
  }
});

/**
 * 获取消息审计列表
 */
router.get('/messages', requireAuth, async (req: Request, res: Response) => {
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
router.post('/scan', requireAuth, auditLog('SCAN_MESSAGES', 'audit'), async (req: Request, res: Response) => {
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
router.post('/:id/mark-safe', requireAuth, auditLog('MARK_SAFE', 'audit'), async (req: Request, res: Response) => {
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
router.delete('/:id/message', requireAuth, auditLog('DELETE_AUDIT_MESSAGE', 'audit'), async (req: Request, res: Response) => {
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

/**
 * 获取对话列表
 * 查看主应用中所有对话记录，用于内容审核
 */
router.get('/conversations', requireAuth, async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = sanitizePagination(req.query.page, req.query.limit, 50);
    const search = req.query.search as string;
    const workspaceId = req.query.workspaceId as string;

    const filter: Record<string, unknown> = {};
    if (workspaceId) {
      filter.workspaceId = workspaceId;
    }
    if (search) {
      filter.$or = [
        { 'messages.content': { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    const conversations = await adminDB.find('conversations', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('conversations', filter as never);

    const items = conversations.map((conv: Record<string, unknown>) => {
      const messages = (conv.messages as Array<Record<string, unknown>>) || [];
      const userMessages = messages.filter((m) => m.role === 'user');
      const assistantMessages = messages.filter((m) => m.role === 'assistant');
      return {
        _id: (conv._id as { toString(): string }).toString(),
        id: conv.id as string,
        title: conv.title as string || '未命名对话',
        workspaceId: conv.workspaceId as string,
        createdBy: conv.createdBy as string,
        createdAt: conv.createdAt as string,
        updatedAt: conv.updatedAt as string,
        messageCount: messages.length,
        userMessageCount: userMessages.length,
        assistantMessageCount: assistantMessages.length,
        lastMessage: messages.length > 0
          ? (messages[messages.length - 1].content as string || '').substring(0, 100)
          : '',
      };
    });

    const result: PaginationResult<unknown> = {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取对话列表失败:', error);
    res.status(500).json({ success: false, error: '获取对话列表失败' });
  }
});

/**
 * 获取对话详情
 * 查看指定对话的完整消息记录，用于内容审核
 */
router.get('/conversations/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    let conversation: Record<string, unknown> | null = null;

    if (/^[0-9a-fA-F]{24}$/.test(id)) {
      conversation = await adminDB.findOne('conversations', { _id: id } as never) as Record<string, unknown> | null;
    }
    if (!conversation) {
      conversation = await adminDB.findOne('conversations', { id } as never) as Record<string, unknown> | null;
    }

    if (!conversation) {
      res.status(404).json({ success: false, error: '对话不存在' });
      return;
    }

    const messages = (conversation.messages as Array<Record<string, unknown>>) || [];

    res.json({
      success: true,
      data: {
        _id: (conversation._id as { toString(): string }).toString(),
        id: conversation.id,
        title: conversation.title || '未命名对话',
        workspaceId: conversation.workspaceId,
        createdBy: conversation.createdBy,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: messages.map((msg) => ({
          role: msg.role as string,
          content: msg.content as string,
          timestamp: msg.timestamp as string,
        })),
      },
    });
  } catch (error) {
    console.error('获取对话详情失败:', error);
    res.status(500).json({ success: false, error: '获取对话详情失败' });
  }
});

/**
 * 删除对话中的指定消息
 * 用于移除不安全内容
 */
router.delete('/conversations/:convId/messages/:msgIndex', requireAuth, auditLog('DELETE_MESSAGE', 'chat'), async (req: Request, res: Response) => {
  try {
    const { convId, msgIndex } = req.params;
    const index = parseInt(msgIndex, 10);

    if (isNaN(index) || index < 0) {
      res.status(400).json({ success: false, error: '无效的消息索引' });
      return;
    }

    let conversation: Record<string, unknown> | null = null;

    if (/^[0-9a-fA-F]{24}$/.test(convId)) {
      conversation = await adminDB.findOne('conversations', { _id: convId } as never) as Record<string, unknown> | null;
    }
    if (!conversation) {
      conversation = await adminDB.findOne('conversations', { id: convId } as never) as Record<string, unknown> | null;
    }

    if (!conversation) {
      res.status(404).json({ success: false, error: '对话不存在' });
      return;
    }

    const messages = (conversation.messages as Array<Record<string, unknown>>) || [];
    if (index >= messages.length) {
      res.status(400).json({ success: false, error: '消息索引超出范围' });
      return;
    }

    const deletedContent = (messages[index].content as string || '').substring(0, 100);
    messages.splice(index, 1);

    await adminDB.updateOne('conversations', { _id: conversation._id } as never, {
      $set: { messages },
    });

    res.json({ success: true, message: '消息已删除', deletedContentPreview: deletedContent });
  } catch (error) {
    console.error('删除消息失败:', error);
    res.status(500).json({ success: false, error: '删除消息失败' });
  }
});

export default router;
