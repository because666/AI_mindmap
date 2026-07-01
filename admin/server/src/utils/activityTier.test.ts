import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateActivityTier, buildActivityTierFilter, ALLOWED_ACTIVITY_TIERS } from './activityTier';
import type { ActivityTier } from '../types';

/** 一天的毫秒数（与实现保持一致） */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** 固定的测试基准时间，避免真实时间导致边界测试 flaky */
const FIXED_NOW_MS = new Date('2026-07-01T12:00:00.000Z').getTime();

/** 模拟 visitors 文档的字段类型 */
interface VisitorDoc {
  createdAt?: Date | string | null;
  lastSeen?: Date | string | null;
}

/** MongoDB 比较操作符到判断函数的映射类型 */
type CompareOp = (docMs: number, cmpMs: number) => boolean;

/** 比较操作符实现 */
const COMPARE_OPS: Record<string, CompareOp> = {
  $gt: (docMs, cmpMs) => docMs > cmpMs,
  $gte: (docMs, cmpMs) => docMs >= cmpMs,
  $lt: (docMs, cmpMs) => docMs < cmpMs,
  $lte: (docMs, cmpMs) => docMs <= cmpMs,
};

/**
 * 将文档字段值转为毫秒时间戳
 * 支持 Date、字符串、null/undefined；无法解析时返回 null
 * @param value - 文档字段的原始值
 * @returns 毫秒时间戳，或 null（值为空或无法解析）
 */
function toMs(value: Date | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return isNaN(ms) ? null : ms;
  }
  const parsed = new Date(value).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * 评估 MongoDB 风格的查询 filter 是否匹配给定文档
 * 支持 $gt/$gte/$lt/$lte/$or/$and/$exists 以及 null 等值匹配
 * @param filter - MongoDB 查询对象
 * @param doc - 模拟的 visitors 文档
 * @returns 是否匹配
 */
function matchesFilter(filter: Record<string, unknown>, doc: VisitorDoc): boolean {
  for (const [key, condition] of Object.entries(filter)) {
    // $or：任一子条件匹配即可
    if (key === '$or') {
      const subFilters = condition as Array<Record<string, unknown>>;
      if (!subFilters.some((sub) => matchesFilter(sub, doc))) {
        return false;
      }
      continue;
    }
    // $and：所有子条件都需匹配
    if (key === '$and') {
      const subFilters = condition as Array<Record<string, unknown>>;
      if (!subFilters.every((sub) => matchesFilter(sub, doc))) {
        return false;
      }
      continue;
    }

    const docValue = doc[key as keyof VisitorDoc];

    // null 条件：文档值为 null 或 undefined 均视为匹配（与 MongoDB {field: null} 语义一致）
    if (condition === null) {
      if (docValue !== null && docValue !== undefined) {
        return false;
      }
      continue;
    }

    // 对象条件：包含 $gt/$gte/$lt/$lte/$exists 等操作符
    if (typeof condition === 'object' && condition !== null) {
      const ops = condition as Record<string, unknown>;
      for (const [op, opValue] of Object.entries(ops)) {
        // $exists：判断字段是否存在（null 视为存在）
        if (op === '$exists') {
          const exists = docValue !== undefined;
          if (opValue === true && !exists) return false;
          if (opValue === false && exists) return false;
          continue;
        }

        // 时间比较操作符：将文档值与操作数都转为毫秒时间戳
        const compareOp = COMPARE_OPS[op];
        if (!compareOp) {
          // 未知操作符，视为不匹配
          return false;
        }
        const docMs = toMs(docValue);
        const cmpMs = opValue instanceof Date ? opValue.getTime() : Number(opValue);
        if (docMs === null || isNaN(cmpMs)) {
          // 文档值无法解析为时间，比较操作符不匹配
          return false;
        }
        if (!compareOp(docMs, cmpMs)) {
          return false;
        }
      }
      continue;
    }

    // 其他类型（字符串/数字等）直接相等比较
    if (docValue !== condition) return false;
  }
  return true;
}

describe('activityTier 边界一致性', () => {
  beforeEach(() => {
    // 固定系统时间，确保 calculate 与 filter 使用同一基准时间，避免边界 flaky
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * 验证 calculate 与 filter 在给定 lastSeen/createdAt 下完全一致：
   * - calculate 返回的分层对应的 filter 必须匹配
   * - 其他分层的 filter 必须不匹配
   *   （new_user 与 high_active 因使用不同字段允许重叠，互不校验）
   * @param lastSeen - 用户最后活跃时间
   * @param createdAt - 用户创建时间
   * @param expectedTier - 期望的活跃度分层
   */
  function assertConsistency(
    lastSeen: Date | string | null | undefined,
    createdAt: Date | string | null | undefined,
    expectedTier: ActivityTier
  ): void {
    const calculated = calculateActivityTier(createdAt, lastSeen);
    expect(calculated, `calculateActivityTier 应返回 ${expectedTier}`).toBe(expectedTier);

    const doc: VisitorDoc = { createdAt: createdAt ?? undefined, lastSeen: lastSeen ?? undefined };

    for (const tier of ALLOWED_ACTIVITY_TIERS) {
      const filter = buildActivityTierFilter(tier);
      if (filter === null) {
        throw new Error(`buildActivityTierFilter(${tier}) 返回 null`);
      }
      const matched = matchesFilter(filter, doc);
      if (tier === expectedTier) {
        expect(matched, `分层 ${tier} 的 filter 应匹配该文档`).toBe(true);
      } else {
        // new_user 用 createdAt，high_active 用 lastSeen，二者字段不同允许同时命中
        if (expectedTier === 'new_user' && tier === 'high_active') continue;
        if (expectedTier === 'high_active' && tier === 'new_user') continue;
        expect(matched, `分层 ${tier} 的 filter 不应匹配该文档（expectedTier=${expectedTier}）`).toBe(false);
      }
    }
  }

  it('24 小时内（lastSeen 12 小时前）应归 high_active', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 12 * 60 * 60 * 1000);
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'high_active');
  });

  it('1-7 天区间（lastSeen 3 天前）应归 high_active', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 3 * ONE_DAY_MS);
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'high_active');
  });

  it('7 天边界（恰好 7 天前）应归 churn_risk', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 7 * ONE_DAY_MS);
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'churn_risk');
  });

  it('30 天边界（恰好 30 天前）应归 dormant', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 30 * ONE_DAY_MS);
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'dormant');
  });

  it('30 天以上（lastSeen 60 天前）应归 dormant', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    const createdAt = new Date(FIXED_NOW_MS - 90 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'dormant');
  });

  it('lastSeen 为 null 应归 dormant', () => {
    const lastSeen = null;
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'dormant');
  });

  it('lastSeen 为 undefined 应归 dormant', () => {
    const lastSeen = undefined;
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'dormant');
  });

  it('新用户（createdAt 12 小时前）应归 new_user', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 6 * 60 * 60 * 1000);
    const createdAt = new Date(FIXED_NOW_MS - 12 * 60 * 60 * 1000);
    assertConsistency(lastSeen, createdAt, 'new_user');
  });

  it('8 天前（介于 7d 与 30d 之间）应归 churn_risk', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 8 * ONE_DAY_MS);
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'churn_risk');
  });

  it('29 天前（介于 7d 与 30d 之间）应归 churn_risk', () => {
    const lastSeen = new Date(FIXED_NOW_MS - 29 * ONE_DAY_MS);
    const createdAt = new Date(FIXED_NOW_MS - 60 * ONE_DAY_MS);
    assertConsistency(lastSeen, createdAt, 'churn_risk');
  });
});
