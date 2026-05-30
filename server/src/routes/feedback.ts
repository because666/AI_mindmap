import { Router, type Request, type Response } from 'express';
import { emailService } from '../services/emailService';
import { mongoDBService } from '../data/mongodb/connection';
import { ObjectId } from 'mongodb';

const router = Router();

/**
 * 反馈类型枚举值
 */
const FEEDBACK_TYPES = ['功能异常', '界面问题', '建议', '其他'] as const;

/**
 * 反馈类型联合类型
 */
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/**
 * 反馈请求体接口
 * @property title 反馈标题（必填，最长100字符）
 * @property description 反馈详细描述（必填，最长2000字符）
 * @property type 反馈类型（必填，枚举值）
 * @property contact 联系方式（选填，最长200字符）
 */
interface FeedbackRequestBody {
  title: string;
  description: string;
  type: string;
  contact?: string;
}

/**
 * 限流记录接口
 * @property count 提交次数
 * @property firstRequestTime 首次请求时间戳
 */
interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
}

/**
 * IP限流存储
 * 键为IP地址，值为限流记录
 * 每IP每分钟最多3次提交
 */
const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * 限流时间窗口（毫秒）
 */
const RATE_LIMIT_WINDOW = 60 * 1000;

/**
 * 限流窗口内最大请求数
 */
const RATE_LIMIT_MAX = 3;

/**
 * HTML实体转义映射表
 * 用于XSS防护，将特殊字符转义为HTML实体
 */
const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

/**
 * 对字符串进行HTML实体转义，防止XSS攻击
 * 将 & < > " ' 转义为对应的HTML实体
 * @param input 需要转义的原始字符串
 * @returns 转义后的安全字符串
 */
function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (char: string): string => {
    return HTML_ESCAPE_MAP[char] ?? char;
  });
}

/**
 * 检查IP是否超过限流阈值
 * 每IP每分钟最多允许RATE_LIMIT_MAX次请求
 * @param ip 客户端IP地址
 * @returns 超过限流返回true，未超过返回false
 */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record) {
    rateLimitMap.set(ip, { count: 1, firstRequestTime: now });
    return false;
  }

  const elapsed = now - record.firstRequestTime;
  if (elapsed > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, firstRequestTime: now });
    return false;
  }

  record.count += 1;
  if (record.count > RATE_LIMIT_MAX) {
    return true;
  }

  return false;
}

/**
 * 反馈提交接口
 * POST /api/feedback
 * 接收用户反馈信息，进行输入验证、XSS防护、限流检查后发送邮件通知
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

    if (isRateLimited(clientIp)) {
      return res.status(429).json({
        success: false,
        error: '提交过于频繁，请稍后再试',
      });
    }

    const { title, description, type, contact }: FeedbackRequestBody = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '标题为必填项',
      });
    }

    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        error: '标题最长100个字符',
      });
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: '详细描述为必填项',
      });
    }

    if (description.length > 2000) {
      return res.status(400).json({
        success: false,
        error: '详细描述最长2000个字符',
      });
    }

    if (!type || typeof type !== 'string' || !FEEDBACK_TYPES.includes(type as FeedbackType)) {
      return res.status(400).json({
        success: false,
        error: `反馈类型必须为：${FEEDBACK_TYPES.join('、')}`,
      });
    }

    if (contact !== undefined && contact !== null) {
      if (typeof contact !== 'string') {
        return res.status(400).json({
          success: false,
          error: '联系方式必须为字符串',
        });
      }
      if (contact.length > 200) {
        return res.status(400).json({
          success: false,
          error: '联系方式最长200个字符',
        });
      }
    }

    const safeTitle = escapeHtml(title.trim());
    const safeDescription = escapeHtml(description.trim());
    const safeContact = contact ? escapeHtml(contact.trim()) : undefined;

    const sent = await emailService.sendFeedbackEmail({
      title: safeTitle,
      description: safeDescription,
      type,
      contact: safeContact,
    });

    if (!sent) {
      return res.status(500).json({
        success: false,
        error: '反馈提交失败，邮件发送异常，请稍后再试',
      });
    }

    try {
      await mongoDBService.insertOne('feedbacks', {
        title: safeTitle,
        description: safeDescription,
        type,
        contact: safeContact || '',
        visitorIp: clientIp,
        status: 'pending',
        createdAt: new Date(),
      });
    } catch (dbError) {
      console.error('[Feedback] 反馈数据存储失败:', dbError instanceof Error ? dbError.message : String(dbError));
    }

    res.json({
      success: true,
      message: '反馈提交成功',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Feedback] 反馈提交失败:', message);
    res.status(500).json({
      success: false,
      error: '反馈提交失败，请稍后再试',
    });
  }
});

export default router;
