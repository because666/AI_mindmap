import React, { useState } from 'react';
import { Network, Plus, LogIn, Globe, Lock, Copy, Check, Search, Users, Sparkles } from 'lucide-react';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';
import useMobile from '../../hooks/useMobile';
import type { WorkspaceType, IWorkspace } from '../../types';

const WelcomePage: React.FC = () => {
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
          <h1 className="text-2xl font-bold text-white text-center mb-1 tracking-tight">思流图</h1>
          <p className="text-dark-400 text-center mb-8 text-sm">对话驱动的结构化思维协作平台</p>

          <form onSubmit={handleNicknameSubmit}>
            <label className="block text-sm font-medium text-dark-300 mb-2">输入你的昵称</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="请输入昵称..."
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
              开始使用
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 text-sm flex items-center justify-between animate-in">
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
              <h1 className="text-xl font-bold text-white tracking-tight">欢迎，{visitor.nickname}</h1>
              <p className="text-dark-400 text-sm">选择或创建一个工作区开始</p>
            </div>
          </div>

          {workspaces.length > 0 && (
            <div className="mb-6 animate-in-delay-1">
              <h3 className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-3">我的工作区</h3>
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
                        {ws.members.length} 位成员
                      </div>
                    </div>
                    {ws.inviteCode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); copyInviteCode(ws.inviteCode!, ws.id); }}
                        className="p-1.5 text-dark-500 hover:text-primary-400 rounded-lg hover:bg-dark-600 transition-all"
                        title="复制邀请码"
                      >
                        {copiedId === ws.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 animate-in-delay-2">
            <button
              onClick={() => { haptic('light'); setShowCreate(true); setShowJoin(false); setShowPublic(false); }}
              className="btn-primary flex-1"
            >
              <Plus className="w-4 h-4" />
              创建
            </button>
            <button
              onClick={() => { haptic('light'); setShowJoin(true); setShowCreate(false); setShowPublic(false); }}
              className="btn-ghost flex-1"
            >
              <LogIn className="w-4 h-4" />
              邀请码
            </button>
            <button
              onClick={handleShowPublic}
              className="btn-ghost flex-1"
            >
              <Search className="w-4 h-4" />
              发现
            </button>
          </div>

          {showCreate && (
            <form onSubmit={handleCreateWorkspace} className="mt-4 p-4 glass-light rounded-xl animate-in">
              <h3 className="text-white font-medium mb-3 text-sm">创建新工作区</h3>
              <input
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="工作区名称"
                className="input-field mb-3"
                maxLength={50}
              />
              <textarea
                value={workspaceDescription}
                onChange={(e) => setWorkspaceDescription(e.target.value)}
                placeholder="工作区描述（可选）"
                className="input-field mb-3 resize-none"
                rows={2}
                maxLength={200}
              />
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setWorkspaceType('public')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    workspaceType === 'public'
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-500/40'
                      : 'bg-dark-700/50 text-dark-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  公开
                </button>
                <button
                  type="button"
                  onClick={() => setWorkspaceType('private')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    workspaceType === 'private'
                      ? 'bg-primary-600/20 text-primary-400 border border-primary-500/40'
                      : 'bg-dark-700/50 text-dark-400 hover:text-white border border-transparent'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  私密
                </button>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={!workspaceName.trim() || isLoading} className="btn-primary flex-1">
                  创建
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-ghost"
                >
                  取消
                </button>
              </div>
            </form>
          )}

          {showJoin && (
            <form onSubmit={handleJoinByCode} className="mt-4 p-4 glass-light rounded-xl animate-in">
              <h3 className="text-white font-medium mb-3 text-sm">通过邀请码加入</h3>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="输入6位邀请码"
                className="input-field tracking-[0.3em] text-center mb-3 font-mono"
                maxLength={6}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={!inviteCode.trim() || isLoading} className="btn-primary flex-1">
                  加入
                </button>
                <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">
                  取消
                </button>
              </div>
            </form>
          )}

          {showPublic && (
            <div className="mt-4 p-4 glass-light rounded-xl animate-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-medium text-sm">发现公开工作区</h3>
                <button
                  onClick={async () => { setPublicLoading(true); const list = await fetchPublicWorkspaces(); setPublicWorkspaces(list); setPublicLoading(false); }}
                  className="text-primary-400 hover:text-primary-300 text-xs transition-colors"
                >
                  刷新
                </button>
              </div>
              {publicLoading ? (
                <div className="text-center py-6">
                  <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-400 rounded-full mx-auto mb-2" style={{ animation: 'spin-slow 1s linear infinite' }} />
                  <div className="text-dark-400 text-sm">加载中...</div>
                </div>
              ) : publicWorkspaces.length === 0 ? (
                <div className="text-center py-6 text-dark-500 text-sm">暂无公开工作区</div>
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
                        className="px-3 py-1.5 bg-primary-600/20 text-primary-400 rounded-lg text-xs font-medium hover:bg-primary-600/30 border border-primary-500/30 transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        加入
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setShowPublic(false)} className="btn-ghost w-full mt-3">
                关闭
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-xl text-red-400 text-sm flex items-center justify-between animate-in">
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
