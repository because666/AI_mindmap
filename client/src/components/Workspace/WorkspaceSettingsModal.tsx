import React, { useState } from 'react';
import { X, Globe, Lock, Users, Copy, Check, RefreshCw, Trash2, UserMinus, Settings } from 'lucide-react';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';
import type { WorkspaceType } from '../../types';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 工作区设置弹窗组件
 * 提供工作区信息编辑、成员管理、邀请码管理、删除工作区等功能
 */
const WorkspaceSettingsModal: React.FC<WorkspaceSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    visitor,
    currentWorkspace,
    isLoading,
    error,
    updateWorkspace,
    removeMember,
    refreshInviteCode,
    deleteWorkspace,
    clearError,
  } = useVisitorWorkspaceStore();

  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'danger'>('info');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState<WorkspaceType>('public');
  const [isEditing, setIsEditing] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen || !currentWorkspace) return null;

  const isOwner = currentWorkspace.ownerId === visitor?.id;

  const handleStartEdit = () => {
    setEditName(currentWorkspace.name);
    setEditDescription(currentWorkspace.description || '');
    setEditType(currentWorkspace.type);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    const success = await updateWorkspace(currentWorkspace.id, {
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      type: editType,
    });
    if (success) {
      setIsEditing(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!currentWorkspace.inviteCode) return;
    try {
      await navigator.clipboard.writeText(currentWorkspace.inviteCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      console.error('复制失败');
    }
  };

  const handleRefreshInvite = async () => {
    await refreshInviteCode(currentWorkspace.id);
  };

  const handleRemoveMember = async (targetVisitorId: string) => {
    if (!confirm('确定要移除该成员吗？')) return;
    await removeMember(currentWorkspace.id, targetVisitorId);
  };

  const handleDeleteWorkspace = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const success = await deleteWorkspace(currentWorkspace.id);
    if (success) {
      onClose();
    }
    setConfirmDelete(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade">
      <div className="w-full max-w-lg glass rounded-2xl shadow-2xl animate-scale-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-bold text-white">工作区设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-dark-700">
          {(['info', 'members', 'danger'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setConfirmDelete(false); clearError(); }}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-primary-400 border-b-2 border-primary-400'
                  : 'text-dark-400 hover:text-white'
              }`}
            >
              {tab === 'info' ? '基本信息' : tab === 'members' ? '成员管理' : '危险操作'}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm text-dark-300 mb-1">工作区名称</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 text-sm"
                      maxLength={50}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-dark-300 mb-1">描述</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:border-primary-500 text-sm resize-none"
                      rows={2}
                      maxLength={200}
                    />
                  </div>
                  {isOwner && (
                    <div>
                      <label className="block text-sm text-dark-300 mb-2">工作区类型</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditType('public')}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            editType === 'public' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-400 hover:text-white'
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                          公开
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditType('private')}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                            editType === 'private' ? 'bg-primary-600 text-white' : 'bg-dark-700 text-dark-400 hover:text-white'
                          }`}
                        >
                          <Lock className="w-3.5 h-3.5" />
                          私密
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={!editName.trim() || isLoading}
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-dark-700 text-dark-400 rounded-lg text-sm hover:text-white transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-xl">
                    <div className="w-10 h-10 bg-dark-700 rounded-lg flex items-center justify-center">
                      {currentWorkspace.type === 'public' ? (
                        <Globe className="w-5 h-5 text-primary-400" />
                      ) : (
                        <Lock className="w-5 h-5 text-primary-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium">{currentWorkspace.name}</div>
                      <div className="text-dark-500 text-xs">
                        {currentWorkspace.type === 'public' ? '公开工作区' : '私密工作区'}
                        {currentWorkspace.description && ` · ${currentWorkspace.description}`}
                      </div>
                    </div>
                    {isOwner && (
                      <button
                        onClick={handleStartEdit}
                        className="px-3 py-1.5 text-primary-400 hover:text-primary-300 text-sm border border-primary-500/30 rounded-lg hover:bg-dark-700 transition-colors"
                      >
                        编辑
                      </button>
                    )}
                  </div>

                  {currentWorkspace.inviteCode && (
                    <div className="p-4 bg-dark-800 rounded-xl">
                      <div className="text-sm text-dark-300 mb-2">邀请码</div>
                      <div className="flex items-center gap-2">
                        <span className="text-primary-400 font-mono text-lg tracking-widest flex-1">
                          {currentWorkspace.inviteCode}
                        </span>
                        <button
                          onClick={handleCopyInviteCode}
                          className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
                          title="复制邀请码"
                        >
                          {copiedCode ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                        {isOwner && (
                          <button
                            onClick={handleRefreshInvite}
                            disabled={isLoading}
                            className="p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-700 transition-colors"
                            title="刷新邀请码"
                          >
                            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-dark-500 text-xs">
                    <Users className="w-3.5 h-3.5" />
                    <span>{currentWorkspace.members.length} 位成员</span>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-2">
              {currentWorkspace.members.map((member) => (
                <div
                  key={member.visitorId}
                  className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg"
                >
                  <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {member.nickname.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{member.nickname}</div>
                    <div className="text-dark-500 text-xs">
                      {member.role === 'owner' ? '所有者' : '协作者'}
                    </div>
                  </div>
                  {isOwner && member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.visitorId)}
                      disabled={isLoading}
                      className="p-1.5 text-dark-400 hover:text-red-400 rounded-lg hover:bg-dark-700 transition-colors"
                      title="移除成员"
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-4">
              {isOwner ? (
                <div className="p-4 bg-red-900/20 border border-red-700/30 rounded-xl">
                  <h3 className="text-red-400 font-medium mb-2">删除工作区</h3>
                  <p className="text-dark-400 text-sm mb-3">
                    删除后所有数据将永久丢失，此操作不可撤销。
                  </p>
                  <button
                    onClick={handleDeleteWorkspace}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    {confirmDelete ? '确认删除' : '删除工作区'}
                  </button>
                  {confirmDelete && (
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="ml-2 px-4 py-2 bg-dark-700 text-dark-400 rounded-lg text-sm hover:text-white transition-colors"
                    >
                      取消
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-dark-800 rounded-xl">
                  <p className="text-dark-400 text-sm">
                    仅工作区所有者可以执行危险操作。
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-400 text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={clearError} className="text-red-400 hover:text-red-300">×</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSettingsModal;
