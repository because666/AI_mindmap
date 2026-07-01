import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import type { PushMessage } from '../types/push';

/**
 * pushService.getMessageDetail 单元测试
 * 重点验证 _id 的双格式（ObjectId / UUID 字符串）兼容查询策略
 */

// Mock mongoDBService 以避免真实数据库连接，getCollection 由用例按需控制返回值
vi.mock('../data/mongodb/connection', () => ({
  mongoDBService: {
    getCollection: vi.fn(),
  },
}));

// Mock axios，避免推送服务模块加载时引入真实 HTTP 客户端副作用
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

import { pushService } from './pushService';
import { mongoDBService } from '../data/mongodb/connection';

/** 获取被 mock 的 getCollection 函数引用，便于每个用例设置返回值 */
const getCollectionMock = mongoDBService.getCollection as unknown as ReturnType<typeof vi.fn>;

/** 构造一条完整的测试消息对象，满足 PushMessage 接口约束 */
function buildSampleMessage(id: ObjectId | string): PushMessage {
  return {
    _id: id instanceof ObjectId ? id : (id as unknown as ObjectId),
    type: 'broadcast',
    title: '测试消息标题',
    content: '测试消息内容',
    summary: '测试摘要',
    senderType: 'system',
    senderName: '系统通知',
    targetType: 'all',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    expireAt: new Date('2024-12-31T00:00:00.000Z'),
    recipients: [
      { userId: 'user-001', delivered: true, read: false, forcedRead: false },
    ],
    stats: { totalCount: 10, deliveredCount: 10, readCount: 5, readRate: 0.5 },
    forceRead: false,
  };
}

describe('PushService.getMessageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * 正常路径一：messageId 为 24 位 hex 字符串
   * 期望：new ObjectId 成功，findOne 以 ObjectId 条件被调用一次，返回详情
   */
  it('24 位 hex 格式 messageId：走 ObjectId 查询路径并返回消息详情', async () => {
    const hexId = '507f1f77bcf86cd799439011';
    const sampleMessage = buildSampleMessage(new ObjectId(hexId));

    const findOneMock = vi.fn().mockResolvedValueOnce(sampleMessage);
    getCollectionMock.mockReturnValue({ findOne: findOneMock });

    const result = await pushService.getMessageDetail(hexId, 'user-001');

    expect(getCollectionMock).toHaveBeenCalledWith('push_messages');
    expect(findOneMock).toHaveBeenCalledTimes(1);
    // 第一次调用应使用 ObjectId 实例作为 _id 条件
    const callArg = findOneMock.mock.calls[0][0] as { _id: unknown };
    expect(callArg._id).toBeInstanceOf(ObjectId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(hexId);
    expect(result?.title).toBe('测试消息标题');
    expect(result?.read).toBe(false);
    expect(result?.readStats).toEqual({ total: 10, read: 5, readRate: 0.5 });
  });

  /**
   * 正常路径二：messageId 为 UUID 字符串
   * 期望：new ObjectId 抛出 → 回退到字符串查询 → findOne 以字符串条件被调用一次，返回详情
   */
  it('UUID 格式 messageId：回退到字符串查询路径并返回消息详情', async () => {
    const uuidId = '550e8400-e29b-41d4-a716-446655440000';
    const sampleMessage = buildSampleMessage(uuidId);

    const findOneMock = vi.fn().mockResolvedValueOnce(sampleMessage);
    getCollectionMock.mockReturnValue({ findOne: findOneMock });

    const result = await pushService.getMessageDetail(uuidId, 'user-001');

    expect(getCollectionMock).toHaveBeenCalledWith('push_messages');
    expect(findOneMock).toHaveBeenCalledTimes(1);
    // 回退路径下，_id 条件应为原始字符串（而非 ObjectId 实例）
    const callArg = findOneMock.mock.calls[0][0] as { _id: unknown };
    expect(callArg._id).toBe(uuidId);
    expect(callArg._id).not.toBeInstanceOf(ObjectId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(uuidId);
    expect(result?.title).toBe('测试消息标题');
  });

  /**
   * 异常路径：messageId 完全非法（既非 24 位 hex 也非数据库中存在的 UUID）
   * 期望：new ObjectId 抛出 → 回退字符串查询返回 null → 方法返回 null
   */
  it('完全非法的 messageId：返回 null', async () => {
    const invalidId = 'totally-invalid!!!';
    const findOneMock = vi.fn().mockResolvedValueOnce(null);
    getCollectionMock.mockReturnValue({ findOne: findOneMock });

    const result = await pushService.getMessageDetail(invalidId);

    expect(result).toBeNull();
    expect(findOneMock).toHaveBeenCalledTimes(1);
    // 回退路径以原始字符串查询
    const callArg = findOneMock.mock.calls[0][0] as { _id: unknown };
    expect(callArg._id).toBe(invalidId);
  });

  /**
   * 边界情况：getCollection 返回 null（数据库未连接）
   * 期望：方法直接返回 null，不调用 findOne
   */
  it('collection 为 null 时直接返回 null', async () => {
    getCollectionMock.mockReturnValue(null);
    const result = await pushService.getMessageDetail('507f1f77bcf86cd799439011');
    expect(result).toBeNull();
  });

  /**
   * 边界情况：24 位 hex 但数据库中不存在该消息
   * 期望：findOne 返回 null → 方法返回 null
   */
  it('24 位 hex 格式 messageId 但消息不存在：返回 null', async () => {
    const hexId = '507f1f77bcf86cd799439012';
    const findOneMock = vi.fn().mockResolvedValueOnce(null);
    getCollectionMock.mockReturnValue({ findOne: findOneMock });

    const result = await pushService.getMessageDetail(hexId);

    expect(result).toBeNull();
    expect(findOneMock).toHaveBeenCalledTimes(1);
    const callArg = findOneMock.mock.calls[0][0] as { _id: unknown };
    expect(callArg._id).toBeInstanceOf(ObjectId);
  });

  /**
   * 异常路径：回退字符串查询时 findOne 抛出错误
   * 期望：内层 catch 捕获错误并返回 null，不向上抛出
   */
  it('回退字符串查询时 findOne 抛出错误：返回 null 不抛出', async () => {
    const uuidId = '550e8400-e29b-41d4-a716-446655440000';
    const findOneMock = vi.fn().mockRejectedValueOnce(new Error('数据库查询异常'));
    getCollectionMock.mockReturnValue({ findOne: findOneMock });

    const result = await pushService.getMessageDetail(uuidId);

    expect(result).toBeNull();
    expect(findOneMock).toHaveBeenCalledTimes(1);
  });
});
