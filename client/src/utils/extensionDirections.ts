/**
 * 解析 AI 回答中的延伸方向块
 */
export interface ParseExtensionDirectionsResult {
  /**
   * 提取到的方向标题数组
   */
  directions: string[];

  /**
   * 移除延伸方向块后的正文内容
   */
  cleanContent: string;
}

/**
 * 匹配延伸方向块的标记正则表达式
 * 支持中文 "🌱 延伸方向：" 与英文 "🌱 Extension Directions:"
 */
const EXTENSION_MARKER_REGEX = /🌱\s*(?:延伸方向|Extension\s+Directions)\s*[:：]/iu;

/**
 * 匹配带圈数字的正则表达式
 * 支持 ① - ⑩
 */
const CIRCLED_NUMBER_REGEX = /[①②③④⑤⑥⑦⑧⑨⑩]/u;

/**
 * 匹配 Markdown 列表项的正则表达式
 * 支持无序列表（-、*）与有序列表（1.、2. 等）
 */
const LIST_ITEM_REGEX = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;

/**
 * 清理单个方向条目：去除前后空白、去除尾部描述
 *
 * @param raw - 列表项或带圈数字项捕获的原始文本
 * @returns 仅保留短方向标题的文本
 */
function cleanDirectionItem(raw: string): string {
  // 以全角/半角冒号或中文破折号作为标题与描述的分隔，仅保留前面部分
  const separatorIndex = raw.search(/[:：—]/u);

  if (separatorIndex === -1) {
    return raw.trim();
  }

  return raw.slice(0, separatorIndex).trim();
}

/**
 * 从带圈数字格式的文本中提取方向标题
 *
 * @param text - 标记之后的文本
 * @returns 提取到的方向标题数组
 *
 * @remarks
 * - 跳过标记后的空行，解析第一个包含内容的行。
 * - 若第一个非空行不以带圈数字开头，则视为不匹配，返回空数组以便回退到 Markdown 列表格式。
 */
function parseCircledNumberDirections(text: string): string[] {
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0) {
      continue;
    }

    if (!CIRCLED_NUMBER_REGEX.test(trimmedLine)) {
      return [];
    }

    const directions: string[] = [];
    const parts = line.split(CIRCLED_NUMBER_REGEX);

    // parts[0] 为第一个带圈数字之前的文本（通常是空格或空字符串），跳过
    for (let i = 1; i < parts.length; i += 1) {
      const part = parts[i] ?? '';
      const cleaned = cleanDirectionItem(part);
      if (cleaned.length > 0) {
        directions.push(cleaned);
      }
    }

    return directions;
  }

  return [];
}

/**
 * 从 Markdown 列表格式文本中提取方向标题
 *
 * @param text - 标记之后的文本
 * @returns 提取到的方向标题数组
 */
function parseMarkdownListDirections(text: string): string[] {
  const lines = text.split('\n');
  const directions: string[] = [];

  for (const line of lines) {
    const listMatch = LIST_ITEM_REGEX.exec(line);

    if (listMatch) {
      const cleaned = cleanDirectionItem(listMatch[1]);
      if (cleaned.length > 0) {
        directions.push(cleaned);
      }
    }
  }

  return directions;
}

/**
 * 解析 AI 回答中的延伸方向块
 *
 * @param content - 原始消息内容
 * @returns 包含 directions（方向文本数组）与 cleanContent（移除延伸方向块后的正文）的结果对象
 *
 * @remarks
 * - 当内容中不存在延伸方向标记，或标记后未解析出有效方向条目时，返回 `{ directions: [], cleanContent: content }`。
 * - 优先识别带圈数字格式（① xxx ② yyy），若第一行未识别到有效方向，则回退到 Markdown 列表格式。
 * - 英文标记 "Extension Directions" 不区分大小写。
 */
export function parseExtensionDirections(content: string): ParseExtensionDirectionsResult {
  const markerMatch = EXTENSION_MARKER_REGEX.exec(content);

  if (!markerMatch) {
    return { directions: [], cleanContent: content };
  }

  const blockStart = markerMatch.index + markerMatch[0].length;
  const block = content.slice(blockStart);
  const cleanContent = content.slice(0, markerMatch.index);

  // 优先尝试带圈数字格式
  const circledDirections = parseCircledNumberDirections(block);
  if (circledDirections.length > 0) {
    return { directions: circledDirections, cleanContent };
  }

  // 回退到 Markdown 列表格式
  const directions = parseMarkdownListDirections(block);

  if (directions.length === 0) {
    return { directions: [], cleanContent: content };
  }

  return { directions, cleanContent };
}
