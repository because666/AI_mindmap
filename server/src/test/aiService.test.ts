import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    ai: {
      openaiApiKey: 'openai-key-1',
      zhipuApiKey: 'zhipu-key-1',
      zhipuApiKey2: 'zhipu-key-2',
      deepseekApiKey: 'deepseek-key-1',
      defaultProvider: 'zhipu',
      defaultModel: 'glm-4-flash',
      embeddingModel: 'text-embedding-3-small',
      systemPrompt: '',
      fallbackChain: ['zhipu', 'deepseek', 'openai'],
      aiProviders: [],
    },
  },
}));

vi.mock('../config', () => ({
  config: mockConfig,
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
  },
}));

vi.mock('../data/vector/connection', () => ({
  vectorDBService: {},
}));

vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {},
}));

import { aiService } from '../services/aiService';

/**
 * Key Pool 测试访问接口
 * 通过类型断言访问 AIService 私有成员，用于单元测试
 */
interface KeyPoolTestable {
  keyPools: Map<string, string[]>;
  keyIndices: Map<string, number>;
  initializeKeyPools(): void;
  getKeyFromPool(provider: string): string | undefined;
  getProviderForKey(apiKey: string): string | undefined;
  getBuiltInApiKey(provider?: string): string | undefined;
}

/**
 * 获取 AIService 的测试访问接口
 * @returns 包含私有成员访问能力的测试接口
 */
function getTestable(): KeyPoolTestable {
  return aiService as unknown as KeyPoolTestable;
}

/**
 * Key Pool 轮询机制单元测试
 */
describe('Key Pool 轮询机制', () => {
  let testable: KeyPoolTestable;

  beforeEach(() => {
    testable = getTestable();
    testable.keyIndices.set('zhipu', 0);
    testable.keyIndices.set('deepseek', 0);
    testable.keyIndices.set('openai', 0);
  });

  describe('initializeKeyPools', () => {
    it('应正确初始化 zhipu Key 池（包含两个 Key）', () => {
      const pool = testable.keyPools.get('zhipu');
      expect(pool).toBeDefined();
      expect(pool).toEqual(['zhipu-key-1', 'zhipu-key-2']);
    });

    it('应正确初始化 deepseek Key 池（包含一个 Key）', () => {
      const pool = testable.keyPools.get('deepseek');
      expect(pool).toBeDefined();
      expect(pool).toEqual(['deepseek-key-1']);
    });

    it('应正确初始化 openai Key 池（包含一个 Key）', () => {
      const pool = testable.keyPools.get('openai');
      expect(pool).toBeDefined();
      expect(pool).toEqual(['openai-key-1']);
    });

    it('所有 Key 池的初始索引应为 0', () => {
      expect(testable.keyIndices.get('zhipu')).toBe(0);
      expect(testable.keyIndices.get('deepseek')).toBe(0);
      expect(testable.keyIndices.get('openai')).toBe(0);
    });

    it('zhipuApiKey2 为空时 Key 池只有 1 个 Key', () => {
      const originalKey2 = mockConfig.ai.zhipuApiKey2;
      mockConfig.ai.zhipuApiKey2 = '';
      testable.keyPools.delete('zhipu');
      testable.keyIndices.delete('zhipu');
      testable.initializeKeyPools();

      const pool = testable.keyPools.get('zhipu');
      expect(pool).toEqual(['zhipu-key-1']);

      mockConfig.ai.zhipuApiKey2 = originalKey2;
      testable.keyPools.delete('zhipu');
      testable.keyIndices.delete('zhipu');
      testable.initializeKeyPools();
    });

    it('所有 Key 均为空时不应创建 Key 池', () => {
      const originalZhipu = mockConfig.ai.zhipuApiKey;
      const originalZhipu2 = mockConfig.ai.zhipuApiKey2;
      mockConfig.ai.zhipuApiKey = '';
      mockConfig.ai.zhipuApiKey2 = '';
      testable.keyPools.delete('zhipu');
      testable.keyIndices.delete('zhipu');
      testable.initializeKeyPools();

      expect(testable.keyPools.has('zhipu')).toBe(false);

      mockConfig.ai.zhipuApiKey = originalZhipu;
      mockConfig.ai.zhipuApiKey2 = originalZhipu2;
      testable.keyPools.delete('zhipu');
      testable.keyIndices.delete('zhipu');
      testable.initializeKeyPools();
    });
  });

  describe('getKeyFromPool (Round-Robin)', () => {
    it('应按 Round-Robin 方式轮询多 Key 池', () => {
      expect(testable.getKeyFromPool('zhipu')).toBe('zhipu-key-1');
      expect(testable.getKeyFromPool('zhipu')).toBe('zhipu-key-2');
      expect(testable.getKeyFromPool('zhipu')).toBe('zhipu-key-1');
      expect(testable.getKeyFromPool('zhipu')).toBe('zhipu-key-2');
    });

    it('单 Key 池应始终返回同一个 Key', () => {
      expect(testable.getKeyFromPool('deepseek')).toBe('deepseek-key-1');
      expect(testable.getKeyFromPool('deepseek')).toBe('deepseek-key-1');
      expect(testable.getKeyFromPool('deepseek')).toBe('deepseek-key-1');
    });

    it('不存在的 Provider 应返回 undefined', () => {
      expect(testable.getKeyFromPool('unknown')).toBeUndefined();
    });

    it('空 Key 池应返回 undefined', () => {
      testable.keyPools.set('empty-provider', []);
      expect(testable.getKeyFromPool('empty-provider')).toBeUndefined();
      testable.keyPools.delete('empty-provider');
    });
  });

  describe('getProviderForKey', () => {
    it('应根据 Key 反查所属 Provider', () => {
      expect(testable.getProviderForKey('zhipu-key-1')).toBe('zhipu');
      expect(testable.getProviderForKey('zhipu-key-2')).toBe('zhipu');
      expect(testable.getProviderForKey('deepseek-key-1')).toBe('deepseek');
      expect(testable.getProviderForKey('openai-key-1')).toBe('openai');
    });

    it('未知 Key 应返回 undefined', () => {
      expect(testable.getProviderForKey('unknown-key')).toBeUndefined();
    });

    it('空字符串 Key 应返回 undefined', () => {
      expect(testable.getProviderForKey('')).toBeUndefined();
    });
  });

  describe('getBuiltInApiKey', () => {
    it('指定 Provider 时应从对应 Key 池轮询获取', () => {
      expect(testable.getBuiltInApiKey('zhipu')).toBe('zhipu-key-1');
      expect(testable.getBuiltInApiKey('zhipu')).toBe('zhipu-key-2');
      expect(testable.getBuiltInApiKey('zhipu')).toBe('zhipu-key-1');
    });

    it('未指定 Provider 时应按 zhipu → deepseek → openai 优先级获取', () => {
      expect(testable.getBuiltInApiKey()).toBe('zhipu-key-1');
    });

    it('不存在的 Provider 应返回 undefined', () => {
      expect(testable.getBuiltInApiKey('unknown')).toBeUndefined();
    });

    it('单 Key 池的 getBuiltInApiKey 行为与原来一致', () => {
      const result1 = testable.getBuiltInApiKey('deepseek');
      const result2 = testable.getBuiltInApiKey('deepseek');
      const result3 = testable.getBuiltInApiKey('deepseek');
      expect(result1).toBe('deepseek-key-1');
      expect(result2).toBe('deepseek-key-1');
      expect(result3).toBe('deepseek-key-1');
    });

    it('zhipu Key 池为空时应回退到 deepseek', () => {
      testable.keyPools.delete('zhipu');
      testable.keyIndices.delete('zhipu');

      const key = testable.getBuiltInApiKey();
      expect(key).toBe('deepseek-key-1');

      testable.initializeKeyPools();
    });
  });
});
