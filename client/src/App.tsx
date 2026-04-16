import { useEffect, useRef, useState } from 'react';
import MainLayout from './components/Layout/MainLayout';
import CanvasPage from './components/Canvas/CanvasPage';
import WelcomePage from './components/Workspace/WelcomePage';
import { useVisitorWorkspaceStore } from './stores/visitorWorkspaceStore';
import { useAppStore } from './stores/appStore';
import { nodeApi, conversationApi } from './services/api';
import './index.css';

/**
 * 应用主组件
 * 负责初始化访客身份和工作区，并根据状态显示欢迎页或主界面
 */
function App() {
  const { visitor, currentWorkspace, isInitialized, initialize } = useVisitorWorkspaceStore();
  const { clearAllData, loadNodesFromApi, loadConversationsFromApi } = useAppStore();
  const lastWorkspaceIdRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  /**
   * 工作区切换或初始化时，从API加载工作区数据
   * 使用 ref 跟踪加载状态，避免循环依赖
   */
  useEffect(() => {
    if (!currentWorkspace || !isInitialized) return;

    if (isLoadingRef.current) return;
    if (lastWorkspaceIdRef.current === currentWorkspace.id) return;

    lastWorkspaceIdRef.current = currentWorkspace.id;
    isLoadingRef.current = true;
    setShowLoading(true);

    const loadWorkspaceData = async () => {
      try {
        clearAllData();

        const result = await nodeApi.getAll() as unknown as {
          success: boolean;
          data: { nodes: unknown[]; relations: unknown[] };
        };

        if (result.success && result.data) {
          loadNodesFromApi(result.data);
        }

        const convResult = await conversationApi.list() as unknown as {
          success: boolean;
          data: unknown[];
        };

        if (convResult.success && convResult.data) {
          loadConversationsFromApi(convResult.data);
        }
      } catch (error) {
        console.error('加载工作区数据失败:', error);
      } finally {
        isLoadingRef.current = false;
        setShowLoading(false);
      }
    };

    loadWorkspaceData();
  }, [currentWorkspace, isInitialized, clearAllData, loadNodesFromApi, loadConversationsFromApi]);

  if (!isInitialized) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-950">
        <div className="text-dark-400 text-lg">加载中...</div>
      </div>
    );
  }

  if (!visitor || !currentWorkspace) {
    return <WelcomePage />;
  }

  return (
    <MainLayout>
      {showLoading ? (
        <div className="h-full w-full flex items-center justify-center bg-dark-950">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-dark-400 text-sm">正在加载工作区...</span>
          </div>
        </div>
      ) : (
        <CanvasPage />
      )}
    </MainLayout>
  );
}

export default App;
