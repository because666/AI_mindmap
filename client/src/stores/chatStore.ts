import { create } from 'zustand';
import type { IMessage } from '../types';

/**
 * 支线结束检测 - 对话轮数下限
 * 子节点对话达到此轮数（含）时可能触发摘要提示
 */
export const BRANCH_END_ROUND_MIN = 4;

/**
 * 支线结束检测 - 对话轮数上限
 * 超过此轮数后不再视为"刚好结束"的最佳提示窗口
 */
export const BRANCH_END_ROUND_MAX = 6;

/**
 * 支线结束检测 - 无新消息超时阈值（毫秒，3 分钟）
 * 最后一条消息距今超过此值时视为对话停滞
 */
export const BRANCH_END_TIMEOUT_MS = 180000;

/**
 * 支线结束语义关键词列表
 * 用户消息包含这些词时，可能表示用户希望结束当前支线
 */
export const BRANCH_END_KEYWORDS: readonly string[] = [
  '总结', '明白了', '先这样', '回来', '回到主线',
  '懂了', '了解了', '知道了', '清楚了', '完了',
  'summarize', 'got it', 'understood', 'back to main'
];

/**
 * 支线结束检测参数
 */
export interface BranchEndCheckArgs {
  /** 当前节点 ID */
  nodeId: string;
  /** 当前节点对话消息列表 */
  messages: IMessage[];
  /** 当前节点标题（用于提示展示） */
  nodeTitle: string;
  /** 是否为根节点（根节点不触发检测） */
  isRoot: boolean;
}

/**
 * 摘要提示信息（驱动 UI 层显示提示弹窗）
 */
export interface SummaryPromptInfo {
  /** 触发提示的节点 ID */
  nodeId: string;
  /** 节点标题（用于提示文案展示） */
  nodeTitle: string;
}

/**
 * 判断文本是否包含支线结束关键词
 * 关键词匹配忽略大小写，便于匹配英文短语
 * @param content - 待检测文本
 * @returns 包含结束语关键词返回 true，否则返回 false
 */
export const containsBranchEndKeyword = (content: string): boolean => {
  if (!content) return false;
  const lower = content.toLowerCase();
  return BRANCH_END_KEYWORDS.some(kw => lower.includes(kw.toLowerCase()));
};

/**
 * 检测轮数信号
 * 规则：用户消息数 >= 4 且最后一条消息是 AI 回答
 * @param messages - 当前对话消息列表
 * @returns 满足轮数信号返回 true，否则返回 false
 */
export const checkRoundSignal = (messages: IMessage[]): boolean => {
  if (messages.length === 0) return false;
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  const lastMsg = messages[messages.length - 1];
  return userMsgCount >= BRANCH_END_ROUND_MIN && lastMsg?.role === 'assistant';
};

/**
 * 检测时间信号
 * 规则：最后一条消息时间距今超过 3 分钟（180 秒）
 * @param messages - 当前对话消息列表
 * @param now - 当前时间戳，默认 Date.now()，便于测试注入
 * @returns 满足时间信号返回 true，否则返回 false
 */
export const checkTimeSignal = (messages: IMessage[], now: number = Date.now()): boolean => {
  if (messages.length === 0) return false;
  const lastMsg = messages[messages.length - 1];
  const lastTime = new Date(lastMsg.timestamp).getTime();
  // 时间戳异常时按不满足处理，避免误触发
  if (Number.isNaN(lastTime)) return false;
  return (now - lastTime) > BRANCH_END_TIMEOUT_MS;
};

/**
 * 检测语义信号
 * 规则：最后一条用户消息包含结束语关键词
 * @param messages - 当前对话消息列表
 * @returns 满足语义信号返回 true，否则返回 false
 */
export const checkSemanticSignal = (messages: IMessage[]): boolean => {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      return containsBranchEndKeyword(messages[i].content);
    }
  }
  return false;
};

/**
 * 对话状态接口
 */
interface ChatState {
  messages: IMessage[];
  isLoading: boolean;
  error: string | null;

  /** 已提示过摘要的节点 ID 集合（每个节点只自动提示一次，避免重复打扰） */
  summaryPromptedNodeIds: Set<string>;
  /** 当前支线结束检测定时器（3 分钟无新消息后触发） */
  branchEndTimer: ReturnType<typeof setTimeout> | null;
  /** 当前待显示的摘要提示信息（null 表示无提示） */
  showSummaryPrompt: SummaryPromptInfo | null;

  addMessage: (message: Omit<IMessage, '_id' | 'timestamp'>) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  /**
   * 检测支线结束条件
   * 综合轮数、时间、语义三种信号，满足任意一条且节点未提示过时触发摘要提示
   * 异常情况按不触发处理，避免阻塞主对话流程
   * @param args - 检测参数，包含节点 ID、消息列表、标题、是否根节点
   */
  checkBranchEnd: (args: BranchEndCheckArgs) => void;

  /**
   * 重置 3 分钟无新消息定时器
   * 每次有新消息（用户或 AI）时调用，定时器触发后会再次调用 checkBranchEnd
   * 根节点或无消息时不启动定时器
   * @param args - 检测参数
   */
  resetBranchEndTimer: (args: BranchEndCheckArgs) => void;

  /**
   * 清理支线结束检测器
   * 清理定时器，组件卸载或节点切换时调用，避免内存泄漏与跨节点误触发
   */
  clearBranchEndDetector: () => void;

  /**
   * 关闭当前摘要提示
   * 用户点击"忽略"或"立即生成"后调用，重置 showSummaryPrompt
   */
  dismissSummaryPrompt: () => void;

  /**
   * 标记节点已提示过摘要
   * 防止后续重复自动提示（用户手动生成摘要时也可调用）
   * @param nodeId - 节点 ID
   */
  markNodeSummaryPrompted: (nodeId: string) => void;
}

/**
 * 生成唯一ID
 */
const generateId = () => Math.random().toString(36).substring(2, 15);

/**
 * 对话状态管理Store
 */
export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,

  summaryPromptedNodeIds: new Set<string>(),
  branchEndTimer: null,
  showSummaryPrompt: null,

  addMessage: (message) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          ...message,
          _id: generateId(),
          timestamp: new Date()
        }
      ]
    }));
  },

  updateLastMessage: (content) => {
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content
        };
      }
      return { messages };
    });
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },

  /**
   * 检测支线结束条件实现
   * 满足轮数/时间/语义任意信号且节点未提示过时，设置 showSummaryPrompt 并标记节点
   * 所有异常被捕获并记录日志，不抛出，避免阻塞主对话流程
   */
  checkBranchEnd: (args: BranchEndCheckArgs) => {
    try {
      const { nodeId, messages, nodeTitle, isRoot } = args;
      // 根节点不触发检测
      if (isRoot) return;
      // 无消息时不触发
      if (!messages || messages.length === 0) return;

      const { summaryPromptedNodeIds } = get();
      // 每个节点只自动提示一次
      if (summaryPromptedNodeIds.has(nodeId)) return;

      const roundMet = checkRoundSignal(messages);
      const timeMet = checkTimeSignal(messages);
      const semanticMet = checkSemanticSignal(messages);

      // 满足任意一条即触发提示（宁可少生成，由 summaryPromptedNodeIds 保证不重复打扰）
      if (roundMet || timeMet || semanticMet) {
        const newPromptedSet = new Set(summaryPromptedNodeIds);
        newPromptedSet.add(nodeId);
        set({
          summaryPromptedNodeIds: newPromptedSet,
          showSummaryPrompt: { nodeId, nodeTitle }
        });
      }
    } catch (error) {
      // 检测异常时静默处理，仅记录日志，不影响对话主流程
      console.error('[chatStore] 检测支线结束失败:', error);
    }
  },

  /**
   * 重置 3 分钟无新消息定时器实现
   * 清理旧定时器后启动新定时器，定时器触发后再次调用 checkBranchEnd 进行检测
   * 根节点或无消息时不启动定时器；定时器异常被捕获，不阻塞主流程
   */
  resetBranchEndTimer: (args: BranchEndCheckArgs) => {
    try {
      const { branchEndTimer } = get();
      if (branchEndTimer) {
        clearTimeout(branchEndTimer);
      }

      // 根节点或无消息时不启动定时器
      if (args.isRoot || !args.messages || args.messages.length === 0) {
        set({ branchEndTimer: null });
        return;
      }

      const timer = setTimeout(() => {
        // 定时器触发后再次检测条件（此时时间信号必然满足，因 3 分钟无新消息）
        try {
          get().checkBranchEnd(args);
        } catch (error) {
          console.error('[chatStore] 定时器触发检测失败:', error);
        } finally {
          set({ branchEndTimer: null });
        }
      }, BRANCH_END_TIMEOUT_MS);

      set({ branchEndTimer: timer });
    } catch (error) {
      // 定时器创建异常时静默处理，仅记录日志
      console.error('[chatStore] 重置支线结束定时器失败:', error);
    }
  },

  /**
   * 清理支线结束检测器实现
   * 清理定时器引用，组件卸载或节点切换时调用
   */
  clearBranchEndDetector: () => {
    try {
      const { branchEndTimer } = get();
      if (branchEndTimer) {
        clearTimeout(branchEndTimer);
      }
      set({ branchEndTimer: null });
    } catch (error) {
      console.error('[chatStore] 清理支线结束检测器失败:', error);
    }
  },

  /**
   * 关闭当前摘要提示实现
   * 仅重置 showSummaryPrompt，不重置 summaryPromptedNodeIds（已提示过的节点不再自动提示）
   */
  dismissSummaryPrompt: () => {
    set({ showSummaryPrompt: null });
  },

  /**
   * 标记节点已提示过摘要实现
   * @param nodeId - 节点 ID
   */
  markNodeSummaryPrompted: (nodeId: string) => {
    try {
      const { summaryPromptedNodeIds } = get();
      if (summaryPromptedNodeIds.has(nodeId)) return;
      const newPromptedSet = new Set(summaryPromptedNodeIds);
      newPromptedSet.add(nodeId);
      set({ summaryPromptedNodeIds: newPromptedSet });
    } catch (error) {
      console.error('[chatStore] 标记节点摘要提示失败:', error);
    }
  }
}));

/**
 * 节点状态接口
 */
interface NodeState {
  nodes: Map<string, {
    id: string;
    title: string;
    position: { x: number; y: number };
    parentId: string | null;
    conversationId: string | null;
  }>;
  selectedNodeId: string | null;
  
  addNode: (node: { id: string; title: string; position: { x: number; y: number }; parentId?: string | null }) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  deleteNode: (id: string) => void;
}

/**
 * 节点状态管理Store
 */
export const useNodeStore = create<NodeState>((set) => ({
  nodes: new Map(),
  selectedNodeId: null,
  
  addNode: (node) => {
    set((state) => {
      const newNodes = new Map(state.nodes);
      newNodes.set(node.id, {
        ...node,
        parentId: node.parentId ?? null,
        conversationId: null
      });
      return { nodes: newNodes };
    });
  },
  
  updateNodePosition: (id, position) => {
    set((state) => {
      const newNodes = new Map(state.nodes);
      const node = newNodes.get(id);
      if (node) {
        newNodes.set(id, { ...node, position });
      }
      return { nodes: newNodes };
    });
  },
  
  selectNode: (id) => {
    set({ selectedNodeId: id });
  },
  
  deleteNode: (id) => {
    set((state) => {
      const newNodes = new Map(state.nodes);
      newNodes.delete(id);
      if (state.selectedNodeId === id) {
        return { nodes: newNodes, selectedNodeId: null };
      }
      return { nodes: newNodes };
    });
  }
}));
