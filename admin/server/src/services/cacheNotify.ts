import axios from 'axios';

const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:3001';

const INTERNAL_TOKEN = (() => {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) {
    throw new Error('INTERNAL_API_TOKEN 环境变量未设置，内部 API 通信不安全');
  }
  return token;
})();

/**
 * 通知主服务端清除指定访客的缓存
 * 在封禁/解封用户后调用
 * @param visitorId - 访客ID
 */
export async function notifyVisitorCacheClear(visitorId: string): Promise<void> {
  try {
    await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {
      type: 'visitor',
      visitorId,
    }, {
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      timeout: 5000,
    });
  } catch (error) {
    console.error('[缓存通知] 通知主服务端清除访客缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端清除指定工作区的缓存
 * 在关闭/开启工作区后调用
 * @param workspaceId - 工作区ID
 */
export async function notifyWorkspaceCacheClear(workspaceId: string): Promise<void> {
  try {
    await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {
      type: 'workspace',
      workspaceId,
    }, {
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      timeout: 5000,
    });
  } catch (error) {
    console.error('[缓存通知] 通知主服务端清除工作区缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端清除敏感词缓存
 * 在更新敏感词配置后调用
 */
export async function notifySensitiveWordCacheClear(): Promise<void> {
  try {
    await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {
      type: 'sensitive-word',
    }, {
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      timeout: 5000,
    });
  } catch (error) {
    console.error('[缓存通知] 通知主服务端清除敏感词缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端清除所有缓存
 */
export async function notifyAllCacheClear(): Promise<void> {
  try {
    await axios.post(`${MAIN_SERVER_URL}/api/internal/clear-cache`, {}, {
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      timeout: 5000,
    });
  } catch (error) {
    console.error('[缓存通知] 通知主服务端清除所有缓存失败:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * 通知主服务端发送反馈处理结果推送
 * 管理员更新反馈状态后调用
 * @param visitorId - 反馈提交者的访客ID
 * @param feedbackTitle - 反馈标题
 * @param newStatus - 新的反馈状态
 */
export async function notifyFeedbackPush(
  visitorId: string,
  feedbackTitle: string,
  newStatus: string
): Promise<void> {
  try {
    await axios.post(`${MAIN_SERVER_URL}/api/internal/push/feedback-notification`, {
      visitorId,
      feedbackTitle,
      newStatus,
    }, {
      headers: { 'x-internal-token': INTERNAL_TOKEN },
      timeout: 5000,
    });
  } catch (error) {
    const err = error as { response?: { status: number; data: unknown }; message?: string };
    if (err.response) {
      const status = err.response.status;
      const data = JSON.stringify(err.response.data);
      if (status === 403) {
        console.error('[反馈推送] 鉴权失败(403): 请检查 INTERNAL_API_TOKEN 配置一致性');
      } else {
        console.error('[反馈推送] HTTP调用失败, status:', status, ', response:', data);
      }
    } else if (err.message) {
      console.error('[反馈推送] 网络请求失败, 无法连接主服务端:', err.message);
    } else {
      console.error('[反馈推送] 未知错误:', error instanceof Error ? error.message : String(error));
    }
  }
}
