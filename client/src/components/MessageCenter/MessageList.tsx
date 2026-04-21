import { useState, useEffect, useCallback } from 'react';
import { pushClientService, type PushMessage } from '../../services/pushService';
import { Bell, CheckCheck, AlertCircle } from 'lucide-react';

interface MessageListProps {
  onMessageClick: (messageId: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export function MessageList({ onMessageClick, onUnreadCountChange }: MessageListProps) {
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

  useEffect(() => {
    const interval = setInterval(async () => {
      const count = await pushClientService.getUnreadCount();
      setUnreadCount(count.total);
      if (onUnreadCountChange) {
        onUnreadCountChange(count.total);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [onUnreadCountChange]);

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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">消息中心</h2>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              <CheckCheck size={16} />
              全部已读
            </button>
          )}
        </div>

        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 -mb-3">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setPage(1);
              }}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
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
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Bell size={48} strokeWidth={1} className="mb-2 opacity-30" />
            <p>加载中...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Bell size={48} strokeWidth={1} className="mb-2 opacity-30" />
            <p>暂无消息</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {messages.map((message) => (
              <li
                key={message.id}
                onClick={() => onMessageClick(message.id)}
                className={`px-4 py-3 cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
                  !message.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex-shrink-0">
                    {!message.read ? (
                      <span className="w-2 h-2 bg-red-500 rounded-full block"></span>
                    ) : (
                      <span className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full block"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium truncate ${
                        !message.read
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {message.title}
                      </span>
                      {message.forceRead && !message.read && (
                        <span className="px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded font-medium flex-shrink-0">
                          强制
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-1">
                      {message.summary}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTime(message.createdAt)}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
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
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              加载更多
            </button>
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">
          共 {total} 条消息，{unreadCount > 0 ? `${unreadCount} 条未读` : '全部已读'}
        </div>
      )}
    </div>
  );
}

export default MessageList;
