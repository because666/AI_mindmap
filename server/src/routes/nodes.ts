import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { nodeService } from '../services/nodeService';
import { conversationService } from '../services/conversationService';
import { historyService } from '../services/historyService';
import { aiService } from '../services/aiService';
import type { AIUsageRecord } from '../services/aiService';
import { AIPriority } from '../services/aiQueue';
import { workspaceMemberAuth } from '../middleware';
import { createAIRateLimit } from '../middleware/aiRateLimit';
import { CONCLUSION_EXTRACTION_PROMPT, getLanguageInstruction } from '../config/prompts';
import { config } from '../config';
import { Node, Relation, RelationType } from '../types';

const router = Router();

/**
 * AI任务限流器（每用户每分钟10次）
 * 与 conversations.ts 中结论提炼接口保持一致的限流策略
 */
const aiTaskRateLimit = createAIRateLimit({ windowMs: 60 * 1000, maxRequests: 10 });

/**
 * 摘要生成接口请求体
 */
interface GenerateSummaryRequest {
  /** 用户自定义AI配置（覆盖默认配置） */
  config?: {
    /** 模型名称 */
    model?: string;
    /** AI服务商 */
    provider?: string;
    /** 用户自有API Key */
    apiKey?: string;
    /** 自定义Base URL */
    baseUrl?: string;
  };
  /** 输出语言偏好（'zh' 或 'en'），默认 'zh' */
  language?: string;
}

/**
 * 记录AI用量到数据库（失败时静默忽略，不影响主流程）
 * 与 conversations.ts 中的 recordAIUsage 实现保持一致
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
 * 获取工作区内的所有节点和关系
 * 需要 X-Visitor-Id 和 X-Workspace-Id 请求头
 */
router.get('/', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const nodes = await nodeService.getAllNodes(workspaceId);
    const relations = await nodeService.getRelations(workspaceId);

    res.json({
      success: true,
      data: { nodes, relations },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 创建节点
 */
router.post('/', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const node = await nodeService.createNode(req.body, workspaceId, req.visitorId);
    await historyService.recordAction('create_node', `创建节点: ${node.title}`, undefined, node as unknown as Record<string, unknown>, workspaceId, req.visitorId);

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 获取单个节点
 */
router.get('/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const node = await nodeService.getNode(req.params.id);

    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    if (node.workspaceId !== req.workspaceId) {
      return res.status(403).json({ success: false, error: '无权访问该节点' });
    }

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 更新节点
 */
router.put('/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const before = await nodeService.getNode(req.params.id);
    const node = await nodeService.updateNode(req.params.id, req.body);

    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    await historyService.recordAction('update_node', `更新节点: ${node.title}`, before as unknown as Record<string, unknown>, node as unknown as Record<string, unknown>, req.workspaceId, req.visitorId);

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 删除节点
 */
router.delete('/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const before = await nodeService.getNode(req.params.id);
    const success = await nodeService.deleteNode(req.params.id);

    if (!success) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    await historyService.recordAction('delete_node', '删除节点', before as unknown as Record<string, unknown>, undefined, req.workspaceId, req.visitorId);

    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 创建子节点
 */
router.post('/:id/child', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const { title, id, position } = req.body;
    const workspaceId = req.workspaceId!;
    const childData: Partial<Node> = {};
    if (id) childData.id = id;
    if (position) childData.position = position;
    const node = await nodeService.createChildNode(req.params.id, title || '新分支', workspaceId, req.visitorId, childData);
    await historyService.recordAction('create_child', `创建子节点: ${node.title}`, undefined, node as unknown as Record<string, unknown>, workspaceId, req.visitorId);

    res.json({ success: true, data: node });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 生成节点摘要接口（普通JSON响应，非SSE）
 * 根据节点对话内容调用AI提炼核心结论并写入 node.summary 字段
 * 使用优先级队列调度，后台任务使用P1_BACKGROUND优先级
 * 支持用户自定义AI配置、用量记录
 * 限流：每用户每分钟10次
 * @param req.params.nodeId - 节点ID
 * @param req.body.config - 可选，用户自定义AI配置
 * @param req.body.language - 可选，输出语言偏好
 * @returns { success: true, data: { summary: string } } 摘要内容
 */
router.post('/:nodeId/summary', workspaceMemberAuth, aiTaskRateLimit, async (req: Request, res: Response) => {
  const startTime = Date.now();
  // 当前实际使用的服务商/模型，初始为默认值，遇到 degraded 分片时会被更新
  let currentProvider = '';
  let currentModel = '';
  let usageInfo = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let fullContent = '';
  let fullThinkingContent = '';

  try {
    const { nodeId } = req.params;
    if (!nodeId) {
      return res.status(400).json({ success: false, error: '节点ID不能为空' });
    }

    const { config: userConfig, language } = req.body as GenerateSummaryRequest;

    // 1. 获取节点，不存在则返回404
    const node = await nodeService.getNode(nodeId);
    if (!node) {
      return res.status(404).json({ success: false, error: '节点不存在' });
    }

    // 安全校验：节点必须属于当前工作区，防止越权访问
    if (node.workspaceId !== req.workspaceId) {
      return res.status(403).json({ success: false, error: '无权访问该节点' });
    }

    // 2. 获取节点关联的对话
    const conversation = await conversationService.getConversationByNodeId(nodeId);
    if (!conversation) {
      return res.status(400).json({ success: false, error: '该节点暂无对话内容，无法生成摘要' });
    }

    // 3. 从独立 messages 集合查询对话消息
    const sourceMessages = await conversationService.getConversationMessages(conversation.id);

    // 4. 过滤出有效的 user/assistant 消息（参考 conversations.ts:428-431）
    const chatMessages: Array<{ role: string; content: string }> = sourceMessages
      .filter((msg) => (msg.role === 'user' || msg.role === 'assistant') && typeof msg.content === 'string')
      .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
      .filter((msg) => msg.content.length > 0);

    // 5. 校验至少有一轮问答（参考 conversations.ts:433-438）
    const hasUserMessage = chatMessages.some((msg) => msg.role === 'user');
    const hasAssistantMessage = chatMessages.some((msg) => msg.role === 'assistant');
    if (!hasUserMessage || !hasAssistantMessage) {
      return res.status(400).json({ success: false, error: '摘要生成需要至少一轮有效问答' });
    }

    // 6. 构建AI消息（system=结论提炼提示词+语言指令，参考 conversations.ts:440-453）
    const languageInstruction = getLanguageInstruction(language);
    const systemMessage: { role: string; content: string } = {
      role: 'system',
      content: CONCLUSION_EXTRACTION_PROMPT + languageInstruction,
    };

    const aiMessages: Array<{ role: string; content: string }> = [
      systemMessage,
      ...chatMessages,
    ];

    // 若最后一条为 assistant，补一条用户指令触发结论提炼
    if (aiMessages[aiMessages.length - 1].role === 'assistant') {
      aiMessages.push({ role: 'user', content: '请根据以上对话内容提炼核心结论' });
    }

    // 7. 解析用户自定义AI配置，缺省回退到全局默认配置
    const chatModel = userConfig?.model;
    const chatProvider = userConfig?.provider;
    const apiKey = userConfig?.apiKey;
    const baseUrl = userConfig?.baseUrl;

    currentProvider = chatProvider || config.ai.defaultProvider;
    currentModel = chatModel || config.ai.defaultModel;

    // 8. 流式调用AI（参考 conversations.ts:465-476），后台任务使用P1优先级
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
      '节点摘要生成'
    );

    // 收集完整内容与用量信息，不向前端推送流式分片（本接口返回普通JSON）
    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'content':
          fullContent += chunk.content;
          break;
        case 'thinking':
          fullThinkingContent += chunk.content;
          break;
        case 'degraded':
          // 降级到备用服务商时更新实际使用的provider/model，用于用量记录
          currentProvider = chunk.provider;
          currentModel = chunk.model;
          break;
        case 'usage':
          usageInfo = {
            promptTokens: chunk.usage.promptTokens,
            completionTokens: chunk.usage.completionTokens,
            totalTokens: chunk.usage.totalTokens,
          };
          break;
        case 'timeout':
          // 超时分片不中断流程，继续等待后续分片
          break;
      }
    }

    // 9. 校验AI产出内容有效性（参考 conversations.ts:517）
    const summary = fullContent.trim() || fullThinkingContent.trim();
    if (!summary) {
      const errorMessage = 'AI未生成有效摘要，请稍后重试';
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
      return res.status(500).json({ success: false, error: errorMessage });
    }

    // 10. 持久化摘要到节点
    const updatedNode = await nodeService.updateNode(nodeId, { summary });
    if (!updatedNode) {
      // 节点在AI处理期间被删除等异常场景
      const errorMessage = '节点更新失败，可能已被删除';
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
      return res.status(404).json({ success: false, error: errorMessage });
    }

    // 11. 记录成功用量
    recordAIUsage({
      visitorId: req.visitorId || '',
      workspaceId: req.workspaceId || '',
      model: currentModel,
      provider: currentProvider,
      usageInfo,
      startTime,
      isSuccess: true,
    });

    // 12. 返回普通JSON响应（非SSE）
    return res.json({ success: true, data: { summary } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[节点摘要生成] 生成摘要失败:', message);

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

    // 未发送响应头时返回500错误，避免重复发送响应导致崩溃
    if (!res.headersSent) {
      return res.status(500).json({ success: false, error: '摘要生成失败，请稍后重试' });
    }
  }
});

/**
 * 获取工作区根节点
 */
router.get('/roots/list', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const nodes = await nodeService.getRootNodes(req.workspaceId!);
    res.json({ success: true, data: nodes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

router.post('/relations', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const relation = await nodeService.createRelation(req.body, workspaceId);
    res.json({ success: true, data: relation });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

router.delete('/relations/:id', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const success = await nodeService.deleteRelation(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: '关系不存在' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 导出工作区数据
 * 包含节点、关系和对话的完整数据
 * 支持格式：json（默认）、markdown
 */
router.get('/export', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const format = (req.query.format as string) || 'json';
    const nodes = await nodeService.getAllNodes(workspaceId);
    const relations = await nodeService.getRelations(workspaceId);
    const conversations = await conversationService.getConversationsByWorkspaceId(workspaceId);

    if (format === 'markdown') {
      const markdown = convertToMarkdown(nodes, relations);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="deepmindmap-export.md"`);
      return res.send(markdown);
    }

    const exportData = {
      version: '2.0',
      appName: 'DeepMindMap',
      exportedAt: new Date().toISOString(),
      workspaceId,
      nodes: nodes.map(({ workspaceId: _ws, createdBy: _cb, ...rest }) => rest),
      relations: relations.map(({ workspaceId: _ws, ...rest }) => rest),
      // 异步从独立 messages 集合查询每个对话的消息，不再读取 conversation 文档的 messages 数组
      conversations: await Promise.all(conversations.map(async (conv) => ({
        id: conv.id,
        nodeId: conv.nodeId,
        messages: await conversationService.getConversationMessages(conv.id),
        contextConfig: conv.contextConfig,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
      }))),
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="deepmindmap-export.json"`);
    res.json(exportData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 批量导入数据到工作区
 * 支持格式：json、markdown
 * 导入时会重新生成ID以避免冲突，并关联到当前工作区
 */
router.post('/import', workspaceMemberAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = req.workspaceId!;
    const visitorId = req.visitorId!;
    const { format, data } = req.body;

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ success: false, error: '导入数据不能为空' });
    }

    let importedCount = { nodes: 0, relations: 0, conversations: 0 };

    if (format === 'markdown') {
      importedCount = await importMarkdown(data, workspaceId, visitorId);
    } else {
      importedCount = await importJson(data, workspaceId, visitorId);
    }

    await historyService.recordAction(
      'import', `导入数据: ${importedCount.nodes}个节点, ${importedCount.relations}个关系`,
      undefined, undefined, workspaceId, visitorId
    );

    res.json({ success: true, data: importedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * 将节点和关系转换为Markdown大纲格式
 * @param nodes - 节点列表
 * @param relations - 关系列表
 * @returns Markdown字符串
 */
function convertToMarkdown(nodes: Node[], relations: Relation[]): string {
  const nodeMap = new Map<string, Node>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const rootNodes = nodes.filter(n => n.isRoot && !n.hidden);
  const nonParentChildRelations = relations.filter(r => r.type !== 'parent-child');

  const lines: string[] = [];
  lines.push('# DeepMindMap 思维导图导出');
  lines.push('');
  lines.push(`> 导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  /**
   * 递归渲染节点树
   * @param nodeId - 节点ID
   * @param depth - 缩进层级
   */
  const renderNode = (nodeId: string, depth: number) => {
    const node = nodeMap.get(nodeId);
    if (!node || node.hidden) return;

    const indent = '  '.repeat(depth);
    const prefix = depth === 0 ? '- ' : '  '.repeat(0) + '- ';

    if (depth === 0) {
      lines.push(`## ${node.title}`);
    } else {
      lines.push(`${indent}- ${node.title}`);
    }

    if (node.summary) {
      lines.push(`${indent}  > ${node.summary.replace(/\n/g, ' ')}`);
    }

    if (node.tags.length > 0) {
      lines.push(`${indent}  标签: ${node.tags.join(', ')}`);
    }

    for (const childId of node.childrenIds) {
      renderNode(childId, depth + 1);
    }
  };

  for (const root of rootNodes) {
    renderNode(root.id, 0);
    lines.push('');
  }

  if (nonParentChildRelations.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## 关系');
    lines.push('');
    for (const rel of nonParentChildRelations) {
      const source = nodeMap.get(rel.sourceId);
      const target = nodeMap.get(rel.targetId);
      if (source && target) {
        const typeLabel = getRelationTypeLabel(rel.type);
        const desc = rel.description ? ` — ${rel.description}` : '';
        lines.push(`- **${source.title}** → [${typeLabel}] → **${target.title}**${desc}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * 获取关系类型的中文标签
 * @param type - 关系类型
 * @returns 中文标签
 */
function getRelationTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'supports': '支持',
    'contradicts': '矛盾',
    'prerequisite': '前提',
    'elaborates': '细化',
    'references': '参考',
    'conclusion': '结论',
    'custom': '自定义',
  };
  return labels[type] || type;
}

/**
 * 导入JSON格式数据
 * @param data - JSON字符串
 * @param workspaceId - 目标工作区ID
 * @param visitorId - 操作者访客ID
 * @returns 导入计数
 */
async function importJson(data: string, workspaceId: string, visitorId: string): Promise<{ nodes: number; relations: number; conversations: number }> {
  let parsed: {
    nodes: Array<Record<string, unknown>>;
    relations: Array<Record<string, unknown>>;
    conversations: Array<Record<string, unknown>>;
  };

  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error('JSON格式无效，请检查文件内容');
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('导入数据缺少nodes字段或格式不正确');
  }

  const idMapping = new Map<string, string>();
  let nodeCount = 0;
  let relationCount = 0;
  let conversationCount = 0;

  for (const nodeData of parsed.nodes) {
    const oldId = String(nodeData.id || '');
    const newId = uuidv4();
    idMapping.set(oldId, newId);

    const remappedParentIds = (nodeData.parentIds as string[] || []).map(
      (pid: string) => idMapping.get(pid) || pid
    );
    const remappedChildrenIds = (nodeData.childrenIds as string[] || []).map(
      (cid: string) => idMapping.get(cid) || cid
    );
    const remappedCompositeChildren = (nodeData.compositeChildren as string[] || []).map(
      (ccid: string) => idMapping.get(ccid) || ccid
    );
    const remappedCompositeParent = nodeData.compositeParent
      ? idMapping.get(String(nodeData.compositeParent)) || String(nodeData.compositeParent)
      : undefined;

    await nodeService.createNode({
      id: newId,
      title: String(nodeData.title || '未命名节点'),
      summary: String(nodeData.summary || ''),
      isRoot: Boolean(nodeData.isRoot),
      isComposite: Boolean(nodeData.isComposite),
      compositeChildren: remappedCompositeChildren,
      compositeParent: remappedCompositeParent,
      hidden: Boolean(nodeData.hidden),
      expanded: Boolean(nodeData.expanded),
      position: (nodeData.position as { x: number; y: number }) || { x: 100, y: 100 },
      tags: (nodeData.tags as string[]) || [],
      parentIds: remappedParentIds,
      childrenIds: remappedChildrenIds,
    }, workspaceId, visitorId);
    nodeCount++;
  }

  if (parsed.relations && Array.isArray(parsed.relations)) {
    for (const relData of parsed.relations) {
      const oldSourceId = String(relData.sourceId || '');
      const oldTargetId = String(relData.targetId || '');
      const newSourceId = idMapping.get(oldSourceId);
      const newTargetId = idMapping.get(oldTargetId);

      if (!newSourceId || !newTargetId) continue;

      await nodeService.createRelation({
        sourceId: newSourceId,
        targetId: newTargetId,
        type: String(relData.type || 'parent-child') as RelationType,
        description: relData.description ? String(relData.description) : undefined,
      }, workspaceId);
      relationCount++;
    }
  }

  if (parsed.conversations && Array.isArray(parsed.conversations)) {
    for (const convData of parsed.conversations) {
      const oldNodeId = String(convData.nodeId || '');
      const newNodeId = idMapping.get(oldNodeId);
      if (!newNodeId) continue;

      const newConvId = uuidv4();
      const conv = await conversationService.createConversation(newNodeId, workspaceId, visitorId, newConvId);

      const messages = (convData.messages as Array<Record<string, unknown>>) || [];
      for (const msg of messages) {
        await conversationService.addMessage(conv.id, {
          role: String(msg.role || 'user') as 'user' | 'assistant' | 'system',
          content: String(msg.content || ''),
        });
      }
      conversationCount++;
    }
  }

  return { nodes: nodeCount, relations: relationCount, conversations: conversationCount };
}

/**
 * 导入Markdown大纲格式数据
 * 解析Markdown标题/列表层级结构，生成节点树
 * @param data - Markdown字符串
 * @param workspaceId - 目标工作区ID
 * @param visitorId - 操作者访客ID
 * @returns 导入计数
 */
async function importMarkdown(data: string, workspaceId: string, visitorId: string): Promise<{ nodes: number; relations: number; conversations: number }> {
  const lines = data.split('\n');
  let nodeCount = 0;
  let relationCount = 0;

  const stack: Array<{ id: string; depth: number }> = [];
  let currentRootId: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith('# ') || line.startsWith('> ') || line.startsWith('---') || line.startsWith('标签:')) {
      if (line.startsWith('## ')) {
        const title = line.replace(/^##\s+/, '').trim();
        if (!title) continue;

        const rootNode = await nodeService.createNode({
          title,
          isRoot: true,
          position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 80 },
        }, workspaceId, visitorId);
        currentRootId = rootNode.id;
        stack.length = 0;
        stack.push({ id: rootNode.id, depth: 0 });
        nodeCount++;
      }
      continue;
    }

    const listMatch = line.match(/^(\s*)-\s+(.+)/);
    if (!listMatch || !currentRootId) continue;

    const indent = listMatch[1].length;
    const depth = Math.floor(indent / 2) + 1;
    let title = listMatch[2].trim();

    const summaryMatch = title.match(/^(.+?)\s*>\s*(.+)$/);
    let summary = '';
    if (summaryMatch) {
      title = summaryMatch[1].trim();
      summary = summaryMatch[2].trim();
    }

    while (stack.length > 1 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parentId = stack[stack.length - 1].id;
    const childNode = await nodeService.createChildNode(parentId, title, workspaceId, visitorId, {
      position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 80 },
    });

    if (summary) {
      await nodeService.updateNode(childNode.id, { summary });
    }

    stack.push({ id: childNode.id, depth });
    nodeCount++;
    relationCount++;
  }

  if (nodeCount === 0) {
    const h1Match = data.match(/^#\s+(.+)/m);
    if (h1Match) {
      const title = h1Match[1].trim();
      const rootNode = await nodeService.createNode({
        title,
        isRoot: true,
        position: { x: 100, y: 100 },
      }, workspaceId, visitorId);
      currentRootId = rootNode.id;
      nodeCount++;
    }
  }

  return { nodes: nodeCount, relations: relationCount, conversations: 0 };
}

export default router;
