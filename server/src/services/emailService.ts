import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * 反馈邮件发送参数
 * @property title 反馈标题
 * @property description 反馈详细描述
 * @property type 反馈类型
 * @property contact 联系方式（可选）
 */
interface SendFeedbackParams {
  title: string;
  description: string;
  type: string;
  contact?: string;
}

/**
 * 邮件发送服务
 * 负责通过SMTP协议发送反馈邮件至管理员邮箱
 */
class EmailService {
  private transporter: Transporter | null = null;
  private initialized: boolean = false;

  /**
   * 初始化SMTP传输器
   * 从环境变量读取SMTP配置并创建传输器实例
   * @throws 当SMTP配置缺失时抛出错误
   */
  private initialize(): void {
    if (this.initialized) {
      return;
    }

    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !port || !user || !pass) {
      console.warn('[EmailService] SMTP配置不完整，邮件发送功能不可用');
      this.initialized = true;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: {
        user,
        pass,
      },
    });

    this.initialized = true;
    console.log('[EmailService] SMTP传输器初始化完成');
  }

  /**
   * 发送反馈邮件
   * 将用户反馈内容以HTML格式邮件发送至FEEDBACK_EMAIL指定的邮箱
   * @param params 发送参数，包含title、description、type、contact
   * @returns 发送成功返回true，发送失败返回false
   * @throws 当SMTP传输器未正确初始化时记录错误并返回false
   */
  async sendFeedbackEmail(params: SendFeedbackParams): Promise<boolean> {
    this.initialize();

    if (!this.transporter) {
      console.error('[EmailService] SMTP传输器未初始化，无法发送邮件');
      return false;
    }

    const feedbackEmail = process.env.FEEDBACK_EMAIL;
    if (!feedbackEmail) {
      console.error('[EmailService] FEEDBACK_EMAIL环境变量未配置');
      return false;
    }

    const { title, description, type, contact } = params;

    const subject = `[DeepMindMap反馈] ${type} - ${title}`;
    const htmlBody = this.buildHtmlBody(title, description, type, contact);

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: feedbackEmail,
        subject,
        html: htmlBody,
      });
      console.log('[EmailService] 反馈邮件发送成功');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[EmailService] 反馈邮件发送失败:', message);
      return false;
    }
  }

  /**
   * 构建邮件HTML正文
   * @param title 反馈标题
   * @param description 反馈详细描述
   * @param type 反馈类型
   * @param contact 联系方式（可选）
   * @returns 格式化的HTML字符串
   */
  private buildHtmlBody(
    title: string,
    description: string,
    type: string,
    contact?: string
  ): string {
    const contactRow = contact
      ? `<tr><td style="padding:8px 16px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #eee;">联系方式</td><td style="padding:8px 16px;border-bottom:1px solid #eee;">${contact}</td></tr>`
      : '';

    return `
      <div style="max-width:600px;margin:0 auto;font-family:'Microsoft YaHei',sans-serif;">
        <h2 style="color:#333;border-bottom:2px solid #4a90d9;padding-bottom:10px;">DeepMindMap 用户反馈</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
          <tr><td style="padding:8px 16px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #eee;">反馈类型</td><td style="padding:8px 16px;border-bottom:1px solid #eee;">${type}</td></tr>
          <tr><td style="padding:8px 16px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #eee;">标题</td><td style="padding:8px 16px;border-bottom:1px solid #eee;">${title}</td></tr>
          <tr><td style="padding:8px 16px;font-weight:bold;background:#f5f5f5;border-bottom:1px solid #eee;">详细描述</td><td style="padding:8px 16px;border-bottom:1px solid #eee;white-space:pre-wrap;">${description}</td></tr>
          ${contactRow}
          <tr><td style="padding:8px 16px;font-weight:bold;background:#f5f5f5;">提交时间</td><td style="padding:8px 16px;">${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</td></tr>
        </table>
      </div>
    `;
  }
}

export const emailService = new EmailService();
