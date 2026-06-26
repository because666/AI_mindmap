import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

/**
 * 通过 vi.hoisted 提升的 mock 函数
 * 用于在 vi.mock 工厂函数中引用，确保 mock 在模块加载前完成
 */
const {
  mockGetNode,
  mockUpdateNode,
  mockGetConversationByNodeId,
  mockGetConversationMessages,
  mockChatStreamWithQueue,
  mockRecordUsage,
  mockConfig,
} = vi.hoisted(() => ({
  mockGetNode: vi.fn(),
  mockUpdateNode: vi.fn(),
  mockGetConversationByNodeId: vi.fn(),
  mockGetConversationMessages: vi.fn(),
  mockChatStreamWithQueue: vi.fn(),
  mockRecordUsage: vi.fn(),
  mockConfig: {
    ai: {
      defaultProvider: 'zhipu',
      defaultModel: 'glm-4-flash',
    },
  },
}));

/**
 * Mock nodeService，避免真实数据库连接
 */
vi.mock('../services/nodeService', () => ({
  nodeService: {
    getNode: mockGetNode,
    updateNode: mockUpdateNode,
  },
}));

/**
 * Mock conversationService，避免真实数据库连接
 */
vi.mock('../services/conversationService', () => ({
  conversationService: {
    getConversationByNodeId: mockGetConversationByNodeId,
    getConversationMessages: mockGetConversationMessages,
  },
}));

/**
 * Mock historyService（nodes.ts 导入但摘要接口未使用，提供空实现避免副作用）
 */
vi.mock('../services/historyService', () => ({
  historyService: {
    recordAction: vi.fn(),
  },
}));

/**
 * Mock aiService，避免真实AI调用
 */
vi.mock('../services/aiService', () => ({
  aiService: {
    chatStreamWithQueue: mockChatStreamWithQueue,
    recordUsage: mockRecordUsage,
  },
}));

/**
 * Mock aiQueue，仅提供 AIPriority 枚举值（数字枚举）
 */
vi.mock('../services/aiQueue', () => ({
  AIPriority: { P0_DIALOG: 0, P1_BACKGROUND: 1 },
}));

/**
 * Mock middleware，workspaceMemberAuth 作为透传中间件
 * 从请求头读取 workspaceId/visitorId 并挂载到 req 上，模拟真实鉴权后的状态
 */
vi.mock('../middleware', () => ({
  workspaceMemberAuth: (req: Request, _res: Response, next: Function) => {
    req.workspaceId = (req.headers['x-workspace-id'] as string) || 'test-workspace';
    req.visitorId = (req.headers['x-visitor-id'] as string) || 'test-visitor';
    next();
  },
}));

/**
 * Mock aiRateLimit，createAIRateLimit 返回透传中间件，跳过限流逻辑
 */
vi.mock('../middleware/aiRateLimit', () => ({
  createAIRateLimit: () => (_req: Request, _res: Response, next: Function) => next(),
}));

/**
 * Mock config，提供默认AI服务商配置
 */
vi.mock('../config', () => ({
  config: mockConfig,
}));

import router from '../routes/nodes';

/**
 * Mock 请求体接口
 */
interface SummaryRequestBody {
  config?: {
    model?: string;
    provider?: string;
    apiKey?: string;
    baseUrl?: string;
  };
  language?: string;
}

/**
 * Mock 请求选项接口
 */
interface MockRequestOptions {
  nodeId?: string;
  workspaceId?: string;
  visitorId?: string;
  body?: SummaryRequestBody;
}

/**
 * Mock 响应结果接口
 */
interface MockResponseResult {
  statusCode: number;
  body: unknown;
  headersSent: boolean;
}

/**
 * 创建 Mock Express 请求对象
 * @param options 请求选项
 * @returns 模拟的 Express Request 对象
 * @description url 必须与路由模式 POST /:nodeId/summary 匹配，Express 才会进入对应处理器并填充 req.params.nodeId
 */
function createMockRequest(options: MockRequestOptions): Request {
  const headers: Record<string, string> = {};
  if (options.workspaceId !== undefined) {
    headers['x-workspace-id'] = options.workspaceId;
  }
  if (options.visitorId !== undefined) {
    headers['x-visitor-id'] = options.visitorId;
  }
  const nodeId = options.nodeId ?? 'node-1';
  const url = `/${nodeId}/summary`;
  return {
    method: 'POST',
    url,
    originalUrl: url,
    path: url,
    headers,
    params: { nodeId },
    body: options.body ?? {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request;
}

/**
 * 创建 Mock Express 响应对象
 * @returns 包含响应对象和等待响应Promise的对象
 */
function createMockResponse(): { res: Response; waitForResponse: () => Promise<MockResponseResult> } {
  const data: MockResponseResult = { statusCode: 200, body: null, headersSent: false };
  let resolveFn: ((value: MockResponseResult) => void) | null = null;

  const res = {
    headersSent: false,
    status(code: number) {
      data.statusCode = code;
      return res;
    },
    json(body: unknown) {
      data.body = body;
      data.headersSent = true;
      if (resolveFn) {
        resolveFn(data);
      }
      return res;
    },
  } as unknown as Response;

  const waitForResponse = (): Promise<MockResponseResult> => {
    return new Promise<MockResponseResult>((resolve) => {
      resolveFn = resolve;
    });
  };

  return { res, waitForResponse };
}

/**
 * AI流式分片类型（与 aiService StreamChunk 对齐，仅覆盖摘要接口用到的分片）
 */
type MockChunk =
  | { type: 'content'; content: string }
  | { type: 'thinking'; content: string }
  | { type: 'degraded'; provider: string; model: string }
  | { type: 'usage'; usage: { promptTokens: number; completionTokens: number; totalTokens: number } }
  | { type: 'timeout' };

/**
 * 构建异步生成器，模拟 aiService.chatStreamWithQueue 的返回值
 * @param chunks 流式分片列表
 * @returns 异步生成器
 */
async function* makeStream(chunks: MockChunk[]): AsyncGenerator<MockChunk> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/**
 * 调用路由并等待响应的工具函数
 * @param options 请求选项
 * @returns 响应结果
 */
async function invokeRoute(options: MockRequestOptions): Promise<MockResponseResult> {
  const { res, waitForResponse } = createMockResponse();
  const req = createMockRequest(options);
  router(req, res, () => {});
  return waitForResponse();
}

describe('节点摘要生成接口 POST /:nodeId/summary', () => {
  beforeEach(() => {
    mockGetNode.mockReset();
    mockUpdateNode.mockReset();
    mockGetConversationByNodeId.mockReset();
    mockGetConversationMessages.mockReset();
    mockChatStreamWithQueue.mockReset();
    mockRecordUsage.mockReset();
    mockRecordUsage.mockResolvedValue(undefined);
  });

  describe('正常流程', () => {
    it('应根据对话内容生成摘要并持久化到节点', async () => {
      // 模拟节点存在且属于当前工作区
      mockGetNode.mockResolvedValue({
        id: 'node-1',
        workspaceId: 'ws-1',
        title: '测试节点',
        summary: '',
      });
      // 模拟存在对话
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      // 模拟对话消息（包含一轮问答）
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '什么是TypeScript？', timestamp: new Date() },
        { role: 'assistant', content: 'TypeScript是JavaScript的超集，添加了静态类型。', timestamp: new Date() },
      ]);
      // 模拟AI流式返回内容
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'content', content: 'TypeScript是' },
        { type: 'content', content: 'JS的超集，支持静态类型。' },
        { type: 'usage', usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } },
      ]));
      // 模拟更新成功
      mockUpdateNode.mockResolvedValue({ id: 'node-1', summary: 'TypeScript是JS的超集，支持静态类型。' });

      const response = await invokeRoute({
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        visitorId: 'visitor-1',
        body: { language: 'zh' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: { summary: 'TypeScript是JS的超集，支持静态类型。' },
      });
      // 验证摘要已持久化
      expect(mockUpdateNode).toHaveBeenCalledWith('node-1', { summary: 'TypeScript是JS的超集，支持静态类型。' });
      // 验证用量记录成功
      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      const recordArg = mockRecordUsage.mock.calls[0][0];
      expect(recordArg.isSuccess).toBe(true);
    });

    it('应支持用户自定义AI配置（model/provider/apiKey/baseUrl透传）', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'content', content: '自定义摘要' },
        { type: 'usage', usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 } },
      ]));
      mockUpdateNode.mockResolvedValue({ id: 'node-1', summary: '自定义摘要' });

      await invokeRoute({
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        body: {
          config: { model: 'gpt-4', provider: 'openai', apiKey: 'sk-xxx', baseUrl: 'https://api.openai.com' },
        },
      });

      // 验证自定义配置透传到 chatStreamWithQueue
      expect(mockChatStreamWithQueue).toHaveBeenCalledTimes(1);
      const callArgs = mockChatStreamWithQueue.mock.calls[0];
      const requestOptions = callArgs[1];
      expect(requestOptions.model).toBe('gpt-4');
      expect(requestOptions.provider).toBe('openai');
      expect(requestOptions.apiKey).toBe('sk-xxx');
      expect(requestOptions.baseUrl).toBe('https://api.openai.com');
    });

    it('应在最后一条为assistant时自动追加用户指令触发提炼', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      // 最后一条为 assistant
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'content', content: '摘要' },
        { type: 'usage', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
      ]));
      mockUpdateNode.mockResolvedValue({ id: 'node-1', summary: '摘要' });

      await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      const requestMessages = mockChatStreamWithQueue.mock.calls[0][1].messages;
      // system + user + assistant + 追加的user指令
      expect(requestMessages.length).toBe(4);
      expect(requestMessages[requestMessages.length - 1]).toEqual({
        role: 'user',
        content: '请根据以上对话内容提炼核心结论',
      });
    });

    it('应在降级分片时更新实际使用的provider/model并记录用量', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'degraded', provider: 'deepseek', model: 'deepseek-chat' },
        { type: 'content', content: '降级后摘要' },
        { type: 'usage', usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 } },
      ]));
      mockUpdateNode.mockResolvedValue({ id: 'node-1', summary: '降级后摘要' });

      await invokeRoute({
        nodeId: 'node-1',
        workspaceId: 'ws-1',
        body: { config: { provider: 'zhipu', model: 'glm-4' } },
      });

      // 验证用量记录使用了降级后的 provider/model
      const recordArg = mockRecordUsage.mock.calls[0][0];
      expect(recordArg.provider).toBe('deepseek');
      expect(recordArg.model).toBe('deepseek-chat');
      expect(recordArg.isSuccess).toBe(true);
    });
  });

  describe('异常流程', () => {
    it('节点不存在时应返回404', async () => {
      mockGetNode.mockResolvedValue(null);

      const response = await invokeRoute({ nodeId: 'not-exist', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ success: false, error: '节点不存在' });
      // 不应调用AI服务
      expect(mockChatStreamWithQueue).not.toHaveBeenCalled();
    });

    it('节点不属于当前工作区时应返回403', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'other-ws', title: 't', summary: '' });

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(403);
      expect(response.body).toEqual({ success: false, error: '无权访问该节点' });
      expect(mockChatStreamWithQueue).not.toHaveBeenCalled();
    });

    it('节点无对话内容时应返回400', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue(null);

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ success: false, error: '该节点暂无对话内容，无法生成摘要' });
    });

    it('AI服务抛出异常时应返回500并记录失败用量', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      mockChatStreamWithQueue.mockImplementation(() => {
        throw new Error('AI服务不可用');
      });

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({ success: false, error: '摘要生成失败，请稍后重试' });
      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      const recordArg = mockRecordUsage.mock.calls[0][0];
      expect(recordArg.isSuccess).toBe(false);
      expect(recordArg.errorMessage).toBe('AI服务不可用');
    });
  });

  describe('边界情况', () => {
    it('仅有user消息无assistant消息时应返回400', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '只有问题没有回答', timestamp: new Date() },
      ]);

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ success: false, error: '摘要生成需要至少一轮有效问答' });
    });

    it('仅有assistant消息无user消息时应返回400', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'assistant', content: '只有回答没有问题', timestamp: new Date() },
      ]);

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ success: false, error: '摘要生成需要至少一轮有效问答' });
    });

    it('消息内容为空白时应被过滤并视为无有效问答', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      // 内容为空字符串或纯空白
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '   ', timestamp: new Date() },
        { role: 'assistant', content: '', timestamp: new Date() },
      ]);

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(400);
      expect(response.body).toEqual({ success: false, error: '摘要生成需要至少一轮有效问答' });
    });

    it('AI产出内容为空时应返回500并记录失败用量', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      // AI未产出任何有效内容
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'content', content: '   ' },
        { type: 'usage', usage: { promptTokens: 5, completionTokens: 0, totalTokens: 5 } },
      ]));

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(500);
      expect(response.body).toEqual({ success: false, error: 'AI未生成有效摘要，请稍后重试' });
      // 不应调用 updateNode
      expect(mockUpdateNode).not.toHaveBeenCalled();
      // 应记录失败用量
      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      expect(mockRecordUsage.mock.calls[0][0].isSuccess).toBe(false);
    });

    it('updateNode返回null（节点被并发删除）时应返回404并记录失败用量', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'content', content: '有效摘要' },
        { type: 'usage', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
      ]));
      // 节点在AI处理期间被删除
      mockUpdateNode.mockResolvedValue(null);

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(404);
      expect(response.body).toEqual({ success: false, error: '节点更新失败，可能已被删除' });
      expect(mockRecordUsage).toHaveBeenCalledTimes(1);
      expect(mockRecordUsage.mock.calls[0][0].isSuccess).toBe(false);
    });

    it('应使用thinking内容作为摘要的降级回退', async () => {
      mockGetNode.mockResolvedValue({ id: 'node-1', workspaceId: 'ws-1', title: 't', summary: '' });
      mockGetConversationByNodeId.mockResolvedValue({ id: 'conv-1', nodeId: 'node-1' });
      mockGetConversationMessages.mockResolvedValue([
        { role: 'user', content: '问题', timestamp: new Date() },
        { role: 'assistant', content: '回答', timestamp: new Date() },
      ]);
      // content为空，但 thinking 有内容
      mockChatStreamWithQueue.mockReturnValue(makeStream([
        { type: 'thinking', content: '思考过程摘要' },
        { type: 'usage', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } },
      ]));
      mockUpdateNode.mockResolvedValue({ id: 'node-1', summary: '思考过程摘要' });

      const response = await invokeRoute({ nodeId: 'node-1', workspaceId: 'ws-1' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual({ success: true, data: { summary: '思考过程摘要' } });
    });
  });
});
