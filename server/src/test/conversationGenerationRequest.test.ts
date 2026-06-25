import { describe, expect, it } from 'vitest';
import type { ExtractConclusionRequest, GenerateTitleRequest } from '../routes/conversations';

function extractValidMessages(messages: Array<{ role: string; content: string }>): Array<{ role: string; content: string }> {
  return messages
    .filter((msg) => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
    .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
    .filter((msg) => msg.content.length > 0);
}

function hasValidQuestionAnswerPair(messages: Array<{ role: string; content: string }>): boolean {
  const validMessages = extractValidMessages(messages);
  return validMessages.some((msg) => msg.role === 'user') && validMessages.some((msg) => msg.role === 'assistant');
}

describe('对话生成请求协议', () => {
  it('标题生成请求应携带有效消息内容', () => {
    const request: GenerateTitleRequest = {
      messages: [
        { role: 'system', content: '节点说明' },
        { role: 'user', content: '如何拆解目标？' },
        { role: 'assistant', content: '可以先拆为阶段、任务和风险。' },
      ],
      parentNodeTitle: '目标管理',
    };

    expect(hasValidQuestionAnswerPair(request.messages)).toBe(true);
    expect(extractValidMessages(request.messages)).toEqual([
      { role: 'user', content: '如何拆解目标？' },
      { role: 'assistant', content: '可以先拆为阶段、任务和风险。' },
    ]);
  });

  it('标题生成请求内容不足时应被识别为无效', () => {
    const request: GenerateTitleRequest = {
      messages: [
        { role: 'user', content: '   ' },
        { role: 'system', content: '节点说明' },
      ],
    };

    expect(hasValidQuestionAnswerPair(request.messages)).toBe(false);
  });

  it('结论提炼请求应允许携带前端当前消息快照', () => {
    const request: ExtractConclusionRequest = {
      nodeId: 'node-1',
      messages: [
        { role: 'user', content: '项目最大风险是什么？' },
        { role: 'assistant', content: '最大风险是范围不清和验证不足。' },
      ],
    };

    expect(request.messages).toBeDefined();
    expect(hasValidQuestionAnswerPair(request.messages || [])).toBe(true);
  });

  it('结论提炼请求只有单边消息时应被识别为内容不足', () => {
    const request: ExtractConclusionRequest = {
      nodeId: 'node-1',
      messages: [
        { role: 'user', content: '请总结' },
      ],
    };

    expect(hasValidQuestionAnswerPair(request.messages || [])).toBe(false);
  });
});
