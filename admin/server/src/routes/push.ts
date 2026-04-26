import { Router, Request, Response } from 'express';
import axios from 'axios';
import { adminDB } from '../config/database';
import { config } from '../config';
import { requireAuth } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';

const router = Router();

/**
 * 发送广播消息
 * 通过极光推送REST API发送
 */
router.post('/broadcast', requireAuth, auditLog('BROADCAST_PUSH', 'push'), async (req: Request, res: Response) => {
  try {
    const { title, content, targetType, targetUserIds, forceRead } = req.body;

    if (!title || !content) {
      res.status(400).json({ success: false, error: '请提供标题和内容' });
      return;
    }

    if (!config.jpush.appKey || !config.jpush.masterSecret) {
      res.status(500).json({ success: false, error: '极光推送未配置' });
      return;
    }

    const adminReq = req as Request & { adminNickname?: string };

    const pushMessage = {
      type: 'broadcast',
      title,
      content,
      summary: content.substring(0, 100),
      senderType: 'admin',
      senderName: adminReq.adminNickname || '管理员',
      targetType: targetType || 'all',
      targetUserIds: targetUserIds || [],
      createdAt: new Date(),
      sentAt: new Date(),
      expireAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      recipients: [],
      stats: { totalCount: 0, deliveredCount: 0, readCount: 0, readRate: 0 },
      forceRead: forceRead !== false,
      forceReadDeadline: forceRead !== false
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        : undefined,
    };

    const messageId = await adminDB.insertOne('push_messages', pushMessage);

    let pushSent = false;
    try {
      const jpushPayload = {
        platform: 'android',
        audience: targetType === 'specific_users' && targetUserIds?.length
          ? { registration_id: targetUserIds }
          : 'all',
        notification: {
          alert: title,
          android: {
            alert: title,
            title: 'DeepMindMap',
            extras: {
              messageId,
              type: 'broadcast',
              forceRead: pushMessage.forceRead,
            },
          },
        },
        options: {
          time_to_live: 86400,
        },
      };

      await axios.post('https://api.jpush.cn/v3/push', jpushPayload, {
        auth: {
          username: config.jpush.appKey,
          password: config.jpush.masterSecret,
        },
        headers: { 'Content-Type': 'application/json' },
      });
      pushSent = true;
    } catch (pushError) {
      console.error('极光推送发送失败:', pushError);
    }

    if (!pushSent) {
      res.json({
        success: true,
        data: { messageId },
        message: '消息已创建但推送发送失败，请检查极光推送配置',
        pushWarning: true,
      });
      return;
    }

    res.json({ success: true, data: { messageId }, message: '广播消息已发送' });
  } catch (error) {
    console.error('发送广播失败:', error);
    res.status(500).json({ success: false, error: '发送广播失败' });
  }
});

/**
 * 获取推送消息列表
 */
router.get('/messages', requireAuth, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const messages = await adminDB.find('push_messages', {} as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('push_messages');

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取推送记录失败:', error);
    res.status(500).json({ success: false, error: '获取推送记录失败' });
  }
});

/**
 * 获取推送消息已读统计
 */
router.get('/messages/:id/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ObjectId = (await import('mongodb')).ObjectId;

    let message;
    try {
      message = await adminDB.findOne('push_messages', { _id: new ObjectId(id) } as never);
    } catch {
      message = await adminDB.findOne('push_messages', { _id: id } as never);
    }

    if (!message) {
      res.status(404).json({ success: false, error: '消息不存在' });
      return;
    }

    const stats = (message as Record<string, unknown>).stats as Record<string, number> || {
      totalCount: 0,
      deliveredCount: 0,
      readCount: 0,
    };

    res.json({
      success: true,
      data: {
        message,
        stats: {
          total: stats.totalCount || 0,
          delivered: stats.deliveredCount || 0,
          read: stats.readCount || 0,
          readRate: stats.totalCount ? Math.round((stats.readCount / stats.totalCount) * 100) : 0,
        },
        unreadUsers: [],
      },
    });
  } catch (error) {
    console.error('获取推送统计失败:', error);
    res.status(500).json({ success: false, error: '获取统计失败' });
  }
});

export default router;
