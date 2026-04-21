import React, { useState, useEffect } from 'react';
import { auditApi } from '../../services/api';
import type { ChatAuditItem, SensitiveWordConfig } from '../../types';
import { Shield, Search, CheckCircle, Trash2 } from 'lucide-react';

const ChatAuditPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatAuditItem[]>([]);
  const [config, setConfig] = useState<SensitiveWordConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [newWord, setNewWord] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [msgRes, cfgRes] = await Promise.all([
        auditApi.getMessages({ limit: 50, riskLevel: riskFilter || undefined, status: statusFilter || undefined }),
        auditApi.getConfig(),
      ]);
      setMessages((msgRes.data.data as { items: ChatAuditItem[] })?.items || []);
      setConfig(cfgRes.data.data as SensitiveWordConfig);
    } catch (error) {
      console.error('加载审计数据失败:', error);
    } finally {
      setLoading(false);
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

  const riskColors: Record<string, string> = {
    low: 'bg-yellow-50 text-yellow-600',
    medium: 'bg-orange-50 text-orange-600',
    high: 'bg-red-50 text-red-600',
  };

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
    </div>
  );
};

export default ChatAuditPage;
