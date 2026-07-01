import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * NodeService 工具函数 safeDate / safeIso 单元测试
 *
 * 测试目标：验证从 Neo4j/Redis 读取的非法日期值（undefined/null/空字符串/非法字符串）
 * 不会传播为 Invalid Date，避免 toISOString() 抛出 RangeError: Invalid time value
 *
 * 由于 safeDate / safeIso 为私有方法，这里通过类型断言将其暴露为公共接口进行测试，
 * 断言过程使用 unknown 中转，全程不使用 any 类型，符合项目编码规范。
 * 通过 vi.doMock 屏蔽数据库连接依赖，避免测试产生外部副作用。
 */

/**
 * 私有方法访问器类型
 * 将 nodeService 实例断言为带公共 safeDate / safeIso 方法的形状，仅用于测试
 */
type NodeServiceTestAccessor = {
  safeDate: (value: unknown, fieldName?: string) => Date;
  safeIso: (date: Date, fieldName?: string) => string;
};

/**
 * 动态导入 NodeService 并返回带私有方法访问器的实例
 * 通过 vi.doMock 屏蔽 neo4j/mongodb/redis/vector 等外部依赖，确保测试无副作用
 * @returns 暴露 safeDate / safeIso 的访问器对象
 */
async function getPrivateAccessor(): Promise<NodeServiceTestAccessor> {
  vi.resetModules();

  vi.doMock('../data/redis/connection', () => ({
    redisService: { getClient: () => null, isConnected: () => false },
  }));
  vi.doMock('../data/neo4j/connection', () => ({
    neo4jService: { isConnected: () => false, runQuery: vi.fn() },
  }));
  vi.doMock('../data/mongodb/connection', () => ({
    mongoDBService: { isConnected: () => false },
  }));
  vi.doMock('../data/vector/connection', () => ({
    vectorDBService: { isConnected: () => false },
  }));

  const mod = await import('./nodeService');
  return mod.nodeService as unknown as NodeServiceTestAccessor;
}

describe('NodeService - safeDate', () => {
  let accessor: NodeServiceTestAccessor;

  beforeEach(async () => {
    accessor = await getPrivateAccessor();
    // 屏蔽 console.warn，避免测试输出污染
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('undefined 入参时回退到当前时间', () => {
    const before = Date.now();
    const result = accessor.safeDate(undefined, 'createdAt');
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
    expect(console.warn).toHaveBeenCalled();
  });

  it('null 入参时回退到当前时间', () => {
    const before = Date.now();
    const result = accessor.safeDate(null, 'updatedAt');
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
    expect(console.warn).toHaveBeenCalled();
  });

  it('空字符串入参时回退到当前时间', () => {
    const before = Date.now();
    const result = accessor.safeDate('', 'createdAt');
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
    expect(console.warn).toHaveBeenCalled();
  });

  it('非法字符串入参（如 "invalid-date"）时回退到当前时间', () => {
    const before = Date.now();
    const result = accessor.safeDate('invalid-date', 'createdAt');
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
    expect(console.warn).toHaveBeenCalled();
  });

  it('合法 ISO 字符串入参时返回对应日期', () => {
    const isoString = '2025-06-15T08:30:00.000Z';
    const result = accessor.safeDate(isoString, 'createdAt');
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(isoString);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('合法 Date 对象入参时返回同一日期', () => {
    const original = new Date('2025-01-01T00:00:00.000Z');
    const result = accessor.safeDate(original, 'createdAt');
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBe(original.getTime());
    expect(result.toISOString()).toBe(original.toISOString());
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('默认 fieldName 为 "date"', () => {
    // 仅验证不传 fieldName 时不会抛错，并触发 warn
    const result = accessor.safeDate(undefined);
    expect(result).toBeInstanceOf(Date);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[NodeService] date 为空')
    );
  });

  it('Invalid Date 对象入参时回退到当前时间', () => {
    const invalidDate = new Date('not-a-date');
    expect(isNaN(invalidDate.getTime())).toBe(true);
    const before = Date.now();
    const result = accessor.safeDate(invalidDate, 'createdAt');
    const after = Date.now();
    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('NodeService - safeIso', () => {
  let accessor: NodeServiceTestAccessor;

  beforeEach(async () => {
    accessor = await getPrivateAccessor();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('undefined 入参时回退到当前时间的 ISO 字符串', () => {
    const before = new Date().toISOString();
    const result = accessor.safeIso(undefined as unknown as Date, 'createdAt');
    const after = new Date().toISOString();
    expect(typeof result).toBe('string');
    // ISO 字符串按字典序可正确比较同一时区的时间顺序
    expect(result >= before).toBe(true);
    expect(result <= after).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('Invalid Date 入参时回退到当前时间的 ISO 字符串', () => {
    const invalidDate = new Date('invalid');
    const before = new Date().toISOString();
    const result = accessor.safeIso(invalidDate, 'createdAt');
    const after = new Date().toISOString();
    expect(typeof result).toBe('string');
    expect(result >= before).toBe(true);
    expect(result <= after).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });

  it('合法 Date 入参时返回正确 ISO 字符串', () => {
    const date = new Date('2025-06-15T08:30:00.000Z');
    const result = accessor.safeIso(date, 'createdAt');
    expect(result).toBe('2025-06-15T08:30:00.000Z');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('null 入参时回退到当前时间的 ISO 字符串', () => {
    const before = new Date().toISOString();
    const result = accessor.safeIso(null as unknown as Date, 'updatedAt');
    const after = new Date().toISOString();
    expect(typeof result).toBe('string');
    expect(result >= before).toBe(true);
    expect(result <= after).toBe(true);
    expect(console.warn).toHaveBeenCalled();
  });
});
