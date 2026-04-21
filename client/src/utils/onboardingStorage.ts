/**
 * 新手引导状态管理工具
 * 使用 localStorage 持久化存储引导完成状态
 */

const ONBOARDING_STORAGE_KEY = 'deepmindmap_onboarding_completed';
const ONBOARDING_TIMESTAMP_KEY = 'deepmindmap_onboarding_timestamp';

/**
 * 检查新手引导是否已完成
 * @returns 是否已完成引导
 */
export const isOnboardingCompleted = (): boolean => {
  try {
    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    return completed === 'true';
  } catch (error) {
    console.error('读取引导状态失败:', error);
    return false;
  }
};

/**
 * 标记新手引导已完成
 */
export const markOnboardingCompleted = (): void => {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    localStorage.setItem(ONBOARDING_TIMESTAMP_KEY, new Date().toISOString());
  } catch (error) {
    console.error('保存引导状态失败:', error);
  }
};

/**
 * 获取引导完成时间戳
 * @returns 完成时间的ISO字符串，未完成则返回null
 */
export const getOnboardingTimestamp = (): string | null => {
  try {
    return localStorage.getItem(ONBOARDING_TIMESTAMP_KEY);
  } catch (error) {
    console.error('读取引导时间戳失败:', error);
    return null;
  }
};

/**
 * 重置引导状态（用于测试或重新展示）
 */
export const resetOnboardingStatus = (): void => {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_TIMESTAMP_KEY);
  } catch (error) {
    console.error('重置引导状态失败:', error);
  }
};
