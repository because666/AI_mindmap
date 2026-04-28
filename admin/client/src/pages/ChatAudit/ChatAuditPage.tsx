import React, { useState, useEffect } from 'react';
import { auditApi } from '../../services/api';
import type { ChatAuditItem, SensitiveWordConfig } from '../../types';
import { Shield, Search, CheckCircle, Trash2, MessageSquare, AlertTriangle } from 'lucide-react';

interface ConversationItem {
  _id: string;
  id: string;
  title: string;
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  lastMessage: string;
}

interface ConversationDetail {
  _id: string;
  id: string;
  title: string;
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp: string;
  }>;
}

const ChatAuditPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'audit' | 'conversations'>('conversations');
  const [messages, setMessages] = useState<ChatAuditItem[]>([]);
  const [config, setConfig] = useState<SensitiveWordConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [newWord, setNewWord] = useState('');

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convPage, setConvPage] = useState(1);
  const [convSearch, setConvSearch] = useState('');
  const [convLoading, setConvLoading] = useState(false);
  const [selectedConv, setSelectedConv] = useState<ConversationDetail | null>(null);
  const [convDetailLoading, setConvDetailLoading] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'conversations') loadConversations(); }, [activeTab, convPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [msgRes, cfgRes] = await Promise.all([
        auditApi.getMessages({ limit: 50, riskLevel: riskFilter || undefined, status: statusFilter || undefined }),
        auditApi.getConfig(),
      ]);
      setMessages((msgRes.data.data as { items: ChatAuditItem[] })?.items || []);
      const rawConfig = cfgRes.data.data as SensitiveWordConfig;
      setConfig({
        enabled: rawConfig?.enabled ?? true,
        words: rawConfig?.words ?? [],
        matchMode: rawConfig?.matchMode ?? 'exact',
        autoFlag: rawConfig?.autoFlag ?? true,
      });
    } catch (error) {
      console.error('加载审计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    setConvLoading(true);
    try {
      const res = await auditApi.getConversations({
        page: convPage,
        limit: 20,
        search: convSearch || undefined,
      });
      const data = res.data.data as { items: ConversationItem[]; total: number };
      setConversations(data?.items || []);
      setConvTotal(data?.total || 0);
    } catch (error) {
      console.error('加载对话列表失败:', error);
    } finally {
      setConvLoading(false);
    }
  };

  const loadConversationDetail = async (id: string) => {
    setConvDetailLoading(true);
    try {
      const res = await auditApi.getConversationDetail(id);
      setSelectedConv(res.data.data as ConversationDetail);
    } catch (error) {
      console.error('加载对话详情失败:', error);
    } finally {
      setConvDetailLoading(false);
    }
  };

  const handleDeleteConvMessage = async (convId: string, msgIndex: number) => {
    if (!confirm('确定删除该消息？此操作不可恢复。')) return;
    try {
      await auditApi.deleteConversationMessage(convId, msgIndex, '管理员删除不安全内容');
      if (selectedConv && selectedConv.id === convId) {
        loadConversationDetail(convId);
      }
      loadConversations();
    } catch (error) {
      console.error('删除消息失败:', error);
    }
  };

  const handleAddWord = () => {
    if (!newWord.trim() || !config) return;
    setConfig({ ...config, words: [...config.words, newWord.trim()] });
    setNewWord('');
  };

  const handleRemoveWord = (index: number) => {
    if (!config) return;
    const words = config.words.filter((_, i) => i !== index);
    setConfig({ ...config, words });
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      await auditApi.updateConfig(config as unknown as Record<string, unknown>);
      setShowConfig(false);
    } catch (error) {
      console.error('保存配置失败:', error);
    }
  };

  const handleMarkSafe = async (id: string) => {
    try {
      await auditApi.markSafe(id, '管理员标记安全');
      loadData();
    } catch (error) {
      console.error('标记安全失败:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await auditApi.deleteMessage(id, '管理员删除');
      loadData();
    } catch (error) {
      console.error('删除消息失败:', error);
    }
  };

  const handleConvSearch = () => {
    setConvPage(1);
    loadConversations();
  };

  const riskColors: Record<string, string> = {
    low: 'bg-yellow-50 text-yellow-600',
    medium: 'bg-orange-50 text-orange-600',
    high: 'bg-red-50 text-red-600',
  };

  const totalPages = Math.ceil(convTotal / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">对话审计</h1>
        <button onClick={() => setShowConfig(!showConfig)} className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
          <Shield className="w-4 h-4" /> 敏感词配置
        </button>
      </div>

      {showConfig && config && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-medium mb-3">敏感词配置</h3>
          <div className="flex gap-2 mb-3">
            <input type="text" placeholder="添加敏感词" value={newWord} onChange={(e) => setNewWord(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-lg text-sm" onKeyDown={(e) => e.key === 'Enter' && handleAddWord()} />
            <button onClick={handleAddWord} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {config.words.map((word, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-600 rounded text-xs">
                {word}
                <button onClick={() => handleRemoveWord(i)} className="hover:text-red-800">&times;</button>
              </span>
            ))}
            {config.words.length === 0 && <span className="text-sm text-gray-400">暂无敏感词</span>}
          </div>
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
              启用检测
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={config.autoFlag} onChange={(e) => setConfig({ ...config, autoFlag: e.target.checked })} />
              自动标记
            </label>
          </div>
          <button onClick={handleSaveConfig} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">保存配置</button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('conversations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'conversations' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
        >
          <MessageSquare className="w-4 h-4" /> 对话记录
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'audit' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
        >
          <AlertTriangle className="w-4 h-4" /> 敏感词审计
        </button>
      </div>

      {activeTab === 'conversations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-3 border-b border-gray-100">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="搜索对话内容..."
                  value={convSearch}
                  onChange={(e) => setConvSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConvSearch()}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <button onClick={handleConvSearch} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
                  <Search className="w-4 h-4" />
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-2">共 {convTotal} 条对话</div>
            </div>

            {convLoading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">暂无对话记录</div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-50">
                {conversations.map((conv) => (
                  <div
                    key={conv._id}
                    onClick={() => loadConversationDetail(conv.id || conv._id)}
                    className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors ${selectedConv?._id === conv._id ? 'bg-blue-50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate flex-1 mr-2">
                        {conv.title || '未命名对话'}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {conv.messageCount} 条消息
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 truncate mb-1">{conv.lastMessage || '无消息'}</p>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>用户: {conv.userMessageCount} / AI: {conv.assistantMessageCount}</span>
                      <span>{conv.createdAt ? new Date(conv.createdAt).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="p-3 border-t border-gray-100 flex justify-between items-center">
                <button
                  onClick={() => setConvPage(Math.max(1, convPage - 1))}
                  disabled={convPage <= 1}
                  className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500">{convPage} / {totalPages}</span>
                <button
                  onClick={() => setConvPage(Math.min(totalPages, convPage + 1))}
                  disabled={convPage >= totalPages}
                  className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100">
            {convDetailLoading ? (
              <div className="p-8 text-center text-gray-400">加载中...</div>
            ) : !selectedConv ? (
              <div className="p-8 text-center text-gray-400">点击左侧对话查看详情</div>
            ) : (
              <div>
                <div className="p-4 border-b border-gray-100">
                  <h3 className="font-medium text-gray-800">{selectedConv.title || '未命名对话'}</h3>
                  <div className="text-xs text-gray-400 mt-1">
                    创建者: {selectedConv.createdBy || '未知'} · 创建时间: {selectedConv.createdAt ? new Date(selectedConv.createdAt).toLocaleString() : '未知'} · {selectedConv.messages?.length || 0} 条消息
                  </div>
                </div>
                <div className="max-h-[550px] overflow-y-auto p-4 space-y-3">
                  {selectedConv.messages?.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative group max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : msg.role === 'assistant'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-yellow-50 text-yellow-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-medium ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                            {msg.role === 'user' ? '用户' : msg.role === 'assistant' ? 'AI' : '系统'}
                          </span>
                          {msg.timestamp && (
                            <span className={`text-xs ${msg.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                              {new Date(msg.timestamp).toLocaleString()}
                            </span>
                          )}
                          {msg.role === 'user' && (
                            <button
                              onClick={() => handleDeleteConvMessage(selectedConv.id || selectedConv._id, index)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 text-red-300 hover:text-red-500"
                              title="删除此消息"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
                      </div>
                    </div>
                  ))}
                  {(!selectedConv.messages || selectedConv.messages.length === 0) && (
                    <div className="text-center text-gray-400 py-8">此对话暂无消息</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex gap-3">
            <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">全部风险</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="safe">已标记安全</option>
              <option value="deleted">已删除</option>
            </select>
            <button onClick={loadData} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">刷新</button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">加载中...</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">暂无审计记录</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {messages.map((msg) => (
                <div key={msg._id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${riskColors[msg.auditResult.riskLevel]}`}>
                        {msg.auditResult.riskLevel === 'low' ? '低风险' : msg.auditResult.riskLevel === 'medium' ? '中风险' : '高风险'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {msg.auditResult.status === 'pending' ? '待处理' : msg.auditResult.status === 'safe' ? '安全' : '已删除'}
                      </span>
                    </div>
                    {msg.auditResult.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleMarkSafe(msg._id)} className="p-1 text-gray-400 hover:text-green-600" title="标记安全"><CheckCircle className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(msg._id)} className="p-1 text-gray-400 hover:text-red-600" title="删除"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mb-1 line-clamp-2">{msg.content}</p>
                  <div className="text-xs text-gray-400">
                    命中词：{msg.auditResult.matchedWords.join(', ')} · {new Date(msg.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatAuditPage;
