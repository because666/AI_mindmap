import type { AIModel, AIProvider } from '../types';

/**
 * AI服务提供商配置（仅包含基础URL，不含默认模型）
 */
export const AI_PROVIDERS: Record<AIProvider, { name: string; baseUrl: string }> = {
  zhipu: {
    name: '智谱AI',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1'
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1'
  }
};

/**
 * 默认API配置
 * 不包含预置模型或API密钥，需用户自行配置
 */
export const DEFAULT_API_CONFIG = {
  provider: 'zhipu' as AIProvider,
  modelId: '',
  apiKey: '',
  baseUrl: ''
};

/**
 * 根据模型ID获取模型信息（仅从用户自定义模型中查找）
 */
export const getModelById = (modelId: string, customModels: AIModel[]): AIModel | undefined => {
  return customModels.find(m => m.id === modelId);
};
