import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { APIConfig, AIProvider, ModelConfig } from '../types';
import { AI_PROVIDERS } from '../utils/aiModels';

/**
 * API配置状态接口
 */
interface APIConfigState {
  savedConfigs: ModelConfig[];
  activeConfigId: string | null;
  temperature: number;
  addSavedConfig: (config: ModelConfig) => void;
  removeSavedConfig: (id: string) => void;
  setActiveConfigId: (id: string | null) => void;
  getActiveConfig: () => ModelConfig | null;
  getAPIConfigFromActive: () => APIConfig | null;
  setTemperature: (temperature: number) => void;
}

/**
 * 生成唯一配置ID
 * @returns 唯一标识符字符串
 */
const generateConfigId = (): string => {
  return `cfg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * API配置状态管理Store
 */
export const useAPIConfigStore = create<APIConfigState>()(
  persist(
    (set, get) => ({
      savedConfigs: [] as ModelConfig[],
      activeConfigId: null as string | null,
      temperature: 0.7,

      /**
       * 添加模型配置到保存列表
       * @param config - 完整的模型配置对象
       */
      addSavedConfig: (config: ModelConfig): void => {
        set((state) => ({
          savedConfigs: [...state.savedConfigs, config],
          activeConfigId: config.id
        }));
      },

      /**
       * 删除已保存的模型配置
       * 如果删除的是当前激活配置，自动切换回内置服务
       * @param id - 配置ID
       */
      removeSavedConfig: (id: string): void => {
        set((state) => {
          const newConfigs = state.savedConfigs.filter(c => c.id !== id);
          const newActiveId = state.activeConfigId === id ? null : state.activeConfigId;
          return {
            savedConfigs: newConfigs,
            activeConfigId: newActiveId
          };
        });
      },

      /**
       * 设置当前激活的模型配置ID
       * 传null表示使用内置服务
       * @param id - 配置ID或null
       */
      setActiveConfigId: (id: string | null): void => {
        set({ activeConfigId: id });
      },

      /**
       * 获取当前激活的模型配置
       * @returns 激活的ModelConfig对象，如果使用内置服务则返回null
       */
      getActiveConfig: (): ModelConfig | null => {
        const { savedConfigs, activeConfigId } = get();
        if (!activeConfigId) return null;
        return savedConfigs.find(c => c.id === activeConfigId) || null;
      },

      /**
       * 从当前激活配置生成chatService所需的APIConfig格式
       * @returns APIConfig对象，如果使用内置服务则返回null
       */
      getAPIConfigFromActive: (): APIConfig | null => {
        const activeConfig = get().getActiveConfig();
        if (!activeConfig) return null;
        return {
          provider: activeConfig.provider,
          modelId: activeConfig.modelId,
          apiKey: activeConfig.apiKey,
          baseUrl: activeConfig.baseUrl,
          temperature: get().temperature
        };
      },

      /**
       * 设置温度参数
       * @param temperature - 温度值，范围0-2，超出范围会被截断
       */
      setTemperature: (temperature: number): void => {
        set({ temperature: Math.max(0, Math.min(2, temperature)) });
      },
    }),
    {
      name: 'api-config-storage',
      version: 2,
      migrate: (persistedState: unknown, version: number): APIConfigState => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          const savedConfigs: ModelConfig[] = [];
          const oldConfig = state.config as Record<string, unknown> | undefined;
          const oldCustomModels = state.customModels as Array<Record<string, unknown>> | undefined;

          if (oldConfig && oldConfig.apiKey && typeof oldConfig.apiKey === 'string' && (oldConfig.apiKey as string).trim() !== '') {
            const provider = (oldConfig.provider as AIProvider) || 'zhipu';
            const modelId = (oldConfig.modelId as string) || '';
            const providerInfo = AI_PROVIDERS[provider];
            savedConfigs.push({
              id: generateConfigId(),
              name: modelId || `${providerInfo.name}自定义模型`,
              provider,
              modelId,
              apiKey: oldConfig.apiKey as string,
              baseUrl: oldConfig.baseUrl as string | undefined,
              isCustom: true,
              description: '从旧版本迁移的配置'
            });
          }

          if (oldCustomModels && Array.isArray(oldCustomModels)) {
            for (const model of oldCustomModels) {
              savedConfigs.push({
                id: (model.id as string) || generateConfigId(),
                name: (model.name as string) || (model.id as string) || '未知模型',
                provider: (model.provider as AIProvider) || 'zhipu',
                modelId: (model.id as string) || '',
                apiKey: (oldConfig?.apiKey as string) || '',
                baseUrl: oldConfig?.baseUrl as string | undefined,
                isCustom: true,
                description: (model.description as string) || ''
              });
            }
          }

          const newState = { ...state } as Record<string, unknown>;
          delete newState.config;
          delete newState.customModels;
          newState.savedConfigs = savedConfigs;
          newState.activeConfigId = savedConfigs.length > 0 ? savedConfigs[0].id : null;
          newState.temperature = (oldConfig?.temperature as number) ?? 0.7;
          return newState as unknown as APIConfigState;
        }
        return persistedState as unknown as APIConfigState;
      },
      partialize: (state) => ({
        savedConfigs: state.savedConfigs,
        activeConfigId: state.activeConfigId,
        temperature: state.temperature
      })
    }
  )
);

/**
 * 获取当前API配置
 * @returns APIConfig对象或null（使用内置服务时）
 */
export const getAPIConfig = (): APIConfig | null => {
  return useAPIConfigStore.getState().getAPIConfigFromActive();
};

/**
 * 创建新的模型配置ID
 * @returns 唯一配置ID字符串
 */
export const createConfigId = generateConfigId;
