import { mongoDBService } from '../data/mongodb/connection';

interface SensitiveWordConfig {
  enabled: boolean;
  words: string[];
  matchMode: 'exact' | 'fuzzy';
  autoFlag: boolean;
}

interface CheckResult {
  hasSensitiveWord: boolean;
  matchedWords: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * 敏感词检测服务
 * 从 admin_configs 集合读取配置，对用户输入进行实时检测
 */
class SensitiveWordService {
  private config: SensitiveWordConfig | null = null;
  private lastLoadTime = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1分钟缓存

  /**
   * 加载敏感词配置
   * 带缓存机制，避免频繁查询数据库
   */
  private async loadConfig(): Promise<SensitiveWordConfig | null> {
    const now = Date.now();
    if (this.config && now - this.lastLoadTime < this.CACHE_TTL) {
      return this.config;
    }

    if (!mongoDBService.isConnected()) {
      return null;
    }

    try {
      const adminConfig = await mongoDBService.findOne('admin_configs', {}) as Record<string, unknown> | null;
      if (!adminConfig) {
        return null;
      }

      const config: SensitiveWordConfig = {
        enabled: (adminConfig.sensitiveWordEnabled as boolean) ?? (adminConfig.features as Record<string, unknown>)?.sensitiveWordCheck as boolean ?? false,
        words: (adminConfig.sensitiveWords as string[]) || [],
        matchMode: (adminConfig.sensitiveWordMatchMode as 'exact' | 'fuzzy') || 'exact',
        autoFlag: (adminConfig.sensitiveWordAutoFlag as boolean) ?? true,
      };

      this.config = config;
      this.lastLoadTime = now;
      return config;
    } catch (error) {
      console.error('[敏感词] 加载配置失败:', error);
      return null;
    }
  }

  /**
   * 检测文本是否包含敏感词
   * @param text - 待检测文本
   * @returns 检测结果
   */
  async check(text: string): Promise<CheckResult> {
    const config = await this.loadConfig();

    if (!config || !config.enabled || config.words.length === 0) {
      return { hasSensitiveWord: false, matchedWords: [], riskLevel: 'low' };
    }

    const matchedWords: string[] = [];
    const lowerText = text.toLowerCase();

    for (const word of config.words) {
      if (!word || word.trim().length === 0) continue;

      const lowerWord = word.toLowerCase().trim();

      if (config.matchMode === 'exact') {
        if (lowerText.includes(lowerWord)) {
          matchedWords.push(word);
        }
      } else {
        // 模糊匹配：允许中间有1-2个字符的差异（简化实现）
        if (this.fuzzyMatch(lowerText, lowerWord)) {
          matchedWords.push(word);
        }
      }
    }

    const hasSensitiveWord = matchedWords.length > 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (matchedWords.length >= 3) {
      riskLevel = 'high';
    } else if (matchedWords.length >= 2) {
      riskLevel = 'medium';
    } else if (matchedWords.length === 1) {
      riskLevel = 'low';
    }

    return { hasSensitiveWord, matchedWords, riskLevel };
  }

  /**
   * 模糊匹配算法
   * 使用简单的包含关系判断，后续可升级为更复杂的算法
   */
  private fuzzyMatch(text: string, word: string): boolean {
    if (text.includes(word)) return true;

    // 如果词长度大于2，检查是否包含词的子串（去掉首尾各1个字符）
    if (word.length > 2) {
      const subWord = word.substring(1, word.length - 1);
      if (subWord.length >= 2 && text.includes(subWord)) return true;
    }

    return false;
  }

  /**
   * 清空缓存，强制下次重新加载配置
   */
  clearCache(): void {
    this.config = null;
    this.lastLoadTime = 0;
  }
}

export const sensitiveWordService = new SensitiveWordService();
export type { CheckResult, SensitiveWordConfig };
