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
const EXTENSION_MARKER_REGEX = /🌱\s*(?:延伸方向|Extension\s+Directions)\s*[:：]/i;

/**
 * 匹配 Markdown 列表项的正则表达式
 * 支持无序列表（-、*）与有序列表（1.、2. 等）
 */
const LIST_ITEM_REGEX = /^\s*(?:[-*]|\d+\.)\s+(.*)$/;

/**
 * 清理单个方向条目：去除前后空白、去除尾部描述
 *
 * @param raw - 列表项捕获的原始文本
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
 * 解析 AI 回答中的延伸方向块
 *
 * @param content - 原始消息内容
 * @returns 包含 directions（方向文本数组）与 cleanContent（移除延伸方向块后的正文）的结果对象
 *
 * @remarks
 * - 当内容中不存在延伸方向标记，或标记后未解析出有效方向条目时，返回 `{ directions: [], cleanContent: content }`。
 * - 标记后的内容会一直解析到字符串末尾，支持列表项中间夹杂空行或非列表行。
 * - 英文标记 "Extension Directions" 不区分大小写。
 */
export function parseExtensionDirections(content: string): ParseExtensionDirectionsResult {
  const markerMatch = EXTENSION_MARKER_REGEX.exec(content);

  if (!markerMatch) {
    return { directions: [], cleanContent: content };
  }

  const blockStart = markerMatch.index + markerMatch[0].length;
  const block = content.slice(blockStart);
  const lines = block.split('\n');

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

  if (directions.length === 0) {
    return { directions: [], cleanContent: content };
  }

  const cleanContent = content.slice(0, markerMatch.index);

  return { directions, cleanContent };
}
