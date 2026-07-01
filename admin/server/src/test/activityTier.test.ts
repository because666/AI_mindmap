import { describe, it, expect } from 'vitest';
import {
  calculateActivityTier,
  buildActivityTierFilter,
  ALLOWED_ACTIVITY_TIERS,
} from '../utils/activityTier';
import type { ActivityTier } from '../types';

/**
 * 一天的毫秒数（与 activityTier.ts 内部常量保持一致）
 * 用于测试用例中构造时间偏移
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 构造相对于现在偏移 N 毫秒的 ISO 时间字符串
 * @param offsetMs - 相对现在的毫秒偏移，正数表示未来，负数表示过去
 * @returns ISO 格式的时间字符串
 */
function isoOffset(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

/**
 * 构造相对于现在偏移 N 毫秒的 Date 对象
 * @param offsetMs - 相对现在的毫秒偏移，正数表示未来，负数表示过去
 * @returns Date 对象
 */
function dateOffset(offsetMs: number): Date {
  return new Date(Date.now() + offsetMs);
}

/**
 * 判断给定的 MongoDB filter 在指定 lastSeen 时间下是否命中
 * 仅模拟 buildActivityTierFilter 返回的 lastSeen/createdAt 范围语义
 * 不依赖真实 MongoDB，便于单元测试快速验证边界一致性
 * @param filter - buildActivityTierFilter 返回的 filter 对象
 * @param field - 字段名，'lastSeen' 或 'createdAt'
 * @param value - 字段值（Date 或 undefined/null）
 * @returns 是否命中筛选条件
 */
function matchesField(
  filter: Record<string, unknown> | null,
  field: string,
  value: Date | null | undefined
): boolean {
  if (!filter) return false;
  // 处理 $or 顶层操作符（dormant 分支使用）
  if (Array.isArray(filter.$or)) {
    return filter.$or.some((sub: Record<string, unknown>) =>
      matchesField(sub, field, value)
    );
  }
  const cond = filter[field];
  if (cond === undefined) {
    // 字段不存在于 filter 中，视为不约束（命中）
    return true;
  }
  // 处理 { field: null } 显式查询 null 的语义
  if (cond === null) {
    return value === null || value === undefined;
  }
  // 处理 { field: { $exists: false } }
  if (typeof cond === 'object' && cond !== null) {
    const c = cond as Record<string, unknown>;
    // 字段不存在查询
    if (c.$exists === false) {
      return value === null || value === undefined;
    }
    // 计算 elapsed
    const valueMs = value ? value.getTime() : NaN;
    let ok = true;
    if (c.$gte !== undefined) {
      ok = ok && valueMs >= (c.$gte as Date).getTime();
    }
    if (c.$gt !== undefined) {
      ok = ok && valueMs > (c.$gt as Date).getTime();
    }
    if (c.$lte !== undefined) {
      ok = ok && valueMs <= (c.$lte as Date).getTime();
    }
    if (c.$lt !== undefined) {
      ok = ok && valueMs < (c.$lt as Date).getTime();
    }
    return ok;
  }
  return false;
}

describe('activityTier 工具模块', () => {
  describe('ALLOWED_ACTIVITY_TIERS', () => {
    it('应包含全部 4 个分层值', () => {
      expect(ALLOWED_ACTIVITY_TIERS).toHaveLength(4);
      expect(ALLOWED_ACTIVITY_TIERS).toEqual([
        'new_user',
        'high_active',
        'churn_risk',
        'dormant',
      ]);
    });
  });

  describe('calculateActivityTier', () => {
    /**
     * 边界场景：lastSeen 正好 7 天前
     * calculate 应返回 churn_risk（elapsed >= 7d）
     */
    it('lastSeen 正好 7 天前应判定为 churn_risk', () => {
      // createdAt 设为很久以前，避免被识别为 new_user
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-7 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('churn_risk');
    });

    /**
     * 边界场景：lastSeen 正好 30 天前
     * calculate 应返回 dormant（elapsed >= 30d）
     */
    it('lastSeen 正好 30 天前应判定为 dormant', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-30 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('dormant');
    });

    /**
     * 边界场景：lastSeen 在 1-7 天区间（如 3 天前）
     * calculate 应返回 high_active（兜底逻辑）
     */
    it('lastSeen 在 1-7 天区间应判定为 high_active', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-3 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('high_active');
    });

    /**
     * 边界场景：lastSeen 在 24 小时内
     * calculate 应返回 high_active
     */
    it('lastSeen 在 24 小时内应判定为 high_active', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-2 * 60 * 60 * 1000); // 2 小时前
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('high_active');
    });

    /**
     * 边界场景：lastSeen 为空
     * calculate 应返回 dormant
     */
    it('lastSeen 为空（undefined）应判定为 dormant', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, undefined)).toBe('dormant');
    });

    /**
     * 边界场景：lastSeen 为 null
     */
    it('lastSeen 为 null 应判定为 dormant', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, null)).toBe('dormant');
    });

    /**
     * 边界场景：createdAt 在 24 小时内
     * 应判定为 new_user（无论 lastSeen 如何）
     */
    it('createdAt 在 24 小时内应判定为 new_user', () => {
      const createdAt = isoOffset(-2 * 60 * 60 * 1000); // 2 小时前
      const lastSeen = isoOffset(-1 * 60 * 60 * 1000); // 1 小时前
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('new_user');
    });

    /**
     * 边界场景：lastSeen 在 7-30 天区间（如 15 天前）
     * 应判定为 churn_risk
     */
    it('lastSeen 在 7-30 天区间应判定为 churn_risk', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-15 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('churn_risk');
    });

    /**
     * 边界场景：lastSeen 超过 30 天（如 60 天前）
     * 应判定为 dormant
     */
    it('lastSeen 超过 30 天应判定为 dormant', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-60 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('dormant');
    });

    /**
     * 边界场景：lastSeen 在 6.999 天前（接近 7 天但小于）
     * 应判定为 high_active（兜底逻辑）
     */
    it('lastSeen 在 6.999 天前应判定为 high_active（接近 7 天但小于）', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      // 7 天减 1 秒
      const lastSeen = isoOffset(-7 * ONE_DAY_MS + 1000);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('high_active');
    });

    /**
     * 边界场景：lastSeen 在 29.999 天前（接近 30 天但小于）
     * 应判定为 churn_risk
     */
    it('lastSeen 在 29.999 天前应判定为 churn_risk（接近 30 天但小于）', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = isoOffset(-30 * ONE_DAY_MS + 1000);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('churn_risk');
    });

    /**
     * 边界场景：lastSeen 为非法字符串
     * 应返回 dormant（解析失败视为空）
     */
    it('lastSeen 为非法字符串应判定为 dormant', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      expect(calculateActivityTier(createdAt, 'not-a-date')).toBe('dormant');
    });

    /**
     * 边界场景：lastSeen 为 Date 对象
     * 应正确解析
     */
    it('lastSeen 为 Date 对象应正确解析', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-2 * 60 * 60 * 1000);
      expect(calculateActivityTier(createdAt, lastSeen)).toBe('high_active');
    });

    /**
     * 边界场景：createdAt 与 lastSeen 均为空
     * 应判定为 dormant
     */
    it('createdAt 与 lastSeen 均为空应判定为 dormant', () => {
      expect(calculateActivityTier(undefined, undefined)).toBe('dormant');
    });
  });

  describe('buildActivityTierFilter', () => {
    /**
     * 验证 new_user filter 的结构
     */
    it('new_user 应返回 createdAt 范围 filter', () => {
      const filter = buildActivityTierFilter('new_user');
      expect(filter).not.toBeNull();
      expect(filter).toHaveProperty('createdAt');
      const createdAt = filter!.createdAt as Record<string, unknown>;
      expect(createdAt).toHaveProperty('$gte');
      expect(createdAt.$gte).toBeInstanceOf(Date);
    });

    /**
     * 验证 high_active filter 的结构（应使用 7 天作为下界，严格大于排除 7d 边界）
     */
    it('high_active 应返回 lastSeen > 7天前 的 filter（$gt 严格大于，排除 7d 边界）', () => {
      const filter = buildActivityTierFilter('high_active');
      expect(filter).not.toBeNull();
      expect(filter).toHaveProperty('lastSeen');
      const lastSeen = filter!.lastSeen as Record<string, unknown>;
      expect(lastSeen).toHaveProperty('$gt');
      expect(lastSeen.$gt).toBeInstanceOf(Date);
      // 验证下界约为 7 天前
      const lowerBound = lastSeen.$gt as Date;
      const diffMs = Date.now() - lowerBound.getTime();
      // 允许 1 秒的执行时间偏差
      expect(diffMs).toBeGreaterThan(7 * ONE_DAY_MS - 1000);
      expect(diffMs).toBeLessThan(7 * ONE_DAY_MS + 1000);
    });

    /**
     * 验证 churn_risk filter 的边界
     * - 上界使用 $lte: sevenDaysAgo（含 7 天）
     * - 下界使用 $gt: thirtyDaysAgo（不含 30 天）
     */
    it('churn_risk 应返回 $gt thirtyDaysAgo + $lte sevenDaysAgo 的 filter', () => {
      const filter = buildActivityTierFilter('churn_risk');
      expect(filter).not.toBeNull();
      expect(filter).toHaveProperty('lastSeen');
      const lastSeen = filter!.lastSeen as Record<string, unknown>;
      expect(lastSeen).toHaveProperty('$gt');
      expect(lastSeen).toHaveProperty('$lte');
      expect(lastSeen.$gt).toBeInstanceOf(Date);
      expect(lastSeen.$lte).toBeInstanceOf(Date);
      // 验证下界约为 30 天前
      const lowerBound = lastSeen.$gt as Date;
      const lowerDiff = Date.now() - lowerBound.getTime();
      expect(lowerDiff).toBeGreaterThan(30 * ONE_DAY_MS - 1000);
      expect(lowerDiff).toBeLessThan(30 * ONE_DAY_MS + 1000);
      // 验证上界约为 7 天前
      const upperBound = lastSeen.$lte as Date;
      const upperDiff = Date.now() - upperBound.getTime();
      expect(upperDiff).toBeGreaterThan(7 * ONE_DAY_MS - 1000);
      expect(upperDiff).toBeLessThan(7 * ONE_DAY_MS + 1000);
    });

    /**
     * 验证 dormant filter 的边界
     * - 使用 $lte: thirtyDaysAgo（含 30 天）
     * - 包含 lastSeen 为空的情况
     */
    it('dormant 应返回 $or 包含 lastSeen <= thirtyDaysAgo + null + $exists false', () => {
      const filter = buildActivityTierFilter('dormant');
      expect(filter).not.toBeNull();
      expect(filter).toHaveProperty('$or');
      const orArr = filter!.$or as Array<Record<string, unknown>>;
      expect(orArr).toHaveLength(3);
      // 第一个分支应为 lastSeen <= thirtyDaysAgo
      expect(orArr[0]).toHaveProperty('lastSeen');
      const lastSeenCond = orArr[0].lastSeen as Record<string, unknown>;
      expect(lastSeenCond).toHaveProperty('$lte');
      expect(lastSeenCond.$lte).toBeInstanceOf(Date);
      // 第二个分支应为 lastSeen: null
      expect(orArr[1]).toHaveProperty('lastSeen');
      expect(orArr[1].lastSeen).toBeNull();
      // 第三个分支应为 lastSeen: { $exists: false }
      expect(orArr[2]).toHaveProperty('lastSeen');
      const existsCond = orArr[2].lastSeen as Record<string, unknown>;
      expect(existsCond).toHaveProperty('$exists');
      expect(existsCond.$exists).toBe(false);
    });

    /**
     * 默认分支应返回 null
     */
    it('未知 tier 应返回 null', () => {
      const filter = buildActivityTierFilter('unknown' as unknown as ActivityTier);
      expect(filter).toBeNull();
    });
  });

  describe('calculate 与 filter 的边界一致性', () => {
    /**
     * 边界一致性：lastSeen 正好 7 天前
     * calculate 返回 churn_risk，churn_risk filter 也应命中
     */
    it('lastSeen 正好 7 天前：calculate=churn_risk 且 churn_risk filter 命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-7 * ONE_DAY_MS);
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('churn_risk');

      const filter = buildActivityTierFilter('churn_risk');
      const hit = matchesField(filter, 'lastSeen', lastSeen);
      expect(hit).toBe(true);
    });

    /**
     * 边界一致性：lastSeen 正好 30 天前
     * calculate 返回 dormant，dormant filter 也应命中
     * 同时 churn_risk filter 不应命中
     */
    it('lastSeen 正好 30 天前：calculate=dormant 且 dormant filter 命中、churn_risk 不命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-30 * ONE_DAY_MS);
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('dormant');

      const dormantFilter = buildActivityTierFilter('dormant');
      expect(matchesField(dormantFilter, 'lastSeen', lastSeen)).toBe(true);

      const churnFilter = buildActivityTierFilter('churn_risk');
      expect(matchesField(churnFilter, 'lastSeen', lastSeen)).toBe(false);
    });

    /**
     * 边界一致性：lastSeen 在 1-7 天区间（如 3 天前）
     * calculate 返回 high_active，high_active filter 也应命中
     */
    it('lastSeen 在 1-7 天区间：calculate=high_active 且 high_active filter 命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-3 * ONE_DAY_MS);
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('high_active');

      const filter = buildActivityTierFilter('high_active');
      expect(matchesField(filter, 'lastSeen', lastSeen)).toBe(true);
    });

    /**
     * 边界一致性：lastSeen 在 24 小时内
     * calculate 返回 high_active，high_active filter 也应命中
     */
    it('lastSeen 在 24 小时内：calculate=high_active 且 high_active filter 命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-2 * 60 * 60 * 1000); // 2 小时前
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('high_active');

      const filter = buildActivityTierFilter('high_active');
      expect(matchesField(filter, 'lastSeen', lastSeen)).toBe(true);
    });

    /**
     * 边界一致性：lastSeen 为空
     * calculate 返回 dormant，dormant filter 也应命中
     */
    it('lastSeen 为空：calculate=dormant 且 dormant filter 命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const tier = calculateActivityTier(createdAt, undefined);
      expect(tier).toBe('dormant');

      const filter = buildActivityTierFilter('dormant');
      expect(matchesField(filter, 'lastSeen', undefined)).toBe(true);
      expect(matchesField(filter, 'lastSeen', null)).toBe(true);
    });

    /**
     * 边界一致性：lastSeen 在 7-30 天区间（如 15 天前）
     * calculate 返回 churn_risk，churn_risk filter 也应命中
     */
    it('lastSeen 在 7-30 天区间：calculate=churn_risk 且 churn_risk filter 命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-15 * ONE_DAY_MS);
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('churn_risk');

      const filter = buildActivityTierFilter('churn_risk');
      expect(matchesField(filter, 'lastSeen', lastSeen)).toBe(true);
    });

    /**
     * 边界一致性：lastSeen 超过 30 天（如 60 天前）
     * calculate 返回 dormant，dormant filter 也应命中
     */
    it('lastSeen 超过 30 天：calculate=dormant 且 dormant filter 命中', () => {
      const createdAt = isoOffset(-90 * ONE_DAY_MS);
      const lastSeen = dateOffset(-60 * ONE_DAY_MS);
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('dormant');

      const filter = buildActivityTierFilter('dormant');
      expect(matchesField(filter, 'lastSeen', lastSeen)).toBe(true);
    });

    /**
     * 边界一致性：createdAt 在 24 小时内
     * calculate 返回 new_user，new_user filter 也应命中 createdAt
     */
    it('createdAt 在 24 小时内：calculate=new_user 且 new_user filter 命中 createdAt', () => {
      const createdAt = dateOffset(-2 * 60 * 60 * 1000); // 2 小时前
      const lastSeen = dateOffset(-1 * 60 * 60 * 1000); // 1 小时前
      const tier = calculateActivityTier(createdAt, lastSeen);
      expect(tier).toBe('new_user');

      const filter = buildActivityTierFilter('new_user');
      expect(matchesField(filter, 'createdAt', createdAt)).toBe(true);
    });
  });
});
