/**
 * 智能分叉检测工具
 *
 * 根据用户输入、当前节点标题和最近消息历史，判断是否建议从当前节点分叉出新的分支。
 * 检测规则按优先级执行：深入关键词 > 对比关键词 > 语义偏离 > 连续追问。
 */

/** 深入关键词列表，命中后表示用户希望对当前主题进行深入展开 */
const DEEP_DIVE_KEYWORDS: readonly string[] = [
  '详细解释',
  '深入讲解',
  '展开讲讲',
  '具体说说',
  '为什么',
  '怎么回事',
  '什么原因',
  '实现原理',
  '底层原理',
  '工作原理',
  '常见错误',
  '容易踩的坑',
  '注意事项',
  '历史背景',
  '发展历程',
  '由来',
  '最佳实践',
  '推荐方案',
  '怎么做最好',
];

/** 对比关键词列表，命中后表示用户希望对比两个概念 */
const COMPARISON_KEYWORDS: readonly string[] = [
  '有什么区别',
  '有什么不同',
  '对比',
  '优缺点',
  '优势和劣势',
  '利弊',
  '适用场景',
  '什么时候用',
  '什么情况下',
];

/** 停用词列表，用于分词后过滤无实义词汇 */
const STOP_WORDS: readonly string[] = [
  '的', '了', '是', '在', '我', '你', '他', '她', '它', '这', '那',
  '有', '没', '就', '都', '也', '还', '不', '很', '太',
  '和', '与', '跟', '及', '或', '但',
  '然后', '所以', '因为', '如果', '虽然', '不过', '可是',
  '什么', '怎么', '为什么', '如何',
];

/** 概念连接词列表，用于对比类问题中提取两个概念 */
const COMPARISON_CONNECTORS: readonly string[] = ['和', '与', '跟'];

/** 分词与清理用的标点符号正则字符类（字符串形式，便于复用） */
const PUNCTUATION_CLASS = '\\s,，。.？?！!；;：:、\\n\\r\\t';

/** 分词正则：按空格和标点切分 */
const TOKENIZE_REGEX = new RegExp(`[${PUNCTUATION_CLASS}]`, 'u');

/** 句末标点正则：用于截断子主题内容 */
const SENTENCE_END_REGEX = /[。.？?！!；;\n\r]/u;

/** 去除首尾空白和标点的正则 */
const TRIM_PUNCTUATION_REGEX = new RegExp(
  `^[${PUNCTUATION_CLASS}]+|[${PUNCTUATION_CLASS}]+$`,
  'gu',
);

/** 默认子主题，当提取结果为空时使用 */
const DEFAULT_SUBTOPIC = '这个话题';

/** 子主题最大长度（字符数） */
const MAX_SUBTOPIC_LENGTH = 20;

/** 最小输入长度（字符数），低于此值不进行任何检测 */
const MIN_INPUT_LENGTH = 3;

/** 语义偏离检测的最小输入长度阈值（字符数），输入需严格大于此值才会触发 */
const SEMANTIC_DRIFT_MIN_LENGTH = 5;

/** 触发规则类型 */
export type TriggerRule =
  | 'deep_dive_keyword'
  | 'comparison_keyword'
  | 'semantic_drift'
  | 'consecutive_followup';

/** 最近消息结构 */
export interface RecentMessage {
  /** 消息角色，如 'user'、'assistant' */
  role: string;
  /** 消息内容 */
  content: string;
}

/** 分叉建议检测结果 */
export interface BranchSuggestionResult {
  /** 是否建议分叉 */
  shouldSuggest: boolean;
  /** 提取的子主题（用于节点标题和提示文案） */
  subTopic: string;
  /** 触发的规则名称 */
  triggerRule: TriggerRule;
  /** 建议的提示文案 */
  suggestionText: string;
}

/**
 * 去除字符串首尾的空白和标点符号
 *
 * @param text - 待清理的文本
 * @returns 去除首尾空白和标点后的文本
 */
function trimPunctuation(text: string): string {
  return text.replace(TRIM_PUNCTUATION_REGEX, '');
}

/**
 * 分词：按空格和标点切分文本
 *
 * @param text - 待分词的文本
 * @returns 切分后的词元数组（已过滤空字符串）
 */
function tokenize(text: string): string[] {
  return text
    .split(TOKENIZE_REGEX)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/**
 * 过滤停用词
 *
 * @param tokens - 原始词元数组
 * @returns 仅包含非停用词的词元数组
 */
function filterStopWords(tokens: string[]): string[] {
  return tokens.filter((token) => !STOP_WORDS.includes(token));
}

/**
 * 生成提示文案
 *
 * @param subTopic - 子主题文本
 * @returns 格式化后的中文提示文案
 */
function buildSuggestionText(subTopic: string): string {
  return `这个问题更像是在聊'${subTopic}'，是否创建一个分支？`;
}

/**
 * 提取子主题
 *
 * - 若提供 keyword，则提取 keyword 之后的内容（到句末标点或结束），取前 20 字符。
 * - 若未提供 keyword，则从输入中第一个非停用词开始截取，取前 20 字符。
 * - 结果去除首尾空白和标点。
 *
 * @param input - 用户输入文本
 * @param keyword - 可选的关键词，用于定位提取起点
 * @returns 提取的子主题文本，可能为空字符串
 */
export function extractSubTopic(input: string, keyword?: string): string {
  if (input.length === 0) {
    return '';
  }

  let content: string;

  if (keyword) {
    const keywordIndex = input.indexOf(keyword);
    if (keywordIndex < 0) {
      return '';
    }
    const after = input.slice(keywordIndex + keyword.length);
    const endMatch = after.search(SENTENCE_END_REGEX);
    content = endMatch >= 0 ? after.slice(0, endMatch) : after;
  } else {
    const tokens = tokenize(input);
    const filtered = filterStopWords(tokens);
    if (filtered.length === 0) {
      return '';
    }
    const firstWord = filtered[0];
    if (!firstWord) {
      return '';
    }
    const firstIndex = input.indexOf(firstWord);
    if (firstIndex < 0) {
      return '';
    }
    content = input.slice(firstIndex);
  }

  const sliced = content.slice(0, MAX_SUBTOPIC_LENGTH);
  return trimPunctuation(sliced);
}

/**
 * 从对比类问题中提取被连接的概念
 *
 * 查找输入中第一个"和/与/跟"连接词，返回其左侧的概念文本；
 * 若左侧为空，则返回右侧概念。若未找到连接词，回退到通用子主题提取。
 *
 * @param input - 用户输入文本
 * @param comparisonKeyword - 命中的对比关键词
 * @returns 提取的概念文本，可能为空字符串
 */
function extractComparisonConcept(
  input: string,
  comparisonKeyword: string,
): string {
  const keywordIndex = input.indexOf(comparisonKeyword);
  const segment =
    keywordIndex >= 0
      ? input.slice(0, keywordIndex) +
        input.slice(keywordIndex + comparisonKeyword.length)
      : input;

  let connectorIndex = -1;
  let connectorLength = 0;
  for (const connector of COMPARISON_CONNECTORS) {
    const idx = segment.indexOf(connector);
    if (idx >= 0 && (connectorIndex < 0 || idx < connectorIndex)) {
      connectorIndex = idx;
      connectorLength = connector.length;
    }
  }

  if (connectorIndex < 0) {
    const fallback = extractSubTopic(segment);
    return fallback;
  }

  const left = segment.slice(0, connectorIndex);
  const leftCleaned = trimPunctuation(left);
  if (leftCleaned.length > 0) {
    return leftCleaned.slice(0, MAX_SUBTOPIC_LENGTH);
  }

  const right = segment.slice(connectorIndex + connectorLength);
  const rightCleaned = trimPunctuation(right);
  return rightCleaned.slice(0, MAX_SUBTOPIC_LENGTH);
}

/**
 * 规则 A：检测深入关键词
 *
 * 遍历深入关键词列表，命中第一个关键词即返回建议。
 * 子主题为关键词后的内容；若关键词后无内容，则使用输入前 20 字符。
 *
 * @param input - 用户输入文本
 * @returns 命中时返回建议结果，否则返回 null
 */
function detectDeepDiveKeyword(input: string): BranchSuggestionResult | null {
  for (const keyword of DEEP_DIVE_KEYWORDS) {
    if (!input.includes(keyword)) {
      continue;
    }
    let subTopic = extractSubTopic(input, keyword);
    if (!subTopic) {
      subTopic = trimPunctuation(input.slice(0, MAX_SUBTOPIC_LENGTH));
    }
    if (!subTopic) {
      subTopic = DEFAULT_SUBTOPIC;
    }
    return {
      shouldSuggest: true,
      subTopic,
      triggerRule: 'deep_dive_keyword',
      suggestionText: buildSuggestionText(subTopic),
    };
  }
  return null;
}

/**
 * 规则 B：检测对比关键词
 *
 * 遍历对比关键词列表，命中第一个关键词即返回建议。
 * 子主题通过连接词提取被对比的概念之一。
 *
 * @param input - 用户输入文本
 * @returns 命中时返回建议结果，否则返回 null
 */
function detectComparisonKeyword(
  input: string,
): BranchSuggestionResult | null {
  for (const keyword of COMPARISON_KEYWORDS) {
    if (!input.includes(keyword)) {
      continue;
    }
    let subTopic = extractComparisonConcept(input, keyword);
    if (!subTopic) {
      subTopic = DEFAULT_SUBTOPIC;
    }
    return {
      shouldSuggest: true,
      subTopic,
      triggerRule: 'comparison_keyword',
      suggestionText: buildSuggestionText(subTopic),
    };
  }
  return null;
}

/**
 * 规则 C：检测语义偏离
 *
 * 当用户输入与当前节点标题没有共同非停用词，且输入足够长时触发。
 * 子主题为用户输入中第一个非停用词。
 *
 * @param input - 用户输入文本
 * @param currentNodeTitle - 当前节点标题
 * @returns 命中时返回建议结果，否则返回 null
 */
function detectSemanticDrift(
  input: string,
  currentNodeTitle: string,
): BranchSuggestionResult | null {
  if (!currentNodeTitle) {
    return null;
  }
  if (input.length <= SEMANTIC_DRIFT_MIN_LENGTH) {
    return null;
  }

  const inputTokens = filterStopWords(tokenize(input));
  const titleTokens = filterStopWords(tokenize(currentNodeTitle));

  if (inputTokens.length === 0 || titleTokens.length === 0) {
    return null;
  }

  const hasOverlap = inputTokens.some((token) => titleTokens.includes(token));
  if (hasOverlap) {
    return null;
  }

  const subTopic = inputTokens[0] ?? DEFAULT_SUBTOPIC;
  return {
    shouldSuggest: true,
    subTopic,
    triggerRule: 'semantic_drift',
    suggestionText: buildSuggestionText(subTopic),
  };
}

/**
 * 规则 D：检测连续追问
 *
 * 检查最近 2 轮用户消息，若存在共同非停用词则触发。
 * 子主题为最近一条用户消息的前 20 字符。
 *
 * @param recentMessages - 最近消息历史
 * @returns 命中时返回建议结果，否则返回 null
 */
function detectConsecutiveFollowup(
  recentMessages: RecentMessage[],
): BranchSuggestionResult | null {
  const userMessages = recentMessages
    .filter((message) => message.role === 'user')
    .map((message) => message.content);

  if (userMessages.length < 2) {
    return null;
  }

  const latest = userMessages[userMessages.length - 1] ?? '';
  const previous = userMessages[userMessages.length - 2] ?? '';

  const latestTokens = new Set(filterStopWords(tokenize(latest)));
  const previousTokens = new Set(filterStopWords(tokenize(previous)));

  if (latestTokens.size === 0 || previousTokens.size === 0) {
    return null;
  }

  let hasCommon = false;
  for (const token of latestTokens) {
    if (previousTokens.has(token)) {
      hasCommon = true;
      break;
    }
  }

  if (!hasCommon) {
    return null;
  }

  let subTopic = trimPunctuation(latest.slice(0, MAX_SUBTOPIC_LENGTH));
  if (!subTopic) {
    subTopic = DEFAULT_SUBTOPIC;
  }
  return {
    shouldSuggest: true,
    subTopic,
    triggerRule: 'consecutive_followup',
    suggestionText: buildSuggestionText(subTopic),
  };
}

/**
 * 智能分叉检测主函数
 *
 * 按优先级顺序检测四类规则，命中第一个规则即返回建议结果。
 * 规则优先级：深入关键词 > 对比关键词 > 语义偏离 > 连续追问。
 *
 * 边界情况处理：
 * - 空输入或纯空格：返回 null
 * - 输入长度 < 3：返回 null
 * - currentNodeTitle 为空：跳过语义偏离检测
 * - recentMessages 不足 2 条用户消息：跳过连续追问检测
 *
 * @param input - 用户当前输入文本
 * @param currentNodeTitle - 当前所处节点的标题
 * @param recentMessages - 最近的消息历史，用于连续追问检测
 * @returns 建议结果；若无任何规则命中或输入不合法，返回 null
 *
 * @example
 * detectBranchSuggestion('详细解释泰勒展开', '导数', [])
 * // => { shouldSuggest: true, subTopic: '泰勒展开', triggerRule: 'deep_dive_keyword', ... }
 */
export function detectBranchSuggestion(
  input: string,
  currentNodeTitle: string,
  recentMessages: RecentMessage[],
): BranchSuggestionResult | null {
  if (!input || input.trim().length === 0) {
    return null;
  }

  const trimmedInput = input.trim();
  if (trimmedInput.length < MIN_INPUT_LENGTH) {
    return null;
  }

  const deepDiveResult = detectDeepDiveKeyword(trimmedInput);
  if (deepDiveResult) {
    return deepDiveResult;
  }

  const comparisonResult = detectComparisonKeyword(trimmedInput);
  if (comparisonResult) {
    return comparisonResult;
  }

  const driftResult = detectSemanticDrift(trimmedInput, currentNodeTitle);
  if (driftResult) {
    return driftResult;
  }

  const followupResult = detectConsecutiveFollowup(recentMessages);
  if (followupResult) {
    return followupResult;
  }

  return null;
}
