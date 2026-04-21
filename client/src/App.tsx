import { useEffect, useRef, useState, useCallback } from 'react';
import MainLayout from './components/Layout/MainLayout';
import CanvasPage from './components/Canvas/CanvasPage';
import WelcomePage from './components/Workspace/WelcomePage';
import DreamyUniverseBackground from './components/Background/DreamyUniverseBackground';
import OnboardingGuide from './components/Onboarding/OnboardingGuide';
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
  const showExitHint = useDoublePressExit();

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
    setStatusBarDark('#0a0a12');
  }, [setStatusBarDark]);

  useEffect(() => {
    setShowOfflineBanner(!isOnline);
    if (!isOnline) {
      const timer = setTimeout(() => setShowOfflineBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  useBackButton(async () => {
    if (currentWorkspace && isInitialized) {
      clearCurrentWorkspace();
      lastWorkspaceIdRef.current = null;
      if (loadingAbortRef.current) {
        loadingAbortRef.current.abort();
        loadingAbortRef.current = null;
      }
      setShowLoading(false);
      return true;
    }
    return false;
  }, !!currentWorkspace && isInitialized);

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
    setShowLoading(true);

    loadWorkspaceData(currentWorkspace.id, abortController.signal).finally(() => {
      if (!abortController.signal.aborted) {
        setShowLoading(false);
        loadingAbortRef.current = null;
      }
    });
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
      📡 网络连接已断开，请检查网络设置
    </div>
  ) : null;

  const exitHintBanner = showExitHint ? (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] bg-dark-800/90 backdrop-blur-sm text-white px-6 py-3 rounded-full text-sm shadow-lg border border-dark-700 animate-fade-in">
      再按一次退出应用
    </div>
  ) : null;

  const statusBarGradient = (
    <div
      className="fixed top-0 left-0 right-0 h-20 z-[1] pointer-events-none"
      style={{
        background: 'linear-gradient(to bottom, #0a0a12 0%, #0a0a12 40%, #0f0f1a 100%)',
      }}
    />
  );

  if (!isInitialized) {
    return (
      <>
        {offlineBanner}
        {exitHintBanner}
        <DreamyUniverseBackground />
        {statusBarGradient}
        <div className="h-screen flex items-center justify-center relative z-10">
          <div className="text-dark-400 text-lg">加载中...</div>
        </div>
      </>
    );
  }

  if (!visitor || !currentWorkspace) {
    return (
      <>
        {offlineBanner}
        {exitHintBanner}
        <DreamyUniverseBackground />
        {statusBarGradient}
        <div className="relative z-10">
          <WelcomePage />
        </div>
      </>
    );
  }

  return (
    <>
      {offlineBanner}
      {exitHintBanner}
      <DreamyUniverseBackground />
      {statusBarGradient}
      <div className="relative z-10">
        <MainLayout>
          {showLoading ? (
            <div className="h-full w-full flex items-center justify-center bg-dark-950/80">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-dark-400 text-sm">正在加载工作区...</span>
              </div>
            </div>
          ) : (
            <CanvasPage />
          )}
        </MainLayout>
      </div>

      {/* 新手引导 */}
      <OnboardingGuide
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        isForced={true}
      />
    </>
  );
}

export default App;
