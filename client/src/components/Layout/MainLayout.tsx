import React, { useState, useEffect, useCallback } from 'react';
import { Settings, FolderOpen, Search, MessageSquare, Network, X, Clock, Undo2, Redo2, Globe, Lock, LogOut, Users, Plus, Menu, RefreshCw, Bell, AlertTriangle } from 'lucide-react';
import SettingsModal from '../Settings/SettingsModal';
import ChatPanel from '../Chat/ChatPanel';
import SearchPanel from '../Search/SearchPanel';
import HistoryPanel from '../History/HistoryPanel';
import WorkspaceSettingsModal from '../Workspace/WorkspaceSettingsModal';
import FilePanel from '../File/FilePanel';
import { UnreadBadge, MessageCenter } from '../MessageCenter';
import { useAppStore } from '../../stores/appStore';
import { useUISettingsStore } from '../../stores/uiSettingsStore';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';
import useIsMobile from '../../hooks/useIsMobile';

/**
 * 全局状态提示接口
 */
interface GlobalAlert {
  type: 'banned' | 'workspace-closed' | 'ip-banned';
  message: string;
}

/**
 * 主布局组件
 * 支持桌面端和移动端响应式布局
 */
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'chat'>('canvas');
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
  const [globalAlert, setGlobalAlert] = useState<GlobalAlert | null>(null);

  const isMobile = useIsMobile();

  const { selectedNodeId, selectNode, undo, redo, history, historyIndex, reloadWorkspaceData, requestOpenChatForNode, clearChatRequest } = useAppStore();
  const { autoOpenChatOnLoad, chatPanelWidth } = useUISettingsStore();
  const { visitor, currentWorkspace, workspaces, switchWorkspace, leaveWorkspace, clearCurrentWorkspace } = useVisitorWorkspaceStore();

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * 处理用户被封禁事件
   * 清除本地身份信息并显示封禁提示
   */
  const handleBanned = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as { error: string; code: string };
    setGlobalAlert({
      type: 'banned',
      message: detail.error || '账号已被封禁，如有疑问请联系管理员',
    });
  }, []);

  /**
   * 处理工作区被关闭事件
   * 清除当前工作区信息并显示关闭提示
   */
  const handleWorkspaceClosed = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as { error: string; code: string };
    setGlobalAlert({
      type: 'workspace-closed',
      message: detail.error || '该工作区已被管理员关闭',
    });
  }, []);

  const handleIpBanned = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as { error: string; code: string };
    setGlobalAlert({
      type: 'ip-banned',
      message: detail.error || '当前IP已被封禁',
    });
  }, []);

  useEffect(() => {
    window.addEventListener('auth:banned', handleBanned);
    window.addEventListener('auth:workspace-closed', handleWorkspaceClosed);
    window.addEventListener('auth:ip-banned', handleIpBanned);
    return () => {
      window.removeEventListener('auth:banned', handleBanned);
      window.removeEventListener('auth:workspace-closed', handleWorkspaceClosed);
      window.removeEventListener('auth:ip-banned', handleIpBanned);
    };
  }, [handleBanned, handleWorkspaceClosed, handleIpBanned]);

  useEffect(() => {
    if (autoOpenChatOnLoad) {
      const timer = setTimeout(() => {
        setIsChatOpen(true);
        setActiveTab('chat');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoOpenChatOnLoad]);

  /**
   * 监听长按节点打开聊天面板的请求
   * 当检测到requestOpenChatForNode变化时，自动打开聊天面板并选中对应节点
   */
  useEffect(() => {
    if (requestOpenChatForNode) {
      selectNode(requestOpenChatForNode);
      setIsChatOpen(true);
      setActiveTab('chat');
      clearChatRequest();
    }
  }, [requestOpenChatForNode, selectNode, clearChatRequest]);

  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  const openChat = () => {
    setIsChatOpen(true);
    setActiveTab('chat');
    setIsDrawerOpen(false);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  const handleNodeLocate = (nodeId: string) => {
    selectNode(nodeId);
  };

  /**
   * 处理离开工作区
   */
  const handleLeaveWorkspace = async () => {
    if (currentWorkspace) {
      await leaveWorkspace(currentWorkspace.id);
    }
  };

  /**
   * 处理手动同步数据
   * 调用 appStore 的 reloadWorkspaceData 从服务端重新加载当前工作区数据
   */
  const handleSyncData = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await reloadWorkspaceData();
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * 渲染侧边栏内容
   */
  const renderSidebarContent = () => (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Network className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-semibold">DeepMindMap</span>
        </div>
        {isMobile && (
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">导航</span>
        </div>

        <button
          onClick={() => { setActiveTab('canvas'); closeChat(); setIsDrawerOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            activeTab === 'canvas' && !isChatOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Network className="w-5 h-5" />
          <span>思维画布</span>
        </button>

        <button
          onClick={openChat}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            isChatOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span>AI 对话</span>
        </button>

        <div className="px-3 mt-4 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">操作</span>
        </div>

        <button
          onClick={() => { undo(); }}
          disabled={!canUndo}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            canUndo
              ? 'text-dark-300 hover:text-white hover:bg-dark-800'
              : 'text-dark-600 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-5 h-5" />
          <span>撤销</span>
        </button>

        <button
          onClick={() => { redo(); }}
          disabled={!canRedo}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            canRedo
              ? 'text-dark-300 hover:text-white hover:bg-dark-800'
              : 'text-dark-600 cursor-not-allowed'
          }`}
        >
          <Redo2 className="w-5 h-5" />
          <span>重做</span>
        </button>

        <div className="px-3 mt-4 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">工具</span>
        </div>

        <button
          onClick={() => { setIsSearchOpen(true); setIsDrawerOpen(false); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <Search className="w-5 h-5" />
          <span>搜索</span>
        </button>

        <button
          onClick={() => { setIsMessageCenterOpen(true); setIsDrawerOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            isMessageCenterOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Bell className="w-5 h-5" />
          <span>消息</span>
        </button>

        <button
          onClick={() => { setIsHistoryOpen(!isHistoryOpen); setIsDrawerOpen(false); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            isHistoryOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>历史</span>
        </button>

        <button
          onClick={() => { setIsFilePanelOpen(true); setIsDrawerOpen(false); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <FolderOpen className="w-5 h-5" />
          <span>文件</span>
        </button>

        <div className="px-3 mt-4 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">设置</span>
        </div>

        <button
          onClick={() => { setIsSettingsOpen(true); setIsDrawerOpen(false); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>设置</span>
        </button>
      </div>

      {currentWorkspace && (
        <div className="p-3 border-t border-dark-700">
          <button
            onClick={() => { setShowWorkspaceInfo(!showWorkspaceInfo); }}
            className="w-full flex items-center gap-2 p-2 bg-dark-800 rounded-lg text-left hover:bg-dark-700 transition-colors"
          >
            {currentWorkspace.type === 'public' ? (
              <Globe className="w-4 h-4 text-primary-400" />
            ) : (
              <Lock className="w-4 h-4 text-primary-400" />
            )}
            <span className="text-sm text-white truncate flex-1">{currentWorkspace.name}</span>
            <Users className="w-4 h-4 text-dark-400" />
          </button>
        </div>
      )}
    </>
  );

  /**
   * 渲染工作区信息面板
   */
  const renderWorkspacePanel = () => (
    showWorkspaceInfo && (
      <div className={`${isMobile ? 'fixed inset-0 z-50' : 'w-64'} bg-dark-900 border-r border-dark-700 flex flex-col`}>
        {isMobile && (
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWorkspaceInfo(false)}
          />
        )}
        <div className={`relative ${isMobile ? 'w-72 h-full' : ''} bg-dark-900 flex flex-col`}>
          <div className="flex items-center justify-between p-4 border-b border-dark-700">
            <h3 className="text-white font-medium text-sm">工作区</h3>
            <button
              onClick={() => setShowWorkspaceInfo(false)}
              className="p-1 text-dark-400 hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {currentWorkspace && (
            <div className="p-4">
              <div className="p-3 bg-dark-800 rounded-xl border border-primary-500/30">
                <div className="flex items-center gap-2 mb-1">
                  {currentWorkspace.type === 'public' ? (
                    <Globe className="w-3.5 h-3.5 text-primary-400" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-primary-400" />
                  )}
                  <span className="text-white font-medium text-sm">{currentWorkspace.name}</span>
                </div>
                <div className="flex items-center gap-1 text-dark-500 text-xs">
                  <Users className="w-3 h-3" />
                  <span>{currentWorkspace.members.length} 位成员</span>
                </div>
                {currentWorkspace.inviteCode && (
                  <div className="mt-2 text-xs text-dark-400">
                    邀请码: <span className="text-primary-400 font-mono">{currentWorkspace.inviteCode}</span>
                  </div>
                )}
                <button
                  onClick={() => { setIsWorkspaceSettingsOpen(true); setShowWorkspaceInfo(false); }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-primary-400 hover:text-primary-300 rounded-lg hover:bg-dark-700 transition-colors text-xs border border-primary-500/20"
                >
                  <Settings className="w-3 h-3" />
                  工作区设置
                </button>
              </div>
            </div>
          )}

          {visitor && (
            <div className="px-4 text-xs text-dark-400">
              当前身份: <span className="text-dark-300">{visitor.nickname}</span>
            </div>
          )}

          <div className="px-4 py-2 text-xs text-dark-500">切换工作区</div>
          <div className="flex-1 overflow-y-auto px-2">
            {workspaces.length > 1 ? (
              workspaces.filter(ws => ws.id !== currentWorkspace?.id).map(ws => (
                <button
                  key={ws.id}
                  onClick={() => { switchWorkspace(ws.id); setShowWorkspaceInfo(false); }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                >
                  {ws.type === 'public' ? (
                    <Globe className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span className="text-sm truncate">{ws.name}</span>
                </button>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-dark-500">
                暂无其他工作区
              </div>
            )}
          </div>

          <div className="p-2 border-t border-dark-700">
            <button
              onClick={() => { setShowWorkspaceInfo(false); clearCurrentWorkspace(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-primary-400 hover:text-primary-300 rounded-lg hover:bg-dark-800 transition-colors text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              创建或加入新工作区
            </button>
          </div>

          <div className="p-2 border-t border-dark-700">
            <button
              onClick={handleLeaveWorkspace}
              className="w-full flex items-center gap-2 px-3 py-2 text-dark-400 hover:text-red-400 rounded-lg hover:bg-dark-800 transition-colors text-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              离开工作区
            </button>
          </div>
        </div>
      </div>
    )
  );

  /**
   * 移动端顶部栏
   */
  const renderMobileHeader = () => (
    <header className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4 md:hidden">
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
          <Network className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-semibold">DeepMindMap</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={handleSyncData}
          disabled={isSyncing}
          className={`p-2 rounded-lg transition-colors ${isSyncing ? 'text-primary-400' : 'text-dark-400 hover:text-white'}`}
          title="同步数据"
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
        <UnreadBadge onClick={() => setIsMessageCenterOpen(true)} />
        <button
          onClick={openChat}
          className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );

  /**
   * 移动端抽屉
   */
  const renderMobileDrawer = () => (
    isMobile && isDrawerOpen && (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsDrawerOpen(false)}
        />
        <div className="absolute left-0 top-0 bottom-0 w-72 bg-dark-900 border-r border-dark-700 flex flex-col animate-slide-in-left">
          {renderSidebarContent()}
        </div>
      </div>
    )
  );

  /**
   * 桌面端侧边栏
   */
  const renderDesktopSidebar = () => (
    !isMobile && (
      <aside className="w-14 bg-dark-900 border-r border-dark-700 flex flex-col items-center py-4 gap-2">
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center mb-4">
          <Network className="w-6 h-6 text-white" />
        </div>

        <button
          onClick={() => setShowWorkspaceInfo(!showWorkspaceInfo)}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-dark-800 border border-dark-600 hover:border-primary-500"
          title={currentWorkspace?.name || '工作区'}
        >
          {currentWorkspace?.type === 'public' ? (
            <Globe className="w-4 h-4 text-primary-400" />
          ) : (
            <Lock className="w-4 h-4 text-primary-400" />
          )}
        </button>

        <div className="w-6 h-px bg-dark-700 my-2" />

        <button
          onClick={handleSyncData}
          disabled={isSyncing}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isSyncing
              ? 'text-primary-400 bg-primary-600/20'
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title="同步数据"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={() => { setActiveTab('canvas'); closeChat(); }}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            activeTab === 'canvas' && !isChatOpen
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title="思维画布"
        >
          <Network className="w-5 h-5" />
        </button>

        <button
          onClick={openChat}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isChatOpen
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title="对话"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsMessageCenterOpen(!isMessageCenterOpen)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative ${
            isMessageCenterOpen
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title="消息"
        >
          <Bell className="w-5 h-5" />
        </button>

        <div className="w-6 h-px bg-dark-700 my-2" />

        <button
          onClick={undo}
          disabled={!canUndo}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            canUndo
              ? 'text-dark-400 hover:text-white hover:bg-dark-700'
              : 'text-dark-600 cursor-not-allowed'
          }`}
          title="撤销"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            canRedo
              ? 'text-dark-400 hover:text-white hover:bg-dark-700'
              : 'text-dark-600 cursor-not-allowed'
          }`}
          title="重做"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setIsSearchOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          title="搜索"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsHistoryOpen(!isHistoryOpen)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
            isHistoryOpen
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white hover:bg-dark-700'
          }`}
          title="历史"
        >
          <Clock className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsFilePanelOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          title="文件"
        >
          <FolderOpen className="w-5 h-5" />
        </button>

        <button
          onClick={() => setIsSettingsOpen(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
          title="设置"
        >
          <Settings className="w-5 h-5" />
        </button>
      </aside>
    )
  );

  return (
    <div className="h-screen flex flex-col bg-dark-950/90">
      {renderMobileHeader()}
      {renderMobileDrawer()}

      <div className="flex-1 flex overflow-hidden">
        {renderDesktopSidebar()}
        {renderWorkspacePanel()}

        <main className="flex-1 overflow-hidden flex pb-9">
          <div className="flex-1 overflow-hidden">
            {children}
          </div>

          {!isMobile && (
            <div
              className={`border-l border-dark-700 flex flex-col bg-dark-900 transition-all duration-300 ease-in-out ${
                isChatOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none absolute right-0'
              }`}
              style={{ width: isChatOpen ? chatPanelWidth : 0 }}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700 bg-dark-800">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-400" />
                  <span className="text-white font-medium">AI 对话</span>
                </div>
                <button
                  onClick={closeChat}
                  className="p-1 text-dark-400 hover:text-white hover:bg-dark-700 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel nodeId={selectedNodeId} />
              </div>
            </div>
          )}

          {!isMobile && (
            <HistoryPanel
              isOpen={isHistoryOpen}
              onClose={() => setIsHistoryOpen(false)}
            />
          )}

          {!isMobile && isMessageCenterOpen && (
            <div
              className={`border-l border-dark-700 flex flex-col bg-dark-900 transition-all duration-300 ease-in-out h-full ${
                isMessageCenterOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full pointer-events-none'
              }`}
              style={{ width: '384px' }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700 bg-dark-800">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-400" />
                  <span className="text-white font-medium">消息中心</span>
                </div>
                <button
                  onClick={() => setIsMessageCenterOpen(false)}
                  className="p-1.5 text-dark-400 hover:text-white bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <MessageCenter />
              </div>
            </div>
          )}
        </main>
      </div>

      {isMobile && isChatOpen && (
        <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
          <div className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-400" />
              <span className="text-white font-medium">AI 对话</span>
            </div>
            <button
              onClick={closeChat}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChatPanel nodeId={selectedNodeId} />
          </div>
        </div>
      )}

      {isMobile && isHistoryOpen && (
        <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
          <div className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary-400" />
              <span className="text-white font-medium">操作历史</span>
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <HistoryPanel isOpen={true} onClose={() => setIsHistoryOpen(false)} />
          </div>
        </div>
      )}

      {isMobile && isMessageCenterOpen && (
        <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
          <div className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-400" />
              <span className="text-white font-medium">消息中心</span>
            </div>
            <button
              onClick={() => setIsMessageCenterOpen(false)}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MessageCenter />
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNodeSelect={handleNodeLocate}
      />

      <WorkspaceSettingsModal
        isOpen={isWorkspaceSettingsOpen}
        onClose={() => setIsWorkspaceSettingsOpen(false)}
      />

      <FilePanel
        isOpen={isFilePanelOpen}
        onClose={() => setIsFilePanelOpen(false)}
      />

      {/* ICP备案号与联系邮箱 - 悬浮底部一行显示 */}
      <footer className="fixed bottom-0 left-0 right-0 bg-dark-900/90 backdrop-blur-sm border-t border-dark-700 py-1.5 text-center z-40">
        <a
          href="https://beian.miit.gov.cn"
          target="_blank"
          rel="noopener noreferrer"
          className="text-dark-400 hover:text-dark-300 transition-colors"
          style={{ fontSize: '12px', color: '#6b7280' }}
        >
          桂ICP备2026005821号-2
        </a>
        <span className="text-dark-600 mx-2" style={{ fontSize: '12px' }}>|</span>
        <a
          href="mailto:3694224048@qq.com"
          className="text-dark-400 hover:text-dark-300 transition-colors"
          style={{ fontSize: '12px', color: '#6b7280' }}
        >
          联系邮箱：3694224048@qq.com
        </a>
      </footer>

      {/* 全局封禁/关闭状态提示弹窗 */}
      {globalAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-red-500/50 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {globalAlert.type === 'banned' ? '账号已被封禁' : globalAlert.type === 'ip-banned' ? 'IP已被封禁' : '工作区已关闭'}
                </h3>
                <p className="text-dark-400 text-sm mt-1">
                  {globalAlert.type === 'banned' ? '您的账号已被管理员封禁' : globalAlert.type === 'ip-banned' ? '您当前使用的IP地址已被管理员封禁' : '该工作区已被管理员关闭'}
                </p>
              </div>
            </div>
            <p className="text-dark-300 text-sm mb-6 leading-relaxed">
              {globalAlert.message}
            </p>
            <button
              onClick={() => {
                setGlobalAlert(null);
                if (globalAlert.type === 'banned') {
                  window.location.reload();
                } else {
                  clearCurrentWorkspace();
                }
              }}
              className="w-full py-2.5 bg-dark-700 hover:bg-dark-600 text-white rounded-xl transition-colors text-sm font-medium"
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
