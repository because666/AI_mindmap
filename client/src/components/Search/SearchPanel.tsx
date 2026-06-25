import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, MapPin, Clock, Trash2 } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import useIsMobile from '../../hooks/useIsMobile';

/**
 * 搜索历史记录的localStorage键名
 */
const SEARCH_HISTORY_KEY = 'deepmindmap-search-history';

/**
 * 搜索历史记录最大保存条数
 */
const MAX_HISTORY_ITEMS = 5;

/**
 * 防抖延迟时间（毫秒）
 */
const DEBOUNCE_DELAY = 300;

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNodeSelect: (nodeId: string) => void;
}

/**
 * 将文本按关键词分割，匹配部分用mark标签包裹以实现高亮
 * @param text - 需要高亮处理的原始文本
 * @param query - 搜索关键词
 * @returns 包含高亮标记的React节点
 */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) {
    return text;
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) {
    return text;
  }

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-primary-500/30 text-primary-200 rounded px-0.5">
            {part}
          </mark>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

/**
 * 从localStorage读取搜索历史记录
 * @returns 搜索历史记录字符串数组
 */
function loadSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item: unknown): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/**
 * 保存搜索关键词到历史记录
 * 最多保留MAX_HISTORY_ITEMS条，新的记录放在最前面，重复的移到最前
 * @param query - 要保存的搜索关键词
 */
function saveSearchHistory(query: string): void {
  try {
    const trimmed = query.trim();
    if (!trimmed) return;

    const history = loadSearchHistory();
    const filtered = history.filter(item => item !== trimmed);
    filtered.unshift(trimmed);

    if (filtered.length > MAX_HISTORY_ITEMS) {
      filtered.length = MAX_HISTORY_ITEMS;
    }

    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // localStorage不可用时静默失败
  }
}

/**
 * 从搜索历史中删除指定项
 * @param query - 要删除的搜索关键词
 * @returns 删除后的搜索历史记录数组
 */
function removeSearchHistoryItem(query: string): string[] {
  try {
    const history = loadSearchHistory();
    const filtered = history.filter(item => item !== query);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}

/**
 * 全局搜索面板组件
 * 支持桌面端居中弹窗和移动端全屏显示
 * 包含搜索防抖、关键词高亮、搜索历史、点击定位等功能
 */
const SearchPanel: React.FC<SearchPanelProps> = ({ isOpen, onClose, onNodeSelect }) => {
  const { t } = useTranslation('search');
  const { searchQuery, setSearchQuery, searchResults, nodes, selectNode } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  /**
   * 搜索面板打开时加载搜索历史
   * 使用微任务延迟 setState，避免在 effect body 中同步调用 setState 触发级联渲染
   */
  useEffect(() => {
    if (isOpen) {
      Promise.resolve().then(() => {
        setSearchHistory(loadSearchHistory());
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  /**
   * 防抖搜索处理函数
   * 输入变化时清除旧定时器，设置300ms新定时器，到期后触发搜索
   * @param value - 输入框的最新值
   */
  const handleDebouncedSearch = useCallback((value: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, DEBOUNCE_DELAY);
  }, [setSearchQuery]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  /**
   * 输入框变化事件处理
   * 立即更新本地显示值，通过防抖延迟触发实际搜索
   * @param e - 输入事件对象
   */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    handleDebouncedSearch(value);
  }, [handleDebouncedSearch]);

  /**
   * 点击搜索结果的处理函数
   * 选中节点、派发定位事件、保存搜索历史、关闭面板
   * @param result - 搜索结果项，包含nodeId和matches
   */
  const handleResultClick = useCallback((result: { nodeId: string; matches: string[] }) => {
    selectNode(result.nodeId);
    onNodeSelect(result.nodeId);
    window.dispatchEvent(new CustomEvent('focus-node', { detail: { nodeId: result.nodeId } }));

    if (searchQuery.trim() && searchResults.length > 0) {
      saveSearchHistory(searchQuery.trim());
    }

    onClose();
    setSearchQuery('');
  }, [selectNode, onNodeSelect, searchQuery, searchResults, onClose, setSearchQuery]);

  /**
   * 点击历史记录项的处理函数
   * 直接使用历史关键词进行搜索
   * @param query - 历史搜索关键词
   */
  const handleHistoryClick = useCallback((query: string) => {
    setSearchQuery(query);
    if (inputRef.current) {
      inputRef.current.value = query;
      inputRef.current.focus();
    }
  }, [setSearchQuery]);

  /**
   * 删除历史记录项的处理函数
   * 从localStorage中移除指定项并更新本地状态
   * @param query - 要删除的历史关键词
   * @param e - 鼠标事件对象，用于阻止事件冒泡
   */
  const handleDeleteHistory = useCallback((query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = removeSearchHistoryItem(query);
    setSearchHistory(updatedHistory);
  }, []);

  if (!isOpen) return null;

  const showSearchHistory = searchQuery.trim() === '' && searchHistory.length > 0;

  const panelContent = (
    <>
      <div className={`flex items-center gap-3 px-6 py-4 border-b border-dark-700 ${isMobile ? 'h-14' : ''}`}>
        <Search className="w-5 h-5 text-dark-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          defaultValue={searchQuery}
          onChange={handleInputChange}
          placeholder={t('searchPlaceholder')}
          className="flex-1 bg-transparent text-white placeholder-dark-400 focus:outline-none text-base"
        />
        <button
          onClick={onClose}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className={`overflow-y-auto ${isMobile ? 'flex-1' : 'max-h-96'}`}>
        {showSearchHistory ? (
          <div className="divide-y divide-dark-700">
            <div className="px-6 py-2 text-xs text-dark-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span>{t('searchHistory')}</span>
            </div>
            {searchHistory.map((query) => (
              <button
                key={query}
                onClick={() => handleHistoryClick(query)}
                className="w-full px-6 py-3 text-left hover:bg-dark-700 transition-colors flex items-center justify-between group"
              >
                <span className="text-dark-300 truncate flex-1">{query}</span>
                <button
                  onClick={(e) => handleDeleteHistory(query, e)}
                  className="p-1 text-dark-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))}
          </div>
        ) : searchQuery.trim() === '' ? (
          <div className="px-6 py-8 text-center text-dark-400">
            <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>{t('enterKeywordsToSearch')}</p>
            <p className="text-sm mt-1">{t('searchSupportHint')}</p>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="px-6 py-8 text-center text-dark-400">
            <p>{t('noResultsFound')}</p>
            <p className="text-sm mt-1">{t('tryDifferentKeywords')}</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {searchResults.map((result) => {
              const node = nodes.get(result.nodeId);
              if (!node) return null;

              return (
                <button
                  key={result.nodeId}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-6 py-4 text-left hover:bg-dark-700 transition-colors min-h-[60px]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-medium truncate">
                        {highlightText(node.title, searchQuery)}
                      </h3>
                      <div className="mt-2 space-y-1">
                        {result.matches.slice(0, 3).map((match, idx) => (
                          <p key={idx} className="text-sm text-dark-400 truncate">
                            {highlightText(match, searchQuery)}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-dark-400 flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                      <span className="text-xs">{t('locate')}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 py-3 border-t border-dark-700 bg-dark-900">
        <p className="text-xs text-dark-400">
          {t('resultsFound', { count: searchResults.length })}{!isMobile && ` • ${t('pressEscToClose')}`}
        </p>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col">
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl mx-4 bg-dark-800 rounded-2xl shadow-2xl overflow-hidden">
        {panelContent}
      </div>
    </div>
  );
};

export default SearchPanel;
