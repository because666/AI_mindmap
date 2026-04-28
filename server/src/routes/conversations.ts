import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { nodeService } from '../services/nodeService';
import { aiService } from '../services/aiService';
import { sensitiveWordService } from '../services/sensitiveWordService';
import { fileService } from '../services/fileService';
import { workspaceMemberAuth } from '../middleware';

const router = Router();

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
 * 发送消息
 * 新增敏感词检测：用户消息包含敏感词时，拒绝发送并返回提示
 */
router.post('/:nodeId/message', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { content, role = 'user', fileIds } = req.body;

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

    if (role === 'user') {
      const contextMessages = await buildContextMessages(req.params.nodeId);

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

      const aiResponse = await aiService.chat({
        messages: contextMessages,
        model: req.body.model,
        temperature: req.body.temperature,
      });

      if (aiResponse.success && aiResponse.content) {
        await conversationService.addMessage(conversation.id, {
          role: 'assistant',
          content: aiResponse.content
        });
      }

      return res.json({
        success: true,
        data: {
          userMessage: content,
          assistantMessage: aiResponse.content,
          error: aiResponse.error,
        }
      });
    }

    res.json({ success: true, data: { message: content } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
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

    // 敏感词检测（仅检测用户消息）
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

    // 简单的内部令牌校验（生产环境应使用更安全的机制）
    if (internalToken !== process.env.INTERNAL_API_TOKEN) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (conversationId) {
      await conversationService.reloadConversation(conversationId);
    } else {
      // 如果没有指定conversationId，刷新所有缓存
      // 这里简单处理：不做全量刷新，只返回成功
    }

    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 构建上下文消息
 * @param nodeId - 节点ID
 * @returns 上下文消息列表
 */
async function buildContextMessages(nodeId: string): Promise<Array<{ role: string; content: string }>> {
  const messages: Array<{ role: string; content: string }> = [];
  const visited = new Set<string>();

  const collectContext = async (id: string, depth: number = 0) => {
    if (visited.has(id) || depth > 10) return;
    visited.add(id);

    const node = await nodeService.getNode(id);
    if (!node) return;

    for (const parentId of node.parentIds) {
      await collectContext(parentId, depth + 1);
    }

    if (node.conversationId) {
      const conv = await conversationService.getConversation(node.conversationId);
      if (conv && conv.messages.length > 0) {
        messages.push({
          role: 'system',
          content: `[节点: ${node.title}]`,
        });

        for (const msg of conv.messages) {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }
  };

  await collectContext(nodeId);
  return messages;
}

export default router;
