import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Map, Search, Plus, Clock, Calendar, Layers, X } from 'lucide-react';
import { useVisitorWorkspaceStore } from '../../stores/visitorWorkspaceStore';
import { track, TRACK_EVENT_MAP_LIBRARY_OPENED, TRACK_EVENT_MAP_LIBRARY_SEARCH, TRACK_EVENT_MAP_LIBRARY_SWITCH } from '../../services/tracker';

/**
 * 排序方式类型
 * - recent: 按最后编辑时间排序
 * - created: 按创建时间排序
 */
type SortMode = 'recent' | 'created';

/**
 * 地图库面板属性
 */
interface MapLibraryProps {
  /** 面板是否打开 */
  isOpen: boolean;
  /** 关闭面板回调 */
  onClose: () => void;
}

/**
 * 将时间戳转换为相对时间文本
 * 使用 i18n 翻译键返回本地化的相对时间文本
 * @param dateString - ISO时间字符串
 * @param t - i18n 翻译函数
 * @returns 相对时间文本（如"刚刚"、"昨天"、"3天前"）
 */
function getRelativeTime(dateString: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const date = new Date(dateString).getTime();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return t('relativeTimeJustNow');
  if (diffMin < 60) return t('relativeTimeMinutesAgo', { count: diffMin });
  if (diffHour < 24) return t('relativeTimeHoursAgo', { count: diffHour });
  if (diffDay === 1) return t('relativeTimeYesterday');
  if (diffDay < 30) return t('relativeTimeDaysAgo', { count: diffDay });
  if (diffDay < 365) return t('relativeTimeMonthsAgo', { count: Math.floor(diffDay / 30) });
  return t('relativeTimeYearsAgo', { count: Math.floor(diffDay / 365) });
}

/**
 * 地图库面板组件
 * 展示用户所有工作区（地图）的列表，支持搜索、排序、切换
 */
const MapLibrary: React.FC<MapLibraryProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation('nav');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const hasTrackedOpenRef = useRef(false);

  const {
    workspaces,
    currentWorkspace,
    workspaceMetadata,
    fetchWorkspaceMetadata,
    switchWorkspace,
    createWorkspace,
  } = useVisitorWorkspaceStore();

  /**
   * 面板打开时获取元数据并上报埋点
   * 使用 try-catch 保护，防止异常导致组件崩溃
   */
  useEffect(() => {
    if (isOpen) {
      fetchWorkspaceMetadata().catch(() => {
        // fetchWorkspaceMetadata 内部已有错误处理，此处仅为双重保护
      });
      if (!hasTrackedOpenRef.current) {
        try {
          track(TRACK_EVENT_MAP_LIBRARY_OPENED, {});
        } catch {
          // 埋点异常不影响组件正常运行
        }
        hasTrackedOpenRef.current = true;
      }
    } else {
      hasTrackedOpenRef.current = false;
    }
  }, [isOpen, fetchWorkspaceMetadata]);

  /**
   * 搜索时上报埋点（防抖500ms）
   */
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      try {
        track(TRACK_EVENT_MAP_LIBRARY_SEARCH, { query: searchQuery });
      } catch {
        // 埋点异常不影响搜索功能
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  /**
   * 过滤和排序后的地图列表
   */
  const filteredMaps = useMemo(() => {
    let list = [...workspaces];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter((ws) => ws.name.toLowerCase().includes(query));
    }

    // 排序
    if (sortMode === 'recent') {
      list.sort((a, b) => {
        const aTime = workspaceMetadata[a.id]?.lastNodeUpdatedAt || a.updatedAt;
        const bTime = workspaceMetadata[b.id]?.lastNodeUpdatedAt || b.updatedAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    } else {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [workspaces, searchQuery, sortMode, workspaceMetadata]);

  /**
   * 切换到指定地图
   * @param workspaceId - 工作区ID
   */
  const handleSwitchMap = useCallback((workspaceId: string) => {
    try {
      track(TRACK_EVENT_MAP_LIBRARY_SWITCH, { workspaceId });
    } catch {
      // 埋点异常不影响切换功能
    }
    switchWorkspace(workspaceId);
    onClose();
  }, [switchWorkspace, onClose]);

  /**
   * 创建新地图
   * 使用 i18n 翻译键作为默认地图名称
   */
  const handleCreateMap = useCallback(async () => {
    const newWs = await createWorkspace(t('newMapDefaultName'));
    if (newWs) {
      onClose();
    }
  }, [createWorkspace, onClose, t]);

  return (
    <div className="bg-dark-800 h-full overflow-hidden flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-primary-400" />
          <h3 className="text-white font-medium">{t('mapLibrary')}</h3>
          <span className="text-xs text-dark-400 bg-dark-700 px-1.5 py-0.5 rounded">
            {workspaces.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-dark-400 hover:text-white rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 搜索和排序 */}
      <div className="p-3 border-b border-dark-700 space-y-2">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('mapLibrarySearch')}
            className="w-full pl-9 pr-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:border-primary-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-dark-400 hover:text-white rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 排序切换 */}
        <div className="flex gap-1">
          <button
            onClick={() => setSortMode('recent')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              sortMode === 'recent'
                ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-700 text-dark-300 hover:text-white border border-transparent'
            }`}
          >
            <Clock className="w-3 h-3" />
            {t('mapLibrarySortRecent')}
          </button>
          <button
            onClick={() => setSortMode('created')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
              sortMode === 'created'
                ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                : 'bg-dark-700 text-dark-300 hover:text-white border border-transparent'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {t('mapLibrarySortCreated')}
          </button>
        </div>
      </div>

      {/* 地图列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredMaps.length === 0 ? (
          <div className="px-4 py-8 text-center text-dark-400">
            <Map className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{t('mapLibraryEmpty')}</p>
            <p className="text-xs mt-1 text-dark-500">{t('mapLibraryEmptyDesc')}</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredMaps.map((ws) => {
              const meta = workspaceMetadata[ws.id];
              const isCurrent = currentWorkspace?.id === ws.id;

              return (
                <button
                  key={ws.id}
                  onClick={() => handleSwitchMap(ws.id)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    isCurrent
                      ? 'bg-primary-600/15 border border-primary-500/30'
                      : 'hover:bg-dark-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium truncate flex-1 ${
                        isCurrent ? 'text-primary-300' : 'text-white'
                      }`}
                    >
                      {ws.name}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] text-primary-400 bg-primary-600/20 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">
                        {t('mapLibraryCurrentMap')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-dark-400">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {t('mapLibraryNodes', { count: meta?.nodeCount ?? 0 })}
                    </span>
                    {(meta?.lastNodeUpdatedAt || ws.updatedAt) && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {getRelativeTime(meta?.lastNodeUpdatedAt || ws.updatedAt, t)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 新建地图按钮 */}
      <div className="p-3 border-t border-dark-700">
        <button
          onClick={handleCreateMap}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          {t('mapLibraryNewMap')}
        </button>
      </div>
    </div>
  );
};

export default MapLibrary;
