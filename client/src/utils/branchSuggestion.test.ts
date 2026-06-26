import { describe, expect, it } from 'vitest';
import {
  detectBranchSuggestion,
  extractSubTopic,
} from './branchSuggestion';

describe('detectBranchSuggestion', () => {
  describe('边界情况', () => {
    it('空输入应返回 null', () => {
      expect(detectBranchSuggestion('', '泰勒展开', [])).toBeNull();
    });

    it('纯空格输入应返回 null', () => {
      expect(detectBranchSuggestion('   ', '泰勒展开', [])).toBeNull();
    });

    it('短输入（<3字符）应返回 null', () => {
      expect(detectBranchSuggestion('ab', '泰勒展开', [])).toBeNull();
    });

    it('两字符中文输入应返回 null', () => {
      expect(detectBranchSuggestion('你好', '泰勒展开', [])).toBeNull();
    });

    it('当前节点标题为空时应跳过语义偏离检测', () => {
      const result = detectBranchSuggestion('麦克劳林展开是什么', '', []);
      expect(result).toBeNull();
    });

    it('recentMessages 为空时应跳过连续追问检测', () => {
      const result = detectBranchSuggestion('继续讲讲', '泰勒展开', []);
      expect(result).toBeNull();
    });

    it('recentMessages 不足 2 条用户消息时应跳过连续追问检测', () => {
      const result = detectBranchSuggestion('继续讲讲', '泰勒展开', [
        { role: 'user', content: '泰勒展开' },
      ]);
      expect(result).toBeNull();
    });
  });

  describe('规则 A：深入关键词', () => {
    it('应命中深入关键词并提取关键词后的内容', () => {
      const result = detectBranchSuggestion('详细解释泰勒展开', '导数', []);
      expect(result).not.toBeNull();
      expect(result?.shouldSuggest).toBe(true);
      expect(result?.triggerRule).toBe('deep_dive_keyword');
      expect(result?.subTopic).toBe('泰勒展开');
      expect(result?.suggestionText).toBe(
        "这个问题更像是在聊'泰勒展开'，是否创建一个分支？",
      );
    });

    it('应命中"为什么"关键词', () => {
      const result = detectBranchSuggestion('为什么泰勒展开很重要', '导数', []);
      expect(result?.triggerRule).toBe('deep_dive_keyword');
      expect(result?.subTopic).toBe('泰勒展开很重要');
    });

    it('应命中"实现原理"关键词', () => {
      const result = detectBranchSuggestion('实现原理是这样的', '泰勒展开', []);
      expect(result?.triggerRule).toBe('deep_dive_keyword');
      expect(result?.subTopic).toBe('是这样的');
    });

    it('关键词后无内容时应使用输入前 20 字符作为子主题', () => {
      const result = detectBranchSuggestion('详细解释', '导数', []);
      expect(result?.triggerRule).toBe('deep_dive_keyword');
      expect(result?.subTopic).toBe('详细解释');
    });

    it('应在句末标点处截断子主题', () => {
      const result = detectBranchSuggestion(
        '详细解释泰勒展开。后续内容',
        '导数',
        [],
      );
      expect(result?.triggerRule).toBe('deep_dive_keyword');
      expect(result?.subTopic).toBe('泰勒展开');
    });
  });

  describe('规则 B：对比关键词', () => {
    it('应命中对比关键词并提取左侧概念', () => {
      const result = detectBranchSuggestion(
        '泰勒展开和麦克劳林有什么区别',
        '导数',
        [],
      );
      expect(result).not.toBeNull();
      expect(result?.shouldSuggest).toBe(true);
      expect(result?.triggerRule).toBe('comparison_keyword');
      expect(result?.subTopic).toBe('泰勒展开');
      expect(result?.suggestionText).toBe(
        "这个问题更像是在聊'泰勒展开'，是否创建一个分支？",
      );
    });

    it('应支持"与"作为连接词', () => {
      const result = detectBranchSuggestion(
        '泰勒展开与麦克劳林有什么不同',
        '导数',
        [],
      );
      expect(result?.triggerRule).toBe('comparison_keyword');
      expect(result?.subTopic).toBe('泰勒展开');
    });

    it('应支持"跟"作为连接词', () => {
      const result = detectBranchSuggestion(
        '泰勒展开跟麦克劳林对比',
        '导数',
        [],
      );
      expect(result?.triggerRule).toBe('comparison_keyword');
      expect(result?.subTopic).toBe('泰勒展开');
    });

    it('未提取到概念时应使用默认子主题"这个话题"', () => {
      const result = detectBranchSuggestion('有什么区别', '导数', []);
      expect(result?.triggerRule).toBe('comparison_keyword');
      expect(result?.subTopic).toBe('这个话题');
    });
  });

  describe('规则 C：语义偏离', () => {
    it('应检测语义偏离', () => {
      const result = detectBranchSuggestion(
        '麦克劳林展开是什么',
        '泰勒展开',
        [],
      );
      expect(result).not.toBeNull();
      expect(result?.shouldSuggest).toBe(true);
      expect(result?.triggerRule).toBe('semantic_drift');
      expect(result?.subTopic).toBe('麦克劳林展开是什么');
      expect(result?.suggestionText).toBe(
        "这个问题更像是在聊'麦克劳林展开是什么'，是否创建一个分支？",
      );
    });

    it('输入与标题有共同词时不应触发语义偏离', () => {
      const result = detectBranchSuggestion('泰勒展开 的应用', '泰勒展开', []);
      expect(result).toBeNull();
    });

    it('输入长度不超过 5 时不触发语义偏离', () => {
      const result = detectBranchSuggestion('好的谢谢', '泰勒展开', []);
      expect(result).toBeNull();
    });

    it('标题与输入使用空格分词时应正确判断交集', () => {
      const result = detectBranchSuggestion('微积分 的应用 场景', '泰勒展开', []);
      expect(result?.triggerRule).toBe('semantic_drift');
      expect(result?.subTopic).toBe('微积分');
    });
  });

  describe('规则 D：连续追问', () => {
    it('应检测连续追问', () => {
      const result = detectBranchSuggestion('继续讲讲', '泰勒展开', [
        { role: 'user', content: '泰勒展开 怎么用' },
        { role: 'assistant', content: '回答内容' },
        { role: 'user', content: '泰勒展开 的推导' },
        { role: 'assistant', content: '回答内容' },
      ]);
      expect(result).not.toBeNull();
      expect(result?.shouldSuggest).toBe(true);
      expect(result?.triggerRule).toBe('consecutive_followup');
      expect(result?.subTopic).toBe('泰勒展开 的推导');
      expect(result?.suggestionText).toBe(
        "这个问题更像是在聊'泰勒展开 的推导'，是否创建一个分支？",
      );
    });

    it('最近 2 轮用户消息无共同非停用词时不触发', () => {
      const result = detectBranchSuggestion('继续讲讲', '泰勒展开', [
        { role: 'user', content: '泰勒展开 怎么用' },
        { role: 'assistant', content: '回答内容' },
        { role: 'user', content: '微积分 应用' },
        { role: 'assistant', content: '回答内容' },
      ]);
      expect(result).toBeNull();
    });

    it('应只检查用户消息，忽略 assistant 消息', () => {
      const result = detectBranchSuggestion('继续', '泰勒展开', [
        { role: 'assistant', content: '泰勒展开 怎么用' },
        { role: 'assistant', content: '泰勒展开 推导' },
      ]);
      expect(result).toBeNull();
    });
  });

  describe('优先级与不命中', () => {
    it('应按优先级返回先命中的规则', () => {
      const result = detectBranchSuggestion(
        '详细解释泰勒展开和麦克劳林有什么区别',
        '导数',
        [],
      );
      expect(result?.triggerRule).toBe('deep_dive_keyword');
      expect(result?.subTopic).toBe('泰勒展开和麦克劳林有什么区别');
    });

    it('应不命中任何规则', () => {
      const result = detectBranchSuggestion('好的谢谢', '泰勒展开', []);
      expect(result).toBeNull();
    });
  });
});

describe('extractSubTopic', () => {
  it('应在提供关键词时提取关键词后的内容', () => {
    expect(extractSubTopic('详细解释泰勒展开', '详细解释')).toBe('泰勒展开');
  });

  it('应在遇到句末标点时截断', () => {
    expect(
      extractSubTopic('详细解释泰勒展开。后续内容', '详细解释'),
    ).toBe('泰勒展开');
  });

  it('应在遇到问号时截断', () => {
    expect(
      extractSubTopic('详细解释泰勒展开？后续', '详细解释'),
    ).toBe('泰勒展开');
  });

  it('应在关键词后无内容时返回空字符串', () => {
    expect(extractSubTopic('详细解释', '详细解释')).toBe('');
  });

  it('应在关键词后只有标点时返回空字符串', () => {
    expect(extractSubTopic('详细解释。', '详细解释')).toBe('');
  });

  it('应在未提供关键词时从第一个非停用词开始截取', () => {
    expect(extractSubTopic('泰勒展开的推导')).toBe('泰勒展开的推导');
  });

  it('应将结果截断为前 20 字符', () => {
    const longContent = '详细解释' + '泰勒展开'.repeat(10);
    const result = extractSubTopic(longContent, '详细解释');
    expect(result.length).toBe(20);
  });

  it('应去除首尾标点', () => {
    expect(extractSubTopic('详细解释，泰勒展开，', '详细解释')).toBe(
      '泰勒展开',
    );
  });

  it('空输入应返回空字符串', () => {
    expect(extractSubTopic('', '详细解释')).toBe('');
  });

  it('未找到关键词时应返回空字符串', () => {
    expect(extractSubTopic('泰勒展开', '详细解释')).toBe('');
  });
});
