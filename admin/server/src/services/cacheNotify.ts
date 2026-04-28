import axios from 'axios';

const MAIN_SERVER_URL = process.env.MAIN_SERVER_URL || 'http://localhost:3001';
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN || 'deepmindmap-internal-2024';

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
