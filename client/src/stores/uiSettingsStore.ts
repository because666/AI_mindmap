import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * UI设置状态接口
 */
interface UISettingsState {
  autoOpenChatOnLoad: boolean;
  chatPanelWidth: number;
  showWelcomeMessage: boolean;
  performanceMode: boolean;
  setAutoOpenChatOnLoad: (value: boolean) => void;
  setChatPanelWidth: (width: number) => void;
  setShowWelcomeMessage: (value: boolean) => void;
  setPerformanceMode: (enabled: boolean) => void;
  resetSettings: () => void;
}

/**
 * 默认UI设置
 */
const DEFAULT_UI_SETTINGS = {
  autoOpenChatOnLoad: true,
  chatPanelWidth: 384,
  showWelcomeMessage: true,
  performanceMode: false
};

/**
 * UI设置状态管理Store
 * 使用zustand的persist中间件实现设置持久化
 */
export const useUISettingsStore = create<UISettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_UI_SETTINGS,

      /**
       * 设置是否在页面加载时自动打开对话窗口
       */
      setAutoOpenChatOnLoad: (value: boolean) => {
        set({ autoOpenChatOnLoad: value });
      },

      /**
       * 设置对话面板宽度
       */
      setChatPanelWidth: (width: number) => {
        set({ chatPanelWidth: width });
      },

      /**
       * 设置是否显示欢迎消息
       */
      setShowWelcomeMessage: (value: boolean) => {
        set({ showWelcomeMessage: value });
      },

      /**
       * 设置是否启用性能模式
       * 启用后将降低视觉效果以提升帧率
       * @param enabled - 是否启用性能模式
       */
      setPerformanceMode: (enabled: boolean) => {
        set({ performanceMode: enabled });
      },

      /**
       * 重置为默认设置
       */
      resetSettings: () => {
        set(DEFAULT_UI_SETTINGS);
      }
    }),
    {
      name: 'ui-settings-storage',
      partialize: (state) => ({
        autoOpenChatOnLoad: state.autoOpenChatOnLoad,
        chatPanelWidth: state.chatPanelWidth,
        showWelcomeMessage: state.showWelcomeMessage,
        performanceMode: state.performanceMode
      })
    }
  )
);

/**
 * 获取当前UI设置
 */
export const getUISettings = () => {
  return useUISettingsStore.getState();
};
