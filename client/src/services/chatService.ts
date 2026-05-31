import type { APIConfig, ChatMessage, StreamEvent, StreamCallback } from '../types';
import { useAPIConfigStore } from '../stores/apiConfigStore';

/**
 * 获取 API 基础 URL
 * chatService 的路径已经包含 /api 前缀，所以 baseURL 不应重复添加 /api
 */
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    const url = import.meta.env.VITE_API_URL;
    if (url.endsWith('/api')) {
      return url.slice(0, -4);
    }
    return url;
  }
  if (import.meta.env.PROD) {
    return '';
  }
  return 'http://localhost:3001';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * 解析 JSON 响应
 * @param response - fetch Response 对象
 * @returns 解析后的JSON对象，包含success标志和可能的错误信息
 */
async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type');
  const text = await response.text();

  if (!response.ok) {
    if (contentType?.includes('application/json') && text) {
      try {
        const errorData = JSON.parse(text) as Record<string, unknown>;
        return { success: false, error: errorData.error || `HTTP ${response.status}` };
      } catch {
        return { success: false, error: `HTTP ${response.status}: ${text || 'Request failed'}` };
      }
    }
    return { success: false, error: `HTTP ${response.status}: ${text || 'Request failed'}` };
  }

  if (!text) {
    return { success: false, error: 'Empty response from server' };
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { success: false, error: 'Invalid JSON response from server' };
  }
}

/**
 * 获取本地存储的访客ID
 * @returns 访客ID或null
 */
const getLocalVisitorId = (): string | null => {
  return localStorage.getItem('visitorId');
};

/**
 * 构建用户API配置对象
 * 从全局状态获取当前激活的API配置，返回服务端所需的config格式
 * @returns 用户API配置对象，使用内置服务时返回null
 */
function buildUserConfig(): { provider: string; model: string; apiKey: string; baseUrl: string; temperature: number } | null {
  const apiConfig = useAPIConfigStore.getState().getAPIConfigFromActive();
  if (!apiConfig) return null;
  return {
    provider: apiConfig.provider,
    model: apiConfig.modelId,
    apiKey: apiConfig.apiKey,
    baseUrl: apiConfig.baseUrl,
    temperature: apiConfig.temperature
  };
}

/**
 * 构建请求头
 * 包含Content-Type和访客ID（如果存在）
 * @param acceptSSE - 是否添加SSE Accept头
 * @returns 请求头对象
 */
function buildHeaders(acceptSSE: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (acceptSSE) {
    headers['Accept'] = 'text/event-stream';
  }
  const visitorId = getLocalVisitorId();
  if (visitorId) {
    headers['X-Visitor-Id'] = visitorId;
  }
  return headers;
}

/**
 * 解析SSE流并收集完整文本内容
 * 通用SSE流解析器，支持content/thinking/done/error事件类型
 * @param response - fetch Response 对象
 * @param onStream - 流式回调函数
 * @returns 解析结果，包含完整内容、标题或结论
 */
async function parseSSEStream(
  response: Response,
  onStream?: StreamCallback
): Promise<{ fullContent: string; fullThinkingContent: string; doneData: Record<string, unknown> | null }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullThinkingContent = '';
  let doneData: Record<string, unknown> | null = null;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event: done')) {
        continue;
      }

      if (line.startsWith('event: error')) {
        continue;
      }

      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as StreamEvent & Record<string, unknown>;

          if (data.type === 'content') {
            fullContent = data.fullContent || fullContent + (data.content || '');
            onStream?.({
              type: 'content',
              content: data.content,
              fullContent,
              fullThinkingContent
            });
          } else if (data.type === 'thinking') {
            fullThinkingContent = data.fullThinkingContent || fullThinkingContent + (data.thinkingContent || '');
            onStream?.({
              type: 'thinking',
              thinkingContent: data.thinkingContent,
              fullThinkingContent,
              fullContent
            });
          } else if (data.type === 'done') {
            onStream?.({
              type: 'done',
              fullContent,
              fullThinkingContent
            });
          } else if (data.type === 'error') {
            onStream?.({
              type: 'error',
              error: data.error
            });
          }
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }

      if (line.startsWith('event: done')) {
        const nextDataIdx = lines.indexOf('data: ', lines.indexOf(line) + 1);
        if (nextDataIdx >= 0) {
          try {
            doneData = JSON.parse(lines[nextDataIdx].slice(6)) as Record<string, unknown>;
          } catch {
            // 忽略解析失败
          }
        }
      }
    }
  }

  return { fullContent, fullThinkingContent, doneData };
}

/**
 * 从SSE响应中提取done事件的data
 * 重新解析整个buffer以提取event:done对应的data行
 * @param response - fetch Response 对象
 * @returns done事件携带的数据对象，未找到时返回null
 */
async function parseSSEStreamForDoneData<T extends Record<string, unknown>>(
  response: Response
): Promise<{ result: T | null; fullContent: string }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let doneResult: T | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
          if (data.type === 'content' && typeof data.content === 'string') {
            fullContent += data.content;
          }
        } catch {
          // 忽略解析失败
        }
      }

      if (line === 'event: done') {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('data: ')) {
            try {
              doneResult = JSON.parse(lines[j].slice(6)) as T;
            } catch {
              // 忽略解析失败
            }
            break;
          }
        }
      }

      if (line === 'event: error') {
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].startsWith('data: ')) {
            try {
              const errorData = JSON.parse(lines[j].slice(6)) as Record<string, unknown>;
              throw new Error(typeof errorData.message === 'string' ? errorData.message : '请求失败');
            } catch (e) {
              if (e instanceof Error && e.message !== '请求失败') throw e;
              throw new Error('请求失败');
            }
          }
        }
      }
    }
  }

  return { result: doneResult, fullContent };
}

/**
 * 发送流式消息的选项接口
 * @property onRateLimited - 限流回调函数，当服务端返回429状态码时触发
 * @property retryAfter - 建议重试等待时间（秒），从Retry-After响应头解析
 */
interface SendMessageStreamOptions {
  onRateLimited?: (retryAfter?: number) => void;
}

/**
 * AI 聊天服务
 */
export const chatService = {
  /**
   * 发送流式聊天消息
   * @param messages - 消息列表
   * @param onStream - 流式回调函数
   * @param fileIds - 引用的文件ID列表
   * @param options - 可选配置，包含限流回调等
   * @returns 最终结果，包含成功/失败状态、内容、思考内容、错误信息、敏感词
   */
  async sendMessageStream(
    messages: ChatMessage[],
    onStream: StreamCallback,
    fileIds?: string[],
    options?: SendMessageStreamOptions
  ): Promise<{ success: boolean; content?: string; thinkingContent?: string; error?: string; sensitiveWords?: string[] }> {
    try {
      const userConfig = buildUserConfig();

      const headers = buildHeaders(true);

      const requestBody: Record<string, unknown> = { messages, fileIds };
      if (userConfig) {
        requestBody.config = userConfig;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/chat/stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let parsedError: string = `HTTP ${response.status}: ${errorText || 'Request failed'}`;
        let sensitiveWords: string[] | undefined;

        if (response.status === 400) {
          try {
            const errorData = JSON.parse(errorText) as Record<string, unknown>;
            if (Array.isArray(errorData.sensitiveWords)) {
              sensitiveWords = errorData.sensitiveWords as string[];
              parsedError = (errorData.error as string) || '消息包含敏感内容';
            }
          } catch {
            // 非JSON格式，使用原始错误文本
          }
        }

        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText) as Record<string, unknown>;
            if (errorData.code === 'BANNED') {
              localStorage.removeItem('visitorId');
              window.dispatchEvent(new CustomEvent('auth:banned', {
                detail: { error: errorData.error, code: errorData.code }
              }));
            } else if (errorData.code === 'WORKSPACE_CLOSED') {
              localStorage.removeItem('currentWorkspaceId');
              window.dispatchEvent(new CustomEvent('auth:workspace-closed', {
                detail: { error: errorData.error, code: errorData.code }
              }));
            } else if (errorData.code === 'IP_BANNED') {
              window.dispatchEvent(new CustomEvent('auth:ip-banned', {
                detail: { error: errorData.error, code: errorData.code }
              }));
            }
            parsedError = (errorData.error as string) || parsedError;
          } catch {
            // 非JSON格式，使用原始错误文本
          }
        }

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get('Retry-After');
          let retryAfter: number | undefined;
          if (retryAfterHeader) {
            const parsed = Number(retryAfterHeader);
            if (!isNaN(parsed) && parsed > 0) {
              retryAfter = parsed;
            }
          }
          options?.onRateLimited?.(retryAfter);
          parsedError = '当前使用人数较多，请稍后重试';
        }

        return {
          success: false,
          error: parsedError,
          sensitiveWords
        };
      }

      const { fullContent, fullThinkingContent } = await parseSSEStream(response, onStream);

      return {
        success: true,
        content: fullContent,
        thinkingContent: fullThinkingContent
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '网络错误';
      onStream({
        type: 'error',
        error: errorMessage
      });
      return {
        success: false,
        error: errorMessage
      };
    }
  },

  /**
   * 流式生成对话标题
   * 调用 /api/conversations/generate-title 端点，解析SSE流
   * 收集完整文本，从done事件提取最终标题
   * @param messages - 对话消息列表
   * @param parentNodeTitle - 父节点标题，用于保持语义连贯
   * @returns 生成结果，包含标题文本和是否被限流的标志
   */
  async generateTitleStream(
    messages: Array<{ role: string; content: string }>,
    parentNodeTitle?: string
  ): Promise<{ title: string; rateLimited: boolean }> {
    try {
      const userConfig = buildUserConfig();
      const headers = buildHeaders(true);

      const requestBody: Record<string, unknown> = { messages, parentNodeTitle };
      if (userConfig) {
        requestBody.config = {
          apiKey: userConfig.apiKey,
          provider: userConfig.provider,
          baseUrl: userConfig.baseUrl,
          model: userConfig.model,
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/conversations/generate-title`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return { title: '新对话', rateLimited: true };
        }
        return { title: '新对话', rateLimited: false };
      }

      const { result } = await parseSSEStreamForDoneData<{ title: string }>(response);
      return { title: result?.title || '新对话', rateLimited: false };
    } catch {
      return { title: '新对话', rateLimited: false };
    }
  },

  /**
   * 流式提炼对话结论
   * 调用 /api/conversations/extract-conclusion 端点，解析SSE流
   * 收集完整文本，从done事件提取最终结论
   * @param nodeId - 节点ID
   * @returns 提炼结果，包含成功标志、结论文本和是否被限流的标志
   */
  async extractConclusionStream(
    nodeId: string
  ): Promise<{ success: boolean; conclusion: string; rateLimited: boolean }> {
    try {
      const userConfig = buildUserConfig();
      const headers = buildHeaders(true);

      const requestBody: Record<string, unknown> = { nodeId };
      if (userConfig) {
        requestBody.config = {
          apiKey: userConfig.apiKey,
          provider: userConfig.provider,
          baseUrl: userConfig.baseUrl,
          model: userConfig.model,
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/conversations/extract-conclusion`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return { success: false, conclusion: '', rateLimited: true };
        }
        return { success: false, conclusion: '', rateLimited: false };
      }

      const { result } = await parseSSEStreamForDoneData<{ conclusion: string }>(response);
      const conclusion = result?.conclusion || '';
      return { success: conclusion.length > 0, conclusion, rateLimited: false };
    } catch {
      return { success: false, conclusion: '', rateLimited: false };
    }
  },

  /**
   * 测试 API 连接
   * @param config - API配置对象
   * @returns 测试结果，包含成功标志和提示信息
   */
  async testConnection(config: APIConfig): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: config.provider,
          model: config.modelId,
          apiKey: config.apiKey,
          baseUrl: config.baseUrl
        }),
      });

      const result = await parseJsonResponse(response);

      return {
        success: result.success as boolean,
        message: result.message as string | undefined,
        error: result.error as string | undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误'
      };
    }
  },

  /**
   * 获取 AI 服务状态
   * @returns 服务状态信息，包含是否已配置、是否有内置Key、默认Provider
   */
  async getStatus(): Promise<{
    success: boolean;
    configured?: boolean;
    hasBuiltInKey?: boolean;
    defaultProvider?: string;
    error?: string;
  }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/status`);
      const result = await parseJsonResponse(response);

      return {
        success: result.success as boolean,
        configured: result.configured as boolean | undefined,
        hasBuiltInKey: result.hasBuiltInKey as boolean | undefined,
        defaultProvider: result.defaultProvider as string | undefined,
        error: result.error as string | undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误'
      };
    }
  }
};
