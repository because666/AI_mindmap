import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WorkspaceService 单元测试
 * 覆盖工作区的创建、查询、更新、删除、缓存清理等核心流程
 * 同时覆盖异常流程（数据库不可用、工作区不存在）和边界情况（空参数、超长名称）
 * 使用 vi.doMock + 动态导入模拟 mongoDBService，避免依赖真实数据库
 */

/** 模拟的 mongoDBService 方法集合 */
interface MockMongoDBService {
  isConnected: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
  getCollection: ReturnType<typeof vi.fn>;
}

/** 模拟的 mongoDBService 实例 */
let mockMongoDBService: MockMongoDBService;

/** 测试用访客数据结构 */
interface TestVisitor {
  id: string;
  nickname: string;
  lastSeen: Date;
  workspaces: string[];
  createdAt: Date;
  visitorSecret?: string;
}

/** 测试用工作区数据结构 */
interface TestWorkspace {
  id: string;
  name: string;
  description?: string;
  type: 'public' | 'private';
  inviteCode?: string;
  inviteCodeExpiry?: Date;
  ownerId: string;
  members: Array<{
    visitorId: string;
    nickname: string;
    role: 'owner' | 'collaborator';
    joinedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建测试用访客数据
 * @param overrides - 覆盖的访客属性
 * @returns 完整的测试访客数据
 */
function createTestVisitor(overrides: Partial<TestVisitor> = {}): TestVisitor {
  return {
    id: 'visitor-1',
    nickname: '测试访客',
    lastSeen: new Date('2025-06-15T10:00:00.000Z'),
    workspaces: [],
    createdAt: new Date('2025-06-15T10:00:00.000Z'),
    visitorSecret: 'existing-secret',
    ...overrides,
  };
}

describe('WorkspaceService 工作区服务', () => {
  beforeEach(() => {
    vi.resetModules();

    mockMongoDBService = {
      isConnected: vi.fn(() => true),
      insertOne: vi.fn().mockResolvedValue('inserted-id'),
      // 默认 findOne 返回 null，具体测试用 mockResolvedValueOnce 覆盖
      findOne: vi.fn().mockResolvedValue(null),
      // 默认 find 返回空数组，避免 initialize 加载阶段消费掉测试数据
      find: vi.fn().mockResolvedValue([]),
      updateOne: vi.fn().mockResolvedValue(true),
      deleteOne: vi.fn().mockResolvedValue(true),
      deleteMany: vi.fn().mockResolvedValue(0),
      getCollection: vi.fn(),
    };

    vi.doMock('../data/mongodb/connection', () => ({
      mongoDBService: mockMongoDBService,
    }));

    vi.doMock('uuid', () => ({
      v4: vi.fn(() => 'mock-uuid-' + Math.random().toString(36).substring(2, 8)),
    }));
  });

  /**
   * 动态导入 workspaceService，确保 mock 生效
   * 每次测试前重新导入以获取全新的实例
   * @returns workspaceService 实例
   */
  async function getService() {
    const mod = await import('../services/workspaceService');
    return mod.workspaceService;
  }

  describe('registerVisitor - 注册访客', () => {
    it('新访客应生成完整数据并持久化到数据库', async () => {
      const service = await getService();
      const visitor = await service.registerVisitor(undefined, '新访客');

      expect(visitor.id).toBeDefined();
      expect(visitor.nickname).toBe('新访客');
      expect(visitor.visitorSecret).toBeDefined();
      expect(visitor.visitorSecret!.length).toBe(64);
      expect(visitor.workspaces).toEqual([]);
      expect(mockMongoDBService.insertOne).toHaveBeenCalled();
    });

    it('未提供昵称时应自动生成默认昵称', async () => {
      const service = await getService();
      const visitor = await service.registerVisitor();

      expect(visitor.nickname).toMatch(/^访客/);
    });

    it('已存在的访客应更新昵称和最后访问时间', async () => {
      const existing = createTestVisitor();
      // getVisitorFromCacheOrDB 和 persistVisitor 都会调用 findOne，需要返回两次
      mockMongoDBService.findOne.mockResolvedValue(existing);

      const service = await getService();
      const visitor = await service.registerVisitor('visitor-1', '更新昵称');

      expect(visitor.id).toBe('visitor-1');
      expect(visitor.nickname).toBe('更新昵称');
      expect(visitor.lastSeen).toBeInstanceOf(Date);
      // 已存在记录应走 updateOne 而非 insertOne
      expect(mockMongoDBService.updateOne).toHaveBeenCalled();
    });

    it('历史访客缺少 visitorSecret 时应补生成', async () => {
      const existing = createTestVisitor({ visitorSecret: undefined });
      mockMongoDBService.findOne.mockResolvedValueOnce(existing);

      const service = await getService();
      const visitor = await service.registerVisitor('visitor-1');

      expect(visitor.visitorSecret).toBeDefined();
      expect(visitor.visitorSecret!.length).toBe(64);
    });
  });

  describe('getVisitor - 查询访客', () => {
    it('应返回指定访客数据', async () => {
      const existing = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(existing);

      const service = await getService();
      const visitor = await service.getVisitor('visitor-1');

      expect(visitor).not.toBeNull();
      expect(visitor!.id).toBe('visitor-1');
    });

    it('访客不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const visitor = await service.getVisitor('non-existent');

      expect(visitor).toBeNull();
    });
  });

  describe('createWorkspace - 创建工作区', () => {
    it('正常流程：应创建公开工作区并加入访客工作区列表', async () => {
      const owner = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(owner);

      const service = await getService();
      const workspace = await service.createWorkspace('测试工作区', 'visitor-1', 'public', '描述');

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('测试工作区');
      expect(workspace.description).toBe('描述');
      expect(workspace.type).toBe('public');
      expect(workspace.ownerId).toBe('visitor-1');
      expect(workspace.members).toHaveLength(1);
      expect(workspace.members[0].role).toBe('owner');
      expect(workspace.inviteCode).toBeUndefined();
      expect(mockMongoDBService.insertOne).toHaveBeenCalled();
    });

    it('私密工作区应自动生成邀请码及过期时间', async () => {
      const owner = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(owner);

      const service = await getService();
      const workspace = await service.createWorkspace('私密工作区', 'visitor-1', 'private');

      expect(workspace.type).toBe('private');
      expect(workspace.inviteCode).toBeDefined();
      expect(workspace.inviteCode!.length).toBe(6);
      expect(workspace.inviteCodeExpiry).toBeInstanceOf(Date);
    });

    it('空名称时应使用默认名称"未命名工作区"', async () => {
      const owner = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(owner);

      const service = await getService();
      const workspace = await service.createWorkspace('   ', 'visitor-1');

      expect(workspace.name).toBe('未命名工作区');
    });

    it('未提供描述时 description 应为 undefined', async () => {
      const owner = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(owner);

      const service = await getService();
      const workspace = await service.createWorkspace('测试', 'visitor-1');

      expect(workspace.description).toBeUndefined();
    });

    it('访客不存在时应使用"未知用户"作为创建者昵称', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const workspace = await service.createWorkspace('测试', 'visitor-1');

      expect(workspace.members[0].nickname).toBe('未知用户');
    });

    it('超长名称（1000字符）应正常创建', async () => {
      const owner = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(owner);
      const longName = 'A'.repeat(1000);

      const service = await getService();
      const workspace = await service.createWorkspace(longName, 'visitor-1');

      expect(workspace.name).toBe(longName);
      expect(workspace.name.length).toBe(1000);
    });
  });

  describe('getWorkspace - 查询工作区', () => {
    it('应返回指定工作区数据', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.getWorkspace('ws-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ws-1');
    });

    it('工作区不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.getWorkspace('non-existent');

      expect(result).toBeNull();
    });

    it('数据库查询异常时应返回 null', async () => {
      mockMongoDBService.findOne.mockRejectedValueOnce(new Error('数据库错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.getWorkspace('ws-1');

      expect(result).toBeNull();
      errorSpy.mockRestore();
    });
  });

  describe('getVisitorWorkspaces - 查询访客的所有工作区', () => {
    it('应返回访客加入的所有工作区', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // 使用 mockImplementation 区分 initialize 的 find 和测试方法的 find
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          return Promise.resolve([workspace]);
        }
        return Promise.resolve([]);
      });

      const service = await getService();
      const workspaces = await service.getVisitorWorkspaces('visitor-1');

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].id).toBe('ws-1');
    });

    it('数据库查询异常时应返回空数组', async () => {
      // 让 find 在被调用时抛出异常（仅 workspaces 集合）
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          return Promise.reject(new Error('数据库错误'));
        }
        return Promise.resolve([]);
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const workspaces = await service.getVisitorWorkspaces('visitor-1');

      expect(workspaces).toEqual([]);
      errorSpy.mockRestore();
    });
  });

  describe('getPublicWorkspaces - 查询公开工作区', () => {
    it('应返回所有公开工作区', async () => {
      const publicWs = {
        id: 'ws-1',
        name: '公开工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      // 使用 mockImplementation 区分 initialize 的 find 和测试方法的 find
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          return Promise.resolve([publicWs]);
        }
        return Promise.resolve([]);
      });

      const service = await getService();
      const workspaces = await service.getPublicWorkspaces();

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].type).toBe('public');
    });

    it('指定 excludeVisitorId 时应排除该访客已加入的工作区', async () => {
      const publicWs = {
        id: 'ws-1',
        name: '公开工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          return Promise.resolve([publicWs]);
        }
        return Promise.resolve([]);
      });

      const service = await getService();
      const workspaces = await service.getPublicWorkspaces('visitor-1');

      expect(workspaces).toHaveLength(0);
    });

    it('置顶工作区应排在未置顶工作区之前', async () => {
      // 未置顶工作区创建时间更早，置顶工作区创建时间更晚
      // 若不按置顶优先排序，未置顶的 ws-old 会因 createdAt 更早被错误排到前面
      const pinnedWs = {
        id: 'ws-pinned',
        name: '置顶工作区',
        type: 'public',
        ownerId: 'visitor-2',
        members: [],
        createdAt: new Date('2025-06-20T00:00:00.000Z'),
        updatedAt: new Date('2025-06-20T00:00:00.000Z'),
        isPinned: true,
        pinnedAt: new Date('2025-06-25T00:00:00.000Z'),
      };
      const unpinnedOldWs = {
        id: 'ws-old',
        name: '较早创建的普通工作区',
        type: 'public',
        ownerId: 'visitor-3',
        members: [],
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      };
      const unpinnedNewWs = {
        id: 'ws-new',
        name: '较新创建的普通工作区',
        type: 'public',
        ownerId: 'visitor-4',
        members: [],
        createdAt: new Date('2025-06-28T00:00:00.000Z'),
        updatedAt: new Date('2025-06-28T00:00:00.000Z'),
      };
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          // 数据库返回顺序故意打乱，确保排序逻辑生效
          return Promise.resolve([unpinnedNewWs, unpinnedOldWs, pinnedWs]);
        }
        return Promise.resolve([]);
      });

      const service = await getService();
      const workspaces = await service.getPublicWorkspaces();

      expect(workspaces).toHaveLength(3);
      // 置顶工作区应排在第一位
      expect(workspaces[0].id).toBe('ws-pinned');
      // 未置顶工作区之间按 createdAt 倒序，较新的排在前
      expect(workspaces[1].id).toBe('ws-new');
      expect(workspaces[2].id).toBe('ws-old');
    });

    it('多个置顶工作区应按 pinnedAt 倒序排序', async () => {
      const pinnedEarlier = {
        id: 'ws-earlier',
        name: '较早置顶',
        type: 'public',
        ownerId: 'visitor-2',
        members: [],
        createdAt: new Date('2025-06-01T00:00:00.000Z'),
        updatedAt: new Date('2025-06-01T00:00:00.000Z'),
        isPinned: true,
        pinnedAt: new Date('2025-06-10T00:00:00.000Z'),
      };
      const pinnedLater = {
        id: 'ws-later',
        name: '较晚置顶',
        type: 'public',
        ownerId: 'visitor-3',
        members: [],
        createdAt: new Date('2025-06-05T00:00:00.000Z'),
        updatedAt: new Date('2025-06-05T00:00:00.000Z'),
        isPinned: true,
        pinnedAt: new Date('2025-06-25T00:00:00.000Z'),
      };
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          // 数据库返回顺序故意把早置顶的放前面，验证会被倒序排列
          return Promise.resolve([pinnedEarlier, pinnedLater]);
        }
        return Promise.resolve([]);
      });

      const service = await getService();
      const workspaces = await service.getPublicWorkspaces();

      expect(workspaces).toHaveLength(2);
      // pinnedAt 更晚的应排在前面
      expect(workspaces[0].id).toBe('ws-later');
      expect(workspaces[1].id).toBe('ws-earlier');
    });

    it('缺少 pinnedAt 的置顶工作区应视为最早置顶，但仍排在未置顶工作区之前', async () => {
      const pinnedNoTime = {
        id: 'ws-pinned-no-time',
        name: '置顶但无 pinnedAt',
        type: 'public',
        ownerId: 'visitor-2',
        members: [],
        createdAt: new Date('2025-06-01T00:00:00.000Z'),
        updatedAt: new Date('2025-06-01T00:00:00.000Z'),
        isPinned: true,
        // pinnedAt 缺失
      };
      const unpinned = {
        id: 'ws-unpinned',
        name: '未置顶',
        type: 'public',
        ownerId: 'visitor-3',
        members: [],
        createdAt: new Date('2025-06-05T00:00:00.000Z'),
        updatedAt: new Date('2025-06-05T00:00:00.000Z'),
      };
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          return Promise.resolve([unpinned, pinnedNoTime]);
        }
        return Promise.resolve([]);
      });

      const service = await getService();
      const workspaces = await service.getPublicWorkspaces();

      expect(workspaces).toHaveLength(2);
      // 缺少 pinnedAt 的置顶工作区仍应排在未置顶工作区之前
      expect(workspaces[0].id).toBe('ws-pinned-no-time');
      expect(workspaces[1].id).toBe('ws-unpinned');
    });
  });

  describe('joinWorkspace - 加入工作区', () => {
    it('工作区不存在时应返回失败', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.joinWorkspace('non-existent', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('工作区不存在');
    });

    it('已是成员时应直接返回成功', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-2', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.joinWorkspace('ws-1', 'visitor-2');

      expect(result.success).toBe(true);
    });

    it('私密工作区邀请码错误时应返回失败', async () => {
      const workspace = {
        id: 'ws-1',
        name: '私密工作区',
        type: 'private',
        inviteCode: 'ABCDEF',
        inviteCodeExpiry: new Date(Date.now() + 86400000),
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.joinWorkspace('ws-1', 'visitor-2', 'WRONG');

      expect(result.success).toBe(false);
      expect(result.error).toBe('邀请码无效');
    });

    it('私密工作区邀请码已过期时应返回失败', async () => {
      const workspace = {
        id: 'ws-1',
        name: '私密工作区',
        type: 'private',
        inviteCode: 'ABCDEF',
        inviteCodeExpiry: new Date(Date.now() - 86400000),
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.joinWorkspace('ws-1', 'visitor-2', 'ABCDEF');

      expect(result.success).toBe(false);
      expect(result.error).toBe('邀请码已过期');
    });

    it('正常加入工作区时应添加成员并持久化', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne
        .mockResolvedValueOnce(workspace) // 第一次获取工作区
        .mockResolvedValueOnce(createTestVisitor()); // 获取访客信息

      const service = await getService();
      const result = await service.joinWorkspace('ws-1', 'visitor-2');

      expect(result.success).toBe(true);
      expect(result.workspace!.members).toHaveLength(2);
      expect(result.workspace!.members[1].role).toBe('collaborator');
    });
  });

  describe('leaveWorkspace - 离开工作区', () => {
    it('工作区不存在时应返回失败', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.leaveWorkspace('non-existent', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('工作区不存在');
    });

    it('创建者不能离开工作区', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.leaveWorkspace('ws-1', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('创建者不能离开工作区，只能删除');
    });

    it('普通成员应能成功离开工作区', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [
          { visitorId: 'visitor-1', nickname: '创建者', role: 'owner' as const, joinedAt: new Date() },
          { visitorId: 'visitor-2', nickname: '成员', role: 'collaborator' as const, joinedAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne
        .mockResolvedValueOnce(workspace)
        .mockResolvedValueOnce(createTestVisitor({ id: 'visitor-2' }));

      const service = await getService();
      const result = await service.leaveWorkspace('ws-1', 'visitor-2');

      expect(result.success).toBe(true);
    });
  });

  describe('updateWorkspace - 更新工作区', () => {
    it('工作区不存在时应返回失败', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.updateWorkspace('non-existent', { name: '新名称' }, 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('工作区不存在');
    });

    it('非创建者不能修改工作区', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.updateWorkspace('ws-1', { name: '新名称' }, 'visitor-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('只有创建者可以修改工作区设置');
    });

    it('创建者应能更新工作区名称', async () => {
      const workspace = {
        id: 'ws-1',
        name: '原名称',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.updateWorkspace('ws-1', { name: '新名称' }, 'visitor-1');

      expect(result.success).toBe(true);
      expect(result.workspace!.name).toBe('新名称');
    });

    it('更新类型为 private 时应自动生成邀请码', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.updateWorkspace('ws-1', { type: 'private' }, 'visitor-1');

      expect(result.success).toBe(true);
      expect(result.workspace!.type).toBe('private');
      expect(result.workspace!.inviteCode).toBeDefined();
      expect(result.workspace!.inviteCodeExpiry).toBeInstanceOf(Date);
    });

    it('更新类型为 public 时应清除邀请码', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'private',
        inviteCode: 'ABCDEF',
        inviteCodeExpiry: new Date(Date.now() + 86400000),
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.updateWorkspace('ws-1', { type: 'public' }, 'visitor-1');

      expect(result.success).toBe(true);
      expect(result.workspace!.type).toBe('public');
      expect(result.workspace!.inviteCode).toBeUndefined();
      expect(result.workspace!.inviteCodeExpiry).toBeUndefined();
    });

    it('空名称时应保留原名称', async () => {
      const workspace = {
        id: 'ws-1',
        name: '原名称',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.updateWorkspace('ws-1', { name: '   ' }, 'visitor-1');

      expect(result.success).toBe(true);
      expect(result.workspace!.name).toBe('原名称');
    });
  });

  describe('refreshInviteCode - 刷新邀请码', () => {
    it('工作区不存在时应返回失败', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.refreshInviteCode('non-existent', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('工作区不存在');
    });

    it('非创建者不能刷新邀请码', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'private',
        inviteCode: 'ABCDEF',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.refreshInviteCode('ws-1', 'visitor-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('只有创建者可以刷新邀请码');
    });

    it('创建者应能刷新邀请码', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'private',
        inviteCode: 'ABCDEF',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.refreshInviteCode('ws-1', 'visitor-1');

      expect(result.success).toBe(true);
      expect(result.inviteCode).toBeDefined();
      expect(result.inviteCode!.length).toBe(6);
      expect(result.inviteCode).not.toBe('ABCDEF');
    });
  });

  describe('removeMember - 移除成员', () => {
    it('工作区不存在时应返回失败', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.removeMember('non-existent', 'visitor-2', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('工作区不存在');
    });

    it('非创建者不能移除成员', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.removeMember('ws-1', 'visitor-2', 'visitor-3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('只有创建者可以移除成员');
    });

    it('不能移除自己', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.removeMember('ws-1', 'visitor-1', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('不能移除自己');
    });

    it('成员不存在时应返回失败', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.removeMember('ws-1', 'visitor-2', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('该成员不在工作区中');
    });
  });

  describe('deleteWorkspace - 删除工作区', () => {
    it('工作区不存在时应返回失败', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.deleteWorkspace('non-existent', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('工作区不存在');
    });

    it('非创建者不能删除工作区', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.deleteWorkspace('ws-1', 'visitor-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('只有创建者可以删除工作区');
    });

    it('创建者应能删除工作区并清理所有成员关联', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [
          { visitorId: 'visitor-1', nickname: '创建者', role: 'owner' as const, joinedAt: new Date() },
          { visitorId: 'visitor-2', nickname: '成员', role: 'collaborator' as const, joinedAt: new Date() },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne
        .mockResolvedValueOnce(workspace)
        .mockResolvedValue(createTestVisitor());

      const service = await getService();
      const result = await service.deleteWorkspace('ws-1', 'visitor-1');

      expect(result.success).toBe(true);
      expect(mockMongoDBService.deleteOne).toHaveBeenCalledWith('workspaces', { id: 'ws-1' });
    });
  });

  describe('isMember - 成员校验', () => {
    it('工作区不存在时应返回 false', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.isMember('non-existent', 'visitor-1');

      expect(result).toBe(false);
    });

    it('是成员时应返回 true', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.isMember('ws-1', 'visitor-1');

      expect(result).toBe(true);
    });
  });

  describe('getMemberRole - 获取成员角色', () => {
    it('工作区不存在时应返回 null', async () => {
      mockMongoDBService.findOne.mockResolvedValueOnce(null);

      const service = await getService();
      const result = await service.getMemberRole('non-existent', 'visitor-1');

      expect(result).toBeNull();
    });

    it('应返回成员的角色', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.getMemberRole('ws-1', 'visitor-1');

      expect(result).toBe('owner');
    });

    it('非成员应返回 null', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [{ visitorId: 'visitor-1', nickname: '测试', role: 'owner' as const, joinedAt: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      const result = await service.getMemberRole('ws-1', 'visitor-2');

      expect(result).toBeNull();
    });
  });

  describe('缓存清理', () => {
    it('clearVisitorCache 应清除指定访客缓存', async () => {
      const existing = createTestVisitor();
      mockMongoDBService.findOne.mockResolvedValueOnce(existing);

      const service = await getService();
      await service.getVisitor('visitor-1');

      // 清除缓存
      service.clearVisitorCache('visitor-1');

      // 再次获取应查库
      mockMongoDBService.findOne.mockResolvedValueOnce(existing);
      await service.getVisitor('visitor-1');

      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(2);
    });

    it('clearWorkspaceCache 应清除指定工作区缓存', async () => {
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);

      const service = await getService();
      await service.getWorkspace('ws-1');

      // 清除缓存
      service.clearWorkspaceCache('ws-1');

      // 再次获取应查库
      mockMongoDBService.findOne.mockResolvedValueOnce(workspace);
      await service.getWorkspace('ws-1');

      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(2);
    });

    it('clearAllCache 应清除所有缓存', async () => {
      const visitor = createTestVisitor();
      const workspace = {
        id: 'ws-1',
        name: '工作区',
        type: 'public',
        ownerId: 'visitor-1',
        members: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMongoDBService.findOne
        .mockResolvedValueOnce(visitor)
        .mockResolvedValueOnce(workspace);

      const service = await getService();
      await service.getVisitor('visitor-1');
      await service.getWorkspace('ws-1');

      // 清除所有缓存
      service.clearAllCache();

      // 再次获取应查库
      mockMongoDBService.findOne
        .mockResolvedValueOnce(visitor)
        .mockResolvedValueOnce(workspace);
      await service.getVisitor('visitor-1');
      await service.getWorkspace('ws-1');

      expect(mockMongoDBService.findOne).toHaveBeenCalledTimes(4);
    });
  });

  describe('MongoDB 不可用时的降级', () => {
    it('MongoDB 未连接时初始化应跳过加载', async () => {
      mockMongoDBService.isConnected.mockReturnValue(false);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const service = await getService();
      await service.registerVisitor('visitor-1', '测试');

      // 不应调用 find 加载数据
      expect(mockMongoDBService.find).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('MongoDB 查询访客失败时应返回 null', async () => {
      mockMongoDBService.findOne.mockRejectedValueOnce(new Error('数据库错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const visitor = await service.getVisitor('visitor-1');

      expect(visitor).toBeNull();
      errorSpy.mockRestore();
    });

    it('持久化访客数据失败时不应抛出异常', async () => {
      mockMongoDBService.findOne.mockRejectedValueOnce(new Error('数据库错误'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      // 注册新访客，但持久化失败
      const visitor = await service.registerVisitor(undefined, '测试');

      expect(visitor).toBeDefined();
      expect(visitor.nickname).toBe('测试');
      errorSpy.mockRestore();
    });
  });

  describe('joinByInviteCode - 通过邀请码加入工作区', () => {
    it('邀请码无效时应返回失败', async () => {
      // find 默认返回空数组，模拟未找到匹配邀请码的工作区
      const service = await getService();
      const result = await service.joinByInviteCode('INVALID', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('邀请码无效');
    });

    it('数据库查询异常时应返回失败', async () => {
      // 让 find 在被调用时抛出异常（仅 workspaces 集合）
      mockMongoDBService.find.mockImplementation((collection: string) => {
        if (collection === 'workspaces') {
          return Promise.reject(new Error('数据库错误'));
        }
        return Promise.resolve([]);
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const service = await getService();
      const result = await service.joinByInviteCode('ABCDEF', 'visitor-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('邀请码无效');
      errorSpy.mockRestore();
    });
  });
});
