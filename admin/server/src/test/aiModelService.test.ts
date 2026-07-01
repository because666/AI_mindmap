import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObjectId } from 'mongodb';

/**
 * AI 模型管理服务单元测试
 *
 * 测试目标：
 * - isValidProvider 服务商类型校验
 * - getAll 列表查询（含 apiKey 掩码处理）
 * - getById 单条查询
 * - create 创建配置（含字段校验、temperature/maxTokens 归一化、clearOtherDefaults 联动）
 * - update 更新配置（含 apiKey 空值保护、clearOtherDefaults 联动）
 * - delete 删除配置
 * - setDefault 设置默认模型
 * - maskApiKey 间接测试（通过 getAll 验证掩码格式）
 * - clearOtherDefaults 间接测试（通过 create/setDefault 验证 filter 行为）
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * 提升后可在 vi.mock 工厂中引用，保证 mock 函数引用稳定
 */
const {
  mockFind,
  mockFindOne,
  mockInsertOne,
  mockUpdateOne,
  mockUpdateMany,
  mockDeleteOne,
} = vi.hoisted(() => ({
  mockFind: vi.fn(),
  mockFindOne: vi.fn(),
  mockInsertOne: vi.fn(),
  mockUpdateOne: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockDeleteOne: vi.fn(),
}));

/**
 * 模拟 adminDB 模块
 * 仅 mock aiModelService 依赖的方法
 */
vi.mock('../config/database', () => ({
  adminDB: {
    find: mockFind,
    findOne: mockFindOne,
    insertOne: mockInsertOne,
    updateOne: mockUpdateOne,
    updateMany: mockUpdateMany,
    deleteOne: mockDeleteOne,
  },
}));

import { aiModelService, CreateAIModelData } from '../services/aiModelService';

/**
 * 构造一个合法的创建请求体
 * 各测试用例基于此对象做局部修改，避免重复构造
 */
function createValidCreateData(overrides: Partial<CreateAIModelData> = {}): CreateAIModelData {
  return {
    name: '测试模型',
    provider: 'zhipu',
    apiKey: 'sk-abcdef1234567',
    baseUrl: 'https://api.example.com',
    modelId: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: true,
    isDefault: false,
    priority: 1,
    ...overrides,
  };
}

/**
 * 构造一个数据库文档（AIModelConfig）
 * _id 使用带 toString 方法的对象模拟 ObjectId
 */
function createDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    _id: { toString: () => '507f1f77bcf86cd799439011' },
    name: '智谱GLM',
    provider: 'zhipu',
    apiKey: 'sk-abcdef1234567',
    baseUrl: 'https://open.bigmodel.cn',
    modelId: 'glm-4-flash',
    temperature: 0.7,
    maxTokens: 2048,
    isActive: true,
    isDefault: false,
    priority: 1,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  };
}

describe('AI 模型管理服务 aiModelService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertOne.mockResolvedValue('new-id-123');
    mockUpdateOne.mockResolvedValue(true);
    mockUpdateMany.mockResolvedValue(1);
    mockDeleteOne.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：isValidProvider 服务商类型校验
   */
  describe('isValidProvider', () => {
    it('zhipu 为合法服务商', () => {
      expect(aiModelService.isValidProvider('zhipu')).toBe(true);
    });

    it('deepseek 为合法服务商', () => {
      expect(aiModelService.isValidProvider('deepseek')).toBe(true);
    });

    it('openai 为合法服务商', () => {
      expect(aiModelService.isValidProvider('openai')).toBe(true);
    });

    it('custom 为合法服务商', () => {
      expect(aiModelService.isValidProvider('custom')).toBe(true);
    });

    it('未知字符串为非法服务商', () => {
      expect(aiModelService.isValidProvider('unknown')).toBe(false);
    });

    it('空字符串为非法服务商', () => {
      expect(aiModelService.isValidProvider('')).toBe(false);
    });

    it('claude 为非法服务商', () => {
      expect(aiModelService.isValidProvider('claude')).toBe(false);
    });
  });

  /**
   * 测试组：getAll 列表查询
   * 同时间接测试 maskApiKey 方法
   */
  describe('getAll', () => {
    it('正常返回列表并按 priority 升序、createdAt 降序排列', async () => {
      const docs = [
        createDoc({
          _id: { toString: () => 'id-1' },
          name: '模型A',
          priority: 1,
          apiKey: 'sk-abcdef1234567',
        }),
        createDoc({
          _id: { toString: () => 'id-2' },
          name: '模型B',
          priority: 2,
          apiKey: 'sk-xyz1234567890',
        }),
      ];
      mockFind.mockResolvedValue(docs);

      const result = await aiModelService.getAll();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('模型A');
      expect(result[1].name).toBe('模型B');
      // 验证调用 find 时传入了排序参数
      expect(mockFind).toHaveBeenCalledWith(
        'ai_model_configs',
        {},
        { sort: { priority: 1, createdAt: -1 } }
      );
    });

    it('长 apiKey 应做掩码处理，保留前 3 位与后 4 位', async () => {
      mockFind.mockResolvedValue([
        createDoc({ _id: { toString: () => 'id-1' }, apiKey: 'sk-abcdef1234567' }),
      ]);

      const result = await aiModelService.getAll();

      expect(result[0].apiKeyMasked).toBe('sk-***4567');
    });

    it('短 apiKey（长度 <= 7）应全部掩码为 ***', async () => {
      mockFind.mockResolvedValue([
        createDoc({ _id: { toString: () => 'id-1' }, apiKey: 'short1' }),
      ]);

      const result = await aiModelService.getAll();

      expect(result[0].apiKeyMasked).toBe('***');
    });

    it('空 apiKey 应返回空字符串', async () => {
      mockFind.mockResolvedValue([
        createDoc({ _id: { toString: () => 'id-1' }, apiKey: '' }),
      ]);

      const result = await aiModelService.getAll();

      expect(result[0].apiKeyMasked).toBe('');
    });

    it('返回的列表项中不应包含明文 apiKey 字段', async () => {
      mockFind.mockResolvedValue([createDoc({ apiKey: 'sk-secret-key-12345' })]);

      const result = await aiModelService.getAll();

      // 列表项类型中不应有 apiKey 字段，只有 apiKeyMasked
      expect(result[0]).not.toHaveProperty('apiKey');
      expect(result[0]).toHaveProperty('apiKeyMasked');
    });

    it('日期字段应转为 ISO 字符串', async () => {
      mockFind.mockResolvedValue([createDoc()]);

      const result = await aiModelService.getAll();

      expect(typeof result[0].createdAt).toBe('string');
      expect(typeof result[0].updatedAt).toBe('string');
      expect(result[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('空列表应返回空数组', async () => {
      mockFind.mockResolvedValue([]);

      const result = await aiModelService.getAll();

      expect(result).toEqual([]);
    });

    it('数据库异常时应向上抛出', async () => {
      mockFind.mockRejectedValue(new Error('数据库连接失败'));

      await expect(aiModelService.getAll()).rejects.toThrow('数据库连接失败');
    });
  });

  /**
   * 测试组：getById 单条查询
   */
  describe('getById', () => {
    it('合法 id 且文档存在时应返回原文档（含明文 apiKey）', async () => {
      const doc = createDoc({ _id: new ObjectId('507f1f77bcf86cd799439011') });
      mockFindOne.mockResolvedValue(doc);

      const result = await aiModelService.getById('507f1f77bcf86cd799439011');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('智谱GLM');
      expect(result?.apiKey).toBe('sk-abcdef1234567');
      expect(mockFindOne).toHaveBeenCalledWith(
        'ai_model_configs',
        { _id: new ObjectId('507f1f77bcf86cd799439011') }
      );
    });

    it('合法 id 但文档不存在时应返回 null', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await aiModelService.getById('507f1f77bcf86cd799439011');

      expect(result).toBeNull();
    });

    it('非法 id 应返回 null 且不查询数据库', async () => {
      const result = await aiModelService.getById('invalid-id');

      expect(result).toBeNull();
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('数据库异常时应向上抛出', async () => {
      mockFindOne.mockRejectedValue(new Error('查询失败'));

      await expect(
        aiModelService.getById('507f1f77bcf86cd799439011')
      ).rejects.toThrow('查询失败');
    });
  });

  /**
   * 测试组：create 创建配置
   * 同时间接测试 normalizeTemperature / normalizeMaxTokens / clearOtherDefaults
   */
  describe('create', () => {
    it('正常创建时应返回新文档 id', async () => {
      mockInsertOne.mockResolvedValue('new-id-456');

      const id = await aiModelService.create(createValidCreateData());

      expect(id).toBe('new-id-456');
      expect(mockInsertOne).toHaveBeenCalledWith('ai_model_configs', expect.objectContaining({
        name: '测试模型',
        provider: 'zhipu',
        apiKey: 'sk-abcdef1234567',
        modelId: 'glm-4-flash',
        temperature: 0.7,
        maxTokens: 2048,
        isActive: true,
        isDefault: false,
        priority: 1,
      }));
      // 文档应包含 createdAt/updatedAt
      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.createdAt).toBeInstanceOf(Date);
      expect(insertedDoc.updatedAt).toBeInstanceOf(Date);
    });

    it('名称为空时应抛出错误', async () => {
      await expect(
        aiModelService.create(createValidCreateData({ name: '' }))
      ).rejects.toThrow('模型名称不能为空');
      expect(mockInsertOne).not.toHaveBeenCalled();
    });

    it('名称仅含空白字符时应抛出错误', async () => {
      await expect(
        aiModelService.create(createValidCreateData({ name: '   ' }))
      ).rejects.toThrow('模型名称不能为空');
    });

    it('apiKey 为空时应抛出错误', async () => {
      await expect(
        aiModelService.create(createValidCreateData({ apiKey: '' }))
      ).rejects.toThrow('API Key 不能为空');
      expect(mockInsertOne).not.toHaveBeenCalled();
    });

    it('apiKey 仅含空白字符时应抛出错误', async () => {
      await expect(
        aiModelService.create(createValidCreateData({ apiKey: '   ' }))
      ).rejects.toThrow('API Key 不能为空');
    });

    it('modelId 为空时应抛出错误', async () => {
      await expect(
        aiModelService.create(createValidCreateData({ modelId: '' }))
      ).rejects.toThrow('模型 ID 不能为空');
      expect(mockInsertOne).not.toHaveBeenCalled();
    });

    it('provider 非法时应抛出错误', async () => {
      await expect(
        aiModelService.create(
          createValidCreateData({ provider: 'claude' as CreateAIModelData['provider'] })
        )
      ).rejects.toThrow(/服务商类型无效/);
      expect(mockInsertOne).not.toHaveBeenCalled();
    });

    it('isDefault=true 时应先调用 clearOtherDefaults 清除其他默认', async () => {
      await aiModelService.create(createValidCreateData({ isDefault: true }));

      // create 时不传 excludeId，filter 中应只有 isDefault: true
      expect(mockUpdateMany).toHaveBeenCalledWith(
        'ai_model_configs',
        { isDefault: true },
        { $set: { isDefault: false, updatedAt: expect.any(Date) } }
      );
    });

    it('isDefault=false 时不应调用 clearOtherDefaults', async () => {
      await aiModelService.create(createValidCreateData({ isDefault: false }));

      expect(mockUpdateMany).not.toHaveBeenCalled();
    });

    it('temperature=0 时应归一化为 0（边界下限）', async () => {
      await aiModelService.create(createValidCreateData({ temperature: 0 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.temperature).toBe(0);
    });

    it('temperature=2 时应归一化为 2（边界上限）', async () => {
      await aiModelService.create(createValidCreateData({ temperature: 2 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.temperature).toBe(2);
    });

    it('temperature 为负数时应归一化为 0', async () => {
      await aiModelService.create(createValidCreateData({ temperature: -1.5 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.temperature).toBe(0);
    });

    it('temperature 超过 2 时应归一化为 2', async () => {
      await aiModelService.create(createValidCreateData({ temperature: 5 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.temperature).toBe(2);
    });

    it('temperature 为 NaN 时应使用默认值 0.7', async () => {
      await aiModelService.create(createValidCreateData({ temperature: NaN }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.temperature).toBe(0.7);
    });

    it('maxTokens=1 时应归一化为 1（边界下限）', async () => {
      await aiModelService.create(createValidCreateData({ maxTokens: 1 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.maxTokens).toBe(1);
    });

    it('maxTokens=32000 时应归一化为 32000（边界上限）', async () => {
      await aiModelService.create(createValidCreateData({ maxTokens: 32000 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.maxTokens).toBe(32000);
    });

    it('maxTokens 为小数时应向下取整', async () => {
      await aiModelService.create(createValidCreateData({ maxTokens: 100.7 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.maxTokens).toBe(100);
    });

    it('maxTokens 超过 32000 时应归一化为 32000', async () => {
      await aiModelService.create(createValidCreateData({ maxTokens: 100000 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.maxTokens).toBe(32000);
    });

    it('maxTokens 为负数时应归一化为 1', async () => {
      await aiModelService.create(createValidCreateData({ maxTokens: -100 }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.maxTokens).toBe(1);
    });

    it('maxTokens 为 NaN 时应使用默认值 2048', async () => {
      await aiModelService.create(createValidCreateData({ maxTokens: NaN }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.maxTokens).toBe(2048);
    });

    it('name 与 apiKey 应做 trim 处理', async () => {
      await aiModelService.create(
        createValidCreateData({ name: '  测试模型  ', apiKey: '  sk-key-1234567  ' })
      );

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.name).toBe('测试模型');
      expect(insertedDoc.apiKey).toBe('sk-key-1234567');
    });

    it('baseUrl 为空字符串时应使用空字符串', async () => {
      await aiModelService.create(createValidCreateData({ baseUrl: '' }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.baseUrl).toBe('');
    });

    it('isActive 未传（undefined）时默认为 true', async () => {
      // 通过类型断言绕过必填校验，模拟未传字段的场景
      const data = createValidCreateData();
      delete (data as Partial<CreateAIModelData>).isActive;
      await aiModelService.create(data as CreateAIModelData);

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.isActive).toBe(true);
    });

    it('isActive=false 时应保持 false', async () => {
      await aiModelService.create(createValidCreateData({ isActive: false }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.isActive).toBe(false);
    });

    it('priority 为 NaN 时应使用默认值 99', async () => {
      await aiModelService.create(createValidCreateData({ priority: NaN }));

      const insertedDoc = mockInsertOne.mock.calls[0][1] as Record<string, unknown>;
      expect(insertedDoc.priority).toBe(99);
    });
  });

  /**
   * 测试组：update 更新配置
   */
  describe('update', () => {
    it('正常更新时应调用 updateOne 并返回 true', async () => {
      mockUpdateOne.mockResolvedValue(true);

      const result = await aiModelService.update('507f1f77bcf86cd799439011', {
        name: '新名称',
        baseUrl: 'https://new.url',
      });

      expect(result).toBe(true);
      expect(mockUpdateOne).toHaveBeenCalledWith(
        'ai_model_configs',
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        {
          $set: expect.objectContaining({
            name: '新名称',
            baseUrl: 'https://new.url',
            updatedAt: expect.any(Date),
          }),
        }
      );
    });

    it('非法 id 应返回 false 且不调用 updateOne', async () => {
      const result = await aiModelService.update('invalid-id', { name: '新名称' });

      expect(result).toBe(false);
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('apiKey 为空字符串时不应更新 apiKey 字段', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', {
        name: '新名称',
        apiKey: '',
      });

      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set).not.toHaveProperty('apiKey');
      expect(updateArg.$set.name).toBe('新名称');
    });

    it('apiKey 为 undefined 时不应更新 apiKey 字段', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', {
        apiKey: undefined,
        name: '新名称',
      });

      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set).not.toHaveProperty('apiKey');
    });

    it('apiKey 为非空字符串时应更新并 trim', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', {
        apiKey: '  sk-new-key-12345  ',
      });

      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set.apiKey).toBe('sk-new-key-12345');
    });

    it('isDefault=true 时应先调用 clearOtherDefaults（带 excludeId）', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', { isDefault: true });

      // 传入 excludeId 时，filter 中应包含 _id: { $ne: ObjectId }
      expect(mockUpdateMany).toHaveBeenCalledWith(
        'ai_model_configs',
        { isDefault: true, _id: { $ne: new ObjectId('507f1f77bcf86cd799439011') } },
        { $set: { isDefault: false, updatedAt: expect.any(Date) } }
      );
      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set.isDefault).toBe(true);
    });

    it('isDefault=false 时应直接设置 isDefault=false，不调用 clearOtherDefaults', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', { isDefault: false });

      expect(mockUpdateMany).not.toHaveBeenCalled();
      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set.isDefault).toBe(false);
    });

    it('name 为空字符串时应抛出错误', async () => {
      await expect(
        aiModelService.update('507f1f77bcf86cd799439011', { name: '' })
      ).rejects.toThrow('模型名称不能为空');
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('name 仅含空白字符时应抛出错误', async () => {
      await expect(
        aiModelService.update('507f1f77bcf86cd799439011', { name: '   ' })
      ).rejects.toThrow('模型名称不能为空');
    });

    it('provider 非法时应抛出错误', async () => {
      await expect(
        aiModelService.update('507f1f77bcf86cd799439011', {
          provider: 'claude' as CreateAIModelData['provider'],
        })
      ).rejects.toThrow(/服务商类型无效/);
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('modelId 为空字符串时应抛出错误', async () => {
      await expect(
        aiModelService.update('507f1f77bcf86cd799439011', { modelId: '' })
      ).rejects.toThrow('模型 ID 不能为空');
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('temperature 字段也应归一化', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', { temperature: 5 });

      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set.temperature).toBe(2);
    });

    it('maxTokens 字段也应归一化（向下取整）', async () => {
      await aiModelService.update('507f1f77bcf86cd799439011', { maxTokens: 100.9 });

      const updateArg = mockUpdateOne.mock.calls[0][2] as { $set: Record<string, unknown> };
      expect(updateArg.$set.maxTokens).toBe(100);
    });

    it('无任何字段更新时应返回 false', async () => {
      const result = await aiModelService.update('507f1f77bcf86cd799439011', {});

      expect(result).toBe(false);
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('仅传 apiKey 空字符串时视为无字段更新返回 false', async () => {
      const result = await aiModelService.update('507f1f77bcf86cd799439011', { apiKey: '' });

      expect(result).toBe(false);
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });
  });

  /**
   * 测试组：delete 删除配置
   */
  describe('delete', () => {
    it('正常删除时应返回 true', async () => {
      mockDeleteOne.mockResolvedValue(true);

      const result = await aiModelService.delete('507f1f77bcf86cd799439011');

      expect(result).toBe(true);
      expect(mockDeleteOne).toHaveBeenCalledWith('ai_model_configs', {
        _id: new ObjectId('507f1f77bcf86cd799439011'),
      });
    });

    it('文档不存在时应返回 false', async () => {
      mockDeleteOne.mockResolvedValue(false);

      const result = await aiModelService.delete('507f1f77bcf86cd799439011');

      expect(result).toBe(false);
    });

    it('非法 id 应返回 false 且不调用 deleteOne', async () => {
      const result = await aiModelService.delete('invalid-id');

      expect(result).toBe(false);
      expect(mockDeleteOne).not.toHaveBeenCalled();
    });
  });

  /**
   * 测试组：setDefault 设置默认模型
   * 同时间接测试 clearOtherDefaults（带 excludeId）
   */
  describe('setDefault', () => {
    it('正常设置时应先 getById 验证存在，再 clearOtherDefaults，最后 updateOne', async () => {
      mockFindOne.mockResolvedValue(createDoc());
      mockUpdateOne.mockResolvedValue(true);

      const result = await aiModelService.setDefault('507f1f77bcf86cd799439011');

      expect(result).toBe(true);
      // 验证先查询文档是否存在
      expect(mockFindOne).toHaveBeenCalledWith(
        'ai_model_configs',
        { _id: new ObjectId('507f1f77bcf86cd799439011') }
      );
      // 验证清除其他默认时带 excludeId
      expect(mockUpdateMany).toHaveBeenCalledWith(
        'ai_model_configs',
        { isDefault: true, _id: { $ne: new ObjectId('507f1f77bcf86cd799439011') } },
        { $set: { isDefault: false, updatedAt: expect.any(Date) } }
      );
      // 验证最后设置目标为默认
      expect(mockUpdateOne).toHaveBeenCalledWith(
        'ai_model_configs',
        { _id: new ObjectId('507f1f77bcf86cd799439011') },
        { $set: { isDefault: true, updatedAt: expect.any(Date) } }
      );
    });

    it('文档不存在时应返回 false 且不调用 updateMany/updateOne', async () => {
      mockFindOne.mockResolvedValue(null);

      const result = await aiModelService.setDefault('507f1f77bcf86cd799439011');

      expect(result).toBe(false);
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });

    it('非法 id 应返回 false 且不调用任何数据库方法', async () => {
      const result = await aiModelService.setDefault('invalid-id');

      expect(result).toBe(false);
      expect(mockFindOne).not.toHaveBeenCalled();
      expect(mockUpdateMany).not.toHaveBeenCalled();
      expect(mockUpdateOne).not.toHaveBeenCalled();
    });
  });
});
