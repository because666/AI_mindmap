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
 * messages 集合文档结构
 * 主应用已将对话消息从 conversations 内嵌数组迁移至独立的 messages 集合
 */
interface MessageDocument {
  /** 消息 UUID */
  id: string;
  /** 所属对话 ID */
  conversationId: string;
  /** 所属节点 ID */
  nodeId?: string;
  /** 所属工作区 ID */
  workspaceId?: string;
  /** 消息角色 */
  role: 'user' | 'assistant' | 'system';
  /** 消息文本内容 */
  content: string;
  /** 消息时间戳 */
  timestamp: Date;
}

/**
 * 扫描消息（手动触发敏感词检测）
 * 迁移后从 messages 集合查询 role='user' 的消息进行敏感词匹配
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

    // 仅扫描用户消息，支持按时间范围过滤
    const messageFilter: Record<string, unknown> = { role: 'user' };
    if (startTime || endTime) {
      messageFilter.timestamp = {};
      if (startTime) (messageFilter.timestamp as Record<string, unknown>).$gte = new Date(startTime);
      if (endTime) (messageFilter.timestamp as Record<string, unknown>).$lte = new Date(endTime);
    }

    // 从 messages 集合查询用户消息，按时间倒序限制 1000 条避免全表扫描
    const messages = await adminDB.find<MessageDocument>('messages', messageFilter as never, {
      sort: { timestamp: -1 },
      limit: 1000,
    });

    let scanned = 0;
    let flagged = 0;

    for (const msg of messages) {
      scanned++;

      const content = msg.content || '';
      const matchedWords = sensitiveWords.filter((word) => content.includes(word));

      if (matchedWords.length > 0) {
        flagged++;
        const riskLevel: 'low' | 'medium' | 'high' =
          matchedWords.length >= 3 ? 'high' : matchedWords.length >= 2 ? 'medium' : 'low';

        // 命中敏感词时写入 chat_audits 集合
        // messages 集合没有 createdBy 字段，使用 conversationId 作为 sender.id
        await adminDB.insertOne('chat_audits', {
          messageId: msg.id,
          workspaceId: msg.workspaceId,
          sender: {
            id: msg.conversationId || 'unknown',
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
 * 迁移后消息存储于独立的 messages 集合，需通过 conversationId 关联查询统计
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
    // 消息已迁移至独立 messages 集合，原 messages.content 内嵌查询失效，仅保留 title 搜索
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
      ];
    }

    const conversations = await adminDB.find('conversations', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('conversations', filter as never);

    // 对每条对话，并行查询 messages 集合统计消息数与最后一条消息预览
    const items = await Promise.all(conversations.map(async (conv: Record<string, unknown>) => {
      const convId = conv.id as string;

      const [messageCount, userMessageCount, assistantMessageCount, lastMessages] = await Promise.all([
        adminDB.countDocuments('messages', { conversationId: convId } as never),
        adminDB.countDocuments('messages', { conversationId: convId, role: 'user' } as never),
        adminDB.countDocuments('messages', { conversationId: convId, role: 'assistant' } as never),
        adminDB.find<MessageDocument>('messages', { conversationId: convId } as never, {
          sort: { timestamp: -1 },
          limit: 1,
        }),
      ]);

      const lastMessage = lastMessages.length > 0
        ? (lastMessages[0].content || '').substring(0, 100)
        : '';

      return {
        _id: (conv._id as { toString(): string }).toString(),
        id: convId,
        title: conv.title as string || '未命名对话',
        workspaceId: conv.workspaceId as string,
        createdBy: conv.createdBy as string,
        createdAt: conv.createdAt as string,
        updatedAt: conv.updatedAt as string,
        messageCount,
        userMessageCount,
        assistantMessageCount,
        lastMessage,
      };
    }));

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
 * 迁移后从独立的 messages 集合按 conversationId 查询消息列表，按时间升序排列
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

    // 从 messages 集合查询对话消息，按时间升序排列
    const messages = await adminDB.find<MessageDocument>('messages', { conversationId: conversation.id } as never, {
      sort: { timestamp: 1 },
    });

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
        // 返回 id 字段供前端调用删除接口使用
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
      },
    });
  } catch (error) {
    console.error('获取对话详情失败:', error);
    res.status(500).json({ success: false, error: '获取对话详情失败' });
  }
});

/**
 * 删除指定消息
 * 用于移除不安全内容
 * 迁移后消息存储于独立 messages 集合，按消息 id 删除（更 RESTful，不再依赖数组索引）
 * 删除同时同步将 chat_audits 集合中对应 messageId 的审计记录状态置为 deleted
 */
router.delete('/messages/:messageId', requireAuth, auditLog('DELETE_MESSAGE', 'chat'), async (req: Request, res: Response) => {
  try {
    const { messageId } = req.params;
    const { reason } = req.body;
    const adminReq = req as Request & { adminNickname?: string; adminIp?: string };

    if (!messageId) {
      res.status(400).json({ success: false, error: '消息ID不能为空' });
      return;
    }

    // 删除前先查询消息内容，用于返回预览
    const message = await adminDB.findOne<MessageDocument>('messages', { id: messageId } as never);
    if (!message) {
      res.status(404).json({ success: false, error: '消息不存在' });
      return;
    }

    const deletedContentPreview = (message.content || '').substring(0, 100);

    // 从 messages 集合按 id 字段删除该消息
    const deleted = await adminDB.deleteOne('messages', { id: messageId } as never);
    if (!deleted) {
      res.status(404).json({ success: false, error: '消息删除失败' });
      return;
    }

    // 同步更新 chat_audits 集合中对应 messageId 的审计记录状态为 deleted
    // 使用 updateMany 以覆盖重复扫描产生的多条审计记录
    await adminDB.updateMany('chat_audits', { messageId } as never, {
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

    res.json({ success: true, message: '消息已删除', deletedContentPreview });
  } catch (error) {
    console.error('删除消息失败:', error);
    res.status(500).json({ success: false, error: '删除消息失败' });
  }
});

export default router;
