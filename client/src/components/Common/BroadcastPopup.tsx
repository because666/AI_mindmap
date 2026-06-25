import React, { useState, useEffect, useMemo } from 'react';
import { X, Megaphone, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type AnnouncementType = 'info' | 'warning' | 'success' | 'error';

interface AnnouncementData {
  _id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  startDate: string;
  endDate: string;
}

const STORAGE_KEY_PREFIX = 'announcement_closed_';

const getStorageKey = (id: string): string => `${STORAGE_KEY_PREFIX}${id}`;

const isClosed = (id: string): boolean => {
  try {
    return localStorage.getItem(getStorageKey(id)) !== null;
  } catch {
    return false;
  }
};

const markClosed = (id: string): void => {
  try {
    localStorage.setItem(getStorageKey(id), new Date().toISOString());
  } catch {
    // localStorage 不可用时静默失败
  }
};

const TYPE_ICON: Record<AnnouncementType, React.FC<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle,
  error: XCircle,
};

const TYPE_HEADER_BG: Record<AnnouncementType, string> = {
  info: 'bg-blue-600',
  warning: 'bg-yellow-500',
  success: 'bg-green-600',
  error: 'bg-red-600',
};

/**
 * 公告弹窗组件
 * 从 /api/announcements 获取当前生效的公告列表
 * 以弹窗（modal）形式展示未关闭的公告
 * 关闭后通过 localStorage 记录已读状态，与 AnnouncementBanner 共享同一 key 前缀
 * 确保关闭弹窗后横幅也不再显示同一公告
 * @returns 公告弹窗组件或 null（无公告时）
 */
const BroadcastPopup: React.FC = () => {
  const { t } = useTranslation('announcement');
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);

  /**
   * 计算未关闭的公告列表
   * 使用 useMemo 替代 useState + useEffect，避免在 effect 中同步 setState 导致的额外渲染
   */
  const unclosed = useMemo(
    () => announcements.filter((a) => !isClosed(a._id)),
    [announcements]
  );

  /**
   * 弹窗是否可见
   * 当存在未关闭公告时自动显示
   */
  const isVisible = unclosed.length > 0;

  useEffect(() => {
    /**
     * 从后端获取当前生效的公告列表
     * 失败时静默处理
     */
    const loadAnnouncements = async () => {
      try {
        const response = await fetch('/api/announcements');
        if (!response.ok) return;
        const result = await response.json() as { success: boolean; data: AnnouncementData[] };
        if (result.success && Array.isArray(result.data)) {
          setAnnouncements(result.data);
        }
      } catch {
        // 网络异常时静默处理
      }
    };

    loadAnnouncements();
    const interval = setInterval(loadAnnouncements, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * 关闭当前公告
   * 标记当前展示的公告为已关闭，关闭后弹窗会根据派生的 unclosed 列表自动更新
   */
  const handleClose = () => {
    if (unclosed.length === 0) return;

    const current = unclosed[0];
    markClosed(current._id);
  };

  if (!isVisible) return null;

  const current = unclosed[0];
  const announcementType: AnnouncementType = current.type || 'info';
  const IconComponent = TYPE_ICON[announcementType] || Megaphone;
  const headerBg = TYPE_HEADER_BG[announcementType] || 'bg-blue-600';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className={`${headerBg} px-6 py-4 flex items-center gap-3`}>
          <IconComponent className="w-5 h-5 text-white shrink-0" />
          <h3 className="text-white font-bold text-lg flex-1 truncate">
            {current.title}
          </h3>
          <button
            onClick={handleClose}
            className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/20 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
            {current.content}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {new Date(current.startDate).toLocaleString()}
            </span>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors min-h-[44px]"
            >
              {t('gotIt')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPopup;
