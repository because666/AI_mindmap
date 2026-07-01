import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, FolderOpen, Search, MessageSquare, Network, X, Clock, Undo2, Redo2, Globe, Lock, LogOut, Users, Plus, Menu, RefreshCw, Bell, AlertTriangle, MessageCircle, Languages, Map } from 'lucide-react';
import SettingsModal from '../Settings/SettingsModal';
import ChatPanel from '../Chat/ChatPanel';
import SearchPanel from '../Search/SearchPanel';
import HistoryPanel from '../History/HistoryPanel';
import WorkspaceSettingsModal from '../Workspace/WorkspaceSettingsModal';
import FilePanel from '../File/FilePanel';
import MapLibrary from '../Workspace/MapLibrary';
import { UnreadBadge, MessageCenter } from '../MessageCenter';
import FeedbackModal from '../Feedback/FeedbackModal';
import { useAppStore } from '../../stores/appStore';
import { useUISettingsStore } from '../../stores/uiSettingsStore';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';
import useIsMobile from '../../hooks/useIsMobile';
import useBackButton from '../../hooks/useBackButton';

/**
 * 全局状态提示接口
 */
interface GlobalAlert {
  type: 'banned' | 'workspace-closed' | 'ip-banned';
  message: string;
}

/**
 * 备案信息组件属性
 */
interface BeianFooterProps {
  /** 是否使用紧凑模式（用于移动端侧边栏） */
  compact?: boolean;
  /** 额外的样式类名 */
  className?: string;
}

/**
 * 备案信息组件
 * 展示 ICP 备案号和公安备案号
 */
const BeianFooter: React.FC<BeianFooterProps> = ({ compact = false, className = '' }) => (
  <div
    className={`flex items-center justify-center gap-2 rounded-lg bg-dark-900/60 backdrop-blur-sm border border-dark-700/40 ${
      compact ? 'px-2 py-1.5 flex-col' : 'px-2.5 py-1'
    } ${className}`}
  >
    <a
      href="https://beian.miit.gov.cn"
      target="_blank"
      rel="noopener noreferrer"
      className="text-dark-500 hover:text-dark-300 transition-colors"
      style={{ fontSize: compact ? '10px' : '11px' }}
    >
      桂ICP备2026005821号
    </a>
    {!compact && <span className="text-dark-700" style={{ fontSize: '11px' }}>|</span>}
    <a
      href="http://www.beian.gov.cn/portal/registerSystemInfo?recordcode=45090202000535"
      target="_blank"
      rel="noopener noreferrer"
      className="text-dark-500 hover:text-dark-300 transition-colors inline-flex items-center gap-1"
      style={{ fontSize: compact ? '10px' : '11px' }}
    >
      <img src="https://www.beian.gov.cn/img/ghs.png" alt="公安备案" style={{ width: compact ? '10px' : '12px', height: compact ? '10px' : '12px' }} />
      桂公网安备45090202000535号
    </a>
  </div>
);

/**
 * 主布局组件
 * 支持桌面端和移动端响应式布局
 */
const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation('nav');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'api' | 'ui' | 'guide' | undefined>(undefined);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isWorkspaceSettingsOpen, setIsWorkspaceSettingsOpen] = useState(false);
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(false);
  const [isMapLibraryOpen, setIsMapLibraryOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'canvas' | 'chat'>('canvas');
  const [showWorkspaceInfo, setShowWorkspaceInfo] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMessageCenterOpen, setIsMessageCenterOpen] = useState(false);
  const [mobileDrawerClosing, setMobileDrawerClosing] = useState(false);
  const [globalAlert, setGlobalAlert] = useState<GlobalAlert | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const isMobile = useIsMobile();

  const { selectedNodeId, selectNode, undo, redo, canUndo, canRedo, reloadWorkspaceData, requestOpenChatForNode, clearChatRequest } = useAppStore();
  const { autoOpenChatOnLoad, chatPanelWidth } = useUISettingsStore();
  const { visitor, currentWorkspace, workspaces, switchWorkspace, leaveWorkspace, clearCurrentWorkspace } = useVisitorWorkspaceStore();

  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * 处理移动端抽屉关闭动画
   * 先触发滑出动画，250ms后真正关闭抽屉并重置关闭状态
   */
  const handleMobileDrawerClose = useCallback(() => {
    setMobileDrawerClosing(true);
    setTimeout(() => {
      setIsDrawerOpen(false);
      setMobileDrawerClosing(false);
    }, 250);
  }, []);

  // 返回键处理优先级常量：数值越大优先级越高，面板关闭优先于 App 级退出逻辑
  const BACK_PRIORITY_MODAL = 100;
  const BACK_PRIORITY_FULLSCREEN = 110;
  const BACK_PRIORITY_WORKSPACE_INFO = 120;
  const BACK_PRIORITY_DRAWER = 130;

  /**
   * 按层级注册返回键处理器
   * 每个处理器只判断自己负责的状态，遵循“后注册先执行”的栈式语义
   * 整体优先级（从高到低）：抽屉 > 工作区信息 > 全屏页面 > 弹窗
   */

  // 4. 弹窗：设置、反馈、工作区设置
  useBackButton(
    () => {
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        setSettingsInitialTab(undefined);
        return true;
      }
      return false;
    },
    isSettingsOpen,
    BACK_PRIORITY_MODAL
  );

  useBackButton(
    () => {
      if (isFeedbackOpen) {
        setIsFeedbackOpen(false);
        return true;
      }
      return false;
    },
    isFeedbackOpen,
    BACK_PRIORITY_MODAL
  );

  useBackButton(
    () => {
      if (isWorkspaceSettingsOpen) {
        setIsWorkspaceSettingsOpen(false);
        return true;
      }
      return false;
    },
    isWorkspaceSettingsOpen,
    BACK_PRIORITY_MODAL
  );

  // 3. 全屏页面：聊天、历史、消息中心、搜索、文件
  useBackButton(
    () => {
      if (isChatOpen) {
        closeChat();
        return true;
      }
      return false;
    },
    isChatOpen,
    BACK_PRIORITY_FULLSCREEN
  );

  useBackButton(
    () => {
      if (isHistoryOpen) {
        setIsHistoryOpen(false);
        return true;
      }
      return false;
    },
    isHistoryOpen,
    BACK_PRIORITY_FULLSCREEN
  );

  useBackButton(
    () => {
      if (isMessageCenterOpen) {
        setIsMessageCenterOpen(false);
        return true;
      }
      return false;
    },
    isMessageCenterOpen,
    BACK_PRIORITY_FULLSCREEN
  );

  useBackButton(
    () => {
      if (isSearchOpen) {
        setIsSearchOpen(false);
        return true;
      }
      return false;
    },
    isSearchOpen,
    BACK_PRIORITY_FULLSCREEN
  );

  useBackButton(
    () => {
      if (isFilePanelOpen) {
        setIsFilePanelOpen(false);
        return true;
      }
      return false;
    },
    isFilePanelOpen,
    BACK_PRIORITY_FULLSCREEN
  );

  useBackButton(
    () => {
      if (isMapLibraryOpen) {
        setIsMapLibraryOpen(false);
        return true;
      }
      return false;
    },
    isMapLibraryOpen,
    BACK_PRIORITY_FULLSCREEN
  );

  // 2. 工作区信息浮层
  useBackButton(
    () => {
      if (showWorkspaceInfo) {
        setShowWorkspaceInfo(false);
        return true;
      }
      return false;
    },
    showWorkspaceInfo,
    BACK_PRIORITY_WORKSPACE_INFO
  );

  // 1. 侧边栏抽屉
  useBackButton(
    () => {
      if (isDrawerOpen) {
        handleMobileDrawerClose();
        return true;
      }
      return false;
    },
    isDrawerOpen,
    BACK_PRIORITY_DRAWER
  );

  /**
   * 处理用户被封禁事件
   * 清除本地身份信息并显示封禁提示
   */
  const handleBanned = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as { error: string; code: string };
    setGlobalAlert({
      type: 'banned',
      message: detail.error || t('accountBanned'),
    });
  }, [t]);

  /**
   * 处理工作区被关闭事件
   * 清除当前工作区信息并显示关闭提示
   */
  const handleWorkspaceClosed = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as { error: string; code: string };
    setGlobalAlert({
      type: 'workspace-closed',
      message: detail.error || t('workspaceClosedDesc'),
    });
  }, [t]);

  const handleIpBanned = useCallback((event: Event) => {
    const detail = (event as CustomEvent).detail as { error: string; code: string };
    setGlobalAlert({
      type: 'ip-banned',
      message: detail.error || t('ipBanned'),
    });
  }, [t]);

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
    const handleOpenAPIConfig = () => {
      setSettingsInitialTab('api');
      setIsSettingsOpen(true);
    };
    window.addEventListener('settings:open-api', handleOpenAPIConfig);
    return () => {
      window.removeEventListener('settings:open-api', handleOpenAPIConfig);
    };
  }, []);

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
    handleMobileDrawerClose();
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
            onClick={handleMobileDrawerClose}
            className="p-2 text-dark-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        <div className="px-3 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">{t('navigation')}</span>
        </div>

        <button
          onClick={() => { setActiveTab('canvas'); closeChat(); handleMobileDrawerClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            activeTab === 'canvas' && !isChatOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Network className="w-5 h-5" />
          <span>{t('mindCanvas')}</span>
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
          <span>{t('aiChat')}</span>
        </button>

        <button
          onClick={() => { setIsMapLibraryOpen(true); handleMobileDrawerClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            isMapLibraryOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Map className="w-5 h-5" />
          <span>{t('mapLibrary')}</span>
        </button>

        <div className="px-3 mt-4 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">{t('operations')}</span>
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
          <span>{t('undo')}</span>
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
          <span>{t('redo')}</span>
        </button>

        <div className="px-3 mt-4 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">{t('tools')}</span>
        </div>

        <button
          onClick={() => { setIsSearchOpen(true); handleMobileDrawerClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <Search className="w-5 h-5" />
          <span>{t('search')}</span>
        </button>

        <button
          onClick={() => { setIsMessageCenterOpen(true); handleMobileDrawerClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            isMessageCenterOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Bell className="w-5 h-5" />
          <span>{t('messages')}</span>
        </button>

        <button
          onClick={() => { setIsHistoryOpen(!isHistoryOpen); handleMobileDrawerClose(); }}
          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
            isHistoryOpen
              ? 'bg-primary-600/20 text-primary-400 border-r-2 border-primary-500'
              : 'text-dark-300 hover:text-white hover:bg-dark-800'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span>{t('history')}</span>
        </button>

        <button
          onClick={() => { setIsFilePanelOpen(true); handleMobileDrawerClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <FolderOpen className="w-5 h-5" />
          <span>{t('file')}</span>
        </button>

        <div className="px-3 mt-4 mb-2">
          <span className="text-xs text-dark-500 uppercase tracking-wider">{t('settings')}</span>
        </div>

        <button
          onClick={() => { setIsFeedbackOpen(true); handleMobileDrawerClose(); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{t('feedback')}</span>
        </button>

        <button
          onClick={() => {
            const newLng = i18n.language?.startsWith('zh') ? 'en' : 'zh';
            i18n.changeLanguage(newLng);
            handleMobileDrawerClose();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <Languages className="w-5 h-5" />
          <span>{i18n.language?.startsWith('zh') ? 'English' : '中文'}</span>
        </button>

        <button
          onClick={() => { setIsSettingsOpen(true); setIsDrawerOpen(false); }}
          className="w-full flex items-center gap-3 px-4 py-3 text-left text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        >
          <Settings className="w-5 h-5" />
          <span>{t('settings')}</span>
        </button>
      </div>

      {currentWorkspace && (
        <div className="p-3 border-t border-dark-700">
          <button
            onClick={() => { setShowWorkspaceInfo(!showWorkspaceInfo); }}
            className="w-full flex items-center gap-2 p-2 bg-dark-800 rounded-xl text-left hover:bg-dark-700 transition-colors"
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

      {/* 移动端侧边栏底部备案信息 */}
      {isMobile && (
        <div className="p-3 border-t border-dark-700/50">
          <BeianFooter compact className="w-full" />
        </div>
      )}
    </>
  );

  /**
   * 渲染工作区信息面板
   */
  const renderWorkspacePanel = () => (
    showWorkspaceInfo && (
      <div className={`${isMobile ? 'fixed inset-0 z-50' : 'absolute left-16 top-3 bottom-3 w-64 z-40'} flex flex-col`}>
        {isMobile && (
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowWorkspaceInfo(false)}
          />
        )}
        <div className={`relative ${isMobile ? 'w-72 h-full' : 'h-full'} bg-dark-900/80 backdrop-blur-md rounded-2xl border border-dark-600/30 shadow-2xl flex flex-col overflow-hidden`}>
          <div className="flex items-center justify-between p-4 border-b border-dark-600/30">
            <h3 className="text-white font-medium text-sm">{t('workspace')}</h3>
            <button
              onClick={() => setShowWorkspaceInfo(false)}
              className="p-1 text-dark-400 hover:text-white rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {currentWorkspace && (
            <div className="p-4">
              <div className="p-3 bg-dark-800/80 rounded-2xl border border-primary-500/20">
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
                  <span>{t('memberCount', { count: currentWorkspace.members.length })}</span>
                </div>
                {currentWorkspace.inviteCode && (
                  <div className="mt-2 text-xs text-dark-400">
                    {t('inviteCodeLabel')}: <span className="text-primary-400 font-mono">{currentWorkspace.inviteCode}</span>
                  </div>
                )}
                <button
                  onClick={() => { setIsWorkspaceSettingsOpen(true); setShowWorkspaceInfo(false); }}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-primary-400 hover:text-primary-300 rounded-xl hover:bg-dark-700 transition-colors text-xs border border-primary-500/20"
                >
                  <Settings className="w-3 h-3" />
                  {t('workspaceSettings')}
                </button>
              </div>
            </div>
          )}

          {visitor && (
            <div className="px-4 text-xs text-dark-400">
              {t('currentIdentity')}: <span className="text-dark-300">{visitor.nickname}</span>
            </div>
          )}

          <div className="px-4 py-2 text-xs text-dark-400">{t('switchWorkspace')}</div>
          <div className="flex-1 overflow-y-auto px-2">
            {workspaces.length > 1 ? (
              workspaces.filter(ws => ws.id !== currentWorkspace?.id).map(ws => (
                <button
                  key={ws.id}
                  onClick={() => { switchWorkspace(ws.id); setShowWorkspaceInfo(false); }}
                  className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-dark-400 hover:text-white hover:bg-dark-700/60 transition-colors"
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
                {t('noOtherWorkspaces')}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-dark-600/30">
            <button
              onClick={() => { setShowWorkspaceInfo(false); clearCurrentWorkspace(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-primary-400 hover:text-primary-300 rounded-xl hover:bg-dark-800 transition-colors text-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('createOrJoinWorkspace')}
            </button>
          </div>

          <div className="p-2 border-t border-dark-600/30">
            <button
              onClick={handleLeaveWorkspace}
              className="w-full flex items-center gap-2 px-3 py-2 text-dark-400 hover:text-red-400 rounded-xl hover:bg-dark-800 transition-colors text-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('leaveWorkspace')}
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
    <header className="h-14 bg-dark-900/60 backdrop-blur-sm border-b border-dark-700/50 flex items-center justify-between px-4 md:hidden">
      <button
        onClick={() => setIsDrawerOpen(true)}
        className="p-2 text-dark-400 hover:text-white rounded-xl transition-colors"
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
          className={`p-2 rounded-xl transition-colors ${isSyncing ? 'text-primary-400' : 'text-dark-400 hover:text-white'}`}
          title={t('syncData')}
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
        </button>
        <UnreadBadge onClick={() => setIsMessageCenterOpen(true)} externalUnreadCount={unreadCount} />
        <button
          onClick={openChat}
          className="p-2 text-dark-400 hover:text-white rounded-xl transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 text-dark-400 hover:text-white rounded-xl transition-colors"
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
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm ${
            mobileDrawerClosing ? 'animate-fade-out' : 'animate-fade'
          }`}
          onClick={handleMobileDrawerClose}
        />
        <div className={`absolute left-0 top-0 bottom-0 w-72 bg-dark-900 border-r border-dark-700 flex flex-col ${
          mobileDrawerClosing ? 'animate-slide-out-left' : 'animate-slide-in-left'
        }`}>
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

        <div className="relative group">
          <button
            onClick={() => setShowWorkspaceInfo(!showWorkspaceInfo)}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors bg-dark-800 border border-dark-600 hover:border-primary-500"
            title={currentWorkspace?.name || t('workspace')}
          >
            {currentWorkspace?.type === 'public' ? (
              <Globe className="w-4 h-4 text-primary-400" />
            ) : (
              <Lock className="w-4 h-4 text-primary-400" />
            )}
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('workspace')}
          </span>
        </div>

        <div className="w-6 h-px bg-dark-700 my-2" />

        <div className="relative group">
          <button
            onClick={handleSyncData}
            disabled={isSyncing}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isSyncing
                ? 'text-primary-400 bg-primary-600/20'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
            title={t('syncData')}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('sync')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => { setActiveTab('canvas'); closeChat(); }}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === 'canvas' && !isChatOpen
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
            title={t('mindCanvas')}
          >
            <Network className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('canvas')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={openChat}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isChatOpen
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
            title={t('aiChat')}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('chat')}
          </span>
        </div>

        <div className="relative group">
          <UnreadBadge
            onClick={() => setIsMessageCenterOpen(!isMessageCenterOpen)}
            externalUnreadCount={unreadCount}
            size={20}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors relative ${
              isMessageCenterOpen
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
          />
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('messages')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => setIsMapLibraryOpen(!isMapLibraryOpen)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isMapLibraryOpen
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
            title={t('mapLibrary')}
          >
            <Map className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('mapLibrary')}
          </span>
        </div>

        <div className="w-6 h-px bg-dark-700 my-2" />

        <div className="relative group">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              canUndo
                ? 'text-dark-400 hover:text-white hover:bg-dark-700'
                : 'text-dark-600 cursor-not-allowed'
            }`}
            title={t('undo')}
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('undo')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              canRedo
                ? 'text-dark-400 hover:text-white hover:bg-dark-700'
                : 'text-dark-600 cursor-not-allowed'
            }`}
            title={t('redo')}
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('redo')}
          </span>
        </div>

        <div className="flex-1" />

        <div className="relative group">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            title={t('search')}
          >
            <Search className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('search')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isHistoryOpen
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white hover:bg-dark-700'
            }`}
            title={t('history')}
          >
            <Clock className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('history')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => setIsFilePanelOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            title={t('file')}
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('file')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            title={t('feedback')}
          >
            <MessageCircle className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('feedback')}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => {
              const newLng = i18n.language?.startsWith('zh') ? 'en' : 'zh';
              i18n.changeLanguage(newLng);
            }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            title={i18n.language?.startsWith('zh') ? 'Switch to English' : '切换到中文'}
          >
            <Languages className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {i18n.language?.startsWith('zh') ? 'EN' : '中'}
          </span>
        </div>

        <div className="relative group">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-dark-400 hover:text-white hover:bg-dark-700 transition-colors"
            title={t('settings')}
          >
            <Settings className="w-5 h-5" />
          </button>
          <span className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-dark-200 text-xs rounded-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {t('settings')}
          </span>
        </div>
      </aside>
    )
  );

  return (
    <div className="h-screen flex flex-col bg-dark-950/70">
      {renderMobileHeader()}
      {renderMobileDrawer()}

      <div className="flex-1 flex overflow-hidden">
        {renderDesktopSidebar()}
        {renderWorkspacePanel()}

        <main className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {children}
          </div>

          {!isMobile && (
            <div
              className={`shrink-0 border-l border-dark-700/30 flex flex-col bg-dark-950/30 backdrop-blur-sm transition-[width] duration-300 ease-out overflow-hidden h-full ${
                isHistoryOpen ? '' : 'pointer-events-none'
              }`}
              style={{ width: isHistoryOpen ? '320px' : 0 }}
            >
              <HistoryPanel
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
              />
            </div>
          )}

          {!isMobile && (
            <div
              className={`shrink-0 border-l border-dark-700/30 flex flex-col bg-dark-950/30 backdrop-blur-sm transition-[width] duration-300 ease-out overflow-hidden h-full ${
                isMapLibraryOpen ? '' : 'pointer-events-none'
              }`}
              style={{ width: isMapLibraryOpen ? '320px' : 0 }}
            >
              <MapLibrary
                isOpen={isMapLibraryOpen}
                onClose={() => setIsMapLibraryOpen(false)}
              />
            </div>
          )}

          {!isMobile && (
            <div
              className={`shrink-0 border-l border-dark-700/30 flex flex-col bg-dark-950/30 backdrop-blur-sm transition-[width] duration-300 ease-out overflow-hidden ${
                isMessageCenterOpen ? '' : 'pointer-events-none'
              }`}
              style={{ width: isMessageCenterOpen ? '384px' : 0 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary-400" />
                  <span className="text-white font-medium">{t('messageCenter')}</span>
                </div>
                <button
                  onClick={() => setIsMessageCenterOpen(false)}
                  className="p-1.5 text-dark-300 bg-dark-700/80 hover:text-white hover:bg-dark-600 rounded-xl transition-colors border border-dark-600/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <MessageCenter onUnreadCountChange={setUnreadCount} />
              </div>
            </div>
          )}

          {!isMobile && (
            <div
              className={`shrink-0 border-l border-dark-700/30 flex flex-col bg-dark-950/30 backdrop-blur-sm transition-[width] duration-300 ease-out overflow-hidden ${
                isChatOpen ? '' : 'pointer-events-none'
              }`}
              style={{ width: isChatOpen ? chatPanelWidth : 0 }}
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-dark-700/30">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary-400" />
                  <span className="text-white font-medium">{t('aiChat')}</span>
                </div>
                <button
                  onClick={closeChat}
                  className="p-1.5 text-dark-300 bg-dark-700/90 hover:text-white hover:bg-dark-600 rounded-xl transition-colors border border-dark-600/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel nodeId={selectedNodeId} />
              </div>
            </div>
          )}
        </main>
      </div>

      {isMobile && isChatOpen && (
        // 移动端聊天面板全屏浮层：通过 env(safe-area-inset-top) 适配刘海屏/状态栏，确保标题栏不被遮挡
        <div
          className="fixed inset-0 z-50 bg-dark-950 flex flex-col"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-400" />
              <span className="text-white font-medium">{t('aiChat')}</span>
            </div>
            <button
              onClick={closeChat}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-xl transition-colors"
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
              <span className="text-white font-medium">{t('actionHistory')}</span>
            </div>
            <button
              onClick={() => setIsHistoryOpen(false)}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <HistoryPanel isOpen={true} onClose={() => setIsHistoryOpen(false)} />
          </div>
        </div>
      )}

      {isMobile && isMapLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
          <div className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-primary-400" />
              <span className="text-white font-medium">{t('mapLibrary')}</span>
            </div>
            <button
              onClick={() => setIsMapLibraryOpen(false)}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MapLibrary isOpen={true} onClose={() => setIsMapLibraryOpen(false)} />
          </div>
        </div>
      )}

      {isMobile && isMessageCenterOpen && (
        <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
          <div className="h-14 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary-400" />
              <span className="text-white font-medium">{t('messageCenter')}</span>
            </div>
            <button
              onClick={() => setIsMessageCenterOpen(false)}
              className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <MessageCenter onUnreadCountChange={setUnreadCount} />
          </div>
        </div>
      )}

      <SettingsModal
        key={settingsInitialTab || 'default'}
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          setSettingsInitialTab(undefined);
        }}
        initialTab={settingsInitialTab}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
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

      {/* ICP备案号、公安备案号 - 仅桌面端底部显示 */}
      {!isMobile && (
        <footer className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40">
          <BeianFooter />
        </footer>
      )}

      {/* 全局封禁/关闭状态提示弹窗 */}
      {globalAlert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 border border-red-500/50 rounded-3xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {globalAlert.type === 'banned' ? t('accountBanned') : globalAlert.type === 'ip-banned' ? t('ipBanned') : t('workspaceClosed')}
                </h3>
                <p className="text-dark-400 text-sm mt-1">
                  {globalAlert.type === 'banned' ? t('accountBannedDesc') : globalAlert.type === 'ip-banned' ? t('ipBannedDesc') : t('workspaceClosedDesc')}
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
              {t('confirm')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout;
