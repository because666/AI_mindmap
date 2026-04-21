import React, { useState, useEffect } from 'react';
import { pushApi } from '../../services/api';
import { Send, BarChart3 } from 'lucide-react';

const PushPage: React.FC = () => {
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [forceRead, setForceRead] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => { loadMessages(); }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await pushApi.getMessages({ page: 1, limit: 50 });
      setMessages((res.data.data as { messages: Array<Record<string, unknown>> })?.messages || []);
    } catch (error) {
      console.error('加载推送记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    setSending(true);
    try {
      await pushApi.broadcast({ title, content, targetType, forceRead });
      setTitle('');
      setContent('');
      setShowForm(false);
      loadMessages();
    } catch (error) {
      console.error('发送失败:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">消息推送</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Send className="w-4 h-4" /> 发送广播
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
          <h3 className="font-medium mb-3">发送广播消息</h3>
          <form onSubmit={handleSend} className="space-y-3">
            <input type="text" placeholder="消息标题" value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
            <textarea placeholder="消息内容（支持Markdown）" value={content} onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm h-32 resize-none" required />
            <div className="flex gap-4">
              <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                <option value="all">全部用户</option>
                <option value="active_users">活跃用户</option>
              </select>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={forceRead} onChange={(e) => setForceRead(e.target.checked)} />
                强制阅读
              </label>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 border rounded-lg">取消</button>
              <button type="submit" disabled={sending} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {sending ? '发送中...' : '发送'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">推送记录</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无推送记录</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-800">{msg.title as string}</span>
                  <span className="text-xs text-gray-400">{new Date(msg.createdAt as string).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-500 line-clamp-2">{msg.summary as string}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                  <span>类型：{(msg.type as string) === 'broadcast' ? '广播' : '工作区'}</span>
                  <span>发送者：{msg.senderName as string}</span>
                  {msg.forceRead ? <span className="text-orange-500">强制阅读</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PushPage;
