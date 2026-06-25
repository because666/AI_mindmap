import { useState, useEffect, useCallback } from 'react';
import { pushClientService, type PushMessage } from '../../services/pushService';
import { Bell, CheckCheck, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MessageListProps {
  onMessageClick: (messageId: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export function MessageList({ onMessageClick, onUnreadCountChange }: MessageListProps) {
  const { t } = useTranslation('message');
  const [messages, setMessages] = useState<PushMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'broadcast' | 'workspace'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchMessages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await pushClientService.getMessageList(page, 20, activeTab);
      if (page > 1) {
        setMessages(prev => [...prev, ...result.messages]);
      } else {
        setMessages(result.messages);
      }
      setHasMore(result.pagination.hasMore);
      setTotal(result.pagination.total);
      setUnreadCount(result.unreadCount);
      if (onUnreadCountChange) {
        onUnreadCountChange(result.unreadCount);
      }
    } catch (error) {
      console.error('获取消息列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab, onUnreadCountChange]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleMarkAllRead = async () => {
    try {
      await pushClientService.markAllAsRead();
      setMessages((prev) =>
        prev.map((msg) => ({ ...msg, read: true }))
      );
      setUnreadCount(0);
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
    } catch (error) {
      console.error('全部标记已读失败:', error);
    }
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHour = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return '刚刚';
    if (diffMin < 60) return `${diffMin}分钟前`;
    if (diffHour < 24) return `${diffHour}小时前`;
    if (diffDay < 7) return `${diffDay}天前`;

    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
    });
  };

  const tabs = [
    { key: 'all' as const, label: '全部', icon: Bell },
    { key: 'broadcast' as const, label: '系统', icon: AlertCircle },
    { key: 'workspace' as const, label: '工作区', icon: Bell },
  ];

  return (
    <div className="flex flex-col h-full bg-dark-950">
      <div className="sticky top-0 z-10 bg-dark-800 border-b border-dark-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">{t('messageCenter')}</h2>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-sm text-primary-400 hover:text-primary-300 transition-colors"
            >
              <CheckCheck size={16} />
              {t('markAllRead')}
            </button>
          )}
        </div>

        <div className="flex gap-2 border-b border-dark-700 -mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-dark-400 hover:text-dark-200'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-dark-400">
            <Bell size={48} strokeWidth={1} className="mb-2 opacity-30" />
            <p>加载中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-dark-400">
            <Bell size={48} strokeWidth={1} className="mb-2 opacity-30" />
            <p>{t('noMessages')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-dark-800">
            {messages.map((message) => (
              <li
                key={message.id}
                onClick={() => onMessageClick(message.id)}
                className={`px-4 py-3 cursor-pointer transition-colors hover:bg-dark-800 ${
                  !message.read ? 'bg-primary-600/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0">
                    {!message.read ? (
                      <span className="w-2 h-2 bg-red-500 rounded-full block"></span>
                    ) : (
                      <span className="w-2 h-2 bg-dark-600 rounded-full block"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium truncate ${
                        !message.read
                          ? 'text-white'
                          : 'text-dark-300'
                      }`}>
                        {message.title}
                      </span>
                      {message.forceRead && !message.read && (
                        <span className="px-1.5 py-0.5 text-xs bg-orange-900/30 text-orange-400 rounded font-medium flex-shrink-0">
                          强制
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-400 line-clamp-2 mb-1">
                      {message.summary}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-dark-500">
                        {formatTime(message.createdAt)}
                      </span>
                      <span className="text-xs text-dark-500">
                        {message.senderName}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="py-4 text-center">
            <button
              onClick={() => setPage((prev) => prev + 1)}
              className="text-sm text-primary-400 hover:underline"
            >
              {t('loadMore')}
            </button>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="px-4 py-2 bg-dark-800 text-xs text-dark-400 text-center border-t border-dark-700">
          {t('totalMessages', { count: total })}，{unreadCount > 0 ? t('unreadCount', { count: unreadCount }) : t('allRead')}
        </div>
      )}
    </div>
  );
}

export default MessageList;
