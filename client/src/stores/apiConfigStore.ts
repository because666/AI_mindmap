import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { APIConfig, AIProvider, AIModel } from '../types';
import { DEFAULT_API_CONFIG, AI_PROVIDERS } from '../utils/aiModels';

/**
 * API配置状态接口
 */
interface APIConfigState {
  config: APIConfig;
  customModels: AIModel[];
  setProvider: (provider: AIProvider) => void;
  setModel: (modelId: string) => void;
  setApiKey: (apiKey: string) => void;
  setBaseUrl: (baseUrl: string) => void;
  setConfig: (config: Partial<APIConfig>) => void;
  resetConfig: () => void;
  addCustomModel: (model: Omit<AIModel, 'id'>) => string;
  removeCustomModel: (modelId: string) => void;
  updateCustomModel: (modelId: string, updates: Partial<Omit<AIModel, 'id'>>) => void;
  getCustomModelsByProvider: (provider: AIProvider) => AIModel[];
}

/**
 * 生成唯一模型ID
 * @returns 唯一标识符字符串
 */
const generateModelId = (): string => {
  return `custom-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * API配置状态管理Store
 */
export const useAPIConfigStore = create<APIConfigState>()(
  persist(
    (set, get) => ({
      config: DEFAULT_API_CONFIG,
      customModels: [] as AIModel[],
      
      /**
       * 设置AI服务提供商
       */
      setProvider: (provider: AIProvider) => {
        const providerConfig = AI_PROVIDERS[provider];
        set((state) => ({
          config: {
            ...state.config,
            provider,
            baseUrl: providerConfig.baseUrl
          }
        }));
      },
      
      /**
       * 设置AI模型（仅限用户自定义模型）
       */
      setModel: (modelId: string) => {
        const customModels = get().customModels;
        const exists = customModels.some(m => m.id === modelId);
        if (!exists) return;

        set((state) => ({
          config: {
            ...state.config,
            modelId
          }
        }));
      },
      
      /**
       * 设置API密钥
       */
      setApiKey: (apiKey: string) => {
        set((state) => ({
          config: {
            ...state.config,
            apiKey
          }
        }));
      },
      
      /**
       * 设置API基础URL
       */
      setBaseUrl: (baseUrl: string) => {
        set((state) => ({
          config: {
            ...state.config,
            baseUrl
          }
        }));
      },
      
      /**
       * 批量设置配置
       */
      setConfig: (newConfig: Partial<APIConfig>) => {
        set((state) => ({
          config: {
            ...state.config,
            ...newConfig
          }
        }));
      },
      
      /**
       * 重置为默认配置（保留自定义模型）
       */
      resetConfig: () => {
        set({ config: DEFAULT_API_CONFIG });
      },

      /**
       * 添加自定义模型
       * @param model - 模型数据（不含id，系统自动生成或使用用户指定的API标识）
       * @returns 新创建的模型ID
       */
      addCustomModel: (model: Omit<AIModel, 'id'>): string => {
        const id = generateModelId();
        const newModel: AIModel = { ...model, id };
        set((state) => ({
          customModels: [...state.customModels, newModel]
        }));
        return id;
      },

      /**
       * 删除自定义模型
       * @param modelId - 要删除的模型ID
       */
      removeCustomModel: (modelId: string) => {
        const currentModelId = get().config.modelId;
        set((state) => ({
          customModels: state.customModels.filter(m => m.id !== modelId),
          config: currentModelId === modelId
            ? { ...state.config, modelId: '' }
            : state.config
        }));
      },

      /**
       * 更新自定义模型信息
       * @param modelId - 模型ID
       * @param updates - 要更新的字段
       */
      updateCustomModel: (modelId: string, updates: Partial<Omit<AIModel, 'id'>>): void => {
        set((state) => ({
          customModels: state.customModels.map(m =>
            m.id === modelId ? { ...m, ...updates } : m
          )
        }));
      },

      /**
       * 获取指定提供商的自定义模型列表
       * @param provider - 服务商类型
       * @returns 该服务商下的自定义模型列表
       */
      getCustomModelsByProvider: (provider: AIProvider): AIModel[] => {
        return get().customModels.filter(m => m.provider === provider);
      },
    }),
    {
      name: 'api-config-storage',
      partialize: (state) => ({ 
        config: state.config,
        customModels: state.customModels 
      })
    }
  )
);

/**
 * 获取当前API配置
 */
export const getAPIConfig = (): APIConfig => {
  return useAPIConfigStore.getState().config;
};
