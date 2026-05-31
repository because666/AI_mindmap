import { Router, Request, Response } from 'express';
import { aiService } from '../services/aiService';
import type { AIUsageRecord } from '../services/aiService';
import { fileService } from '../services/fileService';
import { optionalVisitorAuth, visitorAuth } from '../middleware';
import { sensitiveWordService } from '../services/sensitiveWordService';
import { config as appConfig } from '../config/index.js';
import { DEFAULT_SYSTEM_PROMPT } from '../config/prompts.js';
import { truncateContextByNode } from '../utils/contextUtils.js';

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
 * 支持Provider降级通知、超时通知和用量记录
 */
router.post('/chat/stream', visitorAuth, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let currentProvider = '';
  let currentModel = '';
  let usageInfo = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  try {
    const { messages, config, model, temperature, maxTokens, fileIds, workspaceId } = req.body;

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

    const systemPrompt = appConfig.ai.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    messages.unshift({ role: 'system', content: systemPrompt });

    const chatModel = config?.model || model;
    const { messages: truncatedMessages, contextInfo } = truncateContextByNode(messages, chatModel);

    messages.length = 0;
    messages.push(...truncatedMessages);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    if (contextInfo.contextTruncated) {
      res.write(`event: context_truncated\ndata: ${JSON.stringify({ tokensUsed: contextInfo.contextTokensUsed, tokenLimit: contextInfo.contextTokenLimit })}\n\n`);
    }
    const chatProvider = config?.provider;
    const apiKey = config?.apiKey;
    const baseUrl = config?.baseUrl;

    currentProvider = chatProvider || appConfig.ai.defaultProvider;
    currentModel = chatModel || appConfig.ai.defaultModel;

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
      switch (chunk.type) {
        case 'thinking':
          fullThinkingContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'thinking',
            thinkingContent: chunk.content,
            fullThinkingContent
          })}\n\n`);
          break;

        case 'content':
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: chunk.content,
            fullContent
          })}\n\n`);
          break;

        case 'degraded':
          currentProvider = chunk.provider;
          currentModel = chunk.model;
          res.write(`event: degraded\ndata: ${JSON.stringify({ provider: chunk.provider, model: chunk.model })}\n\n`);
          break;

        case 'usage':
          usageInfo = {
            promptTokens: chunk.usage.promptTokens,
            completionTokens: chunk.usage.completionTokens,
            totalTokens: chunk.usage.totalTokens,
          };
          break;

        case 'timeout':
          res.write(`event: timeout\ndata: ${JSON.stringify({ message: 'AI响应超时，请稍后重试' })}\n\n`);
          break;
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done', fullContent, fullThinkingContent })}\n\n`);
    res.end();

    const record: AIUsageRecord = {
      visitorId: req.visitorId || '',
      workspaceId: workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      promptTokens: usageInfo.promptTokens,
      completionTokens: usageInfo.completionTokens,
      totalTokens: usageInfo.totalTokens,
      responseTimeMs: Date.now() - startTime,
      isSuccess: true,
      createdAt: new Date(),
    };
    aiService.recordUsage(record).catch(() => {});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const errorData = JSON.stringify({
      type: 'error',
      error: message || '流式响应过程中发生错误'
    });
    res.write(`data: ${errorData}\n\n`);
    res.end();

    const record: AIUsageRecord = {
      visitorId: req.visitorId || '',
      workspaceId: req.body?.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      promptTokens: usageInfo.promptTokens,
      completionTokens: usageInfo.completionTokens,
      totalTokens: usageInfo.totalTokens,
      responseTimeMs: Date.now() - startTime,
      isSuccess: false,
      errorMessage: message,
      createdAt: new Date(),
    };
    aiService.recordUsage(record).catch(() => {});
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
  const models = [
    {
      provider: 'zhipu',
      providerName: '智谱AI',
      models: [
        { id: 'glm-4-flash', name: 'GLM-4-Flash', description: '免费高速，适合日常对话' },
        { id: 'glm-4', name: 'GLM-4', description: '旗舰版，综合能力最强' },
        { id: 'glm-4v', name: 'GLM-4V', description: '多模态，支持图片理解', isMultimodal: true },
        { id: 'glm-4-plus', name: 'GLM-4-Plus', description: '增强版，性能更优' },
      ]
    },
    {
      provider: 'openai',
      providerName: 'OpenAI',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', description: '多模态旗舰，支持图文', isMultimodal: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o-Mini', description: '轻量版，性价比高', isMultimodal: true },
        { id: 'gpt-4-turbo', name: 'GPT-4-Turbo', description: '长上下文，知识更新' },
        { id: 'o1-preview', name: 'o1-Preview', description: '推理模型，适合复杂问题' },
        { id: 'o1-mini', name: 'o1-Mini', description: '轻量推理模型' },
      ]
    },
    {
      provider: 'anthropic',
      providerName: 'Anthropic',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: '推荐，综合能力优秀' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强性能，适合复杂任务' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '极速响应，适合简单任务' },
      ]
    },
    {
      provider: 'deepseek',
      providerName: 'DeepSeek',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek-V3', description: '通用对话，性价比高' },
        { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: '推理模型，深度思考' },
        { id: 'deepseek-coder', name: 'DeepSeek-Coder', description: '代码专用，编程辅助' },
      ]
    },
  ];

  res.json({
    success: true,
    data: models
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

/**
 * 获取AI用量统计
 * 需要visitorAuth中间件验证访客身份
 * @query startDate - 开始日期（ISO格式）
 * @query endDate - 结束日期（ISO格式）
 */
router.get('/usage/stats', visitorAuth, async (req: Request, res: Response) => {
  try {
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;

    if (!startDateStr || !endDateStr) {
      return res.status(400).json({
        success: false,
        error: '请提供startDate和endDate查询参数',
      });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: '日期格式无效，请使用ISO格式',
      });
    }

    const stats = await aiService.getUsageStats(startDate, endDate);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
