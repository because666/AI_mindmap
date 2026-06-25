import { describe, expect, it } from 'vitest';
import { parseSSEStreamForDoneData } from '../services/chatService';

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  }));
}

describe('parseSSEStreamForDoneData', () => {
  it('应从 done 事件中解析标题字段', async () => {
    const response = createSseResponse([
      'data: {"type":"content","content":"智能"}\n\n',
      'data: {"type":"content","content":"标题"}\n\n',
      'event: done\n',
      'data: {"title":"智能标题"}\n\n',
    ]);

    const result = await parseSSEStreamForDoneData<{ title: string }>(response);

    expect(result.result).toEqual({ title: '智能标题' });
    expect(result.fullContent).toBe('智能标题');
  });

  it('应从 done 事件中解析结论字段', async () => {
    const response = createSseResponse([
      'data: {"type":"content","content":"核心"}\n\n',
      'event: done\n',
      'data: {"conclusion":"核心结论"}\n\n',
    ]);

    const result = await parseSSEStreamForDoneData<{ conclusion: string }>(response);

    expect(result.result).toEqual({ conclusion: '核心结论' });
    expect(result.fullContent).toBe('核心');
  });

  it('服务端返回 error 事件时应抛出明确错误', async () => {
    const response = createSseResponse([
      'event: error\n',
      'data: {"message":"内容不足"}\n\n',
    ]);

    await expect(parseSSEStreamForDoneData(response)).rejects.toThrow('内容不足');
  });

  it('标题生成内容不足错误应抛出中文提示', async () => {
    const response = createSseResponse([
      'event: error\n',
      'data: {"error":"标题生成失败，请先发送有效对话内容"}\n\n',
    ]);

    await expect(parseSSEStreamForDoneData<{ title: string }>(response)).rejects.toThrow('标题生成失败，请先发送有效对话内容');
  });

  it('结论提炼服务异常错误应抛出中文提示', async () => {
    const response = createSseResponse([
      'event: error\n',
      'data: {"message":"结论提炼失败，AI 服务暂时不可用"}\n\n',
    ]);

    await expect(parseSSEStreamForDoneData<{ conclusion: string }>(response)).rejects.toThrow('结论提炼失败，AI 服务暂时不可用');
  });

  it('error 事件数据非法时应抛出兜底错误', async () => {
    const response = createSseResponse([
      'event: error\n',
      'data: 非法数据\n\n',
    ]);

    await expect(parseSSEStreamForDoneData(response)).rejects.toThrow('请求失败，服务端返回了无效错误信息');
  });

  it('缺少 done 结构化字段时应保留流式正文供调用方兜底判断', async () => {
    const response = createSseResponse([
      'data: {"type":"content","content":"正文标题"}\n\n',
    ]);

    const result = await parseSSEStreamForDoneData<{ title: string }>(response);

    expect(result.result).toBeNull();
    expect(result.fullContent).toBe('正文标题');
  });

  it('分片跨行返回时应正确解析 done 数据', async () => {
    const response = createSseResponse([
      'event: done\nda',
      'ta: {"title":"跨块标题"}\n\n',
    ]);

    const result = await parseSSEStreamForDoneData<{ title: string }>(response);

    expect(result.result).toEqual({ title: '跨块标题' });
  });
});
