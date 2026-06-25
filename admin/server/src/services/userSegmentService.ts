import { ObjectId } from 'mongodb';
import { adminDB } from '../config/database';
import { UserTag, UserSegment, SegmentRule, PaginationResult, UserListItem } from '../types';

/**
 * 用户分群与标签服务
 * 提供标签管理、分群管理、用户标签关联等核心业务逻辑
 * 使用 adminDB 单例访问数据库
 */
class UserSegmentService {
  /**
   * 创建用户标签
   * @param name - 标签名称
   * @param color - 标签颜色（十六进制色值，如 #FF5733）
   * @param description - 标签描述（可选）
   * @returns 新建标签的 _id 字符串，失败返回 null
   * @throws 数据库操作异常时抛出错误
   */
  async createTag(name: string, color: string, description?: string): Promise<string | null> {
    const tagDoc: Omit<UserTag, '_id'> = {
      name,
      color,
      description,
      createdAt: new Date(),
    };
    return await adminDB.insertOne<UserTag>('user_tags', tagDoc);
  }

  /**
   * 获取全部标签列表
   * @returns 标签数组，按创建时间升序排列
   */
  async listTags(): Promise<UserTag[]> {
    return await adminDB.find<UserTag>('user_tags', {}, {
      sort: { createdAt: 1 },
    });
  }

  /**
   * 删除标签并从所有用户移除该标签引用
   * @param id - 标签 _id 字符串
   * @returns 是否删除成功
   */
  async deleteTag(id: string): Promise<boolean> {
    const objectId = new ObjectId(id);
    const deleted = await adminDB.deleteOne<UserTag>('user_tags', { _id: objectId } as never);
    if (deleted) {
      await adminDB.updateMany(
        'visitors',
        { tags: objectId.toString() } as never,
        { $pull: { tags: objectId.toString() } } as never,
      );
    }
    return deleted;
  }

  /**
   * 更新标签信息
   * @param id - 标签 _id 字符串
   * @param name - 新的标签名称
   * @param color - 新的标签颜色（十六进制色值）
   * @param description - 新的标签描述（可选）
   * @returns 是否更新成功
   */
  async updateTag(id: string, name: string, color: string, description?: string): Promise<boolean> {
    const objectId = new ObjectId(id);
    const updateFields: Record<string, unknown> = { name, color };
    if (description !== undefined) {
      updateFields.description = description;
    }
    return await adminDB.updateOne<UserTag>(
      'user_tags',
      { _id: objectId } as never,
      { $set: updateFields } as never,
    );
  }

  /**
   * 给用户添加标签
   * @param userId - 用户 visitor id
   * @param tagId - 标签 _id 字符串
   * @returns 是否添加成功（用户存在且标签未重复添加时返回 true）
   */
  async addTagToUser(userId: string, tagId: string): Promise<boolean> {
    const tag = await adminDB.findOne<UserTag>('user_tags', { _id: new ObjectId(tagId) } as never);
    if (!tag) return false;

    const result = await adminDB.updateOne(
      'visitors',
      { id: userId } as never,
      { $addToSet: { tags: tagId } } as never,
    );
    return result;
  }

  /**
   * 移除用户的指定标签
   * @param userId - 用户 visitor id
   * @param tagId - 标签 _id 字符串
   * @returns 是否移除成功
   */
  async removeTagFromUser(userId: string, tagId: string): Promise<boolean> {
    return await adminDB.updateOne(
      'visitors',
      { id: userId } as never,
      { $pull: { tags: tagId } } as never,
    );
  }

  /**
   * 按标签筛选用户（分页）
   * @param tagId - 标签 _id 字符串
   * @param page - 页码（从 1 开始）
   * @param limit - 每页条数
   * @returns 分页结果，包含用户列表和分页元数据
   */
  async getUsersByTag(tagId: string, page: number, limit: number): Promise<PaginationResult<UserListItem>> {
    const skip = (page - 1) * limit;

    const visitors = await adminDB.find('visitors', { tags: tagId } as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('visitors', { tags: tagId } as never);

    const items: UserListItem[] = visitors.map((v: Record<string, unknown>) => {
      const visitorId = v.id as string;
      const workspaceCount = (v.workspaces as string[])?.length || 0;

      return {
        _id: (v._id as { toString(): string }).toString(),
        id: visitorId,
        nickname: (v.nickname as string) || '未知用户',
        createdAt: v.createdAt as string,
        lastActiveAt: v.lastSeen as string,
        status: (v.isBanned as boolean) ? 'banned' : 'active',
        stats: {
          workspaceCount,
          messageCount: 0,
          nodeCount: 0,
        },
        isBanned: (v.isBanned as boolean) || false,
        banReason: v.banReason as string | undefined,
        banExpiresAt: v.banExpiresAt as string | undefined,
        lastIp: v.lastIp as string | undefined,
        ipHistory: v.ipHistory as string[] | undefined,
        tags: v.tags as string[] | undefined,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 创建用户分群
   * @param name - 分群名称
   * @param description - 分群描述（可选）
   * @param rule - 分群规则
   * @param autoUpdate - 是否自动更新
   * @returns 新建分群的 _id 字符串，失败返回 null
   */
  async createSegment(
    name: string,
    description: string | undefined,
    rule: SegmentRule,
    autoUpdate: boolean,
  ): Promise<string | null> {
    const segmentDoc: Omit<UserSegment, '_id'> = {
      name,
      description,
      rule,
      userCount: 0,
      autoUpdate,
      createdAt: new Date(),
    };
    return await adminDB.insertOne<UserSegment>('user_segments', segmentDoc);
  }

  /**
   * 获取全部分群列表
   * @returns 分群数组，按创建时间升序排列
   */
  async listSegments(): Promise<UserSegment[]> {
    return await adminDB.find<UserSegment>('user_segments', {}, {
      sort: { createdAt: 1 },
    });
  }

  /**
   * 删除分群
   * @param id - 分群 _id 字符串
   * @returns 是否删除成功
   */
  async deleteSegment(id: string): Promise<boolean> {
    const objectId = new ObjectId(id);
    return await adminDB.deleteOne<UserSegment>('user_segments', { _id: objectId } as never);
  }

  /**
   * 更新分群信息
   * @param id - 分群 _id 字符串
   * @param name - 新的分群名称
   * @param description - 新的分群描述（可选）
   * @param rule - 新的分群规则
   * @returns 是否更新成功
   */
  async updateSegment(id: string, name: string, description: string | undefined, rule: SegmentRule): Promise<boolean> {
    const objectId = new ObjectId(id);
    const updateFields: Record<string, unknown> = { name, rule };
    if (description !== undefined) {
      updateFields.description = description;
    }
    return await adminDB.updateOne<UserSegment>(
      'user_segments',
      { _id: objectId } as never,
      { $set: updateFields } as never,
    );
  }

  /**
   * 执行分群规则，查询匹配用户并更新 userCount
   * 根据分群规则的 field/operator/value 构建查询条件，
   * 在 visitors 集合中匹配用户并统计数量
   * @param segmentId - 分群 _id 字符串
   * @returns 匹配的用户数量，失败返回 -1
   */
  async executeSegmentRule(segmentId: string): Promise<number> {
    const objectId = new ObjectId(segmentId);
    const segment = await adminDB.findOne<UserSegment>('user_segments', { _id: objectId } as never);
    if (!segment) return -1;

    const filter = this.buildSegmentFilter(segment.rule);
    const count = await adminDB.countDocuments('visitors', filter as never);

    await adminDB.updateOne<UserSegment>('user_segments', { _id: objectId } as never, {
      $set: { userCount: count },
    });

    return count;
  }

  /**
   * 获取分群内用户（分页）
   * 先执行规则获取匹配用户，再分页返回
   * @param segmentId - 分群 _id 字符串
   * @param page - 页码（从 1 开始）
   * @param limit - 每页条数
   * @returns 分页结果，包含用户列表和分页元数据
   */
  async getSegmentUsers(segmentId: string, page: number, limit: number): Promise<PaginationResult<UserListItem>> {
    const objectId = new ObjectId(segmentId);
    const segment = await adminDB.findOne<UserSegment>('user_segments', { _id: objectId } as never);
    if (!segment) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const filter = this.buildSegmentFilter(segment.rule);
    const skip = (page - 1) * limit;

    const visitors = await adminDB.find('visitors', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('visitors', filter as never);

    const items: UserListItem[] = visitors.map((v: Record<string, unknown>) => {
      const visitorId = v.id as string;
      const workspaceCount = (v.workspaces as string[])?.length || 0;

      return {
        _id: (v._id as { toString(): string }).toString(),
        id: visitorId,
        nickname: (v.nickname as string) || '未知用户',
        createdAt: v.createdAt as string,
        lastActiveAt: v.lastSeen as string,
        status: (v.isBanned as boolean) ? 'banned' : 'active',
        stats: {
          workspaceCount,
          messageCount: 0,
          nodeCount: 0,
        },
        isBanned: (v.isBanned as boolean) || false,
        banReason: v.banReason as string | undefined,
        banExpiresAt: v.banExpiresAt as string | undefined,
        lastIp: v.lastIp as string | undefined,
        ipHistory: v.ipHistory as string[] | undefined,
        tags: v.tags as string[] | undefined,
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 根据分群规则构建 MongoDB 查询条件
   * 将 SegmentRule 转换为 visitors 集合的查询过滤器
   * - lastActiveAt: 映射到 visitors.lastSeen 字段，值为日期字符串
   * - messageCount: 映射到 visitors.messageCount 字段，值为数字
   * - hasOwnApiKey: 映射到 visitors.hasOwnApiKey 字段，值为布尔
   * @param rule - 分群规则
   * @returns MongoDB 查询过滤器对象
   */
  private buildSegmentFilter(rule: SegmentRule): Record<string, unknown> {
    const fieldMap: Record<string, string> = {
      lastActiveAt: 'lastSeen',
      messageCount: 'messageCount',
      hasOwnApiKey: 'hasOwnApiKey',
    };

    const dbField = fieldMap[rule.field] || rule.field;

    if (rule.operator === 'eq') {
      return { [dbField]: rule.value };
    }

    const mongoOp = rule.operator === 'gte' ? '$gte' : '$lte';
    return { [dbField]: { [mongoOp]: rule.value } };
  }
}

export const userSegmentService = new UserSegmentService();
