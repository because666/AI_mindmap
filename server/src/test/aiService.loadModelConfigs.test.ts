import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';

/**
 * AIService 模型配置加载单元测试
 *
 * 测试目标：
 * - loadModelConfigsFromDB 从 MongoDB 加载启用的模型配置
 * - refreshModelConfigs 触发重新加载
 *
 * 重点验证：
 * - 正常加载：getCollection 返回 mock collection，find 返回多个活跃配置
 * - DB 未连接：getCollection 返回 null，console.warn 且 return 0
 * - 无启用配置：find 返回空数组，return 0
 * - 异常回退：find 抛错，catch 块 console.warn 且 return 0，providers 保持原值
 * - refreshModelConfigs 调用 loadModelConfigsFromDB
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 */
const { mockConfig, mockGetCollection, mockFindSortToArray, mockFindSort } = vi.hoisted(() => ({
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
      aiModelConfigsCollection: 'ai_model_configs',
    },
  },
  mockGetCollection: vi.fn(),
  mockFindSortToArray: vi.fn(),
  mockFindSort: vi.fn(),
}));

/**
 * 模拟 config 模块
 */
vi.mock('../config', () => ({
  config: mockConfig,
}));

/**
 * 模拟 openai 模块（AIService 构造时会 new OpenAI()）
 */
vi.mock('openai', () => ({
  default: class MockOpenAI {
    constructor() {}
  },
}));

/**
 * 模拟 vectorDBService（aiService 导入但本测试未使用）
 */
vi.mock('../data/vector/connection', () => ({
  vectorDBService: {},
}));

/**
 * 模拟 mongoDBService
 * getCollection 返回 mock collection 或 null
 */
vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {
    getCollection: mockGetCollection,
  },
}));

import { aiService } from '../services/aiService';

/**
 * 构造一个 mock MongoDB Collection
 * find(...).sort(...).toArray() 链式调用
 */
function createMockCollection() {
  const toArray = mockFindSortToArray;
  const sort = mockFindSort.mockReturnValue({ toArray });
  const find = vi.fn().mockReturnValue({ sort });
  return { find, sort, toArray };
}

/**
 * 构造一个 AIModelConfigDocument 对象
 */
function createDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: new ObjectId('507f1f77bcf86cd799439011'),
    name: '智谱GLM',
    provider: 'zhipu',
    apiKey: 'zhipu-key-1',
    baseUrl: 'https://open.bigmodel.cn',
    modelId: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: true,
    isDefault: false,
    priority: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-06-01'),
    ...overrides,
  };
}

/**
 * AIService 测试访问接口
 * 通过类型断言访问私有成员，用于单元测试
 */
interface AIServiceTestable {
  providers: Array<{ id: string; name: string; url: string; apiKey: string; model: string; priority: number }>;
  updateProviders(newProviders: Array<{ id: string; name: string; url: string; apiKey: string; model: string; priority: number }>): void;
}

/**
 * 获取 AIService 的测试访问接口
 */
function getTestable(): AIServiceTestable {
  return aiService as unknown as AIServiceTestable;
}

describe('AIService 模型配置加载', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindSortToArray.mockResolvedValue([]);
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：loadModelConfigsFromDB 正常场景
   */
  describe('loadModelConfigsFromDB - 正常加载', () => {
    it('应从数据库加载多个活跃配置并返回加载数量', async () => {
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          name: '智谱GLM',
          provider: 'zhipu',
          apiKey: 'zhipu-key-1',
          modelId: 'glm-4-flash',
          priority: 1,
        }),
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439012'),
          name: 'DeepSeek',
          provider: 'deepseek',
          apiKey: 'deepseek-key-1',
          modelId: 'deepseek-chat',
          priority: 2,
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.loadModelConfigsFromDB();

      expect(count).toBe(2);
      // 验证 getCollection 用正确的集合名调用
      expect(mockGetCollection).toHaveBeenCalledWith('ai_model_configs');
      // 验证 find 用 { isActive: true } 调用
      expect(mockCollection.find).toHaveBeenCalledWith({ isActive: true });
      // 验证 sort 用 { priority: 1, createdAt: 1 } 调用
      expect(mockCollection.sort).toHaveBeenCalledWith({ priority: 1, createdAt: 1 });
    });

    it('应将数据库文档映射为 AIProvider 配置并调用 updateProviders', async () => {
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          name: '智谱GLM',
          apiKey: 'zhipu-key-1',
          baseUrl: 'https://open.bigmodel.cn',
          modelId: 'glm-4-flash',
          priority: 1,
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      const testable = getTestable();
      const updateSpy = vi.spyOn(testable, 'updateProviders');

      await aiService.loadModelConfigsFromDB();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      const passedProviders = updateSpy.mock.calls[0][0];
      expect(passedProviders).toHaveLength(1);
      expect(passedProviders[0]).toMatchObject({
        id: '507f1f77bcf86cd799439011', // 使用 _id.toString() 作为 provider id
        name: '智谱GLM',
        url: 'https://open.bigmodel.cn',
        apiKey: 'zhipu-key-1',
        model: 'glm-4-flash',
        priority: 1,
      });
    });

    it('加载后 getProviders 应返回按 priority 升序排列的列表', async () => {
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439013'),
          name: '低优先级',
          priority: 99,
        }),
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          name: '高优先级',
          priority: 1,
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      await aiService.loadModelConfigsFromDB();

      const providers = aiService.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers[0].name).toBe('高优先级');
      expect(providers[1].name).toBe('低优先级');
    });

    it('存在默认模型时应输出日志', async () => {
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          name: '智谱GLM',
          provider: 'zhipu',
          modelId: 'glm-4-flash',
          isDefault: true,
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      await aiService.loadModelConfigsFromDB();

      // 验证日志包含默认模型信息
      const defaultLogCall = consoleLogSpy.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('默认模型')
      );
      expect(defaultLogCall).toBeDefined();
    });

    it('baseUrl 为空字符串时应映射为空字符串', async () => {
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          baseUrl: '',
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      await aiService.loadModelConfigsFromDB();

      const providers = aiService.getProviders();
      expect(providers[0].url).toBe('');
    });
  });

  /**
   * 测试组：loadModelConfigsFromDB DB 未连接
   */
  describe('loadModelConfigsFromDB - DB 未连接', () => {
    it('getCollection 返回 null 时应输出 warn 并返回 0', async () => {
      mockGetCollection.mockReturnValue(null);

      const count = await aiService.loadModelConfigsFromDB();

      expect(count).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('MongoDB 未连接')
      );
    });

    it('DB 未连接时不应调用 find', async () => {
      mockGetCollection.mockReturnValue(null);

      await aiService.loadModelConfigsFromDB();

      // mockFindSort 不应被调用
      expect(mockFindSort).not.toHaveBeenCalled();
    });
  });

  /**
   * 测试组：loadModelConfigsFromDB 无启用配置
   */
  describe('loadModelConfigsFromDB - 无启用配置', () => {
    it('find 返回空数组时应返回 0 并输出提示日志', async () => {
      mockFindSortToArray.mockResolvedValue([]);

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.loadModelConfigsFromDB();

      expect(count).toBe(0);
      // 验证输出 "未找到启用的模型配置" 日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('未找到启用的模型配置')
      );
    });
  });

  /**
   * 测试组：loadModelConfigsFromDB 异常回退
   */
  describe('loadModelConfigsFromDB - 异常回退', () => {
    it('find 抛错时应捕获、输出 warn 并返回 0', async () => {
      const mockCollection = createMockCollection();
      mockCollection.find.mockImplementation(() => {
        throw new Error('find 查询失败');
      });
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.loadModelConfigsFromDB();

      expect(count).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('从数据库加载模型配置失败')
      );
    });

    it('sort 抛错时应捕获、输出 warn 并返回 0', async () => {
      const mockCollection = createMockCollection();
      // 在 createMockCollection 设置 mockReturnValue 之后覆盖为抛错
      mockCollection.sort.mockImplementation(() => {
        throw new Error('sort 失败');
      });
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.loadModelConfigsFromDB();

      expect(count).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('从数据库加载模型配置失败')
      );
    });

    it('toArray 抛错时应捕获、输出 warn 并返回 0', async () => {
      mockFindSortToArray.mockRejectedValue(new Error('toArray 失败'));

      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.loadModelConfigsFromDB();

      expect(count).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('从数据库加载模型配置失败')
      );
    });

    it('异常时 providers 应保持原值不被清空', async () => {
      // 先正常加载一次，设置 providers
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          name: '正常模型',
          priority: 1,
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      await aiService.loadModelConfigsFromDB();
      const providersBeforeError = aiService.getProviders();
      expect(providersBeforeError).toHaveLength(1);

      // 现在模拟异常
      mockCollection.find.mockImplementation(() => {
        throw new Error('异常');
      });

      await aiService.loadModelConfigsFromDB();

      // providers 应保持原值
      const providersAfterError = aiService.getProviders();
      expect(providersAfterError).toHaveLength(1);
      expect(providersAfterError[0].name).toBe('正常模型');
    });
  });

  /**
   * 测试组：refreshModelConfigs
   */
  describe('refreshModelConfigs', () => {
    it('应调用 loadModelConfigsFromDB 并返回加载数量', async () => {
      const docs = [
        createDoc({
          _id: new ObjectId('507f1f77bcf86cd799439011'),
          name: '刷新模型',
          priority: 1,
        }),
      ];
      mockFindSortToArray.mockResolvedValue(docs);
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.refreshModelConfigs();

      expect(count).toBe(1);
      // 验证输出了刷新请求日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('收到刷新请求')
      );
      // 验证 getCollection 被调用（间接证明 loadModelConfigsFromDB 被调用）
      expect(mockGetCollection).toHaveBeenCalledWith('ai_model_configs');
    });

    it('DB 未连接时 refreshModelConfigs 也应返回 0', async () => {
      mockGetCollection.mockReturnValue(null);

      const count = await aiService.refreshModelConfigs();

      expect(count).toBe(0);
    });

    it('refreshModelConfigs 异常时应返回 0 不抛错', async () => {
      const mockCollection = createMockCollection();
      mockCollection.find.mockImplementation(() => {
        throw new Error('刷新异常');
      });
      mockGetCollection.mockReturnValue(mockCollection);

      const count = await aiService.refreshModelConfigs();

      expect(count).toBe(0);
    });
  });
});
