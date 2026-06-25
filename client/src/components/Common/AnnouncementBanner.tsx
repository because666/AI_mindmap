import React, { useState, useEffect, useMemo } from 'react';
import { X, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * 公告类型定义
 */
type AnnouncementType = 'info' | 'warning' | 'success' | 'error';

/**
 * 公告数据接口（从 /api/announcements 返回）
 */
interface AnnouncementData {
  _id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  startDate: string;
  endDate: string;
}

/**
 * 公告类型与样式映射
 * 根据公告类型决定横幅的背景色和图标
 */
const TYPE_STYLES: Record<AnnouncementType, { bg: string; text: string; icon: React.FC<{ className?: string }> }> = {
  info: { bg: 'bg-blue-600', text: 'text-white', icon: Info },
  warning: { bg: 'bg-yellow-500', text: 'text-white', icon: AlertTriangle },
  success: { bg: 'bg-green-600', text: 'text-white', icon: CheckCircle },
  error: { bg: 'bg-red-600', text: 'text-white', icon: XCircle },
};

/**
 * localStorage 键名前缀，用于记录已关闭的公告ID
 */
const STORAGE_KEY_PREFIX = 'announcement_closed_';

/**
 * 获取已读公告的 localStorage 键名
 * @param id - 公告ID
 * @returns localStorage 键名字符串
 */
const getStorageKey = (id: string): string => `${STORAGE_KEY_PREFIX}${id}`;

/**
 * 检查公告是否已被用户关闭（已读）
 * @param id - 公告ID
 * @returns 是否已关闭
 */
const isClosed = (id: string): boolean => {
  try {
    return localStorage.getItem(getStorageKey(id)) !== null;
  } catch {
    return false;
  }
};

/**
 * 标记公告为已关闭
 * @param id - 公告ID
 */
const markClosed = (id: string): void => {
  try {
    localStorage.setItem(getStorageKey(id), new Date().toISOString());
  } catch {
    // localStorage 不可用时静默失败
  }
};

/**
 * 站内公告横幅组件
 * 从 /api/announcements 获取当前生效的公告列表
 * 在页面顶部展示可关闭的横幅，根据公告类型显示不同颜色
 * 关闭后通过 localStorage 记录已读状态，同一公告不再重复展示
 * @returns 公告横幅组件或 null（无公告时）
 */
const AnnouncementBanner: React.FC = () => {
  const { t } = useTranslation('announcement');
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);

  /**
   * 根据公告列表与 localStorage 已读状态计算可见公告 ID 集合
   * 使用 useMemo 替代 useState + useEffect，避免在 effect 中同步 setState 导致的额外渲染
   */
  const visibleIds = useMemo(() => {
    const visible = new Set<string>();
    for (const a of announcements) {
      if (!isClosed(a._id)) {
        visible.add(a._id);
      }
    }
    return visible;
  }, [announcements]);

  useEffect(() => {
    /**
     * 从后端获取当前生效的公告列表
     * 失败时静默处理，不展示横幅
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
        // 网络异常时静默处理，不展示横幅
      }
    };

    loadAnnouncements();
    const interval = setInterval(loadAnnouncements, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * 关闭单条公告
   * 标记为已关闭后，visibleIds 由 useMemo 重新计算，无需手动同步 state
   * @param id - 公告ID
   */
  const handleClose = (id: string) => {
    markClosed(id);
  };

  const visibleAnnouncements = announcements.filter((a) => visibleIds.has(a._id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="w-full">
      {visibleAnnouncements.map((announcement) => {
        const style = TYPE_STYLES[announcement.type] || TYPE_STYLES.info;
        const IconComponent = style.icon;
        return (
          <div
            key={announcement._id}
            className={`${style.bg} ${style.text} px-4 py-2.5 flex items-center gap-3 text-sm`}
          >
            <IconComponent className="w-4 h-4 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium">{announcement.title}</span>
              {announcement.content && (
                <span className="ml-2 opacity-90">{announcement.content}</span>
              )}
            </div>
            <button
              onClick={() => handleClose(announcement._id)}
              className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
              title={t('closeAnnouncement')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AnnouncementBanner;
