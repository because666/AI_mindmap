import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { fileService } from '../services/fileService';
import { optionalVisitorAuth, visitorAuth } from '../middleware';
import { sensitiveWordService } from '../services/sensitiveWordService';

const router = Router();

/**
 * 从消息数组中提取用户发送的文本内容
 * @param messages - 消息数组
 * @returns 拼接后的用户文本
 */
function extractUserText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join(' ');
}

/**
 * 普通聊天接口（非流式）
 * 使用 visitorAuth 确保封禁用户无法调用
 */
router.post('/chat', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { messages, config, model, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: '消息数组不能为空',
      });
    }

    const userText = extractUserText(messages);
    if (userText) {
      const checkResult = await sensitiveWordService.check(userText);
      if (checkResult.hasSensitiveWord) {
        return res.status(400).json({
          success: false,
          error: '消息包含敏感内容，请修改后重试',
          sensitiveWords: checkResult.matchedWords,
          riskLevel: checkResult.riskLevel,
        });
      }
    }

    const chatModel = config?.model || model;
    const chatProvider = config?.provider;
    const apiKey = config?.apiKey;
    const baseUrl = config?.baseUrl;

    const result = await aiService.chat({
      messages,
      model: chatModel,
      temperature,
      maxTokens,
      provider: chatProvider,
      apiKey,
      baseUrl,
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 流式聊天接口（SSE）
 * 使用 visitorAuth 确保封禁用户无法调用
 */
router.post('/chat/stream', visitorAuth, async (req: Request, res: Response) => {
  try {
    const { messages, config, model, temperature, maxTokens, fileIds } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: '消息数组不能为空',
      });
    }

    const userText = extractUserText(messages);
    if (userText) {
      const checkResult = await sensitiveWordService.check(userText);
      if (checkResult.hasSensitiveWord) {
        return res.status(400).json({
          success: false,
          error: '消息包含敏感内容，请修改后重试',
          sensitiveWords: checkResult.matchedWords,
          riskLevel: checkResult.riskLevel,
        });
      }
    }

    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const filesText = await fileService.getFilesTextForContext(fileIds);
      if (filesText.length > 0) {
        const lastUserMsgIndex = messages.map((m: { role: string }) => m.role).lastIndexOf('user');
        if (lastUserMsgIndex >= 0) {
          const fileParts = filesText.map(f => `--- 文件: ${f.filename} ---\n${f.text}`).join('\n\n');
          const fileContext = `\n\n[用户上传的文件内容]\n${fileParts}\n[/文件内容结束]`;
          messages[lastUserMsgIndex].content += fileContext;
        }
      }
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const chatModel = config?.model || model;
    const chatProvider = config?.provider;
    const apiKey = config?.apiKey;
    const baseUrl = config?.baseUrl;

    const stream = aiService.chatStream({
      messages,
      model: chatModel,
      temperature,
      maxTokens,
      provider: chatProvider,
      apiKey,
      baseUrl,
    });

    let fullContent = '';
    let fullThinkingContent = '';

    for await (const chunk of stream) {
      if (chunk.type === 'thinking') {
        fullThinkingContent += chunk.content;

        const data = JSON.stringify({
          type: 'thinking',
          thinkingContent: chunk.content,
          fullThinkingContent
        });
        res.write(`data: ${data}\n\n`);
      } else if (chunk.type === 'content') {
        fullContent += chunk.content;

        const data = JSON.stringify({
          type: 'content',
          content: chunk.content,
          fullContent
        });
        res.write(`data: ${data}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', fullContent, fullThinkingContent })}\n\n`);
    res.end();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const errorData = JSON.stringify({
      type: 'error',
      error: message || '流式响应过程中发生错误'
    });
    res.write(`data: ${errorData}\n\n`);
    res.end();
  }
});

/**
 * 测试 API 连接
 */
router.post('/test', optionalVisitorAuth, async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey, baseUrl } = req.body;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'API Key 不能为空',
      });
    }

    const result = await aiService.testConnection({
      provider,
      model,
      apiKey,
      baseUrl,
    });

    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取可用模型列表
 */
router.get('/models', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'glm-4-flash',
      'glm-4',
      'deepseek-chat',
      'deepseek-coder',
    ],
  });
});

/**
 * 获取 AI 服务状态
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    configured: aiService.isConfigured(),
    hasBuiltInKey: aiService.hasBuiltInApiKey(),
    defaultProvider: aiService.getDefaultProvider(),
  });
});

export default router;
