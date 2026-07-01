/**
 * 宽泛问题检测工具
 *
 * 用于在用户于空画布或根节点输入问题时，判断该问题是否足够宽泛，
 * 从而提示用户"是否先展开成地图"。采用纯规则匹配，不调用模型，
 * 设计原则为"宁可少提示不要误提示"，避免对具体问题误触发。
 */

/** 宽泛关键词列表，命中其一即视为可能宽泛（需同时通过具体词排除） */
const BROAD_KEYWORDS: readonly string[] = [
  '介绍',
  '什么是',
  '如何学习',
  '了解',
  '概述',
  '综述',
  '讲讲',
  '谈谈',
  '说说',
  '入门',
  '基础',
  '详解',
  '全面',
  '系统',
  '完整',
  '框架',
  '体系',
  '包含哪些',
  '有哪些方面',
  '涉及哪些',
];

/** 具体细节词列表，命中则视为具体问题，不再判定为宽泛 */
const SPECIFIC_KEYWORDS: readonly string[] = [
  '代码',
  '示例',
  '报错',
  '错误',
  '配置',
  '安装',
  '命令',
  '具体',
  '参数',
  '语法',
  'api',
  '函数',
  '方法',
  '变量',
];

/** 输入长度下限（字符数），低于此值不视为宽泛问题 */
const MIN_INPUT_LENGTH = 5;

/** 输入长度上限（字符数），超过此值不视为宽泛问题（避免长篇输入误判） */
const MAX_INPUT_LENGTH = 80;

/** 短句判定阈值（字符数），不以问号结尾且长度低于此值视为宽泛 */
const SHORT_PHRASE_MAX_LENGTH = 15;

/**
 * 判断输入是否为宽泛问题
 *
 * 检测规则（纯规则匹配，不调用模型，宁可少提示不要误提示）：
 * 1. 问题长度需在 5-80 字之间
 * 2. 包含宽泛关键词之一，且不包含具体细节词
 * 3. 短句兜底：不以问号结尾且长度 < 15 字 且包含至少 2 个中文字符，
 *    仅对"看起来像话题的中文短语"触发，避免对纯数字、纯英文、纯标点误判
 *
 * @param input - 用户输入的问题文本，需为已 trim 的非空字符串
 * @returns 是否为宽泛问题，true 表示应提示"是否先展开成地图"
 */
export function isBroadQuestion(input: string): boolean {
  // 输入校验：空或非字符串直接返回 false
  if (!input || typeof input !== 'string') {
    return false;
  }

  const trimmed = input.trim();
  // 长度校验：过短或过长均不视为宽泛问题
  if (trimmed.length < MIN_INPUT_LENGTH || trimmed.length > MAX_INPUT_LENGTH) {
    return false;
  }

  // 统一使用小写形式进行关键词匹配，避免大小写差异导致遗漏
  const lowerTrimmed = trimmed.toLowerCase();

  // 具体细节词命中则直接判否，避免对具体技术问题误提示
  const hasSpecific = SPECIFIC_KEYWORDS.some((keyword) =>
    lowerTrimmed.includes(keyword.toLowerCase()),
  );
  if (hasSpecific) {
    return false;
  }

  // 宽泛关键词命中则判是（统一使用 lowerTrimmed 匹配，与具体细节词风格保持一致）
  const hasBroad = BROAD_KEYWORDS.some((keyword) =>
    lowerTrimmed.includes(keyword.toLowerCase()),
  );
  if (hasBroad) {
    return true;
  }

  // 短句兜底：不以问号结尾且长度 < 15 字 且包含至少 2 个中文字符
  // 仅当输入看起来"像中文话题短语"时才触发，避免对纯数字、纯英文、纯标点误判
  const endsWithQuestionMark = /[？?]$/.test(trimmed);
  // 统计中文字符总数（不要求连续），作为"中文话题"判定依据
  // 至少 2 个中文字符即可，排除纯数字、纯标点、纯英文等无意义短句
  const chineseCharCount = (trimmed.match(/[\u4e00-\u9fa5]/g) || []).length;
  if (!endsWithQuestionMark && trimmed.length < SHORT_PHRASE_MAX_LENGTH) {
    // 必须包含至少 2 个中文字符，排除纯数字/纯标点/纯英文
    if (chineseCharCount >= 2) {
      return true;
    }
    return false;
  }

  return false;
}
