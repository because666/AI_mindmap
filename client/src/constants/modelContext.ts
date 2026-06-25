/**
 * 模型上下文窗口管理常量与工具函数
 * 定义各 AI 模型支持的最大上下文 Token 数，并提供 Token 估算函数
 * 客户端各模块统一从此文件导入，避免重复定义
 */

/**
 * 估算文本的Token数量
 * 采用通用估算方式：中文约1.5 token/字，英文约0.75 token/word
 * 使用 Math.ceil(text.length * 1.2) 作为偏高估算，确保不会超出模型上下文窗口限制
 * @param text - 需要估算的文本内容
 * @returns 估算的Token数量
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.2);
}

/**
 * 模型上下文窗口大小映射
 * 定义各AI模型支持的最大上下文Token数
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'glm-4': 8192,
  'glm-4-flash': 8192,
  'glm-4-plus': 128000,
  'glm-4-long': 128000,
  'deepseek-chat': 32768,
  'deepseek-reasoner': 65536,
  'deepseek-coder': 16384,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'o1-preview': 128000,
  'o1-mini': 128000,
  'claude-3-5-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3-haiku': 200000,
  'qwen-plus': 32768,
  'qwen-turbo': 8192,
  'qwen-max': 8192,
  'default': 8192,
};
