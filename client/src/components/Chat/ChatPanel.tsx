import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { Send, Loader2, Trash2, User, Bot, Sparkles, GitBranch, MessageSquare, Copy, Check, Plus, Brain, ChevronDown, ChevronUp, Paperclip, X, FileText, File, Image, RefreshCw, Lightbulb, AlertTriangle, Settings } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAPIConfigStore } from '../../stores/apiConfigStore';
import { useChatStore } from '../../stores/chatStore';
import type { BranchEndCheckArgs } from '../../stores/chatStore';
import { useToastStore } from '../../stores/toastStore';
import { chatService } from '../../services/chatService';
import { fileApi, conversationApi, getLocalWorkspaceId, nodeApi } from '../../services/api';
import type { FileInfo, MessageData } from '../../services/api';
import {
  track,
  TRACK_EVENT_EXTENSION_DIRECTION_CLICK,
  TRACK_EVENT_SUMMARY_GENERATED,
  TRACK_EVENT_BRANCH_SUGGESTION_SHOWN,
  TRACK_EVENT_BRANCH_SUGGESTION_ACCEPTED,
  TRACK_EVENT_BRANCH_SUGGESTION_DISMISSED,
} from '../../services/tracker';
import useMobile from '../../hooks/useMobile';
import useIsMobile from '../../hooks/useIsMobile';
import { useFeatures } from '../../hooks/useFeatures';
import type { ConversationMessage, StreamEvent, ToolCall } from '../../types';
import { executeTools } from '../../services/toolExecutor';
import MarkdownRenderer from './MarkdownRenderer';
import MindMapThumbnail from './MindMapThumbnail';
import ConfirmDialog from '../Common/ConfirmDialog';
import ExtensionDirectionButtons from './ExtensionDirectionButtons';
import { MODEL_CONTEXT_WINDOWS, estimateTokens } from '../../constants/modelContext';
import { parseExtensionDirections } from '../../utils/extensionDirections';
import { detectBranchSuggestion } from '../../utils/branchSuggestion';
import type { BranchSuggestionResult, RecentMessage } from '../../utils/branchSuggestion';

interface ChatPanelProps {
  nodeId?: string | null;
}


/**
 * 消息内容组件
 * 用于渲染单条消息，支持 Markdown 格式
 * 移动端支持长按触发复制操作
 */
const MessageContent: React.FC<{
  content: string;
  role: 'user' | 'assistant' | 'system';
}> = ({ content, role }) => {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation('chat');

  /**
   * 复制消息内容到剪贴板
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      useToastStore.getState().addToast('success', t('copiedToClipboard'));
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  /**
   * 长按复制处理
   * 移动端长按500ms后触发复制操作
   * @param text - 需要复制的文本内容
   */
  const handleLongPress = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      useToastStore.getState().addToast('success', t('copiedToClipboard'));
      setTimeout(() => setCopied(false), 2000);
    }).catch((err: unknown) => {
      console.error('长按复制失败:', err);
    });
  };

  /**
   * 触摸开始事件处理
   * 设置500ms定时器，超时后触发长按复制
   * @param e - 触摸事件对象
   * @param text - 需要复制的文本内容
   */
  const handleTouchStart = (e: React.TouchEvent, text: string) => {
    const timer = setTimeout(() => {
      handleLongPress(text);
    }, 500);
    (e.target as HTMLElement).setAttribute('data-long-press-timer', String(timer));
  };

  /**
   * 触摸结束事件处理
   * 清除长按定时器，防止误触发
   * @param e - 触摸事件对象
   */
  const handleTouchEnd = (e: React.TouchEvent) => {
    const timer = (e.target as HTMLElement).getAttribute('data-long-press-timer');
    if (timer) {
      clearTimeout(Number(timer));
    }
  };

  if (role === 'user') {
    return (
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</p>
    );
  }

  return (
    <div className="relative group">
      <MarkdownRenderer content={content} />
      <button
        onClick={handleCopy}
        onTouchStart={(e) => handleTouchStart(e, content)}
        onTouchEnd={handleTouchEnd}
        className="absolute top-0 right-0 p-1 opacity-70 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-dark-600 rounded-xl text-dark-400 hover:text-white"
        title={t('copyContent')}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

/**
 * 流式消息组件
 * 流式阶段使用纯文本渲染以降低开销，流式结束后切换为Markdown渲染
 * @param content - 消息内容文本
 * @param isStreaming - 是否处于流式生成阶段
 */
const StreamingMessage: React.FC<{
  content: string;
  isStreaming: boolean;
}> = ({ content, isStreaming }) => {
  if (isStreaming) {
    return (
      <div className="relative group">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</p>
        <span className="inline-block w-2 h-4 bg-primary-400 animate-pulse ml-0.5" />
      </div>
    );
  }
  return (
    <div className="relative group">
      <MarkdownRenderer content={content} />
    </div>
  );
};

/**
 * 思考过程展示组件
 * 用于展示AI的推理和思考过程
 */
const ThinkingProcess: React.FC<{
  content: string;
  isStreaming?: boolean;
}> = ({ content, isStreaming = false }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { t } = useTranslation('chat');

  if (!content) return null;

  return (
    <div className="mb-3 border border-dark-600 rounded-2xl bg-dark-800/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-dark-300 hover:text-primary-400 hover:bg-dark-700/50 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-primary-400" />
        <span>{t('thinkingProcess')}</span>
        {isStreaming && (
          <span className="flex gap-1 ml-1">
            <span className="w-1 h-1 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1 h-1 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1 h-1 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </span>
        )}
        <div className="flex-1" />
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 text-xs text-dark-400 leading-relaxed whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
          {content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-primary-400/60 animate-pulse ml-0.5" />
          )}
        </div>
      )}
    </div>
  );
};

/**
 * 上下文使用量指示器组件
 * 在对话面板顶部显示上下文Token使用量的细进度条
 * 颜色根据使用比例变化：<50% emerald，50-80% amber，>80% red
 */
const ContextUsageIndicator: React.FC<{
  used: number;
  limit: number;
}> = ({ used, limit }) => {
  const percentage = Math.min(100, Math.round((used / limit) * 100));
  const { t } = useTranslation('chat');
  const barColor = percentage < 50
    ? 'bg-emerald-400'
    : percentage <= 80
      ? 'bg-amber-400'
      : 'bg-red-400';

  return (
    <div className="mt-1.5" title={t('contextUsage', { used, limit })}>
      <div className="h-1 w-full bg-dark-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * 限流引导提示组件
 * 当内置Key被限流时，引导用户配置自己的API Key
 * 自动5秒后关闭，也可手动关闭
 */
const RateLimitGuide: React.FC<{
  onClose: () => void;
  onGoToConfig: () => void;
}> = ({ onClose, onGoToConfig }) => {
  const [visible, setVisible] = useState(true);
  const { t } = useTranslation('chat');

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 bg-amber-900/30 border border-amber-500/30 rounded-2xl transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
      <span className="text-sm text-amber-200 flex-1">
        {t('rateLimitGuide')}
      </span>
      <button
        onClick={onGoToConfig}
        className="flex items-center gap-1 px-3 py-1 bg-amber-600/30 hover:bg-amber-600/50 border border-amber-500/40 text-amber-300 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
      >
        <Settings className="w-3 h-3" />
        {t('goToConfig')}
      </button>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
        className="p-1 text-amber-500 hover:text-amber-300 transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/**
 * 支线结束摘要提示横幅组件
 * 当 chatStore 检测到支线可能已结束时显示，引导用户生成摘要回到主线
 * 用户可点击"立即生成"触发摘要生成，或点击"忽略"关闭提示
 */
const SummaryPromptBanner: React.FC<{
  nodeTitle: string;
  onGenerate: () => void;
  onIgnore: () => void;
}> = ({ nodeTitle, onGenerate, onIgnore }) => {
  const { t } = useTranslation('chat');
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-emerald-900/30 border border-emerald-500/30 rounded-2xl">
      <FileText className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-emerald-200">{t('summaryPromptTitle')}</p>
        <p className="text-xs text-emerald-300/80 mt-0.5 break-words">
          {t('summaryPromptMessage', { title: nodeTitle })}
        </p>
      </div>
      <button
        onClick={onGenerate}
        className="flex items-center gap-1 px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
      >
        <Sparkles className="w-3 h-3" />
        <span>{t('generateNow')}</span>
      </button>
      <button
        onClick={onIgnore}
        className="px-2 py-1 text-emerald-500 hover:text-emerald-300 text-xs transition-colors flex-shrink-0"
      >
        {t('ignore')}
      </button>
    </div>
  );
};

/**
 * 聊天面板组件 - 支持分支隔离上下文和流式传输
 * 包含快捷创建分支按钮，优化移动端操作体验
 */
const ChatPanel: React.FC<ChatPanelProps> = ({ nodeId }) => {
  const {
    nodes,
    relations,
    conversations,
    addConversation,
    addMessage,
    clearConversation,
    getConversationContext,
    createChildNode,
    createConclusionNode,
    selectNode,
    requestOpenChat,
    updateNode,
    isNodeManuallyTitled,
  } = useAppStore();
  const { t } = useTranslation('chat');
  const { keepAwake, allowSleep, haptic } = useMobile();
  const isMobile = useIsMobile();
  const { isVisible: isFeatureVisible } = useFeatures();
  /** 支线结束摘要提示信息（来自 chatStore 的支线结束检测器） */
  const showSummaryPrompt = useChatStore((s) => s.showSummaryPrompt);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingThinkingContent, setStreamingThinkingContent] = useState<string>('');
  const [branchCreating, setBranchCreating] = useState(false);
  const [extensionLoadingDirection, setExtensionLoadingDirection] = useState<string | null>(null);
  const [hasBuiltInKey, setHasBuiltInKey] = useState(false);
  /** 待自动发送的延伸方向追问（节点切换后通过 effect 触发发送） */
  const pendingExtensionSendRef = useRef<{ targetNodeId: string; direction: string } | null>(null);
  /** 分叉提示检测结果，null 表示当前不展示提示 */
  const [branchSuggestion, setBranchSuggestion] = useState<BranchSuggestionResult | null>(null);
  /**
   * 最近被忽略的分叉提示标识
   * 用于避免同一输入内容反复弹出相同提示；输入变化或发送消息后会重置
   */
  const dismissedSuggestionRef = useRef<{ inputHash: string; suggestionKey: string } | null>(null);
  /** 分叉检测防抖计时器引用 */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 待自动发送到分叉子节点的问题（节点切换后通过 effect 触发发送） */
  const pendingBranchQuestionSendRef = useRef<{ targetNodeId: string; question: string } | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<FileInfo[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isExtractingConclusion, setIsExtractingConclusion] = useState(false);
  /** 是否正在生成节点摘要 */
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showRateLimitGuide, setShowRateLimitGuide] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleGenerationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conclusionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoGeneratedTitleRef = useRef<string>('');
  const streamBufferRef = useRef<string>('');
  const displayedContentRef = useRef<string>('');
  const thinkingBufferRef = useRef<string>('');
  const displayedThinkingRef = useRef<string>('');
  const animationFrameRef = useRef<number>(0);
  /** 当前正在执行的工具调用列表 */
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  /** 工具执行结果列表（用于 UI 展示） */
  const [toolResults, setToolResults] = useState<Array<{ name: string; success: boolean; message: string }>>([]);

  /**
   * 快捷提问建议列表
   * 与思维导图场景相关，引导用户快速开始对话
   */
  const quickSuggestions = [
    t('analyzeKeyConcepts'),
    t('expandSubTopics'),
    t('summarizeCorePoints'),
    t('suggestRelatedDirections'),
  ];

  const node = nodeId ? nodes.get(nodeId) : null;
  const conversation = node?.conversationId ? conversations.get(node.conversationId) : null;
  /**
   * 当前对话消息列表
   * 使用 useMemo 稳定数组引用，避免作为依赖时触发频繁的 effect/callback 重运行
   */
  const messages = useMemo(() => conversation?.messages || [], [conversation?.messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingThinkingContent]);

  useEffect(() => {
    if (nodeId && !isMobile && textareaRef.current) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nodeId, isMobile]);

  /**
   * 节点切换时清理支线结束检测定时器
   * 避免上一个节点的定时器在当前节点触发误提示
   */
  useEffect(() => {
    useChatStore.getState().clearBranchEndDetector();
  }, [nodeId]);

  /**
   * 处理延伸方向自动追问
   * 用户点击延伸方向按钮后，会先创建子节点并切换过去；当 nodeId 变为目标节点时，
   * 自动向新节点发送生成的追问。使用 ref 存储待发送信息，避免将 sendMessage 加入依赖数组。
   */
  useEffect(() => {
    if (pendingExtensionSendRef.current && pendingExtensionSendRef.current.targetNodeId === nodeId) {
      const { direction } = pendingExtensionSendRef.current;
      pendingExtensionSendRef.current = null;
      const prompt = t('exploreDirectionPrompt', { direction });
      sendMessage(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, t]);

  /**
   * 处理分叉提示"创建分支"后的自动发送
   * 用户点击"创建分支"后，会先创建子节点并切换过去；当 nodeId 变为目标节点时，
   * 自动向新节点发送用户原本在输入框中输入的问题。使用 ref 存储待发送信息。
   */
  useEffect(() => {
    if (pendingBranchQuestionSendRef.current && pendingBranchQuestionSendRef.current.targetNodeId === nodeId) {
      const { question } = pendingBranchQuestionSendRef.current;
      pendingBranchQuestionSendRef.current = null;
      sendMessage(question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);

  /**
   * 分叉提示展示时上报埋点
   * 当 branchSuggestion 从 null 变为非 null 时，上报 branch_suggestion_shown 事件
   * 载荷：nodeId、suggestionText、triggerRule
   * 埋点上报失败时静默处理，不阻塞 UI
   */
  useEffect(() => {
    if (branchSuggestion && nodeId) {
      try {
        track(TRACK_EVENT_BRANCH_SUGGESTION_SHOWN, {
          nodeId,
          suggestionText: branchSuggestion.suggestionText,
          triggerRule: branchSuggestion.triggerRule,
          workspaceId: getLocalWorkspaceId() || '',
        });
      } catch {
        // 埋点上报异常静默处理，不阻塞主流程
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchSuggestion]);

  /**
   * 节点切换时重置分叉提示状态
   * 清除当前展示的提示和最近忽略记录，让用户在新节点可以正常收到提示
   * 同时清理防抖计时器，避免切换节点后触发旧节点的检测
   */
  useEffect(() => {
    setBranchSuggestion(null);
    dismissedSuggestionRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, [nodeId]);

  useEffect(() => {
    if (isLoading || streamingContent) {
      keepAwake();
    } else {
      allowSleep();
    }
  }, [isLoading, streamingContent, keepAwake, allowSleep]);

  useEffect(() => {
    return () => {
      if (titleGenerationTimerRef.current) {
        clearTimeout(titleGenerationTimerRef.current);
      }
      if (conclusionTimerRef.current) {
        clearTimeout(conclusionTimerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // 清理分叉检测防抖计时器，避免内存泄漏
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // 组件卸载时清理支线结束检测定时器，避免内存泄漏
      useChatStore.getState().clearBranchEndDetector();
    };
  }, []);

  useEffect(() => {
    const fetchStatus = async () => {
      const result = await chatService.getStatus();
      if (result.success) {
        setHasBuiltInKey(result.hasBuiltInKey || false);
      }
    };
    fetchStatus();
  }, []);

  /**
   * 加载工作区文件列表
   */
  const loadWorkspaceFiles = useCallback(async () => {
    try {
      const result = await fileApi.list() as unknown as { success: boolean; data: FileInfo[] };
      if (result.success && result.data) {
        setWorkspaceFiles(result.data);
      }
    } catch {
      // 静默处理
    }
  }, []);

  useEffect(() => {
    loadWorkspaceFiles();
  }, [loadWorkspaceFiles]);

  /**
   * 处理文件选择上传
   */
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const result = await fileApi.upload(Array.from(files)) as unknown as {
        success: boolean;
        data: {
          uploaded: Array<{ id: string; originalName: string; size: number; mimeType: string }>;
          errors: Array<{ filename: string; error: string }>;
        };
      };
      if (result.success && result.data) {
        const { uploaded, errors } = result.data;
        if (errors.length > 0) {
          setError(errors.map(e => `${e.filename}: ${e.error}`).join('; '));
        }
        const newFileIds = uploaded.map(f => f.id);
        setSelectedFileIds(prev => [...prev, ...newFileIds]);
        await loadWorkspaceFiles();
      }
    } catch {
      setError(t('fileUploadFailed'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  /**
   * 切换文件选中状态
   */
  const toggleFileSelection = (fileId: string) => {
    setSelectedFileIds(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  /**
   * 移除已选文件
   */
  const removeSelectedFile = (fileId: string) => {
    setSelectedFileIds(prev => prev.filter(id => id !== fileId));
  };

  /**
   * 删除工作区文件
   */
  const handleDeleteFile = async (fileId: string) => {
    try {
      await fileApi.delete(fileId);
      setSelectedFileIds(prev => prev.filter(id => id !== fileId));
      await loadWorkspaceFiles();
    } catch {
      setError(t('deleteFileFailed'));
    }
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  /**
   * 获取文件图标
   */
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="w-3.5 h-3.5" />;
    if (mimeType === 'application/pdf') return <FileText className="w-3.5 h-3.5 text-red-400" />;
    return <File className="w-3.5 h-3.5" />;
  };

  /**
   * 获取上下文信息
   */
  const contextInfo = useMemo(() => {
    if (!nodeId || !node) return { parentCount: 0, relationCount: 0 };
    
    const parentCount = node.parentIds.length;
    const context = getConversationContext(nodeId);
    const nodeIds = new Set<string>();
    context.forEach(msg => {
      const match = msg.content.match(/\[节点: (.+)\]/);
      if (match) nodeIds.add(match[1]);
    });
    
    return {
      parentCount,
      relationCount: Math.max(0, nodeIds.size - 1)
    };
  }, [nodeId, node, getConversationContext]);

  /**
   * 计算上下文Token使用量
   * 根据当前对话上下文消息估算已使用的Token数和模型上下文窗口限制
   * @returns 上下文使用信息，包含已用Token数和限制Token数；无对话时返回null
   */
  const contextUsage = useMemo(() => {
    if (!nodeId || messages.length === 0) return null;

    const activeConfig = useAPIConfigStore.getState().getActiveConfig();
    const model = activeConfig?.modelId || 'default';
    const limit = MODEL_CONTEXT_WINDOWS[model] || MODEL_CONTEXT_WINDOWS['default'];

    const contextMessages = getConversationContext(nodeId);
    const used = contextMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    return { used, limit };
  }, [nodeId, messages, getConversationContext]);

  /**
   * 获取工具操作的中文标签
   * @param toolName - 工具名称
   * @returns 操作标签
   */
  const getToolActionLabel = (toolName: string): string => {
    const labels: Record<string, string> = {
      create_node: '创建节点',
      create_relation: '创建关系',
      update_node: '编辑节点',
      expand_node: '扩展节点',
      get_mindmap_context: '获取导图结构',
      get_node_detail: '获取节点详情',
    };
    return labels[toolName] || toolName;
  };

  /**
   * 获取工具操作的详细描述
   * @param toolName - 工具名称
   * @returns 工具描述
   */
  const getToolDescription = (toolName: string): string => {
    const descriptions: Record<string, string> = {
      create_node: '正在思维导图中添加新节点',
      create_relation: '正在建立节点之间的关联',
      update_node: '正在修改节点内容',
      expand_node: '正在生成子主题并布局',
      get_mindmap_context: '正在分析导图结构',
      get_node_detail: '正在读取节点详细信息',
    };
    return descriptions[toolName] || '正在执行操作';
  };

  /**
   * 将缓冲区内容逐字符刷新到显示状态
   * 使用 requestAnimationFrame 节流，每帧最多追加一定数量的字符
   * 实现平滑的打字机效果
   */
  const flushBufferToDisplay = useCallback(() => {
    const contentBuffer = streamBufferRef.current;
    const thinkingBuffer = thinkingBufferRef.current;
    let needsUpdate = false;

    if (contentBuffer) {
      const charsToFlush = Math.min(contentBuffer.length, 3);
      const flushed = contentBuffer.slice(0, charsToFlush);
      const remaining = contentBuffer.slice(charsToFlush);
      streamBufferRef.current = remaining;
      displayedContentRef.current += flushed;
      needsUpdate = true;
    }

    if (thinkingBuffer) {
      const charsToFlush = Math.min(thinkingBuffer.length, 5);
      const flushed = thinkingBuffer.slice(0, charsToFlush);
      const remaining = thinkingBuffer.slice(charsToFlush);
      thinkingBufferRef.current = remaining;
      displayedThinkingRef.current += flushed;
      needsUpdate = true;
    }

    if (needsUpdate) {
      setStreamingContent(displayedContentRef.current);
      setStreamingThinkingContent(displayedThinkingRef.current);
    }

    if (streamBufferRef.current || thinkingBufferRef.current) {
      animationFrameRef.current = requestAnimationFrame(flushBufferToDisplay);
    }
  }, []);

  /**
   * 发送消息内部方法（流式传输）- 客户端驱动模式
   * 包含完整的发送逻辑：前置校验（apiKey、nodeId）、状态重置、上下文构建、
   * 流式处理（handleStream 回调）、工具调用循环（MAX_TOOL_CALL_ROUNDS=5）、
   * 清理逻辑、标题自动生成、错误处理、限流引导
   * 当 AI 返回工具调用时，客户端执行工具后主动发起新的流式请求
   * 循环直到 AI 不再返回工具调用或达到最大轮次
   * @param userMessage - 已 trim 的用户消息内容，为空则直接返回
   * @returns 无返回值，所有结果通过状态更新体现
   */
  const sendMessage = async (userMessage: string) => {
    if (!userMessage || isLoading) return;
    haptic('light');

    const activeConfig = useAPIConfigStore.getState().getActiveConfig();
    if (!activeConfig?.apiKey && !hasBuiltInKey) {
      setError(t('configureApiKeyFirst'));
      return;
    }

    if (!nodeId) {
      setError(t('selectNodeFirst'));
      return;
    }

    setInput('');
    setError(null);
    setStreamingContent('');
    setStreamingThinkingContent('');
    streamBufferRef.current = '';
    displayedContentRef.current = '';
    thinkingBufferRef.current = '';
    displayedThinkingRef.current = '';
    // 重置工具调用状态
    setActiveToolCalls([]);
    setToolResults([]);

    if (titleGenerationTimerRef.current) {
      clearTimeout(titleGenerationTimerRef.current);
      titleGenerationTimerRef.current = null;
    }

    let convId = node?.conversationId;
    if (!convId) {
      convId = addConversation(nodeId);
    }

    setIsLoading(true);

    const contextMessages = getConversationContext(nodeId);

    addMessage(convId, { role: 'user', content: userMessage });

    // 用户活跃：重置支线结束检测定时器（3 分钟无新消息后再次检测）
    // 流式响应期间不触发检测，仅在定时器到期后才检查
    try {
      const userActiveNode = useAppStore.getState().nodes.get(nodeId);
      const userActiveConv = userActiveNode?.conversationId
        ? useAppStore.getState().conversations.get(userActiveNode.conversationId)
        : null;
      if (userActiveNode && userActiveConv) {
        const userActiveArgs: BranchEndCheckArgs = {
          nodeId,
          messages: userActiveConv.messages,
          nodeTitle: userActiveNode.title,
          isRoot: userActiveNode.isRoot
        };
        useChatStore.getState().resetBranchEndTimer(userActiveArgs);
      }
    } catch (error) {
      console.error('[ChatPanel] 重置支线结束定时器失败:', error);
    }

    const allMessages = [
      ...contextMessages,
      { role: 'user' as const, content: userMessage }
    ];

    if (selectedFileIds.length > 0) {
      const fileContextParts = selectedFileIds.map(fileId => {
        const f = workspaceFiles.find(wf => wf.id === fileId);
        return f ? f.originalName : '';
      }).filter(Boolean);

      if (fileContextParts.length > 0) {
        allMessages.push({
          role: 'system' as const,
          content: t('fileReferenced', { files: fileContextParts.join(', ') })
        });
      }
    }

    /**
     * 流式回调函数（同步，仅处理内容/思考/错误事件）
     * 工具调用不再在回调中执行，由外部循环控制
     */
    const handleStream = (event: StreamEvent) => {
      if (event.type === 'content' && event.content) {
        streamBufferRef.current += event.content;
        if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(flushBufferToDisplay);
        }
      } else if (event.type === 'thinking' && event.thinkingContent) {
        thinkingBufferRef.current += event.thinkingContent;
        if (!animationFrameRef.current) {
          animationFrameRef.current = requestAnimationFrame(flushBufferToDisplay);
        }
      } else if (event.type === 'error') {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
        streamBufferRef.current = '';
        displayedContentRef.current = '';
        thinkingBufferRef.current = '';
        displayedThinkingRef.current = '';
        setError(event.error || t('sendMessageFailed'));
        setStreamingContent('');
        setStreamingThinkingContent('');
      }
    };

    // 客户端驱动的工具调用循环
    const MAX_TOOL_CALL_ROUNDS = 5;
    let toolCallRound = 0;
    const currentMessages: ConversationMessage[] = [...allMessages];
    let finalContent = '';
    let hasError = false;

    while (toolCallRound < MAX_TOOL_CALL_ROUNDS) {
      // 重置流式缓冲区（每轮新请求前清空，但保留已显示的内容）
      streamBufferRef.current = '';
      displayedContentRef.current = '';
      thinkingBufferRef.current = '';
      displayedThinkingRef.current = '';
      setStreamingContent('');
      setStreamingThinkingContent('');

      const result = await chatService.sendMessageStream(currentMessages, handleStream, selectedFileIds.length > 0 ? selectedFileIds : undefined, {
        onRateLimited: () => {
          setShowRateLimitGuide(true);
        }
      }, nodeId || undefined);

      if (!result.success) {
        // 请求失败，退出循环
        if (result.sensitiveWords && result.sensitiveWords.length > 0) {
          setError(t('sensitiveContentDetected', { words: result.sensitiveWords.join('、') }));
        } else {
          setError(result.error || t('sendMessageFailed'));
        }
        hasError = true;
        break;
      }

      // 累积内容
      finalContent = result.content || '';

      // 检查是否有工具调用需要处理
      if (result.toolCalls && result.toolCalls.length > 0 && result.toolCallPending) {
        // 显示工具调用动画
        setActiveToolCalls(result.toolCalls);

        // 执行工具
        try {
          const toolExecutionResults = await executeTools(result.toolCalls);

          // 更新工具结果状态
          const resultDetails = result.toolCalls.map((tc, i) => {
            const execResult = toolExecutionResults[i];
            const parsedContent = execResult ? JSON.parse(execResult.content) as { success: boolean; message: string } : { success: false, message: '未知错误' };
            return {
              name: tc.name,
              success: parsedContent.success,
              message: parsedContent.message,
            };
          });
          setToolResults(resultDetails);
          setActiveToolCalls([]);

          // 将 assistant 消息（含 tool_calls）和 tool 结果加入消息历史
          currentMessages.push({
            role: 'assistant',
            content: result.content || '',
            tool_calls: result.toolCalls,
          });
          for (const tr of toolExecutionResults) {
            currentMessages.push({
              role: 'tool',
              content: tr.content,
              tool_call_id: tr.tool_call_id,
            });
          }
        } catch (error) {
          console.error('工具执行失败:', error);
          setActiveToolCalls([]);
          setToolResults(result.toolCalls.map(tc => ({
            name: tc.name,
            success: false,
            message: '工具执行异常',
          })));
          // 工具执行异常时退出循环
          break;
        }

        toolCallRound++;
      } else {
        // 没有工具调用，退出循环
        break;
      }
    }

    // 清理动画帧和缓冲区
    cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = 0;
    streamBufferRef.current = '';
    displayedContentRef.current = '';
    thinkingBufferRef.current = '';
    displayedThinkingRef.current = '';
    setIsLoading(false);
    setStreamingContent('');
    setStreamingThinkingContent('');
    setSelectedFileIds([]);
    // 重置工具调用状态
    setActiveToolCalls([]);
    setToolResults([]);

    if (!hasError && finalContent) {
      addMessage(convId, { role: 'assistant', content: finalContent });

      const currentConv = useAppStore.getState().conversations.get(convId);
      const userMsgCount = currentConv?.messages.filter((m) => m.role === 'user').length || 0;
      const assistantMsgCount = currentConv?.messages.filter((m) => m.role === 'assistant').length || 0;

      if (userMsgCount === 1 && assistantMsgCount === 1 && nodeId) {
        const currentNode = useAppStore.getState().nodes.get(nodeId);
        const isDefaultTitle = !currentNode?.title
          || currentNode.title.includes('...')
          || currentNode.title === t('newConversation')
          || currentNode.title === t('newBranch')
          || currentNode.title === autoGeneratedTitleRef.current;

        if (isDefaultTitle && !isNodeManuallyTitled(nodeId)) {
          titleGenerationTimerRef.current = setTimeout(() => {
            handleGenerateTitle();
          }, 5000);
        }
      }

      // 流式响应结束：检测支线结束条件（轮数/语义信号），并重置 3 分钟定时器
      // 仅在 AI 成功回复后检测，避免在错误或流式中误触发
      try {
        const branchEndNode = useAppStore.getState().nodes.get(nodeId);
        const branchEndConv = branchEndNode?.conversationId
          ? useAppStore.getState().conversations.get(branchEndNode.conversationId)
          : null;
        if (branchEndNode && branchEndConv) {
          const branchEndArgs: BranchEndCheckArgs = {
            nodeId,
            messages: branchEndConv.messages,
            nodeTitle: branchEndNode.title,
            isRoot: branchEndNode.isRoot
          };
          useChatStore.getState().checkBranchEnd(branchEndArgs);
          useChatStore.getState().resetBranchEndTimer(branchEndArgs);
        }
      } catch (error) {
        console.error('[ChatPanel] 检测支线结束失败:', error);
      }
    }
  };

  /**
   * 发送消息（流式传输）- 从输入框发送
   * 读取输入框内容，清空输入框，处理默认标题自动设置，然后调用 sendMessage 发送
   * 若当前有分叉提示展示，先上报 branch_suggestion_dismissed 埋点，再正常发送
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // 用户直接发送消息时，若有分叉提示展示，先上报 dismissed 埋点
    if (branchSuggestion && nodeId) {
      try {
        track(TRACK_EVENT_BRANCH_SUGGESTION_DISMISSED, {
          nodeId,
          suggestionText: branchSuggestion.suggestionText,
          workspaceId: getLocalWorkspaceId() || '',
        });
      } catch {
        // 埋点上报异常静默处理，不阻塞发送流程
      }
      setBranchSuggestion(null);
    }
    // 发送消息后重置忽略记录，允许下一条输入继续触发提示
    dismissedSuggestionRef.current = null;

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // 默认标题自动设置：当节点标题为默认值时，用用户消息前15字符作为临时标题
    const DEFAULT_TITLES = [t('newConversation'), t('newBranch')];
    if (nodeId && node && DEFAULT_TITLES.includes(node.title || '')) {
      const autoTitle = userMessage.length > 15
        ? userMessage.substring(0, 15) + '...'
        : userMessage;
      updateNode(nodeId, { title: autoTitle });
      autoGeneratedTitleRef.current = autoTitle;
    }

    await sendMessage(userMessage);
  };

  /**
   * 格式化消息时间戳
   * 当天显示 HH:MM，跨天显示 MM/DD HH:MM
   * @param timestamp - 消息时间戳，支持 Date 对象、时间戳数字或日期字符串
   * @returns 格式化后的时间字符串
   */
  const formatMessageTime = (timestamp: string | number | Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    if (isToday) {
      return `${hours}:${minutes}`;
    }
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  /**
   * 处理输入框内容变化
   * 基于 scrollHeight 自动调整输入框高度，最大 160px
   * 同时启动 500ms 防抖检测，命中分叉规则且当前节点未被忽略时显示提示气泡
   * @param e - 输入事件对象
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
    const newValue = target.value;
    setInput(newValue);

    // 输入清空时重置忽略记录，允许重新输入后正常提示
    if (newValue.trim() === '') {
      dismissedSuggestionRef.current = null;
    }

    // 防抖检测：500ms 后调用 detectBranchSuggestion
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      // 当前无节点，直接清除提示
      if (!nodeId) {
        setBranchSuggestion(null);
        return;
      }
      const currentNode = useAppStore.getState().nodes.get(nodeId);
      const currentNodeTitle = currentNode?.title || '';
      // 取最近 4 条消息作为最近消息历史
      const recentMessages: RecentMessage[] = messages
        .slice(-4)
        .map((msg) => ({ role: msg.role, content: msg.content }));
      try {
        const result = detectBranchSuggestion(newValue, currentNodeTitle, recentMessages);
        if (result && result.shouldSuggest) {
          const inputHash = newValue.trim();
          const suggestionKey = `${result.subTopic}|${result.triggerRule}`;
          const dismissed = dismissedSuggestionRef.current;
          // 仅当与最近忽略的提示为同一输入且同一子主题时才不展示，避免同一输入反复打扰
          if (dismissed && dismissed.inputHash === inputHash && dismissed.suggestionKey === suggestionKey) {
            setBranchSuggestion(null);
          } else {
            setBranchSuggestion(result);
          }
        } else {
          setBranchSuggestion(null);
        }
      } catch (error) {
        console.error('[ChatPanel] 分叉检测异常:', error);
        setBranchSuggestion(null);
      }
    }, 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setConfirmDialogOpen(true);
  };

  /**
   * 确认清空对话回调
   */
  const handleConfirmClear = () => {
    if (conversation?.id) {
      clearConversation(conversation.id);
      useToastStore.getState().addToast('success', t('conversationCleared'));
    }
    setConfirmDialogOpen(false);
  };

  /**
   * 取消清空对话回调
   */
  const handleCancelClear = () => {
    setConfirmDialogOpen(false);
  };

  /**
   * 使用指定文本发送消息
   * 从快捷建议等场景调用，复用 sendMessage 内部逻辑
   * @param text - 要发送的文本内容
   */
  const handleSendWithText = async (text: string) => {
    if (!text.trim() || isLoading) return;
    await sendMessage(text.trim());
  };

  /**
   * 快捷建议点击处理
   * 设置输入框内容并直接发送
   * @param text - 建议文本
   */
  const handleQuickSuggestion = (text: string) => {
    setInput(text);
    handleSendWithText(text);
  };

  /**
   * 快捷创建分支节点
   * 一键从当前节点创建子分支并自动选中，移动端优化核心功能
   */
  const handleCreateBranch = async () => {
    if (!nodeId || branchCreating) return;
    setBranchCreating(true);
    try {
      const childId = createChildNode(nodeId, t('newBranch'));
      if (childId) {
        selectNode(childId);
      }
    } catch (err) {
      console.error('创建分支失败:', err);
    } finally {
      setBranchCreating(false);
    }
  };

  /**
   * 处理用户点击延伸方向按钮
   * 在当前节点下创建以方向为标题的子节点，切换到该子节点，并自动发送追问
   * @param direction - 用户点击的延伸方向文本
   */
  const handleExtensionDirectionClick = async (direction: string) => {
    if (!nodeId || extensionLoadingDirection !== null) return;

    setExtensionLoadingDirection(direction);
    try {
      const childId = createChildNode(nodeId, direction);
      if (!childId) {
        useToastStore.getState().addToast('error', t('branchCreateFailed'));
        return;
      }
      selectNode(childId);
      try {
        track(TRACK_EVENT_EXTENSION_DIRECTION_CLICK, {
          nodeId,
          direction,
          childNodeId: childId,
          workspaceId: getLocalWorkspaceId() || '',
        });
      } catch {
        // 埋点上报失败时静默处理，不阻塞后续 UI 流程
      }
      pendingExtensionSendRef.current = { targetNodeId: childId, direction };
    } catch (err) {
      console.error('创建延伸分支失败:', err);
      useToastStore.getState().addToast('error', t('branchCreateFailed'));
    } finally {
      setExtensionLoadingDirection(null);
    }
  };

  /**
   * 处理用户点击分叉提示"创建分支"按钮
   * 在当前节点下创建以 subTopic 为标题的子节点，切换到该子节点，
   * 并将用户当前输入框的内容作为问题自动发送到子节点对话。
   * 创建子节点失败时静默处理（console.error），不阻塞用户操作。
   * 埋点上报失败时静默处理。
   */
  const handleBranchSuggestionAccept = async () => {
    if (!nodeId || !branchSuggestion) return;

    const subTopic = branchSuggestion.subTopic;
    const suggestionText = branchSuggestion.suggestionText;
    const userQuestion = input.trim();

    try {
      const childId = createChildNode(nodeId, subTopic);
      if (!childId) {
        console.error('[ChatPanel] 分叉提示创建分支失败：createChildNode 返回空');
        return;
      }
      // 上报 accepted 埋点
      try {
        track(TRACK_EVENT_BRANCH_SUGGESTION_ACCEPTED, {
          nodeId,
          childNodeId: childId,
          suggestionText,
          workspaceId: getLocalWorkspaceId() || '',
        });
      } catch {
        // 埋点上报异常静默处理
      }
      // 自动切换到子节点
      selectNode(childId);
      // 若用户有输入内容，作为问题发送到子节点对话
      if (userQuestion) {
        pendingBranchQuestionSendRef.current = { targetNodeId: childId, question: userQuestion };
      }
      // 清空输入框与提示，并重置忽略记录
      setInput('');
      dismissedSuggestionRef.current = null;
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      setBranchSuggestion(null);
    } catch (err) {
      console.error('[ChatPanel] 分叉提示创建分支异常:', err);
    }
  };

  /**
   * 处理用户点击分叉提示"忽略"按钮
   * 记录当前输入和提示标识，仅对同一输入的同一提示避免重复展示；
   * 用户修改输入或发送下一条消息后仍可触发新提示。
   * 同时上报 branch_suggestion_dismissed 埋点。埋点异常静默处理。
   */
  const handleBranchSuggestionDismiss = () => {
    if (!nodeId || !branchSuggestion) return;

    dismissedSuggestionRef.current = {
      inputHash: input.trim(),
      suggestionKey: `${branchSuggestion.subTopic}|${branchSuggestion.triggerRule}`,
    };
    try {
      track(TRACK_EVENT_BRANCH_SUGGESTION_DISMISSED, {
        nodeId,
        suggestionText: branchSuggestion.suggestionText,
        workspaceId: getLocalWorkspaceId() || '',
      });
    } catch {
      // 埋点上报异常静默处理
    }
    setBranchSuggestion(null);
  };

  /**
   * 生成智能标题（流式）
   * 根据当前对话消息调用AI流式生成精炼标题，更新节点标题
   * @param force - 是否强制生成（忽略手动修改标记）
   */
  const handleGenerateTitle = useCallback(async (force: boolean = false) => {
    if (!nodeId || isGeneratingTitle) return;

    if (!force && isNodeManuallyTitled(nodeId)) return;

    const currentState = useAppStore.getState();
    const currentNode = currentState.nodes.get(nodeId);
    if (!currentNode) return;

    const currentConversation = currentNode.conversationId
      ? currentState.conversations.get(currentNode.conversationId)
      : null;
    const currentMessages = currentConversation?.messages || [];

    if (currentMessages.length === 0) return;

    setIsGeneratingTitle(true);
    try {
      const titleMessages = currentMessages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
        .filter((msg) => msg.content.length > 0);

      const hasUserMessage = titleMessages.some((msg) => msg.role === 'user');
      const hasAssistantMessage = titleMessages.some((msg) => msg.role === 'assistant');
      if (!hasUserMessage || !hasAssistantMessage) {
        if (force) {
          useToastStore.getState().addToast('error', t('titleGenerationNeedsQA'));
        }
        return;
      }

      let parentNodeTitle: string | undefined;
      if (currentNode.parentIds.length > 0) {
        const parentNode = currentState.nodes.get(currentNode.parentIds[0]);
        if (parentNode) {
          parentNodeTitle = parentNode.title;
        }
      }

      const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'zh';
      const titleResult = await chatService.generateTitleStream(titleMessages, parentNodeTitle, currentLanguage);

      if (titleResult.rateLimited) {
        useToastStore.getState().addToast('error', titleResult.error || t('requestTooFrequent'));
      }

      if (!titleResult.rateLimited && titleResult.error && force) {
        useToastStore.getState().addToast('error', titleResult.error);
      }

      if (titleResult.title.trim() && titleResult.title !== t('newConversation')) {
        updateNode(nodeId, { title: titleResult.title });
        autoGeneratedTitleRef.current = '';
      }
    } catch (error: unknown) {
      console.error('[ChatPanel] 生成标题失败:', error);
      if (force) {
        useToastStore.getState().addToast('error', t('titleGenerationFailed'));
      }
    } finally {
      setIsGeneratingTitle(false);
    }
  }, [nodeId, isGeneratingTitle, isNodeManuallyTitled, updateNode, t]);

  /**
   * 提炼结论处理（流式）
   * 调用AI流式从当前对话中提炼核心结论，创建结论节点
   */
  const handleExtractConclusion = useCallback(async () => {
    if (!nodeId || isExtractingConclusion) return;

    setIsExtractingConclusion(true);

    if (conclusionTimerRef.current) {
      clearTimeout(conclusionTimerRef.current);
      conclusionTimerRef.current = null;
    }

    conclusionTimerRef.current = setTimeout(async () => {
      conclusionTimerRef.current = null;
      try {
        const currentNode = useAppStore.getState().nodes.get(nodeId);
        const currentConversation = currentNode?.conversationId
          ? useAppStore.getState().conversations.get(currentNode.conversationId)
          : null;
        const conclusionMessages = (currentConversation?.messages || [])
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
          .filter((msg) => msg.content.length > 0);
        const hasUserMessage = conclusionMessages.some((msg) => msg.role === 'user');
        const hasAssistantMessage = conclusionMessages.some((msg) => msg.role === 'assistant');

        if (!hasUserMessage || !hasAssistantMessage) {
          useToastStore.getState().addToast('error', t('conclusionNeedsQA'));
          return;
        }

        const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'zh';
        const result = await chatService.extractConclusionStream(nodeId, conclusionMessages, currentLanguage);

        if (result.rateLimited) {
          useToastStore.getState().addToast('error', result.error || t('requestTooFrequent'));
        } else if (result.success && result.conclusion) {
          createConclusionNode(nodeId, result.conclusion);
          useToastStore.getState().addToast('success', t('conclusionExtractSuccess'));
        } else {
          useToastStore.getState().addToast('error', result.error || t('conclusionExtractFailed'));
        }
      } catch (error: unknown) {
        console.error('[ChatPanel] 提炼结论失败:', error);
        useToastStore.getState().addToast('error', t('conclusionExtractFailedRetry'));
      } finally {
        setIsExtractingConclusion(false);
      }
    }, 2000);
  }, [nodeId, isExtractingConclusion, createConclusionNode, t]);

  /**
   * 生成节点摘要处理
   * 调用后端 AI 接口基于当前节点对话内容生成精炼摘要，更新节点 summary 字段
   * 生成成功后上报 summary_generated 埋点事件，埋点异常静默处理
   * @returns 无返回值，结果通过 toast 提示和节点状态更新体现
   */
  const handleGenerateSummary = useCallback(async () => {
    if (!nodeId || isGeneratingSummary) return;

    const activeConfig = useAPIConfigStore.getState().getActiveConfig();
    if (!activeConfig?.apiKey && !hasBuiltInKey) {
      setError(t('configureApiKeyFirst'));
      return;
    }

    const currentNode = useAppStore.getState().nodes.get(nodeId);
    if (!currentNode) return;

    const currentConversation = currentNode.conversationId
      ? useAppStore.getState().conversations.get(currentNode.conversationId)
      : null;
    const summaryMessages = (currentConversation?.messages || [])
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .filter((msg) => msg.content.trim().length > 0);
    const hasUserMessage = summaryMessages.some((msg) => msg.role === 'user');
    const hasAssistantMessage = summaryMessages.some((msg) => msg.role === 'assistant');

    if (!hasUserMessage || !hasAssistantMessage) {
      useToastStore.getState().addToast('error', t('summaryNeedsQA'));
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const configPayload: { model?: string; provider?: string; apiKey?: string; baseUrl?: string } = {};
      if (activeConfig?.modelId) configPayload.model = activeConfig.modelId;
      if (activeConfig?.provider) configPayload.provider = activeConfig.provider;
      if (activeConfig?.apiKey) configPayload.apiKey = activeConfig.apiKey;
      if (activeConfig?.baseUrl) configPayload.baseUrl = activeConfig.baseUrl;

      const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'zh';
      const result = await nodeApi.generateSummary(
        nodeId,
        Object.keys(configPayload).length > 0 ? configPayload : undefined,
        currentLanguage
      );

      if (result.success && result.data?.summary) {
        const summaryText = result.data.summary;
        updateNode(nodeId, { summary: summaryText });
        useToastStore.getState().addToast('success', t('summaryGenerateSuccess'));
        try {
          track(TRACK_EVENT_SUMMARY_GENERATED, {
            nodeId,
            summaryLength: summaryText.length,
            workspaceId: getLocalWorkspaceId() || '',
          });
        } catch {
          // 埋点上报异常静默处理，不阻塞主流程
        }
      } else {
        useToastStore.getState().addToast('error', result.error || t('summaryGenerateFailed'));
      }
    } catch (error: unknown) {
      console.error('[ChatPanel] 生成摘要失败:', error);
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      const errMsg = err?.response?.data?.error || err?.message || t('summaryGenerateFailed');
      useToastStore.getState().addToast('error', errMsg);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [nodeId, isGeneratingSummary, hasBuiltInKey, updateNode, t]);

  /**
   * 缩略图节点点击处理
   * 选中目标节点并请求打开其对话面板
   * @param targetNodeId - 目标节点ID
   */
  const handleThumbnailNodeClick = useCallback((targetNodeId: string) => {
    selectNode(targetNodeId);
    requestOpenChat(targetNodeId);
  }, [selectNode, requestOpenChat]);

  /**
   * 跳转到API配置面板
   * 通过自定义事件通知MainLayout打开设置弹窗并定位到API配置标签页
   */
  const handleGoToAPIConfig = useCallback(() => {
    setShowRateLimitGuide(false);
    window.dispatchEvent(new CustomEvent('settings:open-api'));
  }, []);

  /**
   * 加载更多历史消息
   * 调用分页接口获取更早的消息，追加到现有消息列表前面
   * 加载完成后恢复滚动位置，避免视觉跳动
   */
  const handleLoadMoreMessages = useCallback(async () => {
    if (!conversation?.id || isLoadingMore || !hasMoreMessages) return;

    setIsLoadingMore(true);
    try {
      const earliestTimestamp = messages.length > 0
        ? new Date(messages[0].timestamp).toISOString()
        : undefined;

      const result = await conversationApi.getConversationMessages(
        conversation.id,
        50,
        earliestTimestamp
      ) as unknown as { success: boolean; data: { messages: MessageData[]; hasMore: boolean } };

      if (result.success && result.data) {
        const olderMessages = result.data.messages;
        setHasMoreMessages(result.data.hasMore);

        if (olderMessages.length > 0) {
          const container = messagesContainerRef.current;
          const previousScrollHeight = container?.scrollHeight || 0;

          const formattedMessages: Array<{ _id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: Date }> = olderMessages.map((msg: MessageData) => ({
            _id: msg._id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.timestamp),
          }));

          const currentState = useAppStore.getState();
          const currentConv = currentState.conversations.get(conversation.id);
          if (currentConv) {
            const mergedMessages = [...formattedMessages, ...currentConv.messages];
            const newConversations = new Map(currentState.conversations);
            newConversations.set(conversation.id, {
              ...currentConv,
              messages: mergedMessages,
            });
            useAppStore.setState({ conversations: newConversations });
          }

          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - previousScrollHeight;
            }
          });
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[ChatPanel] 加载更多消息失败:', errorMsg);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversation?.id, isLoadingMore, hasMoreMessages, messages]);

  /**
   * 滚动事件处理
   * 当用户滚动到消息列表顶部时，自动触发加载更多历史消息
   */
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (container.scrollTop <= 50 && hasMoreMessages && !isLoadingMore) {
      handleLoadMoreMessages();
    }
  }, [hasMoreMessages, isLoadingMore, handleLoadMoreMessages]);

  useEffect(() => {
    if (conversation?.id && messages.length >= 50) {
      setHasMoreMessages(true);
    } else {
      setHasMoreMessages(false);
    }
  }, [conversation?.id, messages.length]);

  if (!nodeId) {
    return (
      <div className="h-full w-full min-w-0 flex flex-col bg-dark-950/30 backdrop-blur-sm">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-dark-400 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-700 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-dark-500" />
            </div>
            <p className="text-lg font-medium text-white mb-2">{t('selectNodeToChat')}</p>
            <p className="text-sm">{t('clickNodeOrCreate')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-dark-950/30 backdrop-blur-sm" data-testid="chat-panel-v2">
      {/* 节点信息头部 */}
      <div className="px-4 py-3 border-b border-dark-700/30">
        <div className="flex items-center gap-2">
          {node?.isRoot ? (
            <GitBranch className="w-4 h-4 text-primary-400" />
          ) : (
            <MessageSquare className="w-4 h-4 text-primary-400" />
          )}
          <span className="text-white font-medium truncate flex-1">{node?.title}</span>

          {messages.length > 0 && (
            <button
              onClick={() => handleGenerateTitle(true)}
              disabled={isGeneratingTitle}
              className="p-1.5 text-dark-400 hover:text-primary-400 hover:bg-dark-700 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('regenerateTitle')}
            >
              {isGeneratingTitle ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* 生成摘要按钮 - 节点对话有内容时显示，已存在摘要时切换为重新生成 */}
          {messages.length > 0 && (
            <button
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium hover:bg-emerald-600/25 hover:border-emerald-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title={node?.summary ? t('regenerateSummary') : t('generateSummary')}
            >
              {isGeneratingSummary ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              <span>{node?.summary ? t('regenerateSummary') : t('generateSummary')}</span>
            </button>
          )}

          {/* 快捷创建分支按钮 - 移动端核心优化 */}
          <button
            onClick={handleCreateBranch}
            disabled={branchCreating || !nodeId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/15 border border-primary-500/30 text-primary-400 rounded-xl text-xs font-medium hover:bg-primary-600/25 hover:border-primary-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title={t('createConversationBranch')}
          >
            {branchCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>{t('branchBtn')}</span>
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 text-dark-200 hover:text-red-400 hover:bg-dark-700 rounded-xl transition-colors"
            title={t('clearConversation')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {(contextInfo.parentCount > 0 || contextInfo.relationCount > 0) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-dark-400">
            {contextInfo.parentCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-dark-700 rounded-full">
                <GitBranch className="w-3 h-3" />
                {t('inheritParentNodes', { count: contextInfo.parentCount })}
              </span>
            )}
          </div>
        )}
        {/* 节点摘要展示区：仅在节点已生成摘要时显示，展示完整摘要文本 */}
        {node?.summary && (
          <div className="mt-2 px-3 py-2 bg-dark-700/40 border border-dark-600/50 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 mb-1">
              <FileText className="w-3 h-3" />
              <span>{t('nodeSummaryLabel')}</span>
            </div>
            <p className="text-xs text-dark-200 leading-relaxed whitespace-pre-wrap break-words">
              {node.summary}
            </p>
          </div>
        )}
        {contextUsage && (
          <ContextUsageIndicator used={contextUsage.used} limit={contextUsage.limit} />
        )}
      </div>

      {/* 消息列表 */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4 relative"
        style={{ scrollbarGutter: 'stable' }}
      >
        {/* 加载更多指示器 */}
        {messages.length > 0 && hasMoreMessages && (
          <div className="flex justify-center py-2">
            <button
              onClick={handleLoadMoreMessages}
              disabled={isLoadingMore}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-dark-400 hover:text-primary-400 bg-dark-800/50 hover:bg-dark-700/50 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('loading', { ns: 'common' })}</span>
                </>
              ) : (
                <span>{t('loadMoreMessages')}</span>
              )}
            </button>
          </div>
        )}
        {isLoadingMore && messages.length === 0 && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-400" />
          </div>
        )}

        {showRateLimitGuide && (
          <RateLimitGuide
            onClose={() => setShowRateLimitGuide(false)}
            onGoToConfig={handleGoToAPIConfig}
          />
        )}
        <MindMapThumbnail
          nodes={nodes}
          relations={relations}
          activeNodeId={nodeId}
          onNodeClick={handleThumbnailNodeClick}
        />

        {/* 支线结束摘要提示横幅：仅当当前节点触发且非空对话时显示 */}
        {showSummaryPrompt && showSummaryPrompt.nodeId === nodeId && messages.length > 0 && (
          <SummaryPromptBanner
            nodeTitle={showSummaryPrompt.nodeTitle}
            onGenerate={() => {
              useChatStore.getState().dismissSummaryPrompt();
              handleGenerateSummary();
            }}
            onIgnore={() => {
              useChatStore.getState().dismissSummaryPrompt();
            }}
          />
        )}

        {messages.length === 0 && !streamingContent ? (
          <div className="text-center text-dark-400 py-8">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium text-white mb-1">{t('startAiConversation')}</p>
            <p className="text-sm">
              {node?.isRoot
                ? t('rootNodeConversation')
                : t('inheritParentContext')
              }
            </p>
            {!isFeatureVisible('sensitiveWordCheck') && (
              <p className="text-xs text-amber-400/70 mt-2">
                {t('sensitiveCheckDisabled')}
              </p>
            )}
            {contextInfo.parentCount > 0 && (
              <p className="text-xs text-primary-400 mt-2">
                {t('inheritedParentHistory', { count: contextInfo.parentCount })}
              </p>
            )}
            <div className="mt-4 space-y-2">
              {quickSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickSuggestion(suggestion)}
                  className="w-full text-left px-3 py-2 rounded-2xl text-sm text-dark-300 hover:text-white hover:bg-dark-700/50 border border-dark-600/50 hover:border-primary-500/30 transition-all duration-200"
                >
                  <span className="text-primary-400 mr-2">✦</span>
                  {suggestion}
                </button>
              ))}
            </div>
            {/* 空状态时也提供创建分支引导 */}
            <button
              onClick={handleCreateBranch}
              disabled={branchCreating}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600/15 border border-primary-500/30 text-primary-400 rounded-xl text-sm font-medium hover:bg-primary-600/25 active:scale-95 transition-all"
            >
              <GitBranch className="w-4 h-4" />
              <span>{t('createConversationBranch')}</span>
            </button>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const { directions, cleanContent } = message.role === 'assistant'
                ? parseExtensionDirections(message.content)
                : { directions: [], cleanContent: message.content };

              return (
                <div
                  key={message._id}
                  className={`flex gap-3 w-full ${message.role === 'user' ? 'flex-row-reverse justify-start' : 'justify-start'}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' ? 'bg-primary-600' : 'bg-dark-700'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary-400" />
                    )}
                  </div>
                  <div
                    className={`flex flex-col max-w-[85%] ${
                      message.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2.5 rounded-2xl ${
                        message.role === 'user'
                          ? 'bg-primary-600 text-white rounded-tr-sm'
                          : 'bg-dark-700 text-white rounded-tl-sm'
                      }`}
                    >
                      <MessageContent
                        content={cleanContent.trim() || (directions.length > 0 ? t('extensionDirectionsFallback') : cleanContent)}
                        role={message.role}
                      />
                      <div className="text-xs mt-1 text-dark-500">
                        {formatMessageTime(message.timestamp)}
                      </div>
                    </div>
                    {message.role === 'assistant' && directions.length > 0 && (
                      <ExtensionDirectionButtons
                        directions={directions}
                        onDirectionClick={handleExtensionDirectionClick}
                        loadingDirection={extensionLoadingDirection}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            
            {streamingContent && (
              <div className="flex gap-3 w-full justify-start">
                <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-400" />
                </div>
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-dark-700 text-white rounded-tl-sm">
                  <ThinkingProcess content={streamingThinkingContent} isStreaming={true} />
                  <StreamingMessage content={streamingContent} isStreaming={true} />
                  {/* 工具调用状态展示 */}
                  {activeToolCalls.length > 0 && (
                    <div className="flex flex-col gap-2 mt-2">
                      {activeToolCalls.map((tc, idx) => (
                        <div
                          key={tc.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600/10 border border-primary-500/20"
                        >
                          {/* 脉冲动画图标 */}
                          <div className="relative flex items-center justify-center">
                            <div className="absolute w-5 h-5 rounded-full bg-primary-400/20 animate-ping" />
                            <div className="relative w-3 h-3 rounded-full bg-primary-400 animate-pulse" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-primary-300 font-medium">
                              正在{getToolActionLabel(tc.name)}
                            </span>
                            <span className="text-xs text-dark-400 mt-0.5">
                              {getToolDescription(tc.name)}
                            </span>
                          </div>
                          {/* 进度点动画 */}
                          <div className="ml-auto flex gap-1">
                            {[0, 1, 2].map((i) => (
                              <div
                                key={i}
                                className="w-1.5 h-1.5 rounded-full bg-primary-400"
                                style={{
                                  animation: 'pulse 1.4s ease-in-out infinite',
                                  animationDelay: `${idx * 200 + i * 200}ms`,
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* 工具执行结果展示 */}
                  {toolResults.length > 0 && activeToolCalls.length === 0 && (
                    <div className="flex flex-col gap-1 mt-2">
                      {toolResults.map((result, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm animate-fade ${
                            result.success
                              ? 'bg-emerald-400/10 border border-emerald-400/20 text-emerald-300'
                              : 'bg-red-400/10 border border-red-400/20 text-red-300'
                          }`}
                        >
                          <span>{result.success ? '✓' : '✗'}</span>
                          <span>{result.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 工具调用中但无流式文本时，独立展示工具调用状态 */}
            {!streamingContent && activeToolCalls.length > 0 && (
              <div className="flex gap-3 w-full justify-start">
                <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-400" />
                </div>
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-dark-700 text-white rounded-tl-sm">
                  <div className="flex flex-col gap-2">
                    {activeToolCalls.map((tc, idx) => (
                      <div
                        key={tc.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-600/10 border border-primary-500/20"
                      >
                        {/* 脉冲动画图标 */}
                        <div className="relative flex items-center justify-center">
                          <div className="absolute w-5 h-5 rounded-full bg-primary-400/20 animate-ping" />
                          <div className="relative w-3 h-3 rounded-full bg-primary-400 animate-pulse" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-primary-300 font-medium">
                            正在{getToolActionLabel(tc.name)}
                          </span>
                          <span className="text-xs text-dark-400 mt-0.5">
                            {getToolDescription(tc.name)}
                          </span>
                        </div>
                        {/* 进度点动画 */}
                        <div className="ml-auto flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-1.5 h-1.5 rounded-full bg-primary-400"
                              style={{
                                animation: 'pulse 1.4s ease-in-out infinite',
                                animationDelay: `${idx * 200 + i * 200}ms`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {isLoading && !streamingContent && activeToolCalls.length === 0 && (
          <div className="flex gap-3 w-full justify-start">
            <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-dark-700 text-dark-300 rounded-tl-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm">{t('thinking')}</span>
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="w-full text-center text-red-400 text-sm py-2 px-4 bg-red-900/20 rounded-2xl">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />

        {messages.length > 0 && isFeatureVisible('dataExport') && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleExtractConclusion}
              disabled={isExtractingConclusion || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/15 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-medium hover:bg-amber-600/25 hover:border-amber-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('extractConclusion')}
            >
              {isExtractingConclusion ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lightbulb className="w-3.5 h-3.5" />
              )}
              <span>{t('extractConclusion')}</span>
            </button>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="w-full p-4 border-t border-dark-600/50 bg-dark-800/90 backdrop-blur-sm">
        {/* 已选文件标签 */}
        {selectedFileIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedFileIds.map(fileId => {
              const file = workspaceFiles.find(f => f.id === fileId);
              if (!file) return null;
              return (
                <div
                  key={fileId}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-primary-600/15 border border-primary-500/30 text-primary-400"
                >
                  {getFileIcon(file.mimeType)}
                  <span className="max-w-[120px] truncate">{file.originalName}</span>
                  <button
                    onClick={() => removeSelectedFile(fileId)}
                    className="p-0.5 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 智能分叉提示气泡：仅在检测命中且未被忽略时展示 */}
        {branchSuggestion && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-2xl transition-opacity duration-300 animate-fade dark:bg-blue-900/20 dark:border-blue-500/30"
            role="status"
            aria-label={t('branchSuggestionTitle')}
          >
            <GitBranch className="w-4 h-4 text-blue-500 flex-shrink-0 dark:text-blue-400" />
            <span className="flex-1 min-w-0 text-sm text-blue-700 dark:text-blue-200 break-words">
              {branchSuggestion.suggestionText}
            </span>
            <button
              onClick={handleBranchSuggestionAccept}
              className="flex-shrink-0 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {t('createBranch')}
            </button>
            <button
              onClick={handleBranchSuggestionDismiss}
              className="flex-shrink-0 px-2 py-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 text-xs transition-colors"
            >
              {t('ignore')}
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || isUploading}
            className="btn-icon disabled:opacity-50"
            title={t('uploadFile')}
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFileIds.length > 0 ? t('inputWithFilesPlaceholder', { count: selectedFileIds.length }) : t('inputPlaceholder')}
            rows={1}
            disabled={isLoading}
            className="input-field flex-1 resize-none overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={() => setShowFilePanel(!showFilePanel)}
            className={showFilePanel ? 'btn-icon bg-primary-600/20 border-primary-500/50 text-primary-400' : 'btn-icon'}
            title={t('workspaceFiles')}
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs mt-2 text-center text-dark-500">
          {t('contextAutoInclude')}
        </p>
      </div>

      {/* 文件面板 */}
      {showFilePanel && (
        <div className="border-t border-dark-600/50 max-h-60 overflow-y-auto bg-dark-800/90 backdrop-blur-sm">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-dark-300">{t('workspaceFiles')}</h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                {isUploading ? t('uploading') : t('upload')}
              </button>
            </div>
            {workspaceFiles.length === 0 ? (
              <p className="text-xs text-dark-500 text-center py-3">{t('noFiles')}</p>
            ) : (
              <div className="space-y-1">
                {workspaceFiles.map(file => (
                  <div
                    key={file.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                      selectedFileIds.includes(file.id)
                        ? 'bg-primary-600/15 border border-primary-500/30'
                        : 'hover:bg-dark-700 border border-transparent'
                    }`}
                    onClick={() => toggleFileSelection(file.id)}
                  >
                    {getFileIcon(file.mimeType)}
                    <span className="flex-1 text-xs text-dark-300 truncate">{file.originalName}</span>
                    <span className="text-xs text-dark-500">{formatFileSize(file.size)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                      className="p-0.5 text-dark-500 hover:text-red-400 transition-colors"
                      title={t('deleteBtn', { ns: 'common' })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 清空对话确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmDialogOpen}
        title={t('clearConversationTitle')}
        message={t('clearConversationMessage')}
        confirmText={t('confirm', { ns: 'common' })}
        cancelText={t('cancel', { ns: 'common' })}
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </div>
  );
};

export default ChatPanel;
