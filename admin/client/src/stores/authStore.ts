import { create } from 'zustand';
import { authApi } from '../services/api';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  ipAddress: string;
  nickname: string;
  isIpAllowed: boolean;
  isFirstVisit: boolean;
  hasPassword: boolean;
  needNickname: boolean;

  checkIp: () => Promise<void>;
  init: (password: string, confirmPassword: string) => Promise<boolean>;
  login: (password: string) => Promise<boolean>;
  setNickname: (nickname: string) => Promise<boolean>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  isLoading: true,
  ipAddress: '',
  nickname: '',
  isIpAllowed: false,
  isFirstVisit: false,
  hasPassword: false,
  needNickname: false,

  checkIp: async () => {
    try {
      const res = await authApi.checkIp();
      const d = res.data.data;
      if (d) {
        set({
          isIpAllowed: d.allowed,
          isFirstVisit: d.isFirstVisit,
          hasPassword: d.hasPassword ?? false,
          nickname: d.nickname || '',
          needNickname: false,
          isLoading: false,
        });
      }
    } catch {
      set({ isLoading: false, isIpAllowed: false, isFirstVisit: true });
    }
  },

  init: async (password, confirmPassword) => {
    try {
      const res = await authApi.init(password, confirmPassword);
      if (res.data.success) {
        set({ isIpAllowed: true, hasPassword: true, isFirstVisit: false });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  login: async (password) => {
    try {
      const res = await authApi.login(password);
      if (res.data.success) {
        const d = res.data.data;
        set({
          isAuthenticated: true,
          needNickname: d?.needNickname ?? false,
          nickname: d?.nickname || '',
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  setNickname: async (nickname) => {
    try {
      const res = await authApi.setNickname(nickname);
      if (res.data.success) {
        set({ needNickname: false, nickname, isAuthenticated: true });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ isAuthenticated: false, nickname: '' });
    }
  },

  fetchMe: async () => {
    try {
      const res = await authApi.me();
      const d = res.data.data;
      if (d) {
        set({
          isAuthenticated: true,
          ipAddress: d.ipAddress,
          nickname: d.nickname,
          isLoading: false,
        });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
