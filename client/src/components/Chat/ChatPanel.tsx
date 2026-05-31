import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, Trash2, User, Bot, Sparkles, GitBranch, MessageSquare, Copy, Check, Plus, Brain, ChevronDown, ChevronUp, Paperclip, X, FileText, File, Image, RefreshCw, Lightbulb } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAPIConfigStore } from '../../stores/apiConfigStore';
import { useToastStore } from '../../stores/toastStore';
import { chatService } from '../../services/chatService';
import { fileApi, conversationApi } from '../../services/api';
import type { FileInfo } from '../../services/api';
import useMobile from '../../hooks/useMobile';
import useIsMobile from '../../hooks/useIsMobile';
import type { StreamEvent } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';
import MindMapThumbnail from './MindMapThumbnail';
import ConfirmDialog from '../Common/ConfirmDialog';

/**
 * 估算文本的Token数量
 * 采用通用估算方式：中文约1.5 token/字，英文约0.75 token/word
 * 使用 Math.ceil(text.length * 0.7) 作为保守估算，实际Token数可能更少
 * @param text - 需要估算的文本内容
 * @returns 估算的Token数量
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.2);
}

/**
 * 模型上下文窗口大小映射
 * 定义各AI模型支持的最大上下文Token数
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'glm-4': 8192,
  'glm-4-flash': 8192,
  'glm-4-plus': 128000,
  'glm-4-long': 128000,
  'deepseek-chat': 32768,
  'deepseek-reasoner': 65536,
  'deepseek-coder': 16384,
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'o1-preview': 128000,
  'o1-mini': 128000,
  'claude-3-5-sonnet': 200000,
  'claude-3-opus': 200000,
  'claude-3-haiku': 200000,
  'qwen-plus': 32768,
  'qwen-turbo': 8192,
  'qwen-max': 8192,
  'default': 8192
};

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

  /**
   * 复制消息内容到剪贴板
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      useToastStore.getState().addToast('success', '已复制到剪贴板');
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
      useToastStore.getState().addToast('success', '已复制到剪贴板');
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
        title="复制内容"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

/**
 * 流式消息组件
 * 用于渲染正在生成的 AI 消息
 */
const StreamingMessage: React.FC<{
  content: string;
}> = ({ content }) => {
  return (
    <div className="relative group">
      <MarkdownRenderer content={content} />
      <span className="inline-block w-2 h-4 bg-primary-400 animate-pulse ml-0.5" />
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

  if (!content) return null;

  return (
    <div className="mb-3 border border-dark-600 rounded-2xl bg-dark-800/50 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-dark-300 hover:text-primary-400 hover:bg-dark-700/50 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-primary-400" />
        <span>思考过程</span>
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
  const barColor = percentage < 50
    ? 'bg-emerald-400'
    : percentage <= 80
      ? 'bg-amber-400'
      : 'bg-red-400';

  return (
    <div className="mt-1.5" title={`上下文: ${used}/${limit} tokens`}>
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
    markNodeManuallyTitled,
    isNodeManuallyTitled,
  } = useAppStore();
  const { keepAwake, allowSleep, haptic } = useMobile();
  const isMobile = useIsMobile();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingThinkingContent, setStreamingThinkingContent] = useState<string>('');
  const [branchCreating, setBranchCreating] = useState(false);
  const [hasBuiltInKey, setHasBuiltInKey] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<FileInfo[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isExtractingConclusion, setIsExtractingConclusion] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * 快捷提问建议列表
   * 与思维导图场景相关，引导用户快速开始对话
   */
  const quickSuggestions = [
    '帮我分析这个主题的关键概念',
    '生成子主题扩展思路',
    '总结当前节点的核心要点',
    '推荐相关联的知识方向',
  ];

  const node = nodeId ? nodes.get(nodeId) : null;
  const conversation = node?.conversationId ? conversations.get(node.conversationId) : null;
  const messages = conversation?.messages || [];

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

  useEffect(() => {
    if (isLoading || streamingContent) {
      keepAwake();
    } else {
      allowSleep();
    }
  }, [isLoading, streamingContent, keepAwake, allowSleep]);

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
      setError('文件上传失败，请重试');
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
      setError('删除文件失败');
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
   * 发送消息（流式传输）
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    haptic('light');
    
    const activeConfig = useAPIConfigStore.getState().getActiveConfig();
    if (!activeConfig?.apiKey && !hasBuiltInKey) {
      setError('请先在设置中配置API密钥');
      return;
    }

    if (!nodeId) {
      setError('请先选择一个节点');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setError(null);
    setStreamingContent('');
    setStreamingThinkingContent('');

    const DEFAULT_TITLES = ['新对话', '新分支'];
    if (nodeId && node && DEFAULT_TITLES.includes(node.title || '')) {
      const autoTitle = userMessage.length > 15
        ? userMessage.substring(0, 15) + '...'
        : userMessage;
      updateNode(nodeId, { title: autoTitle });
    }

    let convId = node?.conversationId;
    if (!convId) {
      convId = addConversation(nodeId);
    }

    setIsLoading(true);

    const contextMessages = getConversationContext(nodeId);
    
    addMessage(convId, { role: 'user', content: userMessage });
    
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
          content: `[用户引用了以下文件: ${fileContextParts.join(', ')}，请在回答时参考这些文件内容]`
        });
      }
    }

    const handleStream = (event: StreamEvent) => {
      if (event.type === 'content' && event.fullContent) {
        setStreamingContent(event.fullContent);
      } else if (event.type === 'thinking' && event.fullThinkingContent) {
        setStreamingThinkingContent(event.fullThinkingContent);
      } else if (event.type === 'error') {
        setError(event.error || '发送消息失败');
        setStreamingContent('');
        setStreamingThinkingContent('');
      }
    };

    const result = await chatService.sendMessageStream(allMessages, handleStream, selectedFileIds.length > 0 ? selectedFileIds : undefined);

    setIsLoading(false);
    setStreamingContent('');
    setStreamingThinkingContent('');
    setSelectedFileIds([]);

    if (result.success && result.content) {
      addMessage(convId, { role: 'assistant', content: result.content });

      const currentConv = useAppStore.getState().conversations.get(convId);
      const userMsgCount = currentConv?.messages.filter((m) => m.role === 'user').length || 0;
      const assistantMsgCount = currentConv?.messages.filter((m) => m.role === 'assistant').length || 0;

      if (userMsgCount === 1 && assistantMsgCount === 1 && nodeId) {
        const currentNode = useAppStore.getState().nodes.get(nodeId);
        const isDefaultTitle = !currentNode?.title
          || currentNode.title.includes('...')
          || currentNode.title === '新对话'
          || currentNode.title === '新分支';

        if (isDefaultTitle && !isNodeManuallyTitled(nodeId)) {
          handleGenerateTitle();
        }
      }
    } else if (!result.success) {
      if (result.sensitiveWords && result.sensitiveWords.length > 0) {
        setError(`消息包含敏感内容（${result.sensitiveWords.join('、')}），请修改后重试`);
      } else {
        setError(result.error || '发送消息失败');
      }
    }
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
   * @param e - 输入事件对象
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 160) + 'px';
    setInput(target.value);
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
      useToastStore.getState().addToast('success', '对话已清空');
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
   * 从快捷建议等场景调用，复用 handleSend 的核心逻辑
   * @param text - 要发送的文本内容
   */
  const handleSendWithText = async (text: string) => {
    if (!text.trim() || isLoading) return;
    haptic('light');

    const activeConfigForText = useAPIConfigStore.getState().getActiveConfig();
    if (!activeConfigForText?.apiKey && !hasBuiltInKey) {
      setError('请先在设置中配置API密钥');
      return;
    }

    if (!nodeId) {
      setError('请先选择一个节点');
      return;
    }

    const userMessage = text.trim();
    setInput('');
    setError(null);
    setStreamingContent('');
    setStreamingThinkingContent('');

    let convId = node?.conversationId;
    if (!convId) {
      convId = addConversation(nodeId);
    }

    setIsLoading(true);

    const contextMessages = getConversationContext(nodeId);

    addMessage(convId, { role: 'user', content: userMessage });

    const allMessages = [
      ...contextMessages,
      { role: 'user' as const, content: userMessage }
    ];

    const handleStream = (event: StreamEvent) => {
      if (event.type === 'content' && event.fullContent) {
        setStreamingContent(event.fullContent);
      } else if (event.type === 'thinking' && event.fullThinkingContent) {
        setStreamingThinkingContent(event.fullThinkingContent);
      } else if (event.type === 'error') {
        setError(event.error || '发送消息失败');
        setStreamingContent('');
        setStreamingThinkingContent('');
      }
    };

    const result = await chatService.sendMessageStream(allMessages, handleStream, selectedFileIds.length > 0 ? selectedFileIds : undefined);

    setIsLoading(false);
    setStreamingContent('');
    setStreamingThinkingContent('');
    setSelectedFileIds([]);

    if (result.success && result.content) {
      addMessage(convId, { role: 'assistant', content: result.content });

      const currentConv = useAppStore.getState().conversations.get(convId);
      const userMsgCount = currentConv?.messages.filter((m) => m.role === 'user').length || 0;
      const assistantMsgCount = currentConv?.messages.filter((m) => m.role === 'assistant').length || 0;

      if (userMsgCount === 1 && assistantMsgCount === 1 && nodeId) {
        const currentNode = useAppStore.getState().nodes.get(nodeId);
        const isDefaultTitle = !currentNode?.title
          || currentNode.title.includes('...')
          || currentNode.title === '新对话'
          || currentNode.title === '新分支';

        if (isDefaultTitle && !isNodeManuallyTitled(nodeId)) {
          handleGenerateTitle();
        }
      }
    } else if (!result.success) {
      if (result.sensitiveWords && result.sensitiveWords.length > 0) {
        setError(`消息包含敏感内容（${result.sensitiveWords.join('、')}），请修改后重试`);
      } else {
        setError(result.error || '发送消息失败');
      }
    }
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
      const childId = createChildNode(nodeId, '新分支');
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
   * 生成智能标题
   * 根据当前对话消息调用AI生成精炼标题，更新节点标题
   * @param force - 是否强制生成（忽略手动修改标记）
   */
  const handleGenerateTitle = useCallback(async (force: boolean = false) => {
    if (!nodeId || !node || isGeneratingTitle) return;

    if (!force && isNodeManuallyTitled(nodeId)) return;

    const currentConversation = node.conversationId
      ? conversations.get(node.conversationId)
      : null;
    const currentMessages = currentConversation?.messages || [];

    if (currentMessages.length === 0) return;

    setIsGeneratingTitle(true);
    try {
      const titleMessages = currentMessages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({ role: msg.role, content: msg.content }));

      let parentNodeTitle: string | undefined;
      if (node.parentIds.length > 0) {
        const parentNode = nodes.get(node.parentIds[0]);
        if (parentNode) {
          parentNodeTitle = parentNode.title;
        }
      }

      const generatedTitle = await conversationApi.generateTitle(titleMessages, parentNodeTitle);

      if (generatedTitle && generatedTitle !== '新对话') {
        updateNode(nodeId, { title: generatedTitle });
      }
    } catch (error: unknown) {
      console.error('[ChatPanel] 生成标题失败:', error);
    } finally {
      setIsGeneratingTitle(false);
    }
  }, [nodeId, node, isGeneratingTitle, isNodeManuallyTitled, conversations, nodes, updateNode]);

  /**
   * 提炼结论处理
   * 调用AI从当前对话中提炼核心结论，创建结论节点
   */
  const handleExtractConclusion = useCallback(async () => {
    if (!nodeId || isExtractingConclusion) return;

    setIsExtractingConclusion(true);
    try {
      const result = await conversationApi.extractConclusion(nodeId);

      if (result.success && result.conclusion) {
        createConclusionNode(nodeId, result.conclusion);
        useToastStore.getState().addToast('success', '结论提炼成功');
      } else {
        useToastStore.getState().addToast('error', '结论提炼失败，请确保对话有足够内容');
      }
    } catch (error: unknown) {
      console.error('[ChatPanel] 提炼结论失败:', error);
      useToastStore.getState().addToast('error', '结论提炼失败，请稍后重试');
    } finally {
      setIsExtractingConclusion(false);
    }
  }, [nodeId, isExtractingConclusion, createConclusionNode]);

  /**
   * 缩略图节点点击处理
   * 选中目标节点并请求打开其对话面板
   * @param targetNodeId - 目标节点ID
   */
  const handleThumbnailNodeClick = useCallback((targetNodeId: string) => {
    selectNode(targetNodeId);
    requestOpenChat(targetNodeId);
  }, [selectNode, requestOpenChat]);

  if (!nodeId) {
    return (
      <div className="h-full flex flex-col bg-dark-950/30 backdrop-blur-sm">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-dark-400 px-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-dark-700 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-dark-500" />
            </div>
            <p className="text-lg font-medium text-white mb-2">选择节点开始对话</p>
            <p className="text-sm">点击画布上的节点，或创建新节点</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-950/30 backdrop-blur-sm" data-testid="chat-panel-v2">
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
              title="重新生成标题"
            >
              {isGeneratingTitle ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          
          {/* 快捷创建分支按钮 - 移动端核心优化 */}
          <button
            onClick={handleCreateBranch}
            disabled={branchCreating || !nodeId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/15 border border-primary-500/30 text-primary-400 rounded-xl text-xs font-medium hover:bg-primary-600/25 hover:border-primary-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            title="从此节点创建分支"
          >
            {branchCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>分支</span>
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 text-dark-200 hover:text-red-400 hover:bg-dark-700 rounded-xl transition-colors"
            title="清空对话"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {(contextInfo.parentCount > 0 || contextInfo.relationCount > 0) && (
          <div className="mt-2 flex items-center gap-2 text-xs text-dark-400">
            {contextInfo.parentCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-dark-700 rounded-full">
                <GitBranch className="w-3 h-3" />
                继承 {contextInfo.parentCount} 个父节点
              </span>
            )}
          </div>
        )}
        {contextUsage && (
          <ContextUsageIndicator used={contextUsage.used} limit={contextUsage.limit} />
        )}
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        <MindMapThumbnail
          nodes={nodes}
          relations={relations}
          activeNodeId={nodeId}
          onNodeClick={handleThumbnailNodeClick}
        />

        {messages.length === 0 && !streamingContent ? (
          <div className="text-center text-dark-400 py-8">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium text-white mb-1">开始与AI对话</p>
            <p className="text-sm">
              {node?.isRoot 
                ? '这是一个根节点，对话将从这里开始'
                : '对话将自动继承父节点的上下文'
              }
            </p>
            {contextInfo.parentCount > 0 && (
              <p className="text-xs text-primary-400 mt-2">
                已继承 {contextInfo.parentCount} 个父节点的对话历史
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
              <span>创建对话分支</span>
            </button>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message._id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
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
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-primary-600 text-white rounded-tr-sm'
                      : 'bg-dark-700 text-white rounded-tl-sm'
                  }`}
                >
                  <MessageContent content={message.content} role={message.role} />
                  <div className="text-xs mt-1" style={{ color: '#64748b' }}>
                    {formatMessageTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            
            {streamingContent && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-400" />
                </div>
                <div className="max-w-[85%] px-4 py-2.5 rounded-2xl bg-dark-700 text-white rounded-tl-sm">
                  <ThinkingProcess content={streamingThinkingContent} isStreaming={true} />
                  <StreamingMessage content={streamingContent} />
                </div>
              </div>
            )}
          </>
        )}
        
        {isLoading && !streamingContent && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-primary-400 animate-spin" />
            </div>
            <div className="px-4 py-2.5 rounded-2xl bg-dark-700 text-dark-300 rounded-tl-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm">正在思考</span>
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
          <div className="text-center text-red-400 text-sm py-2 px-4 bg-red-900/20 rounded-2xl">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />

        {messages.length > 0 && (
          <div className="flex justify-center pt-2">
            <button
              onClick={handleExtractConclusion}
              disabled={isExtractingConclusion || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/15 border border-amber-500/30 text-amber-400 rounded-xl text-xs font-medium hover:bg-amber-600/25 hover:border-amber-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              title="提炼对话结论"
            >
              {isExtractingConclusion ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Lightbulb className="w-3.5 h-3.5" />
              )}
              <span>提炼结论</span>
            </button>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-dark-600/50 bg-dark-800/90 backdrop-blur-sm">
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
            title="上传文件"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFileIds.length > 0 ? `已引用${selectedFileIds.length}个文件，输入问题...` : "输入消息... (Enter发送，Shift+Enter换行)"}
            rows={1}
            disabled={isLoading}
            className="input-field flex-1 resize-none overflow-y-auto disabled:opacity-50"
          />
          <button
            onClick={() => setShowFilePanel(!showFilePanel)}
            className={showFilePanel ? 'btn-icon bg-primary-600/20 border-primary-500/50 text-primary-400' : 'btn-icon'}
            title="工作区文件"
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
          对话上下文将自动包含父节点历史 · 支持文件上传与AI分析
        </p>
      </div>

      {/* 文件面板 */}
      {showFilePanel && (
        <div className="border-t border-dark-600/50 max-h-60 overflow-y-auto bg-dark-800/90 backdrop-blur-sm">
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-dark-300">工作区文件</h4>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                {isUploading ? '上传中...' : '+ 上传'}
              </button>
            </div>
            {workspaceFiles.length === 0 ? (
              <p className="text-xs text-dark-500 text-center py-3">暂无文件，点击上传或📎按钮添加</p>
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
                      title="删除文件"
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
        title="清空对话"
        message="确定要清空此对话吗？此操作不可撤销。"
        confirmText="清空"
        cancelText="取消"
        onConfirm={handleConfirmClear}
        onCancel={handleCancelClear}
      />
    </div>
  );
};

export default ChatPanel;
