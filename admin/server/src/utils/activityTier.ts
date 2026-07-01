import type { ActivityTier } from '../types';

/**
 * 一天的毫秒数常量
 * 用于活跃度分层的时间范围计算
 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 允许筛选的活跃度分层值列表
 * 用于 GET / 路由的 activityTier 查询参数校验
 */
export const ALLOWED_ACTIVITY_TIERS: ActivityTier[] = [
  'new_user',
  'high_active',
  'churn_risk',
  'dormant',
];

/**
 * 根据用户的 createdAt 和 lastSeen 计算活跃度分层
 * 分层规则：
 * - new_user: createdAt 在最近 24 小时内
 * - high_active: lastSeen 在最近 24 小时内（且非新用户）
 * - churn_risk: lastSeen 在 7-30 天前
 * - dormant: lastSeen 超过 30 天，或 lastSeen 为空
 *
 * 注意：lastSeen 在 1-7 天内的用户不严格匹配 spec 中的任何分层，
 * 根据业务语义归入 high_active（与最近 24 小时同属"近期活跃"语义）。
 * @param createdAtRaw - 用户创建时间（字符串或 Date）
 * @param lastSeenRaw - 用户最后活跃时间（字符串、Date 或空）
 * @returns 活跃度分层类型
 */
export function calculateActivityTier(
  createdAtRaw: string | Date | null | undefined,
  lastSeenRaw: string | Date | null | undefined
): ActivityTier {
  const now = Date.now();

  // 解析 createdAt
  let createdAtMs: number | null = null;
  if (createdAtRaw) {
    const createdAt = new Date(createdAtRaw);
    if (!isNaN(createdAt.getTime())) {
      createdAtMs = createdAt.getTime();
    }
  }

  // 新用户判定：createdAt 在最近 24 小时内
  if (createdAtMs !== null && now - createdAtMs < ONE_DAY_MS) {
    return 'new_user';
  }

  // 解析 lastSeen
  let lastSeenMs: number | null = null;
  if (lastSeenRaw) {
    const lastSeen = new Date(lastSeenRaw);
    if (!isNaN(lastSeen.getTime())) {
      lastSeenMs = lastSeen.getTime();
    }
  }

  // lastSeen 为空视为沉睡
  if (lastSeenMs === null) {
    return 'dormant';
  }

  const elapsed = now - lastSeenMs;
  // 高活跃：lastSeen 在最近 24 小时内
  if (elapsed < ONE_DAY_MS) {
    return 'high_active';
  }
  // 流失风险：lastSeen 在 7-30 天前
  if (elapsed >= 7 * ONE_DAY_MS && elapsed < 30 * ONE_DAY_MS) {
    return 'churn_risk';
  }
  // 沉睡：lastSeen 超过 30 天
  if (elapsed >= 30 * ONE_DAY_MS) {
    return 'dormant';
  }
  // lastSeen 在 1-7 天内，不归属上述任何分层，按"高活跃"的弱化版本处理
  // 此区间不属于 spec 定义的任何分层，根据业务语义最近 7 天内仍有活跃，
  // 归入 high_active（与最近 24 小时同属"近期活跃"语义）
  return 'high_active';
}

/**
 * 根据 activityTier 计算对应的时间范围查询 filter
 * 将活跃度分层（计算字段）转换为 visitors 集合可识别的 lastSeen/createdAt 范围查询。
 *
 * 边界一致性说明（与 calculateActivityTier 保持完全一致，无重叠）：
 * - new_user: createdAt 在最近 24 小时内（elapsed < 1d），使用 $gte
 * - high_active: lastSeen 在最近 7 天内（elapsed < 7d，不含 7d 边界）
 *   使用 $gt: sevenDaysAgo，对应 elapsed < 7d
 *   与 calculate 的 high_active 判定（elapsed < 7d，含 0-24h 与 1-7d 两段）完全一致
 * - churn_risk: lastSeen 在 7-30 天前（7d <= elapsed < 30d，含 7d 不含 30d）
 *   使用 $gt: thirtyDaysAgo（排除 30d）+ $lte: sevenDaysAgo（含 7d）
 *   与 calculate 的 churn_risk 判定（elapsed >= 7d 且 elapsed < 30d）完全一致
 * - dormant: lastSeen 超过 30 天（elapsed >= 30d，含 30d），或 lastSeen 为空
 *   使用 $lte: thirtyDaysAgo（包含 30d），与 calculate 的 dormant 判定（elapsed >= 30d）一致
 *
 * 边界修复历史：
 * - 7 天边界：calculate 中 churn_risk 是 elapsed >= 7d，原 filter 用 $lt: sevenDaysAgo
 *   （即 elapsed > 7d）会漏掉正好 7d 的用户。现 high_active 改用 $gt 严格小于 7d，
 *   churn_risk 用 $lte 含 7d，确保 7d 边界唯一归入 churn_risk，与 calculate 一致且无重叠。
 * - 30 天边界：原实现 churn_risk 用 $gte、dormant 用 $lt，导致 elapsed 正好 30d 时
 *   filter 判定为 churn_risk 而 calculate 判定为 dormant。现统一为 dormant 包含 30d。
 *
 * 注意：filter 为近似匹配，high_active 的 filter 会同时命中 new_user 用户
 * （因为 new_user 的 createdAt 在 24h 内，lastSeen 也可能在 7 天内），
 * 但展示时每个用户仍按 calculateActivityTier 精确分层显示。
 * 由于 new_user 筛选使用 createdAt 字段，不会与 high_active 冲突。
 * @param tier - 活跃度分层
 * @returns MongoDB 查询 filter，如果未匹配则返回 null
 */
export function buildActivityTierFilter(tier: ActivityTier): Record<string, unknown> | null {
  const now = new Date();
  switch (tier) {
    case 'new_user': {
      // createdAt 在最近 24 小时内（elapsed < 1d）
      const oneDayAgo = new Date(now.getTime() - ONE_DAY_MS);
      return { createdAt: { $gte: oneDayAgo } };
    }
    case 'high_active': {
      // lastSeen 在最近 7 天内（elapsed < 7d，不含 7d 边界）
      // 使用 $gt 严格大于，确保 7d 边界唯一归入 churn_risk，与 calculate 一致且无重叠
      const sevenDaysAgo = new Date(now.getTime() - 7 * ONE_DAY_MS);
      return { lastSeen: { $gt: sevenDaysAgo } };
    }
    case 'churn_risk': {
      // lastSeen 在 7-30 天前（7d <= elapsed < 30d，含 7d 不含 30d）
      // 与 calculate 的 churn_risk 判定（elapsed >= 7d 且 elapsed < 30d）保持一致：
      // - $lte: sevenDaysAgo 对应 elapsed >= 7d（含 7d 边界）
      // - $gt: thirtyDaysAgo 对应 elapsed < 30d（不含 30d，30d 归 dormant）
      const sevenDaysAgo = new Date(now.getTime() - 7 * ONE_DAY_MS);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * ONE_DAY_MS);
      return {
        lastSeen: { $gt: thirtyDaysAgo, $lte: sevenDaysAgo },
      };
    }
    case 'dormant': {
      // lastSeen 超过 30 天（elapsed >= 30d，含 30d），或 lastSeen 为空
      // 使用 $lte 包含 30d，与 calculateActivityTier 的 dormant（elapsed >= 30d）一致
      const thirtyDaysAgo = new Date(now.getTime() - 30 * ONE_DAY_MS);
      return {
        $or: [
          { lastSeen: { $lte: thirtyDaysAgo } },
          { lastSeen: null },
          { lastSeen: { $exists: false } },
        ],
      };
    }
    default:
      return null;
  }
}
