import { Router } from 'express';
import { pushService } from '../services/pushService';

const router = Router();

/**
 * 设备注册接口
 * POST /api/push/register
 * 客户端调用，将极光SDK获取的Registration ID与用户关联
 */
router.post('/register', async (req, res) => {
  try {
    const { registrationId, platform, deviceModel, appVersion } = req.body;

    if (!registrationId || !platform) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: registrationId 和 platform',
      });
    }

    if (!['android', 'ios'].includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'platform 参数必须为 android 或 ios',
      });
    }

    const userId = req.headers['x-visitor-id'] as string || 'anonymous';

    await pushService.registerDevice(userId, registrationId, platform, deviceModel, appVersion);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Push] 设备注册失败:', error.message);
    res.status(500).json({
      success: false,
      error: '设备注册失败',
    });
  }
});

/**
 * 获取消息列表
 * GET /api/push/messages?page=1&limit=20&type=all
 * 支持分页和类型过滤
 */
router.get('/messages', async (req, res) => {
  try {
    const userId = (req.headers['x-visitor-id'] as string) || 'anonymous';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = req.query.type as string;

    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        error: '无效的分页参数',
      });
    }

    const result = await pushService.getMessageList(userId, page, limit, type);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Push] 获取消息列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取消息列表失败',
    });
  }
});

/**
 * 获取消息详情
 * GET /api/push/messages/:id
 * 返回消息完整内容（Markdown格式）
 */
router.get('/messages/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.headers['x-visitor-id'] as string) || 'anonymous';

    const detail = await pushService.getMessageDetail(id, userId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        error: '消息不存在',
      });
    }

    res.json({
      success: true,
      data: detail,
    });
  } catch (error: any) {
    console.error('[Push] 获取消息详情失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取消息详情失败',
    });
  }
});

/**
 * 标记单条消息已读
 * POST /api/push/messages/:id/read
 */
router.post('/messages/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.headers['x-visitor-id'] as string) || 'anonymous';

    const success = await pushService.markAsRead(id, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: '消息不存在或无权限操作',
      });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Push] 标记已读失败:', error.message);
    res.status(500).json({
      success: false,
      error: '标记已读失败',
    });
  }
});

/**
 * 标记所有消息已读
 * POST /api/push/messages/read-all
 */
router.post('/messages/read-all', async (req, res) => {
  try {
    const userId = (req.headers['x-visitor-id'] as string) || 'anonymous';

    const markedCount = await pushService.markAllAsRead(userId);

    res.json({
      success: true,
      data: { markedCount },
    });
  } catch (error: any) {
    console.error('[Push] 全部标记已读失败:', error.message);
    res.status(500).json({
      success: false,
      error: '全部标记已读失败',
    });
  }
});

/**
 * 获取未读消息数量
 * GET /api/push/messages/unread-count
 * 用于显示红点提示和未读数
 */
router.get('/messages/unread-count', async (req, res) => {
  try {
    const userId = (req.headers['x-visitor-id'] as string) || 'anonymous';

    const unreadCount = await pushService.getUnreadCount(userId);

    res.json({
      success: true,
      data: unreadCount,
    });
  } catch (error: any) {
    console.error('[Push] 获取未读数量失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取未读数量失败',
    });
  }
});

/**
 * 极光推送回调 - 送达回执
 * POST /api/push/callback/delivery
 * 极光服务器回调通知消息已送达设备
 */
router.post('/callback/delivery', async (req, res) => {
  try {
    const { messageId, registrationId } = req.body;

    if (!messageId || !registrationId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
    }

    await pushService.handleDeliveryReceipt(messageId, registrationId);

    res.json({ success: true });
  } catch (error: any) {
    console.error('[Push] 处理送达回执失败:', error.message);
    res.status(500).json({
      success: false,
      error: '处理送达回执失败',
    });
  }
});

/**
 * 发送广播消息（管理员/后台调用）
 * POST /api/push/broadcast
 * 场景A - 超级广播
 */
router.post('/broadcast', async (req, res) => {
  try {
    const { title, content, summary, targetType, targetUserIds, scheduledAt, forceRead, forceReadDeadline } =
      req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: title 和 content',
      });
    }

    if (!targetType || !['all', 'active_users', 'specific_users'].includes(targetType)) {
      return res.status(400).json({
        success: false,
        error: 'targetType 参数无效，必须为 all、active_users 或 specific_users',
      });
    }

    if (targetType === 'specific_users' && (!targetUserIds || targetUserIds.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'targetType 为 specific_users 时必须提供 targetUserIds',
      });
    }

    const message = await pushService.sendBroadcast({
      title,
      content,
      summary,
      targetType,
      targetUserIds,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      forceRead: forceRead !== false,
      forceReadDeadline: forceReadDeadline ? new Date(forceReadDeadline) : undefined,
    });

    res.json({
      success: true,
      data: {
        messageId: message._id?.toString(),
        targetCount: message.stats.totalCount,
        status: scheduledAt ? 'scheduled' : 'sent',
      },
    });
  } catch (error: any) {
    console.error('[Push] 发送广播消息失败:', error.message);
    res.status(500).json({
      success: false,
      error: '发送广播消息失败: ' + error.message,
    });
  }
});

/**
 * 获取消息已读统计（管理员用）
 * GET /api/push/messages/:id/stats
 */
router.get('/messages/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await pushService.getMessageStats(id);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: '消息不存在',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[Push] 获取已读统计失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取已读统计失败',
    });
  }
});

/**
 * 推送记录列表（管理员用）
 * GET /api/push/messages/admin/list?page=1&limit=20
 */
router.get('/messages/admin/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    res.json({
      success: true,
      data: {
        messages: [],
        pagination: { page, limit, total: 0, hasMore: false },
      },
    });
  } catch (error: any) {
    console.error('[Push] 获取推送记录列表失败:', error.message);
    res.status(500).json({
      success: false,
      error: '获取推送记录列表失败',
    });
  }
});

export default router;
