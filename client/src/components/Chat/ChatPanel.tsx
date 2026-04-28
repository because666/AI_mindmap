import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, Trash2, User, Bot, Sparkles, GitBranch, MessageSquare, Copy, Check, Plus, Brain, ChevronDown, ChevronUp, Paperclip, X, FileText, File, Image } from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import { useAPIConfigStore } from '../../stores/apiConfigStore';
import { chatService } from '../../services/chatService';
import { fileApi } from '../../services/api';
import type { FileInfo } from '../../services/api';
import useMobile from '../../hooks/useMobile';
import type { StreamEvent } from '../../types';
import MarkdownRenderer from './MarkdownRenderer';
import MindMapThumbnail from './MindMapThumbnail';

interface ChatPanelProps {
  nodeId?: string | null;
}

/**
 * 消息内容组件
 * 用于渲染单条消息，支持 Markdown 格式
 */
const MessageContent: React.FC<{
  content: string;
  role: 'user' | 'assistant' | 'system';
}> = ({ content, role }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('复制失败:', err);
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
        className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity bg-dark-600 rounded text-dark-400 hover:text-white"
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
    <div className="mb-3 border border-dark-600 rounded-xl bg-dark-800/50 overflow-hidden">
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
    selectNode,
    requestOpenChat,
  } = useAppStore();
  const { config } = useAPIConfigStore();
  const { keepAwake, allowSleep, haptic } = useMobile();
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const node = nodeId ? nodes.get(nodeId) : null;
  const conversation = node?.conversationId ? conversations.get(node.conversationId) : null;
  const messages = conversation?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, streamingThinkingContent]);

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
      const response = await fileApi.list();
      if (response.data.success) {
        setWorkspaceFiles(response.data.data);
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
      const response = await fileApi.upload(Array.from(files));
      if (response.data.success) {
        const { uploaded, errors } = response.data.data;
        if (errors.length > 0) {
          setError(errors.map(e => `${e.filename}: ${e.error}`).join('; '));
        }
        const newFileIds = uploaded.map(f => f.id);
        setSelectedFileIds(prev => [...prev, ...newFileIds]);
        await loadWorkspaceFiles();
      }
    } catch (err) {
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
   * 发送消息（流式传输）
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    haptic('light');
    
    if (!config.apiKey && !hasBuiltInKey) {
      setError('请先在设置中配置API密钥');
      return;
    }

    if (!nodeId) {
      setError('请先选择一个节点');
      return;
    }

    const userMessage = input.trim();
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

    const result = await chatService.sendMessageStream(allMessages, config, handleStream, selectedFileIds.length > 0 ? selectedFileIds : undefined);

    setIsLoading(false);
    setStreamingContent('');
    setStreamingThinkingContent('');
    setSelectedFileIds([]);

    if (result.success && result.content) {
      addMessage(convId, { role: 'assistant', content: result.content });
    } else if (!result.success) {
      setError(result.error || '发送消息失败');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (conversation?.id && confirm('确定要清空此对话吗？')) {
      clearConversation(conversation.id);
    }
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
      <div className="h-full flex flex-col bg-dark-900">
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
    <div className="h-full flex flex-col bg-dark-900">
      {/* 节点信息头部 */}
      <div className="px-4 py-3 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-2">
          {node?.isRoot ? (
            <GitBranch className="w-4 h-4 text-primary-400" />
          ) : (
            <MessageSquare className="w-4 h-4 text-primary-400" />
          )}
          <span className="text-white font-medium truncate flex-1">{node?.title}</span>
          
          {/* 快捷创建分支按钮 - 移动端核心优化 */}
          <button
            onClick={handleCreateBranch}
            disabled={branchCreating || !nodeId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600/15 border border-primary-500/30 text-primary-400 rounded-lg text-xs font-medium hover:bg-primary-600/25 hover:border-primary-500/50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
            className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-700 rounded-lg transition-colors"
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
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 relative">
        {/* 思维导图缩略图 - 左上角悬浮 */}
        <div className="sticky top-0 z-10 mb-3">
          <MindMapThumbnail
            nodes={nodes}
            relations={relations}
            activeNodeId={nodeId}
            onNodeClick={handleThumbnailNodeClick}
          />
        </div>

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
          <div className="text-center text-red-400 text-sm py-2 px-4 bg-red-900/20 rounded-lg">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-4 border-t border-dark-700">
        {/* 已选文件标签 */}
        {selectedFileIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {selectedFileIds.map(fileId => {
              const file = workspaceFiles.find(f => f.id === fileId);
              if (!file) return null;
              return (
                <div
                  key={fileId}
                  className="flex items-center gap-1 px-2 py-1 bg-primary-600/15 border border-primary-500/30 rounded-lg text-xs text-primary-400"
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
            className="px-3 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-dark-400 hover:text-white hover:border-primary-500/50 transition-colors disabled:opacity-50"
            title="上传文件"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedFileIds.length > 0 ? `已引用${selectedFileIds.length}个文件，输入问题...` : "输入消息... (Enter发送，Shift+Enter换行)"}
            rows={1}
            disabled={isLoading}
            className="flex-1 px-4 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-white placeholder-dark-400 focus:border-primary-500 focus:outline-none resize-none transition-colors text-sm disabled:opacity-50"
          />
          <button
            onClick={() => setShowFilePanel(!showFilePanel)}
            className={`px-3 py-2.5 rounded-xl border transition-colors ${
              showFilePanel ? 'bg-primary-600/20 border-primary-500/50 text-primary-400' : 'bg-dark-700 border-dark-600 text-dark-400 hover:text-white hover:border-primary-500/50'
            }`}
            title="工作区文件"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-dark-500 mt-2 text-center">
          对话上下文将自动包含父节点历史 · 支持文件上传与AI分析
        </p>
      </div>

      {/* 文件面板 */}
      {showFilePanel && (
        <div className="border-t border-dark-700 bg-dark-800 max-h-60 overflow-y-auto">
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
    </div>
  );
};

export default ChatPanel;
