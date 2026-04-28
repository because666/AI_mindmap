import { v4 as uuidv4 } from 'uuid';
import { mongoDBService } from '../data/mongodb/connection';
import { Workspace, Visitor, WorkspaceMember, WorkspaceType, MemberRole } from '../types';

/**
 * 邀请码有效期（7天）
 */
const INVITE_CODE_EXPIRY_DAYS = 7;

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
}

/**
 * 工作区服务类
 * 提供工作区和访客的CRUD操作
 * 使用带TTL的内存缓存 + MongoDB持久化
 */
class WorkspaceService {
  private workspaceCache: Map<string, CacheEntry<Workspace>> = new Map();
  private visitorCache: Map<string, CacheEntry<Visitor>> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1分钟缓存过期
  private initialized = false;

  /**
   * 初始化：从MongoDB加载所有数据到内存缓存
   * 应在服务器启动时调用
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!mongoDBService.isConnected()) {
      console.log('[WorkspaceService] MongoDB未连接，跳过初始化加载');
      this.initialized = true;
      return;
    }

    try {
      const visitors = await mongoDBService.find<Visitor>('visitors', {});
      for (const visitor of visitors) {
        this.visitorCache.set(visitor.id, { data: visitor, loadedAt: Date.now() });
      }
      console.log(`[WorkspaceService] 从MongoDB加载了 ${visitors.length} 个访客`);

      const workspaces = await mongoDBService.find<Workspace>('workspaces', {});
      for (const workspace of workspaces) {
        this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
      }
      console.log(`[WorkspaceService] 从MongoDB加载了 ${workspaces.length} 个工作区`);

      this.initialized = true;
    } catch (error) {
      console.error('[WorkspaceService] 初始化加载失败:', error);
      this.initialized = true;
    }
  }

  /**
   * 注册或更新访客信息
   * @param visitorId - 访客ID（可选，不提供则自动生成）
   * @param nickname - 访客昵称
   * @returns 访客数据
   */
  async registerVisitor(visitorId?: string, nickname?: string): Promise<Visitor> {
    await this.ensureInitialized();

    if (visitorId) {
      const existing = await this.getVisitorFromCacheOrDB(visitorId);
      if (existing) {
        if (nickname) {
          existing.nickname = nickname;
        }
        existing.lastSeen = new Date();
        this.visitorCache.set(visitorId, { data: existing, loadedAt: Date.now() });
        await this.persistVisitor(existing);
        return existing;
      }
    }

    const newVisitor: Visitor = {
      id: visitorId || uuidv4(),
      nickname: nickname || `访客${Math.random().toString(36).substring(2, 6)}`,
      lastSeen: new Date(),
      workspaces: [],
      createdAt: new Date(),
    };

    this.visitorCache.set(newVisitor.id, { data: newVisitor, loadedAt: Date.now() });
    await this.persistVisitor(newVisitor);
    return newVisitor;
  }

  /**
   * 获取访客信息
   * @param visitorId - 访客ID
   * @returns 访客数据或null
   */
  async getVisitor(visitorId: string): Promise<Visitor | null> {
    await this.ensureInitialized();
    return this.getVisitorFromCacheOrDB(visitorId);
  }

  /**
   * 从缓存或数据库获取访客
   */
  private async getVisitorFromCacheOrDB(visitorId: string): Promise<Visitor | null> {
    const cached = this.visitorCache.get(visitorId);
    if (cached && Date.now() - cached.loadedAt < this.CACHE_TTL) {
      return cached.data;
    }

    if (mongoDBService.isConnected()) {
      try {
        const visitor = await mongoDBService.findOne<Visitor>('visitors', { id: visitorId } as never);
        if (visitor) {
          this.visitorCache.set(visitorId, { data: visitor, loadedAt: Date.now() });
          return visitor;
        }
      } catch (error) {
        console.error('[WorkspaceService] 从DB获取访客失败:', error);
      }
    }

    if (cached) {
      return cached.data;
    }

    return null;
  }

  /**
   * 创建工作区
   * @param name - 工作区名称
   * @param ownerId - 创建者访客ID
   * @param type - 工作区类型
   * @param description - 工作区描述
   * @returns 创建的工作区
   */
  async createWorkspace(
    name: string,
    ownerId: string,
    type: WorkspaceType = 'public',
    description?: string
  ): Promise<Workspace> {
    await this.ensureInitialized();

    const owner = await this.getVisitor(ownerId);
    const ownerNickname = owner?.nickname || '未知用户';

    const workspace: Workspace = {
      id: uuidv4(),
      name: name.trim() || '未命名工作区',
      description: description?.trim(),
      type,
      inviteCode: type === 'private' ? this.generateInviteCode() : undefined,
      inviteCodeExpiry: type === 'private' ? new Date(Date.now() + INVITE_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000) : undefined,
      ownerId,
      members: [
        {
          visitorId: ownerId,
          nickname: ownerNickname,
          role: 'owner',
          joinedAt: new Date(),
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
    await this.persistWorkspace(workspace);
    await this.addWorkspaceToVisitor(ownerId, workspace.id);

    return workspace;
  }

  /**
   * 获取工作区
   * @param workspaceId - 工作区ID
   * @returns 工作区数据或null
   */
  async getWorkspace(workspaceId: string): Promise<Workspace | null> {
    await this.ensureInitialized();

    const cached = this.workspaceCache.get(workspaceId);
    if (cached && Date.now() - cached.loadedAt < this.CACHE_TTL) {
      return cached.data;
    }

    if (mongoDBService.isConnected()) {
      try {
        const workspace = await mongoDBService.findOne<Workspace>('workspaces', { id: workspaceId } as never);
        if (workspace) {
          this.workspaceCache.set(workspaceId, { data: workspace, loadedAt: Date.now() });
          return workspace;
        }
      } catch (error) {
        console.error('[WorkspaceService] 从DB获取工作区失败:', error);
      }
    }

    if (cached) {
      return cached.data;
    }

    return null;
  }

  /**
   * 获取访客加入的所有工作区
   * @param visitorId - 访客ID
   * @returns 工作区列表
   */
  async getVisitorWorkspaces(visitorId: string): Promise<Workspace[]> {
    await this.ensureInitialized();

    const workspaces: Workspace[] = [];
    const now = Date.now();

    for (const entry of this.workspaceCache.values()) {
      if (entry.data.members.some(m => m.visitorId === visitorId)) {
        workspaces.push(entry.data);
      }
    }

    if (mongoDBService.isConnected()) {
      try {
        const dbWorkspaces = await mongoDBService.find<Workspace>('workspaces', {
          'members.visitorId': visitorId
        } as never);
        for (const ws of dbWorkspaces) {
          if (!workspaces.some(w => w.id === ws.id)) {
            workspaces.push(ws);
          }
          this.workspaceCache.set(ws.id, { data: ws, loadedAt: now });
        }
      } catch (error) {
        console.error('[WorkspaceService] 从DB获取访客工作区失败:', error);
      }
    }

    return workspaces;
  }

  /**
   * 获取所有公开工作区
   * @param excludeVisitorId - 排除已加入的访客ID
   * @returns 公开工作区列表
   */
  async getPublicWorkspaces(excludeVisitorId?: string): Promise<Workspace[]> {
    await this.ensureInitialized();

    const workspaces: Workspace[] = [];
    const now = Date.now();

    for (const entry of this.workspaceCache.values()) {
      if (entry.data.type === 'public') {
        if (excludeVisitorId && entry.data.members.some(m => m.visitorId === excludeVisitorId)) {
          continue;
        }
        workspaces.push(entry.data);
      }
    }

    if (mongoDBService.isConnected()) {
      try {
        const dbWorkspaces = await mongoDBService.find<Workspace>('workspaces', { type: 'public' } as never);
        for (const ws of dbWorkspaces) {
          if (!workspaces.some(w => w.id === ws.id)) {
            if (excludeVisitorId && ws.members.some(m => m.visitorId === excludeVisitorId)) {
              continue;
            }
            workspaces.push(ws);
          }
          this.workspaceCache.set(ws.id, { data: ws, loadedAt: now });
        }
      } catch (error) {
        console.error('[WorkspaceService] 从DB获取公开工作区失败:', error);
      }
    }

    return workspaces;
  }

  /**
   * 加入工作区
   * @param workspaceId - 工作区ID
   * @param visitorId - 访客ID
   * @param inviteCode - 邀请码（私密工作区需要）
   * @returns 加入后的工作区数据
   */
  async joinWorkspace(
    workspaceId: string,
    visitorId: string,
    inviteCode?: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    await this.ensureInitialized();

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: '工作区不存在' };
    }

    if (workspace.members.some(m => m.visitorId === visitorId)) {
      return { success: true, workspace };
    }

    if (workspace.type === 'private') {
      if (!inviteCode || inviteCode !== workspace.inviteCode) {
        return { success: false, error: '邀请码无效' };
      }
      if (workspace.inviteCodeExpiry && new Date() > workspace.inviteCodeExpiry) {
        return { success: false, error: '邀请码已过期' };
      }
    }

    const visitor = await this.getVisitor(visitorId);
    const nickname = visitor?.nickname || '未知用户';

    const newMember: WorkspaceMember = {
      visitorId,
      nickname,
      role: 'collaborator',
      joinedAt: new Date(),
    };

    workspace.members.push(newMember);
    workspace.updatedAt = new Date();

    this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
    await this.persistWorkspace(workspace);
    await this.addWorkspaceToVisitor(visitorId, workspace.id);

    return { success: true, workspace };
  }

  /**
   * 通过邀请码加入工作区
   * @param inviteCode - 邀请码
   * @param visitorId - 访客ID
   * @returns 加入后的工作区数据
   */
  async joinByInviteCode(
    inviteCode: string,
    visitorId: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    await this.ensureInitialized();

    let targetWorkspace: Workspace | null = null;

    for (const entry of this.workspaceCache.values()) {
      if (entry.data.inviteCode === inviteCode) {
        targetWorkspace = entry.data;
        break;
      }
    }

    if (!targetWorkspace && mongoDBService.isConnected()) {
      try {
        const results = await mongoDBService.find<Workspace>('workspaces', {
          inviteCode
        } as never);
        if (results.length > 0) {
          targetWorkspace = results[0];
          this.workspaceCache.set(targetWorkspace.id, { data: targetWorkspace, loadedAt: Date.now() });
        }
      } catch (error) {
        console.error('[WorkspaceService] 通过邀请码查找工作区失败:', error);
      }
    }

    if (!targetWorkspace) {
      return { success: false, error: '邀请码无效' };
    }

    return this.joinWorkspace(targetWorkspace.id, visitorId, inviteCode);
  }

  /**
   * 离开工作区
   * @param workspaceId - 工作区ID
   * @param visitorId - 访客ID
   * @returns 是否成功
   */
  async leaveWorkspace(workspaceId: string, visitorId: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: '工作区不存在' };
    }

    if (workspace.ownerId === visitorId) {
      return { success: false, error: '创建者不能离开工作区，只能删除' };
    }

    workspace.members = workspace.members.filter(m => m.visitorId !== visitorId);
    workspace.updatedAt = new Date();

    this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
    await this.persistWorkspace(workspace);
    await this.removeWorkspaceFromVisitor(visitorId, workspace.id);

    return { success: true };
  }

  /**
   * 更新工作区信息
   * @param workspaceId - 工作区ID
   * @param updates - 更新内容
   * @param visitorId - 操作者访客ID
   * @returns 更新后的工作区
   */
  async updateWorkspace(
    workspaceId: string,
    updates: Partial<Pick<Workspace, 'name' | 'description' | 'type'>>,
    visitorId: string
  ): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
    await this.ensureInitialized();

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: '工作区不存在' };
    }

    if (!this.isOwner(workspace, visitorId)) {
      return { success: false, error: '只有创建者可以修改工作区设置' };
    }

    if (updates.name !== undefined) {
      workspace.name = updates.name.trim() || workspace.name;
    }
    if (updates.description !== undefined) {
      workspace.description = updates.description.trim();
    }
    if (updates.type !== undefined && updates.type !== workspace.type) {
      workspace.type = updates.type;
      if (updates.type === 'private' && !workspace.inviteCode) {
        workspace.inviteCode = this.generateInviteCode();
        workspace.inviteCodeExpiry = new Date(Date.now() + INVITE_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      }
      if (updates.type === 'public') {
        workspace.inviteCode = undefined;
        workspace.inviteCodeExpiry = undefined;
      }
    }

    workspace.updatedAt = new Date();
    this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
    await this.persistWorkspace(workspace);

    return { success: true, workspace };
  }

  /**
   * 刷新邀请码
   * @param workspaceId - 工作区ID
   * @param visitorId - 操作者访客ID
   * @returns 新的邀请码
   */
  async refreshInviteCode(
    workspaceId: string,
    visitorId: string
  ): Promise<{ success: boolean; inviteCode?: string; error?: string }> {
    await this.ensureInitialized();

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: '工作区不存在' };
    }

    if (!this.isOwner(workspace, visitorId)) {
      return { success: false, error: '只有创建者可以刷新邀请码' };
    }

    workspace.inviteCode = this.generateInviteCode();
    workspace.inviteCodeExpiry = new Date(Date.now() + INVITE_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    workspace.updatedAt = new Date();

    this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
    await this.persistWorkspace(workspace);

    return { success: true, inviteCode: workspace.inviteCode };
  }

  /**
   * 移除工作区成员
   * @param workspaceId - 工作区ID
   * @param targetVisitorId - 被移除的访客ID
   * @param operatorVisitorId - 操作者访客ID
   * @returns 操作结果
   */
  async removeMember(
    workspaceId: string,
    targetVisitorId: string,
    operatorVisitorId: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: '工作区不存在' };
    }

    if (!this.isOwner(workspace, operatorVisitorId)) {
      return { success: false, error: '只有创建者可以移除成员' };
    }

    if (targetVisitorId === operatorVisitorId) {
      return { success: false, error: '不能移除自己' };
    }

    const memberIndex = workspace.members.findIndex(m => m.visitorId === targetVisitorId);
    if (memberIndex === -1) {
      return { success: false, error: '该成员不在工作区中' };
    }

    workspace.members.splice(memberIndex, 1);
    workspace.updatedAt = new Date();

    this.workspaceCache.set(workspace.id, { data: workspace, loadedAt: Date.now() });
    await this.persistWorkspace(workspace);
    await this.removeWorkspaceFromVisitor(targetVisitorId, workspace.id);

    return { success: true };
  }

  /**
   * 删除工作区
   * @param workspaceId - 工作区ID
   * @param visitorId - 操作者访客ID
   * @returns 操作结果
   */
  async deleteWorkspace(
    workspaceId: string,
    visitorId: string
  ): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();

    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) {
      return { success: false, error: '工作区不存在' };
    }

    if (!this.isOwner(workspace, visitorId)) {
      return { success: false, error: '只有创建者可以删除工作区' };
    }

    for (const member of workspace.members) {
      await this.removeWorkspaceFromVisitor(member.visitorId, workspaceId);
    }

    this.workspaceCache.delete(workspaceId);

    if (mongoDBService.isConnected()) {
      await mongoDBService.deleteOne('workspaces', { id: workspaceId } as never);
    }

    return { success: true };
  }

  /**
   * 检查访客是否为工作区成员
   * @param workspaceId - 工作区ID
   * @param visitorId - 访客ID
   * @returns 是否为成员
   */
  async isMember(workspaceId: string, visitorId: string): Promise<boolean> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return false;
    return workspace.members.some(m => m.visitorId === visitorId);
  }

  /**
   * 获取访客在工作区中的角色
   * @param workspaceId - 工作区ID
   * @param visitorId - 访客ID
   * @returns 角色或null
   */
  async getMemberRole(workspaceId: string, visitorId: string): Promise<MemberRole | null> {
    const workspace = await this.getWorkspace(workspaceId);
    if (!workspace) return null;
    const member = workspace.members.find(m => m.visitorId === visitorId);
    return member?.role || null;
  }

  /**
   * 判断访客是否为工作区创建者
   */
  private isOwner(workspace: Workspace, visitorId: string): boolean {
    return workspace.ownerId === visitorId;
  }

  /**
   * 生成6位邀请码
   */
  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * 将工作区添加到访客的工作区列表
   */
  private async addWorkspaceToVisitor(visitorId: string, workspaceId: string): Promise<void> {
    const visitor = await this.getVisitor(visitorId);
    if (visitor && !visitor.workspaces.includes(workspaceId)) {
      visitor.workspaces.push(workspaceId);
      this.visitorCache.set(visitorId, { data: visitor, loadedAt: Date.now() });
      await this.persistVisitor(visitor);
    }
  }

  /**
   * 从访客的工作区列表中移除
   */
  private async removeWorkspaceFromVisitor(visitorId: string, workspaceId: string): Promise<void> {
    const visitor = await this.getVisitor(visitorId);
    if (visitor) {
      visitor.workspaces = visitor.workspaces.filter(id => id !== workspaceId);
      this.visitorCache.set(visitorId, { data: visitor, loadedAt: Date.now() });
      await this.persistVisitor(visitor);
    }
  }

  /**
   * 持久化访客数据到MongoDB
   * 使用upsert逻辑：记录存在则更新，不存在则插入
   */
  private async persistVisitor(visitor: Visitor): Promise<void> {
    if (!mongoDBService.isConnected()) return;
    try {
      const existing = await mongoDBService.findOne('visitors', { id: visitor.id } as never);
      if (existing) {
        await mongoDBService.updateOne('visitors', { id: visitor.id } as never, {
          $set: visitor
        } as never);
      } else {
        await mongoDBService.insertOne('visitors', visitor);
      }
    } catch (error) {
      console.error('[WorkspaceService] 持久化访客数据失败:', error);
    }
  }

  /**
   * 持久化工作区数据到MongoDB
   * 使用upsert逻辑：记录存在则更新，不存在则插入
   */
  private async persistWorkspace(workspace: Workspace): Promise<void> {
    if (!mongoDBService.isConnected()) return;
    try {
      const existing = await mongoDBService.findOne('workspaces', { id: workspace.id } as never);
      if (existing) {
        await mongoDBService.updateOne('workspaces', { id: workspace.id } as never, {
          $set: workspace
        } as never);
      } else {
        await mongoDBService.insertOne('workspaces', workspace);
      }
    } catch (error) {
      console.error('[WorkspaceService] 持久化工作区数据失败:', error);
    }
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

export const workspaceService = new WorkspaceService();
