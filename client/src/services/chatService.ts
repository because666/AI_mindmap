import type { APIConfig, ChatMessage, StreamEvent, StreamCallback } from '../types';

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
 */
async function parseJsonResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type');
  const text = await response.text();
  
  if (!response.ok) {
    if (contentType?.includes('application/json') && text) {
      try {
        const errorData = JSON.parse(text);
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
    return JSON.parse(text);
  } catch {
    return { success: false, error: 'Invalid JSON response from server' };
  }
}

/**
 * AI 聊天服务
 */
export const chatService = {
  /**
   * 发送聊天消息（非流式）
   */
  async sendMessage(
    messages: ChatMessage[],
    config: APIConfig
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          config: {
            provider: config.provider,
            model: config.modelId,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl
          }
        }),
      });

      const result = await parseJsonResponse(response);
      
      return {
        success: result.success,
        content: result.content,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误'
      };
    }
  },

  /**
   * 发送流式聊天消息
   * @param messages - 消息列表
   * @param config - API 配置
   * @param onStream - 流式回调函数
   * @param fileIds - 引用的文件ID列表
   * @returns 最终结果
   */
  async sendMessageStream(
    messages: ChatMessage[],
    config: APIConfig,
    onStream: StreamCallback,
    fileIds?: string[]
  ): Promise<{ success: boolean; content?: string; thinkingContent?: string; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          messages,
          config: {
            provider: config.provider,
            model: config.modelId,
            apiKey: config.apiKey,
            baseUrl: config.baseUrl
          },
          fileIds,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText || 'Request failed'}`
        };
      }

      const reader = response.body?.getReader();
      if (!reader) {
        return {
          success: false,
          error: '无法获取响应流'
        };
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let finalContent = '';
      let finalThinkingContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as StreamEvent;
              
              if (data.type === 'content') {
                finalContent = data.fullContent || finalContent + (data.content || '');
                onStream({
                  type: 'content',
                  content: data.content,
                  fullContent: finalContent,
                  fullThinkingContent: finalThinkingContent
                });
              } else if (data.type === 'thinking') {
                finalThinkingContent = data.fullThinkingContent || finalThinkingContent + (data.thinkingContent || '');
                onStream({
                  type: 'thinking',
                  thinkingContent: data.thinkingContent,
                  fullThinkingContent: finalThinkingContent,
                  fullContent: finalContent
                });
              } else if (data.type === 'done') {
                finalContent = data.fullContent || finalContent;
                finalThinkingContent = data.fullThinkingContent || finalThinkingContent;
                onStream({
                  type: 'done',
                  fullContent: finalContent,
                  fullThinkingContent: finalThinkingContent
                });
              } else if (data.type === 'error') {
                onStream({
                  type: 'error',
                  error: data.error
                });
                return {
                  success: false,
                  error: data.error
                };
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }

      return {
        success: true,
        content: finalContent,
        thinkingContent: finalThinkingContent
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
   * 测试 API 连接
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
        success: result.success,
        message: result.message,
        error: result.error
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
        success: result.success,
        configured: result.configured,
        hasBuiltInKey: result.hasBuiltInKey,
        defaultProvider: result.defaultProvider,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '网络错误'
      };
    }
  }
};
