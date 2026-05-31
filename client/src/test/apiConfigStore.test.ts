import { describe, it, expect, beforeEach } from 'vitest';
import { useAPIConfigStore, getAPIConfig } from '../stores/apiConfigStore';
import { DEFAULT_API_CONFIG, getPresetModelById, PRESET_MODELS } from '../utils/aiModels';
import type { AIModel } from '../types';

/**
 * API配置Store测试套件
 */
describe('API Config Store', () => {
  beforeEach(() => {
    useAPIConfigStore.setState({
      config: { ...DEFAULT_API_CONFIG },
      customModels: []
    });
  });

  describe('初始状态', () => {
    it('应该包含默认配置', () => {
      const state = useAPIConfigStore.getState();
      expect(state.config.provider).toBe('zhipu');
      expect(state.config.modelId).toBe('');
      expect(state.config.apiKey).toBe('');
      expect(state.config.baseUrl).toBe('');
      expect(state.config.temperature).toBe(0.7);
    });

    it('自定义模型列表应为空数组', () => {
      const state = useAPIConfigStore.getState();
      expect(state.customModels).toEqual([]);
    });
  });

  describe('setTemperature', () => {
    it('应该正常设置温度值', () => {
      useAPIConfigStore.getState().setTemperature(1.2);
      expect(useAPIConfigStore.getState().config.temperature).toBe(1.2);
    });

    it('应该将小于0的值截断为0', () => {
      useAPIConfigStore.getState().setTemperature(-0.5);
      expect(useAPIConfigStore.getState().config.temperature).toBe(0);
    });

    it('应该将大于2的值截断为2', () => {
      useAPIConfigStore.getState().setTemperature(2.5);
      expect(useAPIConfigStore.getState().config.temperature).toBe(2);
    });

    it('边界值0应该被接受', () => {
      useAPIConfigStore.getState().setTemperature(0);
      expect(useAPIConfigStore.getState().config.temperature).toBe(0);
    });

    it('边界值2应该被接受', () => {
      useAPIConfigStore.getState().setTemperature(2);
      expect(useAPIConfigStore.getState().config.temperature).toBe(2);
    });
  });

  describe('getPresetModelById', () => {
    it('应该能获取到预置模型', () => {
      const model = getPresetModelById('glm-4');
      expect(model).toBeDefined();
      expect(model?.name).toBe('GLM-4');
    });

    it('不存在的模型ID应返回undefined', () => {
      const model = getPresetModelById('non-existent-model');
      expect(model).toBeUndefined();
    });
  });

  describe('数据持久化迁移', () => {
    it('migrate函数应该为旧数据添加temperature字段', () => {
      const oldState = {
        config: {
          provider: 'zhipu' as const,
          modelId: '',
          apiKey: 'test-key',
          baseUrl: ''
        },
        customModels: []
      };

      const persistConfig = (useAPIConfigStore as unknown as { persist: { getOptions: () => { migrate?: (state: unknown, version: number) => unknown } } }).persist.getOptions();
      const migrated = persistConfig.migrate?.(oldState, 0);

      expect((migrated as typeof oldState & { config: { temperature: number } }).config.temperature).toBe(0.7);
    });

    it('migrate函数应保留已有的temperature值', () => {
      const oldState = {
        config: {
          provider: 'zhipu' as const,
          modelId: '',
          apiKey: 'test-key',
          baseUrl: '',
          temperature: 1.5
        },
        customModels: []
      };

      const persistConfig = (useAPIConfigStore as unknown as { persist: { getOptions: () => { migrate?: (state: unknown, version: number) => unknown } } }).persist.getOptions();
      const migrated = persistConfig.migrate?.(oldState, 0);

      expect((migrated as typeof oldState).config.temperature).toBe(1.5);
    });
  });

  describe('getAPIConfig', () => {
    it('应该返回当前配置', () => {
      const config = getAPIConfig();
      expect(config).toBeDefined();
      expect(config!.provider).toBe('zhipu');
      expect(config!.temperature).toBe(0.7);
    });
  });
});
