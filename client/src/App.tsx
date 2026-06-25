import { useEffect, useRef, useState, useCallback } from 'react';
import i18n from 'i18next';
import MainLayout from './components/Layout/MainLayout';
import CanvasPage from './components/Canvas/CanvasPage';
import WelcomePage from './components/Workspace/WelcomePage';
import DreamyUniverseBackground from './components/Background/DreamyUniverseBackground';
import OnboardingGuide from './components/Onboarding/OnboardingGuide';
import Toast from './components/Common/Toast';
import AnnouncementBanner from './components/Common/AnnouncementBanner';
import BroadcastPopup from './components/Common/BroadcastPopup';
import { useVisitorWorkspaceStore } from './stores/visitorWorkspaceStore';
import { useAppStore } from './stores/appStore';
import { nodeApi, conversationApi } from './services/api';
import { pushClientService } from './services/pushService';
import { isOnboardingCompleted } from './utils/onboardingStorage';
import useMobile from './hooks/useMobile';
import useBackButton, { useDoublePressExit } from './hooks/useBackButton';
import './index.css';

/**
 * 应用主组件
 * 负责初始化访客身份和工作区，并根据状态显示欢迎页或主界面
 * 集成移动端原生功能：网络状态检测、断网提示、物理返回键处理、状态栏适配
 */
function App() {
  const { visitor, currentWorkspace, isInitialized, initialize, clearCurrentWorkspace } = useVisitorWorkspaceStore();
  const { clearAllData, loadNodesFromApi, loadConversationsFromApi } = useAppStore();
  const lastWorkspaceIdRef = useRef<string | null>(null);
  const [showLoading, setShowLoading] = useState(false);
  const loadingAbortRef = useRef<AbortController | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isOnline, setStatusBarDark, isNative } = useMobile();
  const [showOfflineBanner, setShowOfflineBanner] = useState(!navigator.onLine);
  // 双次退出处理器优先级高于工作区返回，低于面板关闭处理器
  const showExitHint = useDoublePressExit(true, 20);

  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * 检测是否需要展示新手引导
   * 仅在用户已初始化且未完成引导时自动弹出
   */
  useEffect(() => {
    if (!isInitialized) return;

    const checkOnboarding = () => {
      const completed = isOnboardingCompleted();
      if (!completed) {
        const timer = setTimeout(() => {
          setShowOnboarding(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    };

    checkOnboarding();
  }, [isInitialized]);

  useEffect(() => {
    pushClientService.initialize();
  }, []);

  useEffect(() => {
    setStatusBarDark('#0c0a09');
  }, [setStatusBarDark]);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    if (!isOnline) {
      // 离线5秒后自动隐藏横幅
      hideTimer = setTimeout(() => {
        setShowOfflineBanner(false);
      }, 5000);
    }

    // 将状态更新推迟到微任务执行，避免在 effect body 中直接同步调用 setState
    Promise.resolve().then(() => {
      setShowOfflineBanner(!isOnline);
    });

    return () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
      }
    };
  }, [isOnline]);

  /**
   * 工作区返回处理器
   * 优先级低于双次退出和面板关闭处理器，仅在没有面板打开且不在欢迎页时生效
   * 当“再按一次退出”提示已经显示时，不再消费事件，以便第二次返回键触发默认退出
   */
  useBackButton(
    async () => {
      if (!currentWorkspace || !isInitialized) {
        return false;
      }

      // 如果正在显示退出提示，让出事件给系统默认退出行为
      if (showExitHint) {
        return false;
      }

      clearCurrentWorkspace();
      lastWorkspaceIdRef.current = null;
      if (loadingAbortRef.current) {
        loadingAbortRef.current.abort();
        loadingAbortRef.current = null;
      }
      setShowLoading(false);
      return true;
    },
    !!currentWorkspace && isInitialized,
    10
  );

  /**
   * 加载工作区数据的核心函数
   * 使用 AbortController 实现可取消的加载，解决工作区切换时的竞态条件
   * @param _workspaceId - 工作区ID（用于日志记录和调试）
   * @param signal - AbortSignal 用于取消请求
   */
  const loadWorkspaceData = useCallback(async (_workspaceId: string, signal: AbortSignal) => {
    try {
      clearAllData();

      const result = await nodeApi.getAll() as unknown as {
        success: boolean;
        data: { nodes: unknown[]; relations: unknown[] };
      };

      if (signal.aborted) return;

      if (result.success && result.data) {
        loadNodesFromApi(result.data);
      }

      const convResult = await conversationApi.list() as unknown as {
        success: boolean;
        data: unknown[];
      };

      if (signal.aborted) return;

      if (convResult.success && convResult.data) {
        loadConversationsFromApi(convResult.data);
      }
    } catch (error) {
      if (signal.aborted) return;
      console.error('加载工作区数据失败:', error);
    }
  }, [clearAllData, loadNodesFromApi, loadConversationsFromApi]);

  /**
   * 工作区切换或初始化时，从API加载工作区数据
   * 使用 AbortController 取消前一次未完成的加载，避免竞态条件
   * 将加载状态变更封装在 async 函数中，避免在 effect body 中直接同步调用 setState
   */
  useEffect(() => {
    if (!currentWorkspace || !isInitialized) return;

    if (lastWorkspaceIdRef.current === currentWorkspace.id) return;

    if (loadingAbortRef.current) {
      loadingAbortRef.current.abort();
    }

    const abortController = new AbortController();
    loadingAbortRef.current = abortController;
    lastWorkspaceIdRef.current = currentWorkspace.id;

    /**
     * 执行工作区数据加载并同步加载状态
     */
    const runLoad = async () => {
      setShowLoading(true);
      try {
        await loadWorkspaceData(currentWorkspace.id, abortController.signal);
      } finally {
        if (!abortController.signal.aborted) {
          setShowLoading(false);
          loadingAbortRef.current = null;
        }
      }
    };

    runLoad();
  }, [currentWorkspace, isInitialized, loadWorkspaceData]);

  /**
   * 移动端：App 恢复前台时自动同步数据
   * 监听 document 的 visibilitychange 事件
   */
  useEffect(() => {
    if (!isNative) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && currentWorkspace && isInitialized) {
        useAppStore.getState().reloadWorkspaceData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isNative, currentWorkspace, isInitialized]);

  /**
   * 网络恢复时自动同步数据
   * 仅在当前无节点数据时触发同步，避免不必要的请求
   */
  useEffect(() => {
    if (!isOnline || !currentWorkspace || !isInitialized) return;

    const hasData = useAppStore.getState().nodes.size > 0;
    if (!hasData) {
      useAppStore.getState().reloadWorkspaceData();
    }
  }, [isOnline, currentWorkspace, isInitialized]);

  const offlineBanner = showOfflineBanner ? (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600 text-white text-center py-2 px-4 text-sm animate-pulse">
      📡 {i18n.t('networkDisconnected', { ns: 'common' })}
    </div>
  ) : null;

  const exitHintBanner = showExitHint ? (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-dark-800/90 backdrop-blur-sm text-white px-6 py-3 rounded-full text-sm shadow-lg border border-dark-700 animate-fade-in">
      {i18n.t('pressAgainToExit', { ns: 'common' })}
    </div>
  ) : null;

  if (!isInitialized) {
    return (
      <>
        <AnnouncementBanner />
        <BroadcastPopup />
        {offlineBanner}
        {exitHintBanner}
        <DreamyUniverseBackground />
        <div className="h-screen flex items-center justify-center">
          <div className="text-dark-400 text-lg">{i18n.t('loading', { ns: 'common' })}</div>
        </div>
        <OnboardingGuide
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          isForced={true}
        />
        <Toast />
      </>
    );
  }

  if (!visitor || !currentWorkspace) {
    return (
      <>
        <AnnouncementBanner />
        <BroadcastPopup />
        {offlineBanner}
        {exitHintBanner}
        <DreamyUniverseBackground />
        <WelcomePage />
        <OnboardingGuide
          isOpen={showOnboarding}
          onClose={() => setShowOnboarding(false)}
          isForced={true}
        />
        <Toast />
      </>
    );
  }

  return (
    <>
      <AnnouncementBanner />
      <BroadcastPopup />
      {offlineBanner}
      {exitHintBanner}
      <DreamyUniverseBackground />
      <MainLayout>
        {showLoading ? (
          <div className="h-full w-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-dark-400 text-sm">{i18n.t('loadingWorkspace', { ns: 'common' })}</span>
            </div>
          </div>
        ) : (
          <CanvasPage />
        )}
      </MainLayout>

      {/* 新手引导 */}
      <OnboardingGuide
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        isForced={true}
      />
      <Toast />
    </>
  );
}

export default App;
