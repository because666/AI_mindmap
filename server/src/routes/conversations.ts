import { Router, Request, Response } from 'express';
import { conversationService } from '../services/conversationService';
import { nodeService } from '../services/nodeService';
import { aiService } from '../services/aiService';
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
 */
router.post('/:nodeId/message', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { content, role = 'user' } = req.body;

    let conversation = await conversationService.getConversationByNodeId(req.params.nodeId);

    if (!conversation) {
      conversation = await conversationService.createConversation(req.params.nodeId, req.workspaceId!, req.visitorId);
    }

    await conversationService.addMessage(conversation.id, { role, content });

    if (role === 'user') {
      const contextMessages = await buildContextMessages(req.params.nodeId);
      contextMessages.push({ role: 'user', content });

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
 */
router.post('/:nodeId/save-message', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ success: false, error: 'role和content不能为空' });
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
