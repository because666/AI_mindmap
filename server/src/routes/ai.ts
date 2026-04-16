import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService';
import { optionalVisitorAuth } from '../middleware';

const router = Router();

/**
 * 普通聊天接口（非流式）
 */
router.post('/chat', optionalVisitorAuth, async (req: Request, res: Response) => {
  try {
    const { messages, config, model, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: '消息数组不能为空',
      });
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
 */
router.post('/chat/stream', optionalVisitorAuth, async (req: Request, res: Response) => {
  try {
    const { messages, config, model, temperature, maxTokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: '消息数组不能为空',
      });
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

    for await (const chunk of stream) {
      fullContent += chunk;

      const data = JSON.stringify({
        type: 'content',
        content: chunk,
        fullContent
      });
      res.write(`data: ${data}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', fullContent })}\n\n`);
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
  });
});

export default router;
