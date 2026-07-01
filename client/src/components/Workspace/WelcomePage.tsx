import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Plus, LogIn, Globe, Lock, Copy, Check, Search, Users, Sparkles, Pin } from 'lucide-react';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';
import useMobile from '../../hooks/useMobile';
import type { WorkspaceType, IWorkspace } from '../../types';

const WelcomePage: React.FC = () => {
  const { t } = useTranslation('workspace');
  const {
    visitor,
    currentWorkspace,
    workspaces,
    isLoading,
    error,
    registerVisitor,
    createWorkspace,
    joinByInviteCode,
    switchWorkspace,
    clearError,
    fetchPublicWorkspaces,
    joinPublicWorkspace,
  } = useVisitorWorkspaceStore();
  const { haptic, notifyHaptic } = useMobile();

  const [nickname, setNickname] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceType, setWorkspaceType] = useState<WorkspaceType>('public');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showPublic, setShowPublic] = useState(false);
  const [publicWorkspaces, setPublicWorkspaces] = useState<IWorkspace[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // 推荐工作区（管理员置顶的公开工作区）列表与加载状态
  const [recommendedWorkspaces, setRecommendedWorkspaces] = useState<IWorkspace[]>([]);
  const [recommendedLoading, setRecommendedLoading] = useState(false);
  // 已加入的推荐工作区 ID 集合，用于在加入成功后隐藏对应卡片
  const [joinedRecommendedIds, setJoinedRecommendedIds] = useState<Set<string>>(new Set());

  /**
   * 加载推荐工作区列表
   * 复用 fetchPublicWorkspaces 接口（已按 isPinned 优先排序），仅筛选 isPinned=true 的工作区
   * 已加入的工作区会在服务端通过 excludeVisitorId 过滤，因此前端无需再次排除
   */
  const loadRecommendedWorkspaces = async () => {
    if (!visitor) return;
    setRecommendedLoading(true);
    try {
      const list = await fetchPublicWorkspaces();
      // 仅展示置顶工作区作为推荐
      const pinned = list.filter((ws) => ws.isPinned === true);
      setRecommendedWorkspaces(pinned);
    } catch (err) {
      console.error('加载推荐工作区失败:', err);
      setRecommendedWorkspaces([]);
    } finally {
      setRecommendedLoading(false);
    }
  };

  /**
   * 访客身份就绪后（且尚未选择工作区时）自动加载推荐工作区
   */
  useEffect(() => {
    if (visitor && !currentWorkspace) {
      loadRecommendedWorkspaces();
    }
    // 仅在 visitor/currentWorkspace 变化时触发，避免重复加载
  }, [visitor, currentWorkspace]);

  /**
   * 处理推荐工作区卡片点击
   * 由于项目暂未提供工作区复制接口，此处改为调用加入接口
   * 加入成功后将其标记为已加入，从推荐列表中移除，并切换至该工作区
   * @param workspace - 推荐工作区对象
   */
  const handleJoinRecommended = async (workspace: IWorkspace) => {
    haptic('medium');
    const success = await joinPublicWorkspace(workspace.id);
    if (success) {
      setJoinedRecommendedIds((prev) => {
        const next = new Set(prev);
        next.add(workspace.id);
        return next;
      });
      notifyHaptic('success');
    } else {
      notifyHaptic('error');
    }
  };

  const handleNicknameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    haptic('medium');
    await registerVisitor(nickname.trim());
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    haptic('heavy');
    await createWorkspace(workspaceName.trim(), workspaceType, workspaceDescription.trim() || undefined);
    setShowCreate(false);
    setWorkspaceName('');
    setWorkspaceDescription('');
    notifyHaptic('success');
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    haptic('medium');
    const success = await joinByInviteCode(inviteCode.trim());
    if (success) {
      setShowJoin(false);
      setInviteCode('');
      notifyHaptic('success');
    } else {
      notifyHaptic('error');
    }
  };

  const handleShowPublic = async () => {
    haptic('light');
    setShowPublic(true);
    setShowCreate(false);
    setShowJoin(false);
    setPublicLoading(true);
    const list = await fetchPublicWorkspaces();
    setPublicWorkspaces(list);
    setPublicLoading(false);
  };

  const handleJoinPublic = async (workspaceId: string) => {
    haptic('medium');
    const success = await joinPublicWorkspace(workspaceId);
    if (success) {
      setShowPublic(false);
      notifyHaptic('success');
    }
  };

  const copyInviteCode = async (code: string, workspaceId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(workspaceId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.error('复制失败');
    }
  };

  if (!visitor) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-950/80 relative overflow-hidden">

        <div className="w-full max-w-md p-8 glass rounded-2xl shadow-2xl relative z-10 animate-scale-in">
          <div className="flex items-center justify-center mb-8">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-600/30"
                   style={{ animation: 'float 3s ease-in-out infinite' }}>
                <Network className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary-400 rounded-full animate-pulse" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-1 tracking-tight">{t('deepMindMap')}</h1>
          <p className="text-dark-400 text-center mb-8 text-sm">{t('platformSlogan')}</p>

          <form onSubmit={handleNicknameSubmit}>
            <label className="block text-sm font-medium text-dark-300 mb-2">{t('enterNickname')}</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={t('nicknamePlaceholder')}
              className="input-field"
              maxLength={20}
              autoFocus
            />
            <button
              type="submit"
              disabled={!nickname.trim() || isLoading}
              className="btn-primary w-full mt-4 py-3"
            >
              <Sparkles className="w-4 h-4" />
              {t('getStarted')}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-2xl text-red-400 text-sm flex items-center justify-between animate-in">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300 ml-2">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="h-screen flex items-center justify-center bg-dark-950/80 relative overflow-hidden">

        <div className="w-full max-w-lg p-8 glass rounded-2xl shadow-2xl relative z-10 animate-scale-in">
          <div className="flex items-center gap-3 mb-6 animate-in">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">{t('welcomeUser', { nickname: visitor.nickname })}</h1>
              <p className="text-dark-400 text-sm">{t('selectOrCreateWorkspace')}</p>
            </div>
          </div>

          {workspaces.length > 0 && (
            <div className="mb-6 animate-in-delay-1">
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">{t('myWorkspaces')}</h3>
              <div className="space-y-1.5">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => { haptic('light'); switchWorkspace(ws.id); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-dark-700/50 transition-all duration-200 cursor-pointer group border border-transparent hover:border-dark-600/50"
                  >
                    <div className="w-9 h-9 bg-dark-700/80 rounded-lg flex items-center justify-center group-hover:bg-dark-600 transition-colors">
                      {ws.type === 'public' ? (
                        <Globe className="w-4 h-4 text-primary-400" />
                      ) : (
                        <Lock className="w-4 h-4 text-dark-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate group-hover:text-primary-300 transition-colors">{ws.name}</div>
                      <div className="text-dark-500 text-xs flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {t('memberCount', { count: ws.members.length })}
                      </div>
                    </div>
                    {ws.inviteCode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyInviteCode(ws.inviteCode!, ws.id); }}
                        className="p-1.5 text-dark-500 hover:text-primary-400 rounded-xl hover:bg-dark-600 transition-all"
                        title={t('copyInviteCode')}
                      >
                        {copiedId === ws.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 推荐工作区区域：仅展示管理员置顶（isPinned=true）的工作区 */}
          {recommendedWorkspaces.length > 0 && (
            <div className="mb-6 animate-in-delay-1">
              <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" />
                {t('recommendedWorkspaces')}
              </h3>
              <div className="space-y-1.5">
                {recommendedWorkspaces
                  .filter((ws) => !joinedRecommendedIds.has(ws.id))
                  .map((ws) => (
                    <div
                      key={ws.id}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left bg-primary-600/5 border border-primary-500/20 hover:border-primary-500/40 transition-all duration-200 group"
                    >
                      <div className="w-9 h-9 bg-primary-600/15 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Pin className="w-4 h-4 text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white font-medium text-sm truncate group-hover:text-primary-300 transition-colors">{ws.name}</div>
                        <div className="text-dark-500 text-xs flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {ws.members.length}
                          </span>
                          {ws.description && (
                            <span className="truncate">{ws.description}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinRecommended(ws)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-primary-600/20 text-primary-300 rounded-xl text-xs font-medium hover:bg-primary-600/30 border border-primary-500/30 transition-all disabled:opacity-50 flex-shrink-0"
                        title={t('joinRecommendedTip')}
                      >
                        {t('joinBtn')}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {recommendedLoading && recommendedWorkspaces.length === 0 && (
            <div className="mb-6 animate-in-delay-1">
              <h3 className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" />
                {t('recommendedWorkspaces')}
              </h3>
              <div className="text-center py-3">
                <div className="w-5 h-5 border-2 border-primary-500/30 border-t-primary-400 rounded-full mx-auto" style={{ animation: 'spin-slow 1s linear infinite' }} />
              </div>
            </div>
          )}

          <div className="flex gap-2 animate-in-delay-2">
            <button
              onClick={() => { haptic('light'); setShowCreate(true); setShowJoin(false); setShowPublic(false); }}
              className="btn-primary flex-1"
            >
              <Plus className="w-4 h-4" />
              {t('createBtn')}
            </button>
            <button
              onClick={() => { haptic('light'); setShowJoin(true); setShowCreate(false); setShowPublic(false); }}
              className="btn-ghost flex-1"
            >
              <LogIn className="w-4 h-4" />
              {t('inviteCodeBtn')}
            </button>
            <button
              onClick={handleShowPublic}
              className="btn-ghost flex-1"
            >
              <Search className="w-4 h-4" />
              {t('discoverBtn')}
            </button>
          </div>

          {showCreate && (
            <form onSubmit={handleCreateWorkspace} className="mt-4 p-4 glass-light rounded-2xl animate-in">
              <h3 className="text-white font-medium mb-3 text-sm">{t('createNewWorkspace')}</h3>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder={t('workspaceNamePlaceholder')}
                className="input-field mb-3"
                maxLength={50}
              />
              <textarea
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                placeholder={t('workspaceDescPlaceholder')}
                className="input-field mb-3 resize-none"
                rows={2}
                maxLength={200}
              />
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setWorkspaceType('public')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
                    workspaceType === 'public'
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-500/40'
                      : 'bg-dark-700/50 text-dark-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  {t('public')}
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceType('private')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-all duration-200 ${
                    workspaceType === 'private'
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-500/40'
                      : 'bg-dark-700/50 text-dark-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  {t('private')}
                </button>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={!workspaceName.trim() || isLoading} className="btn-primary flex-1">
                  {t('createBtn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-ghost"
                >
                  {t('cancel', { ns: 'common' })}
                </button>
              </div>
            </form>
          )}

          {showJoin && (
            <form onSubmit={handleJoinByCode} className="mt-4 p-4 glass-light rounded-2xl animate-in">
              <h3 className="text-white font-medium mb-3 text-sm">{t('joinByInviteCode')}</h3>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder={t('inviteCodePlaceholder')}
                className="input-field tracking-[0.3em] text-center mb-3 font-mono"
                maxLength={6}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={!inviteCode.trim() || isLoading} className="btn-primary flex-1">
                  {t('joinBtn')}
                </button>
                <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">
                  {t('cancel', { ns: 'common' })}
                </button>
              </div>
            </form>
          )}

          {showPublic && (
            <div className="mt-4 p-4 glass-light rounded-2xl animate-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium text-sm">{t('discoverPublicWorkspaces')}</h3>
                <button
                  onClick={async () => { setPublicLoading(true); const list = await fetchPublicWorkspaces(); setPublicWorkspaces(list); setPublicLoading(false); }}
                  className="text-primary-400 hover:text-primary-300 text-xs transition-colors"
                >
                  {t('refresh', { ns: 'common' })}
                </button>
              </div>
              {publicLoading ? (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-400 rounded-full mx-auto mb-2" style={{ animation: 'spin-slow 1s linear infinite' }} />
                  <div className="text-dark-400 text-sm">{t('loading', { ns: 'common' })}</div>
                </div>
              ) : publicWorkspaces.length === 0 ? (
                <div className="text-center py-6 text-dark-500 text-sm">{t('noPublicWorkspaces')}</div>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {publicWorkspaces.map((ws) => (
                    <div key={ws.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-dark-700/50 transition-all group">
                      <div className="w-8 h-8 bg-dark-600/80 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Globe className="w-4 h-4 text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{ws.name}</div>
                        <div className="flex items-center gap-2 text-dark-500 text-xs">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {ws.members.length}
                          </span>
                          {ws.description && <span className="truncate">{ws.description}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleJoinPublic(ws.id)}
                        disabled={isLoading}
                        className="px-3 py-1.5 bg-primary-600/20 text-primary-400 rounded-xl text-xs font-medium hover:bg-primary-600/30 border border-primary-500/30 transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        {t('joinBtn')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setShowPublic(false)} className="btn-ghost w-full mt-3">
                {t('close', { ns: 'common' })}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-2xl text-red-400 text-sm flex items-center justify-between animate-in">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300 ml-2">×</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default WelcomePage;
