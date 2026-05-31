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
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1'
  }
};

/**
 * 预置模型列表
 */
export const PRESET_MODELS: AIModel[] = [
  {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'zhipu',
    maxTokens: 8192,
    description: '智谱AI旗舰模型，综合能力强劲',
    isPreset: true,
    apiFormat: 'zhipu'
  },
  {
    id: 'glm-4-flash',
    name: 'GLM-4-Flash',
    provider: 'zhipu',
    maxTokens: 8192,
    description: '智谱AI高速模型，响应速度快',
    isPreset: true,
    apiFormat: 'zhipu'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    maxTokens: 8192,
    description: 'OpenAI多模态旗舰模型',
    isPreset: true,
    apiFormat: 'openai'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    maxTokens: 8192,
    description: 'OpenAI轻量级模型，性价比高',
    isPreset: true,
    apiFormat: 'openai'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    maxTokens: 8192,
    description: 'Anthropic平衡型模型，推理能力强',
    isPreset: true,
    apiFormat: 'anthropic'
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    maxTokens: 4096,
    description: 'Anthropic高速模型，响应迅速',
    isPreset: true,
    apiFormat: 'anthropic'
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'deepseek',
    maxTokens: 8192,
    description: 'DeepSeek对话模型',
    isPreset: true,
    apiFormat: 'deepseek'
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'deepseek',
    maxTokens: 8192,
    description: 'DeepSeek代码专用模型',
    isPreset: true,
    apiFormat: 'deepseek'
  }
];

/**
 * 默认API配置
 * 不包含预置模型或API密钥，需用户自行配置
 */
export const DEFAULT_API_CONFIG = {
  provider: 'zhipu' as AIProvider,
  modelId: '',
  apiKey: '',
  baseUrl: '',
  temperature: 0.7
};

/**
 * 根据模型ID获取预置模型信息
 * @param modelId - 模型ID
 * @returns 预置模型信息或undefined
 */
export const getPresetModelById = (modelId: string): AIModel | undefined => {
  return PRESET_MODELS.find(m => m.id === modelId);
};

/**
 * 根据模型ID获取模型信息（仅从用户自定义模型中查找）
 * @param modelId - 模型ID
 * @param customModels - 用户自定义模型列表
 * @returns 模型信息或undefined
 */
export const getModelById = (modelId: string, customModels: AIModel[]): AIModel | undefined => {
  return customModels.find(m => m.id === modelId);
};
