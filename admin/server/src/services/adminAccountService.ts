import bcryptjs from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { adminDB } from '../config/database';
import { config } from '../config';
import { AdminAccount, AdminRole, PaginationResult } from '../types';

/**
 * 角色权限映射表
 * 每个角色允许访问的 API 路径前缀数组
 */
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: ['/api/'],
  operator: ['/api/dashboard', '/api/admin/users', '/api/admin/workspaces', '/api/admin/audit', '/api/admin/push', '/api/admin/ip-bans', '/api/admin/feedbacks', '/api/admin/export'],
  auditor: ['/api/dashboard', '/api/admin/audit', '/api/admin/audit-logs', '/api/admin/feedbacks'],
  readonly: ['/api/dashboard'],
};

/**
 * 管理员账户服务
 * 提供管理员账户的增删改查、密码校验、权限查询等功能
 * 操作 admin_accounts 集合
 */
class AdminAccountService {
  /**
   * 创建管理员账户
   * 密码使用 bcryptjs 加密后存储，用户名不可重复
   * @param username - 登录用户名，需唯一
   * @param password - 明文密码，将自动加密存储
   * @param nickname - 显示昵称
   * @param role - 管理员角色
   * @param creatorIp - 创建者IP地址，用于审计追踪
   * @returns 新创建的 AdminAccount 文档ID，若用户名已存在则返回 null
   * @throws 当数据库操作异常时抛出错误
   */
  async createAccount(
    username: string,
    password: string,
    nickname: string,
    role: AdminRole,
    creatorIp: string
  ): Promise<string | null> {
    const existing = await adminDB.findOne<AdminAccount>('admin_accounts', {
      username,
    } as never);
    if (existing) {
      return null;
    }

    const passwordHash = await bcryptjs.hash(password, config.security.bcryptRounds);

    const id = await adminDB.insertOne('admin_accounts', {
      username,
      passwordHash,
      nickname,
      role,
      isActive: true,
      createdAt: new Date(),
      createdByIp: creatorIp,
    });

    return id;
  }

  /**
   * 分页查询管理员账户列表
   * 仅返回 isActive=true 的账户（软删除的不显示）
   * @param page - 页码，从1开始
   * @param limit - 每页条数
   * @returns 分页结果，包含 items、total、page、limit、totalPages
   */
  async listAccounts(page: number, limit: number): Promise<PaginationResult<Omit<AdminAccount, 'passwordHash'>>> {
    const skip = (page - 1) * limit;
    const filter = { isActive: true };

    const accounts = await adminDB.find<AdminAccount>('admin_accounts', filter as never, {
      sort: { createdAt: -1 },
      skip,
      limit,
    });

    const total = await adminDB.countDocuments('admin_accounts', filter as never);

    const items = accounts.map(({ passwordHash: _ph, ...rest }) => rest);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 按用户名查找管理员账户
   * @param username - 登录用户名
   * @returns AdminAccount 或 null（未找到时）
   */
  async getAccountByUsername(username: string): Promise<AdminAccount | null> {
    return await adminDB.findOne<AdminAccount>('admin_accounts', {
      username,
    } as never);
  }

  /**
   * 更新管理员账户信息
   * 仅允许更新昵称、角色、启用状态
   * @param id - 管理员账户的 _id 字符串
   * @param updates - 需要更新的字段集合
   * @returns 是否更新成功
   * @throws 当 id 格式无效时返回 false
   */
  async updateAccount(
    id: string,
    updates: { nickname?: string; role?: AdminRole; isActive?: boolean }
  ): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }

    const updateFields: Record<string, unknown> = {};
    if (updates.nickname !== undefined) {
      updateFields.nickname = updates.nickname;
    }
    if (updates.role !== undefined) {
      updateFields.role = updates.role;
    }
    if (updates.isActive !== undefined) {
      updateFields.isActive = updates.isActive;
    }

    if (Object.keys(updateFields).length === 0) {
      return false;
    }

    return await adminDB.updateOne(
      'admin_accounts',
      { _id: new ObjectId(id) } as never,
      { $set: updateFields }
    );
  }

  /**
   * 软删除管理员账户
   * 将 isActive 设为 false，而非物理删除
   * @param id - 管理员账户的 _id 字符串
   * @returns 是否操作成功
   */
  async deleteAccount(id: string): Promise<boolean> {
    if (!ObjectId.isValid(id)) {
      return false;
    }

    return await adminDB.updateOne(
      'admin_accounts',
      { _id: new ObjectId(id) } as never,
      { $set: { isActive: false } }
    );
  }

  /**
   * 校验管理员密码
   * 通过用户名查找账户并比对密码哈希
   * @param username - 登录用户名
   * @param password - 明文密码
   * @returns 密码正确时返回 AdminAccount（含角色信息），否则返回 null
   */
  async validatePassword(username: string, password: string): Promise<AdminAccount | null> {
    const account = await adminDB.findOne<AdminAccount>('admin_accounts', {
      username,
      isActive: true,
    } as never);

    if (!account) {
      return null;
    }

    const isMatch = await bcryptjs.compare(password, account.passwordHash);
    if (!isMatch) {
      return null;
    }

    await adminDB.updateOne(
      'admin_accounts',
      { _id: account._id } as never,
      { $set: { lastLoginAt: new Date() } }
    );

    return account;
  }

  /**
   * 获取指定角色允许访问的 API 路径前缀数组
   * @param role - 管理员角色
   * @returns 该角色允许访问的 API 路径前缀数组
   */
  getPermissionPaths(role: AdminRole): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }
}

export const adminAccountService = new AdminAccountService();
