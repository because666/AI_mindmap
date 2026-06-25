import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileText, Users, Briefcase, X } from 'lucide-react';
import { searchApi } from '../../services/api';

/** 页面搜索结果项接口 */
interface PageSearchItem {
  /** 页面名称 */
  label: string;
  /** 页面路由路径 */
  path: string;
}

/** 用户搜索结果项接口 */
interface UserSearchItem {
  /** 用户唯一标识 */
  id: string;
  /** 用户昵称 */
  nickname: string;
  /** 用户邮箱 */
  email: string;
}

/** 工作区搜索结果项接口 */
interface WorkspaceSearchItem {
  /** 工作区唯一标识 */
  id: string;
  /** 工作区名称 */
  name: string;
}

/** 搜索结果聚合接口 */
interface SearchResult {
  /** 匹配的页面列表 */
  pages: PageSearchItem[];
  /** 匹配的用户列表 */
  users: UserSearchItem[];
  /** 匹配的工作区列表 */
  workspaces: WorkspaceSearchItem[];
}

/** 搜索结果项联合类型，用于统一渲染 */
type ResultItem =
  | { type: 'page'; data: PageSearchItem }
  | { type: 'user'; data: UserSearchItem }
  | { type: 'workspace'; data: WorkspaceSearchItem };

/** 硬编码的页面列表，用于本地搜索匹配 */
const PAGE_LIST: PageSearchItem[] = [
  { label: '数据大盘', path: '/' },
  { label: '用户管理', path: '/users' },
  { label: '工作区管理', path: '/workspaces' },
  { label: '对话审计', path: '/chat-audit' },
  { label: '蜜罐日志', path: '/honeypot' },
  { label: 'IP封禁', path: '/ip-bans' },
  { label: '反馈管理', path: '/feedbacks' },
  { label: '消息推送', path: '/push' },
  { label: 'AI用量', path: '/ai-usage' },
  { label: '审计日志', path: '/audit-logs' },
  { label: '导出中心', path: '/export-center' },
  { label: '管理员', path: '/admin-accounts' },
  { label: '用户分群', path: '/user-segments' },
  { label: '公告管理', path: '/push' },
  { label: '系统设置', path: '/settings' },
];

/** 每组最多显示的结果数量 */
const MAX_ITEMS_PER_GROUP = 5;

/** 防抖延迟时间（毫秒） */
const DEBOUNCE_MS = 300;

/**
 * 全局搜索组件
 * 通过 Ctrl+K / Cmd+K 快捷键唤起搜索面板
 * 支持搜索页面名称、用户昵称、工作区名称
 * 搜索结果按类型分组显示，每组最多5条
 * 点击外部或按 Esc 关闭面板
 */
const GlobalSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({ pages: [], users: [], workspaces: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  /**
   * 执行搜索逻辑
   * 本地匹配页面名称，远程查询用户和工作区
   * @param searchQuery - 搜索关键词
   */
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults({ pages: [], users: [], workspaces: [] });
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const matchedPages = PAGE_LIST.filter((page) =>
      page.label.toLowerCase().includes(lowerQuery)
    ).slice(0, MAX_ITEMS_PER_GROUP);

    try {
      setIsSearching(true);
      const response = await searchApi.search(searchQuery);
      const remoteData = response.data?.data;
      setResults({
        pages: matchedPages,
        users: (remoteData?.users ?? []).slice(0, MAX_ITEMS_PER_GROUP),
        workspaces: (remoteData?.workspaces ?? []).slice(0, MAX_ITEMS_PER_GROUP),
      });
    } catch (error) {
      console.error('搜索请求失败:', error);
      setResults({
        pages: matchedPages,
        users: [],
        workspaces: [],
      });
    } finally {
      setIsSearching(false);
    }
  }, []);

  /**
   * 监听搜索词变化，防抖300ms后执行搜索
   */
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      performSearch(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, performSearch]);

  /**
   * 监听全局键盘事件
   * Ctrl+K / Cmd+K 打开搜索面板
   * Esc 关闭搜索面板
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  /**
   * 打开面板时自动聚焦输入框
   * 关闭面板时重置状态
   */
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults({ pages: [], users: [], workspaces: [] });
      setActiveIndex(-1);
    }
  }, [isOpen]);

  /**
   * 点击面板外部区域关闭搜索面板
   */
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /**
   * 构建扁平化的搜索结果列表，用于键盘导航
   * @returns ResultItem[] 扁平化的结果列表
   */
  const getFlatResults = useCallback((): ResultItem[] => {
    const flat: ResultItem[] = [];
    for (const page of results.pages) {
      flat.push({ type: 'page', data: page });
    }
    for (const user of results.users) {
      flat.push({ type: 'user', data: user });
    }
    for (const workspace of results.workspaces) {
      flat.push({ type: 'workspace', data: workspace });
    }
    return flat;
  }, [results]);

  /**
   * 处理搜索结果项点击，跳转到对应页面
   * @param item - 搜索结果项
   */
  const handleSelect = useCallback((item: ResultItem) => {
    setIsOpen(false);
    if (item.type === 'page') {
      navigate(item.data.path);
    } else if (item.type === 'user') {
      navigate(`/users?search=${encodeURIComponent(item.data.nickname)}`);
    } else if (item.type === 'workspace') {
      navigate(`/workspaces?search=${encodeURIComponent(item.data.name)}`);
    }
  }, [navigate]);

  /**
   * 处理输入框键盘事件
   * 上下箭头导航结果列表，回车选中当前项
   */
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const flatResults = getFlatResults();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0 && activeIndex < flatResults.length) {
      e.preventDefault();
      handleSelect(flatResults[activeIndex]);
    }
  };

  /** 计算扁平化结果列表 */
  const flatResults = getFlatResults();
  /** 是否有搜索结果 */
  const hasResults = results.pages.length > 0 || results.users.length > 0 || results.workspaces.length > 0;
  /** 当前活跃项的全局索引偏移量计算辅助 */
  let globalIdx = -1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
      {/* 搜索面板 */}
      <div
        ref={panelRef}
        className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
      >
        {/* 搜索输入区域 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            placeholder="搜索页面、用户、工作区..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleInputKeyDown}
          />
          {isSearching && (
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 搜索结果区域 */}
        <div className="max-h-80 overflow-y-auto">
          {query.trim() && !hasResults && !isSearching && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              未找到匹配结果
            </div>
          )}

          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              输入关键词开始搜索
            </div>
          )}

          {/* 页面分组 */}
          {results.pages.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                页面
              </div>
              {results.pages.map((page) => {
                globalIdx++;
                const idx = globalIdx;
                return (
                  <button
                    key={page.path}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      activeIndex === idx
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelect({ type: 'page', data: page })}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{page.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 用户分组 */}
          {results.users.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                用户
              </div>
              {results.users.map((user) => {
                globalIdx++;
                const idx = globalIdx;
                return (
                  <button
                    key={user.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      activeIndex === idx
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelect({ type: 'user', data: user })}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <Users className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{user.nickname}</span>
                    <span className="text-xs text-gray-400 ml-auto">{user.email}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 工作区分组 */}
          {results.workspaces.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-medium text-gray-500 bg-gray-50">
                工作区
              </div>
              {results.workspaces.map((workspace) => {
                globalIdx++;
                const idx = globalIdx;
                return (
                  <button
                    key={workspace.id}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                      activeIndex === idx
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => handleSelect({ type: 'workspace', data: workspace })}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <Briefcase className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{workspace.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          <span>↑↓ 导航 · Enter 选择 · Esc 关闭</span>
          <span>Ctrl+K 切换</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
