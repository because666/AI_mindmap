import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * AI 用量统计服务单元测试
 *
 * 测试目标：
 * - getModelSummary 模型用量汇总
 * - 间接测试 buildMatchFilter（通过 startDate/endDate 验证 matchFilter 内容）
 *
 * 重点验证：
 * - totalCalls/successCalls/failedCalls 计算正确
 * - failureRate 计算（保留两位小数、totalCalls=0 时为 0）
 * - tokens 字段累加
 * - 空数据返回空数组
 * - 数据库异常时降级返回空数组
 */

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * getCollection 返回 mock collection，collection.aggregate 返回带 toArray 的对象
 */
const { mockGetCollection, mockAggregateToArray } = vi.hoisted(() => ({
  mockGetCollection: vi.fn(),
  mockAggregateToArray: vi.fn(),
}));

/**
 * 模拟 adminDB 模块
 * 仅 mock aiUsageService 依赖的方法
 */
vi.mock('../config/database', () => ({
  adminDB: {
    getCollection: mockGetCollection,
  },
}));

import { aiUsageService } from '../services/aiUsageService';

/**
 * 构造一个 mock MongoDB Collection
 * aggregate 方法返回带 toArray 方法的对象
 */
function createMockCollection() {
  return {
    aggregate: vi.fn().mockReturnValue({
      toArray: mockAggregateToArray,
    }),
  };
}

describe('AI 用量统计服务 aiUsageService - getModelSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAggregateToArray.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * 测试组：正常聚合场景
   */
  describe('正常聚合', () => {
    it('应正确汇总多个模型的调用量、token 消耗、失败率', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'glm-4-flash', provider: 'zhipu' },
          totalCalls: 100,
          successCalls: 80,
          failedCalls: 20,
          promptTokens: 5000,
          completionTokens: 3000,
          totalTokens: 8000,
          avgResponseTime: 1234.56,
        },
        {
          _id: { model: 'deepseek-chat', provider: 'deepseek' },
          totalCalls: 50,
          successCalls: 50,
          failedCalls: 0,
          promptTokens: 2000,
          completionTokens: 1000,
          totalTokens: 3000,
          avgResponseTime: 500.5,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result).toHaveLength(2);
      // 验证第一个模型
      expect(result[0]).toMatchObject({
        model: 'glm-4-flash',
        provider: 'zhipu',
        totalCalls: 100,
        successCalls: 80,
        failedCalls: 20,
        failureRate: 20,
        promptTokens: 5000,
        completionTokens: 3000,
        totalTokens: 8000,
        avgResponseTime: 1235, // Math.round(1234.56) = 1235
      });
      // 验证第二个模型
      expect(result[1]).toMatchObject({
        model: 'deepseek-chat',
        provider: 'deepseek',
        totalCalls: 50,
        successCalls: 50,
        failedCalls: 0,
        failureRate: 0,
        totalTokens: 3000,
        avgResponseTime: 501, // Math.round(500.5) = 501
      });
    });

    it('model 或 provider 为空时应使用 unknown 兜底', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: '', provider: '' },
          totalCalls: 10,
          successCalls: 5,
          failedCalls: 5,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          avgResponseTime: 0,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0].model).toBe('unknown');
      expect(result[0].provider).toBe('unknown');
    });

    it('聚合字段缺失时应使用 0 兜底', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'glm-4-flash', provider: 'zhipu' },
          // 所有统计字段缺失
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0]).toMatchObject({
        model: 'glm-4-flash',
        provider: 'zhipu',
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        failureRate: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        avgResponseTime: 0,
      });
    });

    it('avgResponseTime 应通过 Math.round 取整', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'm1', provider: 'zhipu' },
          totalCalls: 1,
          successCalls: 1,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          avgResponseTime: 999.99,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0].avgResponseTime).toBe(1000);
    });
  });

  /**
   * 测试组：失败率计算
   */
  describe('失败率计算', () => {
    it('failureRate 应为 failedCalls/totalCalls*100 并保留两位小数', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      // 1/3 = 33.333...%, 保留两位小数为 33.33
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'm1', provider: 'zhipu' },
          totalCalls: 3,
          successCalls: 2,
          failedCalls: 1,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          avgResponseTime: 0,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0].failureRate).toBe(33.33);
    });

    it('totalCalls=0 时 failureRate 应为 0', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'm1', provider: 'zhipu' },
          totalCalls: 0,
          successCalls: 0,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          avgResponseTime: 0,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0].failureRate).toBe(0);
    });

    it('100% 失败时 failureRate 应为 100', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'm1', provider: 'zhipu' },
          totalCalls: 100,
          successCalls: 0,
          failedCalls: 100,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          avgResponseTime: 0,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0].failureRate).toBe(100);
    });

    it('0% 失败时 failureRate 应为 0', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([
        {
          _id: { model: 'm1', provider: 'zhipu' },
          totalCalls: 100,
          successCalls: 100,
          failedCalls: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          avgResponseTime: 0,
        },
      ]);

      const result = await aiUsageService.getModelSummary();

      expect(result[0].failureRate).toBe(0);
    });
  });

  /**
   * 测试组：日期筛选
   * 间接测试 buildMatchFilter 私有方法
   */
  describe('日期筛选', () => {
    it('传入 startDate 与 endDate 时聚合管道应包含 createdAt 范围筛选', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([]);

      await aiUsageService.getModelSummary('2024-01-01', '2024-06-30');

      // 验证 aggregate 调用时 pipeline 的 $match 阶段包含 createdAt 范围
      const pipeline = mockCollection.aggregate.mock.calls[0][0] as Array<{
        $match?: Record<string, unknown>;
      }>;
      const matchStage = pipeline.find((stage) => stage.$match !== undefined)?.$match;
      expect(matchStage).toBeDefined();
      expect(matchStage?.createdAt).toBeDefined();
      const createdAtFilter = matchStage?.createdAt as { $gte: Date; $lte: Date };
      expect(createdAtFilter.$gte).toBeInstanceOf(Date);
      expect(createdAtFilter.$lte).toBeInstanceOf(Date);
      // 验证日期值正确
      expect(createdAtFilter.$gte.getTime()).toBe(new Date('2024-01-01').getTime());
      expect(createdAtFilter.$lte.getTime()).toBe(new Date('2024-06-30').getTime());
    });

    it('仅传入 startDate 时应只包含 $gte 条件', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([]);

      await aiUsageService.getModelSummary('2024-01-01');

      const pipeline = mockCollection.aggregate.mock.calls[0][0] as Array<{
        $match?: Record<string, unknown>;
      }>;
      const matchStage = pipeline.find((stage) => stage.$match !== undefined)?.$match;
      const createdAtFilter = matchStage?.createdAt as { $gte: Date; $lte?: Date };
      expect(createdAtFilter.$gte).toBeInstanceOf(Date);
      expect(createdAtFilter.$lte).toBeUndefined();
    });

    it('仅传入 endDate 时应只包含 $lte 条件', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([]);

      await aiUsageService.getModelSummary(undefined, '2024-06-30');

      const pipeline = mockCollection.aggregate.mock.calls[0][0] as Array<{
        $match?: Record<string, unknown>;
      }>;
      const matchStage = pipeline.find((stage) => stage.$match !== undefined)?.$match;
      const createdAtFilter = matchStage?.createdAt as { $gte?: Date; $lte: Date };
      expect(createdAtFilter.$gte).toBeUndefined();
      expect(createdAtFilter.$lte).toBeInstanceOf(Date);
    });

    it('不传日期时 matchFilter 应为空对象', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([]);

      await aiUsageService.getModelSummary();

      const pipeline = mockCollection.aggregate.mock.calls[0][0] as Array<{
        $match?: Record<string, unknown>;
      }>;
      const matchStage = pipeline.find((stage) => stage.$match !== undefined)?.$match;
      expect(matchStage).toEqual({});
    });

    it('聚合管道应包含 $group 与 $sort 阶段', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([]);

      await aiUsageService.getModelSummary();

      const pipeline = mockCollection.aggregate.mock.calls[0][0] as Array<Record<string, unknown>>;
      // 至少应包含 $match、$group、$sort 三个阶段
      expect(pipeline.some((s) => s.$match !== undefined)).toBe(true);
      expect(pipeline.some((s) => s.$group !== undefined)).toBe(true);
      expect(pipeline.some((s) => s.$sort !== undefined)).toBe(true);
      // $sort 应按 totalCalls 降序
      const sortStage = pipeline.find((s) => s.$sort !== undefined)?.$sort as {
        totalCalls: number;
      };
      expect(sortStage.totalCalls).toBe(-1);
    });
  });

  /**
   * 测试组：空数据
   */
  describe('空数据', () => {
    it('aggregate 返回空数组时应返回空数组', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockResolvedValue([]);

      const result = await aiUsageService.getModelSummary();

      expect(result).toEqual([]);
    });

    it('数据库未连接（getCollection 返回 null）时应返回空数组', async () => {
      mockGetCollection.mockReturnValue(null);

      const result = await aiUsageService.getModelSummary();

      expect(result).toEqual([]);
      expect(mockAggregateToArray).not.toHaveBeenCalled();
    });
  });

  /**
   * 测试组：数据库异常
   */
  describe('数据库异常', () => {
    it('aggregate.toArray 抛错时应捕获并返回空数组', async () => {
      const mockCollection = createMockCollection();
      mockGetCollection.mockReturnValue(mockCollection);
      mockAggregateToArray.mockRejectedValue(new Error('数据库查询失败'));

      const result = await aiUsageService.getModelSummary();

      expect(result).toEqual([]);
    });

    it('aggregate 方法本身抛错时应捕获并返回空数组', async () => {
      const mockCollection = {
        aggregate: vi.fn().mockImplementation(() => {
          throw new Error('聚合管道构造失败');
        }),
      };
      mockGetCollection.mockReturnValue(mockCollection);

      const result = await aiUsageService.getModelSummary();

      expect(result).toEqual([]);
    });
  });
});
