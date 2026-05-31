import { useState, useEffect } from 'react';
import { pushClientService } from '../../services/pushService';
import { Bell } from 'lucide-react';

interface UnreadBadgeProps {
  onClick?: () => void;
  size?: number;
  externalUnreadCount?: number;
  className?: string;
}

export function UnreadBadge({ onClick, size = 24, externalUnreadCount, className }: UnreadBadgeProps) {
  const [internalUnreadCount, setInternalUnreadCount] = useState(0);
  const [forceReadPending, setForceReadPending] = useState(0);

  const unreadCount = externalUnreadCount !== undefined ? externalUnreadCount : internalUnreadCount;

  useEffect(() => {
    if (externalUnreadCount !== undefined) {
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const count = await pushClientService.getUnreadCount();
        setInternalUnreadCount(count.total);
        setForceReadPending(count.forceReadPending);
      } catch (error) {
        console.error('获取未读数量失败:', error);
      }
    };

    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 10000);

    const handlePushNotificationClick = (_event: Event) => {
      if (onClick) {
        onClick();
      }
    };

    window.addEventListener('push-notification-click', handlePushNotificationClick);

    return () => {
      clearInterval(interval);
      window.removeEventListener('push-notification-click', handlePushNotificationClick);
    };
  }, [onClick, externalUnreadCount]);

  return (
    <button
      onClick={onClick}
      className={className || 'relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors'}
      aria-label={`消息中心${unreadCount > 0 ? `，${unreadCount}条未读` : ''}`}
    >
      <Bell
        size={size}
        className={`transition-colors ${
          unreadCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
        }`}
      />

      {unreadCount > 0 && (
        <>
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>

          {forceReadPending > 0 && (
            <span className="absolute top-0 right-4 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span>
          )}
        </>
      )}

      {forceReadPending > 0 && unreadCount === 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
      )}
    </button>
  );
}

export default UnreadBadge;
