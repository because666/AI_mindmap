/**
 * Store 共享工具模块
 * 提供各子 Store 共用的纯函数工具，避免跨 Store 重复定义
 */

/**
 * 生成唯一ID
 * 结合时间戳与随机数，保证在单进程内的唯一性
 * @returns 唯一标识符字符串，格式为 `${时间戳36进制}-${随机字符}`
 */
export const generateId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};
