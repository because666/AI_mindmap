/**
 * 上下文窗口管理工具模块
 * 提供按节点粒度的上下文截断功能，确保每个节点的对话完整不被截断到半截
 * 被省略的节点用摘要替代，优先保留直接父节点链
 */

/**
 * Token估算函数 - 中文偏高估算确保安全
 * 采用 text.length * 1.2 的系数，中文约1.5 token/字，英文约0.75 token/word
 * 偏高估算确保不会超出模型上下文窗口限制
 * @param text - 需要估算的文本内容
 * @returns 估算的Token数量
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length * 1.2);
}

/**
 * 模型上下文窗口大小映射
 * 定义各AI模型支持的最大上下文Token数
 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
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
  'default': 8192,
};

/**
 * 上下文使用信息接口
 * 描述当前上下文的Token使用情况，供客户端展示上下文使用量指示器
 */
export interface ContextUsageInfo {
  /** 已使用的上下文Token数量 */
  contextTokensUsed: number;
  /** 模型上下文Token上限 */
  contextTokenLimit: number;
  /** 是否发生了截断 */
  contextTruncated: boolean;
}

/**
 * 节点消息组接口
 * 一个节点的所有消息作为一个整体，截断时以组为单位移除或保留
 * 确保同一节点的对话不会被截断到半截
 */
interface NodeMessageGroup {
  /** 节点标题，从 [节点: xxx] 系统消息中提取 */
  nodeTitle: string;
  /** 节点摘要，用于被省略时生成摘要替代消息 */
  nodeSummary?: string;
  /** 是否属于直接父节点链，父节点链优先保留 */
  isParentChain: boolean;
  /** 该节点组包含的消息列表 */
  messages: Array<{ role: string; content: string }>;
  /** 该节点组的Token总数 */
  tokenCount: number;
}

/**
 * 获取模型上下文窗口大小
 * 根据模型名称查找对应的上下文窗口大小，未匹配时使用默认值
 * @param model - 模型名称
 * @returns 上下文窗口Token上限
 */
export function getContextWindowLimit(model?: string): number {
  if (!model) return MODEL_CONTEXT_WINDOWS['default'];
  const lowerModel = model.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (key === 'default') continue;
    if (lowerModel.includes(key)) return value;
  }
  return MODEL_CONTEXT_WINDOWS['default'];
}

/**
 * 从系统消息内容中提取节点标题
 * 匹配格式为 [节点: xxx] 的系统消息，提取其中的节点标题
 * @param content - 系统消息内容
 * @returns 节点标题或null
 */
function extractNodeTitle(content: string): string | null {
  const match = content.match(/^\[节点:\s*(.+)\]$/);
  return match ? match[1].trim() : null;
}

/**
 * 将消息列表按节点粒度分组
 * 遍历消息列表，遇到 [节点: xxx] 格式的系统消息时认为是一个新节点组的开始
 * 第一个系统消息（系统提示词）单独作为一组
 * @param messages - 原始消息列表
 * @param parentChainTitles - 直接父节点链的标题列表，用于标记优先保留的组
 * @returns 节点消息组列表
 */
function groupMessagesByNode(
  messages: Array<{ role: string; content: string }>,
  parentChainTitles?: string[]
): NodeMessageGroup[] {
  const groups: NodeMessageGroup[] = [];
  let currentGroup: NodeMessageGroup | null = null;

  const parentChainSet = new Set<string>(parentChainTitles || []);

  for (const msg of messages) {
    if (msg.role === 'system') {
      const nodeTitle = extractNodeTitle(msg.content);
      if (nodeTitle) {
        currentGroup = {
          nodeTitle,
          isParentChain: parentChainSet.has(nodeTitle),
          messages: [msg],
          tokenCount: estimateTokens(msg.content),
        };
        groups.push(currentGroup);
        continue;
      }
    }

    if (currentGroup) {
      currentGroup.messages.push(msg);
      currentGroup.tokenCount += estimateTokens(msg.content);
    } else {
      currentGroup = {
        nodeTitle: '__system_prompt__',
        isParentChain: false,
        messages: [msg],
        tokenCount: estimateTokens(msg.content),
      };
      groups.push(currentGroup);
    }
  }

  return groups;
}

/**
 * 按节点粒度截断上下文消息
 * 确保每个保留的节点的对话是完整的，不会出现对话被截断到半截
 * 优先保留直接父节点链，被省略的节点用摘要替代
 *
 * 截断策略：
 * 1. 始终保留系统提示词组和当前节点组（最后一组）
 * 2. 优先保留 isParentChain=true 的组（从近到远）
 * 3. 其次保留其他组（从近到远）
 * 4. 从最远的非父节点链组开始移除，直到总Token不超过阈值
 * 5. 被移除的节点组插入摘要消息替代
 *
 * @param messages - 原始消息列表，包含系统提示词、节点标记和对话消息
 * @param model - 目标模型名称，用于确定上下文窗口大小
 * @param parentChainTitles - 直接父节点链的标题列表，这些节点优先保留
 * @returns 截断后的消息列表和上下文使用信息
 */
export function truncateContextByNode(
  messages: Array<{ role: string; content: string }>,
  model?: string,
  parentChainTitles?: string[]
): { messages: Array<{ role: string; content: string }>; contextInfo: ContextUsageInfo } {
  if (messages.length === 0) {
    return {
      messages: [],
      contextInfo: {
        contextTokensUsed: 0,
        contextTokenLimit: getContextWindowLimit(model),
        contextTruncated: false,
      },
    };
  }

  const groups = groupMessagesByNode(messages, parentChainTitles);
  const contextLimit = getContextWindowLimit(model);
  const threshold = Math.floor(contextLimit * 0.85);

  const totalTokens = groups.reduce((sum, g) => sum + g.tokenCount, 0);

  if (totalTokens <= threshold || groups.length <= 2) {
    return {
      messages: [...messages],
      contextInfo: {
        contextTokensUsed: totalTokens,
        contextTokenLimit: contextLimit,
        contextTruncated: false,
      },
    };
  }

  const systemGroup = groups[0];
  const currentGroup = groups[groups.length - 1];
  const middleGroups = groups.slice(1, groups.length - 1);

  const alwaysKeptTokens = systemGroup.tokenCount + currentGroup.tokenCount;

  const parentChainGroups: NodeMessageGroup[] = [];
  const otherGroups: NodeMessageGroup[] = [];

  for (const group of middleGroups) {
    if (group.isParentChain) {
      parentChainGroups.push(group);
    } else {
      otherGroups.push(group);
    }
  }

  const keptMiddleGroups: NodeMessageGroup[] = [];
  let usedTokens = alwaysKeptTokens;
  let truncated = false;

  for (let i = parentChainGroups.length - 1; i >= 0; i--) {
    const group = parentChainGroups[i];
    if (usedTokens + group.tokenCount <= threshold) {
      keptMiddleGroups.unshift(group);
      usedTokens += group.tokenCount;
    } else {
      truncated = true;
    }
  }

  for (let i = otherGroups.length - 1; i >= 0; i--) {
    const group = otherGroups[i];
    if (usedTokens + group.tokenCount <= threshold) {
      keptMiddleGroups.unshift(group);
      usedTokens += group.tokenCount;
    } else {
      truncated = true;
    }
  }

  const resultMessages: Array<{ role: string; content: string }> = [
    ...systemGroup.messages,
  ];

  if (truncated) {
    const omittedGroups = middleGroups.filter(
      (g) => !keptMiddleGroups.includes(g)
    );

    if (omittedGroups.length > 0) {
      resultMessages.push({
        role: 'system',
        content: '（部分早期节点对话已省略）',
      });

      for (const omitted of omittedGroups) {
        const summaryText = omitted.nodeSummary
          ? omitted.nodeSummary.substring(0, 50)
          : '';
        const summaryContent = summaryText
          ? `[省略的节点: ${omitted.nodeTitle} - ${summaryText}]`
          : `[省略的节点: ${omitted.nodeTitle}]`;
        resultMessages.push({
          role: 'system',
          content: summaryContent,
        });
      }
    }
  }

  for (const group of keptMiddleGroups) {
    resultMessages.push(...group.messages);
  }

  resultMessages.push(...currentGroup.messages);

  const finalTokens = resultMessages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  );

  return {
    messages: resultMessages,
    contextInfo: {
      contextTokensUsed: finalTokens,
      contextTokenLimit: contextLimit,
      contextTruncated: truncated,
    },
  };
}
