import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { IVisitor, IWorkspace, WorkspaceType } from '../types';
import { visitorApi, workspaceApi } from '../services/api';
import { useAppStore } from './appStore';

/**
 * 访客和工作区状态接口
 */
interface VisitorWorkspaceState {
  visitor: IVisitor | null;
  currentWorkspace: IWorkspace | null;
  workspaces: IWorkspace[];
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  /**
   * 初始化访客身份
   * 从localStorage读取visitorId，如果不存在则注册新访客
   */
  initialize: () => Promise<void>;

  /**
   * 注册访客
   * @param nickname - 昵称
   */
  registerVisitor: (nickname: string) => Promise<void>;

  /**
   * 更新访客昵称
   * @param nickname - 新昵称
   */
  updateNickname: (nickname: string) => Promise<void>;

  /**
   * 创建工作区
   * @param name - 工作区名称
   * @param type - 工作区类型
   * @param description - 工作区描述
   */
  createWorkspace: (name: string, type?: WorkspaceType, description?: string) => Promise<IWorkspace | null>;

  /**
   * 加入工作区
   * @param workspaceId - 工作区ID
   * @param inviteCode - 邀请码
   */
  joinWorkspace: (workspaceId: string, inviteCode?: string) => Promise<boolean>;

  /**
   * 通过邀请码加入工作区
   * @param inviteCode - 邀请码
   */
  joinByInviteCode: (inviteCode: string) => Promise<boolean>;

  /**
   * 切换当前工作区
   * @param workspaceId - 工作区ID
   */
  switchWorkspace: (workspaceId: string) => Promise<void>;

  /**
   * 离开工作区
   * @param workspaceId - 工作区ID
   */
  leaveWorkspace: (workspaceId: string) => Promise<boolean>;

  /**
   * 删除工作区
   * @param workspaceId - 工作区ID
   */
  deleteWorkspace: (workspaceId: string) => Promise<boolean>;

  /**
   * 刷新工作区列表
   */
  refreshWorkspaces: () => Promise<void>;

  /**
   * 刷新邀请码
   * @param workspaceId - 工作区ID
   */
  refreshInviteCode: (workspaceId: string) => Promise<string | null>;

  /**
   * 清除错误
   */
  clearError: () => void;

  /**
   * 清除当前工作区（用于返回欢迎页）
   */
  clearCurrentWorkspace: () => void;

  /**
   * 获取公开工作区列表
   */
  fetchPublicWorkspaces: () => Promise<IWorkspace[]>;

  /**
   * 加入公开工作区
   * @param workspaceId - 工作区ID
   */
  joinPublicWorkspace: (workspaceId: string) => Promise<boolean>;

  /**
   * 移除工作区成员
   * @param workspaceId - 工作区ID
   * @param targetVisitorId - 目标访客ID
   */
  removeMember: (workspaceId: string, targetVisitorId: string) => Promise<boolean>;

  /**
   * 更新工作区信息
   * @param workspaceId - 工作区ID
   * @param updates - 更新内容
   */
  updateWorkspace: (workspaceId: string, updates: Partial<Pick<IWorkspace, 'name' | 'description' | 'type'>>) => Promise<boolean>;
}

/**
 * 访客和工作区状态管理Store
 */
export const useVisitorWorkspaceStore = create<VisitorWorkspaceState>()(
  persist(
    (set, get) => ({
      visitor: null,
      currentWorkspace: null,
      workspaces: [],
      isInitialized: false,
      isLoading: false,
      error: null,

      initialize: async () => {
        if (get().isInitialized) return;
        set({ isLoading: true, error: null });

        try {
          const storedVisitorId = localStorage.getItem('visitorId');

          if (storedVisitorId) {
            try {
              const result = await visitorApi.get(storedVisitorId) as unknown as { success: boolean; data: IVisitor };
              if (result.success && result.data) {
                set({ visitor: result.data, isInitialized: true });
                await get().refreshWorkspaces();

                const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
                if (storedWorkspaceId) {
                  const ws = get().workspaces.find(w => w.id === storedWorkspaceId);
                  if (ws) {
                    set({ currentWorkspace: ws });
                  }
                }
                set({ isLoading: false });
                return;
              }
            } catch {
              localStorage.removeItem('visitorId');
            }
          }

          const result = await visitorApi.register() as unknown as { success: boolean; data: IVisitor };
          if (result.success && result.data) {
            localStorage.setItem('visitorId', result.data.id);
            set({ visitor: result.data, isInitialized: true, isLoading: false });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '初始化访客身份失败';
          set({ error: message, isLoading: false });
        }
      },

      registerVisitor: async (nickname: string) => {
        set({ isLoading: true, error: null });
        try {
          const storedVisitorId = localStorage.getItem('visitorId');
          const result = await visitorApi.register(storedVisitorId || undefined, nickname) as unknown as { success: boolean; data: IVisitor };
          if (result.success && result.data) {
            localStorage.setItem('visitorId', result.data.id);
            set({ visitor: result.data, isLoading: false });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '注册访客失败';
          set({ error: message, isLoading: false });
        }
      },

      updateNickname: async (nickname: string) => {
        const visitor = get().visitor;
        if (!visitor) return;
        set({ isLoading: true, error: null });
        try {
          const result = await visitorApi.register(visitor.id, nickname) as unknown as { success: boolean; data: IVisitor };
          if (result.success && result.data) {
            set({ visitor: result.data, isLoading: false });
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '更新昵称失败';
          set({ error: message, isLoading: false });
        }
      },

      createWorkspace: async (name, type = 'public', description) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.create(name, type, description) as unknown as { success: boolean; data: IWorkspace };
          if (result.success && result.data) {
            const newWorkspaces = [...get().workspaces, result.data];
            localStorage.setItem('currentWorkspaceId', result.data.id);
            set({
              workspaces: newWorkspaces,
              currentWorkspace: result.data,
              isLoading: false,
            });
            return result.data;
          }
          set({ isLoading: false });
          return null;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '创建工作区失败';
          set({ error: message, isLoading: false });
          return null;
        }
      },

      joinWorkspace: async (workspaceId, inviteCode) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.join(workspaceId, inviteCode) as unknown as { success: boolean; data: IWorkspace; error?: string };
          if (result.success) {
            await get().refreshWorkspaces();
            set({ isLoading: false });
            return true;
          }
          set({ error: result.error || '加入工作区失败', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '加入工作区失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      joinByInviteCode: async (inviteCode) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.joinByCode(inviteCode) as unknown as { success: boolean; data: IWorkspace; error?: string };
          if (result.success) {
            await get().refreshWorkspaces();
            if (result.data) {
              localStorage.setItem('currentWorkspaceId', result.data.id);
              set({ currentWorkspace: result.data });
            }
            set({ isLoading: false });
            return true;
          }
          set({ error: result.error || '邀请码无效', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '加入工作区失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      switchWorkspace: async (workspaceId) => {
        const workspace = get().workspaces.find(w => w.id === workspaceId);
        if (workspace) {
          localStorage.setItem('currentWorkspaceId', workspaceId);
          set({ currentWorkspace: workspace });
        }
      },

      leaveWorkspace: async (workspaceId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.leave(workspaceId) as unknown as { success: boolean; error?: string };
          if (result.success) {
            const newWorkspaces = get().workspaces.filter(w => w.id !== workspaceId);
            const currentWorkspace = get().currentWorkspace;
            if (currentWorkspace?.id === workspaceId) {
              const nextWorkspace = newWorkspaces[0] || null;
              localStorage.setItem('currentWorkspaceId', nextWorkspace?.id || '');
              set({ workspaces: newWorkspaces, currentWorkspace: nextWorkspace, isLoading: false });
            } else {
              set({ workspaces: newWorkspaces, isLoading: false });
            }
            return true;
          }
          set({ error: result.error || '离开工作区失败', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '离开工作区失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      deleteWorkspace: async (workspaceId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.delete(workspaceId) as unknown as { success: boolean; error?: string };
          if (result.success) {
            const newWorkspaces = get().workspaces.filter(w => w.id !== workspaceId);
            const currentWorkspace = get().currentWorkspace;
            if (currentWorkspace?.id === workspaceId) {
              const nextWorkspace = newWorkspaces[0] || null;
              localStorage.setItem('currentWorkspaceId', nextWorkspace?.id || '');
              set({ workspaces: newWorkspaces, currentWorkspace: nextWorkspace, isLoading: false });
            } else {
              set({ workspaces: newWorkspaces, isLoading: false });
            }
            return true;
          }
          set({ error: result.error || '删除工作区失败', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '删除工作区失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      refreshWorkspaces: async () => {
        try {
          const result = await workspaceApi.getMine() as unknown as { success: boolean; data: IWorkspace[] };
          if (result.success && result.data) {
            set({ workspaces: result.data });
          }
        } catch (error: unknown) {
          console.error('刷新工作区列表失败:', error);
        }
      },

      refreshInviteCode: async (workspaceId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.refreshInvite(workspaceId) as unknown as { success: boolean; data: { inviteCode: string }; error?: string };
          if (result.success && result.data) {
            await get().refreshWorkspaces();
            set({ isLoading: false });
            return result.data.inviteCode;
          }
          set({ error: result.error || '刷新邀请码失败', isLoading: false });
          return null;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '刷新邀请码失败';
          set({ error: message, isLoading: false });
          return null;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      clearCurrentWorkspace: () => {
        useAppStore.getState().clearAllData();
        localStorage.removeItem('currentWorkspaceId');
        set({ currentWorkspace: null });
      },

      fetchPublicWorkspaces: async () => {
        try {
          const result = await workspaceApi.getPublic() as unknown as { success: boolean; data: IWorkspace[] };
          if (result.success && result.data) {
            return result.data;
          }
          return [];
        } catch (error: unknown) {
          console.error('获取公开工作区列表失败:', error);
          return [];
        }
      },

      joinPublicWorkspace: async (workspaceId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.join(workspaceId) as unknown as { success: boolean; data: IWorkspace; error?: string };
          if (result.success) {
            await get().refreshWorkspaces();
            if (result.data) {
              localStorage.setItem('currentWorkspaceId', result.data.id);
              set({ currentWorkspace: result.data });
            }
            set({ isLoading: false });
            return true;
          }
          set({ error: result.error || '加入公开工作区失败', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '加入公开工作区失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      removeMember: async (workspaceId, targetVisitorId) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.removeMember(workspaceId, targetVisitorId) as unknown as { success: boolean; error?: string };
          if (result.success) {
            await get().refreshWorkspaces();
            const currentWorkspace = get().currentWorkspace;
            if (currentWorkspace?.id === workspaceId) {
              const updated = get().workspaces.find(w => w.id === workspaceId);
              if (updated) {
                set({ currentWorkspace: updated });
              }
            }
            set({ isLoading: false });
            return true;
          }
          set({ error: result.error || '移除成员失败', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '移除成员失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },

      updateWorkspace: async (workspaceId, updates) => {
        set({ isLoading: true, error: null });
        try {
          const result = await workspaceApi.update(workspaceId, updates) as unknown as { success: boolean; data: IWorkspace; error?: string };
          if (result.success) {
            await get().refreshWorkspaces();
            const currentWorkspace = get().currentWorkspace;
            if (currentWorkspace?.id === workspaceId) {
              const updated = get().workspaces.find(w => w.id === workspaceId);
              if (updated) {
                set({ currentWorkspace: updated });
              }
            }
            set({ isLoading: false });
            return true;
          }
          set({ error: result.error || '更新工作区失败', isLoading: false });
          return false;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : '更新工作区失败';
          set({ error: message, isLoading: false });
          return false;
        }
      },
    }),
    {
      name: 'visitor-workspace-storage',
      partialize: (state) => ({
        visitor: state.visitor,
      }),
    }
  )
);
