/**
 * 输入验证与安全工具函数
 * 提供正则转义、分页参数校验、确认码生成与验证等通用安全功能
 */

/**
 * 转义正则表达式特殊字符
 * 防止用户输入被解释为正则元字符，避免NoSQL注入和ReDoS攻击
 * @param str - 需要转义的字符串
 * @returns 转义后的安全字符串
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 校验并规范化分页参数
 * 防止恶意传入超大limit导致内存溢出
 * @param page - 页码
 * @param limit - 每页数量
 * @param maxLimit - 最大允许的每页数量，默认100
 * @returns 规范化后的 { page, limit, skip }
 */
export function sanitizePagination(
  page: unknown,
  limit: unknown,
  maxLimit: number = 100
): { page: number; limit: number; skip: number } {
  const p = Math.max(1, Math.min(Number(page) || 1, 10000));
  const l = Math.max(1, Math.min(Number(limit) || 20, maxLimit));
  return { page: p, limit: l, skip: (p - 1) * l };
}

/**
 * 生成确认码
 * 基于目标ID和操作类型生成可验证的确认码
 * @param targetId - 操作目标ID
 * @param action - 操作类型
 * @returns 确认码字符串
 */
export function generateConfirmCode(targetId: string, action: string): string {
  const raw = `${action}:${targetId}:${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 验证确认码
 * 检查确认码格式是否合法（6位以上36进制字符串）
 * @param code - 待验证的确认码
 * @param targetId - 操作目标ID
 * @returns 是否通过验证
 */
export function verifyConfirmCode(code: unknown, targetId: string): boolean {
  if (!code || typeof code !== 'string') return false;
  if (code.length < 6) return false;
  return /^[0-9a-z]+$/.test(code);
}
