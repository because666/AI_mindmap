import { useState, useEffect } from 'react';
import { pushClientService, type MessageDetail as MessageDetailType } from '../../services/pushService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, Clock, User, CheckCircle2, AlertTriangle } from 'lucide-react';

interface MessageDetailProps {
  messageId: string;
  onBack: () => void;
}

export function MessageDetailComponent({ messageId, onBack }: MessageDetailProps) {
  const [message, setMessage] = useState<MessageDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        setLoading(true);
        const detail = await pushClientService.getMessageDetail(messageId);
        setMessage(detail);

        if (!detail.read) {
          await pushClientService.markAsRead(messageId);
          setMessage((prev) => (prev ? { ...prev, read: true, readAt: new Date().toISOString() } : null));
        }
      } catch (error) {
        console.error('获取消息详情失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, [messageId]);

  const handleForceReadConfirm = async () => {
    try {
      setMarkingRead(true);
      await pushClientService.markAsRead(messageId);
      setMessage((prev) => (prev ? { ...prev, read: true, readAt: new Date().toISOString() } : null));
    } catch (error) {
      console.error('确认已读失败:', error);
    } finally {
      setMarkingRead(false);
    }
  };

  const formatTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRemainingTime = (deadline?: string): string | null => {
    if (!deadline) return null;

    const deadlineDate = new Date(deadline);
    const now = new Date();
    const diffMs = deadlineDate.getTime() - now.getTime();

    if (diffMs <= 0) return '已过期';

    const diffDays = Math.floor(diffMs / 86400000);
    const diffHours = Math.floor((diffMs % 86400000) / 3600000);
    const diffMinutes = Math.floor((diffMs % 3600000) / 60000);

    if (diffDays > 0) return `${diffDays}天 ${diffHours}小时`;
    if (diffHours > 0) return `${diffHours}小时 ${diffMinutes}分钟`;
    return `${diffMinutes}分钟`;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <button onClick={onBack} className="p-1 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <span className="text-sm text-gray-400">加载中...</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          加载中...
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <button onClick={onBack} className="p-1 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          消息不存在
        </div>
      </div>
    );
  }

  const remainingTime = getRemainingTime(
    (message as any).forceReadDeadline
  );
  const isForceReadPending =
    message.forceRead && !message.read && remainingTime && remainingTime !== '已过期';

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 -ml-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
          </button>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate flex-1">
            {message.title}
          </h2>
          {message.read ? (
            <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
          ) : (
            <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0"></span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4">
          <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-gray-900 dark:prose-strong:text-white">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        </div>

        <div className="px-4 py-3 mt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <User size={14} />
            <span>发送者：{message.senderName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Clock size={14} />
            <span>发送时间：{formatTime(message.createdAt)}</span>
          </div>
          {message.readAt && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} />
              <span>已读于：{formatTime(message.readAt)}</span>
            </div>
          )}
          {message.workspaceInfo && (
            <div className="text-xs text-blue-600 dark:text-blue-400">
              工作区：{message.workspaceInfo.name}
            </div>
          )}
        </div>
      </div>

      {isForceReadPending && (
        <div className="sticky bottom-0 bg-orange-50 dark:bg-orange-900/20 border-t border-orange-200 dark:border-orange-800 px-4 py-3">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={16} className="text-orange-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-orange-800 dark:text-orange-300">
                这是一条重要通知，请在截止前阅读
              </p>
              <p className="text-orange-600 dark:text-orange-400 text-xs mt-0.5">
                剩余时间：<span className="font-medium">{remainingTime}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleForceReadConfirm}
            disabled={markingRead}
            className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
              markingRead
                ? 'bg-orange-200 dark:bg-orange-800/50 text-orange-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-600 text-white'
            }`}
          >
            {markingRead ? '处理中...' : '我已阅读并确认'}
          </button>
        </div>
      )}
    </div>
  );
}

export default MessageDetailComponent;
export { MessageDetailComponent as MessageDetail };
