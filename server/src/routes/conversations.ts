import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { nodeService } from '../services/nodeService';
import { aiService } from '../services/aiService';
import type { AIUsageRecord } from '../services/aiService';
import { sensitiveWordService } from '../services/sensitiveWordService';
import { fileService } from '../services/fileService';
import { workspaceMemberAuth } from '../middleware';
import { createAIRateLimit } from '../middleware/aiRateLimit';
import { DEFAULT_SYSTEM_PROMPT, TITLE_GENERATION_PROMPT, CONCLUSION_EXTRACTION_PROMPT, getLanguageInstruction } from '../config/prompts.js';
import { config } from '../config/index.js';
import { estimateTokens, truncateContextByNode } from '../utils/contextUtils.js';
import type { ContextUsageInfo } from '../utils/contextUtils.js';
import { AIPriority } from '../services/aiQueue';

const router = Router();

const aiTaskRateLimit = createAIRateLimit({ windowMs: 60 * 1000, maxRequests: 10 });
const aiChatRateLimit = createAIRateLimit({ windowMs: 60 * 1000, maxRequests: 20 });

/**
 * 设置SSE响应头
 * @param res - Express响应对象
 */
function setSSEHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

/**
 * 记录AI用量
 * @param params - 用量记录参数
 */
function recordAIUsage(params: {
  visitorId: string;
  workspaceId: string;
  model: string;
  provider: string;
  usageInfo: { promptTokens: number; completionTokens: number; totalTokens: number };
  startTime: number;
  isSuccess: boolean;
  errorMessage?: string;
}): void {
  const record: AIUsageRecord = {
    visitorId: params.visitorId,
    workspaceId: params.workspaceId,
    model: params.model,
    provider: params.provider,
    promptTokens: params.usageInfo.promptTokens,
    completionTokens: params.usageInfo.completionTokens,
    totalTokens: params.usageInfo.totalTokens,
    responseTimeMs: Date.now() - params.startTime,
    isSuccess: params.isSuccess,
    errorMessage: params.errorMessage,
    createdAt: new Date(),
  };
  aiService.recordUsage(record).catch(() => {});
}

/**
 * 获取工作区所有对话
 */
router.get('/list', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const conversations = await conversationService.getConversationsByWorkspaceId(req.workspaceId!);
    res.json({ success: true, data: conversations });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 分页查询对话消息
 * 从独立 messages 集合查询，支持 cursor 分页
 * 查询参数：limit（默认50）、beforeTimestamp（cursor游标）
 */
router.get('/:conversationId/messages', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const beforeTimestamp = req.query.beforeTimestamp
      ? new Date(req.query.beforeTimestamp as string)
      : undefined;

    if (beforeTimestamp && isNaN(beforeTimestamp.getTime())) {
      return res.status(400).json({ success: false, error: 'beforeTimestamp 格式无效' });
    }

    const result = await conversationService.getMessagesByConversation(
      conversationId,
      limit,
      beforeTimestamp
    );

    res.json({ success: true, data: result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取节点的对话
 */
router.get('/:nodeId', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.query;
    let conversation = await conversationService.getConversationByNodeId(req.params.nodeId);

    if (!conversation) {
      conversation = await conversationService.createConversation(
        req.params.nodeId,
        req.workspaceId!,
        req.visitorId,
        id as string | undefined
      );
    }

    res.json({ success: true, data: conversation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 发送消息（SSE流式）
 * 使用优先级队列调度，对话请求使用P0最高优先级
 * 支持用户Key、用量记录、流式输出
 * 限流：每用户每分钟20次
 */
router.post('/:nodeId/message', workspaceMemberAuth, aiChatRateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let currentProvider = '';
  let currentModel = '';
  let usageInfo = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let fullContent = '';

  try {
    const { content, role = 'user', fileIds, config: userConfig } = req.body;

    if (role === 'user' && content) {
      const checkResult = await sensitiveWordService.check(content);
      if (checkResult.hasSensitiveWord) {
        return res.status(400).json({
          success: false,
          error: '消息包含敏感内容，请修改后重试',
          sensitiveWords: checkResult.matchedWords,
          riskLevel: checkResult.riskLevel,
        });
      }
    }

    let conversation = await conversationService.getConversationByNodeId(req.params.nodeId);

    if (!conversation) {
      conversation = await conversationService.createConversation(req.params.nodeId, req.workspaceId!, req.visitorId);
    }

    await conversationService.addMessage(conversation.id, { role, content });

    if (role !== 'user') {
      return res.json({ success: true, data: { message: content } });
    }

    const { messages: contextMessages, contextInfo } = await buildContextMessages(req.params.nodeId, req.body.model, req.body.language as string | undefined);

    let fileContext = '';
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      const filesText = await fileService.getFilesTextForContext(fileIds);
      if (filesText.length > 0) {
        const fileParts = filesText.map(f => `--- 文件: ${f.filename} ---\n${f.text}`).join('\n\n');
        fileContext = `\n\n[用户上传的文件内容]\n${fileParts}\n[/文件内容结束]`;
      }
    }

    const userContent = content + fileContext;
    contextMessages.push({ role: 'user', content: userContent });

    const updatedTokens = contextInfo.contextTokensUsed + estimateTokens(userContent);

    const chatModel = userConfig?.model || req.body.model;
    const chatProvider = userConfig?.provider;
    const apiKey = userConfig?.apiKey;
    const baseUrl = userConfig?.baseUrl;

    currentProvider = chatProvider || config.ai.defaultProvider;
    currentModel = chatModel || config.ai.defaultModel;

    setSSEHeaders(res);

    if (contextInfo.contextTruncated) {
      res.write(`event: context_truncated\ndata: ${JSON.stringify({ tokensUsed: contextInfo.contextTokensUsed, tokenLimit: contextInfo.contextTokenLimit })}\n\n`);
    }

    const stream = aiService.chatStreamWithQueue(
      AIPriority.P0_DIALOG,
      {
        messages: contextMessages,
        model: chatModel,
        temperature: req.body.temperature,
        provider: chatProvider,
        apiKey,
        baseUrl,
      },
      '对话请求'
    );

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'content':
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: chunk.content,
            fullContent
          })}\n\n`);
          break;

        case 'thinking':
          res.write(`data: ${JSON.stringify({
            type: 'thinking',
            thinkingContent: chunk.content,
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

    if (fullContent) {
      await conversationService.addMessage(conversation.id, {
        role: 'assistant',
        content: fullContent
      });
    }

    res.write(`event: done\ndata: ${JSON.stringify({
      contextInfo: {
        contextTokensUsed: updatedTokens,
        contextTokenLimit: contextInfo.contextTokenLimit,
        contextTruncated: contextInfo.contextTruncated,
      }
    })}\n\n`);
    res.end();

    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    if (!res.headersSent) {
      res.status(500).json({ success: false, error: message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: message || '流式响应过程中发生错误' })}\n\n`);
      res.end();
    }

    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: false,
      errorMessage: message,
    });
  }
});

/**
 * 保存消息（不触发AI回复）
 * 新增敏感词检测
 */
router.post('/:nodeId/save-message', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ success: false, error: 'role和content不能为空' });
    }

    if (role === 'user') {
      const checkResult = await sensitiveWordService.check(content);
      if (checkResult.hasSensitiveWord) {
        return res.status(400).json({
          success: false,
          error: '消息包含敏感内容，请修改后重试',
          sensitiveWords: checkResult.matchedWords,
          riskLevel: checkResult.riskLevel,
        });
      }
    }

    let conversation = await conversationService.getConversationByNodeId(req.params.nodeId);

    if (!conversation) {
      conversation = await conversationService.createConversation(req.params.nodeId, req.workspaceId!, req.visitorId);
    }

    const newMessage = await conversationService.addMessage(conversation.id, { role, content });

    res.json({ success: true, data: newMessage });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 清空对话
 */
router.delete('/:nodeId', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const conversation = await conversationService.getConversationByNodeId(req.params.nodeId);

    if (!conversation) {
      return res.status(404).json({ success: false, error: '对话不存在' });
    }

    await conversationService.clearConversation(conversation.id);
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 刷新对话缓存（内部API，供admin server调用）
 * POST /api/conversations/internal/refresh-cache
 */
router.post('/internal/refresh-cache', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.body;
    const internalToken = req.headers['x-internal-token'];

    if (internalToken !== process.env.INTERNAL_API_TOKEN) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (conversationId) {
      await conversationService.reloadConversation(conversationId);
    }

    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 结论提炼请求体接口
 */
export interface ExtractConclusionRequest {
  nodeId: string;
  workspaceId?: string;
  messages?: Array<{ role: string; content: string }>;
  config?: {
    apiKey?: string;
    provider?: string;
    baseUrl?: string;
    model?: string;
  };
}

/**
 * 结论提炼接口（SSE流式）
 * 根据节点对话内容调用AI提炼核心结论，失败时返回空结论
 * 使用优先级队列调度，后台任务使用P1优先级
 * 支持用户Key、用量记录、流式输出
 * 限流：每用户每分钟10次
 */
router.post('/extract-conclusion', workspaceMemberAuth, aiTaskRateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let currentProvider = '';
  let currentModel = '';
  let usageInfo = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let fullContent = '';
  let fullThinkingContent = '';

  try {
    const { nodeId, messages, config: userConfig, language } = req.body as ExtractConclusionRequest & { language?: string };

    if (!nodeId) {
      return res.status(400).json({ success: false, error: '节点ID不能为空', conclusion: '' });
    }

    let sourceMessages: Array<{ role: string; content: string }> = Array.isArray(messages) ? messages : [];

    if (sourceMessages.length === 0) {
      const conversation = await conversationService.getConversationByNodeId(nodeId);
      // 消息独立集合迁移后，conversation.messages 始终为空，需从独立 messages 集合查询
      if (conversation) {
        sourceMessages = await conversationService.getConversationMessages(conversation.id);
      }
    }

    const chatMessages = sourceMessages
      .filter((msg) => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
      .filter((msg) => msg.content.length > 0);

    const hasUserMessage = chatMessages.some((msg) => msg.role === 'user');
    const hasAssistantMessage = chatMessages.some((msg) => msg.role === 'assistant');

    if (!hasUserMessage || !hasAssistantMessage) {
      return res.status(400).json({ success: false, error: '结论提炼需要至少一轮有效问答', conclusion: '' });
    }

    const conclusionLanguageInstruction = getLanguageInstruction(language);
    const systemMessage: { role: string; content: string } = {
      role: 'system',
      content: CONCLUSION_EXTRACTION_PROMPT + conclusionLanguageInstruction,
    };

    const aiMessages: Array<{ role: string; content: string }> = [
      systemMessage,
      ...chatMessages,
    ];

    if (aiMessages.length > 0 && aiMessages[aiMessages.length - 1].role === 'assistant') {
      aiMessages.push({ role: 'user', content: '请根据以上对话内容提炼核心结论' });
    }

    const chatModel = userConfig?.model;
    const chatProvider = userConfig?.provider;
    const apiKey = userConfig?.apiKey;
    const baseUrl = userConfig?.baseUrl;

    currentProvider = chatProvider || config.ai.defaultProvider;
    currentModel = chatModel || config.ai.defaultModel;

    setSSEHeaders(res);

    const stream = aiService.chatStreamWithQueue(
      AIPriority.P1_BACKGROUND,
      {
        messages: aiMessages,
        temperature: 0.3,
        model: chatModel,
        provider: chatProvider,
        apiKey,
        baseUrl,
      },
      '结论提炼'
    );

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'content':
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: chunk.content,
            fullContent
          })}\n\n`);
          break;

        case 'thinking':
          fullThinkingContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'thinking',
            thinkingContent: chunk.content,
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

    const conclusion = fullContent.trim() || fullThinkingContent.trim();
    if (!conclusion) {
      const errorMessage = 'AI未提炼出有效结论，请稍后重试';
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
      res.end();

      recordAIUsage({
        visitorId: req.visitorId || '',
        workspaceId: req.workspaceId || '',
        model: currentModel,
        provider: currentProvider,
        usageInfo,
        startTime,
        isSuccess: false,
        errorMessage,
      });
      return;
    }

    res.write(`event: done\ndata: ${JSON.stringify({ conclusion })}\n\n`);
    res.end();

    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[结论提炼] 提炼结论失败:', message);

    if (!res.headersSent) {
      res.status(500).json({ success: false, error: '结论提炼失败，请稍后重试', conclusion: '' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: '结论提炼失败' })}\n\n`);
      res.end();
    }

    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: false,
      errorMessage: message,
    });
  }
});

/**
 * 标题生成请求体接口
 */
export interface GenerateTitleRequest {
  messages: Array<{ role: string; content: string }>;
  parentNodeTitle?: string;
  config?: {
    apiKey?: string;
    provider?: string;
    baseUrl?: string;
    model?: string;
  };
}

/**
 * 生成对话标题（SSE流式）
 * 根据对话内容调用AI生成精炼标题，失败时返回默认标题
 * 使用优先级队列调度，后台任务使用P1优先级
 * 支持用户Key、用量记录、流式输出
 * 限流：每用户每分钟10次
 */
router.post('/generate-title', workspaceMemberAuth, aiTaskRateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  let currentProvider = '';
  let currentModel = '';
  let usageInfo = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let fullContent = '';
  let fullThinkingContent = '';

  try {
    const { messages, parentNodeTitle, config: userConfig, language } = req.body as GenerateTitleRequest & { language?: string };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages不能为空' });
    }

    const validMessages = messages
      .filter((msg) => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
      .filter((msg) => msg.content.length > 0);
    const hasUserMessage = validMessages.some((msg) => msg.role === 'user');
    const hasAssistantMessage = validMessages.some((msg) => msg.role === 'assistant');

    if (!hasUserMessage || !hasAssistantMessage) {
      return res.status(400).json({ success: false, error: '标题生成需要至少一轮有效问答' });
    }

    const titleLanguageInstruction = getLanguageInstruction(language);
    const baseTitlePrompt = parentNodeTitle
      ? `${TITLE_GENERATION_PROMPT}\n父节点标题：${parentNodeTitle}，请保持语义连贯`
      : TITLE_GENERATION_PROMPT;
    const systemMessage: { role: string; content: string } = {
      role: 'system',
      content: baseTitlePrompt + titleLanguageInstruction,
    };

    const chatMessages: Array<{ role: string; content: string }> = [
      systemMessage,
      ...validMessages,
    ];

    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === 'assistant') {
      chatMessages.push({ role: 'user', content: '请根据以上对话内容生成标题' });
    }

    const chatModel = userConfig?.model;
    const chatProvider = userConfig?.provider;
    const apiKey = userConfig?.apiKey;
    const baseUrl = userConfig?.baseUrl;

    currentProvider = chatProvider || config.ai.defaultProvider;
    currentModel = chatModel || config.ai.defaultModel;

    setSSEHeaders(res);

    const stream = aiService.chatStreamWithQueue(
      AIPriority.P1_BACKGROUND,
      {
        messages: chatMessages,
        temperature: 0.3,
        model: chatModel,
        provider: chatProvider,
        apiKey,
        baseUrl,
      },
      '标题生成'
    );

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'content':
          fullContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'content',
            content: chunk.content,
            fullContent
          })}\n\n`);
          break;

        case 'thinking':
          fullThinkingContent += chunk.content;
          res.write(`data: ${JSON.stringify({
            type: 'thinking',
            thinkingContent: chunk.content,
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

    const title = (fullContent.trim() || fullThinkingContent.trim()).substring(0, 10);
    if (!title) {
      const errorMessage = 'AI未生成有效标题，请稍后重试';
      res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
      res.end();

      recordAIUsage({
        visitorId: req.visitorId || '',
        workspaceId: req.workspaceId || '',
        model: currentModel,
        provider: currentProvider,
        usageInfo,
        startTime,
        isSuccess: false,
        errorMessage,
      });
      return;
    }

    res.write(`event: done\ndata: ${JSON.stringify({ title })}\n\n`);
    res.end();

    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[标题生成] 生成标题失败:', message);

    if (!res.headersSent) {
      res.status(500).json({ success: false, error: '标题生成失败，请稍后重试' });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: '标题生成失败' })}\n\n`);
      res.end();
    }

    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: false,
      errorMessage: message,
    });
  }
});

/**
 * 构建上下文消息（含按节点粒度动态截断）
 * 收集当前节点及其祖先节点的对话，按节点粒度截断以适应模型上下文窗口
 * 优先保留直接父节点链，被省略的节点用摘要替代
 * @param nodeId - 节点ID
 * @param model - 目标模型名称，用于确定上下文窗口大小
 * @returns 截断后的上下文消息列表和使用信息
 */
async function buildContextMessages(
  nodeId: string,
  model?: string,
  language?: string
): Promise<{ messages: Array<{ role: string; content: string }>; contextInfo: ContextUsageInfo }> {
  const messages: Array<{ role: string; content: string }> = [];
  const parentChainTitles: string[] = [];
  const visited = new Set<string>();

  const languageInstruction = getLanguageInstruction(language);
  const systemPrompt = (config.ai.systemPrompt || DEFAULT_SYSTEM_PROMPT) + languageInstruction;
  messages.push({ role: 'system', content: systemPrompt });

  const collectContext = async (id: string, depth: number = 0, isParentChain: boolean = true) => {
    if (visited.has(id) || depth > 15) return;
    visited.add(id);

    const node = await nodeService.getNode(id);
    if (!node) return;

    if (isParentChain && depth > 0) {
      parentChainTitles.push(node.title);
    }

    for (const parentId of node.parentIds) {
      await collectContext(parentId, depth + 1, isParentChain);
    }

    if (node.conversationId) {
      // 统一从独立 messages 集合查询消息，不再读取 conversation 文档的 messages 数组
      const convMessages = await conversationService.getConversationMessages(node.conversationId);
      if (convMessages.length > 0) {
        messages.push({
          role: 'system',
          content: `[节点: ${node.title}]`,
        });

        for (const msg of convMessages) {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }
  };

  await collectContext(nodeId);

  const { messages: truncatedMessages, contextInfo } = truncateContextByNode(
    messages,
    model,
    parentChainTitles
  );

  return {
    messages: truncatedMessages,
    contextInfo,
  };
}

export default router;
