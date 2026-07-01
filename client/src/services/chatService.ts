import type {
  APIConfig,
  ConversationMessage,
  StreamCallback,
  StreamEvent,
  ToolCall,
} from '../types';
import { useAPIConfigStore } from '../stores/apiConfigStore';
import { getServerBaseUrl, buildAuthHeaders } from './api';
import i18n from 'i18next';

/**
 * 服务端基础URL（不含 /api 前缀）
 * 复用 api.ts 中的 getServerBaseUrl，避免重复维护 baseURL 计算逻辑
 */
const API_BASE_URL = getServerBaseUrl();

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
 * 构建用户API配置对象
 * 从全局状态获取当前激活的API配置，返回服务端所需的config格式
 * @returns 用户API配置对象，使用内置服务时返回null
 */
function buildUserConfig(): { provider: string; model: string; apiKey: string; baseUrl?: string; temperature: number } | null {
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
 * 解析SSE流并收集完整文本内容
 * 通用SSE流解析器，支持content/thinking/done/error事件类型
 * @param response - fetch Response 对象
 * @param onStream - 流式回调函数
 * @returns 解析结果，包含完整内容、标题或结论
 */
async function parseSSEStream(
  response: Response,
  onStream?: StreamCallback
): Promise<{ fullContent: string; fullThinkingContent: string; doneData: Record<string, unknown> | null; collectedToolCalls: ToolCall[]; toolCallPending: boolean }> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error(i18n.t('cannotGetResponseStream', { ns: 'chat' }));
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let fullThinkingContent = '';
  let doneData: Record<string, unknown> | null = null;
  let collectedToolCalls: ToolCall[] = [];
  let toolCallPending: boolean = false;

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
            // 提取 toolCallPending 标记
            if (data.toolCallPending) {
              toolCallPending = true;
            }
            onStream?.({
              type: 'done',
              fullContent,
              fullThinkingContent,
              toolCallPending: data.toolCallPending || undefined,
            });
          } else if (data.type === 'error') {
            onStream?.({
              type: 'error',
              error: data.error
            });
          } else if (data.type === 'tool_call' && data.tool_calls) {
            // 收集工具调用信息（追加模式，支持多次工具调用）
            collectedToolCalls = [...collectedToolCalls, ...data.tool_calls];
            // 同步通知客户端（不再等待工具执行，由客户端驱动循环控制）
            onStream?.({
              type: 'tool_call',
              tool_calls: data.tool_calls,
            });
          } else if (data.type === 'tool_result' && data.tool_results) {
            // 处理工具结果事件
            onStream?.({
              type: 'tool_result',
              tool_results: data.tool_results,
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

  return { fullContent, fullThinkingContent, doneData, collectedToolCalls, toolCallPending };
}

interface ParsedSSEData<T extends Record<string, unknown>> {
  result: T | null;
  fullContent: string;
}

interface GenerateTitleResult {
  title: string;
  rateLimited: boolean;
  error?: string;
}

interface ExtractConclusionResult {
  success: boolean;
  conclusion: string;
  rateLimited: boolean;
  error?: string;
}

/**
 * 判断对象是否为可读取字段的记录
 * @param value - 待判断的未知值
 * @returns 传入值为非空对象时返回 true，否则返回 false
 * @throws 不抛出异常，仅做类型收窄
 * @remarks 用于避免直接访问 unknown 值导致类型不安全
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 从响应体中提取中文错误信息
 * @param status - HTTP 状态码
 * @param text - 响应文本内容
 * @returns 可展示给用户的中文错误信息
 * @throws 不抛出异常，JSON 解析失败时返回兜底提示
 * @remarks 优先使用服务端 error/message 字段，缺失时按状态码返回中文提示
 */
function parseResponseError(status: number, text: string): string {
  if (text) {
    try {
      const data = JSON.parse(text) as unknown;
      if (isRecord(data)) {
        if (typeof data.error === 'string' && data.error.trim()) {
          return data.error.trim();
        }
        if (typeof data.message === 'string' && data.message.trim()) {
          return data.message.trim();
        }
      }
    } catch {
      return text;
    }
  }

  if (status === 400) {
    return '对话内容不足，请先完成至少一轮有效问答';
  }
  if (status === 429) {
    return '当前请求较频繁，请稍后重试';
  }
  if (status >= 500) {
    return '服务暂时不可用，请稍后重试';
  }
  return `请求失败，状态码：${status}`;
}

/**
 * 从SSE响应中提取done事件的data
 * 解析 event: done/error 与普通 data 内容，兼容 done 数据和内容数据跨块返回
 * @param response - fetch Response 对象
 * @returns done事件携带的数据对象和累计文本内容
 * @throws 响应流不可读或服务端返回 error 事件时抛出异常
 * @remarks 服务端 done 事件的 data 必须承载最终结构化字段，例如 title 或 conclusion
 */
export async function parseSSEStreamForDoneData<T extends Record<string, unknown>>(
  response: Response
): Promise<ParsedSSEData<T>> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';
  let doneResult: T | null = null;
  let currentEvent = 'message';

  const processLine = (line: string): void => {
    if (!line) {
      return;
    }

    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
      return;
    }

    if (!line.startsWith('data: ')) {
      return;
    }

    const dataText = line.slice(6);
    let data: unknown;
    try {
      data = JSON.parse(dataText);
    } catch {
      if (currentEvent === 'error') {
        throw new Error('请求失败，服务端返回了无效错误信息');
      }
      currentEvent = 'message';
      return;
    }

    if (currentEvent === 'done') {
      doneResult = isRecord(data) ? data as T : null;
      currentEvent = 'message';
      return;
    }

    if (currentEvent === 'error') {
      if (isRecord(data)) {
        const errorMessage = typeof data.message === 'string'
          ? data.message
          : typeof data.error === 'string'
            ? data.error
            : '请求失败';
        throw new Error(errorMessage);
      }
      throw new Error('请求失败');
    }

    if (isRecord(data) && data.type === 'content' && typeof data.content === 'string') {
      fullContent += data.content;
    }
    currentEvent = 'message';
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer) {
        processLine(buffer);
      }
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      processLine(line);
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
    messages: ConversationMessage[],
    onStream: StreamCallback,
    fileIds?: string[],
    options?: SendMessageStreamOptions,
    currentNodeId?: string
  ): Promise<{ success: boolean; content?: string; thinkingContent?: string; error?: string; sensitiveWords?: string[]; toolCalls?: ToolCall[]; toolCallPending?: boolean }> {
    try {
      const userConfig = buildUserConfig();

      const headers = await buildAuthHeaders(true);

      const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'zh';
      const requestBody: Record<string, unknown> = { messages, fileIds, language: currentLanguage };
      if (currentNodeId) {
        requestBody.currentNodeId = currentNodeId;
      }
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
              localStorage.removeItem('visitorSecret');
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

      const { fullContent, fullThinkingContent, collectedToolCalls, toolCallPending } = await parseSSEStream(response, onStream);

      return {
        success: true,
        content: fullContent,
        thinkingContent: fullThinkingContent,
        toolCalls: collectedToolCalls.length > 0 ? collectedToolCalls : undefined,
        toolCallPending: toolCallPending || undefined,
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
    parentNodeTitle?: string,
    language?: string
  ): Promise<GenerateTitleResult> {
    try {
      const userConfig = buildUserConfig();
      const headers = await buildAuthHeaders(true);

      const currentLanguage = language || (i18n.language?.startsWith('en') ? 'en' : 'zh');
      const requestBody: Record<string, unknown> = { messages, parentNodeTitle, language: currentLanguage };
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
        const errorText = await response.text();
        if (response.status === 429) {
          return { title: '', rateLimited: true, error: parseResponseError(response.status, errorText) };
        }
        return { title: '', rateLimited: false, error: parseResponseError(response.status, errorText) };
      }

      const { result } = await parseSSEStreamForDoneData<{ title: string }>(response);
      const title = typeof result?.title === 'string' ? result.title.trim() : '';
      if (!title) {
        return { title: '', rateLimited: false, error: 'AI 未生成有效标题，请稍后重试' };
      }
      return { title, rateLimited: false };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '标题生成失败，请稍后重试';
      return { title: '', rateLimited: false, error: errorMessage };
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
    nodeId: string,
    messages?: Array<{ role: string; content: string }>,
    language?: string
  ): Promise<ExtractConclusionResult> {
    try {
      const userConfig = buildUserConfig();
      const headers = await buildAuthHeaders(true);

      const currentLanguage = language || (i18n.language?.startsWith('en') ? 'en' : 'zh');
      const requestBody: Record<string, unknown> = { nodeId, messages, language: currentLanguage };
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
        const errorText = await response.text();
        if (response.status === 429) {
          return { success: false, conclusion: '', rateLimited: true, error: parseResponseError(response.status, errorText) };
        }
        return { success: false, conclusion: '', rateLimited: false, error: parseResponseError(response.status, errorText) };
      }

      const { result } = await parseSSEStreamForDoneData<{ conclusion: string }>(response);
      const conclusion = typeof result?.conclusion === 'string' ? result.conclusion.trim() : '';
      if (!conclusion) {
        return { success: false, conclusion: '', rateLimited: false, error: 'AI 未提炼出有效结论，请稍后重试' };
      }
      return { success: true, conclusion, rateLimited: false };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '结论提炼失败，请稍后重试';
      return { success: false, conclusion: '', rateLimited: false, error: errorMessage };
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
  },

  /**
   * 生成地图优先结构化大纲
   *
   * 将用户的宽泛问题发送到 /api/ai/map-outline 端点，由 AI 生成
   * 根节点标题与多个分支的结构化大纲，用于"地图优先模式"自动创建节点。
   * 内部复用 buildUserConfig 构建用户 API 配置，确保与对话请求配置一致。
   *
   * @param question - 用户输入的宽泛问题文本，需为非空字符串
   * @returns 生成结果：
   *   - success：是否成功
   *   - data：成功时返回大纲数据（rootTitle + branches），失败时为 undefined
   *   - error：失败时的错误信息
   *   - rateLimited：是否触发了限流
   *
   * @throws 不抛出异常，所有错误均通过返回值的 error 字段传递
   */
  async generateMapOutline(
    question: string
  ): Promise<{
    success: boolean;
    data?: {
      rootTitle: string;
      branches: Array<{ title: string; description: string }>;
    };
    error?: string;
    rateLimited?: boolean;
  }> {
    try {
      // 入参校验，避免空问题触发请求
      if (!question || !question.trim()) {
        return { success: false, error: '问题不能为空' };
      }

      const userConfig = buildUserConfig();
      const headers = await buildAuthHeaders(false);

      const currentLanguage = i18n.language?.startsWith('en') ? 'en' : 'zh';
      const requestBody: Record<string, unknown> = {
        question: question.trim(),
        language: currentLanguage,
      };
      if (userConfig) {
        requestBody.config = {
          apiKey: userConfig.apiKey,
          provider: userConfig.provider,
          baseUrl: userConfig.baseUrl,
          model: userConfig.model,
        };
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/map-outline`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      // 限流处理：429 状态码标记 rateLimited
      if (response.status === 429) {
        const errorText = await response.text();
        return {
          success: false,
          rateLimited: true,
          error: parseResponseError(response.status, errorText),
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: parseResponseError(response.status, errorText),
        };
      }

      const result = await parseJsonResponse(response);

      if (!result.success) {
        return {
          success: false,
          error: (result.error as string) || '生成地图大纲失败，请稍后重试',
        };
      }

      // 校验返回的数据结构
      const data = result.data as {
        rootTitle: unknown;
        branches: unknown;
      } | undefined;

      if (!data || typeof data.rootTitle !== 'string' || !Array.isArray(data.branches)) {
        return {
          success: false,
          error: 'AI 返回的大纲数据格式异常',
        };
      }

      // 规范化分支数据，确保 title/description 均为字符串
      const branches = data.branches
        .map((branch): { title: string; description: string } | null => {
          if (!branch || typeof branch !== 'object') {
            return null;
          }
          const b = branch as { title?: unknown; description?: unknown };
          if (typeof b.title !== 'string' || !b.title.trim()) {
            return null;
          }
          return {
            title: b.title.trim(),
            description: typeof b.description === 'string' ? b.description.trim() : '',
          };
        })
        .filter((branch): branch is { title: string; description: string } => branch !== null);

      if (branches.length === 0) {
        return {
          success: false,
          error: 'AI 返回的大纲分支为空',
        };
      }

      return {
        success: true,
        data: {
          rootTitle: data.rootTitle,
          branches,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '生成地图大纲时发生网络错误';
      return { success: false, error: errorMessage };
    }
  }
};
