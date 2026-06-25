import { ObjectId } from 'mongodb';
import { adminDB } from '../config/database';
import { Announcement, AnnouncementType, PaginationResult } from '../types';

/**
 * 创建公告请求体接口
 */
interface CreateAnnouncementData {
  title: string;
  content: string;
  type: AnnouncementType;
  targetGroups?: string[];
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdBy: string;
}

/**
 * 更新公告请求体接口
 */
interface UpdateAnnouncementData {
  title?: string;
  content?: string;
  type?: AnnouncementType;
  targetGroups?: string[];
  startDate?: Date;
  endDate?: Date;
}

/**
 * 公告管理服务
 * 提供公告的增删改查、启用/禁用切换、获取当前生效公告等功能
 * 使用 adminDB 单例操作 announcements 集合
 */
class AnnouncementService {
  /** 集合名称常量 */
  private readonly COLLECTION = 'announcements';

  /**
   * 创建公告
   * @param data - 创建公告所需的数据
   * @returns 创建成功后的公告文档ID，失败返回null
   * @throws 数据库操作异常时向上抛出
   */
  async createAnnouncement(data: CreateAnnouncementData): Promise<string | null> {
    const now = new Date();
    const doc: Omit<Announcement, '_id'> = {
      title: data.title,
      content: data.content,
      type: data.type,
      targetGroups: data.targetGroups || [],
      startDate: data.startDate,
      endDate: data.endDate,
      isActive: data.isActive,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };
    return await adminDB.insertOne<Announcement>(this.COLLECTION, doc);
  }

  /**
   * 获取公告列表（分页）
   * @param params - 分页与筛选参数
   * @param params.page - 页码，默认1
   * @param params.limit - 每页数量，默认20
   * @param params.search - 按标题模糊搜索的关键词
   * @param params.type - 按公告类型筛选
   * @param params.isActive - 按启用状态筛选
   * @returns 分页结果，包含公告列表和分页元信息
   */
  async listAnnouncements(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    isActive?: string;
  }): Promise<PaginationResult<Announcement>> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(1, params.limit || 20), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};

    if (params.search) {
      filter.title = { $regex: params.search, $options: 'i' };
    }
    if (params.type) {
      filter.type = params.type;
    }
    if (params.isActive !== undefined && params.isActive !== '') {
      filter.isActive = params.isActive === 'true';
    }

    const items = await adminDB.find<Announcement>(this.COLLECTION, filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments(this.COLLECTION, filter as never);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 根据ID获取公告详情
   * @param id - 公告文档的ObjectId字符串
   * @returns 公告文档或null
   */
  async getAnnouncementById(id: string): Promise<Announcement | null> {
    if (!ObjectId.isValid(id)) return null;
    return await adminDB.findOne<Announcement>(this.COLLECTION, {
      _id: new ObjectId(id),
    } as never);
  }

  /**
   * 更新公告
   * @param id - 公告文档的ObjectId字符串
   * @param data - 需要更新的字段
   * @returns 是否更新成功
   */
  async updateAnnouncement(id: string, data: UpdateAnnouncementData): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };
    return await adminDB.updateOne(this.COLLECTION, {
      _id: new ObjectId(id),
    } as never, { $set: updateData });
  }

  /**
   * 删除公告
   * @param id - 公告文档的ObjectId字符串
   * @returns 是否删除成功
   */
  async deleteAnnouncement(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) return false;
    return await adminDB.deleteOne(this.COLLECTION, {
      _id: new ObjectId(id),
    } as never);
  }

  /**
   * 切换公告启用/禁用状态
   * @param id - 公告文档的ObjectId字符串
   * @returns 切换后的最新启用状态，操作失败返回null
   */
  async toggleActive(id: string): Promise<boolean | null> {
    const announcement = await this.getAnnouncementById(id);
    if (!announcement) return null;

    const newActiveState = !announcement.isActive;
    const success = await adminDB.updateOne(this.COLLECTION, {
      _id: new ObjectId(id),
    } as never, {
      $set: { isActive: newActiveState, updatedAt: new Date() },
    });

    return success ? newActiveState : null;
  }

  /**
   * 获取当前生效的公告列表
   * 查询条件：isActive=true, startDate<=now, endDate>=now
   * 可选按目标分组筛选
   * @param targetGroups - 目标分组ID列表，传入时仅返回匹配该分组或无分组限制的公告
   * @returns 当前生效的公告列表
   */
  async getActiveAnnouncements(targetGroups?: string[]): Promise<Announcement[]> {
    const now = new Date();

    const filter: Record<string, unknown> = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    };

    if (targetGroups && targetGroups.length > 0) {
      filter.$or = [
        { targetGroups: { $exists: false } },
        { targetGroups: { $size: 0 } },
        { targetGroups: { $in: targetGroups } },
      ];
    }

    return await adminDB.find<Announcement>(this.COLLECTION, filter as never, {
      sort: { createdAt: -1 },
    });
  }
}

export const announcementService = new AnnouncementService();
