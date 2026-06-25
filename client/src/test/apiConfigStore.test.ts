import { describe, it, expect, beforeEach } from 'vitest';
import { useAPIConfigStore, getAPIConfig } from '../stores/apiConfigStore';
import { getPresetModelById } from '../utils/aiModels';
import type { ModelConfig } from '../types';

/**
 * API配置Store测试套件
 */
describe('API Config Store', () => {
  beforeEach(() => {
    useAPIConfigStore.setState({
      savedConfigs: [],
      activeConfigId: null,
      temperature: 0.7,
    });
  });

  describe('初始状态', () => {
    it('应该包含默认配置', () => {
      const state = useAPIConfigStore.getState();
      expect(state.savedConfigs).toEqual([]);
      expect(state.activeConfigId).toBeNull();
      expect(state.temperature).toBe(0.7);
    });

    it('未配置自定义模型时应使用内置服务', () => {
      const state = useAPIConfigStore.getState();
      expect(state.getActiveConfig()).toBeNull();
      expect(state.getAPIConfigFromActive()).toBeNull();
    });
  });

  describe('setTemperature', () => {
    it('应该正常设置温度值', () => {
      useAPIConfigStore.getState().setTemperature(1.2);
      expect(useAPIConfigStore.getState().temperature).toBe(1.2);
    });

    it('应该将小于0的值截断为0', () => {
      useAPIConfigStore.getState().setTemperature(-0.5);
      expect(useAPIConfigStore.getState().temperature).toBe(0);
    });

    it('应该将大于2的值截断为2', () => {
      useAPIConfigStore.getState().setTemperature(2.5);
      expect(useAPIConfigStore.getState().temperature).toBe(2);
    });

    it('边界值0应该被接受', () => {
      useAPIConfigStore.getState().setTemperature(0);
      expect(useAPIConfigStore.getState().temperature).toBe(0);
    });

    it('边界值2应该被接受', () => {
      useAPIConfigStore.getState().setTemperature(2);
      expect(useAPIConfigStore.getState().temperature).toBe(2);
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
    it('migrate函数应该将旧配置迁移为保存配置', () => {
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

      expect((migrated as { temperature: number }).temperature).toBe(0.7);
      expect((migrated as { savedConfigs: ModelConfig[] }).savedConfigs[0].apiKey).toBe('test-key');
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

      expect((migrated as { temperature: number }).temperature).toBe(1.5);
    });
  });

  describe('getAPIConfig', () => {
    it('未选择自定义配置时应返回null', () => {
      expect(getAPIConfig()).toBeNull();
    });

    it('选择自定义配置时应返回当前配置', () => {
      const config: ModelConfig = {
        id: 'cfg-test',
        name: '测试模型',
        provider: 'zhipu',
        modelId: 'glm-4',
        apiKey: 'test-key',
        baseUrl: '',
      };

      useAPIConfigStore.getState().addSavedConfig(config);

      expect(getAPIConfig()).toEqual({
        provider: 'zhipu',
        modelId: 'glm-4',
        apiKey: 'test-key',
        baseUrl: '',
        temperature: 0.7,
      });
    });
  });
});
