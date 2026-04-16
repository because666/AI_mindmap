import React, { useState, useEffect } from 'react';
import { Settings, FolderOpen, Search, MessageSquare, Network, X, Clock, Undo2, Redo2, Globe, Lock, LogOut, Users, Plus } from 'lucide-react';
import SettingsModal from '../Settings/SettingsModal';
import ChatPanel from '../Chat/ChatPanel';
import SearchPanel from '../Search/SearchPanel';
import HistoryPanel from '../History/HistoryPanel';
import WorkspaceSettingsModal from '../Workspace/WorkspaceSettingsModal';
import { useAppStore } from '../../stores/appStore';
import { useUISettingsStore } from '../../stores/uiSettingsStore';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';

/**
 * 主布局组件
 */
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'chat'>('canvas');
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);

  const { selectedNodeId, selectNode, undo, redo, history, historyIndex } = useAppStore();
  const { autoOpenChatOnLoad, chatPanelWidth } = useUISettingsStore();
  const { visitor, currentWorkspace, workspaces, switchWorkspace, leaveWorkspace, clearCurrentWorkspace } = useVisitorWorkspaceStore();

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < history.length - 1;

  useEffect(() => {
    if (autoOpenChatOnLoad) {
      const timer = setTimeout(() => {
        setIsChatOpen(true);
        setActiveTab('chat');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoOpenChatOnLoad]);

  const openChat = () => {
    setIsChatOpen(true);
    setActiveTab('chat');
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

  return (
    <div className="h-screen flex bg-dark-950">
      {/* 左侧边栏 */}
      <aside className="w-14 bg-dark-900 border-r border-dark-700 flex flex-col items-center py-4 gap-2">
        {/* Logo */}
        <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center mb-4">
          <Network className="w-6 h-6 text-white" />
        </div>

        {/* 工作区信息 */}
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

        {/* 导航按钮 */}
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

        <div className="w-6 h-px bg-dark-700 my-2" />

        {/* 撤销/重做 */}
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

        {/* 底部按钮 */}
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

      {/* 工作区信息面板 */}
      {showWorkspaceInfo && (
        <div className="w-64 bg-dark-900 border-r border-dark-700 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium text-sm">工作区</h3>
            <button
              onClick={() => setShowWorkspaceInfo(false)}
              className="p-1 text-dark-400 hover:text-white rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {currentWorkspace && (
            <div className="mb-4 p-3 bg-dark-800 rounded-xl border border-primary-500/30">
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
          )}

          {visitor && (
            <div className="mb-4 text-xs text-dark-400">
              当前身份: <span className="text-dark-300">{visitor.nickname}</span>
            </div>
          )}

          <div className="text-xs text-dark-500 mb-2">切换工作区</div>
          <div className="flex-1 overflow-y-auto space-y-1">
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
              <div className="text-xs text-dark-500 py-2">
                暂无其他工作区
              </div>
            )}
          </div>
          
          <div className="mt-2 pt-2 border-t border-dark-700">
            <button
              onClick={() => { setShowWorkspaceInfo(false); clearCurrentWorkspace(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-primary-400 hover:text-primary-300 rounded-lg hover:bg-dark-800 transition-colors text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              创建或加入新工作区
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-dark-700">
            <button
              onClick={handleLeaveWorkspace}
              className="w-full flex items-center gap-2 px-3 py-2 text-dark-400 hover:text-red-400 rounded-lg hover:bg-dark-800 transition-colors text-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              离开工作区
            </button>
          </div>
        </div>
      )}

      {/* 主内容区域 */}
      <main className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* 聊天面板 */}
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

        {/* 历史面板 */}
        <HistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
        />
      </main>

      {/* 设置弹窗 */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 搜索弹窗 */}
      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNodeSelect={handleNodeLocate}
      />

      {/* 工作区设置弹窗 */}
      <WorkspaceSettingsModal
        isOpen={isWorkspaceSettingsOpen}
        onClose={() => setIsWorkspaceSettingsOpen(false)}
      />
    </div>
  );
};

export default MainLayout;
